import { useState, useEffect } from 'react'
import { getAdminDashboardData } from '../../utils/data'

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAdminDashboardData()
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="admin-loading">Cargando dashboard...</div>
  if (!data) return <div className="admin-loading">Error al cargar datos</div>

  const now = new Date()
  const monthName = now.toLocaleString('es-ES', { month: 'long', year: 'numeric' })

  return (
    <div className="admin-dashboard">
      <h2 className="admin-section-title">Resumen Global — {monthName}</h2>

      <div className="admin-stats-grid">
        <div className="admin-stat-card admin-stat-card--primary">
          <div className="admin-stat-label">CashConnect Total</div>
          <div className="admin-stat-value">{fmt(data.totalCash)}€</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Revenue Total</div>
          <div className="admin-stat-value">{fmt(data.totalRevenue)}€</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Net Cash Total</div>
          <div className="admin-stat-value">{fmt(data.totalNetCash)}€</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Ventas Totales</div>
          <div className="admin-stat-value">{data.totalSales}</div>
        </div>
        <div className="admin-stat-card admin-stat-card--gold">
          <div className="admin-stat-label">Mi Comisión Total</div>
          <div className="admin-stat-value">{fmt(data.totalCommission)}€</div>
        </div>
      </div>

      <h2 className="admin-section-title" style={{ marginTop: '40px' }}>Desglose por Cliente</h2>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Revenue</th>
              <th>Cash</th>
              <th>Ventas</th>
              <th>Tasa</th>
              <th>Mi Comisión</th>
            </tr>
          </thead>
          <tbody>
            {data.clients.map(c => (
              <tr key={c.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {c.logoUrl && <img src={c.logoUrl} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />}
                    <span>{c.name}</span>
                  </div>
                </td>
                <td>{fmt(c.monthRevenue)}€</td>
                <td>{fmt(c.monthCash)}€</td>
                <td>{c.monthSales}</td>
                <td>{(c.commissionRate * 100).toFixed(0)}%</td>
                <td style={{ color: '#C4944A', fontWeight: 700 }}>{fmt(c.commissionEarned)}€</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
