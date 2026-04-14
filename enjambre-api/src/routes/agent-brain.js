// ============================================
// Routes: /api/ai-brain — decisiones, feedback, aprendizajes
// ============================================

import { supabase } from '../config/database.js';
import Anthropic from '@anthropic-ai/sdk';

const EXTRACTION_MODEL = 'claude-sonnet-4-6';
const anthropic = new Anthropic();

export function registerBrainRoutes(app) {
  // -----------------------------------------
  // Decisiones recientes (para el panel)
  // -----------------------------------------
  app.get('/api/ai-brain/decisions', async (req, reply) => {
    if (!supabase) return reply.code(503).send({ error: 'supabase not configured' });
    const { client_id, agent_name, limit = 100, with_feedback } = req.query || {};
    let q = supabase
      .from('agent_decisions')
      .select('id, client_id, client_slug, contact_id, agent_name, action_type, input, output, context, model, tokens_in, tokens_out, cost_usd, duration_ms, created_at')
      .order('created_at', { ascending: false })
      .limit(Math.min(Number(limit) || 100, 500));
    if (client_id) q = q.eq('client_id', client_id);
    if (agent_name) q = q.eq('agent_name', agent_name);
    const { data, error } = await q;
    if (error) return reply.code(500).send({ error: error.message });

    if (!with_feedback || !data?.length) return { decisions: data || [] };
    const ids = data.map(d => d.id);
    const { data: fb } = await supabase.from('agent_feedback').select('decision_id, verdict, notes, user_email, created_at').in('decision_id', ids);
    const fbByDecision = {};
    (fb || []).forEach(f => { (fbByDecision[f.decision_id] = fbByDecision[f.decision_id] || []).push(f); });
    return { decisions: data.map(d => ({ ...d, feedback: fbByDecision[d.id] || [] })) };
  });

  // -----------------------------------------
  // Dar feedback a una decisión
  // -----------------------------------------
  app.post('/api/ai-brain/feedback', async (req, reply) => {
    if (!supabase) return reply.code(503).send({ error: 'supabase not configured' });
    const { decision_id, verdict, notes, user_email } = req.body || {};
    if (!decision_id || !verdict) return reply.code(400).send({ error: 'decision_id y verdict requeridos' });
    if (!['good', 'bad', 'neutral'].includes(verdict)) return reply.code(400).send({ error: 'verdict debe ser good|bad|neutral' });
    const { data, error } = await supabase
      .from('agent_feedback')
      .insert({ decision_id, verdict, notes: notes || null, user_email: user_email || null, source: 'human' })
      .select('id').single();
    if (error) return reply.code(500).send({ error: error.message });
    return { ok: true, id: data.id };
  });

  // -----------------------------------------
  // Listar aprendizajes (con filtro de status + paginación)
  // -----------------------------------------
  app.get('/api/ai-brain/learnings', async (req, reply) => {
    if (!supabase) return reply.code(503).send({ error: 'supabase not configured' });
    const { status = 'pending', agent_name, client_id, limit = 20, offset = 0 } = req.query || {};
    const lim = Math.min(Number(limit) || 20, 100);
    const off = Math.max(Number(offset) || 0, 0);
    let q = supabase
      .from('agent_learnings')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(off, off + lim - 1);
    if (status && status !== 'all') q = q.eq('status', status);
    if (agent_name) q = q.eq('agent_name', agent_name);
    if (client_id) q = q.eq('client_id', client_id);
    const { data, error, count } = await q;
    if (error) return reply.code(500).send({ error: error.message });
    return { learnings: data || [], total: count || 0, limit: lim, offset: off };
  });

  // -----------------------------------------
  // Bulk approve / reject
  // -----------------------------------------
  app.post('/api/ai-brain/learnings/bulk', async (req, reply) => {
    if (!supabase) return reply.code(503).send({ error: 'supabase not configured' });
    const { ids, action, user_email, reason } = req.body || {};
    if (!Array.isArray(ids) || !ids.length || !action) return reply.code(400).send({ error: 'ids[] y action requeridos' });
    const now = new Date().toISOString();
    let patch;
    if (action === 'approve') patch = { status: 'approved', approved_by: user_email || null, approved_at: now, rejected_by: null, rejected_at: null, rejection_reason: null };
    else if (action === 'reject') patch = { status: 'rejected', rejected_by: user_email || null, rejected_at: now, rejection_reason: reason || null };
    else if (action === 'delete') {
      const { error } = await supabase.from('agent_learnings').delete().in('id', ids);
      if (error) return reply.code(500).send({ error: error.message });
      return { ok: true, affected: ids.length };
    } else return reply.code(400).send({ error: 'action debe ser approve|reject|delete' });
    const { error } = await supabase.from('agent_learnings').update(patch).in('id', ids);
    if (error) return reply.code(500).send({ error: error.message });
    return { ok: true, affected: ids.length };
  });

  // -----------------------------------------
  // Timeline diario (para gráficos de evolución)
  // -----------------------------------------
  app.get('/api/ai-brain/timeline', async (req, reply) => {
    if (!supabase) return reply.code(503).send({ error: 'supabase not configured' });
    const { client_id, agent_name, days = 30 } = req.query || {};
    const since = new Date(Date.now() - (Number(days) || 30) * 86400000).toISOString();
    try {
      // Decisiones por día
      let dq = supabase.from('agent_decisions').select('created_at, cost_usd, tokens_in, tokens_out').gte('created_at', since);
      if (client_id) dq = dq.eq('client_id', client_id);
      if (agent_name) dq = dq.eq('agent_name', agent_name);
      const { data: decisions } = await dq;

      // Feedback por día
      const decIds = (decisions || []).map(() => null); // we need ids — refetch with id
      let dq2 = supabase.from('agent_decisions').select('id').gte('created_at', since);
      if (client_id) dq2 = dq2.eq('client_id', client_id);
      if (agent_name) dq2 = dq2.eq('agent_name', agent_name);
      const { data: decIds2 } = await dq2;
      const idList = (decIds2 || []).map(d => d.id);
      const { data: feedback } = idList.length
        ? await supabase.from('agent_feedback').select('verdict, created_at').in('decision_id', idList)
        : { data: [] };

      // Aprendizajes creados por día
      let lq = supabase.from('agent_learnings').select('status, created_at').gte('created_at', since);
      if (client_id) lq = lq.eq('client_id', client_id);
      if (agent_name) lq = lq.eq('agent_name', agent_name);
      const { data: learnings } = await lq;

      // Agrupar
      const buckets = {};
      const day = iso => iso?.slice(0, 10);
      (decisions || []).forEach(d => {
        const k = day(d.created_at); if (!k) return;
        if (!buckets[k]) buckets[k] = { date: k, decisions: 0, feedback_good: 0, feedback_bad: 0, learnings_created: 0, cost: 0, tokens: 0 };
        buckets[k].decisions++;
        buckets[k].cost += Number(d.cost_usd || 0);
        buckets[k].tokens += (d.tokens_in || 0) + (d.tokens_out || 0);
      });
      (feedback || []).forEach(f => {
        const k = day(f.created_at); if (!k) return;
        if (!buckets[k]) buckets[k] = { date: k, decisions: 0, feedback_good: 0, feedback_bad: 0, learnings_created: 0, cost: 0, tokens: 0 };
        if (f.verdict === 'good') buckets[k].feedback_good++;
        else if (f.verdict === 'bad') buckets[k].feedback_bad++;
      });
      (learnings || []).forEach(l => {
        const k = day(l.created_at); if (!k) return;
        if (!buckets[k]) buckets[k] = { date: k, decisions: 0, feedback_good: 0, feedback_bad: 0, learnings_created: 0, cost: 0, tokens: 0 };
        buckets[k].learnings_created++;
      });
      const sorted = Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));
      return { timeline: sorted };
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // -----------------------------------------
  // Aprobar / Rechazar aprendizaje
  // -----------------------------------------
  app.post('/api/ai-brain/learnings/:id/approve', async (req, reply) => {
    if (!supabase) return reply.code(503).send({ error: 'supabase not configured' });
    const { user_email } = req.body || {};
    const { error } = await supabase
      .from('agent_learnings')
      .update({ status: 'approved', approved_by: user_email || null, approved_at: new Date().toISOString(), rejected_by: null, rejected_at: null, rejection_reason: null })
      .eq('id', req.params.id);
    if (error) return reply.code(500).send({ error: error.message });
    return { ok: true };
  });

  app.post('/api/ai-brain/learnings/:id/reject', async (req, reply) => {
    if (!supabase) return reply.code(503).send({ error: 'supabase not configured' });
    const { user_email, reason } = req.body || {};
    const { error } = await supabase
      .from('agent_learnings')
      .update({ status: 'rejected', rejected_by: user_email || null, rejected_at: new Date().toISOString(), rejection_reason: reason || null })
      .eq('id', req.params.id);
    if (error) return reply.code(500).send({ error: error.message });
    return { ok: true };
  });

  app.delete('/api/ai-brain/learnings/:id', async (req, reply) => {
    if (!supabase) return reply.code(503).send({ error: 'supabase not configured' });
    const { error } = await supabase.from('agent_learnings').delete().eq('id', req.params.id);
    if (error) return reply.code(500).send({ error: error.message });
    return { ok: true };
  });

  // -----------------------------------------
  // Crear aprendizaje manual (útil para bootstrap)
  // -----------------------------------------
  app.post('/api/ai-brain/learnings', async (req, reply) => {
    if (!supabase) return reply.code(503).send({ error: 'supabase not configured' });
    const { agent_name, pattern, pattern_type = 'context', rationale, client_id, confidence = 0.70, auto_approve, user_email } = req.body || {};
    if (!agent_name || !pattern) return reply.code(400).send({ error: 'agent_name y pattern requeridos' });
    const payload = {
      agent_name, pattern, pattern_type, rationale: rationale || null,
      client_id: client_id || null, confidence,
      status: auto_approve ? 'approved' : 'pending',
      approved_by: auto_approve ? (user_email || 'system') : null,
      approved_at: auto_approve ? new Date().toISOString() : null,
    };
    const { data, error } = await supabase.from('agent_learnings').insert(payload).select('*').single();
    if (error) return reply.code(500).send({ error: error.message });
    return { learning: data };
  });

  // -----------------------------------------
  // Extraer patrones con Claude (trigger manual o cron semanal)
  // -----------------------------------------
  app.post('/api/ai-brain/extract-patterns', async (req, reply) => {
    if (!supabase) return reply.code(503).send({ error: 'supabase not configured' });
    const { agent_name, client_id, days = 7, max_decisions = 200 } = req.body || {};
    if (!agent_name) return reply.code(400).send({ error: 'agent_name requerido' });

    const since = new Date(Date.now() - days * 86400000).toISOString();

    // Fetch decisions + their feedback
    let dq = supabase
      .from('agent_decisions')
      .select('id, input, output, context, created_at, client_id')
      .eq('agent_name', agent_name)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(max_decisions);
    if (client_id) dq = dq.eq('client_id', client_id);
    const { data: decisions, error: derr } = await dq;
    if (derr) return reply.code(500).send({ error: derr.message });
    if (!decisions?.length) return { extracted: 0, message: 'no decisions to analyze' };

    const ids = decisions.map(d => d.id);
    const { data: feedback } = await supabase
      .from('agent_feedback')
      .select('decision_id, verdict, notes')
      .in('decision_id', ids);
    const fbMap = {};
    (feedback || []).forEach(f => { (fbMap[f.decision_id] = fbMap[f.decision_id] || []).push(f); });

    // Build compact summary for Claude
    const sample = decisions.slice(0, 80).map(d => {
      const fbs = fbMap[d.id] || [];
      const verdict = fbs.length ? fbs.map(f => f.verdict).join(',') : 'no_feedback';
      return {
        input: (d.input?.user_message || JSON.stringify(d.input || '')).slice(0, 300),
        output: (d.output?.response || JSON.stringify(d.output || '')).slice(0, 300),
        context: d.context,
        verdict,
        notes: fbs.map(f => f.notes).filter(Boolean).join('|').slice(0, 200),
      };
    });

    const prompt = `Analiza las siguientes ${sample.length} decisiones del agente "${agent_name}" y extrae entre 3 y 10 PATRONES DE APRENDIZAJE concretos que puedan inyectarse en su system prompt para mejorar su rendimiento.

Cada patrón debe ser una regla breve, accionable, basada en datos reales. Clasifícalo como "do", "dont", "prefer", "avoid", o "context".

Datos:
${JSON.stringify(sample, null, 2)}

Devuelve SOLO JSON válido con este formato exacto:
{
  "patterns": [
    {
      "pattern_type": "do|dont|prefer|avoid|context",
      "pattern": "<regla breve accionable>",
      "rationale": "<en qué decisiones se basa>",
      "confidence": 0.0-1.0
    }
  ]
}`;

    try {
      const response = await anthropic.messages.create({
        model: EXTRACTION_MODEL,
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return reply.code(500).send({ error: 'no JSON in response', raw: text.slice(0, 500) });
      const parsed = JSON.parse(jsonMatch[0]);
      const patterns = parsed.patterns || [];
      if (!patterns.length) return { extracted: 0, message: 'no patterns extracted' };

      const inserts = patterns.map(p => ({
        agent_name,
        client_id: client_id || null,
        pattern_type: p.pattern_type || 'context',
        pattern: p.pattern,
        rationale: p.rationale || null,
        confidence: Math.min(Math.max(Number(p.confidence) || 0.5, 0), 1),
        source_decision_ids: ids.slice(0, 50),
        status: 'pending',
      }));
      const { data: saved, error: ierr } = await supabase.from('agent_learnings').insert(inserts).select('id');
      if (ierr) return reply.code(500).send({ error: ierr.message });
      return { extracted: saved?.length || 0, patterns };
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // -----------------------------------------
  // Estadísticas agregadas (para header del panel)
  // -----------------------------------------
  app.get('/api/ai-brain/stats', async (req, reply) => {
    if (!supabase) return reply.code(503).send({ error: 'supabase not configured' });
    const { client_id } = req.query || {};
    try {
      const base = supabase.from('agent_learnings').select('*', { count: 'exact', head: true });
      const { count: pending } = client_id ? await base.eq('status', 'pending').eq('client_id', client_id) : await base.eq('status', 'pending');
      const base2 = supabase.from('agent_learnings').select('*', { count: 'exact', head: true });
      const { count: approved } = client_id ? await base2.eq('status', 'approved').eq('client_id', client_id) : await base2.eq('status', 'approved');
      const base3 = supabase.from('agent_decisions').select('*', { count: 'exact', head: true });
      const { count: decisions24h } = client_id
        ? await base3.gte('created_at', new Date(Date.now() - 86400000).toISOString()).eq('client_id', client_id)
        : await base3.gte('created_at', new Date(Date.now() - 86400000).toISOString());
      return { pending_learnings: pending || 0, approved_learnings: approved || 0, decisions_24h: decisions24h || 0 };
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });
}
