import { useState, useMemo, useCallback } from 'react'
import { useClient } from '../contexts/ClientContext'
import { useClientData } from '../hooks/useClientData'
import { useAsync } from '../hooks/useAsync'
import { Plus, X, Flag, Clock, Check, Square, Trash2, User, ChevronDown, AlertTriangle } from 'lucide-react'

const PRIO_COLORS = { high: '#EF4444', medium: '#F59E0B', low: '#6B7280' }

export default function TaskManagementPage() {
  const { clientSlug } = useClient()
  const en = clientSlug === 'black-wolf'
  const L = (es, enText) => en ? enText : es
  const locale = en ? 'en-US' : 'es-ES'
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }) : ''
  const PRIO_LABELS = { high: L('Alta', 'High'), medium: L('Media', 'Medium'), low: L('Baja', 'Low') }
  const { getTeam, getCrmTasks, addCrmTask, updateCrmTask, deleteCrmTask } = useClientData()
  const [team] = useAsync(getTeam, [])
  const [tasks, , refreshTasks] = useAsync(useCallback(() => getCrmTasks(), []), [])
  const [filter, setFilter] = useState('all')
  const [activeView, setActiveView] = useState('todas')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', dueDate: '', assignedTo: '', priority: 'medium' })
  const [dragItem, setDragItem] = useState(null)

  const filteredTasks = useMemo(() => {
    if (!tasks) return []
    if (filter === 'pending') return tasks.filter(t => !t.completed)
    if (filter === 'completed') return tasks.filter(t => t.completed)
    return tasks
  }, [tasks, filter])

  const columns = useMemo(() => {
    const members = (team || []).filter(m => m.active !== false)
    const unassigned = { id: '__unassigned', name: L('Sin Asignar', 'Unassigned') }
    return [unassigned, ...members]
  }, [team])

  const urgentTasks = useMemo(() => {
    if (!filteredTasks) return []
    const now = new Date()
    return filteredTasks.filter(t => {
      if (t.completed) return false
      if (t.priority === 'high') return true
      if (t.dueDate && new Date(t.dueDate) < now) return true
      return false
    }).sort((a, b) => {
      if (a.priority === 'high' && b.priority !== 'high') return -1
      if (b.priority === 'high' && a.priority !== 'high') return 1
      return (a.dueDate || '').localeCompare(b.dueDate || '')
    })
  }, [filteredTasks])

  const tasksByMember = useMemo(() => {
    const map = {}
    columns.forEach(c => { map[c.name] = [] })
    filteredTasks.forEach(t => {
      const key = t.assignedTo || L('Sin Asignar', 'Unassigned')
      if (!map[key]) map[key] = []
      map[key].push(t)
    })
    return map
  }, [filteredTasks, columns])

  const handleAdd = async () => {
    if (!form.title.trim()) return
    await addCrmTask({
      title: form.title, description: form.description || undefined,
      dueDate: form.dueDate || undefined, assignedTo: form.assignedTo || undefined,
      priority: form.priority, completed: false,
    })
    refreshTasks()
    setForm({ title: '', description: '', dueDate: '', assignedTo: '', priority: 'medium' })
    setShowForm(false)
  }

  const handleToggle = async (t) => {
    await updateCrmTask(t.id, { completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : null })
    refreshTasks()
  }

  const handleDelete = async (t) => {
    if (!confirm(L('Eliminar tarea?', 'Delete task?'))) return
    await deleteCrmTask(t.id)
    refreshTasks()
  }

  const handleDrop = async (memberName) => {
    if (!dragItem || dragItem.assignedTo === memberName) { setDragItem(null); return }
    const newAssigned = memberName === L('Sin Asignar', 'Unassigned') ? '' : memberName
    await updateCrmTask(dragItem.id, { assignedTo: newAssigned })
    refreshTasks()
    setDragItem(null)
  }

  const S = {
    page: { padding: 24, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 },
    viewBar: { display: 'flex', gap: 4, background: 'var(--bg-card)', borderRadius: 8, padding: 3, marginBottom: 14, flexShrink: 0, alignSelf: 'flex-start' },
    viewTab: (active) => ({ padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, border: 'none', background: active ? 'var(--orange)' : 'transparent', color: active ? '#000' : 'var(--text-secondary)', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 5 }),
    title: { fontSize: 22, fontWeight: 800, color: 'var(--text)' },
    filterBar: { display: 'flex', gap: 6, alignItems: 'center' },
    filterBtn: (active) => ({
      padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, border: 'none',
      background: active ? 'var(--orange)' : 'var(--bg-card)', color: active ? '#000' : 'var(--text-secondary)',
    }),
    board: { display: 'flex', gap: 14, flex: 1, overflow: 'auto', paddingBottom: 12 },
    col: (isDragOver) => ({
      minWidth: 260, maxWidth: 300, flex: '1 0 260px', display: 'flex', flexDirection: 'column',
      background: isDragOver ? 'rgba(255,107,0,.05)' : 'var(--bg-card)', borderRadius: 12,
      border: isDragOver ? '2px dashed var(--orange)' : '1px solid var(--border)', overflow: 'hidden',
    }),
    colHeader: { padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    colTitle: { fontWeight: 700, fontSize: 13, color: 'var(--text)' },
    colCount: { fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg)', padding: '2px 8px', borderRadius: 10 },
    colBody: { flex: 1, overflow: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 },
    card: (dragging) => ({
      padding: '10px 12px', background: dragging ? 'rgba(255,107,0,.1)' : 'var(--bg)', borderRadius: 8,
      border: `1px solid ${dragging ? 'var(--orange)' : 'var(--border)'}`, cursor: 'grab',
      transition: 'all .15s', opacity: dragging ? 0.5 : 1,
    }),
    cardTitle: (completed) => ({ fontWeight: 600, fontSize: 13, color: 'var(--text)', textDecoration: completed ? 'line-through' : 'none', opacity: completed ? 0.5 : 1 }),
    meta: { display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' },
    metaItem: (color) => ({ fontSize: 10, color: color || 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }),
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 999 },
    modal: { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 440, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14, zIndex: 1000, padding: 24 },
    input: { width: '100%', padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' },
    label: { fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 4 },
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={S.title}>{L('Gestion de Tareas', 'Task Management')}</span>
          <div style={S.filterBar}>
            {[['all', L('Todas', 'All')], ['pending', L('Pendientes', 'Pending')], ['completed', L('Completadas', 'Completed')]].map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} style={S.filterBtn(filter === k)}>{l}</button>
            ))}
          </div>
        </div>
        <button onClick={() => setShowForm(true)} style={{ padding: '8px 16px', background: 'var(--orange)', color: '#000', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> {L('Nueva Tarea', 'New Task')}
        </button>
      </div>

      <div style={S.viewBar}>
        {[['todas', L('Todas', 'All')], ['persona', L('Por Persona', 'By Person')], ['urgentes', L('Urgentes', 'Urgent')]].map(([k, l]) => (
          <button key={k} onClick={() => setActiveView(k)} style={S.viewTab(activeView === k)}>
            {k === 'urgentes' && <AlertTriangle size={12} />}
            {l}
            {k === 'urgentes' && urgentTasks.length > 0 && <span style={{ background: '#EF4444', color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 8, fontWeight: 700 }}>{urgentTasks.length}</span>}
          </button>
        ))}
      </div>

      {activeView === 'urgentes' ? (
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {urgentTasks.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>{L('No hay tareas urgentes', 'No urgent tasks')}</div>}
          {urgentTasks.map(t => (
            <div key={t.id} style={{ padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => handleToggle(t)} style={{ padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', flexShrink: 0 }}>
                <Square size={15} />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{t.title}</div>
                {t.description && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{t.description.slice(0, 80)}</div>}
              </div>
              {t.assignedTo && <span style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}><User size={10} />{t.assignedTo}</span>}
              {t.priority && <span style={{ fontSize: 10, color: PRIO_COLORS[t.priority], fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}><Flag size={10} />{PRIO_LABELS[t.priority]}</span>}
              {t.dueDate && <span style={{ fontSize: 10, color: new Date(t.dueDate) < new Date() ? '#EF4444' : 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={10} />{fmtDate(t.dueDate)}</span>}
              <button onClick={() => handleDelete(t)} style={{ padding: 2, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', opacity: 0.4 }}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      ) : (
      <div style={S.board}>
        {columns.map(col => {
          const colTasks = tasksByMember[col.name] || []
          return (
            <div key={col.id} style={S.col(false)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(col.name)}>
              <div style={S.colHeader}>
                <span style={S.colTitle}>{col.name}</span>
                <span style={S.colCount}>{colTasks.length}</span>
              </div>
              <div style={S.colBody}>
                {colTasks.map(t => (
                  <div key={t.id} draggable style={S.card(dragItem?.id === t.id)}
                    onDragStart={() => setDragItem(t)} onDragEnd={() => setDragItem(null)}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <button onClick={() => handleToggle(t)} style={{ padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', color: t.completed ? 'var(--orange)' : 'var(--text-secondary)', flexShrink: 0, marginTop: 1 }}>
                        {t.completed ? <Check size={15} /> : <Square size={15} />}
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={S.cardTitle(t.completed)}>{t.title}</div>
                        {t.description && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3, fontStyle: 'italic' }}>{t.description.slice(0, 60)}</div>}
                        <div style={S.meta}>
                          {t.priority && <span style={S.metaItem(PRIO_COLORS[t.priority])}><Flag size={9} /> {PRIO_LABELS[t.priority]}</span>}
                          {t.dueDate && <span style={S.metaItem(new Date(t.dueDate) < new Date() && !t.completed ? '#EF4444' : null)}><Clock size={9} /> {fmtDate(t.dueDate)}</span>}
                        </div>
                      </div>
                      <button onClick={() => handleDelete(t)} style={{ padding: 2, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', opacity: 0.4, flexShrink: 0 }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
                {colTasks.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12, opacity: 0.5 }}>{L('Sin tareas', 'No tasks')}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      )}

      {showForm && (
        <>
          <div onClick={() => setShowForm(false)} style={S.overlay} />
          <div style={S.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{L('Nueva Tarea', 'New Task')}</span>
              <button onClick={() => setShowForm(false)} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={S.label}>{L('Titulo *', 'Title *')}</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder={L('Nombre de la tarea', 'Task name')} style={S.input} />
              </div>
              <div>
                <label style={S.label}>{L('Descripcion', 'Description')}</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder={L('Detalles...', 'Details...')} style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={S.label}>{L('Fecha limite', 'Due date')}</label>
                  <input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} style={{ ...S.input, colorScheme: 'dark' }} />
                </div>
                <div>
                  <label style={S.label}>{L('Prioridad', 'Priority')}</label>
                  <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} style={S.input}>
                    <option value="low">{L('Baja', 'Low')}</option>
                    <option value="medium">{L('Media', 'Medium')}</option>
                    <option value="high">{L('Alta', 'High')}</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={S.label}>{L('Asignar a', 'Assign to')}</label>
                <select value={form.assignedTo} onChange={e => setForm(p => ({ ...p, assignedTo: e.target.value }))} style={S.input}>
                  <option value="">{L('Sin asignar', 'Unassigned')}</option>
                  {(team || []).filter(m => m.active !== false).map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button onClick={() => setShowForm(false)} style={{ padding: '8px 18px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>{L('Cancelar', 'Cancel')}</button>
                <button onClick={handleAdd} style={{ padding: '8px 18px', background: 'var(--orange)', color: '#000', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>{L('Crear Tarea', 'Create Task')}</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
