import { useMemo } from 'react'
import { useAsync } from '../../hooks/useAsync'
import { useClientData } from '../../hooks/useClientData'

const STATUS_LABELS = { idea: 'Idea', planned: 'Planificado', in_progress: 'En Progreso', paused: 'Pausado', completed: 'Completado' }

function getMonthsBetween(startStr, endStr) {
  const start = new Date(startStr), end = new Date(endStr), months = []
  const d = new Date(start.getFullYear(), start.getMonth(), 1)
  while (d <= end) { months.push({ year: d.getFullYear(), month: d.getMonth() }); d.setMonth(d.getMonth() + 1) }
  return months
}

function formatMonth(year, month) { return new Date(year, month).toLocaleDateString('es', { month: 'short', year: '2-digit' }) }

export default function CeoRoadmap() {
  const { getCeoProjects } = useClientData()
  const [projects, loading] = useAsync(getCeoProjects, [])
  const projectsWithDates = projects.filter(p => (p.startDate || p.start_date) && (p.endDate || p.end_date))

  const { months, minDate, totalDays } = useMemo(() => {
    if (projectsWithDates.length === 0) return { months: [], minDate: null, totalDays: 0 }
    const allStarts = projectsWithDates.map(p => new Date(p.startDate || p.start_date))
    const allEnds = projectsWithDates.map(p => new Date(p.endDate || p.end_date))
    const minD = new Date(Math.min(...allStarts)); minD.setDate(1)
    const maxD = new Date(Math.max(...allEnds)); maxD.setMonth(maxD.getMonth() + 1, 0)
    return { months: getMonthsBetween(minD.toISOString(), maxD.toISOString()), minDate: minD, totalDays: Math.max(1, (maxD - minD) / (1000 * 60 * 60 * 24)) }
  }, [projectsWithDates])

  function getBarStyle(project) {
    if (!minDate) return {}
    const start = new Date(project.startDate || project.start_date), end = new Date(project.endDate || project.end_date)
    const leftDays = Math.max(0, (start - minDate) / (1000 * 60 * 60 * 24))
    const widthDays = Math.max(1, (end - start) / (1000 * 60 * 60 * 24))
    return { left: `${(leftDays / totalDays) * 100}%`, width: `${(widthDays / totalDays) * 100}%` }
  }

  return (
    <div className="form-page">
      <h2 style={{ margin: '0 0 24px', color: '#fff' }}>🗺️ Roadmap</h2>

      {loading ? <p style={{ color: '#666' }}>Cargando...</p> : projectsWithDates.length === 0 ? (
        <div className="form-card" style={{ textAlign: 'center', color: '#666', padding: 40 }}>No hay proyectos con fechas definidas. Agrega fechas de inicio y fin a tus proyectos para verlos aquí.</div>
      ) : (
        <div className="form-card">
          <div className="ceo-roadmap">
            <div className="ceo-roadmap-header">
              {months.map((m, i) => <span key={i}>{formatMonth(m.year, m.month)}</span>)}
            </div>
            <div className="ceo-roadmap-body">
              {projectsWithDates.map(project => (
                <div className="ceo-roadmap-row" key={project.id}>
                  <div className="ceo-roadmap-label">{project.name}</div>
                  <div className={`ceo-roadmap-bar ceo-roadmap-bar--${project.status}`} style={getBarStyle(project)} title={`${project.name} — ${STATUS_LABELS[project.status]} (${project.progress || 0}%)`}>
                    {project.progress > 0 && `${project.progress}%`}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#888' }}>
                <div style={{ width: 12, height: 12, borderRadius: 3 }} className={`ceo-roadmap-bar--${key}`} />{label}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <h3 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: 12 }}>🏁 Hitos</h3>
        <div className="ceo-phase-banner">
          <span className="ceo-phase-banner__icon">📌</span>
          <div className="ceo-phase-banner__text"><strong>Hitos y milestones</strong> — Se vincularán a proyectos en Fase 2.</div>
        </div>
      </div>
    </div>
  )
}
