// ============================================
// CEREBRO DEL ENJAMBRE
// Claude Orchestrator con Tool Use
// ============================================

import Anthropic from '@anthropic-ai/sdk';
import { ciberTools, ciberHandlers } from '../tools/ciber-tools.js';
import { crmTools, crmHandlers } from '../tools/crm-tools.js';
import { opsTools, opsHandlers } from '../tools/ops-tools.js';
import { eventBus } from '../events/event-bus.js';
import { query } from '../config/database.js';

const client = new Anthropic();

// Todas las herramientas combinadas
const ALL_TOOLS = [...ciberTools, ...crmTools, ...opsTools];

// Todos los handlers combinados
const ALL_HANDLERS = { ...ciberHandlers, ...crmHandlers, ...opsHandlers };

const SYSTEM_PROMPT = `Eres el "Cerebro del Enjambre" (Swarm Orchestrator) de BlackWolf.
Tu función es coordinar una red de agentes especializados:

## Agentes disponibles:
1. **CIBER** (Ciberseguridad/SOC): Amenazas, IPs maliciosas, incidentes, playbooks SOAR
2. **CRM** (Ventas/Leads): Pipeline de ventas, leads de infoproductos, asignación de setters
3. **OPS** (Operaciones/ERP): Revenue, comisiones, rendimiento del equipo, proyecciones

## Protocolo de operación:
- Cuando detectes una amenaza, cruza datos con CRM (¿la IP es de un cliente?) y OPS (¿hay transacciones desde esa IP?)
- Cuando llegue un lead nuevo, verifica su IP con CIBER (¿es bot/fraude?) y asigna un setter con CRM
- Cuando haya anomalías en ventas, audita con OPS y verifica con CIBER
- Antes de bloquear una IP que coincida con un cliente VIP, reporta al humano

## Reglas:
- Responde SIEMPRE en español
- Sé conciso y directo
- Usa las herramientas para obtener datos reales, nunca inventes datos
- Si una herramienta falla (servicio no disponible), informa el error y continúa con lo que puedas
- Para acciones drásticas (bloquear IP, cambiar estado de cuenta), explica el razonamiento
- Prioriza: 1) Seguridad, 2) Experiencia del cliente, 3) Eficiencia operativa`;

export class Orchestrator {
  constructor() {
    this.conversations = new Map(); // sessionId -> messages[]
  }

  async process(input, sessionId = 'default') {
    // Obtener o crear historial de conversación
    if (!this.conversations.has(sessionId)) {
      this.conversations.set(sessionId, []);
    }
    const messages = this.conversations.get(sessionId);

    // Agregar mensaje del usuario/sistema
    messages.push({ role: 'user', content: input });

    // Limitar historial a 30 mensajes
    if (messages.length > 30) {
      messages.splice(0, messages.length - 30);
    }

    // Llamar a Claude con las herramientas
    let response = await client.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: ALL_TOOLS,
      messages,
    });

    const actionsLog = [];

    // Agentic loop: ejecutar herramientas hasta que Claude termine
    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
      const toolResults = [];

      for (const toolUse of toolUseBlocks) {
        const handler = ALL_HANDLERS[toolUse.name];
        let result;

        try {
          if (!handler) {
            result = { error: `Herramienta ${toolUse.name} no encontrada` };
          } else {
            result = await handler(toolUse.input);
          }
        } catch (err) {
          result = { error: err.message };
        }

        // Log de la acción
        const action = {
          tool: toolUse.name,
          input: toolUse.input,
          success: !result?.error,
          agent: toolUse.name.split('_')[0],
        };
        actionsLog.push(action);

        // Publicar evento en la pizarra
        await eventBus.publish(
          `tool.${result?.error ? 'error' : 'executed'}`,
          action.agent,
          { tool: toolUse.name, input: toolUse.input, result_preview: JSON.stringify(result).slice(0, 500) }
        );

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      // Agregar la respuesta de Claude y los resultados al historial
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });

      // Siguiente iteración
      response = await client.messages.create({
        model: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: ALL_TOOLS,
        messages,
      });
    }

    // Extraer la respuesta final de texto
    const textBlocks = response.content.filter((b) => b.type === 'text');
    const finalText = textBlocks.map((b) => b.text).join('\n');

    // Guardar respuesta en el historial
    messages.push({ role: 'assistant', content: response.content });

    // Registrar decisión del cerebro
    if (actionsLog.length > 0) {
      await query(
        `INSERT INTO brain_decisions (decision_type, agents_involved, reasoning, actions_taken, confidence)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          'orchestration',
          [...new Set(actionsLog.map((a) => a.agent))],
          finalText.slice(0, 1000),
          JSON.stringify(actionsLog),
          null,
        ]
      );
    }

    return {
      response: finalText,
      actions: actionsLog,
      agents_used: [...new Set(actionsLog.map((a) => a.agent))],
    };
  }

  // Procesar evento automáticamente (sin input humano)
  async processEvent(event) {
    const eventPrompts = {
      'threat.detected': `ALERTA AUTOMÁTICA: Se detectó una amenaza.
        Tipo: ${event.payload?.type || 'desconocido'}
        IP: ${event.payload?.source_ip || 'N/A'}
        Severidad: ${event.payload?.severity || 'N/A'}

        Ejecuta el protocolo:
        1. Obtén inteligencia de amenazas para la IP
        2. Busca si hay leads/clientes registrados desde esa IP
        3. Si la IP es maliciosa y no es de un cliente, bloquéala
        4. Si es de un cliente, reporta la situación sin bloquear`,

      'lead.created': `NUEVO LEAD desde formulario de infoproducto.
        Email: ${event.payload?.email || 'N/A'}
        Producto: ${event.payload?.producto || 'N/A'}
        IP: ${event.payload?.ip_address || 'N/A'}
        Landing: ${event.payload?.landing_source || 'N/A'}

        Ejecuta el protocolo:
        1. Verifica la reputación de la IP con CIBER
        2. Si la IP es limpia, asigna un setter al lead
        3. Si la IP es sospechosa, marca el lead como posible fraude`,

      'sale.closed': `VENTA CERRADA.
        Monto: ${event.payload?.amount || 'N/A'}
        Closer: ${event.payload?.closer || 'N/A'}
        Producto: ${event.payload?.product || 'N/A'}

        Obtén el resumen actual de ventas y comisiones.`,
    };

    const prompt = eventPrompts[event.event_type];
    if (!prompt) return null;

    return this.process(prompt, `auto_${event.event_type}_${Date.now()}`);
  }

  clearSession(sessionId) {
    this.conversations.delete(sessionId);
  }
}

export const orchestrator = new Orchestrator();
