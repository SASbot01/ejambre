import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClientData } from '../hooks/useClientData'
import { useAsync } from '../hooks/useAsync'

const PAYMENT_TYPES = ['Pago único', '2 cuotas', '3 cuotas', '4 cuotas', '5 cuotas', '6 cuotas']

function getInstallmentOptions(paymentType) {
  if (paymentType === 'Pago único') return ['Pago único']
  const match = paymentType.match(/^(\d+)/)
  if (!match) return ['Pago único']
  const n = parseInt(match[1])
  return Array.from({ length: n }, (_, i) => `${i + 1}/${n}`)
}

export default function NewSale() {
  const { addSale, getPaymentFees, getTeam, getProducts, createInstallmentPlanWithPayments } = useClientData()
  const navigate = useNavigate()
  const [paymentFees, feesLoading] = useAsync(getPaymentFees, [])
  const [team, teamLoading] = useAsync(getTeam, [])
  const [products, productsLoading] = useAsync(getProducts, [])
  const activeProducts = products.filter(p => p.active !== false)
  const closers = team.filter(m => m.role === 'closer' && m.active)
  const setters = team.filter(m => m.role === 'setter' && m.active)

  const INITIAL = {
    date: new Date().toISOString().split('T')[0],
    clientName: '', clientEmail: '', clientPhone: '',
    product: activeProducts.length > 0 ? activeProducts[0].name : '',
    paymentType: 'Pago único',
    installmentNumber: 'Pago único',
    paymentMethod: 'Transferencia',
    revenue: '',
    cashCollected: '',
    closer: '',
    setter: '',
    status: 'Completada',
    notes: '',
    instagram: '',
    triager: '',
    gestorAsignado: '',
    utmSource: '',
    utmMedium: '',
    utmCampaign: '',
    utmContent: '',
    productoInteres: '',
    capitalDisponible: '',
    situacionActual: '',
    pais: '',
    expAmazon: '',
    decisorConfirmado: '',
    fechaLlamada: '',
  }

  const [form, setForm] = useState(INITIAL)
  const [saved, setSaved] = useState(false)

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const installmentOptions = useMemo(() => getInstallmentOptions(form.paymentType), [form.paymentType])

  const handlePaymentTypeChange = (val) => {
    set('paymentType', val)
    if (val === 'Pago único') {
      setForm(prev => ({ ...prev, paymentType: val, installmentNumber: 'Pago único' }))
    } else {
      const opts = getInstallmentOptions(val)
      setForm(prev => ({ ...prev, paymentType: val, installmentNumber: opts[0] }))
    }
  }

  const currentFee = paymentFees.find(f => f.method === form.paymentMethod)
  const feeRate = currentFee ? currentFee.feeRate : 0
  const grossCash = +(form.cashCollected || form.revenue) || 0
  const netCash = Math.round(grossCash * (1 - feeRate) * 100) / 100

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.clientName || !form.revenue || !form.closer) return
    await addSale({
      ...form,
      revenue: +form.revenue,
      cashCollected: +(form.cashCollected || form.revenue),
      source: 'manual',
    })
    // Auto-create installment plan for multi-installment sales (first installment only)
    if (form.paymentType !== 'Pago único' && form.installmentNumber?.startsWith('1/')) {
      const totalMatch = form.paymentType.match(/^(\d+)/)
      if (totalMatch) {
        const totalInst = parseInt(totalMatch[1])
        const totalAmount = +form.revenue
        try {
          await createInstallmentPlanWithPayments({
            clientName: form.clientName,
            clientEmail: form.clientEmail || '',
            clientPhone: form.clientPhone || '',
            product: form.product || '',
            closer: form.closer,
            totalInstallments: totalInst,
            amountPerInstallment: Math.round(totalAmount / totalInst * 100) / 100,
            totalAmount,
            startDate: form.date,
          })
        } catch (err) {
          console.error('Error creating installment plan:', err)
        }
      }
    }
    setSaved(true)
    setTimeout(() => navigate('/ventas'), 1200)
  }

  if (feesLoading || teamLoading || productsLoading) return <div className="form-page"><div style={{textAlign:'center',padding:60,color:'#999'}}>Cargando...</div></div>

  if (saved) {
    return (
      <div className="form-page">
        <div className="form-success-msg">
          <div className="form-success-icon">✅</div>
          <h2>Venta reportada</h2>
          <p>Redirigiendo al dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="form-page">
      <form onSubmit={handleSubmit} className="form-card">
        <h2 className="form-title">Reportar nueva venta</h2>

        <div className="form-grid">
          <div className="form-group">
            <label>Fecha</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Closer *</label>
            <select value={form.closer} onChange={e => set('closer', e.target.value)} required>
              <option value="">Seleccionar...</option>
              {closers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Setter</label>
            <select value={form.setter} onChange={e => set('setter', e.target.value)}>
              <option value="">Sin setter</option>
              {setters.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Estado</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}>
              <option>Completada</option>
              <option>Pendiente</option>
              <option>Reembolso</option>
            </select>
          </div>
        </div>

        <div className="form-divider" />
        <h3 className="form-section-title">Datos del cliente</h3>

        <div className="form-grid form-grid--3">
          <div className="form-group">
            <label>Nombre *</label>
            <input value={form.clientName} onChange={e => set('clientName', e.target.value)} placeholder="Nombre completo" required />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.clientEmail} onChange={e => set('clientEmail', e.target.value)} placeholder="email@ejemplo.com" />
          </div>
          <div className="form-group">
            <label>Teléfono</label>
            <input value={form.clientPhone} onChange={e => set('clientPhone', e.target.value)} placeholder="+34 612 345 678" />
          </div>
        </div>

        <div className="form-grid form-grid--3">
          <div className="form-group">
            <label>Instagram</label>
            <input value={form.instagram} onChange={e => set('instagram', e.target.value)} placeholder="@usuario" />
          </div>
          <div className="form-group">
            <label>País</label>
            <input value={form.pais} onChange={e => set('pais', e.target.value)} placeholder="España" />
          </div>
          <div className="form-group">
            <label>Fecha de Llamada</label>
            <input type="date" value={form.fechaLlamada} onChange={e => set('fechaLlamada', e.target.value)} />
          </div>
        </div>

        <div className="form-divider" />
        <h3 className="form-section-title">Perfil del Lead</h3>

        <div className="form-grid form-grid--3">
          <div className="form-group">
            <label>Situación Actual</label>
            <input value={form.situacionActual} onChange={e => set('situacionActual', e.target.value)} placeholder="Empleado, Emprendedor..." />
          </div>
          <div className="form-group">
            <label>Capital Disponible</label>
            <input value={form.capitalDisponible} onChange={e => set('capitalDisponible', e.target.value)} placeholder="5000-10000€" />
          </div>
          <div className="form-group">
            <label>Exp Amazon</label>
            <input value={form.expAmazon} onChange={e => set('expAmazon', e.target.value)} placeholder="Sin experiencia, 6 meses..." />
          </div>
          <div className="form-group">
            <label>Decisor Confirmado</label>
            <select value={form.decisorConfirmado} onChange={e => set('decisorConfirmado', e.target.value)}>
              <option value="">—</option>
              <option>Sí</option>
              <option>No</option>
            </select>
          </div>
          <div className="form-group">
            <label>Producto Interés</label>
            <input value={form.productoInteres} onChange={e => set('productoInteres', e.target.value)} placeholder="FBA Academy Pro" />
          </div>
        </div>

        <div className="form-divider" />
        <h3 className="form-section-title">UTMs & Atribución</h3>

        <div className="form-grid form-grid--3">
          <div className="form-group">
            <label>UTM Source</label>
            <input value={form.utmSource} onChange={e => set('utmSource', e.target.value)} placeholder="instagram, google..." />
          </div>
          <div className="form-group">
            <label>UTM Medium</label>
            <input value={form.utmMedium} onChange={e => set('utmMedium', e.target.value)} placeholder="paid, organic..." />
          </div>
          <div className="form-group">
            <label>UTM Campaign</label>
            <input value={form.utmCampaign} onChange={e => set('utmCampaign', e.target.value)} placeholder="webinar_feb..." />
          </div>
          <div className="form-group">
            <label>UTM Content</label>
            <input value={form.utmContent} onChange={e => set('utmContent', e.target.value)} placeholder="story_ad..." />
          </div>
          <div className="form-group">
            <label>Triager</label>
            <input value={form.triager} onChange={e => set('triager', e.target.value)} placeholder="Nombre del triager" />
          </div>
          <div className="form-group">
            <label>Gestor Asignado</label>
            <input value={form.gestorAsignado} onChange={e => set('gestorAsignado', e.target.value)} placeholder="Nombre del gestor" />
          </div>
        </div>

        <div className="form-divider" />
        <h3 className="form-section-title">Detalles del pago</h3>

        <div className="form-grid">
          <div className="form-group">
            <label>Producto</label>
            {activeProducts.length > 0 ? (
              <select value={form.product} onChange={e => set('product', e.target.value)}>
                {activeProducts.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            ) : (
              <input value={form.product} onChange={e => set('product', e.target.value)} placeholder="Nombre del producto" />
            )}
          </div>
          <div className="form-group">
            <label>Tipo de pago</label>
            <select value={form.paymentType} onChange={e => handlePaymentTypeChange(e.target.value)}>
              {PAYMENT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Número de cuota</label>
            <select value={form.installmentNumber} onChange={e => set('installmentNumber', e.target.value)}>
              {installmentOptions.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Método de pago</label>
            <select value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}>
              {paymentFees.map(f => (
                <option key={f.id} value={f.method}>{f.method} ({(f.feeRate * 100).toFixed(1)}%)</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label>Revenue total (€) *</label>
            <input type="number" value={form.revenue} onChange={e => set('revenue', e.target.value)} placeholder="2997" required />
            <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Valor total del deal (solo en primera cuota)</small>
          </div>
          <div className="form-group">
            <label>Cash collected (€)</label>
            <input type="number" value={form.cashCollected} onChange={e => set('cashCollected', e.target.value)} placeholder="Igual al revenue si pago único" />
            <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Importe cobrado en este pago</small>
          </div>
        </div>

        {grossCash > 0 && feeRate > 0 && (
          <div className="fee-preview">
            <span>Comisión {form.paymentMethod}: -{(feeRate * 100).toFixed(1)}%</span>
            <span className="fee-preview-net">Cash Neto: €{netCash.toLocaleString('es-ES')}</span>
          </div>
        )}

        <div className="form-divider" />
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Notas</label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Notas sobre el pago..."
            rows={3}
            style={{
              width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              color: 'var(--text)', fontSize: '0.95rem', fontFamily: 'inherit', resize: 'vertical',
            }}
          />
        </div>

        <div className="form-actions">
          <button type="button" className="btn-action btn-action--secondary" onClick={() => navigate(-1)}>Cancelar</button>
          <button type="submit" className="btn-action">Guardar venta</button>
        </div>
      </form>
    </div>
  )
}
