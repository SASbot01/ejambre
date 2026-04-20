import { useState, useEffect, useMemo } from 'react'
import { useErp } from './ErpApp'
import { supabase } from '../../utils/supabase'

// ── PARAMETRIC ENGINE (Panel Furniture Calculator) ──
const RULES = {
  panel_thickness: 18,
  back_thickness: 8,
  system_32: 32,
  front_row_offset: 37,
  gap_side_wall: 2,
  gap_ceiling: 3,
  shelf_sag_warning: 800,
  shelf_sag_critical: 1000,
  door_gap: 3,
  drawer_gap: 3,
  shelf_recess: 40,
}

function calculatePanels(params, customRules = {}) {
  const R = { ...RULES, ...customRules }
  const { width, height, depth, doors = 0, drawers = 0, shelves = 0, material = 'pb_18', dividers = 0 } = params
  const T = R.panel_thickness
  const BT = R.back_thickness
  const panels = []
  const hardware = []
  const warnings = []

  // Sides
  panels.push({ name: 'Lateral izquierdo', L: height, W: depth, T, edge: 'L,F', qty: 1 })
  panels.push({ name: 'Lateral derecho', L: height, W: depth, T, edge: 'L,F', qty: 1 })

  // Top & Bottom
  panels.push({ name: 'Superior', L: width - 2 * T, W: depth, T, edge: 'F', qty: 1 })
  panels.push({ name: 'Inferior', L: width - 2 * T, W: depth, T, edge: 'F', qty: 1 })

  // Back
  panels.push({ name: 'Trasera', L: height - 2 * T, W: width - 2 * T, T: BT, edge: '', qty: 1 })

  // Dividers
  if (dividers > 0) {
    for (let i = 0; i < dividers; i++) {
      panels.push({ name: `Divisor ${i + 1}`, L: height - 2 * T, W: depth - R.shelf_recess, T, edge: 'F', qty: 1 })
    }
  }

  // Shelves
  const compartments = dividers + 1
  const shelfWidth = (width - 2 * T - dividers * T) / compartments
  for (let i = 0; i < shelves; i++) {
    panels.push({ name: `Estante ${i + 1}`, L: shelfWidth, W: depth - R.shelf_recess, T, edge: 'F', qty: compartments })
    hardware.push({ type: 'shelf_pin', qty: 4 * compartments })

    if (shelfWidth > R.shelf_sag_critical) {
      warnings.push({ level: 'error', message: `Estante ${i + 1}: ${shelfWidth}mm > ${R.shelf_sag_critical}mm. Requiere soporte central o usar 25mm.` })
    } else if (shelfWidth > R.shelf_sag_warning) {
      warnings.push({ level: 'warning', message: `Estante ${i + 1}: ${shelfWidth}mm > ${R.shelf_sag_warning}mm. Recomendado soporte o 25mm.` })
    }
  }

  // Doors
  if (doors > 0) {
    const doorWidth = Math.round((width - (doors - 1) * R.door_gap) / doors)
    const doorHeight = height - R.door_gap
    for (let i = 0; i < doors; i++) {
      panels.push({ name: `Puerta ${i + 1}`, L: doorHeight, W: doorWidth, T, edge: 'ALL', qty: 1 })
    }
    if (doorWidth > 600) {
      warnings.push({ level: 'error', message: `Puerta de ${doorWidth}mm > 600mm. Considerar dividir en más puertas.` })
    }
    // Hinges
    const hingesPerDoor = doorHeight <= 800 ? 2 : doorHeight <= 1400 ? 3 : 4
    hardware.push({ type: 'hinge_110', qty: hingesPerDoor * doors })
  }

  // Drawers
  if (drawers > 0) {
    const drawerHeight = Math.round((height - (drawers + 1) * R.drawer_gap) / drawers)
    const drawerWidth = width - 2 * T - R.drawer_gap
    for (let i = 0; i < drawers; i++) {
      panels.push({ name: `Frente cajón ${i + 1}`, L: drawerHeight, W: drawerWidth, T, edge: 'ALL', qty: 1 })
      panels.push({ name: `Fondo cajón ${i + 1}`, L: drawerWidth - 2 * T, W: depth - 60, T: BT, edge: '', qty: 1 })
      panels.push({ name: `Lateral cajón ${i + 1}`, L: depth - 60, W: drawerHeight - 30, T: 16, edge: '', qty: 2 })
      panels.push({ name: `Trasera cajón ${i + 1}`, L: drawerWidth - 2 * T, W: drawerHeight - 30, T: 16, edge: '', qty: 1 })
    }
    hardware.push({ type: 'drawer_slide', qty: drawers })
  }

  // Confirmats
  hardware.push({ type: 'confirmat', qty: 8 + dividers * 4 + shelves * 0 })

  // Calculate total area and cost
  const totalArea = panels.reduce((s, p) => s + (p.L * p.W * (p.qty || 1)) / 1000000, 0)

  return { panels, hardware, warnings, totalArea: Math.round(totalArea * 100) / 100 }
}

// ── DATA ──
async function getOrders(companyId) {
  const { data } = await supabase.from('erp_production_orders').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
  return data || []
}
async function addOrder(order) {
  const { data, error } = await supabase.from('erp_production_orders').insert(order).select().single()
  if (error) throw error
  return data
}
async function updateOrder(id, updates) {
  await supabase.from('erp_production_orders').update(updates).eq('id', id)
}
async function deleteOrder(id) {
  await supabase.from('erp_production_orders').delete().eq('id', id)
}

const STATUS = { draft: { label: 'Borrador', bg: 'rgba(255,255,255,0.08)', color: '#999' }, planned: { label: 'Planificado', bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' }, in_progress: { label: 'En producción', bg: 'rgba(251,191,36,0.15)', color: '#fbbf24' }, done: { label: 'Completado', bg: 'rgba(34,197,94,0.15)', color: '#22c55e' }, cancelled: { label: 'Cancelado', bg: 'rgba(239,68,68,0.15)', color: '#ef4444' } }

export default function ErpProduction() {
  const { companyId } = useErp()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)

  const [form, setForm] = useState({ name: '', width: 600, height: 720, depth: 560, doors: 2, drawers: 0, shelves: 1, dividers: 0, material: 'pb_18', notes: '' })

  const load = () => { getOrders(companyId).then(o => { setOrders(o); setLoading(false) }) }
  useEffect(() => { if (companyId) load() }, [companyId])

  const preview = useMemo(() => calculatePanels(form), [form.width, form.height, form.depth, form.doors, form.drawers, form.shelves, form.dividers])

  const handleGenerate = async () => {
    const result = calculatePanels(form)
    const number = `OP-${new Date().getFullYear()}-${String(orders.length + 1).padStart(4, '0')}`
    await addOrder({
      company_id: companyId, number, name: form.name || `Módulo ${form.width}x${form.height}x${form.depth}`,
      status: 'draft', params: JSON.stringify(form),
      bom: JSON.stringify(result.panels), hardware: JSON.stringify(result.hardware),
      warnings: JSON.stringify(result.warnings), notes: form.notes,
    })
    setShowForm(false)
    setForm({ name: '', width: 600, height: 720, depth: 560, doors: 2, drawers: 0, shelves: 1, dividers: 0, material: 'pb_18', notes: '' })
    load()
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Cargando...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ color: 'var(--text)', fontSize: 20, margin: 0 }}>Producción</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn-action">+ Nueva Orden</button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--orange)', marginBottom: 12 }}>Motor Paramétrico — Configurador de Mueble</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Nombre / Descripción</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ej: Armario cocina base, Vestidor 2m..." style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} />
            </div>
            {[
              { label: 'Ancho (mm)', key: 'width' }, { label: 'Alto (mm)', key: 'height' },
              { label: 'Fondo (mm)', key: 'depth' }, { label: 'Puertas', key: 'doors' },
              { label: 'Cajones', key: 'drawers' }, { label: 'Estantes', key: 'shelves' },
              { label: 'Divisores', key: 'dividers' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{f.label}</label>
                <input type="number" value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: Number(e.target.value) }))} min="0"
                  style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, textAlign: 'center' }} />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Material</label>
              <select value={form.material} onChange={e => setForm(p => ({ ...p, material: e.target.value }))} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }}>
                <option value="pb_18">Aglomerado 18mm</option>
                <option value="pb_25">Aglomerado 25mm</option>
                <option value="mdf_18">MDF 18mm</option>
                <option value="melamine_18">Melamina 18mm</option>
              </select>
            </div>
          </div>

          {/* Live Preview */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Panels */}
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>📋 Lista de Paneles ({preview.panels.length})</div>
              <table style={{ width: '100%', fontSize: 12 }}>
                <thead><tr style={{ color: 'var(--text-secondary)' }}><th style={{ textAlign: 'left', padding: '4px 0' }}>Panel</th><th style={{ textAlign: 'right' }}>L</th><th style={{ textAlign: 'right' }}>W</th><th style={{ textAlign: 'right' }}>T</th><th style={{ textAlign: 'center' }}>Cant.</th><th style={{ textAlign: 'left' }}>Canto</th></tr></thead>
                <tbody>
                  {preview.panels.map((p, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '4px 0', color: 'var(--text)' }}>{p.name}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{p.L}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{p.W}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{p.T}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{p.qty || 1}</td>
                      <td style={{ color: 'var(--orange)', fontSize: 11 }}>{p.edge || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>Área total: {preview.totalArea} m²</div>
            </div>

            {/* Hardware + Warnings */}
            <div>
              <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>🔩 Herrajes</div>
                {preview.hardware.map((h, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ color: 'var(--text)' }}>{h.type.replace(/_/g, ' ')}</span>
                    <span style={{ fontWeight: 600, color: 'var(--orange)' }}>×{h.qty}</span>
                  </div>
                ))}
              </div>

              {preview.warnings.length > 0 && (
                <div style={{ background: 'rgba(251,191,36,0.08)', borderRadius: 10, padding: 16, border: '1px solid rgba(251,191,36,0.2)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', marginBottom: 8 }}>⚠️ Avisos</div>
                  {preview.warnings.map((w, i) => (
                    <div key={i} style={{ fontSize: 12, color: w.level === 'error' ? '#ef4444' : '#fbbf24', padding: '4px 0', display: 'flex', gap: 6 }}>
                      <span>{w.level === 'error' ? '🔴' : '🟡'}</span>
                      <span>{w.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
            <button onClick={handleGenerate} className="btn-action" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>⚡ Generar Orden de Producción</button>
          </div>
        </div>
      )}

      {/* Order detail */}
      {selectedOrder && (() => {
        const o = selectedOrder
        const bom = typeof o.bom === 'string' ? JSON.parse(o.bom || '[]') : (o.bom || [])
        const hw = typeof o.hardware === 'string' ? JSON.parse(o.hardware || '[]') : (o.hardware || [])
        const warns = typeof o.warnings === 'string' ? JSON.parse(o.warnings || '[]') : (o.warnings || [])
        const params = typeof o.params === 'string' ? JSON.parse(o.params || '{}') : (o.params || {})
        return (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div><span style={{ fontWeight: 700, color: 'var(--orange)', fontSize: 14 }}>{o.number}</span> — <span style={{ color: 'var(--text)', fontWeight: 600 }}>{o.name}</span></div>
              <button onClick={() => setSelectedOrder(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              {params.width}×{params.height}×{params.depth}mm · {params.doors || 0} puertas · {params.drawers || 0} cajones · {params.shelves || 0} estantes
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Paneles ({bom.length})</div>
                {bom.map((p, i) => <div key={i} style={{ fontSize: 12, padding: '4px 0', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}><span>{p.name}</span><span style={{ color: 'var(--text-secondary)' }}>{p.L}×{p.W}×{p.T} ×{p.qty || 1}</span></div>)}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Herrajes</div>
                {hw.map((h, i) => <div key={i} style={{ fontSize: 12, padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}><span>{h.type}</span><span style={{ color: 'var(--orange)', fontWeight: 600 }}>×{h.qty}</span></div>)}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Orders list */}
      {orders.length === 0 && !showForm ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 48, marginBottom: 8 }}>🏭</p>
          <p>No hay órdenes de producción. Usa el motor paramétrico para generar la primera.</p>
        </div>
      ) : (
        <div className="table-wrapper"><table className="data-table"><thead><tr><th>Nº</th><th>Nombre</th><th>Dimensiones</th><th>Paneles</th><th>Estado</th><th></th></tr></thead><tbody>
          {orders.map(o => {
            const params = typeof o.params === 'string' ? JSON.parse(o.params || '{}') : (o.params || {})
            const bom = typeof o.bom === 'string' ? JSON.parse(o.bom || '[]') : (o.bom || [])
            const st = STATUS[o.status] || STATUS.draft
            return (
              <tr key={o.id} onClick={() => setSelectedOrder(o)} style={{ cursor: 'pointer' }}>
                <td className="cell-bold">{o.number}</td>
                <td>{o.name}</td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{params.width}×{params.height}×{params.depth}mm</td>
                <td>{bom.length} paneles</td>
                <td><select value={o.status} onChange={e => { e.stopPropagation(); updateOrder(o.id, { status: e.target.value }); load() }}
                  style={{ padding: '4px 8px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600, background: st.bg, color: st.color, cursor: 'pointer' }}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></td>
                <td><button onClick={e => { e.stopPropagation(); if (confirm('¿Eliminar?')) { deleteOrder(o.id); load() } }} style={{ border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', borderRadius: 4, padding: '4px 6px', fontSize: 11 }}>🗑</button></td>
              </tr>
            )
          })}</tbody></table></div>
      )}
    </div>
  )
}
