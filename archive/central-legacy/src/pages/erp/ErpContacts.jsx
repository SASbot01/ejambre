import { useState, useEffect } from 'react'
import { useErp } from './ErpApp'
import { getErpContacts, addErpContact, updateErpContact, deleteErpContact } from '../../utils/erp-data'

export default function ErpContacts() {
  const { companyId } = useErp()
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ type: 'customer', name: '', cif: '', email: '', phone: '', address: '', city: '', country: 'España', payment_terms: 30, notes: '' })

  const load = () => { getErpContacts(companyId).then(c => { setContacts(c); setLoading(false) }) }
  useEffect(() => { if (companyId) load() }, [companyId])

  const filtered = contacts.filter(c => {
    if (filter && c.type !== filter) return false
    if (search && !(c.name + ' ' + c.email + ' ' + c.cif).toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (editId) { await updateErpContact(editId, form) } else { await addErpContact({ ...form, company_id: companyId }) }
    setShowForm(false); setEditId(null)
    setForm({ type: 'customer', name: '', cif: '', email: '', phone: '', address: '', city: '', country: 'España', payment_terms: 30, notes: '' })
    load()
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Cargando...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ color: 'var(--text)', fontSize: 20, margin: 0 }}>Contactos</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }}>
            <option value="">Todos</option><option value="customer">Clientes</option><option value="supplier">Proveedores</option>
          </select>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }} />
          <button onClick={() => { setShowForm(true); setEditId(null); setForm({ type: 'customer', name: '', cif: '', email: '', phone: '', address: '', city: '', country: 'España', payment_terms: 30, notes: '' }) }} className="btn-action">+ Nuevo</button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Tipo</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }}>
                <option value="customer">Cliente</option><option value="supplier">Proveedor</option>
              </select></div>
            {[{ label: 'Nombre *', key: 'name', required: true }, { label: 'CIF / NIF', key: 'cif' }, { label: 'Email', key: 'email', type: 'email' }, { label: 'Teléfono', key: 'phone' }, { label: 'Dirección', key: 'address' }, { label: 'Ciudad', key: 'city' }, { label: 'País', key: 'country' }, { label: 'Plazo pago (días)', key: 'payment_terms', type: 'number' }].map(f => (
              <div key={f.key}><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{f.label}</label>
                <input type={f.type || 'text'} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} required={f.required}
                  style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} /></div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
            <button type="submit" className="btn-action">{editId ? 'Guardar' : 'Crear'}</button>
          </div>
        </form>
      )}

      <div className="table-wrapper"><table className="data-table"><thead><tr><th>Tipo</th><th>Nombre</th><th>CIF</th><th>Email</th><th>Teléfono</th><th>Ciudad</th><th>Plazo</th><th></th></tr></thead><tbody>
        {filtered.map(c => (
          <tr key={c.id}>
            <td><span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: c.type === 'customer' ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.15)', color: c.type === 'customer' ? '#22c55e' : '#60a5fa' }}>{c.type === 'customer' ? 'Cliente' : 'Proveedor'}</span></td>
            <td className="cell-bold">{c.name}</td>
            <td style={{ color: 'var(--text-secondary)' }}>{c.cif || '—'}</td>
            <td>{c.email || '—'}</td>
            <td>{c.phone || '—'}</td>
            <td>{c.city || '—'}</td>
            <td>{c.payment_terms} días</td>
            <td style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => { setEditId(c.id); setForm(c); setShowForm(true) }} style={{ padding: '4px 8px', borderRadius: 4, border: 'none', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11 }}>✏️</button>
              <button onClick={() => { if (confirm('¿Eliminar?')) { deleteErpContact(c.id); load() } }} style={{ padding: '4px 8px', borderRadius: 4, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', fontSize: 11 }}>🗑</button>
            </td>
          </tr>
        ))}</tbody></table></div>
    </div>
  )
}
