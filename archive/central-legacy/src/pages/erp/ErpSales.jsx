import { useState, useEffect } from 'react'
import { useErp } from './ErpApp'
import { getErpInvoices, addErpInvoice, updateErpInvoice, deleteErpInvoice, getErpContacts, getErpProducts } from '../../utils/erp-data'

const fmt = (v) => Number(v || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })
const STATUS = { draft: { label: 'Borrador', bg: 'rgba(255,255,255,0.08)', color: '#999' }, sent: { label: 'Enviada', bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' }, paid: { label: 'Pagada', bg: 'rgba(34,197,94,0.15)', color: '#22c55e' }, cancelled: { label: 'Anulada', bg: 'rgba(239,68,68,0.15)', color: '#ef4444' } }

export default function ErpSales() {
  const { companyId } = useErp()
  const [invoices, setInvoices] = useState([])
  const [contacts, setContacts] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ contact_id: '', date: new Date().toISOString().slice(0, 10), due_date: '', notes: '', lines: [{ product_id: '', description: '', quantity: 1, unit_price: 0, tax_rate: 21 }] })

  const load = () => { Promise.all([getErpInvoices(companyId, 'sale'), getErpContacts(companyId, 'customer'), getErpProducts(companyId)]).then(([i, c, p]) => { setInvoices(i); setContacts(c); setProducts(p); setLoading(false) }) }
  useEffect(() => { if (companyId) load() }, [companyId])

  const addLine = () => setForm(p => ({ ...p, lines: [...p.lines, { product_id: '', description: '', quantity: 1, unit_price: 0, tax_rate: 21 }] }))
  const updateLine = (idx, field, val) => { const lines = [...form.lines]; lines[idx] = { ...lines[idx], [field]: val }; if (field === 'product_id') { const prod = products.find(p => p.id === val); if (prod) { lines[idx].description = prod.name; lines[idx].unit_price = prod.sale_price; lines[idx].tax_rate = prod.tax_rate } } setForm(p => ({ ...p, lines })) }
  const removeLine = (idx) => setForm(p => ({ ...p, lines: p.lines.filter((_, i) => i !== idx) }))

  const calcTotals = (lines) => {
    const subtotal = lines.reduce((s, l) => s + (l.quantity || 0) * (l.unit_price || 0), 0)
    const taxTotal = lines.reduce((s, l) => s + (l.quantity || 0) * (l.unit_price || 0) * (l.tax_rate || 0) / 100, 0)
    return { subtotal, tax_total: taxTotal, total: subtotal + taxTotal }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const totals = calcTotals(form.lines)
    const number = `FV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(4, '0')}`
    await addErpInvoice({ ...form, ...totals, company_id: companyId, type: 'sale', number, status: 'draft', lines: JSON.stringify(form.lines), contact_id: form.contact_id || null })
    setShowForm(false)
    setForm({ contact_id: '', date: new Date().toISOString().slice(0, 10), due_date: '', notes: '', lines: [{ product_id: '', description: '', quantity: 1, unit_price: 0, tax_rate: 21 }] })
    load()
  }

  const handleStatusChange = async (id, status) => { await updateErpInvoice(id, { status }); load() }
  const handleDelete = async (id) => { if (confirm('¿Eliminar factura?')) { await deleteErpInvoice(id); load() } }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Cargando...</div>

  const totals = calcTotals(form.lines)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ color: 'var(--text)', fontSize: 20, margin: 0 }}>Facturas de Venta</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn-action" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>+ Nueva Factura</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Cliente</label>
              <select value={form.contact_id} onChange={e => setForm(p => ({ ...p, contact_id: e.target.value }))} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }}>
                <option value="">Seleccionar...</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Fecha</label>
              <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Vencimiento</label>
              <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} />
            </div>
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--orange)', marginBottom: 8 }}>Líneas de factura</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '8px 4px', fontSize: 11, color: 'var(--text-secondary)' }}>Producto</th>
              <th style={{ textAlign: 'left', padding: '8px 4px', fontSize: 11, color: 'var(--text-secondary)' }}>Descripción</th>
              <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 11, color: 'var(--text-secondary)', width: 80 }}>Cant.</th>
              <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 11, color: 'var(--text-secondary)', width: 100 }}>Precio</th>
              <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 11, color: 'var(--text-secondary)', width: 60 }}>IVA%</th>
              <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 11, color: 'var(--text-secondary)', width: 100 }}>Total</th>
              <th style={{ width: 30 }}></th>
            </tr></thead>
            <tbody>
              {form.lines.map((line, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '4px' }}><select value={line.product_id} onChange={e => updateLine(idx, 'product_id', e.target.value)} style={{ width: '100%', padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12 }}><option value="">—</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
                  <td style={{ padding: '4px' }}><input value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} style={{ width: '100%', padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12 }} /></td>
                  <td style={{ padding: '4px' }}><input type="number" value={line.quantity} onChange={e => updateLine(idx, 'quantity', Number(e.target.value))} style={{ width: '100%', padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, textAlign: 'right' }} /></td>
                  <td style={{ padding: '4px' }}><input type="number" value={line.unit_price} onChange={e => updateLine(idx, 'unit_price', Number(e.target.value))} step="0.01" style={{ width: '100%', padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, textAlign: 'right' }} /></td>
                  <td style={{ padding: '4px' }}><input type="number" value={line.tax_rate} onChange={e => updateLine(idx, 'tax_rate', Number(e.target.value))} style={{ width: '100%', padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, textAlign: 'right' }} /></td>
                  <td style={{ padding: '4px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{fmt(line.quantity * line.unit_price * (1 + line.tax_rate / 100))}</td>
                  <td style={{ padding: '4px' }}><button type="button" onClick={() => removeLine(idx)} style={{ border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', borderRadius: 4, padding: '4px 6px', fontSize: 11 }}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={addLine} style={{ padding: '6px 12px', border: '1px dashed var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', borderRadius: 6, fontSize: 12, marginBottom: 16 }}>+ Añadir línea</button>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginBottom: 16 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Subtotal: <strong style={{ color: 'var(--text)' }}>{fmt(totals.subtotal)}</strong></div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>IVA: <strong style={{ color: 'var(--text)' }}>{fmt(totals.tax_total)}</strong></div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--orange)', marginTop: 4 }}>Total: {fmt(totals.total)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
            <button type="submit" className="btn-action" style={{ padding: '10px 20px', fontSize: 13 }}>Crear Factura</button>
          </div>
        </form>
      )}

      {invoices.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 40, marginBottom: 8 }}>💰</p>
          <p>No hay facturas de venta. Crea tu primera factura.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr>
              <th>Nº</th><th>Cliente</th><th>Fecha</th><th>Vencimiento</th><th>Total</th><th>Estado</th><th></th>
            </tr></thead>
            <tbody>
              {invoices.map(inv => {
                const client = contacts.find(c => c.id === inv.contact_id)
                const st = STATUS[inv.status] || STATUS.draft
                return (
                  <tr key={inv.id}>
                    <td className="cell-bold">{inv.number || '—'}</td>
                    <td>{client?.name || '—'}</td>
                    <td>{inv.date}</td>
                    <td>{inv.due_date || '—'}</td>
                    <td style={{ fontWeight: 700, color: 'var(--orange)' }}>{fmt(inv.total)}</td>
                    <td>
                      <select value={inv.status} onChange={e => handleStatusChange(inv.id, e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600, background: st.bg, color: st.color, cursor: 'pointer' }}>
                        {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </td>
                    <td><button onClick={() => handleDelete(inv.id)} style={{ border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', borderRadius: 4, padding: '4px 6px', fontSize: 11 }}>🗑</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
