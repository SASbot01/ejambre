import { useState, useMemo, useEffect, useCallback, Fragment } from 'react'
import { useClient } from '../contexts/ClientContext'
import { Calendar, Plus, X, ChevronLeft, ChevronRight, BarChart3, Clock, Flag, Edit3, Trash2, Save } from 'lucide-react'

const COLORS = ['#EF4444', '#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#F97316', '#06B6D4']

function loadEvents(clientId) {
  try { return JSON.parse(localStorage.getItem(`bw_planning_events_${clientId}`)) || [] }
  catch { return [] }
}
function saveEvents(clientId, events) {
  localStorage.setItem(`bw_planning_events_${clientId}`, JSON.stringify(events))
}

const EMPTY_FORM = { title: '', description: '', startDate: '', endDate: '', color: '#3B82F6', category: '' }

export default function PlanningPage() {
  const { clientId, clientSlug } = useClient()
  const en = clientSlug === 'black-wolf'
  const L = (es, enText) => en ? enText : es
  const locale = en ? 'en-US' : 'es-ES'
  const fmtDate = d => d ? new Date(d).toLocaleDateString(locale, { day: '2-digit', month: 'short' }) : ''
  const VIEWS = [
    { key: 'calendar', label: L('Calendario', 'Calendar') },
    { key: 'gantt', label: 'Gantt' },
    { key: 'dashboard', label: 'Dashboard' },
  ]
  const [view, setView] = useState('calendar')
  const [events, setEvents] = useState(() => loadEvents(clientId))
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [calMonth, setCalMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })

  useEffect(() => { saveEvents(clientId, events) }, [events, clientId])

  const openAdd = () => { setForm(EMPTY_FORM); setEditId(null); setShowForm(true) }
  const openEdit = (ev) => { setForm({ title: ev.title, description: ev.description || '', startDate: ev.startDate, endDate: ev.endDate, color: ev.color, category: ev.category || '' }); setEditId(ev.id); setShowForm(true) }
  const handleSave = () => {
    if (!form.title.trim() || !form.startDate || !form.endDate) return
    if (editId) {
      setEvents(prev => prev.map(e => e.id === editId ? { ...e, ...form } : e))
    } else {
      setEvents(prev => [...prev, { ...form, id: Date.now().toString() }])
    }
    setShowForm(false)
  }
  const handleDelete = (id) => { if (confirm(L('Eliminar evento?', 'Delete event?'))) setEvents(prev => prev.filter(e => e.id !== id)) }

  // Calendar helpers
  const calDays = useMemo(() => {
    const y = calMonth.getFullYear(), m = calMonth.getMonth()
    const first = new Date(y, m, 1), last = new Date(y, m + 1, 0)
    const startDow = (first.getDay() + 6) % 7 // Mon=0
    const days = []
    for (let i = -startDow; i <= last.getDate() + (6 - (last.getDay() + 6) % 7) - 1; i++) {
      days.push(new Date(y, m, i + 1))
    }
    return days
  }, [calMonth])

  const eventsForDay = useCallback((day) => {
    const ds = day.toISOString().slice(0, 10)
    return events.filter(ev => {
      const s = ev.startDate.slice(0, 10), e = ev.endDate.slice(0, 10)
      return ds >= s && ds <= e
    })
  }, [events])

  // Gantt helpers
  const ganttRange = useMemo(() => {
    const y = calMonth.getFullYear(), m = calMonth.getMonth()
    const start = new Date(y, m, 1), end = new Date(y, m + 1, 0)
    const days = []
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) days.push(new Date(d))
    return days
  }, [calMonth])

  // Dashboard stats
  const stats = useMemo(() => {
    const now = new Date(), weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7)
    const upcoming = events.filter(e => { const s = new Date(e.startDate); return s >= now && s <= weekEnd })
    const overdue = events.filter(e => new Date(e.endDate) < now)
    const cats = {}; events.forEach(e => { const c = e.category || L('Sin categoria', 'No category'); cats[c] = (cats[c] || 0) + 1 })
    return { total: events.length, upcoming: upcoming.length, overdue: overdue.length, cats }
  }, [events])

  const monthLabel = calMonth.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  const prevMonth = () => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))
  const nextMonth = () => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))

  const S = {
    page: { padding: 24, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0, flexWrap: 'wrap', gap: 10 },
    title: { fontSize: 22, fontWeight: 800, color: 'var(--text)' },
    tabs: { display: 'flex', gap: 4, background: 'var(--bg-card)', borderRadius: 8, padding: 3 },
    tab: (a) => ({ padding: '7px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, border: 'none', background: a ? 'var(--orange)' : 'transparent', color: a ? '#000' : 'var(--text-secondary)', transition: 'all .15s' }),
    addBtn: { padding: '8px 16px', background: 'var(--orange)', color: '#000', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 },
    nav: { display: 'flex', alignItems: 'center', gap: 8 },
    navBtn: { padding: '6px 10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' },
    monthLabel: { fontSize: 15, fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize', minWidth: 160, textAlign: 'center' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, flex: 1, overflow: 'auto' },
    dayHeader: { padding: '8px 4px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', background: 'var(--bg-card)' },
    day: (isMonth, isToday) => ({ minHeight: 80, padding: 4, background: isToday ? 'rgba(255,107,0,.08)' : 'var(--bg-card)', border: '1px solid var(--border)', opacity: isMonth ? 1 : 0.35, cursor: 'pointer', overflow: 'hidden' }),
    dayNum: (isToday) => ({ fontSize: 11, fontWeight: isToday ? 800 : 500, color: isToday ? 'var(--orange)' : 'var(--text-secondary)', marginBottom: 2 }),
    evTag: (color) => ({ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: color + '30', color, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', marginBottom: 1, cursor: 'pointer' }),
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 999 },
    modal: { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 440, maxHeight: '90vh', overflow: 'auto', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14, zIndex: 1000, padding: 24 },
    input: { width: '100%', padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' },
    label: { fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 4 },
    card: { padding: 14, background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)' },
    statCard: { padding: 16, background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)', textAlign: 'center' },
    statNum: { fontSize: 28, fontWeight: 800, color: 'var(--orange)' },
    statLabel: { fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 },
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={S.title}>Planning</span>
          <div style={S.tabs}>
            {VIEWS.map(v => <button key={v.key} onClick={() => setView(v.key)} style={S.tab(view === v.key)}>{v.label}</button>)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {(view === 'calendar' || view === 'gantt') && (
            <div style={S.nav}>
              <button onClick={prevMonth} style={S.navBtn}><ChevronLeft size={14} /></button>
              <span style={S.monthLabel}>{monthLabel}</span>
              <button onClick={nextMonth} style={S.navBtn}><ChevronRight size={14} /></button>
            </div>
          )}
          <button onClick={openAdd} style={S.addBtn}><Plus size={14} /> {L('Evento', 'Event')}</button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* CALENDAR VIEW */}
        {view === 'calendar' && (
          <div style={S.grid}>
            {(en ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']).map(d => <div key={d} style={S.dayHeader}>{d}</div>)}
            {calDays.map((day, i) => {
              const ds = day.toISOString().slice(0, 10)
              const isMonth = day.getMonth() === calMonth.getMonth()
              const dayEvs = eventsForDay(day)
              return (
                <div key={i} style={S.day(isMonth, ds === today)}>
                  <div style={S.dayNum(ds === today)}>{day.getDate()}</div>
                  {dayEvs.slice(0, 3).map(ev => (
                    <span key={ev.id} style={S.evTag(ev.color)} onClick={() => openEdit(ev)} title={ev.title}>{ev.title}</span>
                  ))}
                  {dayEvs.length > 3 && <span style={{ fontSize: 9, color: 'var(--text-secondary)' }}>+{dayEvs.length - 3}</span>}
                </div>
              )
            })}
          </div>
        )}

        {/* GANTT VIEW */}
        {view === 'gantt' && (
          <div style={{ overflow: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `180px repeat(${ganttRange.length}, minmax(28px, 1fr))`, fontSize: 10, minWidth: ganttRange.length * 28 + 180 }}>
              {/* Header */}
              <div style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--text-secondary)', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', position: 'sticky', left: 0, zIndex: 2 }}>{L('Evento', 'Event')}</div>
              {ganttRange.map((d, i) => {
                const ds = d.toISOString().slice(0, 10)
                return <div key={i} style={{ padding: '8px 2px', textAlign: 'center', fontWeight: ds === today ? 800 : 500, color: ds === today ? 'var(--orange)' : 'var(--text-secondary)', background: ds === today ? 'rgba(255,107,0,.08)' : 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>{d.getDate()}</div>
              })}
              {/* Rows */}
              {events.length === 0 && (
                <>
                  <div style={{ padding: 20, gridColumn: `1 / -1`, textAlign: 'center', color: 'var(--text-secondary)' }}>{L('No hay eventos', 'No events')}</div>
                </>
              )}
              {events.map(ev => {
                const startIdx = ganttRange.findIndex(d => d.toISOString().slice(0, 10) >= ev.startDate.slice(0, 10))
                const endIdx = ganttRange.findIndex(d => d.toISOString().slice(0, 10) >= ev.endDate.slice(0, 10))
                const si = startIdx === -1 ? 0 : startIdx
                const ei = endIdx === -1 ? ganttRange.length - 1 : endIdx
                return (
                  <Fragment key={ev.id}>
                    <div style={{ padding: '6px 10px', fontWeight: 600, color: 'var(--text)', borderBottom: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 6, position: 'sticky', left: 0, zIndex: 2, cursor: 'pointer' }} onClick={() => openEdit(ev)}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: ev.color, flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</span>
                    </div>
                    {ganttRange.map((d, i) => {
                      const inRange = i >= si && i <= ei
                      const isStart = i === si, isEnd = i === ei
                      return (
                        <div key={i} style={{ borderBottom: '1px solid var(--border)', padding: '4px 0', display: 'flex', alignItems: 'center' }}>
                          {inRange && (
                            <div style={{ height: 18, background: ev.color + '60', borderLeft: isStart ? `3px solid ${ev.color}` : 'none', borderRadius: isStart && isEnd ? '4px' : isStart ? '4px 0 0 4px' : isEnd ? '0 4px 4px 0' : 0, width: '100%' }} />
                          )}
                        </div>
                      )
                    })}
                  </Fragment>
                )
              })}
            </div>
          </div>
        )}

        {/* DASHBOARD VIEW */}
        {view === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <div style={S.statCard}><div style={S.statNum}>{stats.total}</div><div style={S.statLabel}>{L('Total Eventos', 'Total Events')}</div></div>
              <div style={S.statCard}><div style={{ ...S.statNum, color: '#3B82F6' }}>{stats.upcoming}</div><div style={S.statLabel}>{L('Esta Semana', 'This Week')}</div></div>
              <div style={S.statCard}><div style={{ ...S.statNum, color: '#EF4444' }}>{stats.overdue}</div><div style={S.statLabel}>{L('Vencidos', 'Overdue')}</div></div>
            </div>
            {Object.keys(stats.cats).length > 0 && (
              <div style={S.card}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 10 }}>{L('Por Categoria', 'By Category')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(stats.cats).map(([cat, count]) => (
                    <span key={cat} style={{ padding: '4px 12px', background: 'var(--bg)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{cat}: {count}</span>
                  ))}
                </div>
              </div>
            )}
            <div style={S.card}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 10 }}>{L('Todos los Eventos', 'All Events')}</div>
              {events.length === 0 && <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{L('No hay eventos creados', 'No events created')}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...events].sort((a, b) => a.startDate.localeCompare(b.startDate)).map(ev => (
                  <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: ev.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{ev.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{fmtDate(ev.startDate)} — {fmtDate(ev.endDate)}{ev.category ? ` | ${ev.category}` : ''}</div>
                    </div>
                    <button onClick={() => openEdit(ev)} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><Edit3 size={13} /></button>
                    <button onClick={() => handleDelete(ev.id)} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* EVENT FORM MODAL */}
      {showForm && (
        <>
          <div onClick={() => setShowForm(false)} style={S.overlay} />
          <div style={S.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{editId ? L('Editar Evento', 'Edit Event') : L('Nuevo Evento', 'New Event')}</span>
              <button onClick={() => setShowForm(false)} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={S.label}>{L('Titulo *', 'Title *')}</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder={L('Nombre del evento', 'Event name')} style={S.input} />
              </div>
              <div>
                <label style={S.label}>{L('Descripcion', 'Description')}</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder={L('Detalles...', 'Details...')} style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={S.label}>{L('Fecha inicio *', 'Start date *')}</label>
                  <input type="datetime-local" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} style={{ ...S.input, colorScheme: 'dark' }} />
                </div>
                <div>
                  <label style={S.label}>{L('Fecha fin *', 'End date *')}</label>
                  <input type="datetime-local" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} style={{ ...S.input, colorScheme: 'dark' }} />
                </div>
              </div>
              <div>
                <label style={S.label}>{L('Categoria', 'Category')}</label>
                <input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} placeholder={L('ej: Marketing, Producto, Sprint', 'e.g. Marketing, Product, Sprint')} style={S.input} />
              </div>
              <div>
                <label style={S.label}>{L('Color', 'Color')}</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: form.color === c ? '3px solid var(--text)' : '2px solid transparent', cursor: 'pointer', transition: 'all .15s' }} />
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                {editId && <button onClick={() => { handleDelete(editId); setShowForm(false) }} style={{ padding: '8px 18px', background: 'transparent', border: '1px solid #EF4444', borderRadius: 7, cursor: 'pointer', color: '#EF4444', fontSize: 13, marginRight: 'auto' }}>{L('Eliminar', 'Delete')}</button>}
                <button onClick={() => setShowForm(false)} style={{ padding: '8px 18px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>{L('Cancelar', 'Cancel')}</button>
                <button onClick={handleSave} style={{ padding: '8px 18px', background: 'var(--orange)', color: '#000', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}><Save size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />{editId ? L('Guardar', 'Save') : L('Crear', 'Create')}</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
