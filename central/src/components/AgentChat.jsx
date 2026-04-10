import { useState, useRef, useEffect, useCallback } from 'react'
import { useClient } from '../contexts/ClientContext'
import { useClientData } from '../hooks/useClientData'
import { AgentChatContext } from '../contexts/AgentChatContext'
import AgentChatBody from './AgentChatBody'

const API_URL = import.meta.env.VITE_API_URL || ''

function buildGreeting(clientName, en) {
  if (en) {
    return `Hi, I'm the analytics agent for **${clientName}**. I have access to **all** dashboard data:

- Sales (current + previous month + history)
- Setter and closer reports
- Projections and targets
- Estimated commissions
- Payment methods and fees

Ask me anything.`
  }
  return `Hola, soy el agente de analítica de **${clientName}**. Tengo acceso a **todos** los datos del dashboard:

- Ventas (actual + mes anterior + histórico)
- Reportes de setters y closers
- Proyecciones y targets
- Comisiones estimadas
- Métodos de pago y fees

Pregúntame lo que necesites.`
}

export default function AgentChat({ children }) {
  const { clientSlug, clientConfig } = useClient()
  const clientName = clientConfig?.name || 'Dashboard'
  const en = clientSlug === 'black-wolf'
  const greeting = buildGreeting(clientName, en)

  const {
    getAgentConversations, addAgentConversation, updateAgentConversation,
    deleteAgentConversation, getAgentMessages, addAgentMessage,
  } = useClientData()

  const [panelOpen, setPanelOpen] = useState(false)
  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [messages, setMessages] = useState([{ role: 'assistant', content: greeting }])
  const [loading, setLoading] = useState(false)
  const [showList, setShowList] = useState(true)
  const [convsLoaded, setConvsLoaded] = useState(false)
  const inputRef = useRef(null)

  // Load conversations on first open
  useEffect(() => {
    if (panelOpen && !convsLoaded) {
      getAgentConversations().then(convs => {
        setConversations(convs)
        setConvsLoaded(true)
      }).catch(() => setConvsLoaded(true))
    }
  }, [panelOpen, convsLoaded])

  // Focus input when entering chat view
  useEffect(() => {
    if (panelOpen && !showList && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [panelOpen, showList, activeConversationId])

  const refreshConversations = useCallback(async () => {
    try {
      const convs = await getAgentConversations()
      setConversations(convs)
    } catch {}
  }, [getAgentConversations])

  const openConversation = useCallback(async (id) => {
    setActiveConversationId(id)
    setShowList(false)
    setMessages([{ role: 'assistant', content: greeting }])
    try {
      const msgs = await getAgentMessages(id)
      if (msgs.length > 0) {
        setMessages([{ role: 'assistant', content: greeting }, ...msgs.map(m => ({ role: m.role, content: m.content }))])
      }
    } catch {}
  }, [getAgentMessages, greeting])

  const createConversation = useCallback(async () => {
    try {
      const conv = await addAgentConversation({ title: en ? 'New conversation' : 'Nueva conversación' })
      setConversations(prev => [conv, ...prev])
      setActiveConversationId(conv.id)
      setMessages([{ role: 'assistant', content: greeting }])
      setShowList(false)
      return conv
    } catch { return null }
  }, [addAgentConversation, greeting, en])

  const createConversationWithContext = useCallback(async (context, title) => {
    try {
      const conv = await addAgentConversation({
        title: title || (en ? 'Constraint Analysis' : 'Análisis de Constraints'),
        context,
      })
      setConversations(prev => [conv, ...prev])
      setActiveConversationId(conv.id)
      setMessages([{ role: 'assistant', content: greeting }])
      setShowList(false)
      setPanelOpen(true)
      return conv
    } catch { return null }
  }, [addAgentConversation, greeting, en])

  const handleDeleteConversation = useCallback(async (id) => {
    try {
      await deleteAgentConversation(id)
      setConversations(prev => prev.filter(c => c.id !== id))
      if (activeConversationId === id) {
        setActiveConversationId(null)
        setMessages([{ role: 'assistant', content: greeting }])
        setShowList(true)
      }
    } catch {}
  }, [deleteAgentConversation, activeConversationId, greeting])

  const sendMessage = useCallback(async (question) => {
    if (!question.trim() || loading) return
    const q = question.trim()

    // Ensure we have a conversation
    let convId = activeConversationId
    if (!convId) {
      const conv = await createConversation()
      if (!conv) return
      convId = conv.id
    }

    // Add user message to UI
    const userMsg = { role: 'user', content: q }
    setMessages(prev => [...prev, userMsg, { role: 'assistant', content: en ? 'Analyzing data...' : 'Analizando datos...', streaming: true }])
    setLoading(true)

    // Save user message to DB
    try { await addAgentMessage({ conversationId: convId, role: 'user', content: q }) } catch {}

    // Auto-title on first message
    const conv = conversations.find(c => c.id === convId)
    if (conv && (conv.title === 'Nueva conversación' || conv.title === 'New conversation')) {
      const newTitle = q.slice(0, 60)
      updateAgentConversation(convId, { title: newTitle }).then(() => {
        setConversations(prev => prev.map(c => c.id === convId ? { ...c, title: newTitle } : c))
      }).catch(() => {})
    }

    try {
      // Build history (skip greeting and streaming messages)
      const history = messages
        .filter(m => !m.streaming)
        .slice(1) // skip greeting
        .map(m => ({ role: m.role, content: m.content }))

      const response = await fetch(`${API_URL}/api/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, history, clientSlug, conversationId: convId }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Server error' }))
        throw new Error(err.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      const answer = data.answer || (en ? 'No response.' : 'Sin respuesta.')

      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: answer }
        return updated
      })

      // Save assistant message to DB
      try { await addAgentMessage({ conversationId: convId, role: 'assistant', content: answer }) } catch {}

      // Bump conversation updated_at
      updateAgentConversation(convId, { updatedAt: new Date().toISOString() }).catch(() => {})
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: `Error: ${err.message}` }
        return updated
      })
    } finally {
      setLoading(false)
    }
  }, [loading, activeConversationId, messages, conversations, clientSlug, en, createConversation, addAgentMessage, updateAgentConversation])

  const openChat = useCallback(() => {
    setPanelOpen(true)
  }, [])

  const closeChat = useCallback(() => {
    setPanelOpen(false)
  }, [])

  const ctxValue = {
    conversations, activeConversationId, messages, loading, panelOpen,
    openChat, closeChat, openConversation, createConversation,
    createConversationWithContext, sendMessage, deleteConversation: handleDeleteConversation,
    refreshConversations, en, greeting, clientName,
  }

  const fmtDate = (d) => {
    if (!d) return ''
    const date = new Date(d)
    const now = new Date()
    const diff = now - date
    if (diff < 86400000) return date.toLocaleTimeString(en ? 'en-US' : 'es-ES', { hour: '2-digit', minute: '2-digit' })
    if (diff < 604800000) return date.toLocaleDateString(en ? 'en-US' : 'es-ES', { weekday: 'short' })
    return date.toLocaleDateString(en ? 'en-US' : 'es-ES', { day: '2-digit', month: 'short' })
  }

  return (
    <AgentChatContext.Provider value={ctxValue}>
      {children}

      {/* FAB Button */}
      <button className="agent-fab" onClick={() => setPanelOpen(!panelOpen)} title={en ? 'AI Agent' : 'Agente IA'}>
        {panelOpen ? '✕' : '🤖'}
      </button>

      {/* Panel */}
      {panelOpen && (
        <div className="agent-panel">
          <div className="agent-header">
            <div className="agent-header-info">
              {!showList && (
                <button className="agent-back-btn" onClick={() => { setShowList(true); setActiveConversationId(null) }}>
                  ←
                </button>
              )}
              <span className="agent-header-icon">🤖</span>
              <div>
                <div className="agent-header-title">{en ? 'AI Agent' : 'Agente IA'}</div>
                <div className="agent-header-sub">{showList ? (en ? `${conversations.length} conversations` : `${conversations.length} conversaciones`) : clientName}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {!showList && (
                <button className="agent-close" onClick={() => { setShowList(true); setActiveConversationId(null) }} title={en ? 'Conversations' : 'Conversaciones'} style={{ fontSize: '0.75rem' }}>
                  💬
                </button>
              )}
              <button className="agent-close" onClick={closeChat}>✕</button>
            </div>
          </div>

          {showList ? (
            /* Conversation List */
            <div className="agent-conversation-list">
              <button className="agent-new-conv-btn" onClick={async () => { const c = await createConversation(); if (c) setShowList(false) }}>
                + {en ? 'New conversation' : 'Nueva conversación'}
              </button>
              {conversations.length === 0 && convsLoaded && (
                <div className="agent-empty-state">
                  {en ? 'No conversations yet. Start one!' : 'Sin conversaciones. Crea una.'}
                </div>
              )}
              {conversations.map(c => (
                <div key={c.id} className={`agent-conversation-item ${activeConversationId === c.id ? 'agent-conversation-item--active' : ''}`}>
                  <button className="agent-conversation-item__main" onClick={() => openConversation(c.id)}>
                    <span className="agent-conversation-item__title">{c.title}</span>
                    <span className="agent-conversation-item__date">{fmtDate(c.updatedAt || c.created_at)}</span>
                  </button>
                  <button className="agent-conversation-item__delete" onClick={(e) => { e.stopPropagation(); handleDeleteConversation(c.id) }} title={en ? 'Delete' : 'Eliminar'}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : (
            /* Chat View */
            <AgentChatBody
              messages={messages}
              onSend={sendMessage}
              loading={loading}
              clientName={clientName}
              en={en}
              inputRef={inputRef}
            />
          )}
        </div>
      )}
    </AgentChatContext.Provider>
  )
}
