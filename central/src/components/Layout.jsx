import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useState, useMemo, useEffect, useRef } from 'react'
import { getPrimaryRole, hasRole } from '../utils/roles'
// AgentChat now wraps from ClientApp.jsx level

function buildNavItems(prefix, slug) {
  const en = slug === 'black-wolf'
  return [
    {
      label: en ? 'Sales' : 'Ventas',
      icon: '💰',
      children: [
        { to: `${prefix}/ventas`, label: 'Dashboard', icon: '📊' },
        { to: `${prefix}/ventas/tabla`, label: en ? 'Table' : 'Tabla', icon: '📑' },
        { to: `${prefix}/ventas/nueva`, label: en ? 'Report Sale' : 'Reportar Venta', icon: '➕' },
      ]
    },
    {
      label: en ? 'Reports' : 'Reportes',
      icon: '📋',
      children: [
        { to: `${prefix}/reportes`, label: 'Dashboard', icon: '📊' },
        { to: `${prefix}/reportes/tabla`, label: en ? 'Table' : 'Tabla', icon: '📝' },
        { to: `${prefix}/reportes/nuevo`, label: 'EOD Report', icon: '🕐' },
      ]
    },
    {
      label: 'CRM',
      icon: '📇',
      children: [
        { to: `${prefix}/crm`, label: 'Pipeline', icon: '📊' },
        { to: `${prefix}/crm?view=tasks`, label: en ? 'CRM Tasks' : 'Tareas CRM', icon: '✅' },
      ]
    },
    {
      label: en ? 'Installments' : 'Pagos a Plazos',
      icon: '💳',
      children: [
        { to: `${prefix}/pagos-plazos`, label: en ? 'Installment Plans' : 'Planes de Pago', icon: '💳' },
      ]
    },
    {
      label: 'Email Marketing',
      icon: '📧',
      children: [
        { to: `${prefix}/email-marketing`, label: en ? 'Campaigns' : 'Campañas', icon: '📧' },
      ]
    },
  ]
}

function DropdownMenu({ group, isActive }) {
  const [open, setOpen] = useState(false)
  const timerRef = useRef(null)

  function handleEnter() {
    clearTimeout(timerRef.current)
    setOpen(true)
  }

  function handleLeave() {
    timerRef.current = setTimeout(() => setOpen(false), 150)
  }

  useEffect(() => () => clearTimeout(timerRef.current), [])

  // Single-child groups: just link directly
  if (group.children.length === 1) {
    return (
      <NavLink
        to={group.children[0].to}
        className={({ isActive: a }) => `topnav__item ${a ? 'topnav__item--active' : ''}`}
      >
        <span className="topnav__icon">{group.icon}</span>
        <span className="topnav__label">{group.label}</span>
      </NavLink>
    )
  }

  return (
    <div
      className={`topnav__dropdown ${isActive ? 'topnav__dropdown--active' : ''}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button className={`topnav__item ${isActive ? 'topnav__item--active' : ''}`}>
        <span className="topnav__icon">{group.icon}</span>
        <span className="topnav__label">{group.label}</span>
        <span className={`topnav__chevron ${open ? 'topnav__chevron--open' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="topnav__menu" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
          {group.children.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive: a }) => `topnav__menu-item ${a ? 'topnav__menu-item--active' : ''}`}
              onClick={() => setOpen(false)}
            >
              <span className="topnav__menu-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

function MobileGroup({ group, location, onNavigate }) {
  const isActive = group.children.some(c => location.pathname === c.to || location.pathname.startsWith(c.to + '/'))
  const [open, setOpen] = useState(isActive)

  // Single-child groups: just show the link directly
  if (group.children.length === 1) {
    return (
      <NavLink
        to={group.children[0].to}
        className={({ isActive: a }) => `topnav__mobile-item ${a ? 'topnav__mobile-item--active' : ''}`}
        onClick={onNavigate}
      >
        <span>{group.icon}</span> {group.label}
      </NavLink>
    )
  }

  return (
    <div className="topnav__mobile-group">
      <button
        className={`topnav__mobile-group-title ${isActive ? 'topnav__mobile-group-title--active' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <span className="topnav__mobile-group-left">
          <span>{group.icon}</span> {group.label}
        </span>
        <span className={`topnav__mobile-chevron ${open ? 'topnav__mobile-chevron--open' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="topnav__mobile-children">
          {group.children.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive: a }) => `topnav__mobile-child ${a ? 'topnav__mobile-child--active' : ''}`}
              onClick={onNavigate}
            >
              <span>{item.icon}</span> {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Layout({ children, user, onLogout, role, clientConfig, clientSlug, isSuperAdmin }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const prefix = `/${clientSlug}`
  const navItems = useMemo(() => buildNavItems(prefix, clientSlug), [prefix, clientSlug])

  const logoUrl = clientConfig?.logoUrl || null
  const brandName = clientConfig?.name || 'Dashboard'

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  // Filter nav items based on user role
  const primaryRole = getPrimaryRole(role)
  const isCeo = hasRole(role, 'ceo')
  const visibleNavItems = useMemo(() => {
    if (isCeo || primaryRole === 'director') return navItems
    return navItems.filter(group => {
      if (group.label === 'Email Marketing') return false
      return true
    })
  }, [primaryRole, isCeo, navItems])

  function isGroupActive(group) {
    return group.children.some(c => location.pathname === c.to || location.pathname.startsWith(c.to + '/'))
  }

  return (
    <div className="layout-v2">
      {/* Top Navigation Bar */}
      <header className="topnav">
        <div className="topnav__left">
          <button className="topnav__home" onClick={() => navigate(prefix)} title="Home">
            {logoUrl ? (
              <img src={logoUrl} alt={brandName} className="topnav__logo" />
            ) : (
              <span className="topnav__logo-placeholder">{brandName[0]}</span>
            )}
            <span className="topnav__brand">{brandName}</span>
          </button>

          <nav className="topnav__sections">
            {visibleNavItems.map(group => (
              <DropdownMenu key={group.label} group={group} isActive={isGroupActive(group)} />
            ))}
          </nav>
        </div>

        <div className="topnav__right">
          <div className="topnav__user">
            <div className="topnav__avatar">{(user || 'U')[0].toUpperCase()}</div>
            <span className="topnav__email">{user}</span>
          </div>
          {isSuperAdmin && (
            <button onClick={() => { window.location.href = '/admin' }} className="topnav__action" title="Consola">
              ← Consola
            </button>
          )}
          <button onClick={onLogout} className="topnav__action topnav__action--logout" title="Cerrar sesión">
            Salir
          </button>
        </div>

        {/* Mobile hamburger */}
        <button className="topnav__hamburger" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </header>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <>
          <div className="topnav__mobile-overlay" onClick={() => setMobileMenuOpen(false)} />
          <div className="topnav__mobile-menu">
            <NavLink
              to={prefix}
              end
              className={({ isActive }) => `topnav__mobile-item topnav__mobile-home ${isActive ? 'topnav__mobile-item--active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              🏠 Home
            </NavLink>
            {visibleNavItems.map(group => (
              <MobileGroup key={group.label} group={group} location={location} onNavigate={() => setMobileMenuOpen(false)} />
            ))}
            <div className="topnav__mobile-footer">
              {isSuperAdmin && (
                <button className="topnav__mobile-item" onClick={() => { window.location.href = '/admin' }}>
                  ← Consola
                </button>
              )}
              <button className="topnav__mobile-item" onClick={onLogout}>
                ⏻ Cerrar sesión
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main content — full width */}
      <main className="layout-v2__main">
        {children}
      </main>
    </div>
  )
}
