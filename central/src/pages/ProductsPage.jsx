import { useState } from 'react'
import { useClientData } from '../hooks/useClientData'
import { useAsync } from '../hooks/useAsync'

export default function ProductsPage() {
  const { getProducts, addProduct, updateProduct, deleteProduct } = useClientData()
  const [products, productsLoading, refreshProducts] = useAsync(getProducts, [])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', price: '', active: true })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name) return
    const data = { name: form.name, price: +form.price || 0, active: form.active }
    if (editingId) {
      await updateProduct(editingId, data)
    } else {
      await addProduct(data)
    }
    refreshProducts()
    setForm({ name: '', price: '', active: true })
    setEditingId(null)
    setShowForm(false)
  }

  const startEdit = (p) => {
    setForm({ name: p.name, price: p.price || '', active: p.active !== false })
    setEditingId(p.id)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (confirm('¿Eliminar este producto?')) {
      await deleteProduct(id)
      refreshProducts()
    }
  }

  const cancel = () => {
    setShowForm(false)
    setEditingId(null)
    setForm({ name: '', price: '', active: true })
  }

  const fmt = (n) => `€${Number(n || 0).toLocaleString('es-ES')}`

  if (productsLoading) return <div className="dashboard"><div style={{textAlign:'center',padding:60,color:'#999'}}>Cargando productos...</div></div>

  return (
    <div className="dashboard">
      <div className="dashboard-actions" style={{ marginBottom: 24 }}>
        <button className="btn-action" onClick={() => { cancel(); setShowForm(true) }}>+ Añadir Producto</button>
      </div>

      {showForm && (
        <div className="form-card" style={{ marginBottom: 28 }}>
          <h3 className="form-title">{editingId ? 'Editar Producto' : 'Nuevo Producto'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Nombre del producto</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ej: Curso Premium, Mentoring..." required />
              </div>
              <div className="form-group">
                <label>Precio (€)</label>
                <input type="number" step="0.01" min="0" value={form.price} onChange={e => setForm({...form, price: e.target.value})} placeholder="2997" />
              </div>
              <div className="form-group">
                <label>Estado</label>
                <select value={form.active ? 'true' : 'false'} onChange={e => setForm({...form, active: e.target.value === 'true'})}>
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
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
              <th>Producto</th>
              <th>Precio</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id}>
                <td className="cell-bold">{p.name}</td>
                <td className="cell-money">{fmt(p.price)}</td>
                <td>
                  <span className={`badge badge--${p.active !== false ? 'completada' : 'pendiente'}`}>
                    {p.active !== false ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="actions-cell">
                  <button className="btn-sm btn-sm--edit" onClick={() => startEdit(p)}>✎</button>
                  <button className="btn-sm btn-sm--delete" onClick={() => handleDelete(p.id)}>🗑</button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={4} className="cell-muted" style={{ padding: 24 }}>No hay productos configurados. Añade tu primer producto.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
