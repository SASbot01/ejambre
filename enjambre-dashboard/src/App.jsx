import { useState, useEffect, useRef } from 'react';
import { Activity, Send } from 'lucide-react';
import { useEventStream } from './hooks/useEventStream.js';
import { sendChat, getAgentStatus, logout } from './services/api.js';
import LoginPage from './components/auth/LoginPage.jsx';

const AGENTS_META = {
  ciber:      { label: 'CIBER',      color: 'var(--agent-ciber)',    desc: 'SOC / Ciberseguridad',   forClients: true },
  crm:        { label: 'CRM',        color: 'var(--agent-crm)',      desc: 'Leads y Pipeline',        forClients: false },
  ops:        { label: 'OPS',        color: 'var(--agent-ops)',       desc: 'Revenue y Operaciones',   forClients: false },
  forms:      { label: 'FORMS',      color: 'var(--agent-forms)',     desc: 'Formularios Web',         forClients: false },
  whatsapp:   { label: 'WHATSAPP',   color: 'var(--agent-whatsapp)', desc: 'Setter WhatsApp',         forClients: true },
  discord:    { label: 'DISCORD',    color: 'var(--agent-discord)',   desc: 'Bot Discord',             forClients: false },
  prospector: { label: 'PROSPECTOR', color: 'var(--info)',            desc: 'Cold Outreach',           forClients: false },
  brain:      { label: 'CEREBRO',    color: 'var(--white)',           desc: 'Orquestador IA',          forClients: false },
};

const QUICK_PROMPTS = [
  'Resumen general',
  'Amenazas activas',
  'Pipeline de leads hoy',
  'Estado de los agentes',
  'Ventas del mes',
];

// ── Agent Tiles ──
function AgentGrid({ agents }) {
  return (
    <>
      <div className="section-label">Agentes Activos</div>
      <div className="agents-grid">
        {agents.map(a => {
          const meta = AGENTS_META[a.agent_name] || { label: a.agent_name, color: 'var(--text-muted)', desc: '' };
          const online = a.last_heartbeat && (Date.now() - new Date(a.last_heartbeat).getTime() < 120_000);
          return (
            <div className="agent-tile" key={a.agent_name}>
              <div className="agent-tile__header">
                <div className={`agent-tile__dot agent-tile__dot--${online ? 'on' : 'off'}`} />
                <span className="agent-tile__name" style={{ color: meta.color }}>{meta.label}</span>
              </div>
              <div className="agent-tile__desc">{meta.desc}</div>
              {meta.forClients && (
                <div className="agent-tile__client">Disponible para clientes</div>
              )}
            </div>
          );
        })}
        {agents.length === 0 && (
          <div style={{ gridColumn: '1 / -1', color: 'var(--text-muted)', fontSize: '0.8rem', padding: 20, textAlign: 'center' }}>
            Sin agentes registrados
          </div>
        )}
      </div>
    </>
  );
}

// ── Client Cards ──
function ClientGrid({ agents }) {
  // Derive clients from agent assignments — for now show which agents serve clients
  const clientAgents = agents.filter(a => {
    const meta = AGENTS_META[a.agent_name];
    return meta?.forClients;
  });

  if (clientAgents.length === 0) return null;

  return (
    <>
      <div className="section-label">Servicios para Clientes</div>
      <div className="clients-grid">
        {clientAgents.map(a => {
          const meta = AGENTS_META[a.agent_name] || { label: a.agent_name, color: 'var(--text-muted)', desc: '' };
          const online = a.last_heartbeat && (Date.now() - new Date(a.last_heartbeat).getTime() < 120_000);
          return (
            <div className="client-card" key={a.agent_name} style={{ cursor: 'default' }}>
              <div className="client-card__icon" style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}30`, color: meta.color }}>
                {meta.label[0]}
              </div>
              <div className="client-card__info">
                <div className="client-card__name">{meta.desc}</div>
                <div className="client-card__agents">
                  {online ? 'Activo' : 'Inactivo'} — {meta.label}
                </div>
              </div>
              <div className={`topnav__dot topnav__dot--${online ? 'on' : 'off'}`} />
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Event Stream ──
function EventList({ events, limit = 50 }) {
  const shown = events.slice(0, limit);
  return (
    <div className="widget" style={{ maxHeight: 500, overflow: 'auto' }}>
      <div className="widget__title">Eventos en tiempo real</div>
      <div className="events-list">
        {shown.map((e, i) => {
          const meta = AGENTS_META[e.source_agent] || { label: e.source_agent || '?', color: 'var(--text-muted)' };
          const time = e.created_at ? new Date(e.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
          const text = e.event_type || '';
          return (
            <div className="event-row" key={i}>
              <span className="event-row__time">{time}</span>
              <span className="event-row__badge" style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}30` }}>
                {meta.label}
              </span>
              <span className="event-row__text">{text}</span>
            </div>
          );
        })}
        {shown.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Esperando eventos...
          </div>
        )}
      </div>
    </div>
  );
}

// ── Chat Panel ──
function ChatPanel() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEnd = useRef(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(text) {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);
    try {
      const res = await sendChat(msg);
      setMessages(prev => [...prev, { role: 'bot', content: res.response || 'Sin respuesta.', agents: res.agents_used }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', content: `Error: ${err.message}` }]);
    }
    setLoading(false);
  }

  return (
    <div className="widget chat">
      <div className="widget__title">Agente IA</div>

      {messages.length === 0 && (
        <div className="quick-actions">
          {QUICK_PROMPTS.map(p => (
            <button key={p} className="quick-action" onClick={() => handleSend(p)}>{p}</button>
          ))}
        </div>
      )}

      <div className="chat__messages">
        {messages.map((m, i) => (
          <div key={i} className={`chat__msg chat__msg--${m.role === 'user' ? 'user' : 'bot'}`}>
            {m.content}
            {m.agents?.length > 0 && (
              <div style={{ marginTop: 8, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Agentes: {m.agents.join(', ')}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="chat__msg chat__msg--bot" style={{ color: 'var(--text-muted)' }}>
            Pensando...
          </div>
        )}
        <div ref={messagesEnd} />
      </div>

      <div className="chat__input-row">
        <input
          className="chat__input"
          placeholder="Pregunta al agente..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
          disabled={loading}
        />
        <button className="chat__send" onClick={() => handleSend()} disabled={loading || !input.trim()}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Main App ──
export default function App() {
  const [page, setPage] = useState('home');
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('enjambre_user')); } catch { return null; }
  });
  const [agents, setAgents] = useState([]);
  const { events, connected } = useEventStream();

  // Auto-login via URL token
  useEffect(() => {
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

  // Fetch agent status
  useEffect(() => {
    if (!user) return;
    const load = () => getAgentStatus().then(setAgents).catch(() => {});
    load();
    const interval = setInterval(load, 15_000);
    return () => clearInterval(interval);
  }, [user]);

  if (!user || !localStorage.getItem('enjambre_token')) {
    return <LoginPage onLogin={setUser} />;
  }

  const navItems = [
    { key: 'home', label: 'Home' },
    { key: 'chat', label: 'Agente IA' },
    { key: 'events', label: 'Eventos' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font)' }}>
      {/* ── Top Navigation ── */}
      <nav className="topnav">
        <div className="topnav__left">
          <button className="topnav__home" onClick={() => setPage('home')}>
            <span className="topnav__logo-placeholder">BW</span>
            <span className="topnav__brand">BLACK WOLF</span>
          </button>

          <div className="topnav__sections">
            {navItems.map(item => (
              <button
                key={item.key}
                className={`topnav__item ${page === item.key ? 'topnav__item--active' : ''}`}
                onClick={() => setPage(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="topnav__right">
          <div className="topnav__status">
            <div className={`topnav__dot topnav__dot--${connected ? 'on' : 'off'}`} />
            {connected ? 'Live' : 'Offline'}
          </div>
          <div className="topnav__status">
            <Activity size={12} />
            {events.length}
          </div>
          <div className="topnav__user">
            <div className="topnav__avatar">{(user.email || 'A')[0].toUpperCase()}</div>
          </div>
          <button className="topnav__action topnav__action--logout" onClick={logout}>
            Salir
          </button>
        </div>
      </nav>

      {/* ── Content ── */}
      <main className="main">
        {page === 'home' && (
          <>
            <AgentGrid agents={agents} />
            <ClientGrid agents={agents} />
            <div className="two-col">
              <ChatPanel />
              <EventList events={events} />
            </div>
          </>
        )}

        {page === 'chat' && (
          <div style={{ maxWidth: 900 }}>
            <ChatPanel />
          </div>
        )}

        {page === 'events' && (
          <EventList events={events} limit={200} />
        )}
      </main>
    </div>
  );
}
