// Dona — General
// Daemon que:
//  1. Expone HTTP ligero /order (humano → orden) y /status (dashboard → estado).
//  2. Escucha reportes de Comandantes vía eventBus (army.reports.*).
//  3. Guarda órdenes y briefings en tabla general_orders.
// No invoca tools directamente — delega a Comandantes.
// Por ahora es minimalista: acepta órdenes, las registra, las reenvía por eventBus
// y los Comandantes deciden si atenderlas. En fases posteriores, planifica y
// descompone órdenes complejas con Claude Sonnet.

import Fastify from 'fastify';
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { armyQuery } from './db.js';
import { eventBus } from '../events/event-bus.js';
import { trackAiUsage } from '../utils/ai-tracker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client = new Anthropic();
const MODEL = process.env.AGENT_GENERAL_MODEL || 'claude-sonnet-4-5-20250929';
const PORT = parseInt(process.env.GENERAL_PORT || '8789', 10);

const DOCTRINE = readFileSync(path.join(__dirname, 'doctrine', 'general.md'), 'utf8');
const KNOWN_AGENTS = ['crm', 'ops', 'dev', 'forms'];

const app = Fastify({ logger: false });

// Escucha reportes de todos los Comandantes
for (const agent of KNOWN_AGENTS) {
  eventBus.on(`army.reports.${agent}`, report => {
    console.log(`[Dona General] ← ${agent.toUpperCase()} reporta patrol#${report.cycle}: ${report.summary}`);
  });
}

async function planOrder(objective) {
  // Claude Sonnet decide qué Comandantes atacan la orden.
  const systemPrompt =
    DOCTRINE +
    '\n\n---\n\nEn este momento tu tarea es recibir una orden del humano y decidir qué Comandantes la atienden. ' +
    `Comandantes disponibles: ${KNOWN_AGENTS.join(', ')}. ` +
    'Responde estrictamente en JSON: {"assigned_to":["..."], "sub_briefings": {"crm":"...", "ops":"..."} , "reasoning":"1 frase"}. ' +
    'No añadas texto fuera del JSON.';
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: objective }],
  });
  trackAiUsage('general', MODEL, response.usage, { operation: 'plan_order' });
  const raw = response.content
    .filter(c => c.type === 'text')
    .map(c => c.text)
    .join('\n')
    .trim();
  try {
    // Tolerar ```json ... ``` wrappers
    const stripped = raw.replace(/^```json\s*|\s*```$/g, '').replace(/^```\s*|\s*```$/g, '');
    return JSON.parse(stripped);
  } catch (err) {
    return { assigned_to: [], sub_briefings: {}, reasoning: `parse-error: ${raw.slice(0, 120)}` };
  }
}

app.get('/status', async () => {
  const rows = await armyQuery(
    'SELECT agent_name, status, last_patrol_at, last_patrol_summary, patrol_cycles, dry_run, updated_at FROM army_heartbeats ORDER BY agent_name'
  );
  return { army: rows, ts: new Date().toISOString() };
});

app.post('/order', async (req, reply) => {
  const body = req.body || {};
  const objective = (body.objective || body.input || '').toString().trim();
  if (!objective) {
    reply.code(400);
    return { error: 'objective required' };
  }
  const origin = body.origin || 'human';
  const id = randomUUID();
  const plan = await planOrder(objective);
  const assignedTo = Array.isArray(plan.assigned_to)
    ? plan.assigned_to.filter(a => KNOWN_AGENTS.includes(a))
    : [];

  await armyQuery(
    `INSERT INTO general_orders (id, origin, objective, assigned_to, status, briefing_back)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, origin, objective, assignedTo, 'pending', JSON.stringify(plan)]
  );

  for (const agent of assignedTo) {
    try {
      await eventBus.publish(`army.orders.${agent}`, 'general', {
        order_id: id,
        objective,
        briefing: plan.sub_briefings?.[agent] || objective,
      });
    } catch (e) { /* best-effort */ }
  }

  return {
    order_id: id,
    assigned_to: assignedTo,
    plan,
    note: assignedTo.length ? 'Comandantes notificados' : 'Sin asignación — revisar',
  };
});

app.get('/health', async () => ({ ok: true, role: 'general', model: MODEL }));

async function main() {
  console.log(`[Dona General] startup — model=${MODEL} port=${PORT}`);
  await app.listen({ host: '0.0.0.0', port: PORT });
  console.log(`[Dona General] listening on :${PORT}`);
}

main().catch(err => {
  console.error('[Dona General] fatal:', err);
  process.exit(1);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    console.log(`[Dona General] ${sig} — shutting down`);
    await app.close();
    process.exit(0);
  });
}
