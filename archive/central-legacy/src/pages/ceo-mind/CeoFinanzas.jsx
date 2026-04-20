import { useState, useEffect } from 'react'
import { useAsync } from '../../hooks/useAsync'
import { useClientData } from '../../hooks/useClientData'

const CATEGORIES = ['operativo', 'equipo', 'marketing', 'herramientas', 'otro']
const CAT_LABELS = { operativo: 'Operativo', equipo: 'Equipo', marketing: 'Marketing', herramientas: 'Herramientas', otro: 'Otro' }
const EMPTY_FORM = { date: '', category: 'operativo', description: '', amount: '', recurring: false, notes: '' }

function fmtMoney(n) { return `€${Math.round(n).toLocaleString('es-ES')}` }

function getMonthLabel(ym) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1).toLocaleDateString('es', { month: 'long', year: 'numeric' })
}

export default function CeoFinanzas() {
  const {
    getCeoFinanceEntries, addCeoFinanceEntry, updateCeoFinanceEntry,
    deleteCeoFinanceEntry, getCeoFinanceSummary
  } = useClientData()

  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const [entries, loadingEntries, refreshEntries] = useAsync(getCeoFinanceEntries, [])
  const [summary, setSummary] = useState(null)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setLoadingSummary(true)
    getCeoFinanceSummary(month)
      .then(s => { setSummary(s); setLoadingSummary(false) })
      .catch(() => setLoadingSummary(false))
  }, [month, getCeoFinanceSummary, refreshKey])

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [categoryFilter, setCategoryFilter] = useState('all')

  function prevMonth() {
    setMonth(prev => {
      const [y, m] = prev.split('-').map(Number)
      const d = new Date(y, m - 2, 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })
  }
  function nextMonth() {
    setMonth(prev => {
      const [y, m] = prev.split('-').map(Number)
      const d = new Date(y, m, 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })
  }

  const monthEntries = entries.filter(e => e.date && e.date.startsWith(month))
  const filteredEntries = categoryFilter === 'all'
    ? monthEntries
    : monthEntries.filter(e => e.category === categoryFilter)

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      const payload = { ...form, amount: parseFloat(form.amount) || 0 }
      if (editingId) {
        await updateCeoFinanceEntry(editingId, payload)
      } else {
        await addCeoFinanceEntry(payload)
      }
      await refreshEntries()
      setRefreshKey(k => k + 1)
      cancelForm()
    } catch (err) {
      alert('Error: ' + (err.message || 'No se pudo guardar'))
    }
  }

  function startEdit(entry) {
    setForm({ date: entry.date, category: entry.category, description: entry.description, amount: entry.amount, recurring: entry.recurring || false, notes: entry.notes || '' })
    setEditingId(entry.id)
    setShowForm(true)
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este gasto?')) return
    try {
      await deleteCeoFinanceEntry(id)
      await refreshEntries()
      setRefreshKey(k => k + 1)
    } catch (err) {
      alert('Error: ' + (err.message || 'No se pudo eliminar'))
    }
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().split('T')[0] })
  }

  const loading = loadingEntries || loadingSummary
  const s = summary || {}

  return (
    <div className="form-page">
      <div className="ceo-section-header">
        <h2 style={{ margin: 0, color: '#fff' }}>💰 Finanzas</h2>
        <div className="ceo-week-selector">
          <button onClick={prevMonth}>← Anterior</button>
          <span>{getMonthLabel(month)}</span>
          <button onClick={nextMonth}>Siguiente →</button>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="stats-grid stats-grid--4" style={{ margin: '24px 0' }}>
        <div className="stat-card">
          <div className="stat-card-icon">📈</div>
          <div className="stat-card-value" style={{ color: 'var(--success)' }}>{loading ? '...' : fmtMoney(s.revenue || 0)}</div>
          <div className="stat-card-label">Ingresos</div>
          <div className="stat-card-sub">{s.salesCount || 0} ventas</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">👥</div>
          <div className="stat-card-value">{loading ? '...' : fmtMoney(s.commissions || 0)}</div>
          <div className="stat-card-label">Comisiones</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">📋</div>
          <div className="stat-card-value" style={{ color: 'var(--danger)' }}>{loading ? '...' : fmtMoney(s.opex || 0)}</div>
          <div className="stat-card-label">Gastos Operativos</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">🎯</div>
          <div className="stat-card-value" style={{ color: (s.netProfit || 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>{loading ? '...' : fmtMoney(s.netProfit || 0)}</div>
          <div className="stat-card-label">Beneficio Neto</div>
        </div>
      </div>

      {/* Cash flow breakdown */}
      <div className="form-card" style={{ marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 16px', color: '#fff', fontSize: '0.95rem' }}>Desglose Cash Flow</h3>
        {loading ? <p style={{ color: '#666' }}>Cargando...</p> : (
          <table className="data-table ceo-finance-breakdown">
            <tbody>
              <tr>
                <td>Ingresos (Revenue)</td>
                <td className="ceo-finance-positive" style={{ textAlign: 'right' }}>+{fmtMoney(s.revenue || 0)}</td>
              </tr>
              <tr>
                <td>Fees plataformas de pago</td>
                <td className="ceo-finance-negative" style={{ textAlign: 'right' }}>-{fmtMoney(s.fees || 0)}</td>
              </tr>
              <tr className="ceo-finance-subtotal">
                <td>Cash Neto</td>
                <td style={{ textAlign: 'right' }}>{fmtMoney(s.netCash || 0)}</td>
              </tr>
              <tr>
                <td>Comisiones equipo</td>
                <td className="ceo-finance-negative" style={{ textAlign: 'right' }}>-{fmtMoney(s.commissions || 0)}</td>
              </tr>
              <tr>
                <td>Gastos operativos</td>
                <td className="ceo-finance-negative" style={{ textAlign: 'right' }}>-{fmtMoney(s.opex || 0)}</td>
              </tr>
              {Object.entries(s.opexByCategory || {}).map(([cat, amt]) => (
                <tr key={cat} style={{ fontSize: '0.8rem' }}>
                  <td style={{ paddingLeft: 32, color: '#666' }}>{CAT_LABELS[cat] || cat}</td>
                  <td style={{ textAlign: 'right', color: '#666' }}>-{fmtMoney(amt)}</td>
                </tr>
              ))}
              <tr className="ceo-finance-total">
                <td>Beneficio Neto</td>
                <td style={{ textAlign: 'right', color: (s.netProfit || 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmtMoney(s.netProfit || 0)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Expense entries section */}
      <div className="ceo-section-header">
        <h3 style={{ margin: 0, color: '#fff', fontSize: '0.95rem' }}>Gastos Operativos</h3>
        <button className="btn-action" onClick={() => { cancelForm(); setShowForm(true) }}>+ Nuevo Gasto</button>
      </div>

      <div style={{ margin: '12px 0' }}>
        <div className="ceo-view-toggle">
          <button className={`ceo-view-btn ${categoryFilter === 'all' ? 'ceo-view-btn--active' : ''}`} onClick={() => setCategoryFilter('all')}>Todos</button>
          {CATEGORIES.map(c => (
            <button key={c} className={`ceo-view-btn ${categoryFilter === c ? 'ceo-view-btn--active' : ''}`} onClick={() => setCategoryFilter(c)}>{CAT_LABELS[c]}</button>
          ))}
        </div>
      </div>

      {showForm && (
        <div className="form-card" style={{ marginBottom: 20 }}>
          <h3 className="form-title">{editingId ? 'Editar Gasto' : 'Nuevo Gasto'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid form-grid--3">
              <div className="form-group">
                <label>Fecha</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Categoría</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Monto (€)</label>
                <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Descripción</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={form.recurring} onChange={e => setForm({ ...form, recurring: e.target.checked })} />
                  Recurrente
                </label>
              </div>
            </div>
            <div className="form-group" style={{ marginTop: 8 }}>
              <label>Notas</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="form-actions">
              <button type="button" className="btn-action btn-action--secondary" onClick={cancelForm}>Cancelar</button>
              <button type="submit" className="btn-action">{editingId ? 'Guardar' : 'Añadir'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Monto</th><th>Rec.</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {filteredEntries.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#666' }}>No hay gastos para este mes</td></tr>
            )}
            {filteredEntries.map(entry => (
              <tr key={entry.id}>
                <td>{entry.date}</td>
                <td><span className={`badge badge--${entry.category}`}>{CAT_LABELS[entry.category] || entry.category}</span></td>
                <td style={{ color: '#fff' }}>{entry.description}</td>
                <td style={{ fontWeight: 600 }}>{fmtMoney(entry.amount)}</td>
                <td>{entry.recurring ? '🔄' : '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-sm btn-sm--edit" onClick={() => startEdit(entry)}>✎</button>
                    <button className="btn-sm btn-sm--delete" onClick={() => handleDelete(entry.id)}>🗑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
