import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import Filters, { FilterSelect, getDateRange, getPreviousRange, dateInRange } from '../components/Filters'
import { useClientData } from '../hooks/useClientData'
import { useAsync } from '../hooks/useAsync'

function FlipStatCard({ id, icon, value, label, sub, compClass, compText, flipped, onFlip, sparkData, sparkKey, color }) {
  return (
    <div className={`flip-card-wrap ${flipped ? 'flip-card--flipped' : ''}`} onClick={() => onFlip(id)}>
      <div className="flip-card-inner">
        <div className="flip-card-front stat-card">
          <div className="stat-card-icon">{icon}</div>
          <div className="stat-card-value">{value}</div>
          <div className="stat-card-label">{label}</div>
          {sub && <div className="stat-card-sub">{sub}</div>}
          {compText && <div className={`stat-comp ${compClass || ''}`}>{compText}</div>}
        </div>
        <div className="flip-card-back stat-card">
          <div className="flip-back-title">{label}</div>
          <div className="flip-back-chart">
            {sparkData && sparkData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                  <defs>
                    <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color || '#6366F1'} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={color || '#6366F1'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 8, color: '#fff', fontSize: 11, padding: '6px 10px' }}
                    formatter={(v) => [typeof v === 'number' && sparkKey.toLowerCase().includes('rate') ? `${v}%` : v, '']}
                    labelFormatter={l => l ? l.slice(5) : ''}
                  />
                  <Area type="monotone" dataKey={sparkKey} stroke={color || '#6366F1'} strokeWidth={2} fill={`url(#spark-${id})`} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flip-back-empty">Sin datos</div>
            )}
          </div>
          <div className="flip-back-hint">Clic para volver</div>
        </div>
      </div>
    </div>
  )
}

export default function ColdCallDashboard() {
  const { getReports } = useClientData()
  const navigate = useNavigate()
  const [allReports, reportsLoading] = useAsync(getReports, [])

  const [datePreset, setDatePreset] = useState('thisMonth')
  const [callerFilter, setCallerFilter] = useState('')
  const [flippedCards, setFlippedCards] = useState(new Set())

  // Filter only cold_caller reports
  const coldCallReports = allReports.filter(r => r.role === 'cold_caller')
  const callerNames = [...new Set(coldCallReports.map(r => r.name))]

  const range = getDateRange(datePreset)
  const prevRange = getPreviousRange(datePreset)

  const current = coldCallReports.filter(r => dateInRange(r.date, range) && (!callerFilter || r.name === callerFilter))
  const prev = coldCallReports.filter(r => dateInRange(r.date, prevRange) && (!callerFilter || r.name === callerFilter))

  // Metrics
  const totalDeals = current.reduce((s, r) => s + (r.deals || 0), 0)
  const totalPickUps = current.reduce((s, r) => s + (r.pickUps || 0), 0)
  const totalOffers = current.reduce((s, r) => s + (r.offers || 0), 0)
  const totalScheduleCalls = current.reduce((s, r) => s + (r.scheduleCalls || 0), 0)

  const prevDeals = prev.reduce((s, r) => s + (r.deals || 0), 0)
  const prevPickUps = prev.reduce((s, r) => s + (r.pickUps || 0), 0)
  const prevOffers = prev.reduce((s, r) => s + (r.offers || 0), 0)
  const prevScheduleCalls = prev.reduce((s, r) => s + (r.scheduleCalls || 0), 0)

  // Percentages
  const pickUpRate = totalDeals ? Math.round(totalPickUps / totalDeals * 100) : 0
  const offersFromPickUps = totalPickUps ? Math.round(totalOffers / totalPickUps * 100) : 0
  const scheduledFromPickUps = totalPickUps ? Math.round(totalScheduleCalls / totalPickUps * 100) : 0

  const prevPickUpRate = prevDeals ? Math.round(prevPickUps / prevDeals * 100) : 0
  const prevOffersFromPickUps = prevPickUps ? Math.round(prevOffers / prevPickUps * 100) : 0
  const prevScheduledFromPickUps = prevPickUps ? Math.round(prevScheduleCalls / prevPickUps * 100) : 0

  // Daily data
  const dailyMap = current.reduce((acc, r) => {
    if (!acc[r.date]) acc[r.date] = { date: r.date, deals: 0, pickUps: 0, offers: 0, scheduleCalls: 0 }
    acc[r.date].deals += (r.deals || 0)
    acc[r.date].pickUps += (r.pickUps || 0)
    acc[r.date].offers += (r.offers || 0)
    acc[r.date].scheduleCalls += (r.scheduleCalls || 0)
    return acc
  }, {})
  const daily = Object.values(dailyMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({
      ...d,
      pickUpRate: d.deals ? Math.round(d.pickUps / d.deals * 100) : 0,
      offersRate: d.pickUps ? Math.round(d.offers / d.pickUps * 100) : 0,
      scheduleRate: d.pickUps ? Math.round(d.scheduleCalls / d.pickUps * 100) : 0,
    }))

  // By person
  const byPerson = Object.values(current.reduce((acc, r) => {
    if (!acc[r.name]) acc[r.name] = { name: r.name, deals: 0, pickUps: 0, offers: 0, scheduleCalls: 0 }
    acc[r.name].deals += (r.deals || 0)
    acc[r.name].pickUps += (r.pickUps || 0)
    acc[r.name].offers += (r.offers || 0)
    acc[r.name].scheduleCalls += (r.scheduleCalls || 0)
    return acc
  }, {}))

  // Leaderboard
  const leaderboard = (() => {
    if (byPerson.length === 0) return []
    const maxDeals = Math.max(...byPerson.map(d => d.deals), 1)
    return byPerson.map(d => {
      const pr = d.deals ? (d.pickUps / d.deals * 100) : 0
      const volNorm = d.deals / maxDeals * 100
      const score = pr * 0.6 + volNorm * 0.4
      return { ...d, pickUpRate: Math.round(pr), score: Math.round(score) }
    }).sort((a, b) => b.score - a.score)
  })()

  const diff = (curr, prev) => curr - prev
  const dc = (curr, prev) => curr >= prev ? 'comp--up' : 'comp--down'
  const ct = (curr, prev, suffix = '') => `${diff(curr, prev) >= 0 ? '+' : ''}${diff(curr, prev)}${suffix} vs anterior`
  const medals = ['🥇', '🥈', '🥉']

  const toggleFlip = (cardId) => {
    setFlippedCards(prev => {
      const next = new Set(prev)
      if (next.has(cardId)) next.delete(cardId)
      else next.add(cardId)
      return next
    })
  }

  if (reportsLoading) return <div className="dashboard"><div style={{textAlign:'center',padding:60,color:'#999'}}>Cargando datos...</div></div>

  return (
    <div className="dashboard">
      <Filters
        datePreset={datePreset}
        onDatePreset={setDatePreset}
        extras={
          <FilterSelect label="Cold Caller" value={callerFilter} onChange={setCallerFilter} options={callerNames} />
        }
      />

      {/* Leaderboard */}
      {!callerFilter && (
        <div className="leaderboards-grid" style={{ gridTemplateColumns: '1fr' }}>
          <div className="leaderboard-card">
            <div className="leaderboard-header">
              <span className="leaderboard-trophy">🏆</span>
              <div>
                <h3 className="leaderboard-title">Leaderboard Cold Callers</h3>
                <p className="leaderboard-subtitle">Score = Pick Up Rate (60%) + Volumen (40%)</p>
              </div>
            </div>
            <div className="leaderboard-list">
              {leaderboard.map((c, i) => (
                <div key={c.name} className={`leaderboard-row ${i === 0 ? 'leaderboard-row--first' : ''}`}>
                  <div className="leaderboard-rank">{medals[i] || `#${i + 1}`}</div>
                  <div className="leaderboard-avatar">{c.name.charAt(0)}</div>
                  <div className="leaderboard-info">
                    <div className="leaderboard-name">{c.name}</div>
                    <div className="leaderboard-stats">{c.deals} deals &middot; {c.pickUps} pick ups &middot; {c.offers} offers &middot; {c.scheduleCalls} agendas</div>
                  </div>
                  <div className="leaderboard-metrics">
                    <div className="leaderboard-metric-main">{c.pickUpRate}%</div>
                    <div className="leaderboard-metric-label">pick up rate</div>
                  </div>
                  <div className="leaderboard-score">
                    <div className="leaderboard-score-bar">
                      <div className="leaderboard-score-fill" style={{ width: `${c.score}%` }} />
                    </div>
                    <span className="leaderboard-score-num">{c.score}</span>
                  </div>
                </div>
              ))}
              {leaderboard.length === 0 && <div className="leaderboard-empty">Sin datos en este periodo</div>}
            </div>
          </div>
        </div>
      )}

      {/* Main Metrics */}
      <div className="section-label-dash">Cold Call Metrics</div>
      <div className="stats-grid stats-grid--4">
        <FlipStatCard id="cc-deals" icon="📞" value={totalDeals} label="Deals"
          compClass={dc(totalDeals, prevDeals)} compText={ct(totalDeals, prevDeals)}
          flipped={flippedCards.has('cc-deals')} onFlip={toggleFlip}
          sparkData={daily} sparkKey="deals" />
        <FlipStatCard id="cc-pickups" icon="✅" value={totalPickUps} label="Pick Ups"
          compClass={dc(totalPickUps, prevPickUps)} compText={ct(totalPickUps, prevPickUps)}
          flipped={flippedCards.has('cc-pickups')} onFlip={toggleFlip}
          sparkData={daily} sparkKey="pickUps" />
        <FlipStatCard id="cc-offers" icon="📨" value={totalOffers} label="Offers"
          compClass={dc(totalOffers, prevOffers)} compText={ct(totalOffers, prevOffers)}
          flipped={flippedCards.has('cc-offers')} onFlip={toggleFlip}
          sparkData={daily} sparkKey="offers" />
        <FlipStatCard id="cc-schedule" icon="📅" value={totalScheduleCalls} label="Schedule Calls"
          compClass={dc(totalScheduleCalls, prevScheduleCalls)} compText={ct(totalScheduleCalls, prevScheduleCalls)}
          flipped={flippedCards.has('cc-schedule')} onFlip={toggleFlip}
          sparkData={daily} sparkKey="scheduleCalls" />
      </div>

      {/* Ratios */}
      <div className="section-label-dash" style={{marginTop: 8}}>Ratios</div>
      <div className="stats-grid stats-grid--3">
        <FlipStatCard id="cc-pickupRate" icon="📊" value={`${pickUpRate}%`} label="Pick Up Rate"
          sub={`${totalPickUps}/${totalDeals} pick ups`}
          compClass={dc(pickUpRate, prevPickUpRate)} compText={ct(pickUpRate, prevPickUpRate, '%')}
          flipped={flippedCards.has('cc-pickupRate')} onFlip={toggleFlip}
          sparkData={daily} sparkKey="pickUpRate" color="#818CF8" />
        <FlipStatCard id="cc-offersRate" icon="📊" value={`${offersFromPickUps}%`} label="% Offers / Pick Ups"
          sub={`${totalOffers}/${totalPickUps} offers`}
          compClass={dc(offersFromPickUps, prevOffersFromPickUps)} compText={ct(offersFromPickUps, prevOffersFromPickUps, '%')}
          flipped={flippedCards.has('cc-offersRate')} onFlip={toggleFlip}
          sparkData={daily} sparkKey="offersRate" color="#A78BFA" />
        <FlipStatCard id="cc-scheduleRate" icon="📊" value={`${scheduledFromPickUps}%`} label="% Agendas / Pick Ups"
          sub={`${totalScheduleCalls}/${totalPickUps} agendas`}
          compClass={dc(scheduledFromPickUps, prevScheduledFromPickUps)} compText={ct(scheduledFromPickUps, prevScheduledFromPickUps, '%')}
          flipped={flippedCards.has('cc-scheduleRate')} onFlip={toggleFlip}
          sparkData={daily} sparkKey="scheduleRate" color="#6366F1" />
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="chart-card">
          <h3 className="chart-title">Actividad Cold Call por dia</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={daily} barGap={2}>
              <XAxis dataKey="date" stroke="#666" fontSize={13} tickFormatter={d => d.slice(5)} />
              <YAxis stroke="#666" fontSize={13} />
              <Tooltip contentStyle={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 8, color: '#fff', fontSize: 13 }} />
              <Bar dataKey="deals" fill="#6366F1" radius={[4,4,0,0]} />
              <Bar dataKey="pickUps" fill="#818CF8" radius={[4,4,0,0]} />
              <Bar dataKey="offers" fill="#A78BFA" radius={[4,4,0,0]} />
              <Bar dataKey="scheduleCalls" fill="#C4B5FD" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="chart-legend">
            <span><span className="legend-dot" style={{background:'#6366F1'}} /> Deals</span>
            <span><span className="legend-dot" style={{background:'#818CF8'}} /> Pick Ups</span>
            <span><span className="legend-dot" style={{background:'#A78BFA'}} /> Offers</span>
            <span><span className="legend-dot" style={{background:'#C4B5FD'}} /> Schedule Calls</span>
          </div>
        </div>
        <div className="chart-card">
          <h3 className="chart-title">Rendimiento por Cold Caller</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={byPerson} barGap={4}>
              <XAxis dataKey="name" stroke="#666" fontSize={13} />
              <YAxis stroke="#666" fontSize={13} />
              <Tooltip contentStyle={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 8, color: '#fff', fontSize: 13 }} />
              <Bar dataKey="deals" fill="#6366F1" radius={[4,4,0,0]} />
              <Bar dataKey="pickUps" fill="#818CF8" radius={[4,4,0,0]} />
              <Bar dataKey="offers" fill="#A78BFA" radius={[4,4,0,0]} />
              <Bar dataKey="scheduleCalls" fill="#C4B5FD" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="chart-legend">
            <span><span className="legend-dot" style={{background:'#6366F1'}} /> Deals</span>
            <span><span className="legend-dot" style={{background:'#818CF8'}} /> Pick Ups</span>
            <span><span className="legend-dot" style={{background:'#A78BFA'}} /> Offers</span>
            <span><span className="legend-dot" style={{background:'#C4B5FD'}} /> Schedule Calls</span>
          </div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="section-label-dash" style={{marginTop: 24}}>Resumen por Cold Caller</div>
      <div className="table-wrapper" style={{ marginBottom: 28 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Deals</th>
              <th>Pick Ups</th>
              <th>Offers</th>
              <th>Schedule Calls</th>
              <th>Pick Up Rate</th>
              <th>% Offers</th>
              <th>% Agendas</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              if (byPerson.length === 0) return <tr><td colSpan={8} style={{textAlign:'center',opacity:.5}}>Sin datos</td></tr>
              let totD = 0, totP = 0, totO = 0, totS = 0
              const rows = byPerson.map(p => {
                const pr = p.deals ? Math.round(p.pickUps / p.deals * 100) : 0
                const or = p.pickUps ? Math.round(p.offers / p.pickUps * 100) : 0
                const sr = p.pickUps ? Math.round(p.scheduleCalls / p.pickUps * 100) : 0
                totD += p.deals; totP += p.pickUps; totO += p.offers; totS += p.scheduleCalls
                return (
                  <tr key={p.name}>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.deals}</td>
                    <td>{p.pickUps}</td>
                    <td>{p.offers}</td>
                    <td>{p.scheduleCalls}</td>
                    <td>{pr}%</td>
                    <td>{or}%</td>
                    <td>{sr}%</td>
                  </tr>
                )
              })
              const totPR = totD ? Math.round(totP / totD * 100) : 0
              const totOR = totP ? Math.round(totO / totP * 100) : 0
              const totSR = totP ? Math.round(totS / totP * 100) : 0
              return [...rows, (
                <tr key="_total" style={{fontWeight: 700, borderTop: '2px solid #333'}}>
                  <td>TOTAL</td>
                  <td>{totD}</td>
                  <td>{totP}</td>
                  <td>{totO}</td>
                  <td>{totS}</td>
                  <td>{totPR}%</td>
                  <td>{totOR}%</td>
                  <td>{totSR}%</td>
                </tr>
              )]
            })()}
          </tbody>
        </table>
      </div>

      <div className="dashboard-actions" style={{justifyContent: 'center', marginTop: 16}}>
        <button className="btn-action" onClick={() => navigate('reportes/nuevo')}>+ Cold Call Report</button>
      </div>
    </div>
  )
}
