import { NavLink, useNavigate } from 'react-router-dom'
import { useClient } from '../contexts/ClientContext'

export default function MiniLayout({ title, tabs, children, onLogout }) {
  const navigate = useNavigate()
  const { clientSlug, clientConfig } = useClient()
  const logoUrl = clientConfig?.logoUrl

  return (
    <div className="mini-layout">
      <header className="mini-layout__header">
        <div className="mini-layout__left">
          {onLogout ? (
            <button className="mini-layout__back" onClick={onLogout} title="Cerrar sesión">
              Salir
            </button>
          ) : (
            <button className="mini-layout__back" onClick={() => navigate(`/${clientSlug}`)} title="Volver al Home">
              ← Home
            </button>
          )}
          {logoUrl && <img src={logoUrl} alt="" className="mini-layout__logo" />}
          <h1 className="mini-layout__title">{title}</h1>
        </div>
        <nav className="mini-layout__tabs">
          {tabs.map(tab => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => `mini-layout__tab ${isActive ? 'mini-layout__tab--active' : ''}`}
            >
              {tab.label}
              {tab.badge > 0 && <span className="mini-layout__badge">{tab.badge}</span>}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mini-layout__content">
        {children}
      </main>
    </div>
  )
}
