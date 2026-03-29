import { orchestrator } from '../agents/orchestrator.js';
import { eventBus } from '../events/event-bus.js';
import { query, queryOne } from '../config/database.js';
import { v4 as uuid } from 'uuid';
import { authenticate } from '../auth/auth.js';
import { startDevSession } from '../agents/dev-worker.js';

export function registerRoutes(app) {
  // ============================================
  // HEALTH CHECK
  // ============================================
  app.get('/health', async () => {
    return { status: 'ok', service: 'enjambre-cerebro', timestamp: new Date().toISOString() };
  });

  // ============================================
  // AUTENTICACIÓN
  // ============================================
  app.post('/api/auth/login', async (req, reply) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      reply.code(400).send({ error: 'email y password son requeridos' });
      return;
    }
    const result = authenticate(email, password);
    if (!result) {
      reply.code(401).send({ error: 'Credenciales inválidas' });
      return;
    }
    return result;
  });

  // ============================================
  // CHAT CON EL CEREBRO (Claude Orchestrator)
  // ============================================
  app.post('/api/chat', async (req) => {
    const { message, session_id = 'default' } = req.body;
    if (!message) return { error: 'message es requerido' };

    const result = await orchestrator.process(message, session_id);
    return result;
  });

  app.delete('/api/chat/:sessionId', async (req) => {
    orchestrator.clearSession(req.params.sessionId);
    return { ok: true };
  });

  // ============================================
  // EVENT STREAM (SSE)
  // ============================================
  app.get('/api/events/stream', async (req, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    reply.raw.write('data: {"type":"connected"}\n\n');

    eventBus.addSSEClient(reply);
    req.raw.on('close', () => eventBus.removeSSEClient(reply));

    // Mantener la conexión abierta
    return reply;
  });

  // ============================================
  // EVENTOS MANUALES
  // ============================================
  app.post('/api/events', async (req) => {
    const { event_type, source_agent, payload } = req.body;
    const event = await eventBus.publish(event_type, source_agent, payload);
    return event;
  });

  app.get('/api/events', async (req) => {
    const { limit = 50, offset = 0, agent, type } = req.query;
    let sql = 'SELECT * FROM events WHERE 1=1';
    const params = [];

    if (agent) {
      params.push(agent);
      sql += ` AND source_agent = $${params.length}`;
    }
    if (type) {
      params.push(type);
      sql += ` AND event_type = $${params.length}`;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit));
    params.push(Number(offset));

    return query(sql, params);
  });

  // ============================================
  // WEBHOOK PARA FORMULARIOS (reemplaza n8n)
  // ============================================
  app.post('/api/forms/webhook', async (req) => {
    const ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.ip;
    const data = req.body;

    // Validación mínima
    if (!data.email) {
      return { error: 'email es requerido' };
    }

    // Crear lead
    const lead = await queryOne(
      `INSERT INTO leads (nombre, email, telefono, producto, landing_source, ip_address, utm_source, utm_medium, utm_campaign)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.nombre || data.name || null,
        data.email,
        data.telefono || data.phone || null,
        data.producto || data.product || null,
        data.landing || data.source || null,
        ip,
        data.utm_source || null,
        data.utm_medium || null,
        data.utm_campaign || null,
      ]
    );

    // Publicar evento → el Cerebro lo procesa automáticamente
    await eventBus.publish('lead.created', 'forms', {
      lead_id: lead.id,
      email: lead.email,
      producto: lead.producto,
      ip_address: ip,
      landing_source: lead.landing_source,
    });

    return { ok: true, lead_id: lead.id };
  });

  // ============================================
  // WEBHOOK PARA SOC (recibe alertas del SOC)
  // ============================================
  app.post('/api/webhooks/soc', async (req) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.SOC_API_KEY) {
      return { error: 'unauthorized' };
    }

    const { type, severity, source_ip, details } = req.body;

    await eventBus.publish('threat.detected', 'ciber', {
      type,
      severity,
      source_ip,
      details,
    });

    return { ok: true };
  });

  // ============================================
  // ESTADO DE AGENTES
  // ============================================
  app.get('/api/agents/status', async () => {
    return query('SELECT * FROM agent_status');
  });

  app.put('/api/agents/:name/heartbeat', async (req) => {
    const { metrics } = req.body || {};
    return queryOne(
      `UPDATE agent_status SET last_heartbeat = NOW(), metrics = COALESCE($1, metrics)
       WHERE agent_name = $2 RETURNING *`,
      [metrics ? JSON.stringify(metrics) : null, req.params.name]
    );
  });

  // ============================================
  // DECISIONES DEL CEREBRO
  // ============================================
  app.get('/api/decisions', async (req) => {
    const { limit = 20 } = req.query;
    return query(
      'SELECT * FROM brain_decisions ORDER BY created_at DESC LIMIT $1',
      [Number(limit)]
    );
  });

  // ============================================
  // LEADS
  // ============================================
  app.get('/api/leads', async (req) => {
    const { status, limit = 50, offset = 0 } = req.query;
    let sql = 'SELECT * FROM leads';
    const params = [];

    if (status) {
      params.push(status);
      sql += ` WHERE status = $1`;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit));
    params.push(Number(offset));

    return query(sql, params);
  });

  app.get('/api/leads/stats', async () => {
    const stats = await query(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status = 'nuevo') as nuevos,
         COUNT(*) FILTER (WHERE status = 'contactado') as contactados,
         COUNT(*) FILTER (WHERE status = 'calificado') as calificados,
         COUNT(*) FILTER (WHERE status = 'ganado') as ganados,
         COUNT(*) FILTER (WHERE status = 'perdido') as perdidos,
         COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as hoy,
         COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE)) as esta_semana
       FROM leads`
    );
    return stats[0];
  });

  // ============================================
  // SETTERS
  // ============================================
  app.get('/api/setters', async () => {
    return query('SELECT * FROM setters ORDER BY nombre');
  });

  app.post('/api/setters', async (req) => {
    const { nombre, email } = req.body;
    return queryOne(
      'INSERT INTO setters (nombre, email) VALUES ($1, $2) RETURNING *',
      [nombre, email]
    );
  });

  // ============================================
  // WEBHOOK CENTRAL (Dashboard-Ops → Enjambre)
  // Recibe logs de agentes de central.blackwolfsec.io
  // ============================================
  app.post('/api/webhooks/central', async (req) => {
    const data = req.body;

    // Map Central event to Enjambre event
    const event = data.event || data.type || 'central.unknown';
    const source = data.source || 'central';
    const payload = {
      action: data.action || null,
      data: data.data || data.payload || {},
      client_id: data.client_id || null,
      contact_id: data.contact_id || null,
      original_event: event,
    };

    // Map source agent names from Central
    const agentMap = {
      prospector: 'prospector',
      personalizer: 'prospector',
      enricher: 'prospector',
      analytics: 'ops',
      email: 'prospector',
    };

    const sourceAgent = agentMap[source] || source;

    await eventBus.publish(event, sourceAgent, payload);

    return { ok: true, event, source: sourceAgent };
  });

  // ============================================
  // DEV AGENT — Developer AI
  // ============================================

  // Tickets CRUD
  app.get('/api/dev/tickets', async () => {
    return query('SELECT * FROM dev_tickets ORDER BY created_at DESC LIMIT 100');
  });

  app.post('/api/dev/tickets', async (req) => {
    const { title, description, project, status } = req.body;
    return queryOne(
      'INSERT INTO dev_tickets (title, description, project, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, description || null, project || 'general', status || 'pending']
    );
  });

  app.put('/api/dev/tickets/:id', async (req) => {
    const { status, result } = req.body;
    return queryOne(
      'UPDATE dev_tickets SET status = COALESCE($1, status), result = COALESCE($2, result), updated_at = NOW() WHERE id = $3 RETURNING *',
      [status, result, req.params.id]
    );
  });

  // Sessions
  app.get('/api/dev/sessions', async () => {
    return query('SELECT * FROM dev_sessions ORDER BY created_at DESC LIMIT 20');
  });

  app.post('/api/dev/sessions', async (req) => {
    const { duration_hours } = req.body;
    const session = await queryOne(
      'INSERT INTO dev_sessions (duration_hours, status) VALUES ($1, $2) RETURNING *',
      [duration_hours || 2, 'active']
    );

    // Launch autonomous dev worker in background
    startDevSession(duration_hours || 2, session.id, eventBus, queryOne).catch(err => {
      console.error('[DevWorker] Session error:', err.message);
    });

    return session;
  });

  // Chat with Dev Agent
  app.post('/api/dev/chat', async (req) => {
    const { message, session_id } = req.body;
    if (!message) return { error: 'message requerido' };

    try {
      const result = await orchestrator.process(
        `[DEV AGENT] El usuario te habla como Dev Agent. Tu rol es analizar, optimizar y mejorar los proyectos de BlackWolf (Enjambre, SOC, Dashboard-Ops). ` +
        `REGLA CRITICA: NUNCA toques datos de clientes, CRM, ventas, leads, ni contactos. Solo codigo, configuracion, rendimiento y seguridad. ` +
        `Si creas un ticket, responde con JSON {tickets_created: [{title, description, project}]} al final. ` +
        `Proyectos: Enjambre (/home/s4sf/ejambre), SOC (/home/s4sf/ejambre/soc si existe), Dashboard-Ops (/home/s4sf/ejambre/Dashboard-Ops-). ` +
        `Mensaje del usuario: ${message}`,
        `dev-${session_id || 'default'}`
      );

      // Try to extract tickets from response
      let tickets_created = [];
      try {
        const jsonMatch = result.response?.match(/\{[\s\S]*tickets_created[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.tickets_created) {
            for (const t of parsed.tickets_created) {
              const ticket = await queryOne(
                'INSERT INTO dev_tickets (title, description, project) VALUES ($1, $2, $3) RETURNING *',
                [t.title, t.description || null, t.project || 'general']
              );
              tickets_created.push(ticket);
            }
          }
        }
      } catch {}

      await eventBus.publish('dev.chat', 'developer', { message: message.slice(0, 100), tickets: tickets_created.length });

      return {
        response: result.response?.replace(/\{[\s\S]*tickets_created[\s\S]*\}/, '').trim() || result.response,
        tickets_created,
      };
    } catch (err) {
      return { error: err.message, response: `Error: ${err.message}`, tickets_created: [] };
    }
  });

  // ============================================
  // SETUP: escuchar eventos automáticos
  // ============================================
  eventBus.on('lead.created', async (event) => {
    try {
      await orchestrator.processEvent(event);
    } catch (err) {
      console.error('Error procesando lead.created:', err.message);
    }
  });

  eventBus.on('threat.detected', async (event) => {
    try {
      await orchestrator.processEvent(event);
    } catch (err) {
      console.error('Error procesando threat.detected:', err.message);
    }
  });
}