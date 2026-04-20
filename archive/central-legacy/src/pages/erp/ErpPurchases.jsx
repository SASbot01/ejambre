import { useState, useEffect } from 'react'
import { useErp } from './ErpApp'
import { getErpInvoices, addErpInvoice, updateErpInvoice, deleteErpInvoice, getErpContacts, getErpProducts } from '../../utils/erp-data'

const fmt = (v) => Number(v || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })
const STATUS = { draft: { label: 'Borrador', bg: 'rgba(255,255,255,0.08)', color: '#999' }, received: { label: 'Recibida', bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' }, paid: { label: 'Pagada', bg: 'rgba(34,197,94,0.15)', color: '#22c55e' }, cancelled: { label: 'Anulada', bg: 'rgba(239,68,68,0.15)', color: '#ef4444' } }

export default function ErpPurchases() {
  const { companyId } = useErp()
  const [invoices, setInvoices] = useState([])
  const [contacts, setContacts] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ contact_id: '', date: new Date().toISOString().slice(0, 10), due_date: '', notes: '', lines: [{ product_id: '', description: '', quantity: 1, unit_price: 0, tax_rate: 21 }] })

  const load = () => { Promise.all([getErpInvoices(companyId, 'purchase'), getErpContacts(companyId, 'supplier'), getErpProducts(companyId)]).then(([i, c, p]) => { setInvoices(i); setContacts(c); setProducts(p); setLoading(false) }) }
  useEffect(() => { if (companyId) load() }, [companyId])

  const addLine = () => setForm(p => ({ ...p, lines: [...p.lines, { product_id: '', description: '', quantity: 1, unit_price: 0, tax_rate: 21 }] }))
  const updateLine = (idx, field, val) => { const lines = [...form.lines]; lines[idx] = { ...lines[idx], [field]: val }; if (field === 'product_id') { const prod = products.find(p => p.id === val); if (prod) { lines[idx].description = prod.name; lines[idx].unit_price = prod.cost_price; lines[idx].tax_rate = prod.tax_rate } } setForm(p => ({ ...p, lines })) }
  const removeLine = (idx) => setForm(p => ({ ...p, lines: p.lines.filter((_, i) => i !== idx) }))

  const calcTotals = (lines) => { const sub = lines.reduce((s, l) => s + (l.quantity || 0) * (l.unit_price || 0), 0); const tax = lines.reduce((s, l) => s + (l.quantity || 0) * (l.unit_price || 0) * (l.tax_rate || 0) / 100, 0); return { subtotal: sub, tax_total: tax, total: sub + tax } }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const totals = calcTotals(form.lines)
    const number = `FC-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(4, '0')}`
    await addErpInvoice({ ...form, ...totals, company_id: companyId, type: 'purchase', number, status: 'draft', lines: JSON.stringify(form.lines), contact_id: form.contact_id || null })
    setShowForm(false)
    setForm({ contact_id: '', date: new Date().toISOString().slice(0, 10), due_date: '', notes: '', lines: [{ product_id: '', description: '', quantity: 1, unit_price: 0, tax_rate: 21 }] })
    load()
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Cargando...</div>
  const totals = calcTotals(form.lines)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ color: 'var(--text)', fontSize: 20, margin: 0 }}>Facturas de Compra</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn-action">+ Nueva Factura Compra</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Proveedor</label><select value={form.contact_id} onChange={e => setForm(p => ({ ...p, contact_id: e.target.value }))} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }}><option value="">Seleccionar...</option>{contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Fecha</label><input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} /></div>
            <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Vencimiento</label><input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} /></div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--orange)', marginBottom: 8 }}>Líneas</div>
          {form.lines.map((line, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 6 }}>
              <select value={line.product_id} onChange={e => updateLine(idx, 'product_id', e.target.value)} style={{ padding: '8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12 }}><option value="">Producto...</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              <input type="number" value={line.quantity} onChange={e => updateLine(idx, 'quantity', Number(e.target.value))} placeholder="Cant." style={{ padding: '8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, textAlign: 'right' }} />
              <input type="number" value={line.unit_price} onChange={e => updateLine(idx, 'unit_price', Number(e.target.value))} placeholder="Precio" step="0.01" style={{ padding: '8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, textAlign: 'right' }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{fmt(line.quantity * line.unit_price * (1 + (line.tax_rate || 21) / 100))}</div>
              <button type="button" onClick={() => removeLine(idx)} style={{ border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', borderRadius: 4, padding: '4px 6px' }}>✕</button>
            </div>
          ))}
          <button type="button" onClick={addLine} style={{ padding: '6px 12px', border: '1px dashed var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', borderRadius: 6, fontSize: 12, marginBottom: 16 }}>+ Línea</button>
          <div style={{ textAlign: 'right', marginBottom: 16 }}><span style={{ fontSize: 16, fontWeight: 700, color: 'var(--orange)' }}>Total: {fmt(totals.total)}</span></div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
            <button type="submit" className="btn-action">Crear Factura</button>
          </div>
        </form>
      )}

      {invoices.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}><p style={{ fontSize: 40, marginBottom: 8 }}>🛒</p><p>No hay facturas de compra.</p></div>
      ) : (
        <div className="table-wrapper"><table className="data-table"><thead><tr><th>Nº</th><th>Proveedor</th><th>Fecha</th><th>Total</th><th>Estado</th><th></th></tr></thead><tbody>
          {invoices.map(inv => { const sup = contacts.find(c => c.id === inv.contact_id); const st = STATUS[inv.status] || STATUS.draft; return (
            <tr key={inv.id}><td className="cell-bold">{inv.number || '—'}</td><td>{sup?.name || '—'}</td><td>{inv.date}</td><td style={{ fontWeight: 700, color: '#ef4444' }}>{fmt(inv.total)}</td>
              <td><select value={inv.status} onChange={e => { updateErpInvoice(inv.id, { status: e.target.value }); load() }} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600, background: st.bg, color: st.color, cursor: 'pointer' }}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></td>
              <td><button onClick={() => { if (confirm('¿Eliminar?')) { deleteErpInvoice(inv.id); load() } }} style={{ border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', borderRadius: 4, padding: '4px 6px', fontSize: 11 }}>🗑</button></td></tr>
          ) })}</tbody></table></div>
      )}
    </div>
  )
}
