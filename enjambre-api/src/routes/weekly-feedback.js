// ============================================
// Routes: /api/weekly-feedback — formulario semanal bloqueante
// ============================================

import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../config/database.js';

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 días
const SUMMARY_THRESHOLD = 5; // Generar resumen cuando se acumulan >=5 respuestas nuevas
const SUMMARY_MODEL = process.env.WEEKLY_FEEDBACK_SUMMARY_MODEL || 'claude-sonnet-4-5-20250929';

const anthropic = new Anthropic();

// --------------------------------------------------------------------------
// Genera el resumen conversacional de N respuestas usando Claude.
// El output habla como si fuera una persona contándoselo al CEO.
// --------------------------------------------------------------------------
async function generateFeedbackSummary(responses, formConfig) {
  const scaleMap = new Map((formConfig?.scale_questions || []).map(q => [q.key, q.label]));
  const yesnoMap = new Map((formConfig?.yesno_questions || []).map(q => [q.key, q.label]));

  const lines = responses.map((r, i) => {
    const header = `#${i + 1} · ${r.user_email}${r.user_type ? ` (${r.user_type})` : ''}${r.client_slug ? ` · ${r.client_slug}` : ''} · ${new Date(r.created_at).toISOString().slice(0, 10)}`;
    const scales = Object.entries(r.scale_answers || {})
      .map(([k, v]) => `  ${scaleMap.get(k) || k}: ${v}/10`).join('\n');
    const yesnos = Object.entries(r.yesno_answers || {}).map(([k, v]) => {
      const reason = r.yesno_reasons?.[k];
      const label = yesnoMap.get(k) || k;
      return `  ${label}: ${v ? 'Sí' : 'No'}${reason ? ` — "${reason}"` : ''}`;
    }).join('\n');
    const free = r.text_answer ? `  Texto libre: "${r.text_answer}"` : '';
    return [header, scales, yesnos, free].filter(Boolean).join('\n');
  }).join('\n\n');

  const system = `Eres un analista que prepara un resumen para el CEO de BlackWolf a partir del feedback semanal de su equipo y sus clientes.

Tu tarea: leer ${responses.length} respuestas y escribir UN ÚNICO MENSAJE hablado, como si se lo contaras al CEO por chat, en primera persona. Nada de listas formales ni secciones con títulos — redacción natural, directa, con algún salto de línea entre bloques.

Estructura esperada (sin poner los títulos, solo el contenido):
1. Saludo corto y contexto ("buenas, esto es lo que ha salido esta semana…").
2. Bugs / cosas rotas que aparezcan repetidas o críticas. Di claramente "esto habría que arreglarlo" y resume qué está fallando.
3. Peticiones de mejora o nuevas funcionalidades que no haya que aplicar literal, pero que sí apuntar como tareas. Usa literalmente la frase "apúntalo en tareas y pónselo a <nombre>" si el feedback menciona a alguien, o "apúntalo en tareas del responsable" si no.
4. Cosas que van bien — lo que más valoran, para no tocarlo ("esto mantenlo, va perfecto").
5. Cierre breve.

Reglas duras:
- Responde SIEMPRE en español de España.
- No inventes datos ni nombres que no estén en las respuestas.
- Si algo lo menciona solo 1 persona, dilo como "un usuario comenta que…". Si lo mencionan varios, remárcalo como patrón.
- Cita entrecomillado alguna frase literal del texto libre o de los motivos si aporta.
- Máximo 400 palabras.`;

  const user = `Respuestas a analizar:\n\n${lines}`;

  const res = await anthropic.messages.create({
    model: SUMMARY_MODEL,
    max_tokens: 1500,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text = res.content?.[0]?.text || '';
  return {
    text,
    model: SUMMARY_MODEL,
    tokensIn: res.usage?.input_tokens || 0,
    tokensOut: res.usage?.output_tokens || 0,
  };
}

async function runSummaryIfThresholdReached({ auto = true } = {}) {
  if (!supabase) return null;

  // IDs ya analizados
  const { data: sums } = await supabase
    .from('weekly_feedback_summaries')
    .select('analyzed_response_ids');
  const analyzedIds = new Set();
  for (const s of sums || []) {
    for (const id of (s.analyzed_response_ids || [])) analyzedIds.add(id);
  }

  // Respuestas sin analizar (excluyendo las que ya están en algún resumen)
  const { data: allResponses } = await supabase
    .from('weekly_feedback_responses')
    .select('*')
    .order('created_at', { ascending: true });
  const pending = (allResponses || []).filter(r => !analyzedIds.has(r.id));

  if (pending.length < SUMMARY_THRESHOLD) return { skipped: true, pendingCount: pending.length };

  // Form config activo
  const { data: formConfig } = await supabase
    .from('feedback_form_config')
    .select('*')
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { text, model, tokensIn, tokensOut } = await generateFeedbackSummary(pending, formConfig);

  const { data: inserted, error } = await supabase
    .from('weekly_feedback_summaries')
    .insert({
      summary_text: text,
      analyzed_count: pending.length,
      analyzed_response_ids: pending.map(r => r.id),
      model,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      auto_generated: auto,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return { summary: inserted, generated: true };
}

export function registerWeeklyFeedbackRoutes(app) {
  // ----------------------------------------
  // Config del formulario activo (v1 por defecto, editable desde BW home)
  // ----------------------------------------
  app.get('/api/weekly-feedback/config', async (req, reply) => {
    if (!supabase) return reply.code(503).send({ error: 'supabase not configured' });
    const { data, error } = await supabase
      .from('feedback_form_config')
      .select('*')
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return reply.code(500).send({ error: error.message });
    if (!data) return reply.code(404).send({ error: 'no active form config' });
    return data;
  });

  // ----------------------------------------
  // ¿El usuario necesita rellenar el form? (≥7 días desde la última respuesta)
  // ----------------------------------------
  app.get('/api/weekly-feedback/needs-response', async (req, reply) => {
    if (!supabase) return reply.code(503).send({ error: 'supabase not configured' });
    const { user_email } = req.query || {};
    if (!user_email) return reply.code(400).send({ error: 'user_email requerido' });

    const { data, error } = await supabase
      .from('weekly_feedback_responses')
      .select('created_at')
      .eq('user_email', user_email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return reply.code(500).send({ error: error.message });

    if (!data) return { needs: true, last_response_at: null, days_since: null };
    const last = new Date(data.created_at).getTime();
    const age = Date.now() - last;
    return {
      needs: age >= COOLDOWN_MS,
      last_response_at: data.created_at,
      days_since: Math.floor(age / 86400000),
    };
  });

  // ----------------------------------------
  // Enviar respuesta del form
  // ----------------------------------------
  app.post('/api/weekly-feedback/submit', async (req, reply) => {
    if (!supabase) return reply.code(503).send({ error: 'supabase not configured' });
    const {
      user_email, user_type, client_slug, client_id,
      form_version, scale_answers, yesno_answers, yesno_reasons, text_answer,
    } = req.body || {};

    if (!user_email || !form_version || !scale_answers || !yesno_answers) {
      return reply.code(400).send({ error: 'campos obligatorios: user_email, form_version, scale_answers, yesno_answers' });
    }

    // Validar estructura mínima
    const scaleKeys = Object.keys(scale_answers);
    const yesnoKeys = Object.keys(yesno_answers);
    if (scaleKeys.length < 4 || yesnoKeys.length < 3) {
      return reply.code(400).send({ error: 'faltan respuestas obligatorias (4 escala + 3 sí/no)' });
    }
    for (const k of scaleKeys) {
      const v = Number(scale_answers[k]);
      if (!Number.isFinite(v) || v < 1 || v > 10) {
        return reply.code(400).send({ error: `respuesta escala inválida: ${k}` });
      }
    }
    for (const k of yesnoKeys) {
      if (typeof yesno_answers[k] !== 'boolean') {
        return reply.code(400).send({ error: `respuesta sí/no inválida: ${k}` });
      }
    }

    // Limpiar yesno_reasons: solo guardar motivos no vacíos para preguntas respondidas "Sí"
    const cleanReasons = {};
    if (yesno_reasons && typeof yesno_reasons === 'object') {
      for (const [k, v] of Object.entries(yesno_reasons)) {
        if (yesno_answers[k] === true && typeof v === 'string' && v.trim()) {
          cleanReasons[k] = v.trim().slice(0, 2000);
        }
      }
    }

    const ua = req.headers['user-agent'] || null;
    const { data, error } = await supabase
      .from('weekly_feedback_responses')
      .insert({
        user_email, user_type: user_type || null,
        client_slug: client_slug || null, client_id: client_id || null,
        form_version: Number(form_version),
        scale_answers, yesno_answers,
        yesno_reasons: Object.keys(cleanReasons).length > 0 ? cleanReasons : null,
        text_answer: text_answer || null,
        user_agent: ua,
      })
      .select('id, created_at')
      .single();
    if (error) return reply.code(500).send({ error: error.message });

    // Auto-trigger: si hay >= SUMMARY_THRESHOLD respuestas sin analizar, genera resumen en background.
    runSummaryIfThresholdReached({ auto: true })
      .then(r => { if (r?.generated) console.log(`[weekly-feedback] Auto summary generated (${r.summary.analyzed_count} responses)`); })
      .catch(err => console.error('[weekly-feedback] Auto summary error:', err.message));

    return { ok: true, id: data.id, created_at: data.created_at };
  });

  // ----------------------------------------
  // Resúmenes IA acumulados (listar)
  // ----------------------------------------
  app.get('/api/weekly-feedback/summaries', async (req, reply) => {
    if (!supabase) return reply.code(503).send({ error: 'supabase not configured' });
    const { limit = 20 } = req.query || {};
    const { data, error } = await supabase
      .from('weekly_feedback_summaries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.min(Number(limit), 100));
    if (error) return reply.code(500).send({ error: error.message });

    // Contador de respuestas pendientes (para mostrar "faltan X para el próximo resumen auto")
    const { data: sums } = await supabase
      .from('weekly_feedback_summaries')
      .select('analyzed_response_ids');
    const analyzed = new Set();
    for (const s of sums || []) for (const id of (s.analyzed_response_ids || [])) analyzed.add(id);
    const { count: totalResponses } = await supabase
      .from('weekly_feedback_responses')
      .select('id', { count: 'exact', head: true });
    const pendingCount = Math.max(0, (totalResponses || 0) - analyzed.size);

    return {
      summaries: data || [],
      pending_count: pendingCount,
      threshold: SUMMARY_THRESHOLD,
    };
  });

  // ----------------------------------------
  // Generar resumen IA ahora (manual — no espera al umbral)
  // ----------------------------------------
  app.post('/api/weekly-feedback/generate-summary', async (req, reply) => {
    if (!supabase) return reply.code(503).send({ error: 'supabase not configured' });
    try {
      // IDs ya analizados
      const { data: sums } = await supabase
        .from('weekly_feedback_summaries')
        .select('analyzed_response_ids');
      const analyzedIds = new Set();
      for (const s of sums || []) for (const id of (s.analyzed_response_ids || [])) analyzedIds.add(id);

      const { data: allResponses } = await supabase
        .from('weekly_feedback_responses')
        .select('*')
        .order('created_at', { ascending: true });
      const pending = (allResponses || []).filter(r => !analyzedIds.has(r.id));

      if (pending.length === 0) {
        return reply.code(400).send({ error: 'No hay respuestas nuevas que analizar.' });
      }

      const { data: formConfig } = await supabase
        .from('feedback_form_config')
        .select('*')
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { text, model, tokensIn, tokensOut } = await generateFeedbackSummary(pending, formConfig);

      const { data: inserted, error } = await supabase
        .from('weekly_feedback_summaries')
        .insert({
          summary_text: text,
          analyzed_count: pending.length,
          analyzed_response_ids: pending.map(r => r.id),
          model,
          tokens_in: tokensIn,
          tokens_out: tokensOut,
          auto_generated: false,
        })
        .select('*')
        .single();
      if (error) return reply.code(500).send({ error: error.message });
      return { ok: true, summary: inserted };
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ----------------------------------------
  // Listado de respuestas (para el panel de BW home)
  // ----------------------------------------
  app.get('/api/weekly-feedback/responses', async (req, reply) => {
    if (!supabase) return reply.code(503).send({ error: 'supabase not configured' });
    const { limit = 50, offset = 0, client_slug, user_email, has_text } = req.query || {};
    let q = supabase
      .from('weekly_feedback_responses')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Math.min(Number(limit), 200) - 1);
    if (client_slug) q = q.eq('client_slug', client_slug);
    if (user_email) q = q.eq('user_email', user_email);
    if (has_text === 'true') q = q.not('text_answer', 'is', null);
    const { data, count, error } = await q;
    if (error) return reply.code(500).send({ error: error.message });
    return { responses: data || [], total: count || 0 };
  });

  // ----------------------------------------
  // Agregados / estadísticas para dashboard
  // ----------------------------------------
  app.get('/api/weekly-feedback/stats', async (req, reply) => {
    if (!supabase) return reply.code(503).send({ error: 'supabase not configured' });
    const { data, error } = await supabase
      .from('weekly_feedback_responses')
      .select('scale_answers, yesno_answers, created_at, client_slug');
    if (error) return reply.code(500).send({ error: error.message });

    const total = data.length;
    const scaleAgg = {};
    const yesnoAgg = {};
    const byClient = {};
    const last30 = Date.now() - 30 * 86400000;
    let last30Count = 0;

    for (const r of data) {
      if (new Date(r.created_at).getTime() >= last30) last30Count++;
      for (const [k, v] of Object.entries(r.scale_answers || {})) {
        if (!scaleAgg[k]) scaleAgg[k] = { sum: 0, count: 0 };
        scaleAgg[k].sum += Number(v) || 0;
        scaleAgg[k].count++;
      }
      for (const [k, v] of Object.entries(r.yesno_answers || {})) {
        if (!yesnoAgg[k]) yesnoAgg[k] = { yes: 0, no: 0 };
        if (v === true) yesnoAgg[k].yes++; else yesnoAgg[k].no++;
      }
      const cs = r.client_slug || 'unknown';
      byClient[cs] = (byClient[cs] || 0) + 1;
    }

    const scaleAvg = {};
    for (const [k, a] of Object.entries(scaleAgg)) {
      scaleAvg[k] = a.count ? +(a.sum / a.count).toFixed(2) : null;
    }

    return {
      total,
      last_30d: last30Count,
      scale_avg: scaleAvg,
      yesno_counts: yesnoAgg,
      by_client: byClient,
    };
  });

  // ----------------------------------------
  // Actualizar el form (nueva versión, desactiva las anteriores)
  // ----------------------------------------
  app.put('/api/weekly-feedback/config', async (req, reply) => {
    if (!supabase) return reply.code(503).send({ error: 'supabase not configured' });
    const {
      title, intro, scale_questions, yesno_questions, text_question_label, created_by,
    } = req.body || {};

    if (!title || !intro || !Array.isArray(scale_questions) || !Array.isArray(yesno_questions) || !text_question_label) {
      return reply.code(400).send({ error: 'campos requeridos: title, intro, scale_questions[], yesno_questions[], text_question_label' });
    }
    if (scale_questions.length < 4) return reply.code(400).send({ error: 'se requieren al menos 4 preguntas de escala' });
    if (yesno_questions.length < 3) return reply.code(400).send({ error: 'se requieren al menos 3 preguntas sí/no' });
    for (const q of [...scale_questions, ...yesno_questions]) {
      if (!q || !q.key || !q.label) return reply.code(400).send({ error: 'cada pregunta debe tener {key, label}' });
    }

    // Obtener la versión actual
    const { data: current } = await supabase
      .from('feedback_form_config')
      .select('version')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = (current?.version || 0) + 1;

    // Desactivar la versión anterior
    await supabase.from('feedback_form_config').update({ is_active: false }).eq('is_active', true);

    const { data, error } = await supabase
      .from('feedback_form_config')
      .insert({
        version: nextVersion, title, intro,
        scale_questions, yesno_questions, text_question_label,
        is_active: true, created_by: created_by || null,
      })
      .select('*')
      .single();
    if (error) return reply.code(500).send({ error: error.message });
    return data;
  });
}
