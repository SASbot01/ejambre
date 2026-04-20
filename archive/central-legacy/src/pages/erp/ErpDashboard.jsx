import { useState, useEffect } from 'react'
import { useErp } from './ErpApp'
import { getErpDashboardStats } from '../../utils/erp-data'

const fmt = (v, currency = 'EUR') => {
  const n = Number(v)
  if (!n && n !== 0) return '€0'
  return n.toLocaleString('es-ES', { style: 'currency', currency, minimumFractionDigits: 0 })
}

function Card({ icon, label, value, sub, color }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, flex: 1, minWidth: 200 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function ErpDashboard() {
  const { companyId, company } = useErp()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!companyId) return
    getErpDashboardStats(companyId).then(s => { setStats(s); setLoading(false) })
  }, [companyId])

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Cargando dashboard...</div>

  const s = stats || {}
  const profit = (s.monthRevenue || 0) - (s.monthExpenses || 0)

  return (
    <div>
      <h2 style={{ color: 'var(--text)', fontSize: 20, marginBottom: 20 }}>Resumen General — {company?.name}</h2>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <Card icon="💰" label="Facturación este mes" value={fmt(s.monthRevenue)} color="var(--orange)" />
        <Card icon="🛒" label="Gastos este mes" value={fmt(s.monthExpenses)} color="#ef4444" />
        <Card icon="📈" label="Beneficio mes" value={fmt(profit)} color={profit >= 0 ? '#22c55e' : '#ef4444'} />
        <Card icon="📄" label="Facturas pendientes" value={s.pendingInvoices || 0} sub={`${fmt(s.pendingAmount)} por cobrar`} />
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <Card icon="📦" label="Productos" value={s.totalProducts || 0} sub={`${s.lowStock || 0} con stock bajo`} />
        <Card icon="🏭" label="Valor del stock" value={fmt(s.stockValue)} />
        <Card icon="👥" label="Clientes" value={s.totalCustomers || 0} />
        <Card icon="🏢" label="Proveedores" value={s.totalSuppliers || 0} />
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Card icon="🧑‍💼" label="Empleados" value={s.totalEmployees || 0} />
        <Card icon="💸" label="Nóminas mensuales" value={fmt(s.monthlySalaries)} />
        <Card icon="📊" label="Facturación anual" value={fmt(s.totalRevenue)} color="var(--orange)" />
        <Card icon="📉" label="Gastos anuales" value={fmt(s.totalExpenses)} />
      </div>
    </div>
  )
}
