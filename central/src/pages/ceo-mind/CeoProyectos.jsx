import { useState } from 'react'
import { useAsync } from '../../hooks/useAsync'
import { useClientData } from '../../hooks/useClientData'

const STATUSES = ['idea', 'planned', 'in_progress', 'paused', 'completed']
const STATUS_LABELS = { idea: 'Idea', planned: 'Planificado', in_progress: 'En Progreso', paused: 'Pausado', completed: 'Completado' }
const PRIORITIES = ['low', 'medium', 'high', 'critical']
const PRIORITY_LABELS = { low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica' }
const EMPTY_FORM = { name: '', description: '', owner: '', priority: 'medium', status: 'idea', startDate: '', endDate: '', progress: 0, tags: '' }

export default function CeoProyectos() {
  const { getCeoProjects, addCeoProject, updateCeoProject, deleteCeoProject, getTeam } = useClientData()
  const [projects, loading, refresh] = useAsync(getCeoProjects, [])
  const [team] = useAsync(getTeam, [])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)

  const grouped = STATUSES.reduce((acc, s) => { acc[s] = projects.filter(p => p.status === s); return acc }, {})

  function startEdit(project) {
    setForm({
      name: project.name || '', description: project.description || '', owner: project.owner || '',
      priority: project.priority || 'medium', status: project.status || 'idea',
      startDate: project.startDate || project.start_date || '', endDate: project.endDate || project.end_date || '',
      progress: project.progress || 0, tags: project.tags || '',
    })
    setEditingId(project.id)
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      if (editingId) await updateCeoProject(editingId, form)
      else await addCeoProject(form)
      await refresh()
      setShowForm(false); setForm(EMPTY_FORM); setEditingId(null)
    } catch (err) { alert('Error: ' + err.message) }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este proyecto?')) return
    await deleteCeoProject(id); refresh()
  }

  async function handleStatusChange(id, newStatus) {
    await updateCeoProject(id, { status: newStatus }); refresh()
  }

  return (
    <div className="form-page">
      <div className="ceo-section-header">
        <h2 style={{ margin: 0, color: '#fff' }}>📁 Proyectos</h2>
        <button className="btn-action" onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(EMPTY_FORM) }}>+ Nuevo Proyecto</button>
      </div>

      {showForm && (
        <form className="form-card" style={{ marginBottom: 24 }} onSubmit={handleSubmit}>
          <h3 className="form-title">{editingId ? 'Editar Proyecto' : 'Nuevo Proyecto'}</h3>
          <div className="form-grid form-grid--3">
            <div className="form-group"><label>Nombre *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="form-group"><label>Owner</label>
              <select value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}>
                <option value="">Sin asignar</option>
                {team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Prioridad</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>{PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}</select>
            </div>
            <div className="form-group"><label>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>{STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select>
            </div>
            <div className="form-group"><label>Fecha Inicio</label><input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></div>
            <div className="form-group"><label>Fecha Fin</label><input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} /></div>
            <div className="form-group"><label>Progreso ({form.progress}%)</label><input type="range" min={0} max={100} value={form.progress} onChange={e => setForm(f => ({ ...f, progress: Number(e.target.value) }))} /></div>
            <div className="form-group"><label>Tags (coma)</label><input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} /></div>
          </div>
          <div className="form-group" style={{ marginTop: 12 }}><label>Descripción</label><textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div className="form-actions">
            <button type="submit" className="btn-action">{editingId ? 'Guardar Cambios' : 'Crear Proyecto'}</button>
            <button type="button" className="btn-action btn-action--secondary" onClick={() => { setShowForm(false); setEditingId(null) }}>Cancelar</button>
          </div>
        </form>
      )}

      {loading ? <p style={{ color: '#666' }}>Cargando...</p> : (
        STATUSES.map(status => {
          const items = grouped[status]
          if (items.length === 0) return null
          return (
            <div key={status} style={{ marginBottom: 28 }}>
              <h3 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`badge badge--status-${status}`}>{STATUS_LABELS[status]}</span>
                <span style={{ color: '#666', fontSize: '0.8rem' }}>({items.length})</span>
              </h3>
              {items.map(project => (
                <div className="form-card" key={project.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.95rem' }}>{project.name}</div>
                      {project.description && <div style={{ color: '#888', fontSize: '0.8rem', marginTop: 4 }}>{project.description}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className={`badge badge--priority-${project.priority}`}>{project.priority}</span>
                      {project.owner && <span style={{ fontSize: '0.78rem', color: '#888' }}>👤 {project.owner}</span>}
                      <select className="ceo-inline-select" value={project.status} onChange={e => handleStatusChange(project.id, e.target.value)} onClick={e => e.stopPropagation()}>
                        {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                      </select>
                      <button className="btn-action btn-action--secondary" style={{ fontSize: '0.72rem', padding: '3px 8px' }} onClick={() => startEdit(project)}>✏️</button>
                      <button className="btn-action btn-action--secondary" style={{ fontSize: '0.72rem', padding: '3px 8px' }} onClick={() => handleDelete(project.id)}>🗑</button>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="ceo-progress" style={{ flex: 1 }}><div className="ceo-progress__fill" style={{ width: `${project.progress || 0}%` }} /></div>
                    <span style={{ fontSize: '0.72rem', color: '#888' }}>{project.progress || 0}%</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: '0.75rem', color: '#666', flexWrap: 'wrap' }}>
                    {(project.startDate || project.start_date) && <span>📅 Inicio: {project.startDate || project.start_date}</span>}
                    {(project.endDate || project.end_date) && <span>🏁 Fin: {project.endDate || project.end_date}</span>}
                    {project.tags && (Array.isArray(project.tags) ? project.tags : project.tags.split(',')).map(t => <span key={t} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 4, padding: '1px 6px' }}>{String(t).trim()}</span>)}
                  </div>
                </div>
              ))}
            </div>
          )
        })
      )}

      {!loading && projects.length === 0 && (
        <div className="form-card" style={{ textAlign: 'center', color: '#666', padding: 40 }}>No hay proyectos todavía. Crea tu primer proyecto para empezar.</div>
      )}
    </div>
  )
}
