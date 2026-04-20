import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const API = import.meta.env.VITE_API_URL || ''
const TYPE_COLORS = { admin: '#FF6B00', growth: '#3B82F6', manufactura: '#22C55E' }

function fmt(n) { return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) }

export default function Nodos() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({}) // id → boolean
  const [selected, setSelected] = useState(null) // node with history
  const [pulses, setPulses] = useState([])
  const pulseId = useRef(0)

  useEffect(() => {
    fetch(`${API}/api/admin?action=nodos`).then(r => { if (!r.ok) throw new Error(r.status); return r.json() }).then(d => { if (d && d.clients) setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  // Animate data flow pulses
  useEffect(() => {
    if (!data) return
    const interval = setInterval(() => {
      const flows = data.flows || []
      if (flows.length === 0) return
      const flow = flows[Math.floor(Math.random() * flows.length)]
      setPulses(prev => [...prev.slice(-6), { id: ++pulseId.current, from: flow.from, to: flow.to, t: 0 }])
    }, 2500)
    return () => clearInterval(interval)
  }, [data])

  useEffect(() => {
    if (pulses.length === 0) return
    const raf = requestAnimationFrame(() => {
      setPulses(prev => prev.map(p => ({ ...p, t: p.t + 0.025 })).filter(p => p.t <= 1))
    })
    return () => cancelAnimationFrame(raf)
  }, [pulses])

  if (loading) return <div style={{ color: '#444', textAlign: 'center', padding: 40, fontSize: '0.8rem' }}>Cargando nodos...</div>
  if (!data) return null

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  const card = { background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16 }

  // ─── Build the graph layout ───
  const W = 920, H = 580, cx = W / 2, cy = 180

  const nodes = []
  const edges = []

  // Central hub
  nodes.push({ id: 'bw', x: cx, y: 60, label: 'BLACKWOLF', color: '#FF6B00', r: 24, type: 'central' })

  // Category hubs
  const cats = [
    { id: 'hub-admin', label: 'Admin', color: TYPE_COLORS.admin, x: cx, y: cy - 20, clients: data.clients.filter(c => c.category === 'admin') },
    { id: 'hub-growth', label: 'Growth', color: TYPE_COLORS.growth, x: cx - 280, y: cy + 60, clients: data.clients.filter(c => c.category === 'growth') },
    { id: 'hub-mfg', label: 'Manufactura', color: TYPE_COLORS.manufactura, x: cx + 280, y: cy + 60, clients: data.clients.filter(c => c.category === 'manufactura') },
  ]

  // Enjambre hub
  nodes.push({ id: 'enjambre', x: cx, y: H - 100, label: 'ENJAMBRE', color: '#FFB800', r: 20, type: 'enjambre' })
  edges.push({ from: 'bw', to: 'enjambre' })

  // Agent nodes around enjambre
  const agentR = 120
  data.agents.forEach((a, i) => {
    const angle = (i / data.agents.length) * Math.PI * 2 - Math.PI / 2
    const ax = cx + Math.cos(angle) * agentR
    const ay = (H - 100) + Math.sin(angle) * (agentR * 0.7)
    nodes.push({ id: a.id, x: ax, y: ay, label: a.label, color: a.color, r: 8, type: 'agent', data: a })
    edges.push({ from: 'enjambre', to: a.id })
  })

  // Flow edges between agents
  ;(data.flows || []).forEach(f => {
    if (nodes.find(n => n.id === f.from) && nodes.find(n => n.id === f.to)) {
      edges.push({ from: f.from, to: f.to, flow: true, label: f.label, count: f.count })
    }
  })

  // Category hubs and client nodes
  cats.forEach(cat => {
    nodes.push({ id: cat.id, x: cat.x, y: cat.y, label: cat.label, color: cat.color, r: 16, type: 'hub' })
    edges.push({ from: 'bw', to: cat.id })

    const isExpanded = expanded[cat.id]
    const radius = 80 + cat.clients.length * 18

    cat.clients.forEach((cl, ci) => {
      if (!isExpanded && cat.clients.length > 1) return // collapsed — only show hub
      const angle = (ci / Math.max(cat.clients.length, 1)) * Math.PI * 2 - Math.PI / 2
      const clx = cat.x + Math.cos(angle) * radius
      const cly = cat.y + Math.sin(angle) * radius
      nodes.push({ id: cl.id, x: clx, y: cly, label: cl.label.length > 12 ? cl.label.slice(0, 10) + '..' : cl.label, color: cat.color, r: 10, type: 'client', data: cl })
      edges.push({ from: cat.id, to: cl.id })

      // If client is expanded, show sub-nodes
      if (expanded[cl.id]) {
        const subR = 50
        const subs = [
          { id: `${cl.id}-team`, label: `Equipo (${cl.team.length})`, color: '#3B82F6' },
          { id: `${cl.id}-crm`, label: `CRM (${cl.contacts.length})`, color: '#22C55E' },
          { id: `${cl.id}-sales`, label: `Ventas (${cl.sales?.length || 0})`, color: '#FFB800' },
          { id: `${cl.id}-products`, label: `Productos (${cl.products.length})`, color: '#A855F7' },
        ].filter(s => {
          const count = parseInt(s.label.match(/\((\d+)\)/)?.[1] || '0')
          return count > 0
        })
        subs.forEach((sub, si) => {
          const sa = (si / subs.length) * Math.PI * 2 - Math.PI / 2
          nodes.push({ id: sub.id, x: clx + Math.cos(sa) * subR, y: cly + Math.sin(sa) * subR, label: sub.label, color: sub.color, r: 6, type: 'sub', parentClient: cl })
          edges.push({ from: cl.id, to: sub.id })
        })
      }
    })

    // Connect agents to client hubs (business flow)
    edges.push({ from: 'agent-crm', to: cat.id, flow: true })
  })

  // Show single clients even when collapsed (for categories with 1 client)
  cats.forEach(cat => {
    if (cat.clients.length === 1 && !expanded[cat.id]) {
      const cl = cat.clients[0]
      nodes.push({ id: cl.id, x: cat.x + 60, y: cat.y + 30, label: cl.label.length > 12 ? cl.label.slice(0, 10) + '..' : cl.label, color: cat.color, r: 10, type: 'client', data: cl })
      edges.push({ from: cat.id, to: cl.id })
    }
  })

  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]))

  function handleNodeClick(node) {
    if (node.type === 'hub') {
      toggle(node.id)
    } else if (node.type === 'client') {
      if (expanded[node.id]) {
        setExpanded(prev => ({ ...prev, [node.id]: false }))
        setSelected(null)
      } else {
        toggle(node.id)
        setSelected(node)
      }
    } else if (node.type === 'sub') {
      setSelected(node)
    } else if (node.type === 'agent') {
      setSelected(node)
    } else {
      setSelected(selected?.id === node.id ? null : node)
    }
  }

  // ─── History panel ───
  function renderHistory() {
    if (!selected) return null
    const n = selected
    const cl = n.data || n.parentClient?.data || n.data

    let items = []
    let title = n.label

    if (n.type === 'client' && cl) {
      title = cl.label || cl.name
      // Mix all activities into timeline
      const all = [
        ...(cl.sales || []).map(s => ({ time: s.date, type: 'sale', text: `Venta: ${s.product} — ${fmt(s.revenue)}€ (${s.closer})`, color: '#FFB800' })),
        ...(cl.contacts || []).map(c => ({ time: c.created_at, type: 'contact', text: `Lead: ${c.name} — ${c.company} [${c.status}]`, color: '#22C55E' })),
        ...(cl.activities || []).map(a => ({ time: a.at, type: 'activity', text: `${a.title} — ${a.by}`, color: '#3B82F6' })),
        ...(cl.agentRuns || []).map(r => ({ time: r.at, type: 'agent', text: `Agent ${r.type}: ${r.status}${r.summary ? ` (${r.summary.created || 0} creados)` : ''}`, color: '#EC4899' })),
        ...(cl.reports || []).map(r => ({ time: r.date, type: 'report', text: `Reporte ${r.role}: ${r.name} — ${r.closes || r.agendas || 0} resultados`, color: '#A855F7' })),
      ]
      items = all.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0)).slice(0, 30)
    } else if (n.type === 'agent' && cl) {
      title = cl.label
      items = (data.flows || []).filter(f => f.from === n.id || f.to === n.id).map(f => ({ type: 'flow', text: `${f.label}${f.count ? ` (${f.count})` : ''}`, color: cl.color }))
    } else if (n.id?.includes('-team') && n.parentClient) {
      title = 'Equipo'
      items = (n.parentClient.team || []).map(t => ({ type: 'member', text: `${t.name} — ${t.role} (${t.email})`, color: '#3B82F6' }))
    } else if (n.id?.includes('-crm') && n.parentClient) {
      title = 'CRM Contactos'
      items = (n.parentClient.contacts || []).map(c => ({ type: 'contact', text: `${c.name} — ${c.company} [${c.status}] ${c.country || ''}`, color: '#22C55E', time: c.created_at }))
    } else if (n.id?.includes('-sales') && n.parentClient) {
      title = 'Ventas'
      items = (n.parentClient.sales || []).map(s => ({ type: 'sale', text: `${s.product} — ${fmt(s.revenue)}€ → ${s.closer}`, color: '#FFB800', time: s.date }))
    } else if (n.id?.includes('-products') && n.parentClient) {
      title = 'Productos'
      items = (n.parentClient.products || []).map(p => ({ type: 'product', text: `${p.name} — ${fmt(p.price)}€`, color: '#A855F7' }))
    }

    // Client metrics
    const metrics = cl?.metrics

    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
        style={{ ...card, padding: 16, marginTop: 12, maxHeight: 350, overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.color }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{title}</span>
          <span style={{ fontSize: '0.55rem', color: '#555', textTransform: 'uppercase' }}>{n.type}</span>
          <button onClick={() => setSelected(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '0.65rem' }}>✕ Cerrar</button>
        </div>

        {metrics && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
            {[
              { label: 'Revenue', v: `${fmt(metrics.revenue)}€`, c: '#FFB800' },
              { label: 'Ventas', v: metrics.salesCount, c: '#FF6B00' },
              { label: 'Leads', v: metrics.contactsCount, c: '#22C55E' },
              { label: 'Won', v: metrics.wonDeals, c: '#3B82F6' },
            ].map(m => (
              <div key={m.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: m.c, fontFamily: "'JetBrains Mono', monospace" }}>{m.v}</div>
                <div style={{ fontSize: '0.45rem', color: '#555', textTransform: 'uppercase' }}>{m.label}</div>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {items.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.65rem' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: item.color, marginTop: 4, flexShrink: 0 }} />
                {item.time && <span style={{ color: '#444', minWidth: 55, flexShrink: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem' }}>
                  {new Date(item.time).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                </span>}
                <span style={{ color: '#999' }}>{item.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#444', fontSize: '0.7rem', padding: '10px 0' }}>Sin historial</div>
        )}
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
      style={{ position: 'relative', zIndex: 1, marginBottom: 24 }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: '1rem' }}>🔗</span>
        <div style={{ fontSize: '0.7rem', color: '#FF6B00', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700 }}>Nodos</div>
        <div style={{ fontSize: '0.55rem', color: '#555' }}>Click para expandir/contraer — Click en nodo para ver historial</div>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {[
          { l: 'Clientes', v: data.summary.totalClients, c: '#FF6B00' },
          { l: 'Equipo', v: data.summary.totalTeam, c: '#3B82F6' },
          { l: 'CRM', v: data.summary.totalContacts, c: '#22C55E' },
          { l: 'Ventas', v: data.summary.totalSales, c: '#FFB800' },
          { l: 'Revenue', v: `${fmt(data.summary.totalRevenue || 0)}€`, c: '#EC4899' },
          { l: 'Agentes', v: data.agents.length, c: '#A855F7' },
        ].map(p => (
          <div key={p.l} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, background: `${p.c}10`, border: `1px solid ${p.c}20`, fontSize: '0.55rem' }}>
            <span style={{ color: p.c, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{p.v}</span>
            <span style={{ color: '#666' }}>{p.l}</span>
          </div>
        ))}
      </div>

      {/* Graph */}
      <div style={{ ...card, padding: 8, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.02, backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '20px 20px', pointerEvents: 'none' }} />

        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
          <defs>
            <filter id="glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>

          {/* Edges */}
          {edges.map((e, i) => {
            const from = nodeMap[e.from], to = nodeMap[e.to]
            if (!from || !to) return null
            return <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={e.flow ? 'rgba(255,107,0,0.12)' : 'rgba(255,255,255,0.05)'}
              strokeWidth={e.flow ? 1.5 : 0.8} strokeDasharray={e.flow ? '4 3' : 'none'} />
          })}

          {/* Pulses */}
          {pulses.map(p => {
            const from = nodeMap[p.from], to = nodeMap[p.to]
            if (!from || !to) return null
            const px = from.x + (to.x - from.x) * p.t, py = from.y + (to.y - from.y) * p.t
            return <circle key={p.id} cx={px} cy={py} r={3} fill="#FF6B00" opacity={1 - p.t * 0.8} filter="url(#glow)" />
          })}

          {/* Nodes */}
          {nodes.map(n => {
            const isSelected = selected?.id === n.id
            const isExpandable = n.type === 'hub' || n.type === 'client'
            const isExp = expanded[n.id]
            return (
              <g key={n.id} style={{ cursor: 'pointer' }} onClick={() => handleNodeClick(n)}>
                {(n.type === 'central' || n.type === 'enjambre') && (
                  <circle cx={n.x} cy={n.y} r={n.r + 6} fill="none" stroke={n.color} strokeWidth={1} opacity={0.15}>
                    <animate attributeName="r" values={`${n.r + 4};${n.r + 10};${n.r + 4}`} dur="3s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle cx={n.x} cy={n.y} r={n.r} fill={`${n.color}${isSelected ? '40' : '18'}`}
                  stroke={isSelected ? n.color : `${n.color}60`} strokeWidth={isSelected ? 2 : 1}
                  style={{ transition: 'all 0.3s' }} />
                <circle cx={n.x} cy={n.y} r={Math.max(2, n.r * 0.3)} fill={n.color} opacity={0.9} />
                {/* Expand indicator */}
                {isExpandable && (
                  <text x={n.x + n.r + 4} y={n.y + 3} fill="#555" fontSize={8} fontFamily="Inter">{isExp ? '−' : '+'}</text>
                )}
                <text x={n.x} y={n.y + n.r + 11} textAnchor="middle" fill="#888" fontSize={n.r > 15 ? 9 : 7}
                  fontWeight={n.type === 'central' || n.type === 'hub' || n.type === 'enjambre' ? 700 : 500} fontFamily="Inter, sans-serif">
                  {n.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* History panel */}
      <AnimatePresence>{selected && renderHistory()}</AnimatePresence>
    </motion.div>
  )
}
