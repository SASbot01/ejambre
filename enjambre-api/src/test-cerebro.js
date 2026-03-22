// ============================================
// TEST DEL CEREBRO - Claude Orchestrator real
// Ejecutar: node --env-file=.env src/test-cerebro.js
// ============================================

import Anthropic from '@anthropic-ai/sdk';
import { ciberTools, ciberHandlers } from './tools/ciber-tools.js';
import { crmTools, crmHandlers } from './tools/crm-tools.js';
import { opsTools, opsHandlers } from './tools/ops-tools.js';

const client = new Anthropic();
const ALL_TOOLS = [...ciberTools, ...crmTools, ...opsTools];
const ALL_HANDLERS = { ...ciberHandlers, ...crmHandlers, ...opsHandlers };

const SYSTEM = `Eres el Cerebro del Enjambre BlackWolf. Coordinas 3 agentes:
- CIBER: SOC con amenazas reales, incidentes, sensores
- CRM: Pipeline de contactos y leads
- OPS: Ventas, equipo, comisiones, productos
Responde en español. Usa las herramientas para obtener datos reales.`;

async function testCerebro(prompt) {
  console.log(`\n🧠 PREGUNTA: "${prompt}"\n`);

  const messages = [{ role: 'user', content: prompt }];

  let response = await client.messages.create({
    model: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
    max_tokens: 2048,
    system: SYSTEM,
    tools: ALL_TOOLS,
    messages,
  });

  let toolCalls = 0;

  while (response.stop_reason === 'tool_use') {
    const toolBlocks = response.content.filter((b) => b.type === 'tool_use');
    const results = [];

    for (const block of toolBlocks) {
      toolCalls++;
      console.log(`   🔧 Tool ${toolCalls}: ${block.name}(${JSON.stringify(block.input).slice(0, 80)})`);

      let result;
      try {
        result = await ALL_HANDLERS[block.name](block.input);
      } catch (e) {
        result = { error: e.message };
      }

      results.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result).slice(0, 10000),
      });
    }

    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: results });

    response = await client.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
      max_tokens: 2048,
      system: SYSTEM,
      tools: ALL_TOOLS,
      messages,
    });
  }

  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  console.log(`\n🤖 RESPUESTA (${toolCalls} tools usados):\n${text}\n`);
  console.log('─'.repeat(60));
}

async function main() {
  console.log('🐺 ENJAMBRE - Test del Cerebro (Claude Orchestrator)\n');

  await testCerebro('Dame un resumen completo: estado del SOC, ventas del mes, y pipeline del CRM.');

  console.log('\n✅ Test del Cerebro completado.');
}

main().catch(console.error);
