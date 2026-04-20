import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClient } from '../../contexts/ClientContext'
import { useClientData } from '../../hooks/useClientData'
import { useAsync } from '../../hooks/useAsync'
import StoreCreationModal from '../../components/StoreCreationModal'

const STATUS_COLORS = {
  onboarding: '#3b82f6',
  active: '#22c55e',
  blocked: '#ef4444',
  completed: '#a855f7',
}

const STATUS_LABELS = {
  onboarding: 'En proceso',
  active: 'Activa',
  blocked: 'Bloqueada',
  completed: 'Completada',
}

export default function GestorDashboard({ gestorId }) {
  const navigate = useNavigate()
  const { clientSlug, userMember } = useClient()
  const { getStores, getStoreTickets } = useClientData()
  const [stores, , refreshStores] = useAsync(getStores, [])
  const [tickets] = useAsync(getStoreTickets, [])
  const [showCreate, setShowCreate] = useState(false)

  const myStores = useMemo(() => stores.filter(s => s.gestorId === gestorId), [stores, gestorId])
  const myTickets = useMemo(() => tickets.filter(t => t.assignedGestorId === gestorId), [tickets, gestorId])

  const counts = useMemo(() => ({
    onboarding: myStores.filter(s => s.status === 'onboarding').length,
    active: myStores.filter(s => s.status === 'active').length,
    blocked: myStores.filter(s => s.status === 'blocked').length,
    completed: myStores.filter(s => s.status === 'completed').length,
    total: myStores.length,
  }), [myStores])

  const openTickets = myTickets.filter(t => t.status !== 'resolved' && t.status !== 'closed')
  const capacity = userMember?.gestorCapacity || 8
  const activeCount = counts.onboarding + counts.active + counts.blocked
  const capacityPct = Math.round(activeCount / capacity * 100)
  const capacityColor = capacityPct >= 90 ? '#ef4444' : capacityPct >= 70 ? '#f97316' : capacityPct >= 50 ? '#eab308' : '#22c55e'

  return (
    <div className="gestor-dashboard">
      <div className="gestor-dashboard__header">
        <h2 className="gestor-dashboard__greeting">Hola, {userMember?.name || 'Gestor'}</h2>
        <button className="btn-action" onClick={() => setShowCreate(true)}>+ Nueva Tienda</button>
      </div>

      {/* KPIs */}
      <div className="gestor-dashboard__kpis">
        <div className="store-stat-card" onClick={() => navigate(`/${clientSlug}/tiendas/lista`)}>
          <span className="store-stat-card__value">{counts.total}</span>
          <span className="store-stat-card__label">Mis Tiendas</span>
        </div>
        <div className="store-stat-card" style={{ cursor: 'default' }}>
          <span className="store-stat-card__value" style={{ color: '#3b82f6' }}>{counts.onboarding}</span>
          <span className="store-stat-card__label">En Proceso</span>
        </div>
        <div className="store-stat-card" style={{ cursor: 'default' }}>
          <span className="store-stat-card__value" style={{ color: '#22c55e' }}>{counts.active}</span>
          <span className="store-stat-card__label">Activas</span>
        </div>
        <div className="store-stat-card" onClick={() => navigate(`/${clientSlug}/tiendas/tickets`)}>
          <span className="store-stat-card__value" style={{ color: '#f97316' }}>{openTickets.length}</span>
          <span className="store-stat-card__label">Tickets Abiertos</span>
        </div>
      </div>

      {/* Capacity Bar */}
      <div className="gestor-dashboard__capacity">
        <div className="gestor-dashboard__capacity-header">
          <span>Capacidad</span>
          <span style={{ color: capacityColor, fontWeight: 700 }}>{activeCount}/{capacity} tiendas</span>
        </div>
        <div className="gestor-dashboard__capacity-bar">
          <div className="gestor-dashboard__capacity-fill" style={{ width: `${Math.min(capacityPct, 100)}%`, background: capacityColor }} />
        </div>
      </div>

      {/* Blocked stores (urgent) */}
      {counts.blocked > 0 && (
        <div className="gestor-dashboard__section">
          <h3 style={{ color: '#ef4444' }}>Tiendas Bloqueadas ({counts.blocked})</h3>
          <div className="gestor-dashboard__store-list">
            {myStores.filter(s => s.status === 'blocked').map(s => (
              <div key={s.id} className="gestor-dashboard__store-item" onClick={() => navigate(`/${clientSlug}/tiendas/lista/${s.id}`)}>
                <strong>{s.ownerName}</strong>
                {s.brandName && <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}> — {s.brandName}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent tickets */}
      {openTickets.length > 0 && (
        <div className="gestor-dashboard__section">
          <h3>Tickets Pendientes</h3>
          <div className="gestor-dashboard__store-list">
            {openTickets.slice(0, 5).map(t => (
              <div key={t.id} className="gestor-dashboard__store-item" onClick={() => navigate(`/${clientSlug}/tiendas/tickets/${t.id}`)}>
                <strong>{t.subject}</strong>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{t.openedByName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent onboarding stores */}
      {counts.onboarding > 0 && (
        <div className="gestor-dashboard__section">
          <h3>En Proceso de Onboarding</h3>
          <div className="gestor-dashboard__store-list">
            {myStores.filter(s => s.status === 'onboarding').map(s => {
              const progress = s.totalSteps ? Math.round((s.currentStep - 1) / s.totalSteps * 100) : 0
              return (
                <div key={s.id} className="gestor-dashboard__store-item" onClick={() => navigate(`/${clientSlug}/tiendas/lista/${s.id}`)}>
                  <div style={{ flex: 1 }}>
                    <strong>{s.ownerName}</strong>
                    {s.brandName && <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}> — {s.brandName}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 60, height: 6, background: 'var(--border)', borderRadius: 3 }}>
                      <div style={{ width: `${progress}%`, height: '100%', background: '#3b82f6', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{s.currentStep}/{s.totalSteps}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {showCreate && (
        <StoreCreationModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refreshStores() }}
        />
      )}
    </div>
  )
}
