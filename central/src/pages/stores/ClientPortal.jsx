import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClient } from '../../contexts/ClientContext'
import { useClientData } from '../../hooks/useClientData'
import { useAsync } from '../../hooks/useAsync'

const STATUS_LABELS = {
  onboarding: 'En proceso de creación',
  active: 'Activa',
  blocked: 'En pausa',
  completed: 'Completada',
}

const STATUS_COLORS = {
  onboarding: '#3b82f6',
  active: '#22c55e',
  blocked: '#ef4444',
  completed: '#a855f7',
}

const SERVICE_LABELS = {
  diy: 'Do It Yourself',
  dwy: 'Done With You',
  dfy: 'Done For You',
}

function StepCard({ step, index, isActive, isLocked, isPrevDone, onComplete, onSaveDeliverables, saving }) {
  const [expanded, setExpanded] = useState(false)
  const [deliverableValues, setDeliverableValues] = useState(() => {
    const deliverables = step.deliverables || []
    const vals = {}
    deliverables.forEach(d => { vals[d.key] = d.value || '' })
    return vals
  })

  const isBlocked = step.requiresTeamAction && !step.teamActionDone
  const canComplete = isActive && !isLocked && !isBlocked
  const deliverables = step.deliverables || []
  const hasDeliverables = deliverables.length > 0
  const allDeliverablesFilled = deliverables.every(d => !d.required || deliverableValues[d.key]?.toString().trim())

  function handleToggle() {
    if (step.completed || isActive) setExpanded(!expanded)
  }

  function handleDeliverablesChange(key, value) {
    setDeliverableValues(prev => ({ ...prev, [key]: value }))
  }

  async function handleSaveAndComplete() {
    if (hasDeliverables && !allDeliverablesFilled) return
    if (hasDeliverables) {
      const updated = deliverables.map(d => ({ ...d, value: deliverableValues[d.key] || '' }))
      await onSaveDeliverables(step.id, updated)
    }
    await onComplete(step.id)
  }

  const statusIcon = step.completed ? '✓' : isBlocked ? '🔒' : isLocked ? '🔒' : isActive ? '→' : '○'
  const statusClass = step.completed ? 'done' : isBlocked ? 'blocked' : isLocked ? 'locked' : isActive ? 'active' : 'pending'

  return (
    <div className={`onboarding-step onboarding-step--${statusClass}`}>
      <div className="onboarding-step__header" onClick={handleToggle}>
        <div className="onboarding-step__number">
          <span className={`onboarding-step__icon onboarding-step__icon--${statusClass}`}>{statusIcon}</span>
        </div>
        <div className="onboarding-step__title-wrap">
          <span className="onboarding-step__title">{step.title}</span>
          {step.completed && <span className="onboarding-step__badge onboarding-step__badge--done">Completado</span>}
          {isBlocked && <span className="onboarding-step__badge onboarding-step__badge--blocked">Esperando al equipo</span>}
          {isLocked && !isBlocked && <span className="onboarding-step__badge onboarding-step__badge--locked">Completa el paso anterior</span>}
        </div>
        {(step.completed || isActive) && (
          <span className="onboarding-step__chevron">{expanded ? '▾' : '▸'}</span>
        )}
      </div>

      {expanded && (
        <div className="onboarding-step__body">
          {step.description && (
            <p className="onboarding-step__description">{step.description}</p>
          )}

          {step.videoUrl && (
            <div className="onboarding-step__video">
              <iframe
                src={step.videoUrl}
                title={step.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          {hasDeliverables && (
            <div className="onboarding-step__deliverables">
              <h4 className="onboarding-step__deliverables-title">Entregables</h4>
              {deliverables.map(d => (
                <div key={d.key} className="onboarding-step__deliverable">
                  <label className="onboarding-step__deliverable-label">
                    {d.label} {d.required && <span className="onboarding-step__required">*</span>}
                  </label>
                  {step.completed ? (
                    <div className="onboarding-step__deliverable-value">{d.value || '—'}</div>
                  ) : canComplete ? (
                    <input
                      type={d.type === 'number' ? 'number' : d.type === 'url' ? 'url' : 'text'}
                      className="onboarding-step__deliverable-input"
                      value={deliverableValues[d.key] || ''}
                      onChange={e => handleDeliverablesChange(d.key, e.target.value)}
                      placeholder={d.label}
                    />
                  ) : (
                    <div className="onboarding-step__deliverable-value">Pendiente</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {canComplete && !step.completed && (
            <button
              className="onboarding-step__complete-btn"
              onClick={handleSaveAndComplete}
              disabled={saving || (hasDeliverables && !allDeliverablesFilled)}
            >
              {saving ? 'Guardando...' : hasDeliverables ? 'Guardar y Completar Paso' : 'Marcar como Hecho'}
            </button>
          )}

          {step.completed && step.completedAt && (
            <div className="onboarding-step__completed-date">
              Completado el {new Date(step.completedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ClientPortal() {
  const navigate = useNavigate()
  const { clientSlug, storeClient } = useClient()
  const { getStores, getStoreSteps, getStoreTickets, getStoreDailyTracking, addStoreDailyTracking, updateStoreStep, initStoreSteps, updateStore } = useClientData()
  const [saving, setSaving] = useState(false)

  const [stores] = useAsync(getStores, [])
  const [allTickets] = useAsync(getStoreTickets, [])

  const store = useMemo(() => {
    if (!storeClient?.storeId) return stores[0]
    return stores.find(s => s.id === storeClient.storeId) || null
  }, [stores, storeClient])

  // Manage steps and tracking with direct useEffect (useAsync has stale closure issues with dynamic fns)
  const [steps, setSteps] = useState([])
  const [stepsLoading, setStepsLoading] = useState(true)
  const [tracking, setTracking] = useState([])
  const storeId = store?.id

  async function loadSteps() {
    if (!storeId) return
    setStepsLoading(true)
    try {
      let result = await getStoreSteps(storeId)
      // Auto-initialize steps for stores that don't have them yet
      if (result.length === 0 && (store.status === 'onboarding' || store.status === 'blocked')) {
        const created = await initStoreSteps(storeId, store.serviceType)
        if (created) result = await getStoreSteps(storeId)
      }
      setSteps(result)
    } catch (err) {
      console.error('Error loading steps:', err)
    } finally {
      setStepsLoading(false)
    }
  }

  useEffect(() => {
    if (storeId) {
      loadSteps()
      getStoreDailyTracking(storeId).then(setTracking).catch(() => {})
    }
  }, [storeId])

  const storeTickets = useMemo(() => store ? allTickets.filter(t => t.storeId === store.id) : [], [allTickets, store])
  const openTickets = storeTickets.filter(t => t.status !== 'resolved' && t.status !== 'closed')

  const completedSteps = steps.filter(s => s.completed).length
  const totalSteps = steps.length
  const progress = totalSteps ? Math.round(completedSteps / totalSteps * 100) : 0

  const totalSales = tracking.reduce((s, t) => s + (Number(t.dailySales) || 0), 0)

  // Find the first incomplete step index (active step)
  const activeStepIndex = steps.findIndex(s => !s.completed)

  async function handleCompleteStep(stepId) {
    setSaving(true)
    try {
      await updateStoreStep(stepId, { completed: true, completedAt: new Date().toISOString() })
      await loadSteps()
    } catch (err) {
      console.error('Error completing step:', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveDeliverables(stepId, deliverables) {
    try {
      await updateStoreStep(stepId, { deliverables })
    } catch (err) {
      console.error('Error saving deliverables:', err)
    }
  }

  // Auto-transition: if all steps completed and store is onboarding → active
  useEffect(() => {
    if (!store || !steps.length || stepsLoading) return
    if ((store.status === 'onboarding' || store.status === 'blocked') && steps.every(s => s.completed)) {
      updateStore(store.id, { status: 'active' }).catch(() => {})
    }
  }, [steps, stepsLoading, store])

  // Daily tracking form
  const [trackingForm, setTrackingForm] = useState({ dailySales: '', dailyUnits: '', ppcSpend: '', organicPosition: '' })
  const [trackingSaving, setTrackingSaving] = useState(false)
  const todayStr = new Date().toISOString().split('T')[0]
  const alreadyTrackedToday = tracking.some(t => t.trackingDate === todayStr)

  async function handleSubmitTracking(e) {
    e.preventDefault()
    if (!trackingForm.dailySales) return
    setTrackingSaving(true)
    try {
      await addStoreDailyTracking({
        storeId: store.id,
        trackingDate: todayStr,
        dayNumber: tracking.length + 1,
        dailySales: Number(trackingForm.dailySales) || 0,
        dailyUnits: Number(trackingForm.dailyUnits) || 0,
        ppcSpend: Number(trackingForm.ppcSpend) || 0,
        organicPosition: Number(trackingForm.organicPosition) || 0,
      })
      setTrackingForm({ dailySales: '', dailyUnits: '', ppcSpend: '', organicPosition: '' })
      getStoreDailyTracking(store.id).then(setTracking).catch(() => {})
    } catch (err) {
      console.error('Error saving tracking:', err)
    } finally {
      setTrackingSaving(false)
    }
  }

  if (!store) {
    return (
      <div className="client-portal">
        <div className="client-portal__empty">
          <h2>Bienvenido, {storeClient?.name || 'Cliente'}</h2>
          <p>Tu tienda se está configurando. Pronto verás toda la información aquí.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="client-portal">
      {/* Store Card */}
      <div className="client-portal__store-card">
        <div className="client-portal__store-header">
          <div>
            <h2>{store.brandName || store.ownerName}</h2>
            {store.brandName && <p className="client-portal__owner">{store.ownerName}</p>}
          </div>
          <span className="store-status-badge" style={{ background: `${STATUS_COLORS[store.status]}20`, color: STATUS_COLORS[store.status], borderColor: `${STATUS_COLORS[store.status]}40` }}>
            {STATUS_LABELS[store.status] || store.status}
          </span>
        </div>
        <div className="client-portal__store-info">
          <div className="client-portal__info-item">
            <span className="client-portal__info-label">Servicio</span>
            <span className="client-portal__info-value">{SERVICE_LABELS[store.serviceType] || store.serviceType}</span>
          </div>
          <div className="client-portal__info-item">
            <span className="client-portal__info-label">Gestor</span>
            <span className="client-portal__info-value">{store.gestorName || 'Por asignar'}</span>
          </div>
          {store.productName && (
            <div className="client-portal__info-item">
              <span className="client-portal__info-label">Producto</span>
              <span className="client-portal__info-value">{store.productName}</span>
            </div>
          )}
          {store.amazonMarketplace && (
            <div className="client-portal__info-item">
              <span className="client-portal__info-label">Marketplace</span>
              <span className="client-portal__info-value">{store.amazonMarketplace}</span>
            </div>
          )}
        </div>
      </div>

      {/* Onboarding Progress */}
      {(store.status === 'onboarding' || store.status === 'blocked') && totalSteps > 0 && (
        <div className="client-portal__section">
          <h3>Progreso de Creación</h3>
          <div className="client-portal__progress-bar-wrap">
            <div className="client-portal__progress-bar">
              <div className="client-portal__progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="client-portal__progress-text">{completedSteps} de {totalSteps} pasos completados ({progress}%)</span>
          </div>

          <div className="onboarding-steps">
            {steps.map((step, i) => {
              const isActive = i === activeStepIndex
              const isLocked = i > activeStepIndex && activeStepIndex >= 0
              const isPrevDone = i === 0 || steps[i - 1]?.completed
              return (
                <StepCard
                  key={step.id}
                  step={step}
                  index={i}
                  isActive={isActive}
                  isLocked={isLocked}
                  isPrevDone={isPrevDone}
                  onComplete={handleCompleteStep}
                  onSaveDeliverables={handleSaveDeliverables}
                  saving={saving}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Active store: stats + daily tracking form */}
      {store.status === 'active' && (
        <div className="client-portal__section">
          <h3>Tu Tienda en Números</h3>
          <div className="client-portal__stats">
            <div className="store-stat-card">
              <span className="store-stat-card__value" style={{ color: '#22c55e' }}>{totalSales.toLocaleString('es-ES')}€</span>
              <span className="store-stat-card__label">Ventas Totales</span>
            </div>
            <div className="store-stat-card">
              <span className="store-stat-card__value">{tracking.length}</span>
              <span className="store-stat-card__label">Días de Seguimiento</span>
            </div>
          </div>

          {/* Daily tracking input form */}
          {alreadyTrackedToday ? (
            <div className="tracking-form__done">Ya has registrado los datos de hoy. ¡Vuelve mañana!</div>
          ) : (
            <form className="tracking-form" onSubmit={handleSubmitTracking}>
              <h4 className="tracking-form__title">Registrar datos de hoy</h4>
              <div className="tracking-form__grid">
                <div className="tracking-form__field">
                  <label>Ventas (€)</label>
                  <input type="number" step="0.01" value={trackingForm.dailySales} onChange={e => setTrackingForm({ ...trackingForm, dailySales: e.target.value })} placeholder="0" required />
                </div>
                <div className="tracking-form__field">
                  <label>Unidades</label>
                  <input type="number" value={trackingForm.dailyUnits} onChange={e => setTrackingForm({ ...trackingForm, dailyUnits: e.target.value })} placeholder="0" />
                </div>
                <div className="tracking-form__field">
                  <label>Gasto PPC (€)</label>
                  <input type="number" step="0.01" value={trackingForm.ppcSpend} onChange={e => setTrackingForm({ ...trackingForm, ppcSpend: e.target.value })} placeholder="0" />
                </div>
                <div className="tracking-form__field">
                  <label>Posición Orgánica</label>
                  <input type="number" value={trackingForm.organicPosition} onChange={e => setTrackingForm({ ...trackingForm, organicPosition: e.target.value })} placeholder="0" />
                </div>
              </div>
              <button type="submit" className="btn-action tracking-form__submit" disabled={trackingSaving}>
                {trackingSaving ? 'Guardando...' : 'Registrar Día'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Support */}
      <div className="client-portal__section">
        <h3>Soporte</h3>
        <div className="client-portal__support-actions">
          <button className="btn-action" onClick={() => navigate(`/${clientSlug}/tiendas/tickets`)}>
            Ver Tickets {openTickets.length > 0 && `(${openTickets.length} abiertos)`}
          </button>
        </div>
        {openTickets.length > 0 && (
          <div className="client-portal__recent-tickets">
            {openTickets.slice(0, 3).map(t => (
              <div key={t.id} className="store-detail__ticket-row" onClick={() => navigate(`/${clientSlug}/tiendas/tickets/${t.id}`)}>
                <span className="store-detail__ticket-subject">{t.subject}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{t.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
