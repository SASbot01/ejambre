// ============================================
// AI Usage Tracker — logs token consumption per agent
// Uses Supabase brain_decisions table with decision_type='ai_usage'
// ============================================

import { supabase } from '../config/database.js';

// Anthropic pricing (per 1M tokens) — updated April 2026
const PRICING = {
  'claude-3-5-haiku-20241022':   { input: 0.80,  output: 4.00,  cache_read: 0.08, cache_create: 1.00 },
  'claude-haiku-4-5-20251001':   { input: 0.80,  output: 4.00,  cache_read: 0.08, cache_create: 1.00 },
  'claude-sonnet-4-6':           { input: 3.00,  output: 15.00, cache_read: 0.30, cache_create: 3.75 },
  'claude-sonnet-4-20250514':    { input: 3.00,  output: 15.00, cache_read: 0.30, cache_create: 3.75 },
  'claude-opus-4-6':             { input: 15.00, output: 75.00, cache_read: 1.50, cache_create: 18.75 },
};

function calculateCost(model, usage) {
  const p = PRICING[model] || PRICING['claude-3-5-haiku-20241022'];
  const inp = (usage.input_tokens || 0) / 1_000_000 * p.input;
  const out = (usage.output_tokens || 0) / 1_000_000 * p.output;
  const cacheRead = (usage.cache_read_input_tokens || 0) / 1_000_000 * p.cache_read;
  const cacheCreate = (usage.cache_creation_input_tokens || 0) / 1_000_000 * p.cache_create;
  return Math.round((inp + out + cacheRead + cacheCreate) * 1_000_000) / 1_000_000; // 6 decimals
}

/**
 * Log AI API usage to Supabase
 * @param {string} agent - Agent name (e.g., 'orchestrator', 'setter_luka', 'prospector')
 * @param {string} model - Model ID used
 * @param {object} usage - Anthropic response.usage object
 * @param {object} [meta] - Optional metadata (client_id, operation, contact_id, etc.)
 */
export async function trackAiUsage(agent, model, usage, meta = {}) {
  if (!usage) return;
  try {
    const cost = calculateCost(model, usage);
    const payload = {
      agent,
      model,
      input_tokens: usage.input_tokens || 0,
      output_tokens: usage.output_tokens || 0,
      cache_read_tokens: usage.cache_read_input_tokens || 0,
      cache_create_tokens: usage.cache_creation_input_tokens || 0,
      total_tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
      cost_usd: cost,
      ...meta,
    };

    // Log to Supabase brain_decisions (already exists, has JSONB)
    if (supabase) {
      await supabase.from('brain_decisions').insert({
        decision_type: 'ai_usage',
        agents_involved: [agent],
        reasoning: `${model} | ${payload.total_tokens} tokens | $${cost.toFixed(6)}`,
        actions_taken: [payload],
        confidence: cost, // repurpose as cost for easy sorting
      });
    }
  } catch (err) {
    // Silent fail — don't break the agent flow for metrics
    console.error('[AI Tracker] Error:', err.message);
  }
}

/**
 * Query aggregated AI usage stats
 * @param {object} [filters] - { days, agent, client_id }
 * @returns {object} Aggregated stats
 */
export async function getAiUsageStats(filters = {}) {
  if (!supabase) return null;
  try {
    const days = filters.days || 30;
    const since = new Date(Date.now() - days * 86400000).toISOString();

    let query = supabase
      .from('brain_decisions')
      .select('actions_taken, created_at')
      .eq('decision_type', 'ai_usage')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error || !data) return { agents: {}, total: {}, daily: [] };

    // Aggregate
    const agents = {};
    const daily = {};
    let totalTokens = 0, totalCost = 0, totalCalls = 0;

    for (const row of data) {
      const payload = row.actions_taken?.[0];
      if (!payload) continue;

      const agent = payload.agent || 'unknown';
      const day = row.created_at?.slice(0, 10) || 'unknown';

      if (!agents[agent]) agents[agent] = { calls: 0, input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, total_tokens: 0, cost_usd: 0, models: {} };
      agents[agent].calls++;
      agents[agent].input_tokens += payload.input_tokens || 0;
      agents[agent].output_tokens += payload.output_tokens || 0;
      agents[agent].cache_read_tokens += payload.cache_read_tokens || 0;
      agents[agent].total_tokens += payload.total_tokens || 0;
      agents[agent].cost_usd += payload.cost_usd || 0;
      agents[agent].models[payload.model] = (agents[agent].models[payload.model] || 0) + 1;

      if (!daily[day]) daily[day] = { calls: 0, tokens: 0, cost: 0 };
      daily[day].calls++;
      daily[day].tokens += payload.total_tokens || 0;
      daily[day].cost += payload.cost_usd || 0;

      totalTokens += payload.total_tokens || 0;
      totalCost += payload.cost_usd || 0;
      totalCalls++;
    }

    return {
      agents,
      total: { calls: totalCalls, tokens: totalTokens, cost_usd: totalCost },
      daily: Object.entries(daily).sort(([a], [b]) => b.localeCompare(a)).map(([date, d]) => ({ date, ...d })),
    };
  } catch (err) {
    console.error('[AI Tracker] Stats error:', err.message);
    return null;
  }
}
