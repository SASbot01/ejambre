import { useState } from 'react'
import { useClientData } from '../hooks/useClientData'
import { useAsync } from '../hooks/useAsync'

export default function PaymentMethodsPage() {
  const { getPaymentFees, addPaymentFee, updatePaymentFee, deletePaymentFee } = useClientData()
  const [fees, feesLoading, refreshFees, setFees] = useAsync(getPaymentFees, [])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ method: '', feeRate: '' })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.method) return
    const data = { method: form.method, feeRate: +form.feeRate / 100 }
    if (editingId) {
      await updatePaymentFee(editingId, data)
    } else {
      await addPaymentFee(data)
    }
    refreshFees()
    setForm({ method: '', feeRate: '' })
    setEditingId(null)
    setShowForm(false)
  }

  const startEdit = (f) => {
    setForm({ method: f.method, feeRate: (f.feeRate * 100).toFixed(2) })
    setEditingId(f.id)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (confirm('¿Eliminar este método de pago?')) {
      await deletePaymentFee(id)
      refreshFees()
    }
  }

  const cancel = () => {
    setShowForm(false)
    setEditingId(null)
    setForm({ method: '', feeRate: '' })
  }

  const fmt = (n) => `€${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  if (feesLoading) return <div className="dashboard"><div style={{textAlign:'center',padding:60,color:'#999'}}>Cargando métodos...</div></div>

  return (
    <div className="dashboard">
      <div className="dashboard-actions" style={{ marginBottom: 24 }}>
        <button className="btn-action" onClick={() => { cancel(); setShowForm(true) }}>+ Añadir Método</button>
      </div>

      {showForm && (
        <div className="form-card" style={{ marginBottom: 28 }}>
          <h3 className="form-title">{editingId ? 'Editar Método' : 'Nuevo Método de Pago'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Nombre del método</label>
                <input value={form.method} onChange={e => setForm({...form, method: e.target.value})} placeholder="Ej: Stripe, PayPal..." required />
              </div>
              <div className="form-group">
                <label>Comisión (%)</label>
                <input type="number" step="0.01" min="0" max="100" value={form.feeRate} onChange={e => setForm({...form, feeRate: e.target.value})} placeholder="2.9" required />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn-action btn-action--secondary" onClick={cancel}>Cancelar</button>
              <button type="submit" className="btn-action">{editingId ? 'Guardar' : 'Añadir'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Método de Pago</th>
              <th>Comisión</th>
              <th>Ejemplo: €1.000</th>
              <th>Neto</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {fees.map(f => (
              <tr key={f.id}>
                <td className="cell-bold">{f.method}</td>
                <td>{(f.feeRate * 100).toFixed(2)}%</td>
                <td className="cell-money" style={{ color: 'var(--danger)' }}>-{fmt(1000 * f.feeRate)}</td>
                <td className="cell-money">{fmt(1000 * (1 - f.feeRate))}</td>
                <td className="actions-cell">
                  <button className="btn-sm btn-sm--edit" onClick={() => startEdit(f)}>✎</button>
                  <button className="btn-sm btn-sm--delete" onClick={() => handleDelete(f.id)}>🗑</button>
                </td>
              </tr>
            ))}
            {fees.length === 0 && (
              <tr><td colSpan={5} className="cell-muted" style={{ padding: 24 }}>No hay métodos de pago configurados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
