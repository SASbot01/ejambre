// ============================================================================
// Dona — Base Commander
// Un Comandante es un proceso autónomo con patrulla continua, memoria
// persistente en Postgres, reportes al General vía event bus, y prompt
// caching para mantener el coste controlado.
// ============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { armyQuery } from './db.js';
import { eventBus } from '../events/event-bus.js';
import { trackAiUsage } from '../utils/ai-tracker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client = new Anthropic();

// Precios indicativos (USD por 1M tokens). Ajustar si Anthropic cambia.
const MODEL_PRICES = {
  'claude-haiku-4-5-20251001': { in: 1, out: 5 },
  'claude-sonnet-4-5-20250929': { in: 3, out: 15 },
  'claude-3-5-haiku-20241022': { in: 0.8, out: 4 },
};

function estimateCost(model, usage) {
  const p = MODEL_PRICES[model] || MODEL_PRICES['claude-3-5-haiku-20241022'];
  return ((usage.input_tokens || 0) * p.in + (usage.output_tokens || 0) * p.out) / 1_000_000;
}

export class BaseCommander {
  /**
   * @param {object} opts
   * @param {string} opts.name              'crm' | 'ops' | 'dev' | 'forms'
   * @param {string} opts.displayName       'Dona CRM'
   * @param {string} opts.doctrineFile      ruta al .md de doctrina
   * @param {Array} opts.tools              tools Anthropic
   * @param {object} opts.handlers          handlers de esas tools
   * @param {string} opts.model             id del modelo Claude
   * @param {number} opts.patrolEverySec    intervalo de patrulla
   * @param {string} opts.patrolPrompt      qué hacer en cada patrulla
   * @param {boolean} opts.dryRun
   */
  constructor(opts) {
    this.name = opts.name;
    this.displayName = opts.displayName || `Dona ${opts.name.toUpperCase()}`;
    this.doctrine = this._loadDoctrine(opts.doctrineFile);
    this.tools = opts.tools || [];
    this.handlers = opts.handlers || {};
    this.model = opts.model;
    this.patrolEverySec = opts.patrolEverySec || 300;
    this.patrolPrompt = opts.patrolPrompt;
    this.dryRun = opts.dryRun ?? (process.env.ARMY_DRY_RUN === '1');

    this.cycles = 0;
    this.timer = null;
    this.currentMissionId = null;
  }

  _loadDoctrine(doctrineFile) {
    const abs = path.isAbsolute(doctrineFile)
      ? doctrineFile
      : path.join(__dirname, 'doctrine', doctrineFile);
    if (!existsSync(abs)) {
      throw new Error(`Doctrine not found for ${this.name}: ${abs}`);
    }
    return readFileSync(abs, 'utf8');
  }

  _cachedSystem() {
    const fullSystem = [
      this.doctrine,
      '',
      '---',
      '',
      this.dryRun
        ? '⚠ MODO DRY-RUN ACTIVO — no ejecutas acciones destructivas. Solo describes lo que harías.'
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    return [{ type: 'text', text: fullSystem, cache_control: { type: 'ephemeral' } }];
  }

  _cachedTools() {
    if (!this.tools.length) return [];
    // Marcamos la última con cache_control para cachear el bloque entero
    return this.tools.map((t, i, arr) =>
      i === arr.length - 1 ? { ...t, cache_control: { type: 'ephemeral' } } : t,
    );
  }

  async start() {
    console.log(`[${this.displayName}] startup — model=${this.model} interval=${this.patrolEverySec}s dry_run=${this.dryRun}`);
    await this._heartbeat('patrolling', 'starting');
    // Primera patrulla ya mismo
    this._tick().catch(err => console.error(`[${this.displayName}] initial tick error:`, err));
    this.timer = setInterval(() => {
      this._tick().catch(err => console.error(`[${this.displayName}] tick error:`, err));
    }, this.patrolEverySec * 1000);

    // Graceful shutdown
    for (const sig of ['SIGINT', 'SIGTERM']) {
      process.on(sig, async () => {
        console.log(`[${this.displayName}] received ${sig} — shutting down`);
        if (this.timer) clearInterval(this.timer);
        await this._heartbeat('down', 'shutdown');
        process.exit(0);
      });
    }
  }

  async _tick() {
    this.cycles += 1;
    const missionId = randomUUID();
    this.currentMissionId = missionId;
    const cycleLabel = `patrol #${this.cycles}`;
    console.log(`[${this.displayName}] ${cycleLabel} — mission=${missionId.slice(0, 8)}`);

    try {
      const result = await this._runAgentLoop(this.patrolPrompt, missionId);
      await this._persistDecision(missionId, 'patrol', result.summary, {
        cycle: this.cycles,
        tools_used: result.toolsUsed,
        final_text: result.finalText,
      }, result.usage);
      await this._heartbeat('patrolling', result.summary, result.usage);
      try {
        await eventBus.publish(`army.reports.${this.name}`, this.name, {
          mission_id: missionId,
          cycle: this.cycles,
          summary: result.summary,
        });
      } catch (e) { /* publish may be best-effort if events table missing */ }
    } catch (err) {
      console.error(`[${this.displayName}] patrol error:`, err.message);
      await this._persistDecision(missionId, 'error', err.message, { stack: err.stack?.split('\n').slice(0, 5) });
      await this._heartbeat('degraded', `error: ${err.message}`);
    } finally {
      this.currentMissionId = null;
    }
  }

  async _runAgentLoop(userPrompt, missionId, maxIterations = 5) {
    const messages = [{ role: 'user', content: userPrompt }];
    let toolsUsed = [];
    let finalText = '';
    let totalUsage = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };

    for (let i = 0; i < maxIterations; i++) {
      const response = await client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: this._cachedSystem(),
        tools: this._cachedTools(),
        messages,
      });

      // Acumular usage
      for (const k of Object.keys(totalUsage)) {
        totalUsage[k] += response.usage?.[k] || 0;
      }
      trackAiUsage(this.name, this.model, response.usage, { mission_id: missionId, cycle: this.cycles });

      if (response.stop_reason === 'end_turn' || !response.content.some(c => c.type === 'tool_use')) {
        finalText = response.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('\n');
        break;
      }

      // Añadir respuesta del modelo
      messages.push({ role: 'assistant', content: response.content });

      // Ejecutar tools
      const toolResults = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        toolsUsed.push(block.name);
        if (this.dryRun && this._isMutatingTool(block.name)) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: `[DRY-RUN] Tool ${block.name} NO ejecutada. Inputs: ${JSON.stringify(block.input)}`,
          });
          continue;
        }
        try {
          const handler = this.handlers[block.name];
          if (!handler) throw new Error(`No handler for tool ${block.name}`);
          const out = await handler(block.input);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: typeof out === 'string' ? out : JSON.stringify(out),
          });
        } catch (err) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: `ERROR: ${err.message}`,
            is_error: true,
          });
        }
      }
      messages.push({ role: 'user', content: toolResults });
    }

    const summary = finalText.slice(0, 280) || `patrol#${this.cycles} — ${toolsUsed.length} tools used`;
    return { summary, finalText, toolsUsed, usage: totalUsage };
  }

  _isMutatingTool(name) {
    // Heurística: tools que crean/actualizan/envían son mutantes.
    return /^(crm_create|crm_update|crm_log|ops_audit|forms_update|dev_exec)/.test(name);
  }

  async _persistDecision(missionId, type, summary, payload, usage = {}) {
    const cost = usage.input_tokens ? estimateCost(this.model, usage) : null;
    try {
      await armyQuery(
        `INSERT INTO ${this.name}_decisions
         (mission_id, patrol_cycle, decision_type, summary, payload, tokens_input, tokens_output, cost_usd)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          missionId,
          this.cycles,
          type,
          summary,
          payload,
          usage.input_tokens || null,
          usage.output_tokens || null,
          cost,
        ],
      );
    } catch (err) {
      console.error(`[${this.displayName}] persist decision failed:`, err.message);
    }
  }

  async _heartbeat(status, summary, usage = {}) {
    try {
      await armyQuery(
        `INSERT INTO army_heartbeats (agent_name, status, last_patrol_at, last_patrol_summary, patrol_cycles, tokens_last_hour, dry_run, updated_at)
         VALUES ($1,$2, now(), $3, $4, $5, $6, now())
         ON CONFLICT (agent_name) DO UPDATE SET
           status=EXCLUDED.status,
           last_patrol_at=EXCLUDED.last_patrol_at,
           last_patrol_summary=EXCLUDED.last_patrol_summary,
           patrol_cycles=EXCLUDED.patrol_cycles,
           tokens_last_hour=EXCLUDED.tokens_last_hour,
           dry_run=EXCLUDED.dry_run,
           updated_at=now()`,
        [
          this.name,
          status,
          summary,
          this.cycles,
          (usage.input_tokens || 0) + (usage.output_tokens || 0),
          this.dryRun,
        ],
      );
    } catch (err) {
      console.error(`[${this.displayName}] heartbeat failed:`, err.message);
    }
  }
}
