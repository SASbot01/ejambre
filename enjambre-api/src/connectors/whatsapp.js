// ============================================
// Conector: WhatsApp Agent (whatsapp-web.js)
// Multi-session: cada clientId tiene su propia sesión
// ============================================

import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import { orchestrator } from '../agents/orchestrator.js';
import { eventBus } from '../events/event-bus.js';
import { supabase } from '../config/database.js';
import { loadSetterDocs } from '../setter_docs/index.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const WA_GROUP_ID = process.env.WA_GROUP_ID || '';
const WA_WHITELIST_GROUPS = (process.env.WA_WHITELIST_GROUPS || '').split(',').map(s => s.trim()).filter(Boolean);
const WA_BOT_PREFIX = process.env.WA_BOT_PREFIX || '!bw';
const WA_DEBOUNCE_MS = parseInt(process.env.WA_DEBOUNCE_MS, 10) || 10000;
const WA_MAX_SESSIONS = parseInt(process.env.WA_MAX_SESSIONS, 10) || 5;
const WA_DEFAULT_CLIENT_ID = process.env.WA_DEFAULT_CLIENT_ID || null;
const WA_AUTH_BASE = '/app/.wwebjs_auth';
const MAX_HISTORY = 20;

// ---------------------------------------------------------------------------
// Multi-session state
// ---------------------------------------------------------------------------
// sessions: Map<clientId, { client, isReady, currentQR, conversations, debounceTimers, pendingMessages, agentConvCache, setterConfigCache, setterConfigLastFetch }>
const sessions = new Map();

// Rate limiter (shared)
let apiCallTimestamps = [];
const RATE_LIMIT = 20;

async function waitForRateLimit() {
  const now = Date.now();
  apiCallTimestamps = apiCallTimestamps.filter(t => t > now - 60_000);
  if (apiCallTimestamps.length >= RATE_LIMIT) {
    const wait = apiCallTimestamps[0] + 60_000 - now;
    await new Promise(r => setTimeout(r, wait));
  }
  apiCallTimestamps.push(Date.now());
}

function getSession(clientId) {
  return sessions.get(clientId) || null;
}

function createSessionState(clientId) {
  return {
    client: null,
    isReady: false,
    currentQR: null,
    conversations: new Map(),
    debounceTimers: new Map(),
    pendingMessages: new Map(),
    agentConvCache: new Map(),
    setterConfigCache: null,
    setterConfigLastFetch: 0,
    clientId,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function randomDelay() {
  const min = 60_000;
  const max = 300_000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function splitMessage(text, maxLength = 4000) {
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) { chunks.push(remaining); break; }
    let cutIndex = remaining.lastIndexOf('\n', maxLength);
    if (cutIndex === -1 || cutIndex < maxLength / 2) cutIndex = maxLength;
    chunks.push(remaining.slice(0, cutIndex));
    remaining = remaining.slice(cutIndex);
  }
  return chunks;
}

function addToHistory(session, chatId, role, content) {
  if (!session.conversations.has(chatId)) {
    session.conversations.set(chatId, { messages: [], lastActivity: Date.now() });
  }
  const conv = session.conversations.get(chatId);
  conv.messages.push({ role, content });
  conv.lastActivity = Date.now();
  if (conv.messages.length > MAX_HISTORY) conv.messages = conv.messages.slice(-MAX_HISTORY);
}

function getHistory(session, chatId) {
  return session.conversations.get(chatId)?.messages || [];
}

// ---------------------------------------------------------------------------
// Setter config (per-client, cached 30s)
// ---------------------------------------------------------------------------
async function getSetterConfig(session, { skipCache = false } = {}) {
  if (!supabase || !session.clientId) return { enabled: false, message: '', docs: '', pipelineId: null };
  if (!skipCache && session.setterConfigCache && Date.now() - session.setterConfigLastFetch < 30000) return session.setterConfigCache;
  try {
    const { data } = await supabase
      .from('whatsapp_config')
      .select('setter_enabled, setter_message, setter_docs, setter_pipeline_id')
      .eq('client_id', session.clientId)
      .limit(1)
      .single();
    session.setterConfigCache = {
      enabled: !!data?.setter_enabled,
      message: data?.setter_message || '',
      docs: data?.setter_docs || '',
      pipelineId: data?.setter_pipeline_id || null,
    };
    session.setterConfigLastFetch = Date.now();
    return session.setterConfigCache;
  } catch {
    return { enabled: false, message: '', docs: '', pipelineId: null };
  }
}

// ---------------------------------------------------------------------------
// Client context (per-client, cached 60s) — business info, community, general docs
// ---------------------------------------------------------------------------
const clientContextCache = new Map(); // key: clientId, value: { data, fetchedAt }

async function getClientContext(session) {
  if (!supabase || !session.clientId) return '';
  const cached = clientContextCache.get(session.clientId);
  if (cached && Date.now() - cached.fetchedAt < 60000) return cached.data;

  const parts = [];
  try {
    // 1. Client info from clients table
    try {
      const { data: clientInfo } = await supabase
        .from('clients')
        .select('name, client_type, website, enabled_features')
        .eq('id', session.clientId)
        .limit(1)
        .single();
      if (clientInfo) {
        const info = [`Negocio: ${clientInfo.name || 'N/A'}`];
        if (clientInfo.client_type) info.push(`Tipo: ${clientInfo.client_type}`);
        if (clientInfo.website) info.push(`Web: ${clientInfo.website}`);
        parts.push(info.join(' | '));
      }
    } catch {}

    // 2. Community channels + recent messages (max 3 channels, 5 msgs each, total max 500 chars)
    try {
      const { data: channels } = await supabase
        .from('comunidad_channels')
        .select('id, name')
        .eq('client_id', session.clientId)
        .limit(3);
      if (channels?.length > 0) {
        const channelTexts = [];
        for (const ch of channels) {
          const { data: msgs } = await supabase
            .from('comunidad_messages')
            .select('content, author_name')
            .eq('channel_id', ch.id)
            .order('created_at', { ascending: false })
            .limit(5);
          if (msgs?.length > 0) {
            const msgSummary = msgs.map(m => `${m.author_name || '?'}: ${(m.content || '').slice(0, 60)}`).join('; ');
            channelTexts.push(`#${ch.name}: ${msgSummary}`);
          }
        }
        if (channelTexts.length > 0) {
          const communityText = channelTexts.join('\n').slice(0, 500);
          parts.push(`Comunidad reciente:\n${communityText}`);
        }
      }
    } catch {}

    // 3. General client documents (crm_files where contact_id is null), categorized
    try {
      const { data: generalDocs } = await supabase
        .from('crm_files')
        .select('file_name, file_url, file_type')
        .eq('client_id', session.clientId)
        .is('contact_id', null)
        .limit(10);
      if (generalDocs?.length > 0) {
        const categorized = { strategy: [], setter_memory: [], documentation: [] };
        for (const doc of generalDocs) {
          const nameLower = (doc.file_name || '').toLowerCase();
          if (nameLower.includes('estrategia')) categorized.strategy.push(doc);
          else if (nameLower.includes('setter')) categorized.setter_memory.push(doc);
          else categorized.documentation.push(doc);
        }
        const docTexts = [];
        // Extract content from top docs (max 3 total to limit tokens)
        const topDocs = [
          ...categorized.strategy.slice(0, 1).map(d => ({ ...d, cat: 'Estrategia' })),
          ...categorized.setter_memory.slice(0, 1).map(d => ({ ...d, cat: 'Memoria setter' })),
          ...categorized.documentation.slice(0, 1).map(d => ({ ...d, cat: 'Documentación' })),
        ];
        for (const doc of topDocs) {
          if (!doc.file_url) { docTexts.push(`[${doc.cat}: ${doc.file_name}]`); continue; }
          try {
            if (doc.file_type === 'application/pdf' || doc.file_name?.endsWith('.pdf')) {
              const res = await fetch(doc.file_url);
              const buffer = await res.arrayBuffer();
              const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
              const pdf = await pdfParse(Buffer.from(buffer));
              docTexts.push(`[${doc.cat}: ${doc.file_name}]: ${pdf.text.slice(0, 600)}`);
            } else if (/\.(txt|md|csv)$/i.test(doc.file_name || '')) {
              const res = await fetch(doc.file_url);
              const text = await res.text();
              docTexts.push(`[${doc.cat}: ${doc.file_name}]: ${text.slice(0, 600)}`);
            } else {
              docTexts.push(`[${doc.cat}: ${doc.file_name}]`);
            }
          } catch { docTexts.push(`[${doc.cat}: ${doc.file_name}]`); }
        }
        if (docTexts.length > 0) {
          parts.push(`Documentos generales del negocio:\n${docTexts.join('\n').slice(0, 2000)}`);
        }
      }
    } catch {}
  } catch (err) {
    console.error(`[WA:${session.clientId?.slice(0,8)}] Error fetching client context:`, err.message);
  }

  const result = parts.join('\n\n');
  clientContextCache.set(session.clientId, { data: result, fetchedAt: Date.now() });
  return result;
}

// ---------------------------------------------------------------------------
// CRM persistence (Supabase)
// ---------------------------------------------------------------------------
async function findCrmContact(clientId, phone) {
  if (!supabase || !clientId) return null;
  const clean = phone.replace(/\D/g, '');
  const { data } = await supabase
    .from('crm_contacts')
    .select('id, client_id, name, notes, email, phone, company, position, status, tags, custom_fields, producto_interes, capital_disponible, situacion_actual, exp_amazon, instagram, whatsapp, website, linkedin, pipeline_id')
    .eq('client_id', clientId)
    .or(`phone.ilike.%${clean}%,whatsapp.ilike.%${clean}%`)
    .limit(1);
  const contact = data?.[0] || null;
  if (contact) {
    // Fetch contact files
    try {
      const { data: files } = await supabase
        .from('crm_files')
        .select('file_name, file_url, file_type')
        .eq('contact_id', contact.id)
        .limit(10);
      contact.files = files || [];
    } catch { contact.files = []; }

    // Fetch last 10 CRM messages for conversation history context
    try {
      const { data: crmMessages } = await supabase
        .from('crm_messages')
        .select('direction, sender_name, content, created_at')
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: false })
        .limit(10);
      contact.conversationHistory = crmMessages || [];
    } catch { contact.conversationHistory = []; }
  }
  return contact;
}

async function saveCrmMessage(clientId, contactId, channel, direction, senderName, content) {
  if (!supabase || !clientId) return;
  try {
    await supabase.from('crm_messages').insert({
      client_id: clientId, contact_id: contactId, channel, direction,
      sender_name: senderName, content, status: 'sent',
    });
  } catch (err) {
    console.error('[WA] Error saving CRM message:', err.message);
  }
}

async function getOrCreateAgentConversation(session, chatId, contactName, senderPhone) {
  if (!supabase || !session.clientId) return null;
  if (session.agentConvCache.has(chatId)) return session.agentConvCache.get(chatId);
  try {
    const title = `WhatsApp: ${contactName || senderPhone}`;
    const { data: existing } = await supabase
      .from('agent_conversations').select('id')
      .eq('client_id', session.clientId).eq('title', title).limit(1);
    if (existing?.length > 0) {
      session.agentConvCache.set(chatId, existing[0].id);
      return existing[0].id;
    }
    const { data: created } = await supabase
      .from('agent_conversations')
      .insert({ client_id: session.clientId, title, context: JSON.stringify({ channel: 'whatsapp', stage: 'new', phone: senderPhone }) })
      .select('id').single();
    if (created) { session.agentConvCache.set(chatId, created.id); return created.id; }
  } catch (err) { console.error('[WA] Error agent conv:', err.message); }
  return null;
}

async function saveAgentMessage(clientId, conversationId, role, content) {
  if (!supabase || !clientId || !conversationId) return;
  try {
    await supabase.from('agent_messages').insert({ conversation_id: conversationId, client_id: clientId, role, content });
    await supabase.from('agent_conversations').update({
      updated_at: new Date().toISOString(),
      context: JSON.stringify({ channel: 'whatsapp', stage: 'contacted', lastMessage: content.slice(0, 100) }),
    }).eq('id', conversationId);
  } catch (err) { console.error('[WA] Error agent msg:', err.message); }
}

// ---------------------------------------------------------------------------
// File content extraction for AI context
// ---------------------------------------------------------------------------
async function extractFileContext(files) {
  if (!files || files.length === 0) return '';
  const texts = [];
  for (const f of files.slice(0, 3)) {
    if (!f.file_url) continue;
    try {
      if (f.file_type === 'application/pdf' || f.file_name?.endsWith('.pdf')) {
        const res = await fetch(f.file_url);
        const buffer = await res.arrayBuffer();
        const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
        const pdf = await pdfParse(Buffer.from(buffer));
        texts.push(`[${f.file_name}]: ${pdf.text.slice(0, 1500)}`);
      } else if (/\.(txt|md|csv)$/i.test(f.file_name || '')) {
        const res = await fetch(f.file_url);
        const text = await res.text();
        texts.push(`[${f.file_name}]: ${text.slice(0, 1500)}`);
      } else {
        texts.push(`[${f.file_name}]`);
      }
    } catch { texts.push(`[${f.file_name}]`); }
  }
  return texts.join('\n');
}

// ---------------------------------------------------------------------------
// Forward to central group
// ---------------------------------------------------------------------------
async function forwardToGroup(session, senderName, chatName, originalMessage, botReply) {
  if (!WA_GROUP_ID || !session.client || !session.isReady) return;
  try {
    await session.client.sendMessage(WA_GROUP_ID, [
      '━'.repeat(18), `De: ${senderName}`, `Chat: ${chatName}`, '',
      `Mensaje: ${originalMessage}`, '', `Respuesta: ${botReply}`, '━'.repeat(18),
    ].join('\n'));
  } catch {}
}

// ---------------------------------------------------------------------------
// Process accumulated messages
// ---------------------------------------------------------------------------
async function processAccumulatedMessages(session, chatId, messages) {
  if (messages.length === 0) return;
  const last = messages[messages.length - 1];
  const combinedBody = messages.map(m => m.body).join('\n');
  const clientId = session.clientId;

  addToHistory(session, chatId, 'user', combinedBody);

  // Persist inbound
  const crmContact = await findCrmContact(clientId, last.senderNumber).catch(() => null);
  if (crmContact) saveCrmMessage(clientId, crmContact.id, 'whatsapp', 'inbound', last.senderName, combinedBody).catch(() => {});
  const agentConvId = await getOrCreateAgentConversation(session, chatId, last.senderName, last.senderNumber).catch(() => null);
  if (agentConvId) saveAgentMessage(clientId, agentConvId, 'user', combinedBody).catch(() => {});

  console.log(`[WA:${clientId?.slice(0,8)}] <- ${last.chatName}: ${combinedBody.slice(0, 80)}`);

  // Check setter config
  const setterConfig = await getSetterConfig(session);
  if (!setterConfig.enabled && !last.isGroupCommand) {
    console.log(`[WA:${clientId?.slice(0,8)}] Setter off — saved only`);
    return;
  }

  // Pipeline filter: only respond to contacts in the selected pipeline
  if (setterConfig.pipelineId && !last.isGroupCommand) {
    if (!crmContact) {
      console.log(`[WA:${clientId?.slice(0,8)}] Contact not in CRM — skipped (pipeline filter active)`);
      return;
    }
    if (crmContact.pipeline_id !== setterConfig.pipelineId) {
      console.log(`[WA:${clientId?.slice(0,8)}] Contact pipeline ${crmContact.pipeline_id} != setter pipeline ${setterConfig.pipelineId} — skipped`);
      return;
    }
  }

  try {
    await waitForRateLimit();
    const sessionId = `wa-${clientId?.slice(0,8)}-${chatId}`;

    // System prompt estático (cacheable): instrucciones + docs + contacto
    // Los archivos del contacto se cachean por sesión para no re-extraerlos cada mensaje
    if (!session.fileCtxCache) session.fileCtxCache = new Map();
    let fileCtx = '';
    if (crmContact?.files?.length > 0) {
      const cacheKey = `${crmContact.id}`;
      if (session.fileCtxCache.has(cacheKey)) {
        fileCtx = session.fileCtxCache.get(cacheKey);
      } else {
        fileCtx = await extractFileContext(crmContact.files);
        session.fileCtxCache.set(cacheKey, fileCtx);
      }
    }

    // Fetch client-level context (cached 60s)
    const clientCtx = await getClientContext(session);

    const systemParts = [
      'Eres un setter de ventas profesional. Respondes en español, con tono cercano y conciso. No inventes datos.',
    ];
    if (setterConfig.message) systemParts.push(`Instrucciones:\n${setterConfig.message}`);
    // Local setter docs (process, products, objections, post-sale)
    const localDocs = loadSetterDocs();
    if (localDocs) systemParts.push(`Documentación del negocio:\n${localDocs}`);
    if (setterConfig.docs) systemParts.push(`Conocimiento adicional:\n${setterConfig.docs.slice(0, 4000)}`);

    // Client-level context (business info, community, general docs)
    if (clientCtx) systemParts.push(clientCtx);

    // Full contact profile
    if (crmContact) {
      const profileParts = [`Nombre: ${crmContact.name || 'Desconocido'}`];
      if (crmContact.email) profileParts.push(`Email: ${crmContact.email}`);
      if (crmContact.company) profileParts.push(`Empresa: ${crmContact.company}`);
      if (crmContact.position) profileParts.push(`Cargo: ${crmContact.position}`);
      if (crmContact.status) profileParts.push(`Estado: ${crmContact.status}`);
      if (crmContact.producto_interes) profileParts.push(`Producto interés: ${crmContact.producto_interes}`);
      if (crmContact.capital_disponible) profileParts.push(`Capital disponible: ${crmContact.capital_disponible}`);
      if (crmContact.situacion_actual) profileParts.push(`Situación actual: ${crmContact.situacion_actual}`);
      if (crmContact.exp_amazon) profileParts.push(`Exp Amazon: ${crmContact.exp_amazon}`);
      if (crmContact.instagram) profileParts.push(`Instagram: ${crmContact.instagram}`);
      if (crmContact.website) profileParts.push(`Web: ${crmContact.website}`);
      if (crmContact.linkedin) profileParts.push(`LinkedIn: ${crmContact.linkedin}`);
      if (crmContact.tags) profileParts.push(`Tags: ${Array.isArray(crmContact.tags) ? crmContact.tags.join(', ') : crmContact.tags}`);
      if (crmContact.notes) profileParts.push(`Notas: ${crmContact.notes}`);
      if (crmContact.custom_fields && typeof crmContact.custom_fields === 'object') {
        const cfEntries = Object.entries(crmContact.custom_fields).filter(([, v]) => v);
        if (cfEntries.length > 0) profileParts.push(`Campos extra: ${cfEntries.map(([k, v]) => `${k}=${v}`).join(', ')}`);
      }
      systemParts.push(`Perfil del contacto:\n${profileParts.join('\n')}`);

      // CRM conversation history (last messages, max 1500 chars)
      if (crmContact.conversationHistory?.length > 0) {
        const histLines = crmContact.conversationHistory
          .reverse()
          .map(m => {
            const dir = m.direction === 'inbound' ? '←' : '→';
            return `${dir} ${m.sender_name || '?'}: ${(m.content || '').slice(0, 150)}`;
          });
        const histText = histLines.join('\n').slice(0, 1500);
        systemParts.push(`Historial de conversación CRM:\n${histText}`);
      }
    }
    if (fileCtx) systemParts.push(`Documentos del contacto:\n${fileCtx}`);
    const staticSystem = systemParts.join('\n\n');

    // Solo el mensaje nuevo va en el user turn — el historial lo gestiona el orchestrator
    const result = await orchestrator.setterReply(staticSystem, combinedBody, sessionId);
    const response = result.response || 'Sin respuesta.';

    // Human-like delay
    if (!last.isGroupCommand) {
      const delay = randomDelay();
      console.log(`[WA:${clientId?.slice(0,8)}] Waiting ${(delay/60000).toFixed(1)}m...`);
      await new Promise(r => setTimeout(r, delay));

      // Re-check setter config after delay — if disabled while waiting, abort
      const freshConfig = await getSetterConfig(session, { skipCache: true });
      if (!freshConfig.enabled) {
        console.log(`[WA:${clientId?.slice(0,8)}] Setter disabled during delay — message NOT sent`);
        return;
      }

      try {
        const chat = await session.client.getChatById(chatId);
        await chat.sendSeen();
        await chat.sendStateTyping();
        await new Promise(r => setTimeout(r, Math.random() * 3000 + 2000));
        await chat.clearState();
      } catch {}
    }

    addToHistory(session, chatId, 'assistant', response);
    for (const chunk of splitMessage(response)) await session.client.sendMessage(chatId, chunk);
    console.log(`[WA:${clientId?.slice(0,8)}] -> ${last.chatName}: ${response.slice(0, 80)}...`);

    // Persist outbound
    if (crmContact) saveCrmMessage(clientId, crmContact.id, 'whatsapp', 'outbound', 'AI Setter', response).catch(() => {});
    if (agentConvId) saveAgentMessage(clientId, agentConvId, 'assistant', response).catch(() => {});
    if (!last.isGroupCommand) forwardToGroup(session, last.senderName, last.chatName, combinedBody, response).catch(() => {});

    eventBus.publish('chat.whatsapp', 'whatsapp', { user: last.senderName, phone: last.senderNumber, clientId });
  } catch (err) {
    console.error(`[WA:${clientId?.slice(0,8)}] Error:`, err.message);
  }
}

// ---------------------------------------------------------------------------
// Message handler (per-session)
// ---------------------------------------------------------------------------
function createMessageHandler(session) {
  return async function handleMessage(message) {
    try {
      if (message.from === 'status@broadcast') return;
      if (!message.body || message.body.trim() === '') return;
      if (message.fromMe) return;

      const chatId = message.from;
      const isGroup = chatId.endsWith('@g.us');
      const isBotGroup = chatId === WA_GROUP_ID;

      if (isGroup && !isBotGroup && !WA_WHITELIST_GROUPS.includes(chatId)) return;
      if (isBotGroup) {
        if (!message.body.trim().toLowerCase().startsWith(WA_BOT_PREFIX.toLowerCase())) return;
      }

      const contact = await message.getContact();
      const chat = await message.getChat();
      const senderName = contact.pushname || contact.name || 'Desconocido';
      const senderNumber = contact.number || message.from;
      const chatName = chat.name || senderName;

      let messageBody = message.body;
      if (isBotGroup && messageBody.trim().toLowerCase().startsWith(WA_BOT_PREFIX.toLowerCase())) {
        messageBody = messageBody.trim().slice(WA_BOT_PREFIX.length).trim() || 'Hola';
      }

      if (message.type !== 'chat') return;

      // Special commands
      if (messageBody.toLowerCase() === 'reset') {
        session.conversations.delete(chatId);
        orchestrator.clearSession(`wa-${session.clientId?.slice(0,8)}-${chatId}`);
        await session.client.sendMessage(chatId, 'Sesion reiniciada.');
        return;
      }

      // Debounce
      if (!session.pendingMessages.has(chatId)) session.pendingMessages.set(chatId, []);
      session.pendingMessages.get(chatId).push({ body: messageBody, senderName, senderNumber, chatName, isGroupCommand: isBotGroup });

      if (session.debounceTimers.has(chatId)) clearTimeout(session.debounceTimers.get(chatId));
      session.debounceTimers.set(chatId, setTimeout(async () => {
        session.debounceTimers.delete(chatId);
        const msgs = session.pendingMessages.get(chatId) || [];
        session.pendingMessages.delete(chatId);
        await processAccumulatedMessages(session, chatId, msgs);
      }, WA_DEBOUNCE_MS));
    } catch (err) {
      console.error(`[WA:${session.clientId?.slice(0,8)}] Handler error:`, err.message);
    }
  };
}

// ---------------------------------------------------------------------------
// Create WhatsApp client for a specific clientId
// ---------------------------------------------------------------------------
function createClientForSession(session) {
  const clientId = session.clientId;
  const authPath = clientId ? `${WA_AUTH_BASE}/${clientId}` : WA_AUTH_BASE;

  const puppeteerOpts = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  };
  const chromePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (chromePath) puppeteerOpts.executablePath = chromePath;

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: authPath, clientId: clientId || 'default' }),
    puppeteer: puppeteerOpts,
  });

  client.on('qr', (qr) => {
    session.currentQR = qr;
    console.log(`[WA:${clientId?.slice(0,8)}] QR generated — scan to connect`);
    qrcode.generate(qr, { small: true });
  });

  client.on('authenticated', () => {
    session.currentQR = null;
    console.log(`[WA:${clientId?.slice(0,8)}] Authenticated`);
  });

  client.on('ready', async () => {
    session.isReady = true;
    session.currentQR = null;
    console.log(`[WA:${clientId?.slice(0,8)}] Ready — listening for messages`);
    // Update whatsapp_config.connected = true
    if (supabase && clientId) {
      try {
        const { data: existing } = await supabase.from('whatsapp_config').select('id').eq('client_id', clientId).limit(1);
        if (existing?.length > 0) {
          await supabase.from('whatsapp_config').update({ connected: true, updated_at: new Date().toISOString() }).eq('client_id', clientId);
        } else {
          await supabase.from('whatsapp_config').insert({ client_id: clientId, connected: true });
        }
      } catch {}
    }
    eventBus.publish('connector.started', 'whatsapp', { clientId });
  });

  client.on('auth_failure', () => { session.isReady = false; });

  client.on('disconnected', (reason) => {
    console.warn(`[WA:${clientId?.slice(0,8)}] Disconnected: ${reason}`);
    session.isReady = false;
    // Update connected = false
    if (supabase && clientId) {
      supabase.from('whatsapp_config').update({ connected: false }).eq('client_id', clientId).catch(() => {});
    }
    // Reconnect
    setTimeout(() => {
      console.log(`[WA:${clientId?.slice(0,8)}] Reconnecting...`);
      client.initialize().catch(err => console.error(`[WA:${clientId?.slice(0,8)}] Reconnect error:`, err.message));
    }, 10_000);
  });

  client.on('message', createMessageHandler(session));
  session.client = client;
  return client;
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------
function startSession(clientId) {
  if (sessions.has(clientId)) {
    const existing = sessions.get(clientId);
    if (existing.isReady) return existing;
    // Destroy stale session
    existing.client?.destroy().catch(() => {});
  }
  if (sessions.size >= WA_MAX_SESSIONS) {
    // Evict oldest inactive session
    let oldest = null;
    let oldestTime = Infinity;
    for (const [id, s] of sessions) {
      const lastAct = Math.max(...[...s.conversations.values()].map(c => c.lastActivity || 0), 0);
      if (lastAct < oldestTime && id !== clientId) { oldest = id; oldestTime = lastAct; }
    }
    if (oldest) {
      console.log(`[WA] Evicting session ${oldest.slice(0,8)} (max ${WA_MAX_SESSIONS} reached)`);
      const s = sessions.get(oldest);
      s.client?.destroy().catch(() => {});
      sessions.delete(oldest);
    }
  }

  const session = createSessionState(clientId);
  sessions.set(clientId, session);
  createClientForSession(session);
  session.client.initialize().catch(err => console.error(`[WA:${clientId?.slice(0,8)}] Init error:`, err.message));
  return session;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function registerWhatsAppRoutes(app) {

  // Status
  app.get('/api/whatsapp/status', async (req) => {
    const clientId = req.query.clientId;
    if (!clientId) {
      // Return summary of all sessions
      const all = [];
      for (const [id, s] of sessions) {
        all.push({ clientId: id, connected: s.isReady, activeConversations: s.conversations.size });
      }
      return { sessions: all, totalSessions: sessions.size, maxSessions: WA_MAX_SESSIONS };
    }
    const session = getSession(clientId);
    if (!session) return { connected: false, qr: null, qrImage: null, activeConversations: 0, sessionOwner: null };
    let qrImage = null;
    if (session.currentQR) {
      try { qrImage = await QRCode.toDataURL(session.currentQR, { width: 280, margin: 2 }); } catch {}
    }
    return {
      connected: session.isReady,
      qr: session.currentQR || null,
      qrImage,
      activeConversations: session.conversations.size,
      sessionOwner: clientId,
    };
  });

  // Send message
  app.post('/api/whatsapp/send', async (req) => {
    const { to, message, clientId } = req.body;
    if (!to || !message) return { error: 'to y message son requeridos' };
    if (!clientId) return { error: 'clientId es requerido' };
    const session = getSession(clientId);
    if (!session?.isReady) return { error: 'WhatsApp no conectado para este cliente' };
    try {
      await session.client.sendMessage(to.includes('@') ? to : `${to}@c.us`, message);
      return { ok: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  // Restart / connect session
  app.post('/api/whatsapp/restart', async (req) => {
    const { clientId } = req.body || {};
    if (!clientId) return { error: 'clientId es requerido' };
    try {
      const existing = getSession(clientId);
      if (existing?.client) await existing.client.destroy().catch(() => {});
      sessions.delete(clientId);
      startSession(clientId);
      return { ok: true, message: 'Session starting — scan QR when ready', sessionOwner: clientId };
    } catch (err) {
      return { error: err.message };
    }
  });

  // List sessions
  app.get('/api/whatsapp/sessions', async () => {
    const list = [];
    for (const [id, s] of sessions) {
      list.push({ clientId: id, connected: s.isReady, conversations: s.conversations.size });
    }
    return { sessions: list, max: WA_MAX_SESSIONS };
  });

  // Boot default session if configured
  if (WA_DEFAULT_CLIENT_ID) {
    console.log(`[WA] Starting default session for ${WA_DEFAULT_CLIENT_ID.slice(0,8)}...`);
    startSession(WA_DEFAULT_CLIENT_ID);
  }

  console.log(`[WA] Multi-session enabled (max ${WA_MAX_SESSIONS}). Routes: /api/whatsapp/status, /send, /restart, /sessions`);
}

export async function sendWhatsAppNotification(phoneNumber, message, clientId) {
  const cid = clientId || WA_DEFAULT_CLIENT_ID;
  if (!cid) return;
  const session = getSession(cid);
  if (!session?.isReady) return;
  const chatId = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@c.us`;
  try { await session.client.sendMessage(chatId, message); } catch {}
}
