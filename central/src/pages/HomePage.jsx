import { useNavigate } from 'react-router-dom'
import { useClient } from '../contexts/ClientContext'
import { useClientData } from '../hooks/useClientData'
import { useAsync } from '../hooks/useAsync'
import { useAgentChat } from '../contexts/AgentChatContext'
import { getDateRange, dateInRange } from '../components/Filters'
import AgentChatBody from '../components/AgentChatBody'
import { useState, useEffect, useMemo, useRef } from 'react'

function fmt(v) {
  return v.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function HealthBar({ value, color }) {
  const pct = Math.min(Math.max(value, 0), 100)
  return (
    <div className="home-health-bar">
      <div className="home-health-bar__fill" style={{ width: `${pct}%`, background: color || 'var(--gradient)' }} />
    </div>
  )
}

function MetricPill({ label, monthly, weekly, color, en }) {
  return (
    <div className="home-metric-pill">
      <span className="home-metric-pill__label">{label}</span>
      <div className="home-metric-pill__row">
        <span className="home-metric-pill__period">{en ? 'Mo' : 'Mes'}</span>
        <span className="home-metric-pill__value" style={color ? { color } : {}}>{monthly}</span>
      </div>
      <div className="home-metric-pill__row">
        <span className="home-metric-pill__period">{en ? 'Wk' : 'Sem'}</span>
        <span className="home-metric-pill__value home-metric-pill__value--sub">{weekly}</span>
      </div>
    </div>
  )
}

function Widget({ title, icon, children, onClick, span = 1 }) {
  return (
    <div
      className={`home-widget ${span === 2 ? 'home-widget--wide' : ''}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="home-widget__header">
        <span className="home-widget__icon">{icon}</span>
        <span className="home-widget__title">{title}</span>
      </div>
      <div className="home-widget__body">
        {children}
      </div>
    </div>
  )
}

function Clock({ en }) {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])
  const locale = en ? 'en-US' : 'es-ES'

  return (
    <div className="home-clock">
      <span className="home-clock__time">
        {time.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
      </span>
      <span className="home-clock__date">
        {time.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
      </span>
    </div>
  )
}

function TimeGreeting(en) {
  const hour = new Date().getHours()
  if (en) {
    if (hour < 12) return 'Good morning'
    if (hour < 19) return 'Good afternoon'
    return 'Good evening'
  }
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export default function HomePage({ role, user }) {
  const navigate = useNavigate()
  const { clientSlug, clientConfig } = useClient()
  const prefix = `/${clientSlug}`
  const logoUrl = clientConfig?.logoUrl
  const en = clientSlug === 'black-wolf'

  const { getSalesWithNetCash, getReports, getStores, getStoreTickets } = useClientData()
  const [allSales, salesLoading] = useAsync(getSalesWithNetCash, [])
  const [allReports, reportsLoading] = useAsync(getReports, [])
  const [allStores, storesLoading] = useAsync(getStores, [])
  const [allTickets] = useAsync(getStoreTickets, [])
  const loading = salesLoading || reportsLoading || storesLoading

  const monthRange = useMemo(() => getDateRange('thisMonth'), [])
  const weekRange = useMemo(() => getDateRange('thisWeek'), [])

  // === MONTHLY ===
  const monthlySales = useMemo(() => allSales.filter(s => dateInRange(s.date, monthRange)), [allSales])
  const mCash = monthlySales.reduce((s, v) => s + (v.netCash || 0), 0)
  const mSalesCount = monthlySales.length
  const mReports = useMemo(() => allReports.filter(r => dateInRange(r.date, monthRange)), [allReports])
  const mClosers = mReports.filter(r => r.role === 'closer')
  const mCalls = mClosers.reduce((s, r) => s + (r.callsMade || 0), 0)

  const pace = useMemo(() => {
    const now = new Date()
    const dayOfMonth = now.getDate()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    if (dayOfMonth > 0) return Math.round(mCash / dayOfMonth * daysInMonth)
    return mCash
  }, [mCash])

  // === WEEKLY ===
  const weeklySales = useMemo(() => allSales.filter(s => dateInRange(s.date, weekRange)), [allSales])
  const wCash = weeklySales.reduce((s, v) => s + (v.netCash || 0), 0)
  const wSalesCount = weeklySales.length
  const wReports = useMemo(() => allReports.filter(r => dateInRange(r.date, weekRange)), [allReports])
  const wClosers = wReports.filter(r => r.role === 'closer')
  const wCalls = wClosers.reduce((s, r) => s + (r.callsMade || 0), 0)

  // === HEALTH METRICS (monthly) ===
  const mSetters = mReports.filter(r => r.role === 'setter')
  const totalConvos = mSetters.reduce((s, r) => s + (r.conversationsOpened || 0), 0)
  const totalAppointments = mSetters.reduce((s, r) => s + (r.appointmentsBooked || 0), 0)
  const agendaComboRate = totalConvos ? Math.round(totalAppointments / totalConvos * 100) : 0

  const mScheduled = mClosers.reduce((s, r) => s + (r.scheduledCalls || 0), 0)
  const mCloses = mClosers.reduce((s, r) => s + (r.closes || 0), 0)
  const closeRate = mCalls ? Math.round(mCloses / mCalls * 100) : 0
  const showRate = mScheduled ? Math.round(mCalls / mScheduled * 100) : 0

  // Store counts
  const storeCounts = useMemo(() => {
    const c = { active: 0, onboarding: 0, blocked: 0, completed: 0 }
    allStores.forEach(s => { if (c[s.status] !== undefined) c[s.status]++ })
    return c
  }, [allStores])

  const openTicketCount = useMemo(() => allTickets.filter(t => t.status !== 'resolved' && t.status !== 'closed').length, [allTickets])

  // AI Agent Chat
  const agentChat = useAgentChat()
  const chatInputRef = useRef(null)

  // Constraint analysis
  const constraints = useMemo(() => {
    if (loading) return []
    const c = []
    // Show rate: ideal 80%, warning <65%, critical <50%
    if (showRate < 65) c.push({
      type: 'show_rate', severity: showRate < 50 ? 'critical' : 'warning',
      title: en ? 'Low Show Rate' : 'Show Rate Bajo',
      detail: en ? `${showRate}% of scheduled calls happening (ideal: 80%)` : `${showRate}% de llamadas agendadas se realizan (ideal: 80%)`,
      suggestion: en ? 'Review confirmation sequences and reminder cadence' : 'Revisar secuencias de confirmación y recordatorios',
    })
    // Close rate: ideal 25-30%, warning <18%, critical <10%
    if (closeRate < 18) c.push({
      type: 'close_rate', severity: closeRate < 10 ? 'critical' : 'warning',
      title: en ? 'Low Close Rate' : 'Tasa de Cierre Baja',
      detail: en ? `Close rate at ${closeRate}% (ideal: 25-30%)` : `Tasa de cierre al ${closeRate}% (ideal: 25-30%)`,
      suggestion: en ? 'Review sales scripts and objection handling' : 'Revisar scripts de venta y manejo de objeciones',
    })
    // Agenda rate: ideal 10-12%, warning <7%, critical <4%
    if (agendaComboRate < 7) c.push({
      type: 'booking_rate', severity: agendaComboRate < 4 ? 'critical' : 'warning',
      title: en ? 'Low Booking Rate' : 'Tasa de Agendas Baja',
      detail: en ? `${agendaComboRate}% booking rate (ideal: 10-12%)` : `${agendaComboRate}% de agendas (ideal: 10-12%)`,
      suggestion: en ? 'Improve setter scripts and qualification process' : 'Mejorar scripts de setters y proceso de cualificación',
    })
    if (storeCounts.blocked > 0) c.push({
      type: 'blocked_stores', severity: storeCounts.blocked >= 3 ? 'critical' : 'warning',
      title: en ? 'Blocked Stores' : 'Tiendas Bloqueadas',
      detail: en ? `${storeCounts.blocked} store(s) blocked` : `${storeCounts.blocked} tienda(s) bloqueada(s)`,
      suggestion: en ? 'Urgent attention needed from gestors' : 'Atención urgente por parte de gestores',
    })
    if (pace > 0 && mCash > 0) {
      // If no sales in last 3 days, flag it
      const threeDaysAgo = new Date(); threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
      const recentSales = monthlySales.filter(s => new Date(s.date) >= threeDaysAgo)
      if (recentSales.length === 0 && monthlySales.length > 0) c.push({
        type: 'no_recent_sales', severity: 'warning',
        title: en ? 'No Recent Sales' : 'Sin Ventas Recientes',
        detail: en ? 'No sales in the last 3 days' : 'Sin ventas en los últimos 3 días',
        suggestion: en ? 'Check closer activity and pipeline flow' : 'Revisar actividad de closers y flujo del pipeline',
      })
    }
    if (c.length === 0) c.push({
      type: 'all_good', severity: 'ok',
      title: en ? 'All Good' : 'Todo Bien',
      detail: en ? 'No critical constraints detected this period' : 'Sin constraints críticos en este periodo',
      suggestion: en ? 'Keep the momentum going!' : 'Mantén el ritmo.',
    })
    return c
  }, [loading, showRate, closeRate, agendaComboRate, storeCounts, pace, mCash, monthlySales, en])

  return (
    <div className="home-page home-page--animated">
      <div className="home-bg-orb home-bg-orb--1" />
      <div className="home-bg-orb home-bg-orb--2" />

      {/* Header */}
      <header className="home-header home-fadein" style={{ animationDelay: '0s' }}>
        {logoUrl && <img src={logoUrl} alt={clientConfig?.name || 'Dashboard'} className="home-header__logo" />}
        <h1 className="home-header__title">{clientConfig?.name || 'Dashboard'}</h1>
        <Clock en={en} />
        <p className="home-header__greeting">{TimeGreeting(en)}</p>
      </header>

      {/* Quick Metrics Bar */}
      <section className="home-quick-metrics home-fadein" style={{ animationDelay: '0.1s' }}>
        <MetricPill en={en} label={en ? 'Net Cash' : 'Cash Neto'} monthly={loading ? '...' : `${fmt(mCash)}€`} weekly={loading ? '...' : `${fmt(wCash)}€`} color="var(--success)" />
        <MetricPill en={en} label="PES" monthly={loading ? '...' : `${fmt(pace)}€`} weekly="—" color="var(--orange)" />
        <MetricPill en={en} label={en ? 'Calls' : 'Llamadas'} monthly={loading ? '...' : mCalls} weekly={loading ? '...' : wCalls} />
        <MetricPill en={en} label={en ? 'Sales' : 'Ventas'} monthly={loading ? '...' : mSalesCount} weekly={loading ? '...' : wSalesCount} color="var(--yellow)" />
      </section>

      {/* App Cards with health metrics */}
      <section className="home-apps-row home-fadein" style={{ animationDelay: '0.2s' }}>
        {/* Gestión Comercial */}
        <div className="home-app-card" onClick={() => navigate(`${prefix}/ventas`)}>
          <div className="home-app-card__glow home-app-card__glow--orange" />
          <div className="home-app-card__top">
            <div className="home-app-card__icon" style={{ background: 'linear-gradient(135deg, #FF6B00, #FF9500)' }}>
              <span>💼</span>
            </div>
            <div className="home-app-card__info">
              <h3>{en ? 'Sales Management' : 'Gestión Comercial'}</h3>
              <p>{en ? 'Sales, reports, CRM' : 'Ventas, reportes, CRM'}</p>
            </div>
            <span className="home-app-card__arrow">→</span>
          </div>
          <div className="home-app-card__metrics">
            <div className="home-app-card__metric">
              <span className="home-app-card__metric-label">{en ? 'Net Cash' : 'Cash Neto'}</span>
              <span className="home-app-card__metric-value">{loading ? '...' : `${fmt(mCash)}€`}</span>
            </div>
            <div className="home-app-card__metric">
              <span className="home-app-card__metric-label">{en ? 'Close %' : '% Cierre'}</span>
              <span className="home-app-card__metric-value">{loading ? '...' : `${closeRate}%`}</span>
              <HealthBar value={closeRate} color={closeRate >= 25 ? 'var(--success)' : closeRate >= 18 ? 'var(--warning)' : 'var(--danger)'} />
            </div>
            <div className="home-app-card__metric">
              <span className="home-app-card__metric-label">% Agendas/Combos</span>
              <span className="home-app-card__metric-value">{loading ? '...' : `${agendaComboRate}%`}</span>
              <HealthBar value={agendaComboRate} color={agendaComboRate >= 10 ? 'var(--success)' : agendaComboRate >= 7 ? 'var(--warning)' : 'var(--danger)'} />
            </div>
            <div className="home-app-card__metric">
              <span className="home-app-card__metric-label">Show Rate</span>
              <span className="home-app-card__metric-value">{loading ? '...' : `${showRate}%`}</span>
              <HealthBar value={showRate} color={showRate >= 80 ? 'var(--success)' : showRate >= 65 ? 'var(--warning)' : 'var(--danger)'} />
            </div>
          </div>
        </div>

        {/* Gestión de Tiendas */}
        <div className="home-app-card" onClick={() => navigate(`${prefix}/tiendas`)}>
          <div className="home-app-card__glow home-app-card__glow--yellow" />
          <div className="home-app-card__top">
            <div className="home-app-card__icon" style={{ background: 'linear-gradient(135deg, #FFB800, #FF6B00)' }}>
              <span>🏪</span>
            </div>
            <div className="home-app-card__info">
              <h3>{en ? 'Client Management' : 'Gestión de Clientes'}</h3>
              <p>{en ? 'Onboarding, tracking, tickets' : 'Onboarding, seguimiento, tickets'}</p>
            </div>
            <span className="home-app-card__arrow">→</span>
          </div>
          <div className="home-app-card__metrics">
            <div className="home-app-card__metric">
              <span className="home-app-card__metric-label">{en ? 'Active' : 'Activas'}</span>
              <span className="home-app-card__metric-value">{loading ? '...' : storeCounts.active}</span>
            </div>
            <div className="home-app-card__metric">
              <span className="home-app-card__metric-label">{en ? 'Onboarding' : 'En proceso'}</span>
              <span className="home-app-card__metric-value">{loading ? '...' : storeCounts.onboarding}</span>
            </div>
            <div className="home-app-card__metric">
              <span className="home-app-card__metric-label">{en ? 'Blocked' : 'Bloqueadas'}</span>
              <span className="home-app-card__metric-value" style={storeCounts.blocked > 0 ? { color: '#ef4444' } : {}}>{loading ? '...' : storeCounts.blocked}</span>
            </div>
            <div className="home-app-card__metric">
              <span className="home-app-card__metric-label">{en ? 'Open Tickets' : 'Tickets abiertos'}</span>
              <span className="home-app-card__metric-value" style={openTicketCount > 0 ? { color: '#f97316' } : {}}>{loading ? '...' : openTicketCount}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Mini widgets: Management & Tareas */}
      <section className="home-apps-row home-apps-row--mini home-fadein" style={{ animationDelay: '0.3s' }}>
        <div className="home-mini-card" onClick={() => navigate(`${prefix}/equipo`)}>
          <div className="home-mini-card__icon">⚙️</div>
          <div className="home-mini-card__content">
            <h4>Management</h4>
            <div className="home-mini-card__links">
              <button onClick={(e) => { e.stopPropagation(); navigate(`${prefix}/equipo`) }}>{en ? 'Team' : 'Equipo'}</button>
              <button onClick={(e) => { e.stopPropagation(); navigate(`${prefix}/proyecciones`) }}>{en ? 'Projections' : 'Proyecciones'}</button>
              <button onClick={(e) => { e.stopPropagation(); navigate(`${prefix}/comisiones`) }}>{en ? 'Commissions' : 'Comisiones'}</button>
              <button onClick={(e) => { e.stopPropagation(); navigate(`${prefix}/productos`) }}>{en ? 'Products' : 'Productos'}</button>
              <button onClick={(e) => { e.stopPropagation(); navigate(`${prefix}/metodos-pago`) }}>{en ? 'Payments' : 'Pagos'}</button>
              <button onClick={(e) => { e.stopPropagation(); navigate(`${prefix}/settings`) }}>Settings</button>
            </div>
          </div>
        </div>

        <div className="home-mini-card" onClick={() => navigate(`${prefix}/pagos-plazos`)}>
          <div className="home-mini-card__icon">💳</div>
          <div className="home-mini-card__content">
            <h4>{en ? 'Installments' : 'Pagos a Plazos'}</h4>
            <div className="home-mini-card__links">
              <button onClick={(e) => { e.stopPropagation(); navigate(`${prefix}/pagos-plazos`) }}>{en ? 'Payment Plans' : 'Planes de Pago'}</button>
            </div>
          </div>
        </div>

        <div className="home-mini-card" onClick={() => navigate(`${prefix}/task-management`)}>
          <div className="home-mini-card__icon">📋</div>
          <div className="home-mini-card__content">
            <h4>{en ? 'Tasks' : 'Tareas'}</h4>
            <div className="home-mini-card__links">
              <button onClick={(e) => { e.stopPropagation(); navigate(`${prefix}/task-management`) }}>Task Board</button>
              <button onClick={(e) => { e.stopPropagation(); navigate(`${prefix}/planning`) }}>Planning</button>
            </div>
          </div>
        </div>

        <div className="home-mini-card" onClick={() => navigate(`${prefix}/formacion`)}>
          <div className="home-mini-card__icon">🎓</div>
          <div className="home-mini-card__content">
            <h4>{en ? 'Training & Community' : 'Formación y Comunidad'}</h4>
            <div className="home-mini-card__links">
              <button onClick={(e) => { e.stopPropagation(); navigate(`${prefix}/formacion`) }}>{en ? 'Courses' : 'Formación'}</button>
              <button onClick={(e) => { e.stopPropagation(); navigate(`${prefix}/comunidad`) }}>{en ? 'Community' : 'Comunidad'}</button>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom row: Constraints + AI Agent Chat */}
      <section className="home-widgets home-fadein" style={{ animationDelay: '0.4s' }}>
        {/* Constraint Analysis */}
        <Widget title={en ? 'Constraint Analysis' : 'Análisis de Constraints'} icon="⚡">
          <div className="home-constraints">
            {constraints.map((c, i) => (
              <div key={i} className={`home-constraint-card home-constraint-card--${c.severity}`}>
                <div className="home-constraint-card__header">
                  <span className="home-constraint-card__dot" />
                  <span className="home-constraint-card__title">{c.title}</span>
                </div>
                <p className="home-constraint-card__detail">{c.detail}</p>
                <p className="home-constraint-card__suggestion">{c.suggestion}</p>
              </div>
            ))}
            {constraints.length > 0 && constraints[0].type !== 'all_good' && (
              <button
                className="home-constraints__discuss-btn"
                onClick={() => {
                  const text = constraints.map(c => `- **${c.title}**: ${c.detail}. ${c.suggestion}`).join('\n')
                  agentChat.createConversationWithContext(text, en ? 'Constraint Discussion' : 'Discusión de Constraints')
                }}
              >
                🤖 {en ? 'Discuss with AI' : 'Discutir con IA'}
              </button>
            )}
          </div>
        </Widget>

        {/* Inline AI Agent Chat */}
        <Widget title={en ? 'AI Agent' : 'Agente IA'} icon="🤖">
          <div className="home-widget-chat">
            <div className="home-widget-chat__header">
              {agentChat.conversations.length > 0 && (
                <select
                  className="home-widget-chat__select"
                  value={agentChat.activeConversationId || ''}
                  onChange={e => {
                    if (e.target.value) agentChat.openConversation(e.target.value)
                  }}
                >
                  <option value="">{en ? '-- Select conversation --' : '-- Seleccionar conversación --'}</option>
                  {agentChat.conversations.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              )}
              <button className="home-widget-chat__new" onClick={() => agentChat.createConversation()}>
                + {en ? 'New' : 'Nueva'}
              </button>
            </div>
            <AgentChatBody
              messages={agentChat.messages}
              onSend={agentChat.sendMessage}
              loading={agentChat.loading}
              compact={true}
              clientName={agentChat.clientName}
              en={en}
              inputRef={chatInputRef}
            />
          </div>
        </Widget>
      </section>
    </div>
  )
}
