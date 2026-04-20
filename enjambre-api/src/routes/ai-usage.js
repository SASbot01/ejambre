// /api/ai-usage — agregadores de coste/tokens de Claude por agente, día, modelo.
// Lee de brain_decisions (donde trackAiUsage escribe con decision_type='ai_usage').

import { supabase } from '../config/database.js';

function parseRange(req) {
  const { from, to, days } = req.query || {};
  const now = new Date();
  let toDate = to ? new Date(to) : now;
  let fromDate;
  if (from) fromDate = new Date(from);
  else {
    const d = Math.max(1, Math.min(365, Number(days) || 30));
    fromDate = new Date(toDate.getTime() - d * 86400_000);
  }
  return { fromIso: fromDate.toISOString(), toIso: toDate.toISOString() };
}

async function fetchUsageRows(fromIso, toIso) {
  if (!supabase) return [];
  // brain_decisions guarda actions_taken[0] como payload
  const { data, error } = await supabase
    .from('brain_decisions')
    .select('id, agents_involved, reasoning, actions_taken, confidence, created_at')
    .eq('decision_type', 'ai_usage')
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .order('created_at', { ascending: false })
    .limit(50_000);
  if (error) throw new Error(error.message);
  return (data || []).map(row => {
    const p = Array.isArray(row.actions_taken) ? row.actions_taken[0] : row.actions_taken;
    return {
      created_at: row.created_at,
      agent: p?.agent || (row.agents_involved && row.agents_involved[0]) || 'unknown',
      model: p?.model || 'unknown',
      input_tokens: Number(p?.input_tokens || 0),
      output_tokens: Number(p?.output_tokens || 0),
      cache_read_tokens: Number(p?.cache_read_tokens || 0),
      cache_create_tokens: Number(p?.cache_create_tokens || 0),
      total_tokens: Number(p?.total_tokens || 0),
      cost_usd: Number(p?.cost_usd ?? row.confidence ?? 0),
      client_id: p?.client_id || null,
    };
  });
}

function aggregate(rows) {
  const byAgent = new Map();
  const byModel = new Map();
  const byDay = new Map();
  let totalCost = 0, totalTokens = 0;

  for (const r of rows) {
    totalCost += r.cost_usd;
    totalTokens += r.total_tokens;

    const ka = r.agent;
    const a = byAgent.get(ka) || { agent: ka, calls: 0, tokens: 0, cost_usd: 0 };
    a.calls++; a.tokens += r.total_tokens; a.cost_usd += r.cost_usd;
    byAgent.set(ka, a);

    const km = r.model;
    const m = byModel.get(km) || { model: km, calls: 0, tokens: 0, cost_usd: 0 };
    m.calls++; m.tokens += r.total_tokens; m.cost_usd += r.cost_usd;
    byModel.set(km, m);

    const day = r.created_at.slice(0, 10);
    const d = byDay.get(day) || { day, calls: 0, tokens: 0, cost_usd: 0 };
    d.calls++; d.tokens += r.total_tokens; d.cost_usd += r.cost_usd;
    byDay.set(day, d);
  }

  const round = obj => ({ ...obj, cost_usd: Math.round(obj.cost_usd * 1_000_000) / 1_000_000 });
  return {
    totals: {
      calls: rows.length,
      tokens: totalTokens,
      cost_usd: Math.round(totalCost * 1_000_000) / 1_000_000,
    },
    byAgent: Array.from(byAgent.values()).map(round).sort((a, b) => b.cost_usd - a.cost_usd),
    byModel: Array.from(byModel.values()).map(round).sort((a, b) => b.cost_usd - a.cost_usd),
    byDay: Array.from(byDay.values()).map(round).sort((a, b) => a.day.localeCompare(b.day)),
  };
}

export function registerAiUsageRoutes(app) {
  // GET /api/ai-usage?days=30 — agregados
  app.get('/api/ai-usage', async (req, reply) => {
    try {
      const { fromIso, toIso } = parseRange(req);
      const rows = await fetchUsageRows(fromIso, toIso);
      const agg = aggregate(rows);
      return {
        range: { from: fromIso, to: toIso },
        ...agg,
      };
    } catch (err) {
      reply.code(500);
      return { error: err.message };
    }
  });

  // GET /api/ai-usage/recent?limit=50 — últimas llamadas (debug)
  app.get('/api/ai-usage/recent', async (req, reply) => {
    try {
      const limit = Math.max(1, Math.min(500, Number(req.query?.limit) || 50));
      const { fromIso, toIso } = parseRange(req);
      const rows = (await fetchUsageRows(fromIso, toIso)).slice(0, limit);
      return { rows };
    } catch (err) {
      reply.code(500);
      return { error: err.message };
    }
  });
}
