import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getErpCompanies, addErpCompany, addErpUser } from '../../utils/erp-data'

export default function ErpAdmin() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', slug: '', cif: '', email: '', phone: '', address: '', city: '', country: 'España' })
  const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '' })
  const navigate = useNavigate()

  const load = () => { getErpCompanies().then(c => { setCompanies(c); setLoading(false) }) }
  useEffect(() => { load() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    const slug = form.slug || form.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
    const company = await addErpCompany({ ...form, slug })
    // Create admin user
    if (adminForm.email && adminForm.password) {
      await addErpUser({ company_id: company.id, name: adminForm.name || form.name + ' Admin', email: adminForm.email, password: adminForm.password, role: 'admin', active: true })
    }
    setShowForm(false)
    setForm({ name: '', slug: '', cif: '', email: '', phone: '', address: '', city: '', country: 'España' })
    setAdminForm({ name: '', email: '', password: '' })
    load()
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Cargando...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: 'var(--text)', fontSize: 22, margin: 0 }}>ERP — Empresas</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '4px 0 0' }}>Gestiona las empresas que usan el ERP</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-action" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>+ Nueva Empresa</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--orange)', marginBottom: 12 }}>Datos de la Empresa</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            {[{ label: 'Nombre *', key: 'name', required: true }, { label: 'Slug (URL)', key: 'slug', placeholder: 'mi-empresa' }, { label: 'CIF', key: 'cif' }, { label: 'Email', key: 'email', type: 'email' }, { label: 'Teléfono', key: 'phone' }, { label: 'Dirección', key: 'address' }, { label: 'Ciudad', key: 'city' }, { label: 'País', key: 'country' }].map(f => (
              <div key={f.key}><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{f.label}</label>
                <input type={f.type || 'text'} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} required={f.required} placeholder={f.placeholder}
                  style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} /></div>
            ))}
          </div>

          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--orange)', marginBottom: 12 }}>Usuario Administrador</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Nombre</label>
              <input value={adminForm.name} onChange={e => setAdminForm(p => ({ ...p, name: e.target.value }))} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} /></div>
            <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Email *</label>
              <input type="email" value={adminForm.email} onChange={e => setAdminForm(p => ({ ...p, email: e.target.value }))} required style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} /></div>
            <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Contraseña *</label>
              <input type="password" value={adminForm.password} onChange={e => setAdminForm(p => ({ ...p, password: e.target.value }))} required style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} /></div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
            <button type="submit" className="btn-action">Crear Empresa + Admin</button>
          </div>
        </form>
      )}

      {companies.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 48, marginBottom: 8 }}>🏭</p>
          <p>No hay empresas. Crea la primera para empezar a usar el ERP.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {companies.map(c => (
            <div key={c.id} onClick={() => navigate(`/erp/${c.slug}`)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, cursor: 'pointer', transition: 'all .2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--orange)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                {c.logo_url ? <img src={c.logo_url} alt="" style={{ height: 36 }} /> : <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,107,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 18, fontWeight: 800, color: 'var(--orange)' }}>{c.name[0]}</span></div>}
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 16 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.city || c.country} {c.cif ? `· ${c.cif}` : ''}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, background: 'rgba(255,107,0,0.08)', color: 'var(--orange)', fontWeight: 600 }}>/erp/{c.slug}</span>
                <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, background: c.active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: c.active ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{c.active ? 'Activo' : 'Inactivo'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
