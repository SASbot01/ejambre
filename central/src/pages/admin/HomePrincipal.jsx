import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { getAdminDashboardData } from '../../utils/data'
import { supabase } from '../../utils/supabase'
// Nodos removed — will be replaced by Obsidian documentation

const API = import.meta.env.VITE_API_URL || ''
const ENJAMBRE_URL = 'https://enjambre.blackwolfsec.io'
const SOC_URL = 'https://soc.blackwolfsec.io'

// ─── Helpers ───
function fmt(n) { return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) }
function fmtK(n) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : fmt(n) }

const CLIENT_COLORS = ['#FF6B00', '#3B82F6', '#22C55E', '#A855F7', '#EC4899', '#F59E0B', '#14B8A6', '#EF4444']

const SCRAPPER_PRESETS = [
  'fabricas textiles', 'textile manufacturers', 'metalworking manufacturing',
  'food processing', 'plastic manufacturing', 'software companies',
]

const EUROPEAN_COUNTRIES = [
  'Espana', 'Portugal', 'Italia', 'Francia', 'Alemania',
  'Reino Unido', 'Paises Bajos', 'Belgica', 'Polonia', 'Turquia',
  'Rumania', 'Republica Checa', 'Austria', 'Suiza', 'Suecia', 'Bulgaria',
]

// ─── Clock ───
function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  return now
}
function getGreeting(h) { return h < 7 ? 'Buenas noches' : h < 13 ? 'Buenos dias' : h < 20 ? 'Buenas tardes' : 'Buenas noches' }


// ─── Styles ───
const S = {
  card: {
    background: 'rgba(255,255,255,0.03)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.06)',
    color: '#E4E4E7',
  },
  cardDark: {
    background: 'rgba(255,255,255,0.03)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.06)',
    color: '#E4E4E7',
  },
  pill: {
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '6px 14px',
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.5)',
    cursor: 'pointer',
  },
  pillActive: {
    background: 'rgba(255,255,255,0.12)',
    color: '#fff',
  },
}

// ═══════════════════════════════════════════════════════
export default function HomePrincipal() {
  const navigate = useNavigate()
  const now = useClock()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [revenueHistory, setRevenueHistory] = useState([])

  // Embedded app (SOC / Enjambre) — fully integrated, no external links
  const [embeddedApp, setEmbeddedApp] = useState(null)

  // Drag & drop
  const [draggingClient, setDraggingClient] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)

  // Scrapper
  const [scrapOpen, setScrapOpen] = useState(false)
  const [scrapQuery, setScrapQuery] = useState('fabricas textiles')
  const [scrapCountries, setScrapCountries] = useState(['Espana', 'Portugal', 'Italia'])
  const [scrapMax, setScrapMax] = useState(10)
  const [scrapRunning, setScrapRunning] = useState(false)
  const [scrapResult, setScrapResult] = useState(null)
  const [scrapTargetClient, setScrapTargetClient] = useState('')
  const [scrapPipelines, setScrapPipelines] = useState([])
  const [scrapTargetPipeline, setScrapTargetPipeline] = useState('')
  const [scrapLoadingPipelines, setScrapLoadingPipelines] = useState(false)

  // IA Central
  const [iaOpen, setIaOpen] = useState(false)
  const [iaFeed, setIaFeed] = useState([])
  const [iaMessages, setIaMessages] = useState([])
  const [iaInput, setIaInput] = useState('')
  const [iaSending, setIaSending] = useState(false)
  const iaEndRef = useRef(null)

  useEffect(() => { loadData(); loadRevenueHistory() }, [])
  useEffect(() => { iaEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [iaMessages, iaFeed])

  async function loadData() {
    try {
      const d = await getAdminDashboardData()
      setData(d || { clients: [] })
    } catch (err) {
      console.error('loadData error:', err)
      setData({ clients: [] })
    }
    setLoading(false)
  }

  async function loadRevenueHistory() {
    try {
      const now = new Date()
      const months = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        months.push({ start: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, label: d.toLocaleString('es-ES', { month: 'short' }).toUpperCase() })
      }
      const nextM = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      const endDate = `${nextM.getFullYear()}-${String(nextM.getMonth() + 1).padStart(2, '0')}-01`
      const [{ data: clients }, { data: sales }] = await Promise.all([
        supabase.from('clients').select('id, name, slug').eq('active', true),
        supabase.from('sales_with_net_cash').select('client_id, date, revenue, cash_collected').gte('date', months[0].start).lt('date', endDate),
      ])
      if (!clients || !sales) return
      const chart = months.map(m => {
        const mDate = new Date(m.start), mEnd = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 1)
        const row = { month: m.label }
        clients.forEach(c => { row[c.slug] = (sales.filter(s => s.client_id === c.id && new Date(s.date) >= mDate && new Date(s.date) < mEnd)).reduce((sum, s) => sum + Number(s.cash_collected || 0), 0) })
        return row
      })
      setRevenueHistory(chart)
    } catch {}
  }

  const pushFeed = useCallback((text, type = 'info') => {
    const entry = { text, type, time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
    setIaFeed(prev => [...prev.slice(-50), entry])
  }, [])


  function openEnjambre() {
    setEmbeddedApp({ url: ENJAMBRE_URL, title: 'Black Wolf — Agents' })
  }

  function openSOC() {
    setEmbeddedApp({ url: SOC_URL, title: 'Black Wolf — SOC' })
  }

  async function loadPipelinesForClient(clientSlug) {
    if (!clientSlug) { setScrapPipelines([]); setScrapTargetPipeline(''); return }
    setScrapLoadingPipelines(true)
    try {
      const resp = await fetch(`${API}/api/agent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list-pipelines', clientSlug }),
      })
      const result = await resp.json()
      const pipes = result.pipelines || []
      setScrapPipelines(pipes)
      const def = pipes.find(p => p.is_default) || pipes[0]
      setScrapTargetPipeline(def?.id || '')
    } catch { setScrapPipelines([]) }
    setScrapLoadingPipelines(false)
  }

  async function runScrapper() {
    if (scrapRunning || !scrapQuery.trim() || !scrapTargetClient) return
    setScrapRunning(true)
    setScrapResult(null)
    const targetName = clients.find(c => c.slug === scrapTargetClient)?.name || scrapTargetClient
    pushFeed(`Scrapper → ${targetName}: "${scrapQuery}" en ${scrapCountries.join(', ')}`, 'info')
    try {
      const config = { query: scrapQuery, countries: scrapCountries, maxPerCountry: scrapMax }
      if (scrapTargetPipeline) config.pipeline_id = scrapTargetPipeline
      const resp = await fetch(`${API}/api/agent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search', clientSlug: scrapTargetClient, config }),
      })
      const result = await resp.json()
      if (resp.ok) {
        setScrapResult(result)
        pushFeed(`Scrapper completado: ${result.created || 0} leads creados en ${targetName}`, 'success')
      } else {
        pushFeed(`Error scrapper: ${result.error || 'Unknown'}`, 'error')
      }
    } catch (err) { pushFeed(`Error: ${err.message}`, 'error') }
    setScrapRunning(false)
  }

  function toggleScrapCountry(c) { setScrapCountries(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]) }

  async function sendIaMessage() {
    if (!iaInput.trim() || iaSending) return
    const userMsg = iaInput.trim()
    setIaInput('')
    setIaMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setIaSending(true)
    pushFeed(`Pregunta: "${userMsg}"`, 'info')
    try {
      const resp = await fetch(`${API}/api/agent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMsg, history: iaMessages.slice(-10).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })), clientSlug: 'global' }),
      })
      const result = await resp.json()
      const answer = result.answer || result.error || 'Sin respuesta'
      setIaMessages(prev => [...prev, { role: 'assistant', text: answer }])
    } catch (err) {
      setIaMessages(prev => [...prev, { role: 'assistant', text: `Error: ${err.message}` }])
    }
    setIaSending(false)
  }

  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false)

  // ─── Derived ───
  const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const greeting = getGreeting(now.getHours())
  const clients = (data && Array.isArray(data.clients)) ? data.clients : []
  const DEMO_SLUGS = ['demo-factory', 'plasticos-europa']
  const realClients = clients.filter(c => !DEMO_SLUGS.includes(c.slug))
  const feedColors = { info: '#3B82F6', success: '#22C55E', warning: '#FFB800', error: '#EF4444' }

  // ─── Client type groups ───
  const bwAdmin = clients.find(c => c.clientType === 'admin' || c.slug === 'black-wolf')
  const growthClients = realClients.filter(c => (c.clientType === 'growth' || (!c.clientType && c.slug !== 'black-wolf')) && c.clientType !== 'consultoria' && c.clientType !== 'manufactura' && c.clientType !== 'admin')
  const consultoriaClients = realClients.filter(c => c.clientType === 'consultoria')
  const mfgClients = realClients.filter(c => c.clientType === 'manufactura')
  const nonAdminClients = realClients.filter(c => c.clientType !== 'admin' && c.slug !== 'black-wolf')

  // ─── Totals ───
  const totalRevenue = nonAdminClients.reduce((sum, c) => sum + (c.monthRevenue || 0), 0)
  const totalCash = nonAdminClients.reduce((sum, c) => sum + (c.monthNetCash || 0), 0)
  const totalSales = nonAdminClients.reduce((sum, c) => sum + (c.monthSales || 0), 0)

  // ─── Breakdown by type ───
  const typeBreakdown = [
    { key: 'growth', label: 'Growth', color: '#3B82F6', clients: growthClients },
    { key: 'consultoria', label: 'Consultoria', color: '#A855F7', clients: consultoriaClients },
    { key: 'manufactura', label: 'Manufactura', color: '#22C55E', clients: mfgClients },
  ].map(t => ({
    ...t,
    revenue: t.clients.reduce((s, c) => s + (c.monthRevenue || 0), 0),
    cash: t.clients.reduce((s, c) => s + (c.monthNetCash || 0), 0),
    sales: t.clients.reduce((s, c) => s + (c.monthSales || 0), 0),
  }))

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#050510', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem', fontFamily: "'SF Pro Display', -apple-system, sans-serif" }}>Cargando...</div>
    </div>
  )

  return (
    <div className="hp-container" style={{ padding: '0 24px 80px', minHeight: '100vh', background: '#050510', position: 'relative', maxWidth: 1200, margin: '0 auto', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 0 32px', position: 'sticky', top: 0, zIndex: 10, background: 'linear-gradient(to bottom, #050510 80%, transparent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src="/assets/logos/blackwolf.png" alt="BW" style={{ width: 32, height: 32, borderRadius: 10, objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 200, color: '#fff', letterSpacing: -1.5, lineHeight: 1 }}>{timeStr}</div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'capitalize', fontWeight: 400, marginTop: 2 }}>{dateStr}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="hp-greeting" style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', fontWeight: 400 }}>{greeting}, Admin</span>
          <button onClick={() => setSettingsOpen(true)} style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', transition: 'all 0.2s' }} title="Ajustes">
            ⚙
          </button>
          <button onClick={() => setIaOpen(true)} style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s' }}>
            AI
          </button>
        </div>
      </div>

      {/* ═══ BLACK WOLF ADMIN GADGET ═══ */}
      {bwAdmin && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          onClick={() => {
            localStorage.setItem(`bw_client_${bwAdmin.slug}_user`, localStorage.getItem('bw_superadmin'))
            localStorage.setItem(`bw_client_${bwAdmin.slug}_usertype`, 'team')
            navigate(`/${bwAdmin.slug}`)
          }}
          style={{ ...S.card, padding: '28px 32px', marginBottom: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 24, border: '1px solid rgba(255,107,0,0.15)', background: 'linear-gradient(135deg, rgba(255,107,0,0.04), rgba(255,255,255,0.02))', transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)' }}
          className="hp-bw-gadget">
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,107,0,0.08)', border: '1px solid rgba(255,107,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {bwAdmin.logoUrl ? <img src={bwAdmin.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#FF6B00' }}>BW</span>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', letterSpacing: -0.3 }}>{bwAdmin.name}</div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', marginTop: 2, textTransform: 'uppercase', letterSpacing: 1.5 }}>Admin Central</div>
          </div>
          <div className="hp-bw-stats" style={{ display: 'flex', gap: 28 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', letterSpacing: -0.5, lineHeight: 1.1 }}>{fmtK(totalRevenue + (bwAdmin.monthRevenue || 0))}€</div>
              <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>Revenue Total</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', letterSpacing: -0.5, lineHeight: 1.1 }}>{fmtK(totalCash + (bwAdmin.monthNetCash || bwAdmin.monthCash || 0))}€</div>
              <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>Cash Total</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', letterSpacing: -0.5, lineHeight: 1.1 }}>{nonAdminClients.length}</div>
              <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>Cuentas</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ═══ KPI CARDS WITH BREAKDOWN ═══ */}
      <div className="hp-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        {/* Revenue */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{ ...S.card, padding: '24px 22px' }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Revenue Total</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff', letterSpacing: -1, lineHeight: 1.1 }}>{fmtK(totalRevenue)}€</div>
          {/* Breakdown bar */}
          <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 14, background: 'rgba(255,255,255,0.04)' }}>
            {typeBreakdown.map(t => t.revenue > 0 && (
              <div key={t.key} style={{ width: `${totalRevenue > 0 ? (t.revenue / totalRevenue * 100) : 0}%`, background: t.color, transition: 'width 0.5s ease' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
            {typeBreakdown.map(t => (
              <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: 2, background: t.color }} />
                <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.4)' }}>{t.label}</span>
                <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{fmtK(t.revenue)}€</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Cash */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          style={{ ...S.card, padding: '24px 22px' }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Cash Collected</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff', letterSpacing: -1, lineHeight: 1.1 }}>{fmtK(totalCash)}€</div>
          <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 14, background: 'rgba(255,255,255,0.04)' }}>
            {typeBreakdown.map(t => t.cash > 0 && (
              <div key={t.key} style={{ width: `${totalCash > 0 ? (t.cash / totalCash * 100) : 0}%`, background: t.color, transition: 'width 0.5s ease' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
            {typeBreakdown.map(t => (
              <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: 2, background: t.color }} />
                <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.4)' }}>{t.label}</span>
                <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{fmtK(t.cash)}€</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Sales */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          style={{ ...S.card, padding: '24px 22px' }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Ventas Totales</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff', letterSpacing: -1, lineHeight: 1.1 }}>{totalSales}</div>
          <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 14, background: 'rgba(255,255,255,0.04)' }}>
            {typeBreakdown.map(t => t.sales > 0 && (
              <div key={t.key} style={{ width: `${totalSales > 0 ? (t.sales / totalSales * 100) : 0}%`, background: t.color, transition: 'width 0.5s ease' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
            {typeBreakdown.map(t => (
              <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: 2, background: t.color }} />
                <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.4)' }}>{t.label}</span>
                <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{t.sales}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ═══ TOOLS ═══ */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: 2.5, marginBottom: 12, paddingLeft: 4 }}>Herramientas</div>
        <div className="hp-tools-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: 'SOC', sub: 'Ciberseguridad', icon: 'S', onClick: openSOC, delay: 0.3, iconStyle: { background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.85rem', fontWeight: 800, letterSpacing: 1 } },
            { label: 'Black Wolf Agents', sub: 'Sistema de agentes IA', icon: '🐺', onClick: openEnjambre, delay: 0.35 },
            { label: 'Task Management', sub: 'Tareas y planning', icon: '✓', onClick: () => { localStorage.setItem('bw_client_black-wolf_user', localStorage.getItem('bw_superadmin')); localStorage.setItem('bw_client_black-wolf_usertype', 'team'); navigate('/black-wolf/task-management') }, delay: 0.4 },
            { label: 'Scrapper Prospector', sub: scrapRunning ? 'Ejecutando...' : 'Buscar leads', icon: '🔍', onClick: () => setScrapOpen(true), delay: 0.45, running: scrapRunning },
          ].map(tool => (
            <motion.button key={tool.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: tool.delay }}
              whileHover={{ scale: 1.02, background: 'rgba(255,255,255,0.06)' }} whileTap={{ scale: 0.97 }}
              onClick={tool.onClick}
              style={{ ...S.card, padding: '18px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)' }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', ...(tool.iconStyle || {}) }}>{tool.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>{tool.label}</div>
                <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)' }}>{tool.sub}</div>
              </div>
              {tool.running && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', animation: 'pulse 1.2s infinite', flexShrink: 0 }} />}
            </motion.button>
          ))}
        </div>
      </div>

      {/* ═══ CLIENT PANELS — Drag & Drop ═══ */}
      {clients && clients.length > 0 && (() => {
        const SECTIONS = [
          { key: 'growth', title: 'Growth', color: '#3B82F6', clients: growthClients, droppable: true },
          { key: 'consultoria', title: 'Consultoria', color: '#A855F7', clients: consultoriaClients, droppable: true },
          { key: 'manufactura', title: 'Manufactura', color: '#22C55E', clients: mfgClients, droppable: true },
        ]

        async function handleDrop(clientId, newType) {
          setDraggingClient(null)
          setDropTarget(null)
          setData(prev => {
            if (!prev || !prev.clients) return prev
            return { ...prev, clients: prev.clients.map(c => c.id === clientId ? { ...c, clientType: newType } : c) }
          })
          try {
            const { error } = await supabase.from('clients').update({ client_type: newType }).eq('id', clientId)
            if (error) throw error
            pushFeed(`Cliente movido a ${newType}`, 'success')
          } catch (err) {
            pushFeed(`Error al mover: ${err.message}`, 'error')
            loadData()
          }
        }

        function renderClientCard(c) {
          const isDragging = draggingClient === c.id
          const accent = c.primaryColor || 'rgba(255,255,255,0.06)'
          return (
            <div key={c.id}
              draggable
              onDragStart={e => { setDraggingClient(c.id); e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move' }}
              onDragEnd={() => { setDraggingClient(null); setDropTarget(null) }}
              onClick={() => {
                if (draggingClient) return
                localStorage.setItem(`bw_client_${c.slug}_user`, localStorage.getItem('bw_superadmin'))
                localStorage.setItem(`bw_client_${c.slug}_usertype`, 'team')
                navigate(`/${c.slug}`)
              }}
              style={{ padding: '12px 14px', cursor: 'grab', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)', borderRadius: 14,
                opacity: isDragging ? 0.3 : 1, transform: isDragging ? 'scale(0.95)' : 'scale(1)',
                background: 'transparent' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${accent}18`, border: `1px solid ${accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {c.logoUrl ? <img src={c.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '0.9rem', fontWeight: 700, color: accent }}>{c.name[0]}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{fmt(c.monthRevenue || 0)}€ rev</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>{fmtK(c.monthNetCash || c.monthCash || 0)}€</div>
                <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: 0.5 }}>cash</div>
              </div>
            </div>
          )
        }

        return (
          <div className="hp-panels-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
            {SECTIONS.map((section, si) => {
              const isOver = dropTarget === section.key && draggingClient
              const canDrop = section.droppable && draggingClient && !section.clients.find(c => c.id === draggingClient)
              const sectionCash = section.clients.reduce((s, c) => s + (c.monthNetCash || c.monthCash || 0), 0)
              return (
                <motion.div key={section.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + si * 0.08 }}
                  onDragOver={e => { if (section.droppable && draggingClient) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget(section.key) } }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropTarget(null) }}
                  onDrop={e => { e.preventDefault(); if (section.droppable && draggingClient) handleDrop(draggingClient, section.key) }}
                  style={{ ...S.card, padding: 0, overflow: 'hidden', minHeight: 200,
                    borderColor: isOver ? `${section.color}50` : 'rgba(255,255,255,0.06)',
                    background: isOver ? `${section.color}08` : 'rgba(255,255,255,0.02)',
                    transition: 'all 0.3s ease' }}>

                  {/* Panel header */}
                  <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 3, height: 16, borderRadius: 2, background: section.color }} />
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fff', letterSpacing: -0.2 }}>{section.title}</span>
                      <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)', fontWeight: 500 }}>{section.clients.length}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', letterSpacing: -0.3 }}>{fmtK(sectionCash)}€</div>
                      <div style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: 1 }}>cash</div>
                    </div>
                  </div>

                  {/* Client list */}
                  <div style={{ padding: '6px 8px' }}>
                    {section.clients.length > 0 ? (
                      section.clients.map(c => renderClientCard(c))
                    ) : (
                      <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.2)' }}>Sin clientes</div>
                        <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.12)', marginTop: 4 }}>Arrastra aqui</div>
                      </div>
                    )}
                  </div>

                  {/* Drop hint */}
                  {draggingClient && canDrop && (
                    <div style={{ padding: '8px 16px', textAlign: 'center', fontSize: '0.6rem', color: section.color, fontWeight: 600, background: `${section.color}08` }}>
                      Soltar aqui
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        )
      })()}

      {/* ═══ REVENUE CHART ═══ */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
        style={{ ...S.cardDark, padding: '28px 24px 18px', marginTop: 12, marginBottom: 32 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: 2.5, fontWeight: 700 }}>Revenue por cliente</div>
          <div style={{ fontSize: '1.05rem', color: '#fff', fontWeight: 600, marginTop: 6, letterSpacing: -0.3 }}>Ultimos 6 meses</div>
        </div>
        {revenueHistory.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={revenueHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${fmtK(v)}€`} width={55} />
              <Tooltip contentStyle={{ background: 'rgba(10,10,20,0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12, color: '#fff' }} formatter={(v, name) => [`${fmt(v)}€`, name]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {realClients.map((c, i) => (
                <Line key={c.slug} type="monotone" dataKey={c.slug} name={c.name} stroke={CLIENT_COLORS[i % CLIENT_COLORS.length]} strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 0, fill: CLIENT_COLORS[i % CLIENT_COLORS.length] }} activeDot={{ r: 5, strokeWidth: 2, stroke: '#0a0a14' }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)' }}>
            {loading ? 'Cargando datos...' : 'Sin datos de revenue'}
          </div>
        )}
      </motion.div>


      {/* ═══ EMBEDDED APP (SOC / Enjambre) — integrated, no external ═══ */}
      <AnimatePresence>
        {embeddedApp && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#050510', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 48, background: 'rgba(5,5,16,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0 }}>
              <button onClick={() => setEmbeddedApp(null)}
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: 'rgba(255,255,255,0.7)', padding: '6px 14px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                ← Volver
              </button>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>{embeddedApp.title}</div>
            </div>
            <iframe src={embeddedApp.url} style={{ flex: 1, border: 'none', width: '100%', background: '#050510' }}
              allow="clipboard-read; clipboard-write; fullscreen" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ SCRAPPER POPUP ═══ */}
      <AnimatePresence>
        {scrapOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !scrapRunning && setScrapOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, backdropFilter: 'blur(4px)' }} />
            <motion.div initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24, mass: 0.8 }}
              style={{ position: 'fixed', inset: 0, margin: 'auto', width: 'min(420px, calc(100vw - 32px))', height: 'fit-content', maxHeight: '88vh', background: 'rgba(10,10,20,0.95)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderRadius: 28, display: 'flex', flexDirection: 'column', zIndex: 1001, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 40px 100px rgba(0,0,0,0.6)' }}>

              {/* Header */}
              <div style={{ padding: '18px 20px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem' }}>🔍</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>Scrapper Prospector</div>
                  <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)' }}>Busca leads → CRM</div>
                </div>
                {!scrapRunning && <button onClick={() => setScrapOpen(false)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 50, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', fontWeight: 700 }}>✕</button>}
              </div>

              {/* Body */}
              <div style={{ padding: '0 20px 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Query */}
                <div>
                  <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 5, display: 'block' }}>Buscar</label>
                  <input value={scrapQuery} onChange={e => setScrapQuery(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#fff', padding: '11px 14px', fontSize: '0.82rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    placeholder="fabricas textiles, clinicas..." />
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
                    {SCRAPPER_PRESETS.map(p => (
                      <button key={p} onClick={() => setScrapQuery(p)}
                        style={{ background: scrapQuery === p ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)', color: scrapQuery === p ? '#fff' : 'rgba(255,255,255,0.4)', border: `1px solid ${scrapQuery === p ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 8, padding: '3px 9px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 500 }}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Countries */}
                <div>
                  <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 5, display: 'block' }}>Paises</label>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {EUROPEAN_COUNTRIES.map(c => {
                      const sel = scrapCountries.includes(c)
                      return <button key={c} onClick={() => toggleScrapCountry(c)}
                        style={{ background: sel ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)', color: sel ? '#fff' : 'rgba(255,255,255,0.4)', border: `1px solid ${sel ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 8, padding: '3px 8px', cursor: 'pointer', fontSize: '0.58rem', fontWeight: sel ? 600 : 400 }}>
                        {sel ? '✓ ' : ''}{c}
                      </button>
                    })}
                  </div>
                </div>

                {/* Max per country */}
                <div>
                  <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 5, display: 'block' }}>Leads por pais</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[5, 10, 20, 40].map(n => (
                      <button key={n} onClick={() => setScrapMax(n)}
                        style={{ background: scrapMax === n ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)', color: scrapMax === n ? '#fff' : 'rgba(255,255,255,0.4)', border: `1px solid ${scrapMax === n ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 10, padding: '8px 0', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, flex: 1 }}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Client */}
                <div>
                  <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 5, display: 'block' }}>Enviar al CRM de</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {realClients.map(c => {
                      const sel = scrapTargetClient === c.slug
                      return (
                        <button key={c.slug} onClick={() => { setScrapTargetClient(c.slug); loadPipelinesForClient(c.slug) }}
                          style={{ background: sel ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)', color: sel ? '#fff' : 'rgba(255,255,255,0.6)', border: `1px solid ${sel ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 12, padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, transition: 'all 0.15s' }}>
                          <div style={{ width: 24, height: 24, borderRadius: 7, background: sel ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                            {c.logoUrl ? <img src={c.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '0.6rem', fontWeight: 700 }}>{c.name[0]}</span>}
                          </div>
                          <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>{c.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Pipeline selector */}
                {scrapTargetClient && (
                  <div>
                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 5, display: 'block' }}>Pipeline destino</label>
                    {scrapLoadingPipelines ? (
                      <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', padding: 6 }}>Cargando pipelines...</div>
                    ) : scrapPipelines.length > 0 ? (
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {scrapPipelines.map(p => {
                          const sel = scrapTargetPipeline === p.id
                          return (
                            <button key={p.id} onClick={() => setScrapTargetPipeline(p.id)}
                              style={{ background: sel ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)', color: sel ? '#fff' : 'rgba(255,255,255,0.4)', border: `1px solid ${sel ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 10, padding: '7px 14px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: sel ? 600 : 400 }}>
                              {p.name}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', padding: 6 }}>Sin pipelines — se usara el default</div>
                    )}
                  </div>
                )}

                {/* Results */}
                {scrapResult && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { label: 'Encontrados', v: scrapResult.total || 0, color: '#fff' },
                      { label: 'Creados', v: scrapResult.created || 0, color: '#22C55E' },
                      { label: 'Duplicados', v: scrapResult.duplicates || 0, color: '#F59E0B' },
                    ].map(r => (
                      <div key={r.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '10px 12px', textAlign: 'center', flex: 1 }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: r.color }}>{r.v}</div>
                        <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{r.label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8, alignItems: 'center' }}>
                {scrapRunning ? (
                  <div style={{ flex: 1, fontSize: '0.7rem', color: '#22C55E', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', animation: 'pulse 1.2s infinite' }} />
                    Scrapeando...
                  </div>
                ) : (
                  <div style={{ flex: 1, fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>{scrapCountries.length} paises · {scrapMax}/pais</div>
                )}
                <button onClick={runScrapper} disabled={scrapRunning || !scrapQuery.trim() || !scrapTargetClient}
                  style={{ background: (scrapRunning || !scrapTargetClient) ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.1)', color: (scrapRunning || !scrapTargetClient) ? 'rgba(255,255,255,0.2)' : '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '11px 24px', fontSize: '0.8rem', fontWeight: 700, cursor: (scrapRunning || !scrapTargetClient) ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
                  {scrapRunning ? 'Ejecutando...' : !scrapTargetClient ? 'Selecciona cliente' : 'Ejecutar'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══ IA CENTRAL — Floating Panel ═══ */}
      <AnimatePresence>
        {iaOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIaOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000 }} />
            <motion.div initial={{ opacity: 0, y: 40, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{ position: 'fixed', bottom: 24, right: 24, width: 440, maxHeight: '70vh', background: 'rgba(10,10,20,0.95)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, display: 'flex', flexDirection: 'column', zIndex: 1001, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>

              {/* Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>AI</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>IA Central</div>
                  <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)' }}>{iaFeed.length} eventos</div>
                </div>
                <button onClick={() => setIaOpen(false)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>✕</button>
              </div>

              {/* Feed */}
              {iaFeed.length > 0 && (
                <div style={{ maxHeight: 120, overflowY: 'auto', padding: '8px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)' }}>
                  {iaFeed.slice(-10).map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, padding: '2px 0', fontSize: '0.65rem', fontFamily: "'SF Mono', monospace" }}>
                      <span style={{ color: 'rgba(255,255,255,0.2)', minWidth: 48 }}>{f.time}</span>
                      <span style={{ color: feedColors[f.type] || '#888' }}>{f.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {iaMessages.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>Pregunta o da una orden</div>
                    {['Revenue de este mes', 'Activa el scrapper', 'Resumen de ventas'].map(s => (
                      <button key={s} onClick={() => setIaInput(s)} style={{ display: 'block', width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', textAlign: 'left', marginBottom: 6 }}>{s}</button>
                    ))}
                  </div>
                )}
                {iaMessages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '85%', padding: '10px 14px', borderRadius: 14, background: msg.role === 'user' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)', color: msg.role === 'user' ? '#fff' : 'rgba(255,255,255,0.8)', fontSize: '0.8rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {iaSending && (
                  <div style={{ display: 'flex', gap: 4, padding: '6px 0' }}>
                    {[0, 1, 2].map(i => (<motion.div key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />))}
                  </div>
                )}
                <div ref={iaEndRef} />
              </div>

              {/* Input */}
              <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8 }}>
                <input value={iaInput} onChange={e => setIaInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendIaMessage()} placeholder="Pregunta o da una orden..."
                  style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#fff', padding: '10px 14px', fontSize: '0.8rem', outline: 'none', fontFamily: 'inherit' }} />
                <button onClick={sendIaMessage} disabled={iaSending || !iaInput.trim()}
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, width: 40, height: 40, cursor: iaSending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.9rem', fontWeight: 700, flexShrink: 0 }}>
                  →
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating IA button */}
      {!iaOpen && (
        <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1, type: 'spring', stiffness: 300 }}
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
          onClick={() => setIaOpen(true)}
          style={{ position: 'fixed', bottom: 24, right: 24, width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, color: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', zIndex: 999 }}>
          AI
          {iaFeed.length > 0 && (
            <div style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#FF6B00', border: '2px solid #050510', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem', color: '#fff', fontWeight: 700 }}>{iaFeed.length}</div>
          )}
        </motion.button>
      )}

      {/* ═══ SETTINGS MODAL ═══ */}
      <AnimatePresence>
        {settingsOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSettingsOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, backdropFilter: 'blur(4px)' }} />
            <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              style={{ position: 'fixed', inset: 0, margin: 'auto', width: 'min(480px, calc(100vw - 32px))', height: 'fit-content', maxHeight: '80vh', background: 'rgba(10,10,20,0.95)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderRadius: 24, display: 'flex', flexDirection: 'column', zIndex: 1001, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 40px 100px rgba(0,0,0,0.6)' }}>

              {/* Header */}
              <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>Ajustes</div>
                  <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Configuracion general del dashboard</div>
                </div>
                <button onClick={() => setSettingsOpen(false)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontWeight: 700 }}>✕</button>
              </div>

              {/* Settings content */}
              <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Client overview */}
                <div>
                  <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>Resumen de clientes</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { label: 'Growth', value: growthClients.length, color: '#3B82F6' },
                      { label: 'Consultoria', value: consultoriaClients.length, color: '#A855F7' },
                      { label: 'Manufactura', value: mfgClients.length, color: '#22C55E' },
                      { label: 'Total activos', value: nonAdminClients.length, color: '#fff' },
                    ].map(item => (
                      <div key={item.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>{item.label}</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: item.color }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick actions */}
                <div>
                  <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>Acciones rapidas</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      { label: 'Consola de administracion', to: '/admin/consola' },
                    ].map(action => (
                      <button key={action.label} onClick={() => { setSettingsOpen(false); navigate(action.to) }}
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 16px', cursor: 'pointer', color: '#fff', fontSize: '0.78rem', fontWeight: 500, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'inherit' }}>
                        {action.label}
                        <span style={{ color: 'rgba(255,255,255,0.2)' }}>→</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* System info */}
                <div>
                  <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>Sistema</div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)' }}>Version</span>
                      <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>Dashboard v2.0</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)' }}>IA Feed</span>
                      <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>{iaFeed.length} eventos</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }
        .hp-bw-gadget:hover { border-color: rgba(255,107,0,0.25) !important; background: linear-gradient(135deg, rgba(255,107,0,0.06), rgba(255,255,255,0.03)) !important; }
        @media (max-width: 900px) {
          .hp-panels-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 768px) {
          .hp-container { padding: 0 16px 80px !important; }
          .hp-kpi-grid { grid-template-columns: 1fr !important; gap: 10px !important; }
          .hp-tools-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
          .hp-panels-grid { grid-template-columns: 1fr !important; }
          .hp-bw-gadget { flex-direction: column !important; text-align: center !important; gap: 16px !important; padding: 24px 20px !important; }
          .hp-bw-stats { justify-content: center !important; }
          .hp-greeting { display: none !important; }
        }
        @media (max-width: 430px) {
          .hp-tools-grid { grid-template-columns: 1fr 1fr !important; }
          .hp-bw-stats { gap: 18px !important; }
        }
      `}</style>
    </div>
  )
}
