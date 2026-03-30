import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Shield, Users, TrendingUp, FileText, Brain, Bot,
  Activity, Code2, ArrowLeft, Send, Search, ChevronDown,
  ChevronLeft, Network, AlertTriangle, CheckCircle, Clock, XCircle,
  Cpu,
} from 'lucide-react';
import { getLeadStats, getAgentStatus, getDecisions, getEvents, sendChat } from '../../services/api.js';

const DASHBOARD_OPS_URL = 'https://central.blackwolfsec.io/admin';
const DEV_API = '/api';
function getToken() { return localStorage.getItem('enjambre_token'); }
function authHeaders() { return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }; }

// ─── All agents as "employees" in the office ───
const OFFICE_AGENTS = [
  { id: 'cerebro', icon: Bot, label: 'CEREBRO', role: 'Orquestador Central — Dirige todos los agentes', color: '#F5F5F5', dept: 'Direccion', alwaysOnline: true },
  { id: 'ciber', icon: Shield, label: 'CIBER / SOC', role: 'Analista de Ciberseguridad 24/7', color: '#EF4444', dept: 'Ciberseguridad' },
  { id: 'crm', icon: Users, label: 'CRM / Ventas', role: 'Pipeline Manager — Leads & Contactos', color: '#3B82F6', dept: 'Comercial' },
  { id: 'ops', icon: TrendingUp, label: 'OPS / ERP', role: 'Revenue, Comisiones & Proyecciones', color: '#22C55E', dept: 'Operaciones' },
  { id: 'forms', icon: FileText, label: 'FORMS', role: 'Captura de Leads via Webhooks', color: '#A855F7', dept: 'Comercial' },
  { id: 'developer', icon: Code2, label: 'DEV AGENT', role: 'Desarrollo, Deploy & Code Review', color: '#10B981', dept: 'Tecnologia' },
  { id: 'prospector', icon: Search, label: 'PROSPECTOR', role: 'Scrapper Multi-Fuente de Leads', color: '#EC4899', dept: 'Comercial' },
];

const DEPTS = ['Direccion', 'Comercial', 'Ciberseguridad', 'Operaciones', 'Tecnologia'];
const DEPT_EMOJIS = { Direccion: '👔', Comercial: '💼', Ciberseguridad: '🛡️', Operaciones: '📊', Tecnologia: '💻' };

export default function EnjambreHome({ onNavigate, events, connected, user }) {
  const [stats, setStats] = useState(null);
  const [agentStatusData, setAgentStatusData] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);

  // Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMode, setChatMode] = useState('cerebro');
  const [chatModeOpen, setChatModeOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Agent chat (when viewing individual agent)
  const [agentChatInput, setAgentChatInput] = useState('');
  const [agentChatLoading, setAgentChatLoading] = useState(false);
  const [agentMessages, setAgentMessages] = useState([]);
  const agentChatEnd = useRef(null);

  useEffect(() => {
    const load = () => {
      getLeadStats().then(setStats).catch(() => {});
      getAgentStatus().then(s => { if (Array.isArray(s)) setAgentStatusData(s); }).catch(() => {});
      getDecisions(30).then(d => { if (Array.isArray(d)) setDecisions(d); }).catch(() => {});
      getEvents(50).then(e => { if (Array.isArray(e)) setAllEvents(e); }).catch(() => {});
    };
    load();
    const i = setInterval(load, 15000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { agentChatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [agentMessages]);

  useEffect(() => {
    if (chatOpen && messages.length === 0) {
      setMessages([{ role: 'assistant', content: chatMode === 'cerebro' ? 'Cerebro activo. Que necesitas?' : 'Dev Agent listo. Que necesitas?' }]);
    }
  }, [chatOpen]);

  // Helpers
  const getOnline = (id) => {
    const a = OFFICE_AGENTS.find(x => x.id === id);
    if (a?.alwaysOnline) return true;
    const s = agentStatusData.find(x => x.agent_name === id);
    return s ? (Date.now() - new Date(s.last_heartbeat).getTime() < 120000) : false;
  };
  const getAgentEvents = (id) => [...events, ...allEvents].filter(e => e.source_agent === id);
  const getAgentDecisions = (id) => decisions.filter(d => d.agent === id || d.source_agent === id);

  const card = { background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16 };

  // ─── Chat handlers ───
  async function handleSend() {
    const msg = chatInput.trim(); if (!msg || chatLoading) return;
    setChatInput(''); setMessages(prev => [...prev, { role: 'user', content: msg }]); setChatLoading(true);
    try {
      if (chatMode === 'cerebro') { const r = await sendChat(msg); setMessages(prev => [...prev, { role: 'assistant', content: r.response || r.error || 'Sin respuesta' }]); }
      else { const r = await fetch(`${DEV_API}/dev/chat`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ message: msg }) }); const d = await r.json(); setMessages(prev => [...prev, { role: 'assistant', content: d.response || d.message || d.error || 'Sin respuesta' }]); }
    } catch (err) { setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]); }
    setChatLoading(false);
  }

  async function handleAgentChat() {
    const msg = agentChatInput.trim(); if (!msg || agentChatLoading || !selectedAgent) return;
    setAgentChatInput(''); setAgentMessages(prev => [...prev, { role: 'user', content: msg }]); setAgentChatLoading(true);
    try {
      const prompt = `[Hablando con agente ${selectedAgent.label}] ${msg}`;
      const r = await sendChat(prompt, `agent-${selectedAgent.id}`);
      setAgentMessages(prev => [...prev, { role: 'assistant', content: r.response || 'Sin respuesta' }]);
    } catch (err) { setAgentMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]); }
    setAgentChatLoading(false);
  }

  function openAgent(agent) {
    setSelectedAgent(agent);
    setAgentMessages([{ role: 'assistant', content: `Agente ${agent.label} — ${agent.role}. Puedes preguntarme sobre mi estado, historial o darme instrucciones.` }]);
  }

  function switchMode(mode) { setChatMode(mode); setChatModeOpen(false); setMessages([{ role: 'assistant', content: mode === 'cerebro' ? 'Cerebro activo.' : 'Dev Agent listo.' }]); }

  const kpis = [
    { label: 'Leads Hoy', value: stats?.hoy ?? '—', color: '#F5F5F5' },
    { label: 'Semana', value: stats?.esta_semana ?? '—', color: '#3B82F6' },
    { label: 'Nuevos', value: stats?.nuevos ?? '—', color: '#FFB800' },
    { label: 'Contactados', value: stats?.contactados ?? '—', color: '#A855F7' },
    { label: 'Ganados', value: stats?.ganados ?? '—', color: '#22C55E' },
    { label: 'Perdidos', value: stats?.perdidos ?? '—', color: '#EF4444' },
  ];

  // ═══ AGENT DETAIL VIEW ═══
  if (selectedAgent) {
    const a = selectedAgent;
    const Icon = a.icon;
    const online = getOnline(a.id);
    const agentEvts = getAgentEvents(a.id);
    const agentDecs = getAgentDecisions(a.id);
    const statusEntry = agentStatusData.find(s => s.agent_name === a.id);
    const metrics = statusEntry?.metrics ? (typeof statusEntry.metrics === 'string' ? JSON.parse(statusEntry.metrics) : statusEntry.metrics) : {};

    return (
      <div style={{ padding: '0 20px 40px', maxWidth: 1000, margin: '0 auto' }}>
        {/* Back */}
        <div style={{ paddingTop: 16, marginBottom: 12 }}>
          <button onClick={() => setSelectedAgent(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#888', fontSize: '0.7rem', cursor: 'pointer' }}>
            <ChevronLeft size={12} /> Volver a Oficina
          </button>
        </div>

        {/* Agent header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: `${a.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <Icon size={24} color={a.color} />
            <div style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: online ? '#22C55E' : '#555', border: '2.5px solid #0A0A0A' }} />
          </div>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>{a.label}</div>
            <div style={{ fontSize: '0.75rem', color: '#888' }}>{a.role}</div>
            <div style={{ fontSize: '0.6rem', color: a.color, fontWeight: 600, marginTop: 2 }}>{a.dept} — {online ? 'Online' : 'Offline'}</div>
          </div>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* Left: Chat with agent */}
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} style={{ ...card, padding: 0, display: 'flex', flexDirection: 'column', maxHeight: 500, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.7rem', fontWeight: 700, color: '#ddd', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon size={14} color={a.color} /> Conversacion con {a.label}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {agentMessages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '85%', padding: '7px 11px', borderRadius: 10, background: msg.role === 'user' ? `${a.color}15` : 'rgba(255,255,255,0.04)', border: `1px solid ${msg.role === 'user' ? `${a.color}30` : 'rgba(255,255,255,0.06)'}`, color: '#ddd', fontSize: '0.75rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {agentChatLoading && <div style={{ display: 'flex', gap: 3 }}>{[0,1,2].map(i => <motion.div key={i} animate={{ opacity: [0.3,1,0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i*0.2 }} style={{ width: 5, height: 5, borderRadius: '50%', background: a.color }} />)}</div>}
              <div ref={agentChatEnd} />
            </div>
            <div style={{ padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 6 }}>
              <input value={agentChatInput} onChange={e => setAgentChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAgentChat()}
                placeholder={`Habla con ${a.label}...`} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid #222', borderRadius: 8, color: '#fff', padding: '8px 10px', fontSize: '0.75rem', outline: 'none' }} />
              <button onClick={handleAgentChat} disabled={agentChatLoading} style={{ background: `linear-gradient(135deg, ${a.color}, ${a.color}cc)`, border: 'none', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Send size={12} color="#000" />
              </button>
            </div>
          </motion.div>

          {/* Right: Status + History */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Metrics */}
            {Object.keys(metrics).length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ ...card, padding: 14 }}>
                <div style={{ fontSize: '0.6rem', color: '#555', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>Metricas</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                  {Object.entries(metrics).map(([k, v]) => (
                    <div key={k} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 10px' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: a.color }}>{typeof v === 'number' ? v : String(v)}</div>
                      <div style={{ fontSize: '0.5rem', color: '#555', textTransform: 'uppercase' }}>{k.replace(/_/g, ' ')}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Decisions / Steps */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} style={{ ...card, padding: 14, maxHeight: 200, overflowY: 'auto' }}>
              <div style={{ fontSize: '0.6rem', color: '#555', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>Historial de ejecucion</div>
              {agentDecs.length === 0 && agentEvts.length === 0 && <div style={{ fontSize: '0.7rem', color: '#444', padding: '10px 0' }}>Sin actividad reciente</div>}
              {[...agentDecs.map(d => ({ ...d, _type: 'decision' })), ...agentEvts.slice(0, 15).map(e => ({ ...e, _type: 'event' }))]
                .sort((a, b) => new Date(b.created_at || b.timestamp || 0) - new Date(a.created_at || a.timestamp || 0))
                .slice(0, 20)
                .map((item, i) => {
                  const isError = /error|fail/i.test(item.event_type || item.decision || '');
                  const isSuccess = /success|complete|created/i.test(item.event_type || item.decision || '');
                  const StatusIcon = isError ? XCircle : isSuccess ? CheckCircle : Clock;
                  const statusColor = isError ? '#EF4444' : isSuccess ? '#22C55E' : '#FFB800';
                  const time = item.created_at || item.timestamp;
                  return (
                    <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.65rem' }}>
                      <StatusIcon size={12} color={statusColor} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span style={{ color: '#555', minWidth: 40, flexShrink: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem' }}>
                        {time ? new Date(time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                      <span style={{ color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.event_type || item.decision || item.type || '—'}
                      </span>
                    </div>
                  );
                })}
            </motion.div>

            {/* Recent events for this agent */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} style={{ ...card, padding: 14, maxHeight: 160, overflowY: 'auto' }}>
              <div style={{ fontSize: '0.6rem', color: '#555', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>Eventos en vivo ({agentEvts.length})</div>
              {agentEvts.slice(0, 10).map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '3px 0', fontSize: '0.6rem', fontFamily: "'JetBrains Mono', monospace" }}>
                  <span style={{ color: '#444', minWidth: 40 }}>{new Date(ev.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span style={{ color: '#888' }}>{ev.event_type || '—'}</span>
                </div>
              ))}
              {agentEvts.length === 0 && <div style={{ fontSize: '0.65rem', color: '#444' }}>Sin eventos</div>}
            </motion.div>
          </div>
        </div>

        {/* Floating chat */}
        {renderFloatingChat()}
      </div>
    );
  }

  // ═══ MAIN HOME VIEW ═══
  return (
    <div style={{ padding: '0 20px 40px', maxWidth: 1000, margin: '0 auto', position: 'relative' }}>
      {/* Back */}
      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} style={{ paddingTop: 16, marginBottom: 6 }}>
        <a href={DASHBOARD_OPS_URL} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#666', fontSize: '0.7rem', fontWeight: 500, textDecoration: 'none', transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#F5F5F550'; e.currentTarget.style.color = '#F5F5F5'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#666'; }}>
          <ArrowLeft size={12} /> Home Central
        </a>
      </motion.div>

      {/* Logo */}
      <motion.div initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(245,245,245,0.12)', position: 'relative' }}>
            <Zap size={20} color="#000" />
            <div style={{ position: 'absolute', bottom: -3, right: -3, width: 16, height: 16, borderRadius: 5, background: '#0A0A0A', border: '1.5px solid #F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.4rem', fontWeight: 900, color: '#F5F5F5' }}>BW</div>
          </div>
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: 2, lineHeight: 1 }}>
              <span style={{ background: '#F5F5F5', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>BLACKWOLF</span>
              <span style={{ color: '#fff', fontWeight: 600, letterSpacing: 1, marginLeft: 8 }}>ENJAMBRE</span>
            </div>
            <div style={{ fontSize: '0.65rem', color: '#555', marginTop: 2 }}>Centro de Operaciones IA</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', fontSize: '0.6rem', color: '#888' }}><Activity size={10} /> {events.length}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', fontSize: '0.6rem' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? '#22C55E' : '#EF4444' }} />
            <span style={{ color: connected ? '#22C55E' : '#EF4444' }}>{connected ? 'Online' : 'Offline'}</span>
          </div>
        </div>
      </motion.div>

      {/* KPIs */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 20 }}>
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.04 }}
            style={{ ...card, borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: kpi.color, fontFamily: "'JetBrains Mono', monospace" }}>{kpi.value}</div>
            <div style={{ fontSize: '0.5rem', color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginTop: 1 }}>{kpi.label}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* ═══ OFICINA — All agents by department ═══ */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Network size={14} color="#F5F5F5" />
          <div style={{ fontSize: '0.7rem', color: '#F5F5F5', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700 }}>Oficina</div>
          <div style={{ fontSize: '0.55rem', color: '#444', background: 'rgba(255,107,0,0.1)', padding: '2px 8px', borderRadius: 6 }}>{OFFICE_AGENTS.length} agentes</div>
        </div>

        {DEPTS.map((dept, di) => {
          const deptAgents = OFFICE_AGENTS.filter(a => a.dept === dept);
          if (deptAgents.length === 0) return null;
          return (
            <motion.div key={dept} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + di * 0.06 }}
              style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: '0.8rem' }}>{DEPT_EMOJIS[dept]}</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#888' }}>{dept}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                {deptAgents.map(agent => {
                  const Icon = agent.icon;
                  const online = getOnline(agent.id);
                  const evCount = getAgentEvents(agent.id).length;
                  return (
                    <motion.button key={agent.id} whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}
                      onClick={() => openAgent(agent)}
                      style={{ ...card, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = `${agent.color}40`; e.currentTarget.style.boxShadow = `0 4px 20px ${agent.color}15`; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.boxShadow = 'none'; }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${agent.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                        <Icon size={18} color={agent.color} />
                        <div style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '50%', background: online ? '#22C55E' : '#555', border: '2px solid #0A0A0A' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>{agent.label}</span>
                          {evCount > 0 && <span style={{ fontSize: '0.5rem', fontWeight: 700, color: agent.color, background: `${agent.color}15`, padding: '1px 5px', borderRadius: 4 }}>{evCount}</span>}
                        </div>
                        <div style={{ fontSize: '0.62rem', color: '#555', marginTop: 1 }}>{agent.role}</div>
                      </div>
                      <ChevronLeft size={14} color="#333" style={{ transform: 'rotate(180deg)', flexShrink: 0 }} />
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Recent Activity */}
      {events.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} style={{ ...card, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: '0.6rem', color: '#555', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700 }}>Actividad reciente</div>
            <button onClick={() => onNavigate('events')} style={{ background: 'none', border: 'none', color: '#F5F5F5', fontSize: '0.6rem', fontWeight: 600, cursor: 'pointer' }}>Ver todo</button>
          </div>
          {events.slice(0, 6).map((ev, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.65rem', fontFamily: "'JetBrains Mono', monospace" }}>
              <span style={{ color: '#333', minWidth: 42, flexShrink: 0 }}>{new Date(ev.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
              <span style={{ color: '#F5F5F5', fontWeight: 600, minWidth: 50, flexShrink: 0 }}>{ev.source_agent || 'sys'}</span>
              <span style={{ color: '#777', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.event_type || '—'}</span>
            </div>
          ))}
        </motion.div>
      )}

      {/* Floating chat */}
      {renderFloatingChat()}
    </div>
  );

  // ═══ FLOATING CHAT (shared) ═══
  function renderFloatingChat() {
    return (
      <>
        <AnimatePresence>
          {chatOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setChatOpen(false)}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000 }} />
              <motion.div initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                style={{ position: 'fixed', bottom: 24, right: 24, width: 400, maxWidth: 'calc(100vw - 48px)', maxHeight: '65vh', background: '#0D0D0D', border: '1px solid #1F1F1F', borderRadius: 18, display: 'flex', flexDirection: 'column', zIndex: 1001, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #1F1F1F', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ position: 'relative' }}>
                    <button onClick={() => setChatModeOpen(!chatModeOpen)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 10, background: chatMode === 'cerebro' ? 'rgba(245,245,245,0.08)' : 'rgba(16,185,129,0.12)', border: `1px solid ${chatMode === 'cerebro' ? '#F5F5F540' : '#10B98140'}`, cursor: 'pointer', color: chatMode === 'cerebro' ? '#F5F5F5' : '#10B981', fontSize: '0.75rem', fontWeight: 700 }}>
                      {chatMode === 'cerebro' ? <Brain size={14} /> : <Code2 size={14} />}
                      {chatMode === 'cerebro' ? 'Cerebro' : 'DevOps'}
                      <ChevronDown size={12} style={{ opacity: 0.6 }} />
                    </button>
                    {chatModeOpen && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#111', border: '1px solid #333', borderRadius: 10, overflow: 'hidden', zIndex: 10, minWidth: 150 }}>
                        <button onClick={() => switchMode('cerebro')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: chatMode === 'cerebro' ? 'rgba(245,245,245,0.06)' : 'transparent', border: 'none', color: '#ddd', fontSize: '0.75rem', cursor: 'pointer', width: '100%', textAlign: 'left' }}><Brain size={14} color="#F5F5F5" /> Cerebro IA</button>
                        <button onClick={() => switchMode('devops')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: chatMode === 'devops' ? 'rgba(16,185,129,0.08)' : 'transparent', border: 'none', color: '#ddd', fontSize: '0.75rem', cursor: 'pointer', width: '100%', textAlign: 'left' }}><Code2 size={14} color="#10B981" /> DevOps</button>
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => setChatOpen(false)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #333', borderRadius: 7, width: 24, height: 24, cursor: 'pointer', color: '#666', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {messages.map((m, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{ maxWidth: '85%', padding: '8px 12px', borderRadius: 12, background: m.role === 'user' ? (chatMode === 'cerebro' ? 'rgba(245,245,245,0.08)' : 'rgba(16,185,129,0.12)') : 'rgba(255,255,255,0.04)', border: `1px solid ${m.role === 'user' ? (chatMode === 'cerebro' ? '#F5F5F530' : '#10B98130') : 'rgba(255,255,255,0.06)'}`, color: '#ddd', fontSize: '0.78rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.content}</div>
                    </div>
                  ))}
                  {chatLoading && <div style={{ display: 'flex', gap: 3 }}>{[0,1,2].map(i => <motion.div key={i} animate={{ opacity: [0.3,1,0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i*0.2 }} style={{ width: 5, height: 5, borderRadius: '50%', background: chatMode === 'cerebro' ? '#F5F5F5' : '#10B981' }} />)}</div>}
                  <div ref={chatEndRef} />
                </div>
                <div style={{ padding: '10px 12px', borderTop: '1px solid #1F1F1F', display: 'flex', gap: 6 }}>
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder={chatMode === 'cerebro' ? 'Cerebro...' : 'DevOps...'} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid #333', borderRadius: 10, color: '#fff', padding: '9px 12px', fontSize: '0.8rem', outline: 'none' }} />
                  <button onClick={handleSend} disabled={chatLoading} style={{ background: chatMode === 'cerebro' ? '#F5F5F5' : 'linear-gradient(135deg, #10B981, #059669)', border: 'none', borderRadius: 10, width: 38, height: 38, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Send size={14} color="#000" />
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
        {!chatOpen && (
          <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.6, type: 'spring' }}
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setChatOpen(true)}
            style={{ position: 'fixed', bottom: 24, right: 24, width: 52, height: 52, borderRadius: 16, background: chatMode === 'cerebro' ? '#F5F5F5' : 'linear-gradient(135deg, #10B981, #059669)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 28px ${chatMode === 'cerebro' ? 'rgba(245,245,245,0.15)' : 'rgba(16,185,129,0.3)'}`, zIndex: 999 }}>
            {chatMode === 'cerebro' ? <Brain size={22} color="#000" /> : <Code2 size={22} color="#000" />}
          </motion.button>
        )}
      </>
    );
  }
}
