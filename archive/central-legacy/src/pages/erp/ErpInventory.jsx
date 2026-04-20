import { useState, useEffect } from 'react'
import { useErp } from './ErpApp'
import { getErpProducts, addErpProduct, updateErpProduct, deleteErpProduct, addErpStockMove, getErpStockMoves } from '../../utils/erp-data'

const fmt = (v) => Number(v || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })

export default function ErpInventory() {
  const { companyId } = useErp()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [showStock, setShowStock] = useState(null)
  const [stockQty, setStockQty] = useState('')
  const [stockType, setStockType] = useState('in')
  const [stockRef, setStockRef] = useState('')
  const [form, setForm] = useState({ name: '', sku: '', type: 'product', category: '', description: '', sale_price: '', cost_price: '', tax_rate: 21, unit: 'ud', stock_qty: 0, min_stock: 0, track_stock: true })

  const load = () => { getErpProducts(companyId).then(p => { setProducts(p); setLoading(false) }) }
  useEffect(() => { if (companyId) load() }, [companyId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (editId) { await updateErpProduct(editId, form) } else { await addErpProduct({ ...form, company_id: companyId }) }
    setShowForm(false); setEditId(null)
    setForm({ name: '', sku: '', type: 'product', category: '', description: '', sale_price: '', cost_price: '', tax_rate: 21, unit: 'ud', stock_qty: 0, min_stock: 0, track_stock: true })
    load()
  }

  const handleStockMove = async () => {
    if (!stockQty || !showStock) return
    await addErpStockMove({ company_id: companyId, product_id: showStock, type: stockType, quantity: Number(stockQty), reference: stockRef })
    setShowStock(null); setStockQty(''); setStockRef('')
    load()
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Cargando...</div>

  const totalValue = products.reduce((s, p) => s + (p.stock_qty || 0) * (p.cost_price || 0), 0)
  const lowStock = products.filter(p => p.track_stock && p.stock_qty <= (p.min_stock || 0))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: 'var(--text)', fontSize: 20, margin: 0 }}>Inventario</h2>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{products.length} productos · Valor: {fmt(totalValue)} · {lowStock.length} con stock bajo</div>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ name: '', sku: '', type: 'product', category: '', description: '', sale_price: '', cost_price: '', tax_rate: 21, unit: 'ud', stock_qty: 0, min_stock: 0, track_stock: true }) }} className="btn-action">+ Nuevo Producto</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {[{ label: 'Nombre *', key: 'name', required: true }, { label: 'SKU', key: 'sku' }, { label: 'Categoría', key: 'category' }, { label: 'Precio Venta', key: 'sale_price', type: 'number' }, { label: 'Precio Coste', key: 'cost_price', type: 'number' }, { label: 'IVA %', key: 'tax_rate', type: 'number' }, { label: 'Unidad', key: 'unit' }, { label: 'Stock mínimo', key: 'min_stock', type: 'number' }].map(f => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{f.label}</label>
                <input type={f.type || 'text'} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))} required={f.required} step={f.type === 'number' ? '0.01' : undefined}
                  style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} />
              </div>
            ))}
            <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Tipo</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }}>
                <option value="product">Producto</option><option value="service">Servicio</option><option value="consumable">Consumible</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12 }}><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Descripción</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, resize: 'vertical' }} /></div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
            <button type="submit" className="btn-action">{editId ? 'Guardar' : 'Crear Producto'}</button>
          </div>
        </form>
      )}

      {/* Stock move modal */}
      {showStock && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowStock(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: 360 }}>
            <h3 style={{ color: 'var(--text)', margin: '0 0 16px' }}>Movimiento de Stock</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Tipo</label>
                <select value={stockType} onChange={e => setStockType(e.target.value)} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }}>
                  <option value="in">Entrada</option><option value="out">Salida</option><option value="adjustment">Ajuste</option>
                </select></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Cantidad</label>
                <input type="number" value={stockQty} onChange={e => setStockQty(e.target.value)} min="1" style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} /></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Referencia</label>
                <input value={stockRef} onChange={e => setStockRef(e.target.value)} placeholder="Albarán, pedido..." style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowStock(null)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
              <button onClick={handleStockMove} className="btn-action">Registrar</button>
            </div>
          </div>
        </div>
      )}

      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>Producto</th><th>SKU</th><th>Tipo</th><th>P. Venta</th><th>P. Coste</th><th>Stock</th><th>Valor</th><th></th></tr></thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} style={{ background: p.track_stock && p.stock_qty <= (p.min_stock || 0) ? 'rgba(239,68,68,0.05)' : undefined }}>
                <td className="cell-bold">{p.name}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{p.sku || '—'}</td>
                <td><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: p.type === 'service' ? 'rgba(59,130,246,0.15)' : 'rgba(255,107,0,0.1)', color: p.type === 'service' ? '#60a5fa' : 'var(--orange)' }}>{p.type}</span></td>
                <td>{fmt(p.sale_price)}</td>
                <td>{fmt(p.cost_price)}</td>
                <td style={{ fontWeight: 700, color: p.stock_qty <= (p.min_stock || 0) ? '#ef4444' : 'var(--text)' }}>{p.stock_qty} {p.unit}</td>
                <td>{fmt(p.stock_qty * p.cost_price)}</td>
                <td style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setShowStock(p.id)} style={{ padding: '4px 8px', borderRadius: 4, border: 'none', background: 'rgba(34,197,94,0.1)', color: '#22c55e', cursor: 'pointer', fontSize: 11 }}>📦 Stock</button>
                  <button onClick={() => { setEditId(p.id); setForm(p); setShowForm(true) }} style={{ padding: '4px 8px', borderRadius: 4, border: 'none', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11 }}>✏️</button>
                  <button onClick={() => { if (confirm('¿Eliminar?')) { deleteErpProduct(p.id); load() } }} style={{ padding: '4px 8px', borderRadius: 4, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', fontSize: 11 }}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
