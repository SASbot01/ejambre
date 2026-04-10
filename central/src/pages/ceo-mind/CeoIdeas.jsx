import { useState } from 'react'
import { useAsync } from '../../hooks/useAsync'
import { useClientData } from '../../hooks/useClientData'

const STATUS_LABELS = { new: 'Nueva', reviewing: 'En Revisión', approved: 'Aprobada', discarded: 'Descartada' }
const PRIORITY_LABELS = { low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica' }
const STATUSES = ['new', 'reviewing', 'approved', 'discarded']
const PRIORITIES = ['low', 'medium', 'high', 'critical']

export default function CeoIdeas() {
  const { getCeoIdeas, addCeoIdea, updateCeoIdea, deleteCeoIdea } = useClientData()
  const [ideas, loading, refresh] = useAsync(getCeoIdeas, [])
  const [quickInput, setQuickInput] = useState('')
  const [expanded, setExpanded] = useState(null)

  const counts = {
    total: ideas.length,
    new: ideas.filter(i => i.status === 'new').length,
    reviewing: ideas.filter(i => i.status === 'reviewing').length,
    approved: ideas.filter(i => i.status === 'approved').length,
  }

  async function handleQuickAdd(e) {
    e.preventDefault()
    if (!quickInput.trim()) return
    try {
      await addCeoIdea({ title: quickInput.trim(), source: 'manual', priority: 'medium', status: 'new' })
      setQuickInput('')
      await refresh()
    } catch (err) { alert('Error: ' + err.message) }
  }

  async function handleStatusChange(id, newStatus) { await updateCeoIdea(id, { status: newStatus }); refresh() }
  async function handlePriorityChange(id, newPriority) { await updateCeoIdea(id, { priority: newPriority }); refresh() }
  async function handleDelete(id) { if (!confirm('¿Eliminar esta idea?')) return; await deleteCeoIdea(id); refresh() }

  return (
    <div className="form-page">
      <h2 style={{ margin: '0 0 24px', color: '#fff' }}>💡 Ideas & Backlog</h2>

      <div className="stats-grid stats-grid--4" style={{ marginBottom: 24 }}>
        <div className="stat-card"><div className="stat-card-icon">💡</div><div className="stat-card-value">{loading ? '...' : counts.total}</div><div className="stat-card-label">Total</div></div>
        <div className="stat-card"><div className="stat-card-icon">🆕</div><div className="stat-card-value">{loading ? '...' : counts.new}</div><div className="stat-card-label">Nuevas</div></div>
        <div className="stat-card"><div className="stat-card-icon">🔍</div><div className="stat-card-value">{loading ? '...' : counts.reviewing}</div><div className="stat-card-label">En Revisión</div></div>
        <div className="stat-card"><div className="stat-card-icon">✅</div><div className="stat-card-value">{loading ? '...' : counts.approved}</div><div className="stat-card-label">Aprobadas</div></div>
      </div>

      <form className="ceo-idea-input" onSubmit={handleQuickAdd}>
        <input placeholder="Escribe una idea y presiona Enter..." value={quickInput} onChange={e => setQuickInput(e.target.value)} />
        <button type="submit" className="btn-action">Agregar</button>
      </form>

      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>Título</th><th>Source</th><th>Prioridad</th><th>Status</th><th>Fecha</th><th>Acciones</th></tr></thead>
          <tbody>
            {ideas.length === 0 && !loading && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#666' }}>No hay ideas todavía.</td></tr>}
            {ideas.map(idea => (
              <>
                <tr key={idea.id} onClick={() => setExpanded(expanded === idea.id ? null : idea.id)} style={{ cursor: idea.description ? 'pointer' : 'default' }}>
                  <td style={{ fontWeight: 600, color: '#fff' }}>
                    {idea.description && <span style={{ marginRight: 4, color: '#666' }}>{expanded === idea.id ? '▼' : '▶'}</span>}
                    {idea.title}
                  </td>
                  <td><span className={`badge badge--source-${idea.source}`}>{idea.source}</span></td>
                  <td>
                    <select className="ceo-inline-select" value={idea.priority} onChange={e => handlePriorityChange(idea.id, e.target.value)} onClick={e => e.stopPropagation()}>
                      {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="ceo-inline-select" value={idea.status} onChange={e => handleStatusChange(idea.id, e.target.value)} onClick={e => e.stopPropagation()}>
                      {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </td>
                  <td style={{ fontSize: '0.78rem', color: '#888' }}>{idea.created_at ? new Date(idea.created_at).toLocaleDateString('es') : '—'}</td>
                  <td><button className="btn-action btn-action--secondary" style={{ fontSize: '0.72rem', padding: '3px 8px' }} onClick={e => { e.stopPropagation(); handleDelete(idea.id) }}>🗑</button></td>
                </tr>
                {expanded === idea.id && idea.description && (
                  <tr key={idea.id + '-desc'}><td colSpan={6} style={{ padding: '8px 16px', background: 'rgba(0,0,0,0.1)', color: '#aaa', fontSize: '0.82rem' }}>{idea.description}</td></tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
