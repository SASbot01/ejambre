import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
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

const CATEGORY_LABELS = {
  general: 'General',
  account_issue: 'Problema de Cuenta',
  product_question: 'Pregunta de Producto',
  technical: 'Soporte Técnico',
  schedule_call: 'Agendar Llamada',
}

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'open', label: 'Abiertos' },
  { key: 'in_progress', label: 'En Progreso' },
  { key: 'waiting', label: 'Esperando' },
  { key: 'resolved', label: 'Resueltos' },
]

function NewTicketModal({ stores, gestors, onClose, onSave, fixedStoreId }) {
  const [form, setForm] = useState({ storeId: fixedStoreId || '', subject: '', category: 'general', priority: 'medium', initialMessage: '' })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.storeId || !form.subject || !form.initialMessage) return
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      console.error('Error creating ticket:', err)
      alert('Error al crear ticket')
    } finally {
      setSaving(false)
    }
  }

  const fixedStore = fixedStoreId ? stores.find(s => s.id === fixedStoreId) : null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="ticket-new-modal" onClick={e => e.stopPropagation()}>
        <div className="ticket-new-modal__header">
          <h3>Nuevo Ticket</h3>
          <button onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          {fixedStoreId ? (
            <div className="ticket-new-modal__field">
              <label>Tienda</label>
              <div className="ticket-new-modal__fixed-store">{fixedStore?.brandName || fixedStore?.ownerName || 'Tu tienda'}</div>
            </div>
          ) : (
            <div className="ticket-new-modal__field">
              <label>Tienda</label>
              <select value={form.storeId} onChange={e => setForm({ ...form, storeId: e.target.value })} required>
                <option value="">Seleccionar tienda...</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.ownerName}{s.brandName ? ` — ${s.brandName}` : ''}</option>)}
              </select>
            </div>
          )}
          <div className="ticket-new-modal__field">
            <label>Asunto</label>
            <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Describe brevemente el problema" required />
          </div>
          <div className="ticket-new-modal__row">
            <div className="ticket-new-modal__field">
              <label>Categoría</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {!fixedStoreId && (
              <div className="ticket-new-modal__field">
                <label>Prioridad</label>
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="ticket-new-modal__field">
            <label>Mensaje Inicial</label>
            <textarea value={form.initialMessage} onChange={e => setForm({ ...form, initialMessage: e.target.value })} rows={3} placeholder="Describe el problema en detalle..." required />
          </div>
          <div className="ticket-new-modal__actions">
            <button type="button" className="btn-action btn-action--secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-action" disabled={saving}>{saving ? 'Creando...' : 'Crear Ticket'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function StoreTickets({ gestorId }) {
  const navigate = useNavigate()
  const { clientSlug, userMember, userType, storeClient } = useClient()
  const { getStoreTickets, addStoreTicket, addTicketMessage, getStores, getTeam } = useClientData()
  const isClientUser = userType === 'store_client'
  const [tickets, ticketsLoading, refreshTickets] = useAsync(getStoreTickets, [])
  const [stores] = useAsync(getStores, [])
  const [team] = useAsync(getTeam, [])
  const [filter, setFilter] = useState('all')
  const [showNew, setShowNew] = useState(false)

  const gestors = team.filter(m => m.isGestor && m.active !== false)

  const filtered = useMemo(() => {
    let list = tickets
    if (isClientUser && storeClient?.storeId) list = list.filter(t => t.storeId === storeClient.storeId)
    if (gestorId) list = list.filter(t => t.assignedGestorId === gestorId)
    if (filter === 'all') return list
    if (filter === 'waiting') return list.filter(t => t.status === 'waiting_client' || t.status === 'waiting_gestor')
    return list.filter(t => t.status === filter)
  }, [tickets, filter, gestorId, isClientUser, storeClient])

  const counts = useMemo(() => {
    let list = tickets
    if (isClientUser && storeClient?.storeId) list = list.filter(t => t.storeId === storeClient.storeId)
    if (gestorId) list = list.filter(t => t.assignedGestorId === gestorId)
    return {
      all: list.length,
      open: list.filter(t => t.status === 'open').length,
      in_progress: list.filter(t => t.status === 'in_progress').length,
      waiting: list.filter(t => t.status === 'waiting_client' || t.status === 'waiting_gestor').length,
      resolved: list.filter(t => t.status === 'resolved' || t.status === 'closed').length,
    }
  }, [tickets, gestorId])

  // Find store name by storeId
  const storeMap = useMemo(() => {
    const m = {}
    stores.forEach(s => { m[s.id] = s })
    return m
  }, [stores])

  async function handleCreateTicket(form) {
    const store = storeMap[form.storeId]
    const senderType = isClientUser ? 'client' : 'gestor'
    const senderName = isClientUser ? (storeClient?.name || 'Cliente') : (userMember?.name || 'Gestor')
    const ticket = await addStoreTicket({
      storeId: form.storeId,
      subject: form.subject,
      category: form.category,
      priority: form.priority,
      openedBy: senderType,
      openedByName: senderName,
      assignedGestorId: store?.gestorId || gestorId || null,
      status: 'open',
    })
    if (ticket && form.initialMessage) {
      await addTicketMessage({
        ticketId: ticket.id,
        senderType,
        senderName,
        content: form.initialMessage,
      })
    }
    refreshTickets()
  }

  function timeAgo(dateStr) {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `hace ${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `hace ${hrs}h`
    const days = Math.floor(hrs / 24)
    return `hace ${days}d`
  }

  if (ticketsLoading) return <div className="dashboard" style={{ textAlign: 'center', padding: 60, color: '#999' }}>Cargando tickets...</div>

  return (
    <div className="store-tickets-page">
      <div className="store-tickets-page__header">
        <div className="stores-filter-pills">
          {FILTERS.map(f => (
            <button
              key={f.key}
              className={`stores-filter-pill${filter === f.key ? ' stores-filter-pill--active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label} <span className="stores-filter-pill__count">{counts[f.key] || 0}</span>
            </button>
          ))}
        </div>
        <button className="btn-action" onClick={() => setShowNew(true)}>+ Nuevo Ticket</button>
      </div>

      {filtered.length === 0 ? (
        <div className="stores-empty">No hay tickets{filter !== 'all' ? ' con este filtro' : ''}</div>
      ) : (
        <div className="ticket-list">
          {filtered.map(t => {
            const store = storeMap[t.storeId]
            return (
              <div key={t.id} className="ticket-card" onClick={() => navigate(`/${clientSlug}/tiendas/tickets/${t.id}`)}>
                <div className="ticket-card__left">
                  <div className="ticket-card__priority-dot" style={{ background: PRIORITY_COLORS[t.priority] || '#6b7280' }} title={PRIORITY_LABELS[t.priority]} />
                  <div className="ticket-card__info">
                    <div className="ticket-card__subject">{t.subject}</div>
                    <div className="ticket-card__meta">
                      {store?.ownerName || 'Tienda'}{store?.brandName ? ` — ${store.brandName}` : ''}
                      {' · '}{CATEGORY_LABELS[t.category] || t.category}
                      {' · '}{timeAgo(t.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="ticket-card__right">
                  <span className="ticket-card__status" style={{ background: `${STATUS_COLORS[t.status]}18`, color: STATUS_COLORS[t.status], borderColor: `${STATUS_COLORS[t.status]}40` }}>
                    {STATUS_LABELS[t.status] || t.status}
                  </span>
                  <span className="ticket-card__arrow">→</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showNew && (
        <NewTicketModal
          stores={stores}
          gestors={gestors}
          onClose={() => setShowNew(false)}
          onSave={handleCreateTicket}
          fixedStoreId={isClientUser ? storeClient?.storeId : null}
        />
      )}
    </div>
  )
}
