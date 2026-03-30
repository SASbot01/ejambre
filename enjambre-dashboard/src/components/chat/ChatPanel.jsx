import React, { useState, useRef, useEffect } from 'react';
import { sendChat } from '../../services/api.js';
import { Send, Bot, Zap } from 'lucide-react';

const QUICK_ACTIONS = [
  'Resumen general del enjambre',
  'Amenazas activas en el SOC',
  'Pipeline de leads hoy',
  'Resumen de ventas del mes',
  'Cruce: leads sospechosos con amenazas',
];

export default function ChatPanel() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Cerebro del Enjambre activo. Tengo acceso a los agentes CIBER, CRM y OPS. Que necesitas?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const msg = input.trim();
    if (!msg || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setLoading(true);

    try {
      const result = await sendChat(msg);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: result.response,
          actions: result.actions,
          agents: result.agents_used,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message}` },
      ]);
    }

    setLoading(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="chat-panel">
      <div className="event-stream-header">
        <div className="card-title">
          <Bot size={14} />
          Cerebro del Enjambre
        </div>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'var(--success)', animation: 'pulse 2s infinite',
        }} />
      </div>

      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg ${msg.role}`}>
            {msg.content}
            {msg.actions?.length > 0 && (
              <div className="chat-msg-meta">
                {msg.agents?.map((a) => (
                  <span key={a} className="meta-badge">{a}</span>
                ))}
                <span>
                  <Zap size={10} style={{ display: 'inline', verticalAlign: 'middle' }} />
                  {' '}{msg.actions.length} acciones
                </span>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="chat-msg assistant">
            <div className="typing-indicator">
              <div className="dot" />
              <div className="dot" />
              <div className="dot" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {messages.length <= 1 && (
        <div className="chat-quick-actions">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action}
              className="quick-action-btn"
              onClick={() => { setInput(action); }}
            >
              {action}
            </button>
          ))}
        </div>
      )}

      <div className="chat-input-area">
        <textarea
          className="chat-input"
          rows={1}
          placeholder="Pregunta al Cerebro del Enjambre..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button className="chat-send" onClick={handleSend} disabled={loading || !input.trim()}>
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
