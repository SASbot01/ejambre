import { useState, useMemo } from 'react'
import { useAsync } from '../../hooks/useAsync'
import { useClientData } from '../../hooks/useClientData'

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function getCalendarDays(year, month) {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const days = []
  let startDay = first.getDay() === 0 ? 6 : first.getDay() - 1
  for (let i = startDay - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month, -i), isOther: true })
  }
  for (let d = 1; d <= last.getDate(); d++) {
    days.push({ date: new Date(year, month, d), isOther: false })
  }
  while (days.length % 7 !== 0) {
    days.push({ date: new Date(year, month + 1, days.length - last.getDate() - startDay + 1), isOther: true })
  }
  return days
}

function fmt(date) { return date.toISOString().split('T')[0] }

export default function CeoMeetings() {
  const { getCeoMeetings, addCeoMeeting, deleteCeoMeeting } = useClientData()
  const [meetings, loading, refresh] = useAsync(getCeoMeetings, [])
  const [view, setView] = useState('list')
  const [timeFilter, setTimeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', date: fmt(new Date()), durationMinutes: '', participants: '', summary: '', actionItems: '', sentiment: 'neutral' })

  const today = new Date()
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const calDays = useMemo(() => getCalendarDays(calYear, calMonth), [calYear, calMonth])

  const todayStr = fmt(today)
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay() + 1)
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6)
  const weekStartStr = fmt(weekStart), weekEndStr = fmt(weekEnd)

  const meetingsToday = meetings.filter(m => m.date === todayStr).length
  const meetingsWeek = meetings.filter(m => m.date >= weekStartStr && m.date <= weekEndStr).length
  const totalHours = meetings.reduce((s, m) => s + (m.durationMinutes || 0), 0) / 60
  const uniqueParticipants = new Set(meetings.flatMap(m => (m.participants || '').split(',').map(p => p.trim()).filter(Boolean))).size

  const monthStartStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const nextM = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  const monthEndStr = `${nextM.getFullYear()}-${String(nextM.getMonth() + 1).padStart(2, '0')}-01`

  const timeFiltered = meetings.filter(m => {
    if (timeFilter === 'today') return m.date === todayStr
    if (timeFilter === 'week') return m.date >= weekStartStr && m.date <= weekEndStr
    if (timeFilter === 'month') return m.date >= monthStartStr && m.date < monthEndStr
    return true
  })

  const filtered = timeFiltered.filter(m =>
    !search || m.title.toLowerCase().includes(search.toLowerCase()) ||
    (m.participants || '').toLowerCase().includes(search.toLowerCase())
  )

  async function handleAdd(e) {
    e.preventDefault()
    try {
      await addCeoMeeting({ ...form, durationMinutes: Number(form.durationMinutes) || null, status: 'completed', source: 'manual' })
      await refresh()
      setShowForm(false)
      setForm({ title: '', date: fmt(new Date()), durationMinutes: '', participants: '', summary: '', actionItems: '', sentiment: 'neutral' })
    } catch (err) { alert('Error: ' + err.message) }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este meeting?')) return
    await deleteCeoMeeting(id)
    refresh()
    if (selected?.id === id) setSelected(null)
  }

  function prevMonth() { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }
  function nextMonth() { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }

  return (
    <div className="form-page">
      <h2 style={{ margin: '0 0 24px', color: '#fff' }}>🎙️ Meetings</h2>

      <div className="stats-grid stats-grid--4" style={{ marginBottom: 24 }}>
        <div className="stat-card"><div className="stat-card-icon">📅</div><div className="stat-card-value">{loading ? '...' : meetingsToday}</div><div className="stat-card-label">Hoy</div></div>
        <div className="stat-card"><div className="stat-card-icon">📆</div><div className="stat-card-value">{loading ? '...' : meetingsWeek}</div><div className="stat-card-label">Esta Semana</div></div>
        <div className="stat-card"><div className="stat-card-icon">⏱️</div><div className="stat-card-value">{loading ? '...' : totalHours.toFixed(1)}h</div><div className="stat-card-label">Horas Total</div></div>
        <div className="stat-card"><div className="stat-card-icon">👤</div><div className="stat-card-value">{loading ? '...' : uniqueParticipants}</div><div className="stat-card-label">Participantes</div></div>
      </div>

      <div className="ceo-phase-banner">
        <span className="ceo-phase-banner__icon">🔥</span>
        <div className="ceo-phase-banner__text"><strong>Integración Fireflies</strong> — Los meetings se importarán automáticamente. Próximamente Fase 2.</div>
      </div>

      <div style={{ marginTop: 16, marginBottom: 4 }}>
        <div className="ceo-view-toggle">
          {[['all','Todos'],['today','Hoy'],['week','Esta Semana'],['month','Este Mes']].map(([key, label]) => (
            <button key={key} className={`ceo-view-btn ${timeFilter === key ? 'ceo-view-btn--active' : ''}`} onClick={() => setTimeFilter(key)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="ceo-section-header" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="ceo-view-toggle">
            <button className={`ceo-view-btn ${view === 'list' ? 'ceo-view-btn--active' : ''}`} onClick={() => setView('list')}>Lista</button>
            <button className={`ceo-view-btn ${view === 'calendar' ? 'ceo-view-btn--active' : ''}`} onClick={() => setView('calendar')}>Calendario</button>
          </div>
          <input className="ceo-search-input" placeholder="Buscar meetings..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn-action" onClick={() => setShowForm(!showForm)}>+ Agregar Meeting</button>
      </div>

      {showForm && (
        <form className="form-card" style={{ marginBottom: 20 }} onSubmit={handleAdd}>
          <div className="form-grid form-grid--3">
            <div className="form-group"><label>Título *</label><input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="form-group"><label>Fecha</label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div className="form-group"><label>Duración (min)</label><input type="number" value={form.durationMinutes} onChange={e => setForm(f => ({ ...f, durationMinutes: e.target.value }))} /></div>
            <div className="form-group"><label>Participantes</label><input value={form.participants} onChange={e => setForm(f => ({ ...f, participants: e.target.value }))} /></div>
            <div className="form-group"><label>Sentiment</label>
              <select value={form.sentiment} onChange={e => setForm(f => ({ ...f, sentiment: e.target.value }))}>
                <option value="positive">Positivo</option><option value="neutral">Neutral</option><option value="negative">Negativo</option><option value="mixed">Mixto</option>
              </select>
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 12 }}><label>Resumen</label><textarea rows={2} value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} /></div>
          <div className="form-group"><label>Action Items</label><textarea rows={2} value={form.actionItems} onChange={e => setForm(f => ({ ...f, actionItems: e.target.value }))} /></div>
          <div className="form-actions">
            <button type="submit" className="btn-action">Guardar</button>
            <button type="button" className="btn-action btn-action--secondary" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </form>
      )}

      {view === 'list' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Título</th><th>Fecha</th><th>Duración</th><th>Participantes</th><th>Sentiment</th><th>Acciones</th></tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#666' }}>No hay meetings todavía</td></tr>}
              {filtered.map(m => (
                <tr key={m.id} onClick={() => setSelected(m)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600, color: '#fff' }}>{m.title}</td>
                  <td>{m.date}</td>
                  <td>{m.durationMinutes ? `${m.durationMinutes} min` : '—'}</td>
                  <td>{m.participants || '—'}</td>
                  <td>{m.sentiment && <span className={`badge badge--${m.sentiment}`}>{m.sentiment}</span>}</td>
                  <td><button className="btn-action btn-action--secondary" style={{ fontSize: '0.72rem', padding: '3px 8px' }} onClick={e => { e.stopPropagation(); handleDelete(m.id) }}>🗑</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'calendar' && (
        <div className="form-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <button className="btn-action btn-action--secondary" onClick={prevMonth}>← Anterior</button>
            <span style={{ color: '#fff', fontWeight: 600 }}>{new Date(calYear, calMonth).toLocaleDateString('es', { month: 'long', year: 'numeric' })}</span>
            <button className="btn-action btn-action--secondary" onClick={nextMonth}>Siguiente →</button>
          </div>
          <div className="ceo-calendar">
            {DAYS.map(d => <div key={d} className="ceo-calendar-header">{d}</div>)}
            {calDays.map((day, i) => {
              const dayStr = fmt(day.date)
              const dayMeetings = timeFiltered.filter(m => m.date === dayStr)
              return (
                <div key={i} className={`ceo-calendar-day ${day.isOther ? 'ceo-calendar-day--other' : ''} ${dayStr === todayStr ? 'ceo-calendar-day--today' : ''}`}>
                  <div className="ceo-calendar-day__number">{day.date.getDate()}</div>
                  {dayMeetings.map(m => <div key={m.id} className="ceo-calendar-event" onClick={() => setSelected(m)} title={m.title}>{m.title}</div>)}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {selected && (
        <div className="ceo-meeting-detail">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h4>{selected.title}</h4>
            <button className="btn-action btn-action--secondary" style={{ fontSize: '0.72rem', padding: '3px 8px' }} onClick={() => setSelected(null)}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12, fontSize: '0.8rem', color: '#888' }}>
            <span>📅 {selected.date}</span>
            {selected.durationMinutes && <span>⏱ {selected.durationMinutes} min</span>}
            {selected.sentiment && <span className={`badge badge--${selected.sentiment}`}>{selected.sentiment}</span>}
          </div>
          {selected.participants && <section><h5>Participantes</h5><p>{selected.participants}</p></section>}
          {selected.summary && <section><h5>Resumen</h5><p>{selected.summary}</p></section>}
          {selected.actionItems && <section><h5>Action Items</h5><p style={{ whiteSpace: 'pre-wrap' }}>{selected.actionItems}</p></section>}
          {selected.keyTopics && <section><h5>Key Topics</h5><p>{selected.keyTopics}</p></section>}
        </div>
      )}
    </div>
  )
}
