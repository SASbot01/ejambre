import { useMemo } from 'react'
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

function StatCard({ label, value, color, onClick }) {
  return (
    <div className="store-stat-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <span className="store-stat-card__value" style={{ color }}>{value}</span>
      <span className="store-stat-card__label">{label}</span>
    </div>
  )
}

function GestorHeatCard({ gestor, onClick }) {
  const capacityPct = gestor.capacity > 0 ? Math.round(gestor.active / gestor.capacity * 100) : 0
  const heatColor = capacityPct >= 90 ? '#ef4444' : capacityPct >= 70 ? '#f97316' : capacityPct >= 50 ? '#eab308' : '#22c55e'

  return (
    <div className="gestor-heat-card" onClick={onClick}>
      <div className="gestor-heat-card__header">
        <span className="gestor-heat-card__name">{gestor.name}</span>
        <span className="gestor-heat-card__capacity" style={{ color: heatColor }}>
          {gestor.active}/{gestor.capacity}
        </span>
      </div>
      <div className="gestor-heat-card__bar">
        <div className="gestor-heat-card__bar-fill" style={{ width: `${Math.min(capacityPct, 100)}%`, background: heatColor }} />
      </div>
      <div className="gestor-heat-card__stats">
        <span><strong>{gestor.active}</strong> activas</span>
        <span><strong>{gestor.onboarding}</strong> en proceso</span>
        <span><strong>{gestor.completed}</strong> completadas</span>
        {gestor.blocked > 0 && <span style={{ color: '#ef4444' }}><strong>{gestor.blocked}</strong> bloqueadas</span>}
      </div>
    </div>
  )
}

function AlertBadge({ alert }) {
  const priorityColors = { urgent: '#ef4444', high: '#f97316', medium: '#eab308', low: '#6b7280' }
  return (
    <div className="store-alert-badge">
      <span className="store-alert-badge__dot" style={{ background: priorityColors[alert.priority] || '#eab308' }} />
      <span className="store-alert-badge__title">{alert.title}</span>
      <span className="store-alert-badge__type">{alert.alertType}</span>
    </div>
  )
}

export default function StoresHome() {
  const navigate = useNavigate()
  const { clientSlug } = useClient()
  const { getStores, getStoreTickets, getTeam } = useClientData()
  const [stores, storesLoading] = useAsync(getStores, [])
  const [tickets, ticketsLoading] = useAsync(getStoreTickets, [])
  const [team, teamLoading] = useAsync(getTeam, [])

  const loading = storesLoading || ticketsLoading || teamLoading
  const openTickets = useMemo(() => tickets.filter(t => t.status !== 'resolved' && t.status !== 'closed'), [tickets])

  const counts = useMemo(() => {
    const c = { onboarding: 0, active: 0, blocked: 0, completed: 0, total: 0 }
    stores.forEach(s => {
      c.total++
      if (c[s.status] !== undefined) c[s.status]++
    })
    return c
  }, [stores])

  // Build gestor data from stores + team
  const gestors = useMemo(() => {
    // Collect unique gestors from stores
    const gestorMap = new Map()

    stores.forEach(store => {
      const key = store.gestorId || store.gestorName || 'sin_asignar'
      if (!gestorMap.has(key)) {
        gestorMap.set(key, {
          id: store.gestorId,
          name: store.gestorName || 'Sin asignar',
          active: 0,
          onboarding: 0,
          blocked: 0,
          completed: 0,
          total: 0,
          capacity: 8, // default capacity
        })
      }
      const g = gestorMap.get(key)
      g.total++
      if (g[store.status] !== undefined) g[store.status]++
    })

    // Only show team members marked as gestor de tienda
    const gestorTeam = team.filter(m => m.isGestor && m.active !== false)
    gestorTeam.forEach(m => {
      const existing = [...gestorMap.entries()].find(([, v]) => v.id === m.id || v.name === m.name)
      if (existing) {
        existing[1].capacity = m.gestorCapacity || 8
      } else {
        gestorMap.set(m.id || m.name, {
          id: m.id,
          name: m.name,
          active: 0,
          onboarding: 0,
          blocked: 0,
          completed: 0,
          total: 0,
          capacity: m.gestorCapacity || 8,
        })
      }
    })

    // Update capacity for gestor entries matched from stores
    gestorMap.forEach((g) => {
      if (g.id) {
        const teamMember = gestorTeam.find(m => m.id === g.id)
        if (teamMember) g.capacity = teamMember.gestorCapacity || 8
      }
    })

    return [...gestorMap.values()].sort((a, b) => b.active - a.active)
  }, [stores, team])

  // Recent stores (last 5 added)
  const recentStores = useMemo(() => stores.slice(0, 5), [stores])

  return (
    <div className="stores-dashboard">
      {/* KPI Cards */}
      <section className="stores-dashboard__stats">
        <StatCard label="Total Tiendas" value={loading ? '...' : counts.total} color="var(--text)" onClick={() => navigate(`/${clientSlug}/tiendas/lista`)} />
        <StatCard label="En Proceso" value={loading ? '...' : counts.onboarding} color="#3b82f6" />
        <StatCard label="Activas" value={loading ? '...' : counts.active} color="#22c55e" />
        <StatCard label="Bloqueadas" value={loading ? '...' : counts.blocked} color="#ef4444" />
        <StatCard label="Completadas" value={loading ? '...' : counts.completed} color="#a855f7" />
      </section>

      {/* Gestor Heatmap */}
      <section className="stores-dashboard__section">
        <div className="stores-table-header">
          <h3 className="stores-section-title">Capacidad de Gestores</h3>
          <button className="stores-filter-clear" onClick={() => navigate(`/${clientSlug}/tiendas/gestores`)}>
            Ver todos →
          </button>
        </div>
        {loading ? (
          <div className="stores-loading">Cargando gestores...</div>
        ) : gestors.length === 0 ? (
          <div className="stores-empty">No hay gestores configurados</div>
        ) : (
          <div className="gestor-heat-grid">
            {gestors.map((g, i) => (
              <GestorHeatCard
                key={g.id || i}
                gestor={g}
                onClick={() => navigate(`/${clientSlug}/tiendas/gestores`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Tickets */}
      {!loading && openTickets.length > 0 && (
        <section className="stores-dashboard__section">
          <div className="stores-table-header">
            <h3 className="stores-section-title">Tickets Abiertos ({openTickets.length})</h3>
            <button className="stores-filter-clear" onClick={() => navigate(`/${clientSlug}/tiendas/tickets`)}>
              Ver todos →
            </button>
          </div>
          <div className="stores-alerts-list">
            {openTickets.slice(0, 6).map(t => (
              <div key={t.id} className="store-alert-badge" onClick={() => navigate(`/${clientSlug}/tiendas/tickets/${t.id}`)} style={{ cursor: 'pointer' }}>
                <span className="store-alert-badge__dot" style={{ background: t.priority === 'urgent' ? '#ef4444' : t.priority === 'high' ? '#f97316' : '#eab308' }} />
                <span className="store-alert-badge__title">{t.subject}</span>
                <span className="store-alert-badge__type">{t.openedByName || t.openedBy}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent stores */}
      {!loading && recentStores.length > 0 && (
        <section className="stores-dashboard__section">
          <div className="stores-table-header">
            <h3 className="stores-section-title">Últimas Tiendas</h3>
            <button className="stores-filter-clear" onClick={() => navigate(`/${clientSlug}/tiendas/lista`)}>
              Ver todas →
            </button>
          </div>
          <div className="stores-recent-list">
            {recentStores.map(store => (
              <div
                key={store.id}
                className="stores-recent-item"
                onClick={() => navigate(`/${clientSlug}/tiendas/lista/${store.id}`)}
              >
                <div className="stores-recent-item__info">
                  <strong>{store.ownerName}</strong>
                  {store.brandName && <span>{store.brandName}</span>}
                </div>
                <span className="store-status-badge" style={{ background: `${STATUS_COLORS[store.status]}20`, color: STATUS_COLORS[store.status], borderColor: `${STATUS_COLORS[store.status]}40` }}>
                  {store.status === 'onboarding' ? 'En proceso' : store.status === 'active' ? 'Activa' : store.status === 'blocked' ? 'Bloqueada' : store.status === 'completed' ? 'Completada' : store.status}
                </span>
                <span className="stores-recent-item__gestor">{store.gestorName || '—'}</span>
                <span className="store-row__arrow">→</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
