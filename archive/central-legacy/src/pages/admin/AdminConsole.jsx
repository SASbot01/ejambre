import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAdminDashboardData, updateSuperAdminCommission } from '../../utils/data'

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

export default function AdminConsole() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editingClient, setEditingClient] = useState(null)
  const [editRate, setEditRate] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const d = await getAdminDashboardData()
      setData(d)
    } finally {
      setLoading(false)
    }
  }

  function handleCardClick(slug) {
    // Set superadmin session for this client
    localStorage.setItem(`bw_client_${slug}_user`, localStorage.getItem('bw_superadmin'))
    localStorage.setItem(`bw_client_${slug}_usertype`, 'team')
    navigate(`/${slug}`)
  }

  async function handleSaveRate(clientId) {
    const rate = parseFloat(editRate) / 100
    if (isNaN(rate)) return
    await updateSuperAdminCommission(clientId, rate)
    setEditingClient(null)
    setEditRate('')
    setLoading(true)
    loadData()
  }

  if (loading) return <div className="admin-loading">Cargando consola...</div>
  if (!data) return <div className="admin-loading">Error al cargar datos</div>

  return (
    <div className="admin-console">
      <h2 className="admin-section-title">Consola Central</h2>
      <p className="admin-section-subtitle">Selecciona un cliente para acceder a su dashboard</p>

      <div className="admin-clients-grid">
        {data.clients.map(client => (
          <div key={client.id} className="admin-client-card">
            <div className="admin-client-card-header" onClick={() => handleCardClick(client.slug)}>
              <div className="admin-client-logo-wrap">
                {client.logoUrl ? (
                  <img src={client.logoUrl} alt={client.name} className="admin-client-logo" />
                ) : (
                  <div className="admin-client-logo-placeholder">{client.name[0]}</div>
                )}
              </div>
              <div className="admin-client-info">
                <h3 className="admin-client-name">{client.name}</h3>
                <span className={`admin-client-status ${client.active !== false ? 'admin-client-status--active' : ''}`}>
                  {client.active !== false ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>

            <div className="admin-client-metrics">
              <div className="admin-client-metric">
                <span className="admin-client-metric-label">Revenue</span>
                <span className="admin-client-metric-value">{fmt(client.monthRevenue)}€</span>
              </div>
              <div className="admin-client-metric">
                <span className="admin-client-metric-label">Cash</span>
                <span className="admin-client-metric-value">{fmt(client.monthCash)}€</span>
              </div>
              <div className="admin-client-metric">
                <span className="admin-client-metric-label">Ventas</span>
                <span className="admin-client-metric-value">{client.monthSales}</span>
              </div>
            </div>

            <div className="admin-client-commission">
              <div className="admin-client-commission-row">
                <span>Comisión:</span>
                {editingClient === client.id ? (
                  <div className="admin-commission-edit">
                    <input
                      type="number"
                      value={editRate}
                      onChange={e => setEditRate(e.target.value)}
                      className="admin-commission-input"
                      placeholder="%"
                      min="0"
                      max="100"
                      step="0.1"
                      autoFocus
                      onClick={e => e.stopPropagation()}
                    />
                    <button className="admin-commission-save" onClick={(e) => { e.stopPropagation(); handleSaveRate(client.id) }}>✓</button>
                    <button className="admin-commission-cancel" onClick={(e) => { e.stopPropagation(); setEditingClient(null) }}>✕</button>
                  </div>
                ) : (
                  <span
                    className="admin-commission-rate"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingClient(client.id)
                      setEditRate(String(client.commissionRate * 100))
                    }}
                    title="Click para editar"
                  >
                    {(client.commissionRate * 100).toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="admin-client-commission-earned">
                Ganado este mes: <strong>{fmt(client.commissionEarned)}€</strong>
              </div>
            </div>

            <button
              className="admin-client-enter-btn"
              onClick={() => handleCardClick(client.slug)}
            >
              Acceder al Dashboard →
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
