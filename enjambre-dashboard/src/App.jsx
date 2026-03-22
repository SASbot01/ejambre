import React, { useState } from 'react';
import {
  LayoutDashboard, Shield, Users, TrendingUp, FileText,
  Brain, Settings, Activity, MessageSquare, Building2,
} from 'lucide-react';
import KPIPanel from './components/dashboard/KPIPanel.jsx';
import AgentPanel from './components/agents/AgentPanel.jsx';
import EventStream from './components/events/EventStream.jsx';
import ChatPanel from './components/chat/ChatPanel.jsx';
import OfficeWorld from './components/office/OfficeWorld.jsx';
import { useEventStream } from './hooks/useEventStream.js';

const PAGES = {
  dashboard: 'Centro de Comando',
  ciber: 'Agente CIBER',
  crm: 'Agente CRM',
  ops: 'Agente OPS',
  forms: 'Formularios',
  chat: 'Cerebro IA',
};

const SIDEBAR_ITEMS = [
  { key: 'office', icon: Building2, label: 'Oficina Virtual' },
  { key: 'dashboard', icon: LayoutDashboard, label: 'Centro de Comando' },
  { key: 'chat', icon: Brain, label: 'Cerebro IA' },
  { divider: true, label: 'Agentes' },
  { key: 'ciber', icon: Shield, label: 'Ciberseguridad', countKey: 'threats' },
  { key: 'crm', icon: Users, label: 'CRM / Leads', countKey: 'leads' },
  { key: 'ops', icon: TrendingUp, label: 'Operaciones' },
  { key: 'forms', icon: FileText, label: 'Formularios' },
  { divider: true, label: 'Sistema' },
  { key: 'events', icon: Activity, label: 'Event Stream' },
];

export default function App() {
  const [page, setPage] = useState('office');
  const { events, connected } = useEventStream();

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <span>BLACKWOLF</span> ENJAMBRE
        </div>
        <div className="header-status">
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {events.length} eventos
          </span>
          <div className="status-dot" style={{ background: connected ? 'var(--accent-green)' : 'var(--accent-red)' }} />
          <span style={{ fontSize: 12, color: connected ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {connected ? 'Conectado' : 'Desconectado'}
          </span>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="sidebar">
        {SIDEBAR_ITEMS.map((item, i) => {
          if (item.divider) {
            return (
              <div key={i} className="sidebar-section">
                <div className="sidebar-label">{item.label}</div>
              </div>
            );
          }
          const Icon = item.icon;
          return (
            <div className="sidebar-section" key={item.key} style={{ marginBottom: 0 }}>
              <button
                className={`sidebar-item ${page === item.key ? 'active' : ''}`}
                onClick={() => setPage(item.key)}
              >
                <Icon size={18} />
                {item.label}
              </button>
            </div>
          );
        })}
      </aside>

      {/* Main Content */}
      <main className="main">
        {page === 'office' && (
          <OfficeWorld />
        )}

        {page === 'dashboard' && (
          <>
            <h2 style={{ marginBottom: 20, fontWeight: 700, fontSize: 22 }}>Centro de Comando</h2>
            <KPIPanel />
            <AgentPanel />
            <div className="content-grid">
              <EventStream events={events} />
              <ChatPanel />
            </div>
          </>
        )}

        {page === 'chat' && (
          <>
            <h2 style={{ marginBottom: 20, fontWeight: 700, fontSize: 22 }}>Cerebro del Enjambre</h2>
            <div style={{ maxWidth: 900 }}>
              <ChatPanel />
            </div>
          </>
        )}

        {page === 'ciber' && (
          <>
            <h2 style={{ marginBottom: 20, fontWeight: 700, fontSize: 22 }}>Agente CIBER / SOC</h2>
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title">Estado del SOC</div>
              <p style={{ color: 'var(--text-secondary)', marginTop: 12 }}>
                Conectado a BlackWolf SOC. Las amenazas se procesan automáticamente.
                Usa el chat del Cerebro para consultar amenazas, bloquear IPs o ejecutar playbooks.
              </p>
            </div>
            <EventStream events={events.filter((e) => e.source_agent === 'ciber')} />
          </>
        )}

        {page === 'crm' && (
          <>
            <h2 style={{ marginBottom: 20, fontWeight: 700, fontSize: 22 }}>Agente CRM / Leads</h2>
            <KPIPanel />
            <EventStream events={events.filter((e) => ['crm', 'forms'].includes(e.source_agent))} />
          </>
        )}

        {page === 'ops' && (
          <>
            <h2 style={{ marginBottom: 20, fontWeight: 700, fontSize: 22 }}>Agente OPS / ERP</h2>
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title">Dashboard-Ops</div>
              <p style={{ color: 'var(--text-secondary)', marginTop: 12 }}>
                Conectado a Dashboard-Ops via Supabase. Ventas, comisiones y proyecciones disponibles via el Cerebro.
              </p>
            </div>
            <EventStream events={events.filter((e) => e.source_agent === 'ops')} />
          </>
        )}

        {page === 'forms' && (
          <>
            <h2 style={{ marginBottom: 20, fontWeight: 700, fontSize: 22 }}>Formularios de Infoproductos</h2>
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title">Webhook de Formularios</div>
              <p style={{ color: 'var(--text-secondary)', marginTop: 12, lineHeight: 1.6 }}>
                Endpoint: <code style={{ background: 'var(--bg-primary)', padding: '2px 8px', borderRadius: 4 }}>
                  POST https://forms.tudominio.com/webhook
                </code>
              </p>
              <p style={{ color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6 }}>
                Envía un JSON con: <code>email</code> (requerido), <code>nombre</code>, <code>telefono</code>,
                <code> producto</code>, <code>landing</code>, <code>utm_source</code>, <code>utm_medium</code>, <code>utm_campaign</code>
              </p>
              <div style={{ marginTop: 16, background: 'var(--bg-primary)', padding: 16, borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                <pre style={{ color: 'var(--text-secondary)' }}>{`// Ejemplo para tus landings:
fetch('https://forms.tudominio.com/webhook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nombre: form.nombre,
    email: form.email,
    telefono: form.telefono,
    producto: 'Mi Infoproducto',
    landing: 'landing-nombre',
    utm_source: urlParams.get('utm_source'),
    utm_medium: urlParams.get('utm_medium'),
    utm_campaign: urlParams.get('utm_campaign'),
  })
})`}</pre>
              </div>
            </div>
            <EventStream events={events.filter((e) => e.source_agent === 'forms')} />
          </>
        )}

        {page === 'events' && (
          <>
            <h2 style={{ marginBottom: 20, fontWeight: 700, fontSize: 22 }}>Event Stream Completo</h2>
            <EventStream events={events} />
          </>
        )}
      </main>
    </div>
  );
}
