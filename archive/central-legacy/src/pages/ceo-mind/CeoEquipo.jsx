import { useState } from 'react'
import { useAsync } from '../../hooks/useAsync'
import { useClientData } from '../../hooks/useClientData'
import { getRoles } from '../../utils/roles'

const ROLES = ['ceo', 'director', 'manager', 'closer', 'setter']
const ROLE_LABELS = { ceo: 'CEO', director: 'Director', manager: 'Manager', closer: 'Closer', setter: 'Setter' }
const emptyForm = { name: '', email: '', password: '', roles: ['closer'], active: true, commissionRate: 0.10 }

export default function CeoEquipo() {
  const { getTeam, addMember, updateMember, deleteMember, getCeoTeamNotes, saveCeoTeamNote } = useClientData()
  const [team, loadingTeam, refreshTeam] = useAsync(getTeam, [])
  const [notes, loadingNotes, refreshNotes] = useAsync(getCeoTeamNotes, [])
  const [editingNote, setEditingNote] = useState({})
  const [saving, setSaving] = useState({})

  // CRUD form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ ...emptyForm })

  const active = team.filter(m => m.active !== false)
  const inactive = team.filter(m => m.active === false)

  const roleCounts = team.reduce((acc, m) => {
    getRoles(m.role).forEach(r => { acc[r] = (acc[r] || 0) + 1 })
    return acc
  }, {})

  // ---- Team CRUD ----
  const toggleRole = (role) => {
    setForm(prev => {
      const has = prev.roles.includes(role)
      const next = has ? prev.roles.filter(r => r !== role) : [...prev.roles, role]
      return { ...prev, roles: next.length > 0 ? next : prev.roles }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const { roles, ...rest } = form
      const payload = { ...rest, role: roles.join(',') }
      if (editingId) {
        if (!payload.password) delete payload.password
        await updateMember(editingId, payload)
      } else {
        await addMember(payload)
      }
      refreshTeam()
      cancelForm()
    } catch (err) {
      alert('Error: ' + (err.message || 'No se pudo guardar'))
    }
  }

  const startEdit = (m) => {
    setForm({ name: m.name, email: m.email, password: '', roles: getRoles(m.role), active: m.active !== false, commissionRate: m.commissionRate || 0 })
    setEditingId(m.id)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este miembro?')) return
    try {
      await deleteMember(id)
      refreshTeam()
    } catch (err) {
      alert('Error: ' + (err.message || 'No se pudo eliminar'))
    }
  }

  const cancelForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm({ ...emptyForm })
  }

  // ---- Notes ----
  function getNoteForMember(memberId) {
    const found = notes.find(n => n.memberId === memberId || n.member_id === memberId)
    return found ? found.note : ''
  }

  function getEditValue(memberId) {
    if (editingNote[memberId] !== undefined) return editingNote[memberId]
    return getNoteForMember(memberId)
  }

  async function handleSaveNote(memberId) {
    setSaving(prev => ({ ...prev, [memberId]: true }))
    try {
      await saveCeoTeamNote(memberId, editingNote[memberId] || '')
      await refreshNotes()
      setEditingNote(prev => { const n = { ...prev }; delete n[memberId]; return n })
    } catch (e) {
      alert('Error guardando nota: ' + e.message)
    } finally {
      setSaving(prev => ({ ...prev, [memberId]: false }))
    }
  }

  const loading = loadingTeam || loadingNotes

  return (
    <div className="form-page">
      <div className="ceo-section-header">
        <h2 style={{ margin: 0, color: '#fff' }}>👥 Equipo — Vista Ejecutiva</h2>
        <button className="btn-action" onClick={() => { cancelForm(); setShowForm(true) }}>+ Añadir Miembro</button>
      </div>

      <div className="stats-grid stats-grid--5" style={{ margin: '24px 0' }}>
        <div className="stat-card"><div className="stat-card-icon">👥</div><div className="stat-card-value">{loading ? '...' : team.length}</div><div className="stat-card-label">Total</div></div>
        <div className="stat-card"><div className="stat-card-icon">✅</div><div className="stat-card-value">{loading ? '...' : active.length}</div><div className="stat-card-label">Activos</div></div>
        <div className="stat-card"><div className="stat-card-icon">⏸️</div><div className="stat-card-value">{loading ? '...' : inactive.length}</div><div className="stat-card-label">Inactivos</div></div>
        {Object.entries(roleCounts).map(([role, count]) => (
          <div className="stat-card" key={role}>
            <div className="stat-card-value">{count}</div>
            <div className="stat-card-label">{role.charAt(0).toUpperCase() + role.slice(1)}s</div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="form-card" style={{ marginBottom: 28 }}>
          <h3 className="form-title">{editingId ? 'Editar Miembro' : 'Nuevo Miembro'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid form-grid--3">
              <div className="form-group">
                <label>Nombre</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={editingId ? 'Dejar vacío para no cambiar' : 'Contraseña'} required={!editingId} />
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
                <label>Tasa de Comisión (decimal)</label>
                <input type="number" step="0.01" min="0" max="1" value={form.commissionRate} onChange={e => setForm({ ...form, commissionRate: +e.target.value })} />
              </div>
              <div className="form-group">
                <label>Estado</label>
                <select value={form.active ? 'true' : 'false'} onChange={e => setForm({ ...form, active: e.target.value === 'true' })}>
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn-action btn-action--secondary" onClick={cancelForm}>Cancelar</button>
              <button type="submit" className="btn-action">{editingId ? 'Guardar' : 'Añadir'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="ceo-team-grid">
        {team.map(member => (
          <div className="ceo-team-card" key={member.id}>
            <div className="ceo-team-card__header">
              <div>
                <div className="ceo-team-card__name">{member.name}</div>
                <div className="ceo-team-card__email">{member.email}</div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {getRoles(member.role).map(r => (
                  <span key={r} className={`badge badge--${r}`}>{ROLE_LABELS[r] || r}</span>
                ))}
                {member.active === false && <span className="badge badge--reembolso">Inactivo</span>}
              </div>
            </div>
            {member.commissionRate != null && (
              <div className="ceo-team-card__info">Comisión: {(member.commissionRate * 100).toFixed(0)}%</div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button className="btn-sm btn-sm--edit" onClick={() => startEdit(member)}>✎</button>
              <button className="btn-sm btn-sm--delete" onClick={() => handleDelete(member.id)}>🗑</button>
            </div>
            <div className="ceo-note-section">
              <label>Nota privada del CEO</label>
              <textarea
                className="ceo-note-textarea"
                value={getEditValue(member.id)}
                onChange={e => setEditingNote(prev => ({ ...prev, [member.id]: e.target.value }))}
                placeholder="Escribe una nota sobre este miembro..."
              />
              {editingNote[member.id] !== undefined && (
                <div className="ceo-note-actions">
                  <button className="ceo-note-save" onClick={() => handleSaveNote(member.id)} disabled={saving[member.id]}>
                    {saving[member.id] ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
