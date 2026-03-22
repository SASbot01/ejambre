import React, { useState, useRef, useEffect } from 'react';
import { sendChat } from '../../services/api.js';
import { Send, Bot, User } from 'lucide-react';

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
      content: 'Cerebro del Enjambre activo. Tengo acceso a los agentes CIBER, CRM y OPS. ¿Qué necesitas?',
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
          <Bot size={14} style={{ display: 'inline', marginRight: 8 }} />
          Cerebro del Enjambre
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg ${msg.role}`}>
            {msg.content}
            {msg.actions?.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 11, opacity: 0.7 }}>
                Agentes: {msg.agents?.join(', ')} | {msg.actions.length} acciones ejecutadas
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="chat-msg assistant">
            <span className="loading-dots">Procesando</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {messages.length <= 1 && (
        <div style={{ padding: '0 16px 8px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action}
              onClick={() => { setInput(action); }}
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                borderRadius: 20,
                padding: '6px 12px',
                color: 'var(--text-secondary)',
                fontSize: 12,
                cursor: 'pointer',
              }}
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
