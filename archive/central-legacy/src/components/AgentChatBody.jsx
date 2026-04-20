import { useRef, useEffect } from 'react'

const QUICK_QUESTIONS_ES = [
  'Resumen general del mes',
  'Mejor closer este mes',
  'Rendimiento de setters',
  'Proyecciones vs actual',
  'Comisiones estimadas',
  'Ventas por producto',
]

const QUICK_QUESTIONS_EN = [
  'Monthly overview',
  'Best closer this month',
  'Setter performance',
  'Projections vs actual',
  'Estimated commissions',
  'Sales by product',
]

export default function AgentChatBody({ messages, onSend, loading, compact, clientName, en, inputRef: externalInputRef }) {
  const messagesEndRef = useRef(null)
  const localInputRef = useRef(null)
  const inputRef = externalInputRef || localInputRef

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const QUICK_QUESTIONS = en ? QUICK_QUESTIONS_EN : QUICK_QUESTIONS_ES
  const showQuickQuestions = messages.length <= 1 && !loading

  function handleSubmit(e) {
    e.preventDefault()
    const val = inputRef.current?.value?.trim()
    if (!val || loading) return
    inputRef.current.value = ''
    onSend(val)
  }

  return (
    <div className={`agent-chat-body ${compact ? 'agent-chat-body--compact' : ''}`}>
      <div className="agent-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`agent-msg agent-msg--${msg.role}`}>
            {msg.role === 'assistant' && <span className="agent-msg-avatar">🤖</span>}
            <div className={`agent-msg-bubble agent-msg-bubble--${msg.role}`}>
              {msg.content || (msg.streaming ? '...' : '')}
            </div>
          </div>
        ))}

        {showQuickQuestions && (
          <div className="agent-quick-questions">
            {QUICK_QUESTIONS.map(q => (
              <button key={q} className="agent-quick-btn" onClick={() => onSend(q)}>
                {q}
              </button>
            ))}
          </div>
        )}

        {loading && messages[messages.length - 1]?.streaming && (
          <div className="agent-typing">
            <span /><span /><span />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="agent-input-bar" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          className="agent-input"
          placeholder={en ? 'Ask anything...' : 'Pregunta lo que quieras...'}
          disabled={loading}
        />
        <button type="submit" className="agent-send" disabled={loading}>
          ➤
        </button>
      </form>
    </div>
  )
}
