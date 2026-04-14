// Rutas de control del Agente de Discord.
// Proxea al sidecar FastAPI del bot Python (DISCORD_BOT_API_URL).
// Si el sidecar no está arrancado, responde stubs seguros para que la UI no rompa.
// Las credenciales se guardan localmente en el bot (data/credentials.json + .env),
// no en Postgres — el bot es la fuente de verdad.

const DISCORD_BOT_API_URL = process.env.DISCORD_BOT_API_URL || 'http://127.0.0.1:8788';

async function botFetch(path, { method = 'GET', body } = {}) {
  const url = `${DISCORD_BOT_API_URL}${path}`;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    const err = new Error(`bot[${method} ${path}] ${r.status}: ${text.slice(0, 200)}`);
    err.status = r.status;
    throw err;
  }
  return r.json();
}

async function botOrStub(path, stub) {
  try {
    return await botFetch(path);
  } catch (err) {
    console.warn(`[discord-agent] bot sidecar unreachable (${err.message}). Returning stub.`);
    return stub;
  }
}

export function registerDiscordAgentRoutes(app) {
  // ─── Status del bot ───
  app.get('/api/agents/discord/status', async () => {
    return botOrStub('/status', { running: false, reason: 'sidecar_unreachable' });
  });

  // ─── Listado de guilds ───
  app.get('/api/agents/discord/guilds', async () => {
    return botOrStub('/guilds', []);
  });

  // ─── Canales de un guild ───
  app.get('/api/agents/discord/guilds/:guildId/channels', async (req) => {
    const { guildId } = req.params;
    return botOrStub(`/guilds/${guildId}/channels`, []);
  });

  // ─── Config por guild ───
  // La fuente de verdad es el bot (config/communities/*.json). Aquí solo proxeamos.
  app.get('/api/agents/discord/config/:guildId', async (req) => {
    const { guildId } = req.params;
    return botOrStub(`/config/${guildId}`, {
      guild_id: guildId,
      channels: {},
      cooldown_seconds: 240,
      rate_limit_per_day: 200,
    });
  });

  app.put('/api/agents/discord/config/:guildId', async (req, reply) => {
    const { guildId } = req.params;
    try {
      return await botFetch(`/config/${guildId}`, { method: 'PUT', body: req.body });
    } catch (err) {
      reply.code(err.status || 502).send({ error: err.message });
    }
  });

  // ─── Métricas agregadas ───
  app.get('/api/agents/discord/metrics', async () => {
    return botOrStub('/metrics', {
      replies_24h: 0,
      tokens_24h: 0,
      learned_responses: 0,
    });
  });

  // ─── Trigger backfill histórico ───
  app.post('/api/agents/discord/backfill', async (req, reply) => {
    try {
      return await botFetch('/backfill/start', { method: 'POST', body: req.body });
    } catch (err) {
      reply.code(err.status || 502).send({ error: err.message });
    }
  });

  // ─── Embeddings (retrieval semántico) ───
  app.get('/api/agents/discord/embeddings/status', async () => {
    return botOrStub('/embeddings/status', {
      has_api_key: false, total: 0, embedded: 0, pending: 0,
    });
  });

  app.post('/api/agents/discord/embeddings/backfill', async (req, reply) => {
    try {
      return await botFetch('/embeddings/backfill', { method: 'POST', body: req.body });
    } catch (err) {
      reply.code(err.status || 502).send({ error: err.message });
    }
  });

  // ─── Credenciales del bot (token, etc.) ───
  // Proxea al sidecar. El bot almacena en data/credentials.json y actualiza .env.
  app.get('/api/agents/discord/credentials', async () => {
    return botOrStub('/credentials', {
      owner_discord_id: null,
      has_token: false,
      has_anthropic_key: false,
      updated_at: null,
    });
  });

  app.put('/api/agents/discord/credentials', async (req, reply) => {
    const { discord_token, anthropic_api_key, owner_discord_id } = req.body || {};
    if (!discord_token && !anthropic_api_key && !owner_discord_id) {
      reply.code(400).send({ error: 'al menos un campo requerido' });
      return;
    }
    try {
      return await botFetch('/credentials', { method: 'PUT', body: req.body });
    } catch (err) {
      reply.code(err.status || 502).send({ error: err.message });
    }
  });
}
