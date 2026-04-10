import { useState, useEffect, useContext, useRef } from 'react'
import { ClientContext } from '../../contexts/ClientContext'
import { supabase } from '../../utils/supabase'

const CHANNEL_TYPES = [
  { key: 'general', emoji: '💬', label: 'General' },
  { key: 'anuncios', emoji: '📢', label: 'Anuncios' },
  { key: 'dudas', emoji: '❓', label: 'Dudas' },
  { key: 'logros', emoji: '🏆', label: 'Logros' },
  { key: 'recursos', emoji: '📚', label: 'Recursos' },
  { key: 'off-topic', emoji: '🎲', label: 'Off Topic' },
]

export default function ComunidadHome() {
  const { clientId, clientConfig, userMember } = useContext(ClientContext)
  const [channels, setChannels] = useState([])
  const [activeChannel, setActiveChannel] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [newChannel, setNewChannel] = useState({ name: '', type: 'general', description: '' })
  const [pinnedMessages, setPinnedMessages] = useState([])
  const [showPinned, setShowPinned] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [members, setMembers] = useState([])
  const messagesEndRef = useRef(null)

  const color = clientConfig?.primaryColor || '#3B82F6'
  const userName = userMember?.name || 'Admin'

  useEffect(() => { if (clientId) loadChannels() }, [clientId])
  useEffect(() => { if (activeChannel) loadMessages() }, [activeChannel])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Real-time subscription
  useEffect(() => {
    if (!activeChannel) return
    const sub = supabase.channel(`comunidad-${activeChannel.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comunidad_messages', filter: `channel_id=eq.${activeChannel.id}` },
        payload => { setMessages(prev => [...prev, payload.new]) })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [activeChannel])

  async function loadChannels() {
    setLoading(true)
    const { data } = await supabase.from('comunidad_channels').select('*').eq('client_id', clientId).order('position', { ascending: true })
    const ch = data || []
    setChannels(ch)
    if (ch.length > 0 && !activeChannel) setActiveChannel(ch[0])
    setLoading(false)
  }

  async function loadMessages() {
    if (!activeChannel) return
    const { data } = await supabase.from('comunidad_messages').select('*').eq('channel_id', activeChannel.id).order('created_at', { ascending: true }).limit(100)
    setMessages(data || [])
    setPinnedMessages((data || []).filter(m => m.pinned))
  }

  async function sendMessage() {
    if (!input.trim() || !activeChannel) return
    const text = input.trim()
    setInput('')
    await supabase.from('comunidad_messages').insert({
      channel_id: activeChannel.id, client_id: clientId,
      author_name: userName, content: text,
      is_announcement: activeChannel.type === 'anuncios',
    })
  }

  async function createChannel() {
    if (!newChannel.name.trim()) return
    await supabase.from('comunidad_channels').insert({
      client_id: clientId, name: newChannel.name,
      type: newChannel.type, description: newChannel.description,
      position: channels.length,
    })
    setNewChannel({ name: '', type: 'general', description: '' })
    setShowNewChannel(false)
    loadChannels()
  }

  async function deleteChannel(id) {
    if (!confirm('Eliminar este canal y todos sus mensajes?')) return
    await supabase.from('comunidad_messages').delete().eq('channel_id', id)
    await supabase.from('comunidad_channels').delete().eq('id', id)
    if (activeChannel?.id === id) setActiveChannel(null)
    loadChannels()
  }

  async function togglePin(msg) {
    await supabase.from('comunidad_messages').update({ pinned: !msg.pinned }).eq('id', msg.id)
    loadMessages()
  }

  async function deleteMessage(id) {
    await supabase.from('comunidad_messages').delete().eq('id', id)
    setMessages(prev => prev.filter(m => m.id !== id))
  }

  async function loadMembers() {
    const { data } = await supabase.from('team_members').select('id, name, email, role, active').eq('client_id', clientId).eq('active', true)
    setMembers(data || [])
    setShowMembers(true)
  }

  function formatTime(ts) {
    if (!ts) return ''
    const d = new Date(ts)
    const today = new Date()
    if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>Cargando comunidad...</div>

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 140px)', gap: 0, borderRadius: 16, overflow: 'hidden', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
      {/* Sidebar - Channels */}
      <div style={{ width: 220, background: 'rgba(0,0,0,0.3)', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', marginBottom: 2 }}>Comunidad</div>
          <div style={{ fontSize: '0.6rem', color: '#555' }}>{clientConfig?.name || 'Growth'}</div>
        </div>

        {/* Channel list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
          {channels.map(ch => {
            const type = CHANNEL_TYPES.find(t => t.key === ch.type) || CHANNEL_TYPES[0]
            const isActive = activeChannel?.id === ch.id
            return (
              <div key={ch.id} onClick={() => setActiveChannel(ch)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 2,
                  background: isActive ? `${color}15` : 'transparent', color: isActive ? '#fff' : '#888', transition: 'all 0.15s' }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                <span style={{ fontSize: '0.8rem' }}>{type.emoji}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: isActive ? 600 : 400, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</span>
                {isActive && (
                  <button onClick={e => { e.stopPropagation(); deleteChannel(ch.id) }}
                    style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: '0.6rem', padding: 0 }}>✕</button>
                )}
              </div>
            )
          })}
        </div>

        {/* New channel */}
        <div style={{ padding: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {showNewChannel ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input value={newChannel.name} onChange={e => setNewChannel({ ...newChannel, name: e.target.value })} placeholder="Nombre del canal"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #1F1F1F', borderRadius: 6, color: '#fff', padding: '6px 8px', fontSize: '0.7rem', outline: 'none' }} />
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {CHANNEL_TYPES.map(t => (
                  <button key={t.key} onClick={() => setNewChannel({ ...newChannel, type: t.key })}
                    style={{ background: newChannel.type === t.key ? `${color}15` : 'transparent', border: `1px solid ${newChannel.type === t.key ? `${color}30` : '#1a1a1a'}`, borderRadius: 4, color: newChannel.type === t.key ? color : '#555', padding: '2px 5px', cursor: 'pointer', fontSize: '0.55rem' }}>
                    {t.emoji}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={createChannel} style={{ flex: 1, background: `${color}20`, border: `1px solid ${color}40`, borderRadius: 6, color, padding: '5px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 600 }}>Crear</button>
                <button onClick={() => setShowNewChannel(false)} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1F1F1F', borderRadius: 6, color: '#666', padding: '5px 8px', cursor: 'pointer', fontSize: '0.65rem' }}>✕</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowNewChannel(true)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid #1F1F1F', borderRadius: 8, color: '#666', padding: '7px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 500 }}>
              + Nuevo Canal
            </button>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {activeChannel ? (
          <>
            {/* Channel header */}
            <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '0.9rem' }}>{(CHANNEL_TYPES.find(t => t.key === activeChannel.type) || CHANNEL_TYPES[0]).emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>{activeChannel.name}</div>
                {activeChannel.description && <div style={{ fontSize: '0.6rem', color: '#555' }}>{activeChannel.description}</div>}
              </div>
              <button onClick={() => { setShowPinned(!showPinned); setShowMembers(false) }}
                style={{ background: showPinned ? `${color}15` : 'transparent', border: `1px solid ${showPinned ? `${color}30` : '#1F1F1F'}`, borderRadius: 6, color: showPinned ? color : '#666', padding: '4px 8px', cursor: 'pointer', fontSize: '0.65rem' }}>
                📌 {pinnedMessages.length}
              </button>
              <button onClick={() => { loadMembers(); setShowPinned(false) }}
                style={{ background: showMembers ? `${color}15` : 'transparent', border: `1px solid ${showMembers ? `${color}30` : '#1F1F1F'}`, borderRadius: 6, color: showMembers ? color : '#666', padding: '4px 8px', cursor: 'pointer', fontSize: '0.65rem' }}>
                👥
              </button>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#444' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>💬</div>
                    <div style={{ fontSize: '0.75rem' }}>Sé el primero en escribir en #{activeChannel.name}</div>
                  </div>
                ) : messages.map(msg => (
                  <div key={msg.id} style={{ padding: '8px 12px', borderRadius: 10, background: msg.is_announcement ? `${color}08` : 'transparent', borderLeft: msg.is_announcement ? `3px solid ${color}` : 'none', transition: 'background 0.15s' }}
                    onMouseEnter={e => { if (!msg.is_announcement) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                    onMouseLeave={e => { if (!msg.is_announcement) e.currentTarget.style.background = 'transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 6, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color }}>
                        {(msg.author_name || '?')[0].toUpperCase()}
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: color }}>{msg.author_name}</span>
                      <span style={{ fontSize: '0.6rem', color: '#444' }}>{formatTime(msg.created_at)}</span>
                      {msg.pinned && <span style={{ fontSize: '0.55rem', color: '#FFB800' }}>📌</span>}
                      {msg.is_announcement && <span style={{ fontSize: '0.55rem', background: `${color}20`, color, padding: '1px 5px', borderRadius: 4 }}>Anuncio</span>}
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 3, opacity: 0.4 }}
                        onMouseEnter={e => e.currentTarget.style.opacity = 1}
                        onMouseLeave={e => e.currentTarget.style.opacity = 0.4}>
                        <button onClick={() => togglePin(msg)} style={{ background: 'transparent', border: 'none', color: msg.pinned ? '#FFB800' : '#555', cursor: 'pointer', fontSize: '0.6rem', padding: '2px' }}>📌</button>
                        <button onClick={() => deleteMessage(msg.id)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '0.6rem', padding: '2px' }}>🗑️</button>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#ccc', lineHeight: 1.5, paddingLeft: 32, whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Side panels */}
              {(showPinned || showMembers) && (
                <div style={{ width: 220, borderLeft: '1px solid rgba(255,255,255,0.05)', overflowY: 'auto', padding: '12px' }}>
                  {showPinned && (
                    <>
                      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#fff', marginBottom: 10 }}>📌 Mensajes Fijados</div>
                      {pinnedMessages.length === 0 ? (
                        <div style={{ fontSize: '0.65rem', color: '#444' }}>Sin mensajes fijados</div>
                      ) : pinnedMessages.map(msg => (
                        <div key={msg.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px', marginBottom: 6 }}>
                          <div style={{ fontSize: '0.65rem', fontWeight: 600, color: color, marginBottom: 2 }}>{msg.author_name}</div>
                          <div style={{ fontSize: '0.7rem', color: '#aaa', lineHeight: 1.4 }}>{msg.content.slice(0, 100)}</div>
                        </div>
                      ))}
                    </>
                  )}
                  {showMembers && (
                    <>
                      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#fff', marginBottom: 10 }}>👥 Miembros ({members.length})</div>
                      {members.map(m => (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
                          <div style={{ width: 22, height: 22, borderRadius: 6, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 700, color }}>{m.name[0]}</div>
                          <div>
                            <div style={{ fontSize: '0.7rem', color: '#ccc', fontWeight: 500 }}>{m.name}</div>
                            <div style={{ fontSize: '0.55rem', color: '#555' }}>{m.role}</div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Message input */}
            <div style={{ padding: '10px 18px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  placeholder={`Escribe en #${activeChannel.name}...`}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid #1F1F1F', borderRadius: 10, color: '#fff', padding: '10px 14px', fontSize: '0.82rem', outline: 'none' }} />
                <button onClick={sendMessage} disabled={!input.trim()}
                  style={{ background: input.trim() ? `linear-gradient(135deg, ${color}, ${color}CC)` : '#222', border: 'none', borderRadius: 10, width: 40, height: 40, cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.9rem', flexShrink: 0 }}>
                  →
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: '2rem' }}>💬</span>
            <span style={{ fontSize: '0.85rem', color: '#555' }}>Crea o selecciona un canal</span>
          </div>
        )}
      </div>
    </div>
  )
}
