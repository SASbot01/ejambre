// ============================================
// Conector: WhatsApp Agent (whatsapp-web.js)
// ============================================

import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import { orchestrator } from '../agents/orchestrator.js';
import { eventBus } from '../events/event-bus.js';
import { supabase } from '../config/database.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const WA_ALLOWED_NUMBERS = (process.env.WA_ALLOWED_NUMBERS || '').split(',').map(s => s.trim()).filter(Boolean);
const WA_GROUP_ID = process.env.WA_GROUP_ID || '';
const WA_WHITELIST_GROUPS = (process.env.WA_WHITELIST_GROUPS || '').split(',').map(s => s.trim()).filter(Boolean);
const WA_BOT_PREFIX = process.env.WA_BOT_PREFIX || '!bw';
const WA_DEBOUNCE_MS = parseInt(process.env.WA_DEBOUNCE_MS, 10) || 10000;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let waClient = null;
let currentQR = null;
let isReady = false;
let sessionOwnerId = process.env.WA_DEFAULT_CLIENT_ID || null; // which clientId owns the current session
const conversations = new Map(); // chatId -> { messages[], lastActivity }
const MAX_HISTORY = 20;

// Debounce state
const debounceTimers = new Map();
const pendingMessages = new Map();

// Simple rate limiter
let apiCallTimestamps = [];
const RATE_LIMIT = 20; // per minute

async function waitForRateLimit() {
  const now = Date.now();
  apiCallTimestamps = apiCallTimestamps.filter(t => t > now - 60_000);
  if (apiCallTimestamps.length >= RATE_LIMIT) {
    const wait = apiCallTimestamps[0] + 60_000 - now;
    await new Promise(r => setTimeout(r, wait));
  }
  apiCallTimestamps.push(Date.now());
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomDelay() {
  const min = 60_000;  // 1 min
  const max = 300_000; // 5 min
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isAllowedNumber(phone) {
  if (WA_ALLOWED_NUMBERS.length === 0) return true;
  const clean = phone.replace(/\D/g, '');
  return WA_ALLOWED_NUMBERS.some(n => clean.includes(n) || n.includes(clean));
}

function isGroupAllowed(chatId) {
  if (chatId === WA_GROUP_ID) return true;
  if (WA_WHITELIST_GROUPS.length > 0 && WA_WHITELIST_GROUPS.includes(chatId)) return true;
  return false;
}

function getSessionId(chatId) {
  return `whatsapp-${chatId}`;
}

function addToHistory(chatId, role, content) {
  if (!conversations.has(chatId)) {
    conversations.set(chatId, { messages: [], lastActivity: Date.now() });
  }
  const conv = conversations.get(chatId);
  conv.messages.push({ role, content });
  conv.lastActivity = Date.now();
  if (conv.messages.length > MAX_HISTORY) {
    conv.messages = conv.messages.slice(-MAX_HISTORY);
  }
}

function getHistory(chatId) {
  return conversations.get(chatId)?.messages || [];
}

function splitMessage(text, maxLength = 4000) {
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    let cutIndex = remaining.lastIndexOf('\n', maxLength);
    if (cutIndex === -1 || cutIndex < maxLength / 2) cutIndex = maxLength;
    chunks.push(remaining.slice(0, cutIndex));
    remaining = remaining.slice(cutIndex);
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Setter config (from Supabase)
// ---------------------------------------------------------------------------
let setterConfigCache = null;
let setterConfigLastFetch = 0;

async function getSetterConfig() {
  if (!supabase || !sessionOwnerId) return { enabled: false, message: '' };
  // Cache for 30 seconds
  if (setterConfigCache && Date.now() - setterConfigLastFetch < 30000) return setterConfigCache;
  try {
    const { data } = await supabase
      .from('whatsapp_config')
      .select('setter_enabled, setter_message')
      .eq('client_id', sessionOwnerId)
      .limit(1)
      .single();
    setterConfigCache = { enabled: !!data?.setter_enabled, message: data?.setter_message || '' };
    setterConfigLastFetch = Date.now();
    return setterConfigCache;
  } catch {
    return { enabled: false, message: '' };
  }
}

// ---------------------------------------------------------------------------
// Persist messages to CRM (Supabase)
// ---------------------------------------------------------------------------
async function findCrmContact(phone) {
  if (!supabase || !sessionOwnerId) return null;
  const clean = phone.replace(/\D/g, '');
  // Search by phone or whatsapp field
  const { data } = await supabase
    .from('crm_contacts')
    .select('id, client_id, name, notes')
    .eq('client_id', sessionOwnerId)
    .or(`phone.ilike.%${clean}%,whatsapp.ilike.%${clean}%`)
    .limit(1);
  return data?.[0] || null;
}

async function saveCrmMessage(contactId, channel, direction, senderName, content) {
  if (!supabase || !sessionOwnerId) return;
  try {
    await supabase.from('crm_messages').insert({
      client_id: sessionOwnerId,
      contact_id: contactId,
      channel,
      direction,
      sender_name: senderName,
      content,
      status: 'sent',
    });
  } catch (err) {
    console.error('[WhatsApp] Error saving CRM message:', err.message);
  }
}

// Agent conversations cache: chatId -> conversationId
const agentConvCache = new Map();

async function getOrCreateAgentConversation(chatId, contactName, senderPhone) {
  if (!supabase || !sessionOwnerId) return null;
  if (agentConvCache.has(chatId)) return agentConvCache.get(chatId);
  try {
    // Look for existing conversation by title pattern
    const title = `WhatsApp: ${contactName || senderPhone}`;
    const { data: existing } = await supabase
      .from('agent_conversations')
      .select('id')
      .eq('client_id', sessionOwnerId)
      .eq('title', title)
      .limit(1);
    if (existing?.length > 0) {
      agentConvCache.set(chatId, existing[0].id);
      return existing[0].id;
    }
    // Create new conversation
    const { data: created } = await supabase
      .from('agent_conversations')
      .insert({
        client_id: sessionOwnerId,
        title,
        context: JSON.stringify({ channel: 'whatsapp', stage: 'new', phone: senderPhone, lastMessage: '' }),
      })
      .select('id')
      .single();
    if (created) {
      agentConvCache.set(chatId, created.id);
      return created.id;
    }
  } catch (err) {
    console.error('[WhatsApp] Error creating agent conversation:', err.message);
  }
  return null;
}

async function saveAgentMessage(conversationId, role, content) {
  if (!supabase || !sessionOwnerId || !conversationId) return;
  try {
    await supabase.from('agent_messages').insert({
      conversation_id: conversationId,
      client_id: sessionOwnerId,
      role,
      content,
    });
    // Update conversation timestamp and lastMessage
    await supabase.from('agent_conversations').update({
      updated_at: new Date().toISOString(),
      context: JSON.stringify({ channel: 'whatsapp', stage: 'contacted', lastMessage: content.slice(0, 100) }),
    }).eq('id', conversationId);
  } catch (err) {
    console.error('[WhatsApp] Error saving agent message:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Forward to central group
// ---------------------------------------------------------------------------
async function forwardToGroup(senderName, chatName, originalMessage, botReply) {
  if (!WA_GROUP_ID || !waClient || !isReady) return;
  const lines = [
    '\u2501'.repeat(18),
    `De: ${senderName}`,
    `Chat: ${chatName}`,
    '',
    `Mensaje: ${originalMessage}`,
    '',
    `Respuesta: ${botReply}`,
    '\u2501'.repeat(18),
  ];
  try {
    await waClient.sendMessage(WA_GROUP_ID, lines.join('\n'));
  } catch (err) {
    console.error('[WhatsApp] Error reenviando al grupo:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Process accumulated messages (after debounce)
// ---------------------------------------------------------------------------
async function processAccumulatedMessages(chatId, messages) {
  if (messages.length === 0) return;

  const last = messages[messages.length - 1];
  const combinedBody = messages.map(m => m.body).join('\n');

  // Add to conversation history
  addToHistory(chatId, 'user', combinedBody);

  // Always persist inbound message to CRM + agent conversations
  const crmContact = await findCrmContact(last.senderNumber).catch(() => null);
  if (crmContact) {
    saveCrmMessage(crmContact.id, 'whatsapp', 'inbound', last.senderName, combinedBody).catch(() => {});
  }
  const agentConvId = await getOrCreateAgentConversation(chatId, last.senderName, last.senderNumber).catch(() => null);
  if (agentConvId) {
    saveAgentMessage(agentConvId, 'user', combinedBody).catch(() => {});
  }

  console.log(`[WhatsApp] <- ${last.chatName} (${last.senderName}): ${combinedBody.slice(0, 80)}`);

  // Check if auto-setter is enabled
  const setterConfig = await getSetterConfig();
  if (!setterConfig.enabled && !last.isGroupCommand) {
    console.log(`[WhatsApp] Setter disabled — message saved but not auto-responding to ${last.chatName}`);
    return;
  }

  try {
    await waitForRateLimit();

    const sessionId = getSessionId(chatId);

    // Build prompt with setter instructions + CRM context
    let systemContext = '';
    if (setterConfig.message) {
      systemContext += `[Setter Instructions: ${setterConfig.message}]\n`;
    }
    if (crmContact) {
      systemContext += `[CRM Contact: ${crmContact.name || 'Unknown'}${crmContact.notes ? ', Notes: ' + crmContact.notes : ''}]\n`;
    }
    // Get recent conversation history for continuity
    const history = getHistory(chatId);
    if (history.length > 1) {
      const recentMsgs = history.slice(-10, -1).map(h => `${h.role === 'user' ? 'Contact' : 'Setter'}: ${h.content}`).join('\n');
      systemContext += `[Recent conversation:\n${recentMsgs}]\n`;
    }
    const prompt = systemContext ? systemContext + '\n' + combinedBody : combinedBody;

    const result = await orchestrator.process(prompt, sessionId);
    const response = result.response || 'Sin respuesta del Cerebro.';

    // Simulate human behavior (skip for bot group)
    if (!last.isGroupCommand) {
      const delay = randomDelay();
      const mins = (delay / 60_000).toFixed(1);
      console.log(`[WhatsApp] Setter waiting ${mins} min before replying to ${last.chatName}...`);
      await new Promise(r => setTimeout(r, delay));

      // Send seen + typing
      try {
        const chat = await waClient.getChatById(chatId);
        await chat.sendSeen();
        const typingTime = Math.floor(Math.random() * 3000) + 2000;
        await chat.sendStateTyping();
        await new Promise(r => setTimeout(r, typingTime));
        await chat.clearState();
      } catch {}
    }

    // Store bot reply in history
    addToHistory(chatId, 'assistant', response);

    // Send reply (split if too long)
    const chunks = splitMessage(response);
    for (const chunk of chunks) {
      await waClient.sendMessage(chatId, chunk);
    }
    console.log(`[WhatsApp] Setter -> ${last.chatName}: ${response.slice(0, 100)}...`);

    // Persist outbound message to CRM + agent conversations
    if (crmContact) {
      saveCrmMessage(crmContact.id, 'whatsapp', 'outbound', 'AI Setter', response).catch(() => {});
    }
    if (agentConvId) {
      saveAgentMessage(agentConvId, 'assistant', response).catch(() => {});
    }

    // Forward to group (async, skip if message came from group)
    if (!last.isGroupCommand) {
      forwardToGroup(last.senderName, last.chatName, combinedBody, response).catch(() => {});
    }

    // Publish event
    eventBus.publish('chat.whatsapp', 'whatsapp', {
      user: last.senderName,
      phone: last.senderNumber,
      message_length: combinedBody.length,
      agents_used: result.agents_used || [],
    });
  } catch (err) {
    console.error('[WhatsApp] Error procesando mensajes:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------
async function handleMessage(message) {
  try {
    // Ignore status broadcasts and empty messages
    if (message.from === 'status@broadcast') return;
    if (!message.body || message.body.trim() === '') return;
    if (message.fromMe) return;

    const chatId = message.from;
    const isGroup = chatId.endsWith('@g.us');
    const isBotGroup = chatId === WA_GROUP_ID;

    // Groups: only respond if whitelisted
    if (isGroup && !isGroupAllowed(chatId)) return;

    // Bot group: only respond to prefix command
    if (isBotGroup) {
      const body = message.body.trim().toLowerCase();
      if (!body.startsWith(WA_BOT_PREFIX.toLowerCase())) return;
    }

    const contact = await message.getContact();
    const chat = await message.getChat();
    const senderName = contact.pushname || contact.name || 'Desconocido';
    const senderNumber = contact.number || message.from;
    const chatName = chat.name || senderName;

    // Check allowed numbers (skip for group commands)
    if (!isGroup && !isAllowedNumber(senderNumber)) {
      console.log(`[WhatsApp] Numero no autorizado: ${senderNumber}`);
      return;
    }

    // Strip bot prefix
    let messageBody = message.body;
    if (isBotGroup && messageBody.trim().toLowerCase().startsWith(WA_BOT_PREFIX.toLowerCase())) {
      messageBody = messageBody.trim().slice(WA_BOT_PREFIX.length).trim();
      if (!messageBody) messageBody = 'Hola';
    }

    // Only process text messages
    if (message.type !== 'chat') {
      await waClient.sendMessage(chatId, 'Por ahora solo proceso mensajes de texto.');
      return;
    }

    console.log(`[WhatsApp] <- ${chatName} (${senderName}): ${messageBody.slice(0, 100)}`);

    // Special commands
    if (messageBody.toLowerCase() === 'reset') {
      conversations.delete(chatId);
      orchestrator.clearSession(getSessionId(chatId));
      await waClient.sendMessage(chatId, 'Sesion reiniciada.');
      return;
    }

    if (messageBody.toLowerCase() === 'status') {
      const status = await getSystemStatus();
      await waClient.sendMessage(chatId, status);
      return;
    }

    // Debounce: accumulate messages before processing
    if (!pendingMessages.has(chatId)) {
      pendingMessages.set(chatId, []);
    }
    pendingMessages.get(chatId).push({
      body: messageBody,
      senderName,
      senderNumber,
      chatName,
      isGroupCommand: isBotGroup,
    });

    // Clear existing timer
    if (debounceTimers.has(chatId)) {
      clearTimeout(debounceTimers.get(chatId));
    }

    // Set debounce timer
    debounceTimers.set(chatId, setTimeout(async () => {
      debounceTimers.delete(chatId);
      const msgs = pendingMessages.get(chatId) || [];
      pendingMessages.delete(chatId);
      await processAccumulatedMessages(chatId, msgs);
    }, WA_DEBOUNCE_MS));

  } catch (err) {
    console.error('[WhatsApp] Error en handler:', err.message);
  }
}

// ---------------------------------------------------------------------------
// System status
// ---------------------------------------------------------------------------
async function getSystemStatus() {
  const lines = ['*Enjambre - Estado del Sistema*', new Date().toLocaleString('es-ES'), ''];
  try {
    const { query } = await import('../config/database.js');
    const agents = await query('SELECT * FROM agent_status');
    if (agents.length > 0) {
      lines.push('*Agentes:*');
      for (const a of agents) {
        const online = Date.now() - new Date(a.last_heartbeat).getTime() < 120_000;
        lines.push(`${online ? 'ON' : 'OFF'} ${a.agent_name}`);
      }
    }
    const stats = await query(
      `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as hoy FROM leads`
    );
    if (stats[0]) {
      lines.push('', `*Leads:* ${stats[0].total} total | ${stats[0].hoy} hoy`);
    }
  } catch {
    lines.push('No se pudo obtener estado de la BD');
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Initialize client
// ---------------------------------------------------------------------------
function createWhatsAppClient() {
  const puppeteerOpts = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  };
  // Use system Chromium in Docker (set via env PUPPETEER_EXECUTABLE_PATH)
  const chromePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (chromePath) {
    puppeteerOpts.executablePath = chromePath;
  }

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '/app/.wwebjs_auth' }),
    puppeteer: puppeteerOpts,
  });

  client.on('qr', (qr) => {
    currentQR = qr;
    console.log('[WhatsApp] Escanea este codigo QR con WhatsApp:');
    qrcode.generate(qr, { small: true });
  });

  client.on('authenticated', () => {
    currentQR = null;
    console.log('[WhatsApp] Autenticado correctamente');
  });

  client.on('ready', async () => {
    isReady = true;
    currentQR = null;
    console.log('[WhatsApp] Cliente listo - escuchando mensajes');

    // Log available chats for finding group IDs
    try {
      const chats = await client.getChats();
      const groups = chats.filter(c => c.isGroup);
      if (groups.length > 0) {
        console.log('[WhatsApp] Grupos disponibles:');
        groups.forEach(g => console.log(`  [GRUPO] ${g.name} -> ${g.id._serialized}`));
      }
    } catch {}

    eventBus.publish('connector.started', 'whatsapp', { type: 'whatsapp-web' });
  });

  client.on('auth_failure', (msg) => {
    console.error('[WhatsApp] Fallo de autenticacion:', msg);
    isReady = false;
  });

  client.on('disconnected', (reason) => {
    console.warn('[WhatsApp] Desconectado:', reason);
    isReady = false;
    // Reconnect after 10 seconds
    setTimeout(() => {
      console.log('[WhatsApp] Reconectando...');
      client.initialize().catch(err => {
        console.error('[WhatsApp] Error reconectando:', err.message);
      });
    }, 10_000);
  });

  client.on('message', handleMessage);

  return client;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function registerWhatsAppRoutes(app) {
  // API endpoint: get QR code and status (per-client aware)
  app.get('/api/whatsapp/status', async (req) => {
    const requestedClientId = req.query.clientId;
    const isOwner = !requestedClientId || !sessionOwnerId || sessionOwnerId === requestedClientId;
    let qrImage = null;
    if (currentQR && isOwner) {
      try {
        qrImage = await QRCode.toDataURL(currentQR, { width: 280, margin: 2 });
      } catch {}
    }
    return {
      connected: isReady && isOwner,
      qr: isOwner ? (currentQR || null) : null,
      qrImage: isOwner ? qrImage : null,
      activeConversations: conversations.size,
      sessionOwner: sessionOwnerId || null,
    };
  });

  // API endpoint: send message manually (per-client aware)
  app.post('/api/whatsapp/send', async (req) => {
    if (!isReady || !waClient) return { error: 'WhatsApp no conectado' };
    const { to, message, clientId } = req.body;
    if (!to || !message) return { error: 'to y message son requeridos' };
    if (clientId && sessionOwnerId && clientId !== sessionOwnerId) {
      return { error: 'Sesion de WhatsApp pertenece a otro cliente' };
    }
    try {
      await waClient.sendMessage(to.includes('@') ? to : `${to}@c.us`, message);
      return { ok: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  // API endpoint: restart/reconnect (per-client aware)
  app.post('/api/whatsapp/restart', async (req) => {
    const { clientId } = req.body || {};
    try {
      if (waClient) {
        await waClient.destroy().catch(() => {});
      }
      if (clientId) sessionOwnerId = clientId;
      waClient = createWhatsAppClient();
      waClient.initialize().catch(err => {
        console.error('[WhatsApp] Error inicializando:', err.message);
      });
      return { ok: true, message: 'Reiniciando - escanea el codigo QR cuando aparezca', sessionOwner: sessionOwnerId };
    } catch (err) {
      return { error: err.message };
    }
  });

  // Initialize client
  console.log('[WhatsApp] Iniciando conector whatsapp-web.js...');
  waClient = createWhatsAppClient();
  waClient.initialize().catch(err => {
    console.error('[WhatsApp] Error inicializando:', err.message);
  });

  console.log('[WhatsApp] Rutas registradas: /api/whatsapp/status, /api/whatsapp/send, /api/whatsapp/restart');
}

export async function sendWhatsAppNotification(phoneNumber, message) {
  if (!isReady || !waClient) return;
  const chatId = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@c.us`;
  try {
    await waClient.sendMessage(chatId, message);
  } catch (err) {
    console.error('[WhatsApp] Error enviando notificacion:', err.message);
  }
}
