import { useState, useEffect } from 'react'
import { useErp } from './ErpApp'
import { getErpEmployees, addErpEmployee, updateErpEmployee, deleteErpEmployee } from '../../utils/erp-data'

const fmt = (v) => Number(v || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })

export default function ErpHR() {
  const { companyId } = useErp()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', position: '', department: '', hire_date: '', salary: '', contract_type: 'indefinido', active: true })

  const load = () => { getErpEmployees(companyId).then(e => { setEmployees(e); setLoading(false) }) }
  useEffect(() => { if (companyId) load() }, [companyId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (editId) { await updateErpEmployee(editId, form) } else { await addErpEmployee({ ...form, company_id: companyId }) }
    setShowForm(false); setEditId(null)
    setForm({ name: '', email: '', phone: '', position: '', department: '', hire_date: '', salary: '', contract_type: 'indefinido', active: true })
    load()
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Cargando...</div>

  const totalSalary = employees.filter(e => e.active).reduce((s, e) => s + Number(e.salary || 0), 0)
  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: 'var(--text)', fontSize: 20, margin: 0 }}>Recursos Humanos</h2>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{employees.filter(e => e.active).length} empleados activos · Nóminas: {fmt(totalSalary)}/mes · {departments.length} departamentos</div>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ name: '', email: '', phone: '', position: '', department: '', hire_date: '', salary: '', contract_type: 'indefinido', active: true }) }} className="btn-action">+ Nuevo Empleado</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {[{ label: 'Nombre *', key: 'name', required: true }, { label: 'Email', key: 'email', type: 'email' }, { label: 'Teléfono', key: 'phone' }, { label: 'Puesto', key: 'position' }, { label: 'Departamento', key: 'department' }, { label: 'Fecha alta', key: 'hire_date', type: 'date' }, { label: 'Salario (€/mes)', key: 'salary', type: 'number' }].map(f => (
              <div key={f.key}><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{f.label}</label>
                <input type={f.type || 'text'} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} required={f.required}
                  style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} /></div>
            ))}
            <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Tipo Contrato</label>
              <select value={form.contract_type} onChange={e => setForm(p => ({ ...p, contract_type: e.target.value }))} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }}>
                <option value="indefinido">Indefinido</option><option value="temporal">Temporal</option><option value="practicas">Prácticas</option><option value="autonomo">Autónomo</option>
              </select></div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
            <button type="submit" className="btn-action">{editId ? 'Guardar' : 'Crear'}</button>
          </div>
        </form>
      )}

      <div className="table-wrapper"><table className="data-table"><thead><tr><th>Empleado</th><th>Puesto</th><th>Departamento</th><th>Contrato</th><th>Alta</th><th>Salario</th><th>Estado</th><th></th></tr></thead><tbody>
        {employees.map(e => (
          <tr key={e.id}>
            <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,107,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 12, fontWeight: 700, color: 'var(--orange)' }}>{(e.name || '?')[0].toUpperCase()}</span></div>
              <div><div className="cell-bold">{e.name}</div><div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{e.email}</div></div>
            </div></td>
            <td>{e.position || '—'}</td>
            <td>{e.department || '—'}</td>
            <td><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>{e.contract_type}</span></td>
            <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{e.hire_date || '—'}</td>
            <td style={{ fontWeight: 600 }}>{fmt(e.salary)}</td>
            <td><span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: e.active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: e.active ? '#22c55e' : '#ef4444' }}>{e.active ? 'Activo' : 'Baja'}</span></td>
            <td style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => { setEditId(e.id); setForm(e); setShowForm(true) }} style={{ padding: '4px 8px', borderRadius: 4, border: 'none', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11 }}>✏️</button>
              <button onClick={async () => { await updateErpEmployee(e.id, { active: !e.active }); load() }} style={{ padding: '4px 8px', borderRadius: 4, border: 'none', background: 'rgba(251,191,36,0.1)', color: '#fbbf24', cursor: 'pointer', fontSize: 11 }}>{e.active ? '⏸' : '▶'}</button>
              <button onClick={() => { if (confirm('¿Eliminar?')) { deleteErpEmployee(e.id); load() } }} style={{ padding: '4px 8px', borderRadius: 4, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', fontSize: 11 }}>🗑</button>
            </td>
          </tr>
        ))}</tbody></table></div>
    </div>
  )
}
