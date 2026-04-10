import { useState } from 'react'
import { useClientData } from '../hooks/useClientData'
import { useAsync } from '../hooks/useAsync'
import ImportModal from '../components/ImportModal'

export default function ReportsTable() {
  const { getReports, addReports, updateReport, deleteReport } = useClientData()
  const [reports, reportsLoading, refreshReports, setReports] = useAsync(getReports, [])
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})
  const [filter, setFilter] = useState('all') // all, setter, closer
  const [search, setSearch] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState('desc')

  const handleImport = async (rows) => {
    await addReports(rows)
    refreshReports()
  }

  const startEdit = (r) => { setEditingId(r.id); setEditData({ ...r }) }
  const cancelEdit = () => { setEditingId(null); setEditData({}) }

  const saveEdit = async () => {
    await updateReport(editingId, editData)
    refreshReports()
    setEditingId(null)
  }

  const handleDelete = async (id) => {
    if (confirm('¿Eliminar este reporte?')) {
      await deleteReport(id)
      refreshReports()
    }
  }

  const handleSort = (key) => {
    if (sortKey === key) { setSortDir(sortDir === 'asc' ? 'desc' : 'asc') }
    else { setSortKey(key); setSortDir(key === 'date' ? 'desc' : 'asc') }
  }
  const sortArrow = (key) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  const filtered = reports.filter(r => {
    if (filter !== 'all' && r.role !== filter) return false
    if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !r.date.includes(search)) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    let va = a[sortKey] ?? ''
    let vb = b[sortKey] ?? ''
    if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va
    va = String(va).toLowerCase()
    vb = String(vb).toLowerCase()
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const fmtDate = (d) => { const [y, m, day] = String(d).split('-'); return `${day}/${m}/${y}` }

  if (reportsLoading) return <div className="table-page"><div style={{textAlign:'center',padding:60,color:'#999'}}>Cargando reportes...</div></div>

  return (
    <div className="table-page">
      <div className="table-toolbar">
        <input type="text" placeholder="Buscar por nombre o fecha..." value={search} onChange={e => setSearch(e.target.value)} className="table-search" />
        <div className="table-filters">
          <button className={`filter-btn ${filter === 'all' ? 'filter-btn--active' : ''}`} onClick={() => setFilter('all')}>Todos</button>
          <button className={`filter-btn ${filter === 'setter' ? 'filter-btn--active' : ''}`} onClick={() => setFilter('setter')}>Setters</button>
          <button className={`filter-btn ${filter === 'closer' ? 'filter-btn--active' : ''}`} onClick={() => setFilter('closer')}>Closers</button>
        </div>
        <span className="table-count">{filtered.length} reportes</span>
        <button className="btn-import" onClick={() => setShowImport(true)}>Importar CSV/Excel</button>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th className="th-sort" onClick={() => handleSort('date')}>Fecha{sortArrow('date')}</th>
              <th className="th-sort" onClick={() => handleSort('role')}>Rol{sortArrow('role')}</th>
              <th className="th-sort" onClick={() => handleSort('name')}>Nombre{sortArrow('name')}</th>
              {filter !== 'closer' && <>
                <th className="th-sort" onClick={() => handleSort('conversationsOpened')}>Conversaciones{sortArrow('conversationsOpened')}</th>
                <th className="th-sort" onClick={() => handleSort('followUps')}>Follow Ups{sortArrow('followUps')}</th>
                <th className="th-sort" onClick={() => handleSort('offersLaunched')}>Ofertas{sortArrow('offersLaunched')}</th>
                <th className="th-sort" onClick={() => handleSort('appointmentsBooked')}>Agendas{sortArrow('appointmentsBooked')}</th>
              </>}
              {filter !== 'setter' && <>
                <th className="th-sort" onClick={() => handleSort('scheduledCalls')}>Agendadas{sortArrow('scheduledCalls')}</th>
                <th className="th-sort" onClick={() => handleSort('callsMade')}>Realizadas{sortArrow('callsMade')}</th>
                <th className="th-sort" onClick={() => handleSort('offersLaunched')}>Ofertas{sortArrow('offersLaunched')}</th>
                <th className="th-sort" onClick={() => handleSort('deposits')}>Depósitos{sortArrow('deposits')}</th>
                <th className="th-sort" onClick={() => handleSort('closes')}>Cierres{sortArrow('closes')}</th>
              </>}
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => (
              <tr key={r.id} className={editingId === r.id ? 'row-editing' : ''}>
                {editingId === r.id ? (
                  <>
                    <td><input type="date" value={editData.date} onChange={e => setEditData({...editData, date: e.target.value})} /></td>
                    <td><span className={`badge badge--${editData.role}`}>{editData.role}</span></td>
                    <td><input value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} /></td>
                    {/* Setter columns */}
                    {filter !== 'closer' && (
                      editData.role === 'setter' ? (
                        <>
                          <td><input type="number" value={editData.conversationsOpened} onChange={e => setEditData({...editData, conversationsOpened: +e.target.value})} /></td>
                          <td><input type="number" value={editData.followUps} onChange={e => setEditData({...editData, followUps: +e.target.value})} /></td>
                          <td><input type="number" value={editData.offersLaunched} onChange={e => setEditData({...editData, offersLaunched: +e.target.value})} /></td>
                          <td><input type="number" value={editData.appointmentsBooked} onChange={e => setEditData({...editData, appointmentsBooked: +e.target.value})} /></td>
                        </>
                      ) : (
                        <td colSpan={4} className="cell-muted">—</td>
                      )
                    )}
                    {/* Closer columns */}
                    {filter !== 'setter' && (
                      editData.role === 'closer' ? (
                        <>
                          <td><input type="number" value={editData.scheduledCalls} onChange={e => setEditData({...editData, scheduledCalls: +e.target.value})} /></td>
                          <td><input type="number" value={editData.callsMade} onChange={e => setEditData({...editData, callsMade: +e.target.value})} /></td>
                          <td><input type="number" value={editData.offersLaunched} onChange={e => setEditData({...editData, offersLaunched: +e.target.value})} /></td>
                          <td><input type="number" value={editData.deposits} onChange={e => setEditData({...editData, deposits: +e.target.value})} /></td>
                          <td><input type="number" value={editData.closes} onChange={e => setEditData({...editData, closes: +e.target.value})} /></td>
                        </>
                      ) : (
                        <td colSpan={5} className="cell-muted">—</td>
                      )
                    )}
                    <td className="actions-cell">
                      <button className="btn-sm btn-sm--save" onClick={saveEdit}>✓</button>
                      <button className="btn-sm btn-sm--cancel" onClick={cancelEdit}>✕</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{fmtDate(r.date)}</td>
                    <td><span className={`badge badge--${r.role}`}>{r.role === 'setter' ? 'Setter' : 'Closer'}</span></td>
                    <td className="cell-bold">{r.name}</td>
                    {/* Setter columns */}
                    {filter !== 'closer' && (
                      r.role === 'setter' ? (
                        <>
                          <td>{r.conversationsOpened}</td>
                          <td>{r.followUps}</td>
                          <td>{r.offersLaunched}</td>
                          <td>{r.appointmentsBooked}</td>
                        </>
                      ) : (
                        <td colSpan={4} className="cell-muted">—</td>
                      )
                    )}
                    {/* Closer columns */}
                    {filter !== 'setter' && (
                      r.role === 'closer' ? (
                        <>
                          <td>{r.scheduledCalls}</td>
                          <td>{r.callsMade}</td>
                          <td>{r.offersLaunched}</td>
                          <td>{r.deposits}</td>
                          <td>{r.closes}</td>
                        </>
                      ) : (
                        <td colSpan={5} className="cell-muted">—</td>
                      )
                    )}
                    <td className="actions-cell">
                      <button className="btn-sm btn-sm--edit" onClick={() => startEdit(r)}>✎</button>
                      <button className="btn-sm btn-sm--delete" onClick={() => handleDelete(r.id)}>🗑</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showImport && <ImportModal type="reports" onImport={handleImport} onClose={() => setShowImport(false)} />}
    </div>
  )
}
