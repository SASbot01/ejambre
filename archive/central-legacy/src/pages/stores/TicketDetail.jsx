import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useClient } from '../../contexts/ClientContext'
import { useClientData } from '../../hooks/useClientData'
import { useAsync } from '../../hooks/useAsync'

const STATUS_LABELS = {
  open: 'Abierto',
  in_progress: 'En Progreso',
  waiting_client: 'Esperando Cliente',
  waiting_gestor: 'Esperando Gestor',
  resolved: 'Resuelto',
  closed: 'Cerrado',
}

const STATUS_COLORS = {
  open: '#3b82f6',
  in_progress: '#f97316',
  waiting_client: '#eab308',
  waiting_gestor: '#a855f7',
  resolved: '#22c55e',
  closed: '#6b7280',
}

const PRIORITY_LABELS = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' }
const PRIORITY_COLORS = { low: '#6b7280', medium: '#3b82f6', high: '#f97316', urgent: '#ef4444' }

const STATUS_OPTIONS = ['open', 'in_progress', 'waiting_client', 'waiting_gestor', 'resolved', 'closed']

function MessageContent({ text }) {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)
  return (
    <span style={{ whiteSpace: 'pre-wrap' }}>
      {parts.map((part, i) =>
        urlRegex.test(part)
          ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="ticket-chat__link">{part}</a>
          : part
      )}
    </span>
  )
}

export default function TicketDetail() {
  const { ticketId } = useParams()
  const navigate = useNavigate()
  const { clientSlug, userMember, userType } = useClient()
  const { getStoreTickets, updateStoreTicket, getTicketMessages, addTicketMessage, getStores, getTeam } = useClientData()

  const [tickets] = useAsync(getStoreTickets, [])
  const [messages, messagesLoading, refreshMessages] = useAsync(() => getTicketMessages(ticketId), [])
  const [stores] = useAsync(getStores, [])
  const [team] = useAsync(getTeam, [])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const chatEndRef = useRef(null)

  const ticket = tickets.find(t => t.id === ticketId)
  const store = stores.find(s => s.id === ticket?.storeId)

  // Get the assigned gestor's calendar URL
  const assignedGestor = team.find(m => m.id === ticket?.assignedGestorId) || team.find(m => m.id === userMember?.id)
  const gestorCalendarUrl = assignedGestor?.calendarUrl || userMember?.calendarUrl

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    if (!newMsg.trim()) return
    setSending(true)
    try {
      const senderType = userType === 'store_client' ? 'client' : 'gestor'
      const senderName = userType === 'store_client' ? (store?.ownerName || 'Cliente') : (userMember?.name || 'Gestor')
      await addTicketMessage({
        ticketId,
        senderType,
        senderName,
        content: newMsg.trim(),
      })
      setNewMsg('')
      refreshMessages()
      // Update ticket status based on who sent
      if (ticket) {
        const newStatus = senderType === 'client' ? 'waiting_gestor' : 'waiting_client'
        if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
          await updateStoreTicket(ticketId, { status: newStatus })
        }
      }
    } catch (err) {
      console.error('Error sending message:', err)
    } finally {
      setSending(false)
    }
  }

  async function handleProposeCall() {
    if (!gestorCalendarUrl) {
      alert('No tienes un link de calendar configurado. Ve a Settings de Tiendas para añadirlo.')
      return
    }
    setSending(true)
    try {
      const senderName = userMember?.name || 'Gestor'
      await addTicketMessage({
        ticketId,
        senderType: 'gestor',
        senderName,
        content: `📅 Agendar llamada con ${senderName}\n\nHe propuesto agendar una llamada para resolver este tema. Puedes reservar un hueco directamente aquí:\n\n${gestorCalendarUrl}`,
      })
      refreshMessages()
      if (ticket && ticket.status !== 'resolved' && ticket.status !== 'closed') {
        await updateStoreTicket(ticketId, { status: 'waiting_client' })
      }
    } catch (err) {
      console.error('Error proposing call:', err)
    } finally {
      setSending(false)
    }
  }

  async function handleStatusChange(newStatus) {
    await updateStoreTicket(ticketId, {
      status: newStatus,
      ...(newStatus === 'resolved' ? { resolvedAt: new Date().toISOString() } : {}),
    })
    // Refresh by navigating to same page (tickets will re-fetch)
    navigate(0)
  }

  function formatTime(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  }

  if (!ticket && !messagesLoading) {
    return (
      <div className="dashboard" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Ticket no encontrado
        <br />
        <button className="btn-action" style={{ marginTop: 16 }} onClick={() => navigate(`/${clientSlug}/tiendas/tickets`)}>
          Volver a Tickets
        </button>
      </div>
    )
  }

  return (
    <div className="ticket-detail">
      {/* Header */}
      <div className="ticket-detail__header">
        <button className="ticket-detail__back" onClick={() => navigate(`/${clientSlug}/tiendas/tickets`)}>
          ← Tickets
        </button>
        <div className="ticket-detail__title-row">
          <h2 className="ticket-detail__subject">{ticket?.subject || 'Cargando...'}</h2>
          {ticket && (
            <span className="ticket-card__status" style={{ background: `${STATUS_COLORS[ticket.status]}18`, color: STATUS_COLORS[ticket.status], borderColor: `${STATUS_COLORS[ticket.status]}40` }}>
              {STATUS_LABELS[ticket.status]}
            </span>
          )}
        </div>
        {ticket && (
          <div className="ticket-detail__meta">
            <span>{store?.ownerName || 'Tienda'}{store?.brandName ? ` — ${store.brandName}` : ''}</span>
            <span className="ticket-detail__dot">·</span>
            <span style={{ color: PRIORITY_COLORS[ticket.priority] }}>{PRIORITY_LABELS[ticket.priority]}</span>
            <span className="ticket-detail__dot">·</span>
            <span>Abierto por {ticket.openedByName || ticket.openedBy}</span>
            {ticket.scheduledCallAt && (
              <>
                <span className="ticket-detail__dot">·</span>
                <span style={{ color: '#f97316' }}>Llamada: {formatTime(ticket.scheduledCallAt)}</span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="ticket-detail__body">
        {/* Chat */}
        <div className="ticket-chat">
          <div className="ticket-chat__messages">
            {messagesLoading ? (
              <div className="ticket-chat__loading">Cargando mensajes...</div>
            ) : messages.length === 0 ? (
              <div className="ticket-chat__empty">No hay mensajes aún</div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`ticket-chat__msg ticket-chat__msg--${msg.senderType}`}>
                  {msg.senderType === 'system' ? (
                    <div className="ticket-chat__system">{msg.content}</div>
                  ) : (
                    <>
                      <div className="ticket-chat__bubble">
                        <div className="ticket-chat__sender">{msg.senderName}</div>
                        <div className="ticket-chat__content"><MessageContent text={msg.content} /></div>
                        <div className="ticket-chat__time">{formatTime(msg.createdAt)}</div>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          {ticket && ticket.status !== 'closed' && (
            <form className="ticket-chat__input" onSubmit={handleSend}>
              <input
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                placeholder="Escribe un mensaje..."
                disabled={sending}
              />
              <button type="submit" className="btn-action" disabled={sending || !newMsg.trim()}>
                {sending ? '...' : 'Enviar'}
              </button>
            </form>
          )}
        </div>

        {/* Sidebar */}
        {ticket && userType !== 'store_client' && (
          <div className="ticket-detail__sidebar">
            <div className="ticket-detail__sidebar-section">
              <label>Estado</label>
              <select
                value={ticket.status}
                onChange={e => handleStatusChange(e.target.value)}
                className="ticket-detail__status-select"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
              <div className="ticket-detail__sidebar-actions">
                <button
                  className="btn-action ticket-detail__calendar-btn"
                  onClick={handleProposeCall}
                  disabled={sending}
                  title={gestorCalendarUrl ? 'Enviar link de calendar al cliente' : 'Configura tu link de calendar en Settings'}
                >
                  📅 Proponer Llamada
                </button>
                <button
                  className="btn-action"
                  style={{ width: '100%' }}
                  onClick={() => handleStatusChange('resolved')}
                >
                  Resolver Ticket
                </button>
              </div>
            )}
            {ticket.resolvedAt && (
              <div className="ticket-detail__sidebar-section">
                <label>Resuelto</label>
                <span>{formatTime(ticket.resolvedAt)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
