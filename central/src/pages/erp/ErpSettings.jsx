import { useState, useEffect } from 'react'
import { useErp } from './ErpApp'
import { updateErpCompany, getErpUsers, addErpUser, updateErpUser, deleteErpUser } from '../../utils/erp-data'

export default function ErpSettings() {
  const { company, companyId, user } = useErp()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [companyForm, setCompanyForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showUserForm, setShowUserForm] = useState(false)
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'user' })

  useEffect(() => {
    if (!companyId) return
    getErpUsers(companyId).then(u => { setUsers(u); setLoading(false) })
    setCompanyForm({ name: company.name || '', cif: company.cif || '', address: company.address || '', city: company.city || '', country: company.country || '', phone: company.phone || '', email: company.email || '', website: company.website || '', currency: company.currency || 'EUR' })
  }, [companyId])

  const handleSaveCompany = async (e) => {
    e.preventDefault()
    setSaving(true)
    await updateErpCompany(companyId, companyForm)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleAddUser = async (e) => {
    e.preventDefault()
    await addErpUser({ ...userForm, company_id: companyId })
    setShowUserForm(false)
    setUserForm({ name: '', email: '', password: '', role: 'user' })
    getErpUsers(companyId).then(setUsers)
  }

  if (loading || !companyForm) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Cargando...</div>

  return (
    <div>
      <h2 style={{ color: 'var(--text)', fontSize: 20, marginBottom: 20 }}>Ajustes</h2>

      {/* Company Info */}
      <form onSubmit={handleSaveCompany} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ color: 'var(--orange)', fontSize: 16, margin: 0 }}>Datos de la Empresa</h3>
          {saved && <span style={{ color: '#22c55e', fontSize: 13, fontWeight: 600 }}>Guardado</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {[{ label: 'Nombre', key: 'name' }, { label: 'CIF / NIF', key: 'cif' }, { label: 'Email', key: 'email', type: 'email' }, { label: 'Teléfono', key: 'phone' }, { label: 'Dirección', key: 'address' }, { label: 'Ciudad', key: 'city' }, { label: 'País', key: 'country' }, { label: 'Website', key: 'website' }].map(f => (
            <div key={f.key}><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{f.label}</label>
              <input type={f.type || 'text'} value={companyForm[f.key] || ''} onChange={e => setCompanyForm(p => ({ ...p, [f.key]: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} /></div>
          ))}
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Moneda</label>
            <select value={companyForm.currency} onChange={e => setCompanyForm(p => ({ ...p, currency: e.target.value }))} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }}>
              <option value="EUR">EUR (€)</option><option value="USD">USD ($)</option><option value="GBP">GBP (£)</option>
            </select></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="submit" disabled={saving} className="btn-action">{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </form>

      {/* Users */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ color: 'var(--orange)', fontSize: 16, margin: 0 }}>Usuarios del ERP</h3>
          <button onClick={() => setShowUserForm(!showUserForm)} className="btn-action" style={{ fontSize: 12 }}>+ Nuevo Usuario</button>
        </div>

        {showUserForm && (
          <form onSubmit={handleAddUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 16, padding: 16, background: 'var(--bg)', borderRadius: 8 }}>
            <input value={userForm.name} onChange={e => setUserForm(p => ({ ...p, name: e.target.value }))} placeholder="Nombre" required style={{ padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }} />
            <input type="email" value={userForm.email} onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))} placeholder="Email" required style={{ padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }} />
            <input type="password" value={userForm.password} onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))} placeholder="Contraseña" required style={{ padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }} />
            <select value={userForm.role} onChange={e => setUserForm(p => ({ ...p, role: e.target.value }))} style={{ padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }}>
              <option value="admin">Admin</option><option value="user">Usuario</option><option value="viewer">Solo lectura</option>
            </select>
            <button type="submit" className="btn-action" style={{ fontSize: 12 }}>Crear</button>
          </form>
        )}

        <div className="table-wrapper"><table className="data-table"><thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th></th></tr></thead><tbody>
          {users.map(u => (
            <tr key={u.id}><td className="cell-bold">{u.name}</td><td>{u.email}</td>
              <td><span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: u.role === 'admin' ? 'rgba(255,107,0,0.12)' : 'rgba(255,255,255,0.05)', color: u.role === 'admin' ? 'var(--orange)' : 'var(--text-secondary)' }}>{u.role}</span></td>
              <td><span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: u.active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: u.active ? '#22c55e' : '#ef4444' }}>{u.active ? 'Activo' : 'Inactivo'}</span></td>
              <td style={{ display: 'flex', gap: 4 }}>
                <button onClick={async () => { await updateErpUser(u.id, { active: !u.active }); getErpUsers(companyId).then(setUsers) }} style={{ padding: '4px 8px', borderRadius: 4, border: 'none', background: 'rgba(251,191,36,0.1)', color: '#fbbf24', cursor: 'pointer', fontSize: 11 }}>{u.active ? '⏸' : '▶'}</button>
                <button onClick={async () => { if (confirm('¿Eliminar usuario?')) { await deleteErpUser(u.id); getErpUsers(companyId).then(setUsers) } }} style={{ padding: '4px 8px', borderRadius: 4, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', fontSize: 11 }}>🗑</button>
              </td></tr>
          ))}</tbody></table></div>
      </div>
    </div>
  )
}
