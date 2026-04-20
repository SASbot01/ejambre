import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useClient } from '../../contexts/ClientContext'
import { useClientData } from '../../hooks/useClientData'
import { useAsync } from '../../hooks/useAsync'

const TICKET_STATUS_LABELS = {
  open: 'Abierto', in_progress: 'En Progreso', waiting_client: 'Esperando Cliente',
  waiting_gestor: 'Esperando Gestor', resolved: 'Resuelto', closed: 'Cerrado',
}
const TICKET_STATUS_COLORS = {
  open: '#3b82f6', in_progress: '#f97316', waiting_client: '#eab308',
  waiting_gestor: '#a855f7', resolved: '#22c55e', closed: '#6b7280',
}

const STATUS_LABELS = {
  onboarding: 'En proceso',
  active: 'Activa',
  blocked: 'Bloqueada',
  completed: 'Completada',
  archived: 'Archivada',
}

const STATUS_COLORS = {
  onboarding: '#3b82f6',
  active: '#22c55e',
  blocked: '#ef4444',
  completed: '#a855f7',
  archived: '#6b7280',
}

function StepItem({ step, onToggle }) {
  return (
    <div className={`store-step ${step.completed ? 'store-step--done' : ''} ${step.requiresTeamAction && !step.teamActionDone ? 'store-step--blocked' : ''}`}>
      <button className="store-step__check" onClick={() => onToggle(step)}>
        {step.completed ? '✓' : step.requiresTeamAction && !step.teamActionDone ? '⏸' : step.stepNumber}
      </button>
      <div className="store-step__info">
        <span className="store-step__title">{step.title}</span>
        {step.description && <span className="store-step__desc">{step.description}</span>}
        {step.requiresTeamAction && !step.teamActionDone && (
          <span className="store-step__tag store-step__tag--team">Requiere acción del equipo</span>
        )}
        {step.stepType === 'video' && step.videoUrl && (
          <span className="store-step__tag store-step__tag--video">Video</span>
        )}
      </div>
    </div>
  )
}

function TrackingChart({ tracking }) {
  if (!tracking.length) return <p className="store-detail__empty">Sin datos de seguimiento</p>

  const maxSales = Math.max(...tracking.map(t => Number(t.dailySales) || 0), 1)

  return (
    <div className="store-tracking-chart">
      {tracking.slice(-15).map((t, i) => {
        const val = Number(t.dailySales) || 0
        const pct = (val / maxSales) * 100
        return (
          <div key={t.id || i} className="store-tracking-bar" title={`Día ${t.dayNumber}: ${val}€`}>
            <div className="store-tracking-bar__fill" style={{ height: `${pct}%` }} />
            <span className="store-tracking-bar__label">D{t.dayNumber}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function StoreDetail() {
  const { storeId } = useParams()
  const navigate = useNavigate()
  const { clientSlug } = useClient()
  const {
    getStores, getStoreSteps, getStoreDailyTracking, updateStoreStep, updateStore,
    getTeam, getCrmActivities, getStoreTickets, updateStoreClient, getProducts,
  } = useClientData()

  const [stores, storesLoading, refreshStores] = useAsync(getStores, [])
  const store = useMemo(() => stores.find(s => s.id === storeId), [stores, storeId])
  const [team] = useAsync(getTeam, [])
  const gestors = useMemo(() => team.filter(m => m.isGestor && m.active !== false), [team])
  const [products] = useAsync(getProducts, [])

  const getSteps = useMemo(() => () => getStoreSteps(storeId), [storeId])
  const getTracking = useMemo(() => () => getStoreDailyTracking(storeId), [storeId])

  const [steps, stepsLoading] = useAsync(getSteps, [])
  const [tracking, trackingLoading] = useAsync(getTracking, [])

  // CRM activities for linked contact
  const getCrmActs = useMemo(() => store?.crmContactId ? () => getCrmActivities(store.crmContactId) : () => Promise.resolve([]), [store?.crmContactId])
  const [crmActivities] = useAsync(getCrmActs, [])

  // Tickets for this store
  const [allTickets] = useAsync(getStoreTickets, [])
  const storeTickets = useMemo(() => allTickets.filter(t => t.storeId === storeId), [allTickets, storeId])

  // Gestor reassignment
  const [showGestorPicker, setShowGestorPicker] = useState(false)

  // Client settings
  const [showClientSettings, setShowClientSettings] = useState(false)
  const [clientForm, setClientForm] = useState({ email: '', password: '' })

  // Product/Agent assignment
  const [showProductAssign, setShowProductAssign] = useState(false)
  const [productForm, setProductForm] = useState({ productName: '', productAsin: '', agentName: '' })

  // Upsell
  const [showUpsellForm, setShowUpsellForm] = useState(false)
  const [upsellForm, setUpsellForm] = useState({ offered: '', result: '' })

  const completedSteps = steps.filter(s => s.completed).length
  const progress = steps.length ? Math.round(completedSteps / steps.length * 100) : 0

  const totalSales = tracking.reduce((s, t) => s + (Number(t.dailySales) || 0), 0)
  const totalUnits = tracking.reduce((s, t) => s + (Number(t.dailyUnits) || 0), 0)
  const totalPpc = tracking.reduce((s, t) => s + (Number(t.ppcSpend) || 0), 0)

  async function handleToggleStep(step) {
    await updateStoreStep(step.id, { completed: !step.completed, completedAt: !step.completed ? new Date().toISOString() : null })
    // Check if all steps now completed → auto-transition to active
    const updatedSteps = steps.map(s => s.id === step.id ? { ...s, completed: !step.completed } : s)
    if (updatedSteps.every(s => s.completed) && (store.status === 'onboarding' || store.status === 'blocked')) {
      await updateStore(storeId, { status: 'active' })
    }
    window.location.reload()
  }

  async function handleAssignProduct(e) {
    e.preventDefault()
    const updates = {}
    if (productForm.productName) updates.productName = productForm.productName
    if (productForm.productAsin) updates.productAsin = productForm.productAsin
    if (productForm.agentName) updates.agentName = productForm.agentName
    if (Object.keys(updates).length === 0) return

    await updateStore(storeId, updates)

    // Auto-unblock "Búsqueda de Producto" step if product assigned
    if (updates.productName) {
      const productStep = steps.find(s => s.title.includes('Producto') && s.requiresTeamAction && !s.teamActionDone)
      if (productStep) {
        await updateStoreStep(productStep.id, { teamActionDone: true, completed: true, completedAt: new Date().toISOString() })
      }
    }
    // Auto-unblock "Agente de Compras" step if agent assigned
    if (updates.agentName) {
      const agentStep = steps.find(s => s.title.includes('Agente') && s.requiresTeamAction && !s.teamActionDone)
      if (agentStep) {
        await updateStoreStep(agentStep.id, { teamActionDone: true, completed: true, completedAt: new Date().toISOString() })
      }
    }

    setShowProductAssign(false)
    window.location.reload()
  }

  async function handleSaveUpsell(e) {
    e.preventDefault()
    await updateStore(storeId, {
      upsellOffered: upsellForm.offered || store.upsellOffered || 'dwy',
      upsellResult: upsellForm.result || 'pending',
    })
    setShowUpsellForm(false)
    refreshStores()
  }

  async function handleReassignGestor(gestorId) {
    const gestor = gestors.find(g => g.id === gestorId)
    if (!gestor) return
    await updateStore(storeId, { gestorId: gestor.id, gestorName: gestor.name })
    setShowGestorPicker(false)
    refreshStores()
  }

  async function handleSaveClientSettings(e) {
    e.preventDefault()
    if (!store?.storeClientId) return
    const updates = {}
    if (clientForm.email) updates.email = clientForm.email
    if (clientForm.password) updates.password = clientForm.password
    if (Object.keys(updates).length === 0) return
    await updateStoreClient(store.storeClientId, updates)
    setShowClientSettings(false)
    setClientForm({ email: '', password: '' })
  }

  function formatDate(dateStr) {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  if (storesLoading) return <div className="stores-loading">Cargando...</div>
  if (!store) return <div className="stores-empty">Tienda no encontrada</div>

  return (
    <div className="store-detail">
      {/* Header */}
      <div className="store-detail__header">
        <div className="store-detail__header-left">
          <h2>{store.ownerName}</h2>
          {store.brandName && <span className="store-detail__brand">{store.brandName}</span>}
          <span className="store-status-badge" style={{ background: `${STATUS_COLORS[store.status]}20`, color: STATUS_COLORS[store.status], borderColor: `${STATUS_COLORS[store.status]}40` }}>
            {STATUS_LABELS[store.status] || store.status}
          </span>
        </div>
        <div className="store-detail__header-right">
          <div className="store-detail__gestor-wrap">
            {store.gestorName && <span className="store-detail__gestor">Gestor: <strong>{store.gestorName}</strong></span>}
            <button className="btn-sm btn-sm--edit" onClick={() => setShowGestorPicker(!showGestorPicker)} title="Cambiar gestor">✎</button>
            {showGestorPicker && (
              <div className="store-detail__gestor-dropdown">
                {gestors.map(g => (
                  <button key={g.id} className={`store-detail__gestor-option${g.id === store.gestorId ? ' store-detail__gestor-option--active' : ''}`} onClick={() => handleReassignGestor(g.id)}>
                    {g.name} <span style={{ opacity: 0.5, fontSize: '0.76rem' }}>({g.storeCount || 0}/{g.gestorCapacity || 8})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {store.serviceType && <span className="store-detail__service">{store.serviceType.toUpperCase()}</span>}
          {store.storeClientId && (
            <button className="btn-sm" onClick={() => { setClientForm({ email: store.ownerEmail || '', password: '' }); setShowClientSettings(!showClientSettings) }} title="Ajustes cliente">⚙</button>
          )}
        </div>
      </div>

      {/* Info Grid */}
      <div className="store-detail__grid">
        <div className="store-detail__card">
          <h4>Contacto</h4>
          <div className="store-detail__fields">
            {store.ownerEmail && <p><span>Email:</span> {store.ownerEmail}</p>}
            {store.ownerPhone && <p><span>Tel:</span> {store.ownerPhone}</p>}
            {store.ownerInstagram && <p><span>IG:</span> @{store.ownerInstagram}</p>}
          </div>
        </div>

        <div className="store-detail__card">
          <div className="store-detail__card-header">
            <h4>Producto</h4>
            <button className="btn-sm btn-sm--edit" onClick={() => { setProductForm({ productName: store.productName || '', productAsin: store.productAsin || '', agentName: store.agentName || '' }); setShowProductAssign(true) }} title="Asignar producto/agente">✎</button>
          </div>
          <div className="store-detail__fields">
            <p><span>Producto:</span> {store.productName || <em style={{ color: '#f97316' }}>Sin asignar</em>}</p>
            {store.productAsin && <p><span>ASIN:</span> {store.productAsin}</p>}
            <p><span>Marketplace:</span> {store.amazonMarketplace || 'ES'}</p>
            <p><span>Agente:</span> {store.agentName || <em style={{ color: '#f97316' }}>Sin asignar</em>}</p>
          </div>
        </div>

        <div className="store-detail__card">
          <h4>Servicio</h4>
          <div className="store-detail__fields">
            <p><span>Capital:</span> {store.capitalDisponible ? `${Number(store.capitalDisponible).toLocaleString('es-ES')}€` : '—'}</p>
            <p><span>Inicio:</span> {store.startDate || '—'}</p>
            <p><span>Fin:</span> {store.endDate || '—'}</p>
            <p><span>Seguimiento:</span> {store.followupDays || 30} días</p>
          </div>
        </div>
      </div>

      {/* Onboarding Steps */}
      {(store.status === 'onboarding' || store.status === 'blocked') && (
        <div className="store-detail__section">
          <div className="store-detail__section-header">
            <h3>Onboarding — {completedSteps}/{steps.length} pasos</h3>
            <div className="store-detail__progress-bar">
              <div className="store-detail__progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
          {stepsLoading ? (
            <div className="stores-loading">Cargando pasos...</div>
          ) : steps.length === 0 ? (
            <p className="store-detail__empty">Sin pasos configurados</p>
          ) : (
            <div className="store-steps-list">
              {steps.map(step => (
                <StepItem key={step.id} step={step} onToggle={handleToggleStep} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Daily Tracking */}
      {(store.status === 'active' || store.status === 'completed') && (
        <div className="store-detail__section">
          <h3>Seguimiento Diario</h3>
          <div className="store-detail__tracking-stats">
            <div className="store-detail__tracking-stat">
              <span className="store-detail__tracking-stat-value">{totalSales.toLocaleString('es-ES')}€</span>
              <span className="store-detail__tracking-stat-label">Ventas totales</span>
            </div>
            <div className="store-detail__tracking-stat">
              <span className="store-detail__tracking-stat-value">{totalUnits}</span>
              <span className="store-detail__tracking-stat-label">Unidades</span>
            </div>
            <div className="store-detail__tracking-stat">
              <span className="store-detail__tracking-stat-value">{totalPpc.toLocaleString('es-ES')}€</span>
              <span className="store-detail__tracking-stat-label">PPC Spend</span>
            </div>
          </div>
          {trackingLoading ? (
            <div className="stores-loading">Cargando tracking...</div>
          ) : (
            <TrackingChart tracking={tracking} />
          )}
        </div>
      )}

      {/* Notes */}
      {store.notes && (
        <div className="store-detail__section">
          <h3>Notas</h3>
          <p className="store-detail__notes">{store.notes}</p>
        </div>
      )}

      {/* Upsell */}
      {(store.status === 'active' || store.status === 'completed') && (
        <div className="store-detail__section">
          <div className="store-detail__section-header">
            <h3>Upsell</h3>
            {!store.upsellOffered && <button className="btn-sm" onClick={() => { setUpsellForm({ offered: 'dwy', result: 'pending' }); setShowUpsellForm(true) }}>+ Proponer Upsell</button>}
          </div>
          {store.upsellOffered ? (
            <div className="store-detail__upsell-info">
              <p><span>Ofrecido:</span> <strong>{store.upsellOffered === 'dwy' ? 'Done With You' : store.upsellOffered === 'dfy' ? 'Done For You' : store.upsellOffered}</strong></p>
              <p><span>Estado:</span> <strong style={{ color: store.upsellResult === 'accepted' ? '#22c55e' : store.upsellResult === 'rejected' ? '#ef4444' : '#f97316' }}>
                {store.upsellResult === 'accepted' ? 'Aceptado' : store.upsellResult === 'rejected' ? 'Rechazado' : store.upsellResult === 'pending' ? 'Pendiente' : store.upsellResult || 'Pendiente'}
              </strong></p>
              <div className="store-detail__upsell-actions">
                {store.upsellResult === 'pending' && (
                  <>
                    <button className="btn-sm btn-sm--success" onClick={() => { updateStore(storeId, { upsellResult: 'accepted' }); refreshStores() }}>Aceptado</button>
                    <button className="btn-sm btn-sm--danger" onClick={() => { updateStore(storeId, { upsellResult: 'rejected' }); refreshStores() }}>Rechazado</button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <p className="store-detail__empty">No se ha ofrecido upsell aún</p>
          )}
        </div>
      )}

      {/* CRM Lead History */}
      {store.crmContactId && crmActivities.length > 0 && (
        <div className="store-detail__section">
          <h3>Historial CRM</h3>
          <div className="store-detail__timeline">
            {crmActivities.slice(0, 10).map(act => (
              <div key={act.id} className="store-detail__timeline-item">
                <span className="store-detail__timeline-date">{formatDate(act.createdAt)}</span>
                <span className="store-detail__timeline-type">{act.type}</span>
                <span className="store-detail__timeline-desc">{act.description || act.notes || ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ticket History */}
      {storeTickets.length > 0 && (
        <div className="store-detail__section">
          <h3>Tickets ({storeTickets.length})</h3>
          <div className="store-detail__ticket-list">
            {storeTickets.map(t => (
              <div key={t.id} className="store-detail__ticket-row" onClick={() => navigate(`/${clientSlug}/tiendas/tickets/${t.id}`)}>
                <span className="store-detail__ticket-subject">{t.subject}</span>
                <span className="ticket-card__status" style={{ background: `${TICKET_STATUS_COLORS[t.status]}18`, color: TICKET_STATUS_COLORS[t.status], borderColor: `${TICKET_STATUS_COLORS[t.status]}40` }}>
                  {TICKET_STATUS_LABELS[t.status]}
                </span>
                <span className="store-detail__ticket-date">{formatDate(t.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Client Settings Modal */}
      {showClientSettings && (
        <div className="modal-overlay" onClick={() => setShowClientSettings(false)}>
          <div className="ticket-new-modal" onClick={e => e.stopPropagation()}>
            <div className="ticket-new-modal__header">
              <h3>Ajustes del Cliente</h3>
              <button onClick={() => setShowClientSettings(false)}>&times;</button>
            </div>
            <form onSubmit={handleSaveClientSettings}>
              <div className="ticket-new-modal__field">
                <label>Email del portal</label>
                <input type="email" value={clientForm.email} onChange={e => setClientForm({ ...clientForm, email: e.target.value })} />
              </div>
              <div className="ticket-new-modal__field">
                <label>Nueva contraseña</label>
                <input type="text" value={clientForm.password} onChange={e => setClientForm({ ...clientForm, password: e.target.value })} placeholder="Dejar vacío para no cambiar" />
              </div>
              <div className="ticket-new-modal__actions">
                <button type="button" className="btn-action btn-action--secondary" onClick={() => setShowClientSettings(false)}>Cancelar</button>
                <button type="submit" className="btn-action">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product/Agent Assignment Modal */}
      {showProductAssign && (
        <div className="modal-overlay" onClick={() => setShowProductAssign(false)}>
          <div className="ticket-new-modal" onClick={e => e.stopPropagation()}>
            <div className="ticket-new-modal__header">
              <h3>Asignar Producto y Agente</h3>
              <button onClick={() => setShowProductAssign(false)}>&times;</button>
            </div>
            <form onSubmit={handleAssignProduct}>
              <div className="ticket-new-modal__field">
                <label>Producto</label>
                <select value={productForm.productName} onChange={e => {
                  const prod = products.find(p => p.name === e.target.value)
                  setProductForm({ ...productForm, productName: e.target.value, productAsin: prod?.asin || productForm.productAsin })
                }}>
                  <option value="">Seleccionar producto...</option>
                  {products.map(p => <option key={p.id} value={p.name}>{p.name}{p.asin ? ` (${p.asin})` : ''}</option>)}
                </select>
              </div>
              <div className="ticket-new-modal__field">
                <label>ASIN (opcional)</label>
                <input value={productForm.productAsin} onChange={e => setProductForm({ ...productForm, productAsin: e.target.value })} placeholder="B0XXXXXXXX" />
              </div>
              <div className="ticket-new-modal__field">
                <label>Agente de Compras</label>
                <input value={productForm.agentName} onChange={e => setProductForm({ ...productForm, agentName: e.target.value })} placeholder="Nombre del agente/proveedor" />
              </div>
              <div className="ticket-new-modal__actions">
                <button type="button" className="btn-action btn-action--secondary" onClick={() => setShowProductAssign(false)}>Cancelar</button>
                <button type="submit" className="btn-action">Asignar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upsell Offer Modal */}
      {showUpsellForm && (
        <div className="modal-overlay" onClick={() => setShowUpsellForm(false)}>
          <div className="ticket-new-modal" onClick={e => e.stopPropagation()}>
            <div className="ticket-new-modal__header">
              <h3>Proponer Upsell</h3>
              <button onClick={() => setShowUpsellForm(false)}>&times;</button>
            </div>
            <form onSubmit={handleSaveUpsell}>
              <div className="ticket-new-modal__field">
                <label>Servicio a ofrecer</label>
                <select value={upsellForm.offered} onChange={e => setUpsellForm({ ...upsellForm, offered: e.target.value })}>
                  <option value="dwy">Done With You</option>
                  <option value="dfy">Done For You</option>
                  <option value="mentoria">Mentoría 1:1</option>
                </select>
              </div>
              <div className="ticket-new-modal__actions">
                <button type="button" className="btn-action btn-action--secondary" onClick={() => setShowUpsellForm(false)}>Cancelar</button>
                <button type="submit" className="btn-action">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close gestor picker on click away */}
      {showGestorPicker && <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowGestorPicker(false)} />}
    </div>
  )
}
