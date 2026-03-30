import React, { useState } from 'react';
import {
  LayoutDashboard, Shield, Users, TrendingUp, FileText,
  Brain, Activity, Building2, LogOut, Zap, ChevronRight, Code2,
  Home, ArrowLeft,
} from 'lucide-react';
import KPIPanel from './components/dashboard/KPIPanel.jsx';
import AgentPanel from './components/agents/AgentPanel.jsx';
import EventStream from './components/events/EventStream.jsx';
import ChatPanel from './components/chat/ChatPanel.jsx';
import DevAgent from './components/agents/DevAgent.jsx';
import OfficeWorld from './components/office/OfficeWorld.jsx';
import EnjambreHome from './components/home/EnjambreHome.jsx';
import LoginPage from './components/auth/LoginPage.jsx';
import { useEventStream } from './hooks/useEventStream.js';
import { logout } from './services/api.js';

const DASHBOARD_OPS_URL = 'https://central.blackwolfsec.io/admin';

const SIDEBAR_ITEMS = [
  { key: 'home', icon: Home, label: 'Home' },
  { key: 'office', icon: Building2, label: 'Oficina Virtual' },
  { key: 'dashboard', icon: LayoutDashboard, label: 'Centro de Comando' },
  { key: 'chat', icon: Brain, label: 'Cerebro IA' },
  { divider: true, label: 'Agentes' },
  { key: 'ciber', icon: Shield, label: 'CIBER / SOC', badge: 'ciber' },
  { key: 'crm', icon: Users, label: 'CRM / Leads', badge: 'crm' },
  { key: 'ops', icon: TrendingUp, label: 'OPS / ERP', badge: 'ops' },
  { key: 'forms', icon: FileText, label: 'Formularios', badge: 'forms' },
  { divider: true, label: 'Desarrollo' },
  { key: 'developer', icon: Code2, label: 'Dev Agent' },
  { divider: true, label: 'Sistema' },
  { key: 'events', icon: Activity, label: 'Event Stream' },
];

export default function App() {
  const [page, setPage] = useState('home');
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('enjambre_user')); } catch { return null; }
  });
  const { events, connected } = useEventStream();

  // Auto-login via URL token (from Dashboard-Ops Home)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token && !localStorage.getItem('enjambre_token')) {
      localStorage.setItem('enjambre_token', token);
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const u = { email: payload.email, name: payload.name, role: payload.role };
        localStorage.setItem('enjambre_user', JSON.stringify(u));
        setUser(u);
      } catch {}
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  if (!user || !localStorage.getItem('enjambre_token')) {
    return <LoginPage onLogin={setUser} />;
  }

  // Home renders without sidebar (full-screen like iPad)
  if (page === 'home') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font)' }}>
        <EnjambreHome
          onNavigate={setPage}
          events={events}
          connected={connected}
          user={user}
        />
      </div>
    );
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          {/* Back to Home Central */}
          <a
            href={DASHBOARD_OPS_URL}
            title="Volver al Home Central"
            style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#888', textDecoration: 'none', transition: 'all 0.15s',
              marginRight: 4, flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#FF6B00'; e.currentTarget.style.color = '#FF6B00'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#888'; }}
          >
            <ArrowLeft size={14} />
          </a>
          <div className="brand-icon" style={{ position: 'relative' }}>
            <Zap size={16} />
            {/* BW badge */}
            <div style={{
              position: 'absolute', bottom: -3, right: -3,
              width: 14, height: 14, borderRadius: 4,
              background: '#0A0A0A', border: '1.5px solid #FF6B00',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.35rem', fontWeight: 900, color: '#FF6B00',
            }}>BW</div>
          </div>
          <span className="brand-wolf">BLACKWOLF</span>
          <span className="brand-enjambre">ENJAMBRE</span>
        </div>
        <div className="header-status">
          <div className="header-pill">
            <Activity size={12} />
            <span>{events.length} eventos</span>
          </div>
          <div className="header-pill">
            <div className={`dot ${connected ? 'online' : 'offline'}`} />
            <span style={{ color: connected ? 'var(--success)' : 'var(--danger)' }}>
              {connected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
          <button className="header-btn" onClick={logout} title="Cerrar sesion">
            <LogOut size={14} />
            Salir
          </button>
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
                <div className="item-icon">
                  <Icon size={18} />
                </div>
                {item.label}
                {page === item.key && (
                  <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                )}
              </button>
            </div>
          );
        })}

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--gradient)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--black)', fontWeight: 700, fontSize: 12,
            }}>
              {(user?.email || 'A')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>
                {user?.name || 'Admin'}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email || ''}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main">
        {page === 'office' && <OfficeWorld />}

        {page === 'dashboard' && (
          <div className="fade-in">
            <h2 className="page-title">
              <LayoutDashboard size={22} />
              <span className="title-gradient">Centro de Comando</span>
            </h2>
            <KPIPanel />
            <AgentPanel events={events} />
            <div className="content-grid">
              <EventStream events={events} />
              <ChatPanel />
            </div>
          </div>
        )}

        {page === 'chat' && (
          <div className="fade-in">
            <h2 className="page-title">
              <Brain size={22} />
              <span className="title-gradient">Cerebro del Enjambre</span>
            </h2>
            <div style={{ maxWidth: 900 }}>
              <ChatPanel />
            </div>
          </div>
        )}

        {page === 'ciber' && (
          <div className="fade-in">
            <h2 className="page-title">
              <Shield size={22} style={{ color: 'var(--agent-ciber)' }} />
              Agente CIBER / SOC
            </h2>
            <div className="info-card">
              <div className="info-title"><div className="title-dot" />Estado del SOC</div>
              <p>Conectado a BlackWolf SOC. Las amenazas se procesan automaticamente. Usa el chat del Cerebro para consultar amenazas, bloquear IPs o ejecutar playbooks.</p>
            </div>
            <EventStream events={events.filter((e) => e.source_agent === 'ciber')} />
          </div>
        )}

        {page === 'crm' && (
          <div className="fade-in">
            <h2 className="page-title">
              <Users size={22} style={{ color: 'var(--agent-crm)' }} />
              Agente CRM / Leads
            </h2>
            <KPIPanel />
            <EventStream events={events.filter((e) => ['crm', 'forms'].includes(e.source_agent))} />
          </div>
        )}

        {page === 'ops' && (
          <div className="fade-in">
            <h2 className="page-title">
              <TrendingUp size={22} style={{ color: 'var(--agent-ops)' }} />
              Agente OPS / ERP
            </h2>
            <div className="info-card">
              <div className="info-title"><div className="title-dot" />Dashboard-Ops</div>
              <p>Conectado a Dashboard-Ops via Supabase. Ventas, comisiones y proyecciones disponibles via el Cerebro.</p>
            </div>
            <EventStream events={events.filter((e) => e.source_agent === 'ops')} />
          </div>
        )}

        {page === 'forms' && (
          <div className="fade-in">
            <h2 className="page-title">
              <FileText size={22} style={{ color: 'var(--agent-forms)' }} />
              Formularios de Infoproductos
            </h2>
            <div className="info-card">
              <div className="info-title"><div className="title-dot" />Webhook de Formularios</div>
              <p>Endpoint: <code>POST https://forms.tudominio.com/webhook</code></p>
              <p style={{ marginTop: 8 }}>Envia un JSON con: <code>email</code> (requerido), <code>nombre</code>, <code>telefono</code>, <code>producto</code>, <code>landing</code>, <code>utm_source</code>, <code>utm_medium</code>, <code>utm_campaign</code></p>
            </div>
            <EventStream events={events.filter((e) => e.source_agent === 'forms')} />
          </div>
        )}

        {page === 'developer' && (
          <div className="fade-in">
            <DevAgent events={events} />
          </div>
        )}

        {page === 'events' && (
          <div className="fade-in">
            <h2 className="page-title">
              <Activity size={22} />
              <span className="title-gradient">Event Stream</span>
            </h2>
            <EventStream events={events} />
          </div>
        )}
      </main>
    </div>
  );
}
