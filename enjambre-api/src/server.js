import Fastify from 'fastify';
import cors from '@fastify/cors';
import { eventBus } from './events/event-bus.js';
import { db } from './config/database.js';
import { registerRoutes } from './routes/index.js';
import { startSequenceWorker } from './workers/sequence-worker.js';
import { startBrainWorker } from './workers/brain-worker.js';
import { registerWhatsAppRoutes } from './connectors/whatsapp.js';

const app = Fastify({ logger: true });

// CORS controlado por whitelist. Comportamiento:
//   - Sin header Origin (webhooks server-to-server Meta/ManyChat/Stripe) → permitido
//   - Con Origin: permitido solo si está en CORS_ORIGINS (csv) o si CORS_ORIGINS='*'
//   - Si CORS_ORIGINS no está definida → permitido cualquier origen (comportamiento legacy,
//     emitimos warning para forzar configuración en prod)
const corsOriginsEnv = (process.env.CORS_ORIGINS || '').trim();
if (!corsOriginsEnv) {
  app.log.warn('CORS_ORIGINS no está definida — permitiendo cualquier origen (legacy). Configúralo en prod.');
}
const corsWhitelist = corsOriginsEnv
  ? corsOriginsEnv.split(',').map(s => s.trim()).filter(Boolean)
  : null;
const corsWildcard = corsWhitelist?.includes('*') || !corsWhitelist;

await app.register(cors, {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // server-to-server, curl, webhooks
    if (corsWildcard) return cb(null, true);
    if (corsWhitelist.includes(origin)) return cb(null, true);
    return cb(new Error('CORS blocked for origin ' + origin), false);
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Client-Slug','X-Webhook-Secret','Stripe-Signature'],
});

// Registrar todas las rutas
registerRoutes(app);

// Registrar rutas de WhatsApp (antes de listen)
registerWhatsAppRoutes(app);

// Iniciar Event Bus (in-process)
await eventBus.connect();

// Graceful shutdown
const shutdown = async () => {
  app.log.info('Apagando...');
  await eventBus.disconnect();
  await db.end();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Arrancar
const port = process.env.PORT || 3500;
await app.listen({ port: Number(port), host: '0.0.0.0' });
app.log.info(`BlackWolf API activo en puerto ${port}`);

// Iniciar workers
startSequenceWorker();
startBrainWorker();
