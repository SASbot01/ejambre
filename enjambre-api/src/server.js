import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fastifyRateLimit from 'fastify-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { eventBus } from './events/event-bus.js';
import { db } from './config/database.js';
import { registerRoutes } from './routes/index.js';
import { authHook } from './auth/auth.js';
import { startDCCConnector, stopDCCConnector } from './connectors/detrasdecamara.js';
import { startDiscordConnector, stopDiscordConnector } from './connectors/discord.js';
import { registerWhatsAppRoutes } from './connectors/whatsapp.js';
import { query, queryOne } from './config/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// Rate limiting
await app.register(fastifyRateLimit, {
  max: 100, // Limit each IP to 100 requests per `window` (here, per 1 minute)
  timeWindow: '1 minute',
});

// Auth middleware
authHook(app);

// Registrar rutas API
registerRoutes(app);

// Registrar webhook de WhatsApp (ruta pública, antes del auth check)
registerWhatsAppRoutes(app);

// Servir dashboard estático (después de las rutas API)
const dashboardPath = join(__dirname, '..', '..', 'enjambre-dashboard', 'dist');
await app.register(fastifyStatic, {
  root: dashboardPath,
  prefix: '/',
  decorateReply: false,
});

// SPA fallback - cualquier ruta que no sea /api ni archivo estático, sirve index.html
app.setNotFoundHandler(async (req, reply) => {
  if (req.url.startsWith('/api')) {
    reply.code(404).send({ error: 'Not found' });
    return;
  }
  return reply.sendFile('index.html');
});

// Iniciar Event Bus (Redis pub/sub)
await eventBus.connect();

// Iniciar conectores de landings
await startDCCConnector({ eventBus, db: { query, queryOne } });

// Iniciar conector Discord
await startDiscordConnector();

// Graceful shutdown
const shutdown = async () => {
  app.log.info('Apagando Enjambre...');
  stopDCCConnector();
  stopDiscordConnector();
  await eventBus.disconnect();
  await db.end();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Arrancar
const port = process.env.PORT || 3500;
await app.listen({ port: Number(port), host: '0.0.0.0' });
app.log.info(`🐺 Enjambre Cerebro activo en puerto ${port}`);