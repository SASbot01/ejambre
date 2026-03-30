import { query } from '../config/database.js';

class EventBus {
  constructor() {
    this.handlers = new Map();
    this.sseClients = new Set();
  }

  async connect() {
    // In-process event bus — no external dependencies needed
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

    this._dispatch(event);
    this._broadcastSSE(event);
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
    // Nothing to close — in-process
  }
}

export const eventBus = new EventBus();
