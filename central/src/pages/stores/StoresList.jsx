import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClient } from '../../contexts/ClientContext'
import { useClientData } from '../../hooks/useClientData'
import { useAsync } from '../../hooks/useAsync'
import StoreCreationModal from '../../components/StoreCreationModal'

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

function StoreRow({ store, onClick }) {
  const progress = store.totalSteps ? Math.round((store.currentStep - 1) / store.totalSteps * 100) : 0
  return (
    <tr className="store-row" onClick={onClick}>
      <td>
        <div className="store-row__owner">
          <strong>{store.ownerName}</strong>
          {store.brandName && <span className="store-row__brand">{store.brandName}</span>}
        </div>
      </td>
      <td>
        <span className="store-status-badge" style={{ background: `${STATUS_COLORS[store.status]}20`, color: STATUS_COLORS[store.status], borderColor: `${STATUS_COLORS[store.status]}40` }}>
          {STATUS_LABELS[store.status] || store.status}
        </span>
      </td>
      <td>{store.gestorName || '—'}</td>
      <td>{store.productName || '—'}</td>
      <td>
        {store.status === 'onboarding' ? (
          <div className="store-row__progress">
            <div className="store-row__progress-bar">
              <div className="store-row__progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="store-row__progress-text">{store.currentStep}/{store.totalSteps}</span>
          </div>
        ) : store.status === 'active' ? (
          <span style={{ color: '#22c55e' }}>Seguimiento</span>
        ) : '—'}
      </td>
      <td className="store-row__arrow">→</td>
    </tr>
  )
}

export default function StoresList({ gestorId }) {
  const navigate = useNavigate()
  const { clientSlug } = useClient()
  const { getStores } = useClientData()
  const [allStores, loading, refreshStores] = useAsync(getStores, [])
  const stores = useMemo(() => gestorId ? allStores.filter(s => s.gestorId === gestorId) : allStores, [allStores, gestorId])
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const counts = useMemo(() => {
    const c = { onboarding: 0, active: 0, blocked: 0, completed: 0, total: 0 }
    stores.forEach(s => { c.total++; if (c[s.status] !== undefined) c[s.status]++ })
    return c
  }, [stores])

  const filtered = useMemo(() => {
    let list = stores
    if (statusFilter !== 'all') list = list.filter(s => s.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        (s.ownerName || '').toLowerCase().includes(q) ||
        (s.brandName || '').toLowerCase().includes(q) ||
        (s.gestorName || '').toLowerCase().includes(q) ||
        (s.productName || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [stores, statusFilter, search])

  const filterButtons = [
    { key: 'all', label: 'Todas', count: counts.total, color: 'var(--text)' },
    { key: 'onboarding', label: 'En proceso', count: counts.onboarding, color: '#3b82f6' },
    { key: 'active', label: 'Activas', count: counts.active, color: '#22c55e' },
    { key: 'blocked', label: 'Bloqueadas', count: counts.blocked, color: '#ef4444' },
    { key: 'completed', label: 'Completadas', count: counts.completed, color: '#a855f7' },
  ]

  return (
    <div className="stores-list-page">
      {/* Filters */}
      <div className="stores-list-page__filters">
        <button className="btn-action" onClick={() => setShowCreate(true)}>+ Nueva Tienda</button>
        <div className="stores-filter-pills">
          {filterButtons.map(f => (
            <button
              key={f.key}
              className={`stores-filter-pill ${statusFilter === f.key ? 'stores-filter-pill--active' : ''}`}
              onClick={() => setStatusFilter(f.key)}
              style={statusFilter === f.key ? { borderColor: f.color, color: f.color } : {}}
            >
              {f.label} <span className="stores-filter-pill__count">{f.count}</span>
            </button>
          ))}
        </div>
        <input
          className="stores-search"
          type="text"
          placeholder="Buscar tienda, gestor, producto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="stores-loading">Cargando tiendas...</div>
      ) : filtered.length === 0 ? (
        <div className="stores-empty">
          {search ? `Sin resultados para "${search}"` : 'No hay tiendas con este filtro'}
        </div>
      ) : (
        <div className="stores-table-wrap">
          <table className="stores-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Estado</th>
                <th>Gestor</th>
                <th>Producto</th>
                <th>Progreso</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(store => (
                <StoreRow
                  key={store.id}
                  store={store}
                  onClick={() => navigate(`/${clientSlug}/tiendas/lista/${store.id}`)}
                />
              ))}
            </tbody>
          </table>
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
