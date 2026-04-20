import { Link } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync'
import { useClientData } from '../../hooks/useClientData'
import { useClient } from '../../contexts/ClientContext'

const QUICK_LINKS = [
  { path: 'ceo/equipo', icon: '👥', title: 'Equipo', desc: 'Vista ejecutiva del equipo' },
  { path: 'ceo/meetings', icon: '🎙️', title: 'Meetings', desc: 'Reuniones y transcripts' },
  { path: 'ceo/proyectos', icon: '📁', title: 'Proyectos', desc: 'Gestión de proyectos' },
  { path: 'ceo/ideas', icon: '💡', title: 'Ideas', desc: 'Backlog de ideas' },
  { path: 'ceo/pulso', icon: '📊', title: 'Pulso Semanal', desc: 'Resumen de la semana' },
  { path: 'ceo/roadmap', icon: '🗺️', title: 'Roadmap', desc: 'Timeline de proyectos' },
  { path: 'ceo/finanzas', icon: '💰', title: 'Finanzas', desc: 'Cash flow y gastos operativos' },
]

export default function CeoOverview() {
  const { clientSlug } = useClient()
  const { getTeam, getCeoProjects, getCeoMeetings, getCeoIdeas, getCeoDailyDigests } = useClientData()

  const [team, loadingTeam] = useAsync(getTeam, [])
  const [projects, loadingProjects] = useAsync(getCeoProjects, [])
  const [meetings, loadingMeetings] = useAsync(getCeoMeetings, [])
  const [ideas, loadingIdeas] = useAsync(getCeoIdeas, [])
  const [digests] = useAsync(getCeoDailyDigests, [])

  const loading = loadingTeam || loadingProjects || loadingMeetings || loadingIdeas

  const totalTeam = team.length
  const activeTeam = team.filter(m => m.active !== false).length
  const today = new Date().toISOString().split('T')[0]
  const meetingsToday = meetings.filter(m => m.date === today).length
  const activeProjects = projects.filter(p => p.status === 'in_progress').length
  const pendingIdeas = ideas.filter(i => i.status === 'new' || i.status === 'reviewing').length
  const latestDigest = digests.length > 0 ? digests[0] : null

  return (
    <div className="form-page">
      <h2 style={{ margin: '0 0 24px', color: '#fff' }}>🧠 CEO Mind — Overview</h2>

      <div className="stats-grid stats-grid--4" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-card-icon">👥</div>
          <div className="stat-card-value">{loading ? '...' : totalTeam}</div>
          <div className="stat-card-label">Equipo Total</div>
          <div className="stat-card-sub">{activeTeam} activos</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">🎙️</div>
          <div className="stat-card-value">{loading ? '...' : meetingsToday}</div>
          <div className="stat-card-label">Meetings Hoy</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">📁</div>
          <div className="stat-card-value">{loading ? '...' : activeProjects}</div>
          <div className="stat-card-label">Proyectos Activos</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">💡</div>
          <div className="stat-card-value">{loading ? '...' : pendingIdeas}</div>
          <div className="stat-card-label">Ideas Pendientes</div>
        </div>
      </div>

      <div className="form-card" style={{ marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 12px', color: '#fff' }}>📋 Resumen Diario</h3>
        {latestDigest ? (
          <div className="ceo-digest-content">
            <p>{latestDigest.summary}</p>
            {latestDigest.highlights && (
              <><h4>Highlights</h4><p>{latestDigest.highlights}</p></>
            )}
          </div>
        ) : (
          <div className="ceo-phase-banner">
            <span className="ceo-phase-banner__icon">🤖</span>
            <div className="ceo-phase-banner__text">
              <strong>Claude AI generará resúmenes automáticos</strong> — Próximamente en Fase 2
            </div>
          </div>
        )}
      </div>

      <h3 style={{ margin: '0 0 16px', color: '#fff' }}>Acceso Rápido</h3>
      <div className="ceo-quick-cards">
        {QUICK_LINKS.map(link => (
          <Link key={link.path} to={`/${clientSlug}/${link.path}`} className="ceo-quick-card">
            <span className="ceo-quick-card__icon">{link.icon}</span>
            <span className="ceo-quick-card__title">{link.title}</span>
            <span className="ceo-quick-card__desc">{link.desc}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
