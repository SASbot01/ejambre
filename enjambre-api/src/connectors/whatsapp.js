// Conector: WhatsApp Business API (Meta Cloud API) → Enjambre Cerebro
// Recibe mensajes vía webhook y responde a través de la Graph API

import { orchestrator } from '../agents/orchestrator.js';
import { eventBus } from '../events/event-bus.js';

const WA_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID;
const WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN;
const WA_VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || 'enjambre-verify-2026';
const WA_ALLOWED_NUMBERS = (process.env.WA_ALLOWED_NUMBERS || '').split(',').filter(Boolean);
const WA_API_URL = 'https://graph.facebook.com/v21.0';

function getSessionId(phoneNumber) {
  return `whatsapp-${phoneNumber}`;
}

function isAllowedNumber(phone) {
  // Si no hay lista configurada, aceptar todos (cuidado en producción)
  if (WA_ALLOWED_NUMBERS.length === 0) return true;
  return WA_ALLOWED_NUMBERS.includes(phone);
}

// Enviar mensaje de texto vía WhatsApp
async function sendWhatsAppMessage(to, text) {
  const res = await fetch(`${WA_API_URL}/${WA_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WA_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: text },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[WhatsApp] Error enviando mensaje:`, err);
    return null;
  }

  return res.json();
}

// Marcar mensaje como leído
async function markAsRead(messageId) {
  await fetch(`${WA_API_URL}/${WA_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WA_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    }),
  });
}

// Procesar mensaje entrante
async function handleIncomingMessage(message, contact) {
  const from = message.from;
  const contactName = contact?.profile?.name || from;

  if (!isAllowedNumber(from)) {
    console.log(`[WhatsApp] Número no autorizado: ${from}`);
    await sendWhatsAppMessage(from, '⛔ No tienes acceso a Enjambre. Contacta al administrador.');
    return;
  }

  // Solo procesamos mensajes de texto por ahora
  if (message.type !== 'text') {
    await sendWhatsAppMessage(from, '📝 Por ahora solo proceso mensajes de texto. Envía tu consulta como texto.');
    return;
  }

  const userMessage = message.text.body.trim();
  if (!userMessage) return;

  // Marcar como leído
  await markAsRead(message.id);

  // Comandos especiales
  if (userMessage.toLowerCase() === 'reset') {
    orchestrator.clearSession(getSessionId(from));
    await sendWhatsAppMessage(from, '🔄 Sesión reiniciada.');
    return;
  }

  if (userMessage.toLowerCase() === 'status') {
    const status = await getSystemStatus();
    await sendWhatsAppMessage(from, status);
    return;
  }

  try {
    const sessionId = getSessionId(from);
    const result = await orchestrator.process(userMessage, sessionId);

    const response = result.response || result.error || 'Sin respuesta del Cerebro.';

    // WhatsApp tiene límite de ~4096 caracteres por mensaje
    if (response.length <= 4000) {
      await sendWhatsAppMessage(from, response);
    } else {
      const chunks = splitMessage(response, 4000);
      for (const chunk of chunks) {
        await sendWhatsAppMessage(from, chunk);
      }
    }

    // Log del evento
    eventBus.publish('chat.whatsapp', 'whatsapp', {
      user: contactName,
      phone: from,
      message_length: userMessage.length,
      agents_used: result.agents_used || [],
    });
  } catch (err) {
    console.error('[WhatsApp] Error procesando mensaje:', err.message);
    await sendWhatsAppMessage(from, '❌ Error procesando tu mensaje. Intenta de nuevo en unos segundos.');
  }
}

// Registrar rutas del webhook en Fastify
export function registerWhatsAppRoutes(app) {
  if (!WA_PHONE_NUMBER_ID || !WA_ACCESS_TOKEN) {
    console.log('[WhatsApp] Conector deshabilitado: WA_PHONE_NUMBER_ID o WA_ACCESS_TOKEN no configurados');
    return;
  }

  // Verificación del webhook (Meta envía GET para validar)
  app.get('/api/webhooks/whatsapp', async (req, reply) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === WA_VERIFY_TOKEN) {
      console.log('[WhatsApp] Webhook verificado');
      reply.code(200).send(challenge);
      return;
    }

    reply.code(403).send({ error: 'Verificación fallida' });
  });

  // Recepción de mensajes (Meta envía POST)
  app.post('/api/webhooks/whatsapp', async (req, reply) => {
    const body = req.body;

    // Responder 200 inmediatamente (Meta requiere respuesta rápida)
    reply.code(200).send({ status: 'ok' });

    // Procesar en background
    try {
      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (!value?.messages) return;

      for (const message of value.messages) {
        const contact = value.contacts?.find((c) => c.wa_id === message.from);
        // No await aquí para no bloquear - procesamiento asíncrono
        handleIncomingMessage(message, contact).catch((err) => {
          console.error('[WhatsApp] Error en handleIncomingMessage:', err.message);
        });
      }
    } catch (err) {
      console.error('[WhatsApp] Error procesando webhook:', err.message);
    }
  });

  console.log('[WhatsApp] Rutas de webhook registradas en /api/webhooks/whatsapp');
  eventBus.publish('connector.started', 'whatsapp', {
    phone_number_id: WA_PHONE_NUMBER_ID,
  });
}

// Enviar notificación proactiva por WhatsApp
export async function sendWhatsAppNotification(phoneNumber, message) {
  if (!WA_PHONE_NUMBER_ID || !WA_ACCESS_TOKEN) return;
  return sendWhatsAppMessage(phoneNumber, message);
}

async function getSystemStatus() {
  const lines = ['🐺 *Enjambre - Estado del Sistema*', `📅 ${new Date().toLocaleString('es-ES')}`, ''];

  try {
    const { query } = await import('../config/database.js');
    const agents = await query('SELECT * FROM agent_status');
    if (agents.length > 0) {
      lines.push('*Agentes:*');
      for (const a of agents) {
        const online = Date.now() - new Date(a.last_heartbeat).getTime() < 120_000;
        lines.push(`${online ? '🟢' : '🔴'} ${a.agent_name}`);
      }
    }

    const stats = await query(
      `SELECT COUNT(*) as total,
              COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as hoy
       FROM leads`
    );
    if (stats[0]) {
      lines.push('', `*Leads:* ${stats[0].total} total | ${stats[0].hoy} hoy`);
    }
  } catch {
    lines.push('⚠️ No se pudo obtener estado de la BD');
  }

  return lines.join('\n');
}

function splitMessage(text, maxLength) {
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    let cutIndex = remaining.lastIndexOf('\n', maxLength);
    if (cutIndex === -1 || cutIndex < maxLength / 2) {
      cutIndex = maxLength;
    }
    chunks.push(remaining.slice(0, cutIndex));
    remaining = remaining.slice(cutIndex);
  }
  return chunks;
}
