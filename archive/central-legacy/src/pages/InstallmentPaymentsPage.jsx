import { useState, useMemo, useEffect } from 'react'
import { useClientData } from '../hooks/useClientData'
import { useClient } from '../contexts/ClientContext'
import { useAsync } from '../hooks/useAsync'

const STATUS_LABELS_ES = { active: 'Activo', completed: 'Completado', defaulted: 'Impago' }
const STATUS_LABELS_EN = { active: 'Active', completed: 'Completed', defaulted: 'Defaulted' }
const STATUS_COLORS = { active: '#3b82f6', completed: '#22c55e', defaulted: '#ef4444' }

function PlanModal({ team, paymentFees, onClose, onSave, en, editPlan }) {
  const closers = team.filter(m => m.role === 'closer' && m.active !== false)
  const isEdit = !!editPlan
  const [mode, setMode] = useState(isEdit ? 'total' : 'total')
  const [form, setForm] = useState(isEdit ? {
    clientName: editPlan.clientName || '', clientEmail: editPlan.clientEmail || '', clientPhone: editPlan.clientPhone || '', product: editPlan.product || '',
    closer: editPlan.closer || '',
    paymentMethod: editPlan.paymentMethod || paymentFees[0]?.method || '',
    totalInstallments: editPlan.totalInstallments || 3, totalAmount: editPlan.totalAmount || '', monthlyAmount: editPlan.amountPerInstallment || '',
    startDate: editPlan.startDate || new Date().toISOString().split('T')[0],
    notes: editPlan.notes || '',
  } : {
    clientName: '', clientEmail: '', clientPhone: '', product: '',
    closer: closers[0]?.name || '',
    paymentMethod: paymentFees[0]?.method || '',
    totalInstallments: 3, totalAmount: '', monthlyAmount: '', startDate: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  const computedMonthly = form.totalAmount && form.totalInstallments
    ? Math.round(parseFloat(form.totalAmount) / form.totalInstallments * 100) / 100
    : 0
  const computedTotal = form.monthlyAmount && form.totalInstallments
    ? Math.round(parseFloat(form.monthlyAmount) * form.totalInstallments * 100) / 100
    : 0

  const finalTotal = mode === 'total' ? parseFloat(form.totalAmount) || 0 : computedTotal
  const finalMonthly = mode === 'total' ? computedMonthly : parseFloat(form.monthlyAmount) || 0

  const currentFee = paymentFees.find(f => f.method === form.paymentMethod)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.clientName || !form.totalInstallments) return
    if (mode === 'total' && !form.totalAmount) return
    if (mode === 'monthly' && !form.monthlyAmount) return
    setSaving(true)
    try {
      await onSave({
        ...form,
        totalAmount: finalTotal,
        totalInstallments: parseInt(form.totalInstallments),
        amountPerInstallment: finalMonthly,
      })
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.9rem' }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3>{isEdit ? (en ? 'Edit Installment Plan' : 'Editar Plan de Pagos') : (en ? 'New Installment Plan' : 'Nuevo Plan de Pagos a Plazos')}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>{en ? 'Client' : 'Cliente'} *</label>
              <input style={inputStyle} value={form.clientName} onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))} required />
            </div>
            <div>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Email</label>
              <input type="email" style={inputStyle} value={form.clientEmail} onChange={e => setForm(p => ({ ...p, clientEmail: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>{en ? 'Phone' : 'Teléfono'}</label>
              <input style={inputStyle} value={form.clientPhone} onChange={e => setForm(p => ({ ...p, clientPhone: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>{en ? 'Product' : 'Producto'}</label>
              <input style={inputStyle} value={form.product} onChange={e => setForm(p => ({ ...p, product: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>{en ? 'Assigned Closer' : 'Closer asignado'}</label>
              <select style={inputStyle} value={form.closer} onChange={e => setForm(p => ({ ...p, closer: e.target.value }))}>
                <option value="">—</option>
                {closers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>{en ? 'Payment Method' : 'Método de Pago'} *</label>
              <select style={inputStyle} value={form.paymentMethod} onChange={e => setForm(p => ({ ...p, paymentMethod: e.target.value }))} required>
                <option value="">—</option>
                {paymentFees.map(f => <option key={f.method} value={f.method}>{f.method} ({((f.feeRate || 0) * 100).toFixed(1)}%)</option>)}
              </select>
              {currentFee && currentFee.feeRate > 0 && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  {en ? `${((currentFee.feeRate || 0) * 100).toFixed(1)}% fee deducted from commissions` : `${((currentFee.feeRate || 0) * 100).toFixed(1)}% comisión descontada`}
                </span>
              )}
            </div>
          </div>

          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <button type="button" onClick={() => setMode('total')} style={{ flex: 1, padding: '8px 12px', fontSize: '0.82rem', fontWeight: 600, border: 'none', cursor: 'pointer', background: mode === 'total' ? 'var(--orange)' : 'var(--bg-card)', color: mode === 'total' ? '#fff' : 'var(--text-secondary)', transition: 'all 0.2s' }}>
              {en ? 'Total Amount' : 'Importe Total'}
            </button>
            <button type="button" onClick={() => setMode('monthly')} style={{ flex: 1, padding: '8px 12px', fontSize: '0.82rem', fontWeight: 600, border: 'none', borderLeft: '1px solid var(--border)', cursor: 'pointer', background: mode === 'monthly' ? 'var(--orange)' : 'var(--bg-card)', color: mode === 'monthly' ? '#fff' : 'var(--text-secondary)', transition: 'all 0.2s' }}>
              {en ? 'Monthly Payment' : 'Por Cuota Mensual'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
            {mode === 'total' ? (
              <>
                <div>
                  <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>{en ? 'Total Amount' : 'Importe total'} *</label>
                  <input type="number" step="0.01" min="0" style={inputStyle} value={form.totalAmount} onChange={e => setForm(p => ({ ...p, totalAmount: e.target.value }))} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>{en ? 'Installments' : 'Num. cuotas'} *</label>
                  <select style={inputStyle} value={form.totalInstallments} onChange={e => setForm(p => ({ ...p, totalInstallments: e.target.value }))}>
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => <option key={n} value={n}>{n} {en ? 'payments' : 'cuotas'}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>{en ? 'Monthly Payment' : 'Cuota mensual'}</label>
                  <div style={{ ...inputStyle, background: 'var(--bg-card)', fontWeight: 600, color: 'var(--orange)' }}>
                    {computedMonthly > 0 ? `${computedMonthly.toFixed(2)}€` : '—'}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>{en ? 'Monthly Payment' : 'Cuota mensual'} *</label>
                  <input type="number" step="0.01" min="0" style={inputStyle} value={form.monthlyAmount} onChange={e => setForm(p => ({ ...p, monthlyAmount: e.target.value }))} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>{en ? 'Installments' : 'Num. cuotas'} *</label>
                  <select style={inputStyle} value={form.totalInstallments} onChange={e => setForm(p => ({ ...p, totalInstallments: e.target.value }))}>
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => <option key={n} value={n}>{n} {en ? 'payments' : 'cuotas'}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>{en ? 'Total Amount' : 'Importe total'}</label>
                  <div style={{ ...inputStyle, background: 'var(--bg-card)', fontWeight: 600, color: 'var(--orange)' }}>
                    {computedTotal > 0 ? `${computedTotal.toFixed(2)}€` : '—'}
                  </div>
                </div>
              </>
            )}
            <div>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>{en ? 'Start Date' : 'Fecha inicio'}</label>
              <input type="date" style={inputStyle} value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>{en ? 'Notes' : 'Notas'}</label>
            <textarea style={{ ...inputStyle, minHeight: 60 }} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>

          <button type="submit" className="btn-action" disabled={saving} style={{ marginTop: 4 }}>
            {saving ? (en ? 'Saving...' : 'Guardando...') : isEdit ? (en ? 'Save Changes' : 'Guardar Cambios') : (en ? 'Create Installment Plan' : 'Crear Plan de Pagos')}
          </button>
        </form>
      </div>
    </div>
  )
}

function PlanCard({ plan, payments, onMarkPaid, onUpdatePlan, onEdit, onDelete, expanded, onToggle, user, en }) {
  const STATUS_LABELS = en ? STATUS_LABELS_EN : STATUS_LABELS_ES
  const paidCount = payments.filter(p => p.paid).length
  const paidAmount = payments.filter(p => p.paid).reduce((s, p) => s + (p.amount || 0), 0)
  const remaining = plan.totalAmount - paidAmount
  const pct = plan.totalInstallments > 0 ? Math.round(paidCount / plan.totalInstallments * 100) : 0
  const barColor = plan.status === 'defaulted' ? '#ef4444' : pct >= 100 ? '#22c55e' : pct >= 50 ? '#3b82f6' : '#f97316'

  return (
    <div className={`installment-card ${expanded ? 'installment-card--expanded' : ''}`}>
      <div className="installment-card__header" onClick={onToggle}>
        <div className="installment-card__avatar">{plan.clientName.charAt(0).toUpperCase()}</div>
        <div className="installment-card__info">
          <h4 className="installment-card__name">{plan.clientName}</h4>
          <span className="installment-card__product">{plan.product || '—'} · {plan.closer || '—'}{plan.paymentMethod ? ` · ${plan.paymentMethod}` : ''}</span>
        </div>
        <div className="installment-card__progress-wrap">
          <div className="installment-card__progress-bar">
            <div className="installment-card__progress-fill" style={{ width: `${pct}%`, background: barColor }} />
          </div>
          <span className="installment-card__progress-text" style={{ color: barColor }}>
            {paidCount}/{plan.totalInstallments} {en ? 'payments' : 'cuotas'}
          </span>
        </div>
        <div className="installment-card__amount">
          <span className="installment-card__amount-value">{plan.totalAmount?.toFixed(0)}€</span>
          <span className="installment-card__amount-label">
            {en ? 'Remaining' : 'Pendiente'}: <strong style={{ color: remaining > 0 ? '#f97316' : '#22c55e' }}>{remaining.toFixed(0)}€</strong>
          </span>
        </div>
        <span className="store-status-badge" style={{ background: `${STATUS_COLORS[plan.status]}20`, color: STATUS_COLORS[plan.status], borderColor: `${STATUS_COLORS[plan.status]}40` }}>
          {STATUS_LABELS[plan.status] || plan.status}
        </span>
        <span className="installment-card__toggle">{expanded ? '▼' : '▶'}</span>
      </div>

      {expanded && (
        <div className="installment-card__body">
          {plan.clientEmail && <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Email: {plan.clientEmail} {plan.clientPhone ? `· Tel: ${plan.clientPhone}` : ''}</p>}
          {plan.startDate && <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 4 }}>{en ? 'Start' : 'Inicio'}: {plan.startDate}</p>}
          {plan.paymentMethod && <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 8 }}>{en ? 'Payment Method' : 'Método de Pago'}: <strong>{plan.paymentMethod}</strong></p>}

          <div className="installment-card__payments">
            {payments.map(p => (
              <div key={p.id} className={`installment-payment ${p.paid ? 'installment-payment--paid' : ''}`}>
                <span className="installment-payment__number">{en ? 'Payment' : 'Cuota'} {p.installmentNumber}</span>
                <span className="installment-payment__amount">{(p.amount || 0).toFixed(2)}€</span>
                {p.paid ? (
                  <span className="installment-payment__status installment-payment__status--paid">
                    {en ? 'Paid' : 'Pagado'} {p.paidDate ? new Date(p.paidDate).toLocaleDateString(en ? 'en-US' : 'es-ES') : ''}
                    {p.markedBy ? ` · ${p.markedBy}` : ''}
                  </span>
                ) : (
                  <button
                    className="installment-payment__btn"
                    onClick={() => onMarkPaid(p.id, user)}
                  >
                    {en ? 'Mark as paid' : 'Marcar como pagado'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {plan.notes && <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 8, fontStyle: 'italic' }}>{plan.notes}</p>}

          <div className="installment-card__actions">
            <button className="installment-action-btn installment-action-btn--edit" onClick={() => onEdit(plan)}>
              {en ? 'Edit' : 'Editar'}
            </button>
            <button className="installment-action-btn installment-action-btn--danger" onClick={() => onDelete(plan.id)} style={{ marginRight: 'auto' }}>
              {en ? 'Delete' : 'Eliminar'}
            </button>
            {plan.status === 'active' && paidCount === plan.totalInstallments && (
              <button className="installment-action-btn installment-action-btn--success" onClick={() => onUpdatePlan(plan.id, { status: 'completed' })}>
                {en ? 'Mark as completed' : 'Marcar como completado'}
              </button>
            )}
            {plan.status === 'active' && (
              <button className="installment-action-btn installment-action-btn--danger" onClick={() => onUpdatePlan(plan.id, { status: 'defaulted' })}>
                {en ? 'Mark as defaulted' : 'Marcar como impago'}
              </button>
            )}
            {plan.status !== 'active' && (
              <button className="installment-action-btn installment-action-btn--ghost" onClick={() => onUpdatePlan(plan.id, { status: 'active' })}>
                {en ? 'Reactivate' : 'Reactivar'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function InstallmentPaymentsPage({ user }) {
  const { clientSlug } = useClient()
  const en = clientSlug === 'black-wolf'
  const STATUS_LABELS = en ? STATUS_LABELS_EN : STATUS_LABELS_ES
  const {
    getInstallmentPlans, createInstallmentPlanWithPayments, updateInstallmentPlan,
    deleteInstallmentPlan, getInstallmentPayments, updateInstallmentPayment, getTeam, getPaymentFees,
  } = useClientData()

  const [plans, plansLoading, refreshPlans] = useAsync(getInstallmentPlans, [])
  const [team] = useAsync(getTeam, [])
  const [paymentFees] = useAsync(getPaymentFees, [])
  const [showModal, setShowModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [paymentsMap, setPaymentsMap] = useState({})
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  // Load payments for expanded plan
  useEffect(() => {
    if (!expandedId || paymentsMap[expandedId]) return
    getInstallmentPayments(expandedId).then(payments => {
      setPaymentsMap(prev => ({ ...prev, [expandedId]: payments }))
    }).catch(console.error)
  }, [expandedId])

  const filteredPlans = useMemo(() => {
    let result = plans
    if (filter !== 'all') result = result.filter(p => p.status === filter)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(p =>
        p.clientName?.toLowerCase().includes(q) ||
        p.product?.toLowerCase().includes(q) ||
        p.closer?.toLowerCase().includes(q)
      )
    }
    return result
  }, [plans, filter, search])

  // Summary stats
  const activePlans = plans.filter(p => p.status === 'active')
  const totalPending = activePlans.reduce((s, p) => {
    const paid = (paymentsMap[p.id] || []).filter(pm => pm.paid).reduce((acc, pm) => acc + (pm.amount || 0), 0)
    return s + (p.totalAmount || 0) - paid
  }, 0)
  const defaultedCount = plans.filter(p => p.status === 'defaulted').length

  async function handleMarkPaid(paymentId, userName) {
    await updateInstallmentPayment(paymentId, {
      paid: true,
      paidDate: new Date().toISOString(),
      markedBy: userName || 'Sistema',
    })
    // Refresh payments for this plan
    if (expandedId) {
      const refreshed = await getInstallmentPayments(expandedId)
      setPaymentsMap(prev => ({ ...prev, [expandedId]: refreshed }))
      // Auto-complete if all paid
      const plan = plans.find(p => p.id === expandedId)
      if (plan && refreshed.every(p => p.paid)) {
        await updateInstallmentPlan(plan.id, { status: 'completed' })
        refreshPlans()
      }
    }
  }

  async function handleUpdatePlan(planId, updates) {
    await updateInstallmentPlan(planId, updates)
    refreshPlans()
  }

  async function handleSave(planData) {
    if (editingPlan) {
      await updateInstallmentPlan(editingPlan.id, planData)
    } else {
      await createInstallmentPlanWithPayments(planData)
    }
    refreshPlans()
  }

  function handleEdit(plan) {
    setEditingPlan(plan)
    setShowModal(true)
  }

  async function handleDelete(planId) {
    if (!confirm(en ? 'Delete this installment plan? This cannot be undone.' : 'Eliminar este plan de pagos? No se puede deshacer.')) return
    await deleteInstallmentPlan(planId)
    setPaymentsMap(prev => { const next = { ...prev }; delete next[planId]; return next })
    if (expandedId === planId) setExpandedId(null)
    refreshPlans()
  }

  const filters = [
    { key: 'all', label: en ? 'All' : 'Todos', count: plans.length },
    { key: 'active', label: en ? 'Active' : 'Activos', count: activePlans.length },
    { key: 'completed', label: en ? 'Completed' : 'Completados', count: plans.filter(p => p.status === 'completed').length },
    { key: 'defaulted', label: en ? 'Defaulted' : 'Impagos', count: defaultedCount },
  ]

  return (
    <div className="installments-page">
      {/* Summary */}
      <div className="installments-summary">
        <div className="installments-summary__stat">
          <span className="installments-summary__value">{plansLoading ? '...' : activePlans.length}</span>
          <span className="installments-summary__label">{en ? 'Active Plans' : 'Planes activos'}</span>
        </div>
        <div className="installments-summary__stat">
          <span className="installments-summary__value" style={{ color: '#f97316' }}>{plansLoading ? '...' : `${totalPending.toFixed(0)}€`}</span>
          <span className="installments-summary__label">{en ? 'Pending Collection' : 'Pendiente cobro'}</span>
        </div>
        <div className="installments-summary__stat">
          <span className="installments-summary__value" style={{ color: defaultedCount > 0 ? '#ef4444' : '#22c55e' }}>{plansLoading ? '...' : defaultedCount}</span>
          <span className="installments-summary__label">{en ? 'Defaulted' : 'Impagos'}</span>
        </div>
        <div className="installments-summary__stat">
          <span className="installments-summary__value">{plansLoading ? '...' : plans.length}</span>
          <span className="installments-summary__label">{en ? 'Total Plans' : 'Total planes'}</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="installments-toolbar">
        <div className="installments-filters">
          {filters.map(f => (
            <button
              key={f.key}
              className={`installments-filter ${filter === f.key ? 'installments-filter--active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
        <div className="installments-toolbar__right">
          <input
            type="text"
            placeholder={en ? 'Search client, product...' : 'Buscar cliente, producto...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="installments-search"
          />
          <button className="btn-action" onClick={() => { setEditingPlan(null); setShowModal(true) }}>+ {en ? 'New Plan' : 'Nuevo Plan'}</button>
        </div>
      </div>

      {/* Plans list */}
      {plansLoading ? (
        <div className="stores-loading">{en ? 'Loading installment plans...' : 'Cargando planes de pago...'}</div>
      ) : filteredPlans.length === 0 ? (
        <div className="stores-empty">
          {plans.length === 0 ? (en ? 'No installment plans. Create one or register a sale with installment payments.' : 'No hay planes de pago. Crea uno o registra una venta con pago a plazos.') : (en ? 'No results for current filter.' : 'Sin resultados para el filtro actual.')}
        </div>
      ) : (
        <div className="installments-list">
          {filteredPlans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              payments={paymentsMap[plan.id] || []}
              expanded={expandedId === plan.id}
              onToggle={() => setExpandedId(expandedId === plan.id ? null : plan.id)}
              onMarkPaid={handleMarkPaid}
              onUpdatePlan={handleUpdatePlan}
              onEdit={handleEdit}
              onDelete={handleDelete}
              user={user}
              en={en}
            />
          ))}
        </div>
      )}

      {showModal && (
        <PlanModal
          team={team}
          paymentFees={paymentFees}
          onClose={() => { setShowModal(false); setEditingPlan(null) }}
          onSave={handleSave}
          en={en}
          editPlan={editingPlan}
        />
      )}
    </div>
  )
}
