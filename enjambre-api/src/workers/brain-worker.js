// ============================================
// Brain Worker — ejecuta extracción de patrones semanalmente
// Por cada (client_id, agent_name) con actividad reciente, llama al endpoint
// /api/ai-brain/extract-patterns interno. Los patrones quedan en estado
// 'pending' esperando aprobación humana.
// ============================================

import { supabase } from '../config/database.js';
import Anthropic from '@anthropic-ai/sdk';

const EXTRACTION_MODEL = 'claude-sonnet-4-6';
const EXCLUDED_SLUGS = new Set(['creator-founder', 'minimal']);
const anthropic = new Anthropic();

// Marca temporal del último run en memoria. Persistimos en settings si hace falta.
let lastRunAt = null;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // cada hora verifica si toca

async function extractForCombo({ client_id, agent_name, days = 7, max_decisions = 200 }) {
  if (!supabase) return { extracted: 0, reason: 'no_supabase' };

  const since = new Date(Date.now() - days * 86400000).toISOString();

  let dq = supabase
    .from('agent_decisions')
    .select('id, input, output, context, created_at')
    .eq('agent_name', agent_name)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(max_decisions);
  if (client_id) dq = dq.eq('client_id', client_id);
  const { data: decisions, error } = await dq;
  if (error || !decisions?.length) return { extracted: 0, reason: 'no_decisions' };

  const ids = decisions.map(d => d.id);
  const { data: feedback } = await supabase
    .from('agent_feedback').select('decision_id, verdict, notes').in('decision_id', ids);
  const fbMap = {};
  (feedback || []).forEach(f => { (fbMap[f.decision_id] = fbMap[f.decision_id] || []).push(f); });

  // Solo extraer si hay feedback significativo (>= 5 decisiones con verdict)
  const withFeedback = decisions.filter(d => fbMap[d.id]?.length);
  if (withFeedback.length < 5) return { extracted: 0, reason: 'insufficient_feedback' };

  const sample = decisions.slice(0, 80).map(d => {
    const fbs = fbMap[d.id] || [];
    return {
      input: (d.input?.user_message || JSON.stringify(d.input || '')).slice(0, 300),
      output: (d.output?.response || JSON.stringify(d.output || '')).slice(0, 300),
      context: d.context,
      verdict: fbs.length ? fbs.map(f => f.verdict).join(',') : 'no_feedback',
      notes: fbs.map(f => f.notes).filter(Boolean).join('|').slice(0, 200),
    };
  });

  const prompt = `Analiza estas ${sample.length} decisiones del agente "${agent_name}" y extrae entre 3 y 10 PATRONES DE APRENDIZAJE concretos y accionables basados sobre todo en las que tienen verdict "good" o "bad". Cada patrón debe ser una regla breve accionable.

Datos:
${JSON.stringify(sample, null, 2)}

Devuelve SOLO JSON:
{"patterns":[{"pattern_type":"do|dont|prefer|avoid|context","pattern":"<regla>","rationale":"<basado en>","confidence":0.0-1.0}]}`;

  try {
    const response = await anthropic.messages.create({
      model: EXTRACTION_MODEL, max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return { extracted: 0, reason: 'no_json' };
    const parsed = JSON.parse(m[0]);
    const patterns = parsed.patterns || [];
    if (!patterns.length) return { extracted: 0, reason: 'empty' };

    const inserts = patterns.map(p => ({
      agent_name, client_id: client_id || null,
      pattern_type: p.pattern_type || 'context',
      pattern: p.pattern, rationale: p.rationale || null,
      confidence: Math.min(Math.max(Number(p.confidence) || 0.5, 0), 1),
      source_decision_ids: ids.slice(0, 50),
      status: 'pending',
    }));
    const { data: saved, error: ierr } = await supabase.from('agent_learnings').insert(inserts).select('id');
    if (ierr) return { extracted: 0, reason: 'insert_error', error: ierr.message };
    return { extracted: saved?.length || 0, feedback_count: withFeedback.length };
  } catch (err) {
    return { extracted: 0, reason: 'exception', error: err.message };
  }
}

async function tick() {
  try {
    if (!supabase) return;
    const now = Date.now();
    if (lastRunAt && (now - lastRunAt) < WEEK_MS) return;

    console.log('[BrainWorker] Weekly extraction starting...');

    // Combos únicos (client_id, agent_name) con actividad en los últimos 7 días
    const since = new Date(now - WEEK_MS).toISOString();
    const { data: combos, error } = await supabase
      .from('agent_decisions')
      .select('client_id, agent_name, client_slug')
      .gte('created_at', since);
    if (error) { console.error('[BrainWorker] list error:', error.message); return; }

    const uniq = new Map();
    (combos || []).forEach(c => {
      if (EXCLUDED_SLUGS.has(c.client_slug)) return;
      const key = `${c.client_id || 'global'}|${c.agent_name}`;
      if (!uniq.has(key)) uniq.set(key, { client_id: c.client_id, agent_name: c.agent_name });
    });

    let totalExtracted = 0;
    for (const combo of uniq.values()) {
      const result = await extractForCombo(combo);
      if (result.extracted > 0) {
        console.log(`[BrainWorker] ${combo.agent_name} (${combo.client_id || 'global'}): ${result.extracted} patrones`);
        totalExtracted += result.extracted;
      }
    }

    lastRunAt = now;
    console.log(`[BrainWorker] Weekly done — ${totalExtracted} nuevos patrones pendientes de aprobación`);
  } catch (err) {
    console.error('[BrainWorker] tick error:', err.message);
  }
}

export function startBrainWorker() {
  console.log('[BrainWorker] Started — weekly auto-extraction active (checks every 1h)');
  // Primer tick tras 5 min de arranque para dar tiempo a que todo esté listo
  setTimeout(tick, 5 * 60 * 1000);
  setInterval(tick, CHECK_INTERVAL_MS);
}
