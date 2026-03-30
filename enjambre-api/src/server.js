import Fastify from 'fastify';
import cors from '@fastify/cors';
import { eventBus } from './events/event-bus.js';
import { db } from './config/database.js';
import { registerRoutes } from './routes/index.js';
import { startSequenceWorker } from './workers/sequence-worker.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// Registrar todas las rutas
registerRoutes(app);

// Iniciar Event Bus (in-process)
await eventBus.connect();

// Graceful shutdown
const shutdown = async () => {
  app.log.info('Apagando Enjambre...');
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

// Iniciar workers
startSequenceWorker();
