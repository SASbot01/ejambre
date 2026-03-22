import { orchestrator } from '../agents/orchestrator.js';
import { eventBus } from '../events/event-bus.js';
import { query, queryOne } from '../config/database.js';
import { v4 as uuid } from 'uuid';

export function registerRoutes(app) {
  // ============================================
  // HEALTH CHECK
  // ============================================
  app.get('/health', async () => {
    return { status: 'ok', service: 'enjambre-cerebro', timestamp: new Date().toISOString() };
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
    const { limit = 50, agent, type } = req.query;
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

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(Number(limit));

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
    const { status, limit = 50 } = req.query;
    let sql = 'SELECT * FROM leads';
    const params = [];

    if (status) {
      params.push(status);
      sql += ` WHERE status = $1`;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(Number(limit));

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
