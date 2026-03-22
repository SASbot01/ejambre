import React from 'react';
import { Activity } from 'lucide-react';

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getAgentFromEvent(event) {
  return event.source_agent || 'brain';
}

function formatEventText(event) {
  const type = event.event_type || '';
  const payload = event.payload || {};

  const formatters = {
    'lead.created': () => `Nuevo lead: ${payload.email || '?'} — ${payload.producto || 'sin producto'} (${payload.landing_source || '?'})`,
    'threat.detected': () => `Amenaza ${payload.severity || '?'}: ${payload.type || '?'} desde ${payload.source_ip || '?'}`,
    'tool.executed': () => `Tool ${payload.tool || '?'} ejecutado`,
    'tool.error': () => `Error en ${payload.tool || '?'}`,
    'sale.closed': () => `Venta cerrada: $${payload.amount || '?'} por ${payload.closer || '?'}`,
  };

  return (formatters[type] || (() => `${type}: ${JSON.stringify(payload).slice(0, 120)}`))();
}

export default function EventStream({ events }) {
  return (
    <div className="event-stream">
      <div className="event-stream-header">
        <div className="card-title">
          <Activity size={14} style={{ display: 'inline', marginRight: 8 }} />
          Pizarra en Tiempo Real
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{events.length} eventos</span>
      </div>
      {events.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Esperando eventos del enjambre...
        </div>
      )}
      {events.map((event, i) => {
        const agent = getAgentFromEvent(event);
        return (
          <div key={i} className="event-item">
            <span className="event-time">{formatTime(event.timestamp || new Date())}</span>
            <span className={`event-badge ${agent}`}>{agent}</span>
            <span className="event-text">{formatEventText(event)}</span>
          </div>
        );
      })}
    </div>
  );
}
