import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClientData } from '../hooks/useClientData'
import { useAsync } from '../hooks/useAsync'
import { hasRole } from '../utils/roles'

export default function NewReport() {
  const { addReport, getTeam } = useClientData()
  const navigate = useNavigate()
  const [team, teamLoading] = useAsync(getTeam, [])
  const [role, setRole] = useState('setter')
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    name: '',
    // Setter fields
    conversationsOpened: '',
    followUps: '',
    offersLaunched: '',
    appointmentsBooked: '',
    // Closer fields
    scheduledCalls: '',
    callsMade: '',
    deposits: '',
    closes: '',
    // Cold Caller fields
    deals: '',
    pickUps: '',
    offers: '',
    scheduleCalls: '',
  })

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const membersForRole = team.filter(m => hasRole(m.role, role) && m.active)

  const handleRoleChange = (newRole) => {
    setRole(newRole)
    setForm(prev => ({ ...prev, name: '' }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name) return

    const report = { date: form.date, role, name: form.name }

    if (role === 'setter') {
      report.conversationsOpened = +form.conversationsOpened || 0
      report.followUps = +form.followUps || 0
      report.offersLaunched = +form.offersLaunched || 0
      report.appointmentsBooked = +form.appointmentsBooked || 0
    } else if (role === 'closer') {
      report.scheduledCalls = +form.scheduledCalls || 0
      report.callsMade = +form.callsMade || 0
      report.offersLaunched = +form.offersLaunched || 0
      report.deposits = +form.deposits || 0
      report.closes = +form.closes || 0
    } else {
      report.deals = +form.deals || 0
      report.pickUps = +form.pickUps || 0
      report.offers = +form.offers || 0
      report.scheduleCalls = +form.scheduleCalls || 0
    }

    await addReport(report)
    setSaved(true)
    setTimeout(() => navigate('/reportes'), 1200)
  }

  if (saved) {
    return (
      <div className="form-page">
        <div className="form-success-msg">
          <div className="form-success-icon">✅</div>
          <h2>Reporte enviado</h2>
          <p>Redirigiendo al dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="form-page">
      <form onSubmit={handleSubmit} className="form-card">
        <h2 className="form-title">End of Day Report</h2>

        <div className="form-grid form-grid--3">
          <div className="form-group">
            <label>Fecha</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Rol</label>
            <div className="role-toggle">
              <button type="button" className={`role-btn ${role === 'setter' ? 'role-btn--active' : ''}`} onClick={() => handleRoleChange('setter')}>Setter</button>
              <button type="button" className={`role-btn ${role === 'closer' ? 'role-btn--active' : ''}`} onClick={() => handleRoleChange('closer')}>Closer</button>
              <button type="button" className={`role-btn ${role === 'cold_caller' ? 'role-btn--active' : ''}`} onClick={() => handleRoleChange('cold_caller')}>Cold Call</button>
            </div>
          </div>
          <div className="form-group">
            <label>Nombre *</label>
            {teamLoading ? (
              <select disabled><option>Cargando...</option></select>
            ) : (
              <select value={form.name} onChange={e => set('name', e.target.value)} required>
                <option value="">Seleccionar {role === 'setter' ? 'setter' : role === 'closer' ? 'closer' : 'cold caller'}</option>
                {membersForRole.map(m => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="form-divider" />

        {role === 'setter' ? (
          <>
            <h3 className="form-section-title">Métricas del Setter</h3>
            <div className="form-grid form-grid--3">
              <div className="form-group">
                <label>Conversaciones abiertas</label>
                <input type="number" value={form.conversationsOpened} onChange={e => set('conversationsOpened', e.target.value)} placeholder="0" />
              </div>
              <div className="form-group">
                <label>Follow ups</label>
                <input type="number" value={form.followUps} onChange={e => set('followUps', e.target.value)} placeholder="0" />
              </div>
              <div className="form-group">
                <label>Ofertas lanzadas</label>
                <input type="number" value={form.offersLaunched} onChange={e => set('offersLaunched', e.target.value)} placeholder="0" />
              </div>
              <div className="form-group">
                <label>Agendas conseguidas</label>
                <input type="number" value={form.appointmentsBooked} onChange={e => set('appointmentsBooked', e.target.value)} placeholder="0" />
              </div>
            </div>
          </>
        ) : role === 'closer' ? (
          <>
            <h3 className="form-section-title">Métricas del Closer</h3>
            <div className="form-grid form-grid--3">
              <div className="form-group">
                <label>Llamadas agendadas</label>
                <input type="number" value={form.scheduledCalls} onChange={e => set('scheduledCalls', e.target.value)} placeholder="0" />
              </div>
              <div className="form-group">
                <label>Llamadas realizadas</label>
                <input type="number" value={form.callsMade} onChange={e => set('callsMade', e.target.value)} placeholder="0" />
              </div>
              <div className="form-group">
                <label>Ofertas lanzadas</label>
                <input type="number" value={form.offersLaunched} onChange={e => set('offersLaunched', e.target.value)} placeholder="0" />
              </div>
              <div className="form-group">
                <label>Depósitos</label>
                <input type="number" value={form.deposits} onChange={e => set('deposits', e.target.value)} placeholder="0" />
              </div>
              <div className="form-group">
                <label>Cierres</label>
                <input type="number" value={form.closes} onChange={e => set('closes', e.target.value)} placeholder="0" />
              </div>
            </div>
          </>
        ) : (
          <>
            <h3 className="form-section-title">Métricas del Cold Call</h3>
            <div className="form-grid form-grid--3">
              <div className="form-group">
                <label>Deals</label>
                <input type="number" value={form.deals} onChange={e => set('deals', e.target.value)} placeholder="0" />
              </div>
              <div className="form-group">
                <label>Pick ups</label>
                <input type="number" value={form.pickUps} onChange={e => set('pickUps', e.target.value)} placeholder="0" />
              </div>
              <div className="form-group">
                <label>Offers</label>
                <input type="number" value={form.offers} onChange={e => set('offers', e.target.value)} placeholder="0" />
              </div>
              <div className="form-group">
                <label>Schedule Calls</label>
                <input type="number" value={form.scheduleCalls} onChange={e => set('scheduleCalls', e.target.value)} placeholder="0" />
              </div>
            </div>
          </>
        )}

        <div className="form-actions">
          <button type="button" className="btn-action btn-action--secondary" onClick={() => navigate(-1)}>Cancelar</button>
          <button type="submit" className="btn-action">Enviar reporte</button>
        </div>
      </form>
    </div>
  )
}
