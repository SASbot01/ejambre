import React, { useState, useEffect, useRef } from 'react';
import { Code2, Play, Square, Clock, Send, CheckCircle, AlertCircle, Loader, GitBranch, Terminal, Activity } from 'lucide-react';

const API_BASE = '/api';
function getToken() { return localStorage.getItem('enjambre_token'); }
function authHeaders() { return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }; }

// Persist timer state across navigation
function loadDevState() {
  try {
    const raw = localStorage.getItem('dev_agent_state');
    if (!raw) return null;
    const state = JSON.parse(raw);
    // Check if session is still valid (end time in future)
    if (state.endTime && state.endTime > Date.now()) return state;
    // Expired — clean up
    localStorage.removeItem('dev_agent_state');
    return null;
  } catch { return null; }
}

function saveDevState(endTime, hours, sessionId) {
  localStorage.setItem('dev_agent_state', JSON.stringify({ endTime, hours, sessionId }));
}

function clearDevState() {
  localStorage.removeItem('dev_agent_state');
}

export default function DevAgent({ events = [] }) {
  const [tickets, setTickets] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Dev Agent listo. Tengo acceso a los repos de Enjambre, SOC y Dashboard-Ops. Puedo analizar, optimizar y deployar. ¿Que necesitas?' },
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const [timerHours, setTimerHours] = useState(2);
  const [timerActive, setTimerActive] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [agentStatus, setAgentStatus] = useState('idle');
  const chatEndRef = useRef(null);

  // Restore timer state on mount
  useEffect(() => {
    const saved = loadDevState();
    if (saved) {
      const remaining = Math.round((saved.endTime - Date.now()) / 1000);
      if (remaining > 0) {
        setTimerActive(true);
        setTimerRemaining(remaining);
        setTimerHours(saved.hours);
        setAgentStatus('working');
        setActiveSession({ id: saved.sessionId });
      }
    }
  }, []);

  // Load tickets and sessions
  useEffect(() => {
    fetch(`${API_BASE}/dev/tickets`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : []).then(setTickets).catch(() => {});
    fetch(`${API_BASE}/dev/sessions`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : []).then(setSessions).catch(() => {});
  }, []);

  // Timer countdown
  useEffect(() => {
    if (!timerActive || timerRemaining <= 0) return;
    const iv = setInterval(() => {
      setTimerRemaining(prev => {
        if (prev <= 1) {
          setTimerActive(false);
          setAgentStatus('idle');
          clearDevState();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [timerActive, timerRemaining]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  function formatTime(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  }

  async function startSession() {
    const totalSecs = timerHours * 3600;
    const endTime = Date.now() + totalSecs * 1000;
    setTimerActive(true);
    setTimerRemaining(totalSecs);
    setAgentStatus('working');

    try {
      const res = await fetch(`${API_BASE}/dev/sessions`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ duration_hours: timerHours }),
      });
      if (res.ok) {
        const session = await res.json();
        setActiveSession(session);
        setSessions(prev => [session, ...prev]);
        saveDevState(endTime, timerHours, session.id);
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `Sesion de ${timerHours}h iniciada. Empiezo a analizar los 3 proyectos (Enjambre, SOC, Dashboard-Ops). Voy reportando lo que encuentre y optimice.`
        }]);
      }
    } catch {}
  }

  function stopSession() {
    setTimerActive(false);
    setTimerRemaining(0);
    setAgentStatus('idle');
    setActiveSession(null);
    clearDevState();
    setChatMessages(prev => [...prev, {
      role: 'assistant',
      content: 'Sesion detenida. Revisa los tickets para ver lo que complete.'
    }]);
  }

  async function handleSendChat() {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: msg }]);
    setChatLoading(true);

    try {
      const res = await fetch(`${API_BASE}/dev/chat`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ message: msg, session_id: activeSession?.id || 'default' }),
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response || data.error || 'Sin respuesta',
        tickets_created: data.tickets_created,
      }]);
      // Refresh tickets
      if (data.tickets_created?.length) {
        fetch(`${API_BASE}/dev/tickets`, { headers: authHeaders() })
          .then(r => r.ok ? r.json() : []).then(setTickets).catch(() => {});
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    }
    setChatLoading(false);
  }

  const devEvents = events.filter(e => e.source_agent === 'developer' || e.event_type?.startsWith('dev.'));

  return (
    <div>
      <h2 className="page-title">
        <Code2 size={22} style={{ color: '#10B981' }} />
        <span className="title-gradient">Dev Agent</span>
        <span style={{
          marginLeft: 12, padding: '4px 12px', borderRadius: 100, fontSize: '0.7rem', fontWeight: 700,
          background: agentStatus === 'working' ? 'rgba(16,185,129,0.15)' : 'rgba(85,85,85,0.15)',
          color: agentStatus === 'working' ? '#10B981' : '#555',
        }}>
          {agentStatus === 'working' ? 'TRABAJANDO' : 'IDLE'}
        </span>
      </h2>

      {/* Timer Control */}
      <div className="info-card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={16} style={{ color: 'var(--orange)' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Duracion:</span>
            <select
              value={timerHours}
              onChange={e => setTimerHours(Number(e.target.value))}
              disabled={timerActive}
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '6px 12px', color: 'var(--text)', fontSize: '0.85rem',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <option value={0.5}>30 min</option>
              <option value={1}>1 hora</option>
              <option value={2}>2 horas</option>
              <option value={4}>4 horas</option>
              <option value={8}>8 horas</option>
            </select>
          </div>

          {!timerActive ? (
            <button onClick={startSession} className="btn-primary" style={{ padding: '8px 20px', fontSize: '0.85rem' }}>
              <Play size={14} /> Activar Dev Agent
            </button>
          ) : (
            <button onClick={stopSession} className="btn-secondary" style={{ padding: '8px 20px', fontSize: '0.85rem', borderColor: '#EF4444', color: '#EF4444' }}>
              <Square size={14} /> Detener
            </button>
          )}

          {timerActive && (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 700,
              color: timerRemaining < 300 ? '#EF4444' : '#10B981',
            }}>
              {formatTime(timerRemaining)}
            </div>
          )}
        </div>

        {timerActive && (
          <div style={{ marginTop: 12 }}>
            <div className="progress-bar">
              <div className="fill" style={{ width: `${(1 - timerRemaining / (timerHours * 3600)) * 100}%`, background: 'linear-gradient(90deg, #10B981, #34D399)' }} />
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Chat with Dev Agent */}
        <div className="chat-panel" style={{ height: 520 }}>
          <div className="event-stream-header">
            <div className="card-title">
              <Terminal size={14} />
              Chat con Dev Agent
            </div>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: agentStatus === 'working' ? '#10B981' : '#555', animation: agentStatus === 'working' ? 'pulse 2s infinite' : 'none' }} />
          </div>

          <div className="chat-messages">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`chat-msg ${msg.role}`}>
                {msg.content}
                {msg.tickets_created?.length > 0 && (
                  <div className="chat-msg-meta">
                    <span className="meta-badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>
                      {msg.tickets_created.length} ticket(s) creados
                    </span>
                  </div>
                )}
              </div>
            ))}
            {chatLoading && (
              <div className="chat-msg assistant">
                <div className="typing-indicator">
                  <div className="dot" style={{ background: '#10B981' }} />
                  <div className="dot" style={{ background: '#10B981' }} />
                  <div className="dot" style={{ background: '#10B981' }} />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="chat-input-area">
            <textarea
              className="chat-input"
              rows={1}
              placeholder="Habla con el Dev Agent..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
              disabled={chatLoading}
            />
            <button className="chat-send" onClick={handleSendChat} disabled={chatLoading || !chatInput.trim()}
              style={{ background: 'linear-gradient(135deg, #10B981, #34D399)' }}>
              <Send size={18} />
            </button>
          </div>
        </div>

        {/* Tickets */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 16 }}>
              <GitBranch size={14} />
              Tickets del Dev Agent ({tickets.length})
            </div>
            <div style={{ maxHeight: 470, overflowY: 'auto' }}>
              {tickets.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: 24 }}>
                  Sin tickets aun. Activa el agente o pidele algo.
                </p>
              ) : (
                tickets.map((ticket, i) => (
                  <div key={ticket.id || i} style={{
                    padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    display: 'flex', flexDirection: 'column', gap: 6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {ticket.status === 'done' ? (
                        <CheckCircle size={14} style={{ color: '#10B981', flexShrink: 0 }} />
                      ) : ticket.status === 'error' ? (
                        <AlertCircle size={14} style={{ color: '#EF4444', flexShrink: 0 }} />
                      ) : (
                        <Loader size={14} style={{ color: '#FFB800', flexShrink: 0, animation: 'spin 2s linear infinite' }} />
                      )}
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{ticket.title}</span>
                      <span style={{
                        marginLeft: 'auto', padding: '2px 8px', borderRadius: 100,
                        fontSize: '0.65rem', fontWeight: 700,
                        background: ticket.project === 'enjambre' ? 'rgba(255,107,0,0.12)' : ticket.project === 'soc' ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)',
                        color: ticket.project === 'enjambre' ? '#FF6B00' : ticket.project === 'soc' ? '#EF4444' : '#3B82F6',
                      }}>
                        {ticket.project || 'general'}
                      </span>
                    </div>
                    {ticket.description && (
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                        {ticket.description}
                      </p>
                    )}
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      {ticket.created_at ? new Date(ticket.created_at).toLocaleString('es-ES') : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent dev events */}
          {devEvents.length > 0 && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}>
                <Activity size={14} />
                Actividad reciente
              </div>
              {devEvents.slice(0, 8).map((ev, i) => (
                <div key={i} style={{
                  padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)',
                  fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', gap: 8,
                }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', minWidth: 55 }}>
                    {new Date(ev.timestamp || Date.now()).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span>{ev.event_type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
