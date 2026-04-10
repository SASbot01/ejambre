import { useState, useMemo } from 'react'
import { useClientData } from '../../hooks/useClientData'
import { useAsync } from '../../hooks/useAsync'

function GestorSettingsRow({ member, storeCount, onSaveCalendar }) {
  const capacity = member.gestorCapacity || 8
  const commission = member.gestorCommissionRate ? parseFloat((member.gestorCommissionRate * 100).toFixed(1)) : 0
  const capacityPct = capacity > 0 ? Math.round(storeCount / capacity * 100) : 0
  const heatColor = capacityPct >= 90 ? '#ef4444' : capacityPct >= 70 ? '#f97316' : capacityPct >= 50 ? '#eab308' : '#22c55e'
  const [calendarUrl, setCalendarUrl] = useState(member.calendarUrl || '')
  const [calendarSaving, setCalendarSaving] = useState(false)
  const [calendarSaved, setCalendarSaved] = useState(false)

  const hasChanged = calendarUrl !== (member.calendarUrl || '')

  async function handleSaveCalendar() {
    setCalendarSaving(true)
    try {
      await onSaveCalendar(member.id, calendarUrl)
      setCalendarSaved(true)
      setTimeout(() => setCalendarSaved(false), 2000)
    } catch (err) {
      console.error('Error saving calendar URL:', err)
    } finally {
      setCalendarSaving(false)
    }
  }

  return (
    <tr className="gestor-settings-row">
      <td>
        <div className="gestor-settings-row__name">
          <div className="gestor-settings-row__avatar">{member.name.charAt(0).toUpperCase()}</div>
          <div>
            <strong>{member.name}</strong>
            <span className="gestor-settings-row__email">{member.email}</span>
            {member.gestorStartDate && <span className="gestor-settings-row__email">Desde {member.gestorStartDate}</span>}
          </div>
        </div>
      </td>
      <td>{member.role}</td>
      <td>
        <span className={`gestor-settings-row__status ${member.active !== false ? 'gestor-settings-row__status--active' : 'gestor-settings-row__status--inactive'}`}>
          {member.active !== false ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td>
        <span style={{ color: heatColor, fontWeight: 600 }}>{storeCount}</span>
      </td>
      <td>{commission}%</td>
      <td>
        <span className="gestor-settings-row__capacity-btn" style={{ borderStyle: 'solid', cursor: 'default' }}>
          {capacity} tiendas
        </span>
      </td>
      <td>
        <div className="gestor-settings-row__calendar">
          <input
            type="url"
            value={calendarUrl}
            onChange={e => setCalendarUrl(e.target.value)}
            placeholder="https://calendly.com/..."
            className="gestor-settings-row__calendar-input"
          />
          {hasChanged && (
            <button
              className="gestor-settings-row__calendar-save"
              onClick={handleSaveCalendar}
              disabled={calendarSaving}
            >
              {calendarSaving ? '...' : calendarSaved ? '✓' : 'Guardar'}
            </button>
          )}
          {!hasChanged && calendarSaved && <span className="gestor-settings-row__calendar-ok">✓</span>}
        </div>
      </td>
    </tr>
  )
}

export default function StoresSettings() {
  const { getTeam, getStores, updateMember } = useClientData()
  const [team, teamLoading] = useAsync(getTeam, [])
  const [stores, storesLoading] = useAsync(getStores, [])

  const loading = teamLoading || storesLoading

  // Count stores per gestor
  const storeCountByGestor = useMemo(() => {
    const map = {}
    stores.forEach(s => {
      const key = s.gestorId || s.gestorName
      if (key) map[key] = (map[key] || 0) + 1
    })
    return map
  }, [stores])

  // Only team members marked as gestor de tienda
  const gestors = useMemo(() => {
    return team.filter(m => m.isGestor).sort((a, b) => {
      if (a.active === false && b.active !== false) return 1
      if (a.active !== false && b.active === false) return -1
      return a.name.localeCompare(b.name)
    })
  }, [team])

  const nonGestors = useMemo(() => {
    return team.filter(m => !m.isGestor && m.active !== false).sort((a, b) => a.name.localeCompare(b.name))
  }, [team])

  // Store settings
  const [defaultSteps, setDefaultSteps] = useState(9)
  const [defaultFollowup, setDefaultFollowup] = useState(30)

  return (
    <div className="stores-settings-page">
      {/* General Settings */}
      <section className="stores-settings-section">
        <h3 className="stores-section-title">Configuración General</h3>
        <div className="stores-settings-form">
          <div className="stores-settings-field">
            <label>Pasos de onboarding por defecto</label>
            <input
              type="number"
              min="1"
              max="20"
              value={defaultSteps}
              onChange={e => setDefaultSteps(Number(e.target.value))}
              className="stores-settings-input"
            />
          </div>
          <div className="stores-settings-field">
            <label>Días de seguimiento por defecto</label>
            <input
              type="number"
              min="7"
              max="365"
              value={defaultFollowup}
              onChange={e => setDefaultFollowup(Number(e.target.value))}
              className="stores-settings-input"
            />
          </div>
        </div>
      </section>

      {/* Gestors Config */}
      <section className="stores-settings-section">
        <h3 className="stores-section-title">Gestores de Tiendas</h3>
        <p className="stores-settings-desc">
          Solo aparecen miembros marcados como "Gestor de Tienda" en Management → Equipo.
        </p>
        {loading ? (
          <div className="stores-loading">Cargando equipo...</div>
        ) : gestors.length === 0 ? (
          <div className="stores-empty">
            No hay gestores configurados. Ve a <strong>Management → Equipo</strong> y marca la casilla "Gestor de Tienda" en los miembros que correspondan.
          </div>
        ) : (
          <div className="stores-table-wrap">
            <table className="stores-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Tiendas asignadas</th>
                  <th>Comisión gestor</th>
                  <th>Capacidad máx.</th>
                  <th>Link Calendar</th>
                </tr>
              </thead>
              <tbody>
                {gestors.map(m => (
                  <GestorSettingsRow
                    key={m.id}
                    member={m}
                    storeCount={storeCountByGestor[m.id] || storeCountByGestor[m.name] || 0}
                    onSaveCalendar={(id, url) => updateMember(id, { calendarUrl: url })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {nonGestors.length > 0 && (
          <p className="stores-settings-hint">
            Hay {nonGestors.length} miembros del equipo sin marcar como gestor ({nonGestors.slice(0, 3).map(m => m.name).join(', ')}{nonGestors.length > 3 ? '...' : ''}).
          </p>
        )}
      </section>

      {/* Store Status Legend */}
      <section className="stores-settings-section">
        <h3 className="stores-section-title">Estados de Tiendas</h3>
        <div className="stores-settings-legend">
          <div className="stores-settings-legend__item">
            <span className="stores-settings-legend__dot" style={{ background: '#3b82f6' }} />
            <div>
              <strong>En proceso (onboarding)</strong>
              <p>La tienda está completando los pasos iniciales de configuración.</p>
            </div>
          </div>
          <div className="stores-settings-legend__item">
            <span className="stores-settings-legend__dot" style={{ background: '#22c55e' }} />
            <div>
              <strong>Activa</strong>
              <p>La tienda completó el onboarding y está en período de seguimiento diario.</p>
            </div>
          </div>
          <div className="stores-settings-legend__item">
            <span className="stores-settings-legend__dot" style={{ background: '#ef4444' }} />
            <div>
              <strong>Bloqueada</strong>
              <p>La tienda tiene un paso o problema que requiere acción del equipo.</p>
            </div>
          </div>
          <div className="stores-settings-legend__item">
            <span className="stores-settings-legend__dot" style={{ background: '#a855f7' }} />
            <div>
              <strong>Completada</strong>
              <p>El servicio finalizó. La tienda pasa a historial para seguimiento de upsell.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
