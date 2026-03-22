import Redis from 'ioredis';
import { query } from '../config/database.js';

const CHANNEL = 'enjambre:events';

class EventBus {
  constructor() {
    this.pub = null;
    this.sub = null;
    this.handlers = new Map();
    this.sseClients = new Set();
  }

  async connect() {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    this.pub = new Redis(url);
    this.sub = new Redis(url);

    this.sub.subscribe(CHANNEL);
    this.sub.on('message', (channel, message) => {
      if (channel !== CHANNEL) return;
      const event = JSON.parse(message);
      this._dispatch(event);
      this._broadcastSSE(event);
    });
  }

  async publish(eventType, sourceAgent, payload, correlationId = null) {
    const event = {
      event_type: eventType,
      source_agent: sourceAgent,
      payload,
      correlation_id: correlationId,
      timestamp: new Date().toISOString(),
    };

    // Persistir en PostgreSQL
    await query(
      `INSERT INTO events (event_type, source_agent, payload, correlation_id)
       VALUES ($1, $2, $3, $4)`,
      [eventType, sourceAgent, JSON.stringify(payload), correlationId]
    );

    // Publicar en Redis
    await this.pub.publish(CHANNEL, JSON.stringify(event));
    return event;
  }

  on(eventType, handler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType).push(handler);
  }

  addSSEClient(res) {
    this.sseClients.add(res);
  }

  removeSSEClient(res) {
    this.sseClients.delete(res);
  }

  _dispatch(event) {
    const handlers = this.handlers.get(event.event_type) || [];
    const wildcardHandlers = this.handlers.get('*') || [];
    [...handlers, ...wildcardHandlers].forEach((h) => h(event));
  }

  _broadcastSSE(event) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.sseClients) {
      client.raw.write(data);
    }
  }

  async disconnect() {
    if (this.sub) await this.sub.quit();
    if (this.pub) await this.pub.quit();
  }
}

export const eventBus = new EventBus();
