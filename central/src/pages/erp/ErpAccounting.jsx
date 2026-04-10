import { useState, useEffect, useMemo } from 'react'
import { useErp } from './ErpApp'
import { getErpAccounting, addErpAccounting, getErpInvoices } from '../../utils/erp-data'

const fmt = (v) => Number(v || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })

const ACCOUNTS = [
  { code: '100', name: 'Capital social' }, { code: '400', name: 'Proveedores' }, { code: '430', name: 'Clientes' },
  { code: '470', name: 'Hacienda Pública deudora' }, { code: '475', name: 'Hacienda Pública acreedora' },
  { code: '572', name: 'Bancos' }, { code: '600', name: 'Compras' }, { code: '610', name: 'Gastos generales' },
  { code: '621', name: 'Arrendamientos' }, { code: '625', name: 'Seguros' }, { code: '628', name: 'Suministros' },
  { code: '640', name: 'Sueldos y salarios' }, { code: '642', name: 'Seg. Social empresa' },
  { code: '700', name: 'Ventas' }, { code: '705', name: 'Prestación de servicios' },
  { code: '769', name: 'Otros ingresos financieros' },
]

export default function ErpAccounting() {
  const { companyId } = useErp()
  const [entries, setEntries] = useState([])
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), account_code: '', description: '', debit: '', credit: '', reference: '' })
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7))

  const from = `${period}-01`
  const to = `${period}-31`

  const load = () => { Promise.all([getErpAccounting(companyId, from, to), getErpInvoices(companyId)]).then(([e, i]) => { setEntries(e); setInvoices(i); setLoading(false) }) }
  useEffect(() => { if (companyId) load() }, [companyId, period])

  const handleSubmit = async (e) => {
    e.preventDefault()
    await addErpAccounting({ ...form, company_id: companyId, debit: Number(form.debit) || 0, credit: Number(form.credit) || 0 })
    setShowForm(false)
    setForm({ date: new Date().toISOString().slice(0, 10), account_code: '', description: '', debit: '', credit: '', reference: '' })
    load()
  }

  const totalDebit = entries.reduce((s, e) => s + Number(e.debit || 0), 0)
  const totalCredit = entries.reduce((s, e) => s + Number(e.credit || 0), 0)

  // P&L summary
  const yearInvoices = invoices.filter(i => i.date?.startsWith(period.slice(0, 4)))
  const yearRevenue = yearInvoices.filter(i => i.type === 'sale').reduce((s, i) => s + Number(i.total || 0), 0)
  const yearExpenses = yearInvoices.filter(i => i.type === 'purchase').reduce((s, i) => s + Number(i.total || 0), 0)

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Cargando...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ color: 'var(--text)', fontSize: 20, margin: 0 }}>Contabilidad</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="month" value={period} onChange={e => setPeriod(e.target.value)} style={{ padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }} />
          <button onClick={() => setShowForm(!showForm)} className="btn-action">+ Asiento</button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Ingresos (año)</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#22c55e', marginTop: 4 }}>{fmt(yearRevenue)}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Gastos (año)</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#ef4444', marginTop: 4 }}>{fmt(yearExpenses)}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Resultado</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: yearRevenue - yearExpenses >= 0 ? '#22c55e' : '#ef4444', marginTop: 4 }}>{fmt(yearRevenue - yearExpenses)}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Balance (debe - haber)</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>{fmt(totalDebit - totalCredit)}</div>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Fecha</label>
              <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} /></div>
            <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Cuenta</label>
              <select value={form.account_code} onChange={e => setForm(p => ({ ...p, account_code: e.target.value }))} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }}>
                <option value="">Seleccionar...</option>{ACCOUNTS.map(a => <option key={a.code} value={a.code}>{a.code} - {a.name}</option>)}</select></div>
            <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Referencia</label>
              <input value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} placeholder="Factura, nómina..." style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} /></div>
            <div style={{ gridColumn: '1/-1' }}><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Descripción</label>
              <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} /></div>
            <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Debe (€)</label>
              <input type="number" step="0.01" value={form.debit} onChange={e => setForm(p => ({ ...p, debit: e.target.value }))} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} /></div>
            <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Haber (€)</label>
              <input type="number" step="0.01" value={form.credit} onChange={e => setForm(p => ({ ...p, credit: e.target.value }))} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
            <button type="submit" className="btn-action">Crear Asiento</button>
          </div>
        </form>
      )}

      <div className="table-wrapper"><table className="data-table"><thead><tr><th>Fecha</th><th>Cuenta</th><th>Descripción</th><th>Referencia</th><th style={{ textAlign: 'right' }}>Debe</th><th style={{ textAlign: 'right' }}>Haber</th></tr></thead><tbody>
        {entries.map(e => { const acc = ACCOUNTS.find(a => a.code === e.account_code); return (
          <tr key={e.id}><td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{e.date}</td><td className="cell-bold">{e.account_code} {acc ? `- ${acc.name}` : ''}</td><td>{e.description || '—'}</td><td style={{ color: 'var(--text-secondary)' }}>{e.reference || '—'}</td>
            <td style={{ textAlign: 'right', fontWeight: 600, color: e.debit > 0 ? 'var(--text)' : 'var(--text-secondary)' }}>{e.debit > 0 ? fmt(e.debit) : '—'}</td>
            <td style={{ textAlign: 'right', fontWeight: 600, color: e.credit > 0 ? 'var(--text)' : 'var(--text-secondary)' }}>{e.credit > 0 ? fmt(e.credit) : '—'}</td></tr>
        ) })}
        <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}><td colSpan={4} style={{ textAlign: 'right' }}>TOTALES</td>
          <td style={{ textAlign: 'right', color: 'var(--orange)' }}>{fmt(totalDebit)}</td><td style={{ textAlign: 'right', color: 'var(--orange)' }}>{fmt(totalCredit)}</td></tr>
      </tbody></table></div>
    </div>
  )
}
