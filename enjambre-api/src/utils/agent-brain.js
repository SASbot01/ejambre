// ============================================
// Agent Brain — decision capture + learnings injection
// Persistencia en Supabase: agent_decisions, agent_feedback, agent_learnings
// ============================================

import { supabase } from '../config/database.js';

// Clientes de prueba — NO se les captura ni se les inyectan aprendizajes
const EXCLUDED_SLUGS = new Set(['creator-founder', 'minimal']);

const slugCache = new Map(); // clientId -> slug

export async function resolveClientSlug(clientId) {
  if (!clientId) return null;
  if (slugCache.has(clientId)) return slugCache.get(clientId);
  if (!supabase) return null;
  try {
    const { data } = await supabase.from('clients').select('slug').eq('id', clientId).maybeSingle();
    const slug = data?.slug || null;
    slugCache.set(clientId, slug);
    return slug;
  } catch { return null; }
}

export function isExcludedClient(slug) {
  return !!slug && EXCLUDED_SLUGS.has(slug);
}

/**
 * Registra una decisión de un agente. Devuelve el id de la decisión o null.
 * Diseñado para ser fire-and-forget — nunca rompe el flujo del agente.
 */
export async function captureDecision({
  clientId, clientSlug, contactId, agentName, actionType,
  input, output, context, reasoning, model,
  tokensIn, tokensOut, costUsd, durationMs, sessionId,
}) {
  try {
    if (!supabase) return null;
    const slug = clientSlug || await resolveClientSlug(clientId);
    if (isExcludedClient(slug)) return null;

    const { data, error } = await supabase
      .from('agent_decisions')
      .insert({
        client_id: clientId || null,
        client_slug: slug,
        contact_id: contactId || null,
        agent_name: agentName,
        action_type: actionType,
        input: input || null,
        output: output || null,
        context: context || null,
        reasoning: reasoning || null,
        model: model || null,
        tokens_in: tokensIn || 0,
        tokens_out: tokensOut || 0,
        cost_usd: costUsd || 0,
        duration_ms: durationMs || null,
        session_id: sessionId || null,
      })
      .select('id')
      .single();
    if (error) {
      console.error('[Brain] captureDecision error:', error.message);
      return null;
    }
    return data?.id || null;
  } catch (err) {
    console.error('[Brain] captureDecision exception:', err.message);
    return null;
  }
}

/**
 * Devuelve aprendizajes aprobados que deben inyectarse en el prompt de un agente.
 * Prioriza los específicos del cliente sobre los globales (client_id NULL).
 * Limita a topN para no inflar el prompt.
 */
export async function getApprovedLearnings({ clientId, agentName, topN = 10 }) {
  try {
    if (!supabase || !agentName) return [];
    const slug = await resolveClientSlug(clientId);
    if (isExcludedClient(slug)) return [];

    // Specific + global
    const { data, error } = await supabase
      .from('agent_learnings')
      .select('id, pattern, pattern_type, confidence, client_id, times_applied')
      .eq('status', 'approved')
      .eq('agent_name', agentName)
      .or(`client_id.eq.${clientId},client_id.is.null`)
      .order('confidence', { ascending: false })
      .order('times_applied', { ascending: false })
      .limit(topN);
    if (error) {
      console.error('[Brain] getApprovedLearnings error:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[Brain] getApprovedLearnings exception:', err.message);
    return [];
  }
}

/**
 * Marca aprendizajes como aplicados (incrementa counter + fecha).
 * Fire-and-forget.
 */
export async function markLearningsApplied(learningIds) {
  try {
    if (!supabase || !learningIds?.length) return;
    await supabase.rpc('increment_learnings_applied', { ids: learningIds }).catch(async () => {
      // Fallback sin RPC: update uno a uno
      for (const id of learningIds) {
        await supabase
          .from('agent_learnings')
          .update({ times_applied: undefined, last_applied_at: new Date().toISOString() })
          .eq('id', id);
      }
    });
  } catch { /* silent */ }
}

/**
 * Formatea aprendizajes como bloque de texto para inyectar en system prompt.
 * Devuelve '' si no hay learnings.
 */
export function formatLearningsForPrompt(learnings) {
  if (!learnings?.length) return '';
  const bullets = learnings.map(l => {
    const tag = l.pattern_type?.toUpperCase() || 'NOTA';
    return `- [${tag}] ${l.pattern}`;
  }).join('\n');
  return `Lo que has aprendido de interacciones anteriores (aplícalo sin mencionarlo):\n${bullets}`;
}
