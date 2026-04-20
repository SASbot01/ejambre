import { useState, useMemo } from 'react'
import { useClientData } from '../hooks/useClientData'
import { useAsync } from '../hooks/useAsync'
import { hasRole, getRoles, getPrimaryRole } from '../utils/roles'

const ROLE_LABELS = { director: 'Director', manager: 'Manager', closer: 'Closer', setter: 'Setter' }

export default function CommissionsPage({ user, role: userRole }) {
  const { getSalesWithNetCash, getTeam, getCommissionPayments, upsertCommissionPayment, toggleCommissionPaid } = useClientData()
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [sortBy, setSortBy] = useState('commission-desc')
  const [filterStatus, setFilterStatus] = useState('all') // 'all', 'pending', 'paid'
  const [savingIds, setSavingIds] = useState(new Set())

  const [team, teamLoading] = useAsync(getTeam, [])
  const [allSales, salesLoading] = useAsync(getSalesWithNetCash, [])
  const [payments, paymentsLoading, refreshPayments] = useAsync(getCommissionPayments, [])

  const primaryUserRole = getPrimaryRole(userRole)
  const isRestricted = primaryUserRole === 'closer' || primaryUserRole === 'setter'
  const isAdmin = primaryUserRole === 'ceo' || primaryUserRole === 'director' || primaryUserRole === 'manager'

  // Period dates for the selected month
  const [periodYear, periodMonth] = month.split('-').map(Number)
  const periodStart = `${month}-01`
  const lastDay = new Date(periodYear, periodMonth, 0).getDate()
  const periodEnd = `${month}-${lastDay}`
  const periodMid = `${month}-15`

  // Half selector: 1-15 or 16-end (since they pay every 15 days)
  const [half, setHalf] = useState('full') // 'full', 'first', 'second'

  // Build payment lookup (must be before any early returns — React hooks rule)
  const paymentMap = useMemo(() => {
    const map = {}
    ;(payments || []).forEach(p => {
      const key = `${p.memberId}-${p.role}-${p.periodStart}`
      map[key] = p
    })
    return map
  }, [payments])

  const loading = teamLoading || salesLoading || paymentsLoading
  if (loading) return <div className="dashboard"><div style={{textAlign:'center',padding:60,color:'#999'}}>Cargando comisiones...</div></div>

  const monthSales = allSales.filter(s => s.date.startsWith(month))

  // Filter by half if selected
  const filteredSales = half === 'first'
    ? monthSales.filter(s => s.date <= periodMid)
    : half === 'second'
    ? monthSales.filter(s => s.date > periodMid)
    : monthSales

  const halfStart = half === 'second' ? `${month}-16` : periodStart
  const halfEnd = half === 'first' ? periodMid : periodEnd

  // Build commission lines
  const allCommissions = []

  team.filter(m => m.active).forEach(m => {
    const roles = getRoles(m.role)
    // Separate start dates per role type
    const closerSetterStart = m.commissionStartDate || null
    const mgmtStart = m.mgmtCommissionStartDate || null

    // Sales filtered by closer/setter start date
    const csFilteredSales = closerSetterStart
      ? filteredSales.filter(s => s.date >= closerSetterStart)
      : filteredSales
    // Sales filtered by mgmt start date
    const mgmtFilteredSales = mgmtStart
      ? filteredSales.filter(s => s.date >= mgmtStart)
      : filteredSales

    const totalNetCash = mgmtFilteredSales.reduce((s, v) => s + v.netCash, 0)
    const closerCash = csFilteredSales.filter(s => s.closer === m.name).reduce((s, v) => s + v.netCash, 0)
    const setterCash = csFilteredSales.filter(s => s.setter === m.name).reduce((s, v) => s + v.netCash, 0)

    const isMultiRole = (roles.includes('closer') || roles.includes('setter')) &&
      (roles.includes('manager') || roles.includes('director'))

    const addLine = (lineRole, cash, rate, startDate) => {
      const paymentKey = `${m.id}-${lineRole}-${halfStart}`
      const existingPayment = paymentMap[paymentKey]
      allCommissions.push({
        ...m,
        lineRole,
        lineKey: `${m.id}-${lineRole}`,
        cash,
        rate,
        commission: Math.round(cash * rate),
        lineStartDate: startDate || null,
        paymentId: existingPayment?.id || null,
        paymentStatus: existingPayment?.status || 'pending',
        paidAt: existingPayment?.paidAt || null,
      })
    }

    if (isMultiRole) {
      if (roles.includes('closer')) {
        addLine('closer', closerCash, m.closerCommissionRate || m.commissionRate, closerSetterStart)
      }
      if (roles.includes('setter')) {
        addLine('setter', setterCash, m.setterCommissionRate || m.commissionRate, closerSetterStart)
      }
      const mgmtRole = roles.includes('director') ? 'director' : 'manager'
      addLine(mgmtRole, totalNetCash, m.commissionRate, mgmtStart)
    } else {
      if (roles.includes('closer')) {
        addLine('closer', closerCash, m.closerCommissionRate || m.commissionRate, closerSetterStart)
      } else if (roles.includes('setter')) {
        addLine('setter', setterCash, m.setterCommissionRate || m.commissionRate, closerSetterStart)
      } else {
        const primaryRole = getPrimaryRole(m.role)
        addLine(primaryRole, totalNetCash, m.commissionRate, mgmtStart)
      }
    }
  })

  // Sorting
  const sortedCommissions = [...allCommissions].sort((a, b) => {
    // Always put zeros at the bottom
    if (a.commission === 0 && b.commission !== 0) return 1
    if (b.commission === 0 && a.commission !== 0) return -1
    switch (sortBy) {
      case 'commission-desc': return b.commission - a.commission
      case 'commission-asc': return a.commission - b.commission
      case 'cash-desc': return b.cash - a.cash
      case 'cash-asc': return a.cash - b.cash
      case 'name-asc': return a.name.localeCompare(b.name)
      default: return b.commission - a.commission
    }
  })

  // Filter by payment status
  const statusFiltered = filterStatus === 'all'
    ? sortedCommissions
    : sortedCommissions.filter(c => c.paymentStatus === filterStatus)

  const commissions = isRestricted
    ? statusFiltered.filter(c => c.email === user)
    : statusFiltered

  const totalCommissions = allCommissions.reduce((s, c) => s + c.commission, 0)
  const closerCommissions = allCommissions.filter(c => c.lineRole === 'closer').reduce((s, c) => s + c.commission, 0)
  const setterCommissions = allCommissions.filter(c => c.lineRole === 'setter').reduce((s, c) => s + c.commission, 0)
  const otherCommissions = totalCommissions - closerCommissions - setterCommissions
  const pendingTotal = allCommissions.filter(c => c.paymentStatus !== 'paid').reduce((s, c) => s + c.commission, 0)
  const paidTotal = allCommissions.filter(c => c.paymentStatus === 'paid').reduce((s, c) => s + c.commission, 0)

  const myCommissions = isRestricted ? commissions : []
  const myTotal = myCommissions.reduce((s, c) => s + c.commission, 0)
  const myCash = myCommissions.reduce((s, c) => s + c.cash, 0)

  const fmt = (n) => `\u20AC${Math.round(n).toLocaleString('es-ES')}`

  const handleTogglePaid = async (c) => {
    const newStatus = c.paymentStatus === 'paid' ? 'pending' : 'paid'
    const key = c.lineKey
    setSavingIds(prev => new Set([...prev, key]))

    if (c.paymentId) {
      await toggleCommissionPaid(c.paymentId, newStatus === 'paid')
    } else {
      await upsertCommissionPayment({
        memberId: c.id,
        periodStart: halfStart,
        periodEnd: halfEnd,
        role: c.lineRole,
        cashBase: c.cash,
        rate: c.rate,
        commissionAmount: c.commission,
        status: newStatus,
        paidAt: newStatus === 'paid' ? new Date().toISOString() : null,
      })
    }
    await refreshPayments()
    setSavingIds(prev => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }

  return (
    <div className="dashboard">
      <div className="filters-bar">
        <div className="filters-left">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="filter-select" style={{ minWidth: 160, colorScheme: 'dark' }} />
          {!isRestricted && (
            <div className="role-toggle" style={{ marginLeft: 12 }}>
              <button type="button" className={`role-btn ${half === 'full' ? 'role-btn--active' : ''}`} onClick={() => setHalf('full')}>Mes</button>
              <button type="button" className={`role-btn ${half === 'first' ? 'role-btn--active' : ''}`} onClick={() => setHalf('first')}>1-15</button>
              <button type="button" className={`role-btn ${half === 'second' ? 'role-btn--active' : ''}`} onClick={() => setHalf('second')}>16-{lastDay}</button>
            </div>
          )}
        </div>
        {!isRestricted && (
          <div className="filters-right" style={{ display: 'flex', gap: 8 }}>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="filter-select" style={{ minWidth: 130 }}>
              <option value="all">Todos</option>
              <option value="pending">Por Pagar</option>
              <option value="paid">Pagado</option>
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="filter-select" style={{ minWidth: 180 }}>
              <option value="commission-desc">Comision mayor a menor</option>
              <option value="commission-asc">Comision menor a mayor</option>
              <option value="cash-desc">Cash mayor a menor</option>
              <option value="cash-asc">Cash menor a mayor</option>
              <option value="name-asc">Nombre A-Z</option>
            </select>
          </div>
        )}
      </div>

      {/* Summary cards */}
      {isRestricted ? (
        <div className="stats-grid stats-grid--3">
          <div className="stat-card">
            <div className="stat-card-icon">💸</div>
            <div className="stat-card-value">{fmt(myTotal)}</div>
            <div className="stat-card-label">Mi Comision</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon">💰</div>
            <div className="stat-card-value">{fmt(myCash)}</div>
            <div className="stat-card-label">Cash Neto Base</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon">📊</div>
            <div className="stat-card-value">{myCommissions.length > 0 ? parseFloat((myCommissions[0].rate * 100).toFixed(1)) : 0}%</div>
            <div className="stat-card-label">Mi Tasa</div>
          </div>
        </div>
      ) : (
        <>
          <div className="stats-grid stats-grid--4">
            <div className="stat-card">
              <div className="stat-card-icon">💸</div>
              <div className="stat-card-value">{fmt(totalCommissions)}</div>
              <div className="stat-card-label">Total Comisiones</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon">📞</div>
              <div className="stat-card-value">{fmt(closerCommissions)}</div>
              <div className="stat-card-label">Closers</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon">💬</div>
              <div className="stat-card-value">{fmt(setterCommissions)}</div>
              <div className="stat-card-label">Setters</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon">👤</div>
              <div className="stat-card-value">{fmt(otherCommissions)}</div>
              <div className="stat-card-label">Managers/Directors</div>
            </div>
          </div>
          <div className="stats-grid stats-grid--2" style={{ marginTop: 0 }}>
            <div className="stat-card" style={{ borderLeft: '3px solid var(--success)' }}>
              <div className="stat-card-value" style={{ color: 'var(--success)' }}>{fmt(paidTotal)}</div>
              <div className="stat-card-label">Pagado</div>
            </div>
            <div className="stat-card" style={{ borderLeft: '3px solid #f59e0b' }}>
              <div className="stat-card-value" style={{ color: '#f59e0b' }}>{fmt(pendingTotal)}</div>
              <div className="stat-card-label">Por Pagar</div>
            </div>
          </div>
        </>
      )}

      {/* Commission Table */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Rol Comision</th>
              <th>Cash Neto</th>
              <th>Tasa</th>
              <th>Comision</th>
              <th>Desde</th>
              <th>Estado</th>
              {isAdmin && <th>Pago</th>}
            </tr>
          </thead>
          <tbody>
            {commissions.map(c => {
              const isPaid = c.paymentStatus === 'paid'
              const isSaving = savingIds.has(c.lineKey)
              return (
                <tr key={c.lineKey} className={c.commission > 0 ? 'commission-row--has' : ''} style={isPaid ? { opacity: 0.6 } : {}}>
                  <td className="cell-bold">{c.name}</td>
                  <td><span className={`badge badge--${c.lineRole}`}>{ROLE_LABELS[c.lineRole]}</span></td>
                  <td className="cell-money">{fmt(c.cash)}</td>
                  <td>{parseFloat((c.rate * 100).toFixed(1))}%</td>
                  <td className="cell-money" style={{ color: c.commission > 0 ? 'var(--success)' : 'var(--text-muted)' }}>{fmt(c.commission)}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{c.lineStartDate || '-'}</td>
                  <td><span className={`badge ${c.active ? 'badge--completada' : 'badge--reembolso'}`}>{c.active ? 'Activo' : 'Inactivo'}</span></td>
                  {isAdmin && (
                    <td>
                      {c.commission > 0 ? (
                        <button
                          className={`btn-sm ${isPaid ? 'btn-sm--edit' : 'btn-sm--delete'}`}
                          onClick={() => handleTogglePaid(c)}
                          disabled={isSaving}
                          style={{
                            padding: '4px 12px',
                            fontSize: '0.78rem',
                            minWidth: 80,
                            background: isPaid ? 'var(--success)' : 'transparent',
                            color: isPaid ? '#fff' : '#f59e0b',
                            border: isPaid ? 'none' : '1px solid #f59e0b',
                            borderRadius: 6,
                            cursor: isSaving ? 'wait' : 'pointer',
                          }}
                          title={isPaid ? `Pagado el ${c.paidAt ? new Date(c.paidAt).toLocaleDateString('es-ES') : ''}` : 'Marcar como pagado'}
                        >
                          {isSaving ? '...' : isPaid ? 'Pagado' : 'Por pagar'}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>-</span>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
            {commissions.length === 0 && (
              <tr><td colSpan={isAdmin ? 8 : 7} className="cell-muted" style={{ padding: 24 }}>Sin datos de equipo</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
