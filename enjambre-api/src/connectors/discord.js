// Conector: Discord → Enjambre Cerebro
// Bot que recibe mensajes en Discord y los reenvía al orquestador

import { orchestrator } from '../agents/orchestrator.js';
import { eventBus } from '../events/event-bus.js';

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_IDS = (process.env.DISCORD_CHANNEL_IDS || '').split(',').filter(Boolean);
const DISCORD_ADMIN_ROLE = process.env.DISCORD_ADMIN_ROLE || 'enjambre-admin';

let client = null;

// Mapa de sesiones por usuario de Discord
const sessions = new Map();

function getSessionId(userId) {
  return `discord-${userId}`;
}

export async function startDiscordConnector() {
  if (!DISCORD_TOKEN) {
    console.log('[Discord] Conector deshabilitado: DISCORD_BOT_TOKEN no configurado');
    return;
  }

  // Importación dinámica para no fallar si discord.js no está instalado
  let Discord;
  try {
    Discord = await import('discord.js');
  } catch {
    console.log('[Discord] discord.js no instalado. Ejecuta: npm install discord.js');
    return;
  }

  const { Client, GatewayIntentBits, Events } = Discord;

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
  });

  client.once(Events.ClientReady, (c) => {
    console.log(`[Discord] Bot conectado como ${c.user.tag}`);
    eventBus.publish('connector.started', 'discord', {
      bot_user: c.user.tag,
      channels: DISCORD_CHANNEL_IDS,
    });
  });

  client.on(Events.MessageCreate, async (message) => {
    // Ignorar mensajes propios
    if (message.author.bot) return;

    // Verificar si el mensaje es en un canal autorizado o DM
    const isDM = !message.guild;
    const isAllowedChannel =
      DISCORD_CHANNEL_IDS.length === 0 || DISCORD_CHANNEL_IDS.includes(message.channel.id);

    if (!isDM && !isAllowedChannel) return;

    // Servidor privado - sin restricción de roles

    const userMessage = message.content.trim();
    if (!userMessage) return;

    // Comandos especiales
    if (userMessage === '!reset') {
      orchestrator.clearSession(getSessionId(message.author.id));
      await message.reply('🔄 Sesión reiniciada.');
      return;
    }

    if (userMessage === '!status') {
      const status = await getSystemStatus();
      await message.reply(status);
      return;
    }

    // Indicar que estamos procesando
    await message.channel.sendTyping();

    try {
      const sessionId = getSessionId(message.author.id);
      const result = await orchestrator.process(userMessage, sessionId);

      const response = result.response || result.error || 'Sin respuesta del Cerebro.';

      // Discord tiene límite de 2000 caracteres
      if (response.length <= 2000) {
        await message.reply(response);
      } else {
        // Partir en chunks
        const chunks = splitMessage(response, 2000);
        for (const chunk of chunks) {
          await message.reply(chunk);
        }
      }

      // Log del evento
      eventBus.publish('chat.discord', 'discord', {
        user: message.author.username,
        user_id: message.author.id,
        channel: message.channel.name || 'DM',
        message_length: userMessage.length,
        agents_used: result.agents_used || [],
      });
    } catch (err) {
      console.error('[Discord] Error procesando mensaje:', err.message);
      await message.reply('❌ Error procesando tu mensaje. Intenta de nuevo.');
    }
  });

  try {
    await client.login(DISCORD_TOKEN);
    console.log('[Discord] Conector iniciado');
  } catch (err) {
    console.error(`[Discord] Error al conectar: ${err.message}`);
    console.error('[Discord] Verifica que los Privileged Gateway Intents estén activados en el Developer Portal');
    client = null;
  }
}

export function stopDiscordConnector() {
  if (client) {
    client.destroy();
    client = null;
    console.log('[Discord] Conector detenido');
  }
}

// Enviar notificación proactiva a un canal de Discord
export async function sendDiscordNotification(channelId, message) {
  if (!client) return;
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel) {
      await channel.send(message);
    }
  } catch (err) {
    console.error('[Discord] Error enviando notificación:', err.message);
  }
}

async function getSystemStatus() {
  const lines = [
    '**🐺 Enjambre - Estado del Sistema**',
    `📅 ${new Date().toLocaleString('es-ES')}`,
    '',
  ];

  try {
    const { query } = await import('../config/database.js');
    const agents = await query('SELECT * FROM agent_status');
    if (agents.length > 0) {
      lines.push('**Agentes:**');
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
      lines.push('', `**Leads:** ${stats[0].total} total | ${stats[0].hoy} hoy`);
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
    // Intentar cortar en un salto de línea
    let cutIndex = remaining.lastIndexOf('\n', maxLength);
    if (cutIndex === -1 || cutIndex < maxLength / 2) {
      cutIndex = maxLength;
    }
    chunks.push(remaining.slice(0, cutIndex));
    remaining = remaining.slice(cutIndex);
  }
  return chunks;
}
