import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClient } from '../../contexts/ClientContext'
import { useClientData } from '../../hooks/useClientData'
import { useAsync } from '../../hooks/useAsync'

const STATUS_COLORS = {
  onboarding: '#3b82f6',
  active: '#22c55e',
  blocked: '#ef4444',
  completed: '#a855f7',
}

function GestorCard({ gestor, stores, expanded, onToggle }) {
  // Capacity = active + onboarding + blocked (not completed)
  const workingCount = gestor.active + gestor.onboarding + gestor.blocked
  const capacityPct = gestor.capacity > 0 ? Math.round(workingCount / gestor.capacity * 100) : 0
  const heatColor = capacityPct >= 90 ? '#ef4444' : capacityPct >= 70 ? '#f97316' : capacityPct >= 50 ? '#eab308' : '#22c55e'

  return (
    <div className={`gestor-card ${expanded ? 'gestor-card--expanded' : ''}`}>
      <div className="gestor-card__header" onClick={onToggle}>
        <div className="gestor-card__avatar">
          {gestor.name.charAt(0).toUpperCase()}
        </div>
        <div className="gestor-card__info">
          <h4 className="gestor-card__name">{gestor.name}</h4>
          <span className="gestor-card__email">{gestor.email || ''}</span>
        </div>
        <div className="gestor-card__capacity-wrap">
          <div className="gestor-card__capacity-bar">
            <div className="gestor-card__capacity-fill" style={{ width: `${Math.min(capacityPct, 100)}%`, background: heatColor }} />
          </div>
          <span className="gestor-card__capacity-text" style={{ color: heatColor }}>
            {workingCount}/{gestor.capacity} capacidad
          </span>
          {gestor.commissionRate > 0 && (
            <span className="gestor-card__commission">{parseFloat((gestor.commissionRate * 100).toFixed(1))}% comisión</span>
          )}
        </div>
        <span className="gestor-card__toggle">{expanded ? '▼' : '▶'}</span>
      </div>

      {/* Stats row */}
      <div className="gestor-card__stats">
        <div className="gestor-card__stat">
          <span className="gestor-card__stat-value" style={{ color: '#22c55e' }}>{gestor.active}</span>
          <span className="gestor-card__stat-label">Activas</span>
        </div>
        <div className="gestor-card__stat">
          <span className="gestor-card__stat-value" style={{ color: '#3b82f6' }}>{gestor.onboarding}</span>
          <span className="gestor-card__stat-label">En proceso</span>
        </div>
        <div className="gestor-card__stat">
          <span className="gestor-card__stat-value" style={{ color: '#ef4444' }}>{gestor.blocked}</span>
          <span className="gestor-card__stat-label">Bloqueadas</span>
        </div>
        <div className="gestor-card__stat">
          <span className="gestor-card__stat-value" style={{ color: '#a855f7' }}>{gestor.completed}</span>
          <span className="gestor-card__stat-label">Completadas</span>
        </div>
        <div className="gestor-card__stat">
          <span className="gestor-card__stat-value">{gestor.total}</span>
          <span className="gestor-card__stat-label">Total</span>
        </div>
      </div>

      {/* Expanded: store list */}
      {expanded && stores.length > 0 && (
        <div className="gestor-card__stores">
          {stores.map(store => (
            <div key={store.id} className="gestor-card__store-row">
              <span className="gestor-card__store-name">{store.ownerName}</span>
              {store.brandName && <span className="gestor-card__store-brand">{store.brandName}</span>}
              <span className="store-status-badge" style={{ background: `${STATUS_COLORS[store.status]}20`, color: STATUS_COLORS[store.status], borderColor: `${STATUS_COLORS[store.status]}40` }}>
                {store.status === 'onboarding' ? 'En proceso' : store.status === 'active' ? 'Activa' : store.status === 'blocked' ? 'Bloqueada' : store.status === 'completed' ? 'Completada' : store.status}
              </span>
              <span className="gestor-card__store-product">{store.productName || '—'}</span>
            </div>
          ))}
        </div>
      )}
      {expanded && stores.length === 0 && (
        <div className="gestor-card__stores">
          <p className="store-detail__empty">Sin tiendas asignadas</p>
        </div>
      )}
    </div>
  )
}

export default function StoresGestores() {
  const { getStores, getTeam } = useClientData()
  const [stores, storesLoading] = useAsync(getStores, [])
  const [team, teamLoading] = useAsync(getTeam, [])
  const [expandedId, setExpandedId] = useState(null)

  const loading = storesLoading || teamLoading

  const gestors = useMemo(() => {
    const gestorMap = new Map()

    stores.forEach(store => {
      const key = store.gestorId || store.gestorName || 'sin_asignar'
      if (!gestorMap.has(key)) {
        gestorMap.set(key, {
          id: store.gestorId,
          name: store.gestorName || 'Sin asignar',
          email: null,
          active: 0,
          onboarding: 0,
          blocked: 0,
          completed: 0,
          total: 0,
          capacity: 8,
          stores: [],
        })
      }
      const g = gestorMap.get(key)
      g.total++
      if (g[store.status] !== undefined) g[store.status]++
      g.stores.push(store)
    })

    // Only include team members marked as gestor de tienda
    team.filter(m => m.isGestor && m.active !== false).forEach(m => {
      const existing = [...gestorMap.entries()].find(([, v]) => v.id === m.id || v.name === m.name)
      if (existing) {
        existing[1].email = m.email
        existing[1].capacity = m.gestorCapacity || 8
        existing[1].commissionRate = m.gestorCommissionRate
        existing[1].startDate = m.gestorStartDate
      } else {
        gestorMap.set(m.id || m.name, {
          id: m.id,
          name: m.name,
          email: m.email,
          active: 0,
          onboarding: 0,
          blocked: 0,
          completed: 0,
          total: 0,
          capacity: m.gestorCapacity || 8,
          commissionRate: m.gestorCommissionRate,
          startDate: m.gestorStartDate,
          stores: [],
        })
      }
    })

    return [...gestorMap.values()].sort((a, b) => b.total - a.total)
  }, [stores, team])

  // Summary stats — working = active + onboarding + blocked
  const totalWorking = gestors.reduce((s, g) => s + g.active + g.onboarding + g.blocked, 0)
  const totalCapacity = gestors.reduce((s, g) => s + g.capacity, 0)
  const avgLoad = totalCapacity > 0 ? Math.round(totalWorking / totalCapacity * 100) : 0

  return (
    <div className="stores-gestores-page">
      {/* Summary */}
      <div className="stores-gestores-summary">
        <div className="stores-gestores-summary__stat">
          <span className="stores-gestores-summary__value">{loading ? '...' : gestors.length}</span>
          <span className="stores-gestores-summary__label">Gestores</span>
        </div>
        <div className="stores-gestores-summary__stat">
          <span className="stores-gestores-summary__value">{loading ? '...' : totalWorking}</span>
          <span className="stores-gestores-summary__label">Tiendas en gestión</span>
        </div>
        <div className="stores-gestores-summary__stat">
          <span className="stores-gestores-summary__value">{loading ? '...' : totalCapacity}</span>
          <span className="stores-gestores-summary__label">Capacidad total</span>
        </div>
        <div className="stores-gestores-summary__stat">
          <span className="stores-gestores-summary__value" style={{ color: avgLoad >= 80 ? '#ef4444' : avgLoad >= 60 ? '#eab308' : '#22c55e' }}>
            {loading ? '...' : `${avgLoad}%`}
          </span>
          <span className="stores-gestores-summary__label">Carga media</span>
        </div>
      </div>

      {/* Gestor Cards */}
      {loading ? (
        <div className="stores-loading">Cargando gestores...</div>
      ) : gestors.length === 0 ? (
        <div className="stores-empty">No hay gestores. Configúralos en Settings.</div>
      ) : (
        <div className="gestor-cards-list">
          {gestors.map((g, i) => (
            <GestorCard
              key={g.id || i}
              gestor={g}
              stores={g.stores}
              expanded={expandedId === (g.id || i)}
              onToggle={() => setExpandedId(expandedId === (g.id || i) ? null : (g.id || i))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
