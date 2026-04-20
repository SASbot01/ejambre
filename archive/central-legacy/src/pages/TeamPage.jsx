import { useState } from 'react'
import { useClientData } from '../hooks/useClientData'
import { useAsync } from '../hooks/useAsync'
import { hasRole, getRoles } from '../utils/roles'

const ROLES = ['director', 'manager', 'closer', 'setter', 'cold_caller']
const ROLE_LABELS = { director: 'Director', manager: 'Manager', closer: 'Closer', setter: 'Setter', cold_caller: 'Cold Caller' }

const emptyForm = { name: '', email: '', password: '', roles: ['closer'], active: true, commissionRate: 0.10, closerCommissionRate: '', setterCommissionRate: '', commissionStartDate: '', mgmtCommissionStartDate: '', isGestor: false, gestorCommissionRate: '', gestorStartDate: '', gestorCapacity: 8 }

export default function TeamPage() {
  const { getTeam, addMember, updateMember, deleteMember } = useClientData()
  const [team, teamLoading, refreshTeam, setTeam] = useAsync(getTeam, [])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ ...emptyForm })

  const grouped = ROLES.reduce((acc, role) => {
    acc[role] = team.filter(m => hasRole(m.role, role))
    return acc
  }, {})

  // Track shown IDs to avoid duplicate cards
  const shownIds = new Set()

  const toggleRole = (role) => {
    setForm(prev => {
      const has = prev.roles.includes(role)
      const next = has ? prev.roles.filter(r => r !== role) : [...prev.roles, role]
      if (next.length === 0 && !prev.isGestor) return prev
      return { ...prev, roles: next }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const { roles, ...rest } = form
    const payload = { ...rest, role: roles.join(',') }
    // Clean empty/null fields — delete them so they don't get sent to DB
    // (avoids errors if columns don't exist yet)
    if (!payload.closerCommissionRate && payload.closerCommissionRate !== 0) delete payload.closerCommissionRate
    if (!payload.setterCommissionRate && payload.setterCommissionRate !== 0) delete payload.setterCommissionRate
    if (!payload.commissionStartDate) delete payload.commissionStartDate
    if (!payload.mgmtCommissionStartDate) delete payload.mgmtCommissionStartDate
    if (!payload.isGestor) {
      delete payload.gestorCommissionRate
      delete payload.gestorStartDate
      delete payload.gestorCapacity
    } else {
      if (!payload.gestorCommissionRate && payload.gestorCommissionRate !== 0) delete payload.gestorCommissionRate
      if (!payload.gestorStartDate) delete payload.gestorStartDate
    }
    if (editingId) {
      if (!payload.password) delete payload.password
    }
    try {
      if (editingId) {
        await updateMember(editingId, payload)
      } else {
        await addMember(payload)
      }
      refreshTeam()
      setForm({ ...emptyForm })
      setEditingId(null)
      setShowForm(false)
    } catch (err) {
      console.error('Error guardando miembro:', err)
      alert('Error al guardar. Revisa la consola.')
    }
  }

  const startEdit = (m) => {
    setForm({ name: m.name, email: m.email, password: '', roles: getRoles(m.role), active: m.active, commissionRate: m.commissionRate, closerCommissionRate: m.closerCommissionRate || '', setterCommissionRate: m.setterCommissionRate || '', commissionStartDate: m.commissionStartDate || '', mgmtCommissionStartDate: m.mgmtCommissionStartDate || '', isGestor: !!m.isGestor, gestorCommissionRate: m.gestorCommissionRate || '', gestorStartDate: m.gestorStartDate || '', gestorCapacity: m.gestorCapacity || 8 })
    setEditingId(m.id)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (confirm('¿Eliminar este miembro?')) {
      await deleteMember(id)
      refreshTeam()
    }
  }

  const cancel = () => {
    setShowForm(false)
    setEditingId(null)
    setForm({ ...emptyForm })
  }

  if (teamLoading) return <div className="dashboard"><div style={{textAlign:'center',padding:60,color:'#999'}}>Cargando equipo...</div></div>

  return (
    <div className="dashboard">
      <div className="dashboard-actions" style={{ marginBottom: 24 }}>
        <button className="btn-action" onClick={() => { cancel(); setShowForm(true) }}>+ Añadir Miembro</button>
      </div>

      {showForm && (
        <div className="form-card" style={{ marginBottom: 28 }}>
          <h3 className="form-title">{editingId ? 'Editar Miembro' : 'Nuevo Miembro'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid form-grid--3">
              <div className="form-group">
                <label>Nombre</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder={editingId ? 'Dejar vacío para no cambiar' : 'Contraseña'} required={!editingId} />
              </div>
              <div className="form-group">
                <label>Roles</label>
                <div className="role-checkboxes">
                  {ROLES.map(r => (
                    <label key={r} className="role-checkbox-label">
                      <input type="checkbox" checked={form.roles.includes(r)} onChange={() => toggleRole(r)} />
                      <span className={`role-checkbox-tag badge badge--${r}`}>{ROLE_LABELS[r]}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Comisión Base (Manager/Director)</label>
                <input type="number" step="0.001" min="0" max="1" value={form.commissionRate} onChange={e => setForm({...form, commissionRate: +e.target.value})} placeholder="Ej: 0.01" />
              </div>
              {form.roles.includes('closer') && (
                <div className="form-group">
                  <label>Comisión Closer</label>
                  <input type="number" step="0.001" min="0" max="1" value={form.closerCommissionRate} onChange={e => setForm({...form, closerCommissionRate: e.target.value === '' ? '' : +e.target.value})} placeholder="Ej: 0.07" />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>Comisión sobre sus ventas cerradas</span>
                </div>
              )}
              {form.roles.includes('setter') && (
                <div className="form-group">
                  <label>Comisión Setter</label>
                  <input type="number" step="0.001" min="0" max="1" value={form.setterCommissionRate} onChange={e => setForm({...form, setterCommissionRate: e.target.value === '' ? '' : +e.target.value})} placeholder="Ej: 0.03" />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>Comisión sobre ventas donde fue setter</span>
                </div>
              )}
              {(form.roles.includes('closer') || form.roles.includes('setter')) && (
                <div className="form-group">
                  <label>Comisiona Desde (Closer/Setter)</label>
                  <input type="date" value={form.commissionStartDate} onChange={e => setForm({...form, commissionStartDate: e.target.value})} style={{ colorScheme: 'dark' }} />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>Fecha inicio comision como closer/setter</span>
                </div>
              )}
              {(form.roles.includes('manager') || form.roles.includes('director')) && (
                <div className="form-group">
                  <label>Comisiona Desde (Manager/Director)</label>
                  <input type="date" value={form.mgmtCommissionStartDate} onChange={e => setForm({...form, mgmtCommissionStartDate: e.target.value})} style={{ colorScheme: 'dark' }} />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>Fecha inicio comision como manager/director</span>
                </div>
              )}
              <div className="form-group">
                <label>Estado</label>
                <select value={form.active ? 'true' : 'false'} onChange={e => setForm({...form, active: e.target.value === 'true'})}>
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </div>
            </div>

            {/* Gestor de Tienda */}
            <div className="form-gestor-section">
              <label className="gestor-toggle-label">
                <input type="checkbox" checked={form.isGestor} onChange={e => setForm({...form, isGestor: e.target.checked})} />
                <span className="gestor-toggle-text">Gestor de Tienda</span>
                <span className="gestor-toggle-hint">Puede gestionar tiendas en Gestión de Clientes</span>
              </label>
              {form.isGestor && (
                <div className="form-grid form-grid--3" style={{ marginTop: 12 }}>
                  <div className="form-group">
                    <label>Comisión Gestor</label>
                    <input type="number" step="0.001" min="0" max="1" value={form.gestorCommissionRate} onChange={e => setForm({...form, gestorCommissionRate: e.target.value === '' ? '' : +e.target.value})} placeholder="Ej: 0.05" />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>Comisión sobre tiendas gestionadas</span>
                  </div>
                  <div className="form-group">
                    <label>Fecha Inicio Gestor</label>
                    <input type="date" value={form.gestorStartDate} onChange={e => setForm({...form, gestorStartDate: e.target.value})} style={{ colorScheme: 'dark' }} />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>Desde cuándo es gestor de tiendas</span>
                  </div>
                  <div className="form-group">
                    <label>Capacidad Máx. Tiendas</label>
                    <input type="number" min="1" max="50" value={form.gestorCapacity} onChange={e => setForm({...form, gestorCapacity: +e.target.value})} />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>Máximo de tiendas simultáneas</span>
                  </div>
                </div>
              )}
            </div>
            <div className="form-actions">
              <button type="button" className="btn-action btn-action--secondary" onClick={cancel}>Cancelar</button>
              <button type="submit" className="btn-action">{editingId ? 'Guardar' : 'Añadir'}</button>
            </div>
          </form>
        </div>
      )}

      {ROLES.map(role => (
        grouped[role].length > 0 && (
          <div key={role}>
            <div className="section-label-dash">{ROLE_LABELS[role]}s</div>
            <div className="team-grid">
              {grouped[role].map(m => {
                const alreadyShown = shownIds.has(m.id)
                shownIds.add(m.id)
                return (
                  <div key={m.id} className={`team-card${alreadyShown ? ' team-card--secondary' : ''}`}>
                    <div className="team-card-header">
                      <div className="team-avatar">{m.name.charAt(0)}</div>
                      <div className="team-card-info">
                        <div className="team-card-name">{m.name}</div>
                        <div className="team-card-email">{m.email}</div>
                      </div>
                    </div>
                    <div className="team-card-details">
                      {getRoles(m.role).filter(r => r).map(r => (
                        <span key={r} className={`badge badge--${r}`}>{ROLE_LABELS[r]}</span>
                      ))}
                      <span className={`badge ${m.active ? 'badge--completada' : 'badge--reembolso'}`}>{m.active ? 'Activo' : 'Inactivo'}</span>
                      {m.isGestor && <span className="badge badge--gestor">Gestor de Tienda</span>}
                      <span className="team-card-rate">{parseFloat((m.commissionRate * 100).toFixed(1))}% base{m.closerCommissionRate ? ` · ${parseFloat((m.closerCommissionRate * 100).toFixed(1))}% closer` : ''}{m.setterCommissionRate ? ` · ${parseFloat((m.setterCommissionRate * 100).toFixed(1))}% setter` : ''}{m.isGestor && m.gestorCommissionRate ? ` · ${parseFloat((m.gestorCommissionRate * 100).toFixed(1))}% gestor` : ''}</span>
                      {m.commissionStartDate && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Closer/Setter desde {m.commissionStartDate}</span>}
                      {m.mgmtCommissionStartDate && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Mgmt desde {m.mgmtCommissionStartDate}</span>}
                      {m.isGestor && m.gestorStartDate && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Gestor desde {m.gestorStartDate} · Capacidad: {m.gestorCapacity || 8}</span>}
                    </div>
                    {!alreadyShown && (
                      <div className="team-card-actions">
                        <button className="btn-sm btn-sm--edit" onClick={() => startEdit(m)}>✎</button>
                        <button className="btn-sm btn-sm--delete" onClick={() => handleDelete(m.id)}>🗑</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      ))}

      {/* Gestor-only members (no commercial role) */}
      {(() => {
        const gestorOnly = team.filter(m => m.isGestor && !shownIds.has(m.id))
        if (gestorOnly.length === 0) return null
        return (
          <div>
            <div className="section-label-dash">Gestores de Tienda</div>
            <div className="team-grid">
              {gestorOnly.map(m => {
                shownIds.add(m.id)
                return (
                  <div key={m.id} className="team-card">
                    <div className="team-card-header">
                      <div className="team-avatar">{m.name.charAt(0)}</div>
                      <div className="team-card-info">
                        <div className="team-card-name">{m.name}</div>
                        <div className="team-card-email">{m.email}</div>
                      </div>
                    </div>
                    <div className="team-card-details">
                      <span className="badge badge--gestor">Gestor de Tienda</span>
                      <span className={`badge ${m.active ? 'badge--completada' : 'badge--reembolso'}`}>{m.active ? 'Activo' : 'Inactivo'}</span>
                      {m.gestorCommissionRate > 0 && <span className="team-card-rate">{parseFloat((m.gestorCommissionRate * 100).toFixed(1))}% gestor</span>}
                      {m.gestorStartDate && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Gestor desde {m.gestorStartDate} · Capacidad: {m.gestorCapacity || 8}</span>}
                    </div>
                    <div className="team-card-actions">
                      <button className="btn-sm btn-sm--edit" onClick={() => startEdit(m)}>✎</button>
                      <button className="btn-sm btn-sm--delete" onClick={() => handleDelete(m.id)}>🗑</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
