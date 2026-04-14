import { orchestrator } from '../agents/orchestrator.js';
import { eventBus } from '../events/event-bus.js';
import { query, queryOne } from '../config/database.js';
import { authenticate } from '../auth/auth.js';
import { enrollLead } from '../workers/sequence-worker.js';
import { registerBrainRoutes } from './agent-brain.js';
import { registerWeeklyFeedbackRoutes } from './weekly-feedback.js';
import { registerDiscordAgentRoutes } from './agent-discord.js';

export function registerRoutes(app) {
  // ============================================
  // HEALTH CHECK
  // ============================================
  app.get('/api/health', async () => {
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
  // SETTER DOCS (local files)
  // ============================================
  app.get('/api/setter-docs', async () => {
    const { readdirSync, statSync } = await import('fs');
    const { join, dirname } = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const docsDir = join(__dirname, '..', 'setter_docs');
    try {
      const files = readdirSync(docsDir).filter(f => f.endsWith('.md')).sort();
      return files.map(f => {
        const st = statSync(join(docsDir, f));
        return { name: f, size: st.size, type: 'text/markdown' };
      });
    } catch { return []; }
  });

  // ============================================
  // WEBHOOK CENTRAL (Dashboard-Ops → Enjambre)
  // Recibe eventos de central: prospector, email, CRM changes
  // Crea leads enriquecidos y enrolla en secuencias automáticas
  // ============================================
  app.post('/api/webhooks/central', async (req) => {
    const data = req.body;
    const event = data.event || data.type || 'central.unknown';
    const source = data.source || 'central';
    const contactData = data.data || data.payload || {};

    // Map source agent names from Central
    const agentMap = {
      prospector: 'prospector',
      personalizer: 'prospector',
      enricher: 'prospector',
      analytics: 'ops',
      email: 'prospector',
    };
    const sourceAgent = agentMap[source] || source;

    // ── LEAD FOUND: Prospector created a CRM contact → create enriched lead + auto-enroll
    if (event === 'agent.lead_found' && contactData.contactId) {
      try {
        // Check if lead already exists for this contact
        const existing = await queryOne(
          'SELECT id FROM leads WHERE metadata->>\'crm_contact_id\' = $1',
          [contactData.contactId]
        );

        if (!existing) {
          // Fetch full contact from Supabase via Dashboard-Ops data
          const company = contactData.company || '';
          const country = contactData.country || '';

          const lead = await queryOne(
            `INSERT INTO leads (nombre, email, telefono, producto, landing_source, status, utm_source, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
              company,
              contactData.email || null,
              contactData.phone || null,
              contactData.product || null,
              'prospector-agent',
              'nuevo',
              'dashboard-ops',
              JSON.stringify({
                crm_contact_id: contactData.contactId,
                client_id: data.client_id || null,
                company,
                country,
                ceo_name: contactData.ceo_name || null,
                ceo_email: contactData.ceo_email || null,
                ceo_linkedin: contactData.ceo_linkedin || null,
                enriched: true,
                source_agent: sourceAgent,
              }),
            ]
          );

          // Auto-enroll in follow-up sequence
          if (lead) {
            await enrollLead(lead.id);
            console.log(`[Central] Lead created from Prospector: ${company} → enrolled in sequences`);
          }

          await eventBus.publish('lead.created', sourceAgent, {
            lead_id: lead?.id,
            email: contactData.email,
            company,
            source: 'prospector',
            crm_contact_id: contactData.contactId,
          });

          return { ok: true, event, lead_id: lead?.id, enrolled: true };
        } else {
          return { ok: true, event, lead_id: existing.id, enrolled: false, reason: 'duplicate' };
        }
      } catch (err) {
        console.error('[Central] Error creating lead from Prospector:', err.message);
        // Still publish the event even if lead creation fails
        await eventBus.publish(event, sourceAgent, { ...contactData, error: err.message });
        return { ok: true, event, error: err.message };
      }
    }

    // ── EMAIL CAMPAIGN SENT: track which leads received emails
    if (event === 'email.campaign_sent') {
      await eventBus.publish(event, 'prospector', contactData);
      return { ok: true, event };
    }

    // ── CRM STATUS CHANGED: update lead status in Enjambre
    if (event === 'crm.status_changed' && contactData.contactId) {
      try {
        const statusMap = {
          contacted: 'contactado',
          qualified: 'calificado',
          won: 'ganado',
          lost: 'perdido',
          proposal: 'calificado',
          negotiation: 'calificado',
        };
        const newStatus = statusMap[contactData.newStatus] || contactData.newStatus;

        await query(
          `UPDATE leads SET status = $1 WHERE metadata->>'crm_contact_id' = $2`,
          [newStatus, contactData.contactId]
        );
        console.log(`[Central] Lead status updated: ${contactData.contactId} → ${newStatus}`);
      } catch (err) {
        console.error('[Central] Error updating lead status:', err.message);
      }
      await eventBus.publish(event, sourceAgent, contactData);
      return { ok: true, event };
    }

    // ── Generic event passthrough
    await eventBus.publish(event, sourceAgent, {
      action: data.action || null,
      data: contactData,
      client_id: data.client_id || null,
      contact_id: data.contact_id || null,
    });

    return { ok: true, event, source: sourceAgent };
  });

  // ============================================
  // SEQUENCES
  // ============================================
  app.get('/api/sequences', async () => {
    return query('SELECT * FROM sequences ORDER BY created_at DESC');
  });

  app.get('/api/sequences/enrollments', async (req) => {
    const { status = 'active', limit = 50 } = req.query;
    return query(
      `SELECT se.*, s.name as sequence_name, l.nombre, l.email, l.telefono, l.producto
       FROM sequence_enrollments se
       JOIN sequences s ON s.id = se.sequence_id
       JOIN leads l ON l.id = se.lead_id
       WHERE se.status = $1
       ORDER BY se.next_fire_at ASC
       LIMIT $2`,
      [status, Number(limit)]
    );
  });

  app.post('/api/sequences/:leadId/enroll', async (req) => {
    await enrollLead(req.params.leadId);
    return { ok: true };
  });

  // ============================================
  // AGENT BRAIN — decisiones, feedback, aprendizajes
  // ============================================
  registerBrainRoutes(app);

  // ============================================
  // WEEKLY FEEDBACK — formulario semanal bloqueante
  // ============================================
  registerWeeklyFeedbackRoutes(app);

  // ============================================
  // DISCORD AGENT — control plane (proxy al bot Python)
  // ============================================
  registerDiscordAgentRoutes(app);

  // ============================================
  // SETUP: escuchar eventos automáticos
  // ============================================
  eventBus.on('lead.created', async (event) => {
    try {
      await orchestrator.processEvent(event);
      await enrollLead(event.payload?.lead_id);
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