import { useState, useEffect, useMemo, createContext, useContext } from 'react'
import { Routes, Route, Navigate, useParams, NavLink, useLocation } from 'react-router-dom'
import { getErpCompanyBySlug, erpLogin } from '../../utils/erp-data'
import ErpDashboard from './ErpDashboard'
import ErpSales from './ErpSales'
import ErpPurchases from './ErpPurchases'
import ErpInventory from './ErpInventory'
import ErpContacts from './ErpContacts'
import ErpHR from './ErpHR'
import ErpAccounting from './ErpAccounting'
import ErpProduction from './ErpProduction'
import ErpSettings from './ErpSettings'

const ErpContext = createContext(null)
export const useErp = () => useContext(ErpContext)

const NAV = [
  { to: '', label: 'Dashboard', icon: '📊', end: true },
  { to: 'ventas', label: 'Ventas', icon: '💰' },
  { to: 'compras', label: 'Compras', icon: '🛒' },
  { to: 'inventario', label: 'Inventario', icon: '📦' },
  { to: 'produccion', label: 'Producción', icon: '🏭' },
  { to: 'contactos', label: 'Contactos', icon: '👥' },
  { to: 'rrhh', label: 'RRHH', icon: '🏢' },
  { to: 'contabilidad', label: 'Contabilidad', icon: '📒' },
  { to: 'ajustes', label: 'Ajustes', icon: '⚙️' },
]

function ErpLogin({ company, onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Completa todos los campos'); return }
    setLoading(true)
    const result = await erpLogin(email, password, company.slug)
    if (result) {
      onLogin(result)
    } else {
      setError('Credenciales incorrectas')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 40, width: '100%', maxWidth: 400 }}>
        {company.logo_url && <img src={company.logo_url} alt={company.name} style={{ height: 48, marginBottom: 16, display: 'block', margin: '0 auto 16px' }} />}
        <h1 style={{ textAlign: 'center', color: 'var(--text)', fontSize: 22, marginBottom: 4 }}>{company.name}</h1>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24 }}>ERP — Accede al sistema</p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@empresa.com"
              style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••"
              style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} />
          </div>
          {error && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12, textAlign: 'center' }}>{error}</div>}
          <button type="submit" disabled={loading} className="btn-action" style={{ width: '100%', padding: '12px', fontSize: 14, opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

function ErpLayout({ children, company, user, onLogout }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const prefix = `/erp/${company.slug}`

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  const pageTitle = (() => {
    const path = location.pathname.replace(prefix, '').replace(/^\//, '')
    const match = NAV.find(n => n.to === path)
    return match?.label || 'ERP'
  })()

  const sidebar = (
    <>
      <div style={{ padding: '16px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        {company.logo_url ? <img src={company.logo_url} alt="" style={{ height: 28 }} /> : <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 14 }}>{company.name[0]}</div>}
        {!collapsed && <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{company.name}</span>}
      </div>
      <nav style={{ flex: 1, padding: '8px 6px', overflowY: 'auto' }}>
        {NAV.map(n => (
          <NavLink key={n.to} to={`${prefix}/${n.to}`} end={n.end}
            className={({ isActive }) => `admin-nav-item ${isActive ? 'admin-nav-item--active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 2 }}>
            <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{n.icon}</span>
            {!collapsed && <span>{n.label}</span>}
          </NavLink>
        ))}
      </nav>
      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {!collapsed && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>}
        <button onClick={() => setCollapsed(!collapsed)} style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12 }}>{collapsed ? '→' : '←'}</button>
        <button onClick={onLogout} style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#ef4444', fontSize: 12, fontWeight: 600 }}>{collapsed ? '⏻' : 'Cerrar sesión'}</button>
      </div>
    </>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', position: 'fixed', inset: 0, zIndex: 1 }}>
      {/* Desktop sidebar */}
      <aside style={{ width: collapsed ? 60 : 220, minWidth: collapsed ? 60 : 220, background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', transition: 'all .2s', overflow: 'hidden' }}>
        {sidebar}
      </aside>
      {/* Mobile overlay */}
      {mobileOpen && <div onClick={() => setMobileOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90 }} />}
      {/* Mobile sidebar */}
      <aside style={{ position: 'fixed', left: mobileOpen ? 0 : -260, top: 0, bottom: 0, width: 240, background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', transition: 'left .2s', zIndex: 100 }}>
        {sidebar}
      </aside>
      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <header style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setMobileOpen(!mobileOpen)} style={{ padding: '6px 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1 }}>{mobileOpen ? '✕' : '☰'}</button>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{pageTitle}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 12 }}>{(user.name || user.email)[0].toUpperCase()}</div>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{user.name || user.email}</span>
          </div>
        </header>
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 24 }}>
          {children}
        </div>
      </main>
    </div>
  )
}

export default function ErpApp() {
  const { companySlug } = useParams()
  const [company, setCompany] = useState(null)
  const [companyLoading, setCompanyLoading] = useState(true)
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem(`erp_session_${companySlug}`)
    return saved ? JSON.parse(saved) : null
  })

  useEffect(() => {
    getErpCompanyBySlug(companySlug).then(c => {
      setCompany(c)
      setCompanyLoading(false)
    })
  }, [companySlug])

  const handleLogin = (result) => {
    setSession(result)
    localStorage.setItem(`erp_session_${companySlug}`, JSON.stringify(result))
  }

  const handleLogout = () => {
    setSession(null)
    localStorage.removeItem(`erp_session_${companySlug}`)
  }

  const ctx = useMemo(() => ({
    company: session?.company || company,
    companyId: (session?.company || company)?.id,
    user: session?.user,
  }), [session, company])

  if (companyLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#999' }}>Cargando...</div>
  if (!company) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#999', flexDirection: 'column', gap: 16 }}><h1 style={{ fontSize: '2rem', color: '#fff' }}>404</h1><p>Empresa no encontrada</p></div>
  if (!session) return <ErpLogin company={company} onLogin={handleLogin} />

  return (
    <ErpContext.Provider value={ctx}>
      <ErpLayout company={ctx.company} user={ctx.user} onLogout={handleLogout}>
        <Routes>
          <Route index element={<ErpDashboard />} />
          <Route path="ventas" element={<ErpSales />} />
          <Route path="compras" element={<ErpPurchases />} />
          <Route path="inventario" element={<ErpInventory />} />
          <Route path="produccion" element={<ErpProduction />} />
          <Route path="contactos" element={<ErpContacts />} />
          <Route path="rrhh" element={<ErpHR />} />
          <Route path="contabilidad" element={<ErpAccounting />} />
          <Route path="ajustes" element={<ErpSettings />} />
          <Route path="*" element={<Navigate to={`/erp/${companySlug}`} replace />} />
        </Routes>
      </ErpLayout>
    </ErpContext.Provider>
  )
}
