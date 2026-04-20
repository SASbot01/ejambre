import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'

const navItems = [
  { to: '/admin', label: 'Home', icon: '🏠' },
  { to: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/admin/consola', label: 'ERP & CRM', icon: '🏢' },
]

export default function AdminLayout({ children, user, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const pageTitle = (() => {
    const match = navItems.find(i => i.to === location.pathname)
    return match ? match.label : 'Admin'
  })()

  const sidebarContent = (
    <>
      <div className="admin-sidebar-header">
        <img src="/assets/logos/blackwolf.png" alt="BlackWolf" className="admin-sidebar-logo" />
        <span className="admin-sidebar-brand">BLACKWOLF</span>
      </div>

      <nav className="admin-sidebar-nav">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/admin'}
            className={({ isActive }) => `admin-nav-item ${isActive ? 'admin-nav-item--active' : ''}`}
          >
            <span className="admin-nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
        <NavLink
          to="/admin/soc"
          className={({ isActive }) => `admin-nav-item ${isActive ? 'admin-nav-item--active' : ''}`}
        >
          <span className="admin-nav-icon">🛡️</span>
          <span>SOC</span>
        </NavLink>
      </nav>

      <div className="admin-sidebar-footer">
        <button onClick={onLogout} className="admin-logout-btn">
          Cerrar sesión
        </button>
      </div>
    </>
  )

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar admin-sidebar--desktop">
        {sidebarContent}
      </aside>

      {mobileMenuOpen && (
        <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)} />
      )}
      <aside className={`admin-sidebar admin-sidebar--mobile ${mobileMenuOpen ? 'admin-sidebar--mobile-open' : ''}`}>
        {sidebarContent}
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="topbar-left">
            <button
              className="mobile-hamburger admin-hamburger"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Abrir menú"
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
            <h1 className="admin-topbar-title">{pageTitle}</h1>
          </div>
          <div className="topbar-user">
            <div className="admin-topbar-avatar">A</div>
            <span className="admin-topbar-email">{user}</span>
          </div>
        </header>
        <div className="admin-main-content">
          {children}
        </div>
      </main>
    </div>
  )
}
