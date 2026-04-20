import { useState } from 'react'

const DATE_PRESETS = [
  { label: 'Hoy', key: 'today' },
  { label: 'Ayer', key: 'yesterday' },
  { label: '7 días', key: 'last7' },
  { label: 'Esta semana', key: 'thisWeek' },
  { label: 'Este mes', key: 'thisMonth' },
  { label: 'Este año', key: 'thisYear' },
  { label: 'Todo', key: 'all' },
]

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function formatDate(date) {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`
}

function getMonthOptions() {
  const now = new Date()
  const options = []
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = formatDate(d)
    options.push({ key, label })
  }
  return options
}

const MONTH_OPTIONS = getMonthOptions()

export function getDateRange(preset) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // Month preset: 'month:2026-02'
  if (preset && preset.startsWith('month:')) {
    const ym = preset.slice(6)
    const [y, m] = ym.split('-').map(Number)
    const start = new Date(y, m - 1, 1)
    const end = new Date(y, m, 0) // last day of month
    return { start, end: end > today ? today : end }
  }

  // Custom preset: 'custom:2026-01-15:2026-02-28'
  if (preset && preset.startsWith('custom:')) {
    const parts = preset.split(':')
    return {
      start: new Date(parts[1] + 'T00:00:00'),
      end: new Date(parts[2] + 'T00:00:00'),
    }
  }

  switch (preset) {
    case 'today':
      return { start: today, end: today }
    case 'yesterday': {
      const y = new Date(today)
      y.setDate(y.getDate() - 1)
      return { start: y, end: y }
    }
    case 'last7': {
      const s = new Date(today)
      s.setDate(s.getDate() - 6)
      return { start: s, end: today }
    }
    case 'thisWeek': {
      const day = today.getDay()
      const diff = day === 0 ? 6 : day - 1 // Monday start
      const s = new Date(today)
      s.setDate(s.getDate() - diff)
      return { start: s, end: today }
    }
    case 'thisMonth': {
      const s = new Date(today.getFullYear(), today.getMonth(), 1)
      return { start: s, end: today }
    }
    case 'thisYear': {
      const s = new Date(today.getFullYear(), 0, 1)
      return { start: s, end: today }
    }
    case 'all':
    default:
      return { start: new Date(2020, 0, 1), end: today }
  }
}

export function getPreviousRange(preset) {
  // For month presets, return the full previous month
  if (preset && preset.startsWith('month:')) {
    const ym = preset.slice(6)
    const [y, m] = ym.split('-').map(Number)
    const pm = m === 1 ? 12 : m - 1
    const py = m === 1 ? y - 1 : y
    return { start: new Date(py, pm - 1, 1), end: new Date(py, pm, 0) }
  }

  const { start, end } = getDateRange(preset)
  const duration = end - start
  const prevEnd = new Date(start)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd - duration)
  return { start: prevStart, end: prevEnd }
}

export function dateInRange(dateStr, range) {
  // Extract YYYY-MM-DD only (handles both "2026-02-28" and "2026-02-28T00:00:00+00:00")
  const dateOnly = String(dateStr).slice(0, 10)
  const d = new Date(dateOnly + 'T12:00:00') // noon to avoid timezone edge cases
  const s = new Date(range.start)
  const e = new Date(range.end)
  s.setHours(0, 0, 0, 0)
  e.setHours(23, 59, 59, 999)
  return d >= s && d <= e
}

export default function Filters({ datePreset, onDatePreset, extras }) {
  const isMonth = datePreset?.startsWith('month:')
  const isCustom = datePreset?.startsWith('custom:')

  const monthValue = isMonth ? datePreset.slice(6) : ''

  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const handleChip = (key) => {
    onDatePreset(key)
    setCustomStart('')
    setCustomEnd('')
  }

  const handleMonth = (e) => {
    const v = e.target.value
    if (v) {
      onDatePreset(`month:${v}`)
      setCustomStart('')
      setCustomEnd('')
    }
  }

  const handleStart = (e) => {
    const v = e.target.value
    setCustomStart(v)
    if (v && customEnd) onDatePreset(`custom:${v}:${customEnd}`)
  }

  const handleEnd = (e) => {
    const v = e.target.value
    setCustomEnd(v)
    if (customStart && v) onDatePreset(`custom:${customStart}:${v}`)
  }

  return (
    <div className="filters-bar">
      <div className="filters-left">
        <div className="date-presets">
          {DATE_PRESETS.map(p => (
            <button
              key={p.key}
              className={`filter-chip ${!isMonth && !isCustom && datePreset === p.key ? 'filter-chip--active' : ''}`}
              onClick={() => handleChip(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="date-extra-filters">
          <select
            className={`filter-select ${isMonth ? 'filter-select--active' : ''}`}
            value={monthValue}
            onChange={handleMonth}
          >
            <option value="">Mes</option>
            {MONTH_OPTIONS.map(m => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
          <div className="date-range-inputs">
            <input
              type="date"
              className={`filter-date-input ${isCustom ? 'filter-date-input--active' : ''}`}
              value={isCustom ? datePreset.split(':')[1] : customStart}
              onChange={handleStart}
              title="Desde"
            />
            <span className="date-range-sep">&mdash;</span>
            <input
              type="date"
              className={`filter-date-input ${isCustom ? 'filter-date-input--active' : ''}`}
              value={isCustom ? datePreset.split(':')[2] : customEnd}
              onChange={handleEnd}
              title="Hasta"
            />
          </div>
        </div>
      </div>
      {extras && <div className="filters-right">{extras}</div>}
    </div>
  )
}

export function FilterSelect({ label, value, onChange, options }) {
  return (
    <select
      className="filter-select"
      value={value}
      onChange={e => onChange(e.target.value)}
      title={label}
    >
      <option value="">{label}</option>
      {options.map(o => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  )
}