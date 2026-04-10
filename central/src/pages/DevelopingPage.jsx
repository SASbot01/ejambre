import { useState, useEffect, useCallback } from 'react'
import { Code, RefreshCw, ChevronDown, ChevronRight, User, Clock, FileText, Download, FolderOpen } from 'lucide-react'

const REPOS = [
  { owner: 'aatshadow', repo: 'Dashboard-Ops-', label: 'Central' },
  { owner: 'SASbot01', repo: 'ejambre', label: 'Enjambre' },
]
const GH_TOKEN = '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'
const REPORT_THRESHOLD = 50

// Map report filenames to authors
function getReportAuthor(filename) {
  const lower = filename.toLowerCase()
  if (lower.includes('alejandro') || lower.includes('cto') || lower.includes('sesion')) return 'Alejandro'
  if (lower.includes('alex') || lower.includes('ceo')) return 'Alex'
  return null
}

const AUTHOR_MAP = {
  'SASbot01': { name: 'Alejandro', role: 'CTO', color: '#8B5CF6' },
  'BlackWolf Dev Agent': { name: 'Alejandro', role: 'CTO', color: '#8B5CF6' },
  'aatshadow': { name: 'Alex', role: 'CEO', color: '#3B82F6' },
  'Alex': { name: 'Alex', role: 'CEO', color: '#3B82F6' },
}

function resolveAuthor(commit) {
  const ghUser = commit.author?.login
  const commitName = commit.commit?.author?.name
  return AUTHOR_MAP[ghUser] || AUTHOR_MAP[commitName] || { name: commitName || 'Unknown', role: '', color: '#6B7280' }
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  const days = Math.floor(hrs / 24)
  return `hace ${days}d`
}

function parseCommitMessage(fullMessage) {
  const lines = fullMessage.split('\n')
  const rawTitle = lines[0]
    .replace(/^(feat|fix|refactor|chore|docs|style|test|perf|ci|build)\(?[^)]*\)?:\s*/i, '')
    .trim()
  const rawDesc = lines.slice(1)
    .filter(l => !l.startsWith('Co-Authored-By') && l.trim())
    .join('\n').trim()
  const isAiAssisted = fullMessage.includes('Co-Authored-By: Claude')
  const typeMatch = fullMessage.match(/^(feat|fix|refactor|chore|docs|style|test|perf|ci|build)/i)
  const type = typeMatch ? typeMatch[1].toLowerCase() : null
  return { title: rawTitle, description: rawDesc, isAiAssisted, type }
}

const TYPE_COLORS = {
  feat: { bg: 'rgba(34,197,94,0.12)', color: '#22C55E', label: 'Nueva Funcionalidad' },
  fix: { bg: 'rgba(239,68,68,0.12)', color: '#EF4444', label: 'Correccion' },
  refactor: { bg: 'rgba(59,130,246,0.12)', color: '#3B82F6', label: 'Refactorizacion' },
  chore: { bg: 'rgba(107,114,128,0.12)', color: '#6B7280', label: 'Mantenimiento' },
  docs: { bg: 'rgba(168,85,247,0.12)', color: '#A855F7', label: 'Documentacion' },
}

// ─── Generate Report ───
function generateReport(commits, authorName, authorRole) {
  const now = new Date()
  const dateStr = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  const feats = commits.filter(c => c.commit.message.startsWith('feat'))
  const fixes = commits.filter(c => c.commit.message.startsWith('fix'))
  const refactors = commits.filter(c => c.commit.message.startsWith('refactor'))
  const other = commits.filter(c => !['feat', 'fix', 'refactor'].some(t => c.commit.message.startsWith(t)))
  const aiAssisted = commits.filter(c => c.commit.message.includes('Co-Authored-By: Claude'))

  const firstDate = commits.length > 0 ? new Date(commits[commits.length - 1].commit.author.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '?'
  const lastDate = commits.length > 0 ? new Date(commits[0].commit.author.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '?'

  function listCommits(arr) {
    return arr.map(c => {
      const { title } = parseCommitMessage(c.commit.message)
      const date = new Date(c.commit.author.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
      const repo = c._repoLabel || ''
      return `  - [${date}] ${repo ? `[${repo}] ` : ''}${title}`
    }).join('\n')
  }

  const text = `
═══════════════════════════════════════════════════════
  INFORME DE DESARROLLO — BLACK WOLF
═══════════════════════════════════════════════════════

  Responsable:  ${authorName} (${authorRole})
  Periodo:      ${firstDate} — ${lastDate}
  Generado:     ${dateStr}
  Total commits: ${commits.length}

───────────────────────────────────────────────────────
  RESUMEN
───────────────────────────────────────────────────────

  Nuevas funcionalidades:  ${feats.length}
  Correcciones:            ${fixes.length}
  Refactorizaciones:       ${refactors.length}
  Otros:                   ${other.length}
  AI-assisted:             ${aiAssisted.length}

───────────────────────────────────────────────────────
  NUEVAS FUNCIONALIDADES (${feats.length})
───────────────────────────────────────────────────────
${feats.length > 0 ? listCommits(feats) : '  (ninguna)'}

───────────────────────────────────────────────────────
  CORRECCIONES (${fixes.length})
───────────────────────────────────────────────────────
${fixes.length > 0 ? listCommits(fixes) : '  (ninguna)'}

───────────────────────────────────────────────────────
  REFACTORIZACIONES (${refactors.length})
───────────────────────────────────────────────────────
${refactors.length > 0 ? listCommits(refactors) : '  (ninguna)'}

───────────────────────────────────────────────────────
  OTROS (${other.length})
───────────────────────────────────────────────────────
${other.length > 0 ? listCommits(other) : '  (ninguno)'}

═══════════════════════════════════════════════════════
  Generado automaticamente por Black Wolf Engineering
═══════════════════════════════════════════════════════
`.trim()

  return text
}

function downloadReport(text, authorName) {
  const now = new Date()
  const filename = `informe_${authorName.toLowerCase()}_${now.toISOString().slice(0, 10)}.txt`
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Commit Card ───
function CommitCard({ commit }) {
  const [expanded, setExpanded] = useState(false)
  const author = resolveAuthor(commit)
  const { title, description, isAiAssisted, type } = parseCommitMessage(commit.commit.message)
  const typeStyle = TYPE_COLORS[type] || TYPE_COLORS.chore

  return (
    <div style={{
      background: 'var(--bg-card, rgba(255,255,255,0.03))',
      border: '1px solid var(--border, rgba(255,255,255,0.06))',
      borderRadius: 12, overflow: 'hidden', marginBottom: 6,
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12, transition: 'background 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{ marginTop: 2, flexShrink: 0, color: 'var(--text-secondary, rgba(255,255,255,0.3))' }}>
          {description ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <div style={{ width: 14 }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, color: '#fff', fontWeight: 500, lineHeight: 1.4 }}>{title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: typeStyle.bg, color: typeStyle.color, fontWeight: 600 }}>{typeStyle.label}</span>
            {commit._repoLabel && (
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{commit._repoLabel}</span>
            )}
            <span style={{ fontSize: 11, color: author.color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
              <User size={10} /> {author.name} {author.role && <span style={{ fontWeight: 400, opacity: 0.7 }}>({author.role})</span>}
            </span>
            {isAiAssisted && (
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(139,92,246,0.15)', color: '#8B5CF6', fontWeight: 600 }}>AI-assisted</span>
            )}
            <span style={{ fontSize: 10, color: 'var(--text-secondary, rgba(255,255,255,0.3))', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={9} /> {timeAgo(commit.commit.author.date)}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-secondary, rgba(255,255,255,0.25))', fontFamily: 'monospace' }}>{commit.sha.slice(0, 7)}</span>
          </div>
        </div>
      </div>
      {expanded && description && (
        <div style={{ padding: '0 16px 14px 42px', borderTop: '1px solid var(--border, rgba(255,255,255,0.04))', paddingTop: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary, rgba(255,255,255,0.5))', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{description}</div>
        </div>
      )}
    </div>
  )
}

// ─── Report Preview Modal ───
function ReportModal({ report, authorName, onClose }) {
  if (!report) return null
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'fixed', inset: 0, margin: 'auto', width: 'min(700px, calc(100vw - 32px))', height: 'fit-content', maxHeight: '85vh',
        background: 'rgba(10,10,20,0.97)', backdropFilter: 'blur(24px)', borderRadius: 20,
        border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 40px 100px rgba(0,0,0,0.6)',
        zIndex: 1001, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={18} color="#8B5CF6" />
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>Informe de Desarrollo</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => downloadReport(report, authorName)} style={{
              padding: '6px 14px', borderRadius: 8, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
              color: '#8B5CF6', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Download size={12} /> Descargar
            </button>
            <button onClick={onClose} style={{
              width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
            }}>✕</button>
          </div>
        </div>
        <div style={{ padding: '16px 22px', overflowY: 'auto', flex: 1 }}>
          <pre style={{
            fontSize: 12, fontFamily: "'SF Mono', 'JetBrains Mono', monospace", color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0,
          }}>
            {report}
          </pre>
        </div>
      </div>
    </>
  )
}

// ─── Main Page ───
export default function DevelopingPage() {
  const [commits, setCommits] = useState([])
  const [loading, setLoading] = useState(true)
  const [reportPreview, setReportPreview] = useState(null)
  const [reportAuthor, setReportAuthor] = useState(null)
  const [filterAuthor, setFilterAuthor] = useState(null)
  const [savedReports, setSavedReports] = useState([])
  const [expandedAuthor, setExpandedAuthor] = useState(null)
  const [loadingReport, setLoadingReport] = useState(null)

  const fetchCommits = useCallback(async () => {
    setLoading(true)
    try {
      const allCommits = []
      for (const repo of REPOS) {
        const res = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.repo}/commits?per_page=60`, {
          headers: { Authorization: `token ${GH_TOKEN}` },
        })
        if (res.ok) {
          const data = await res.json()
          data.forEach(c => { c._repoLabel = repo.label })
          allCommits.push(...data)
        }
      }
      allCommits.sort((a, b) => new Date(b.commit.author.date) - new Date(a.commit.author.date))
      setCommits(allCommits)
    } catch {}
    setLoading(false)
  }, [])

  // Fetch saved reports from GitHub
  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch('https://api.github.com/repos/aatshadow/Dashboard-Ops-/contents/informes', {
        headers: { Authorization: `token ${GH_TOKEN}` },
      })
      if (res.ok) {
        const files = await res.json()
        const reports = files
          .filter(f => f.name.endsWith('.txt'))
          .map(f => ({
            name: f.name,
            path: f.path,
            sha: f.sha,
            downloadUrl: f.download_url,
            author: getReportAuthor(f.name),
            date: f.name.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || '',
            label: f.name
              .replace('.txt', '')
              .replace(/_/g, ' ')
              .replace(/informe /i, '')
              .replace(/sesion /, 'Sesion ')
              .replace(/alejandro/, 'Alejandro')
              .replace(/alex/, 'Alex'),
          }))
          .sort((a, b) => b.date.localeCompare(a.date))
        setSavedReports(reports)
      } else {
        console.error('[Reports] Failed to fetch reports list:', res.status, res.statusText)
      }
    } catch (err) {
      console.error('[Reports] Error fetching reports:', err)
    }
  }, [])

  useEffect(() => { fetchCommits(); fetchReports() }, [fetchCommits, fetchReports])

  // Author stats
  const authorStats = {}
  commits.forEach(c => {
    const a = resolveAuthor(c)
    if (!authorStats[a.name]) authorStats[a.name] = { ...a, count: 0, commits: [] }
    authorStats[a.name].count++
    authorStats[a.name].commits.push(c)
  })

  // Filtered commits
  const filtered = filterAuthor ? commits.filter(c => resolveAuthor(c).name === filterAuthor) : commits

  // Group by date
  const grouped = {}
  filtered.forEach(c => {
    const day = new Date(c.commit.author.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    if (!grouped[day]) grouped[day] = []
    grouped[day].push(c)
  })

  function handleGenerateReport(authorName) {
    const stats = authorStats[authorName]
    if (!stats) return
    const report = generateReport(stats.commits, stats.name, stats.role)
    setReportPreview(report)
    setReportAuthor(stats.name)
  }

  async function handleOpenSavedReport(report) {
    setLoadingReport(report.name)
    try {
      // Try download_url first, then fall back to API contents endpoint
      let text = null
      const res = await fetch(report.downloadUrl)
      if (res.ok) {
        text = await res.text()
      } else {
        // Fallback: fetch via GitHub API (handles auth/CORS issues)
        const apiRes = await fetch(`https://api.github.com/repos/aatshadow/Dashboard-Ops-/contents/${report.path}`, {
          headers: { Authorization: `token ${GH_TOKEN}`, Accept: 'application/vnd.github.v3.raw' },
        })
        if (apiRes.ok) {
          text = await apiRes.text()
        }
      }
      if (text) {
        setReportPreview(text)
        setReportAuthor(report.author)
      } else {
        alert('No se pudo abrir el informe. Verifica la conexion o el token de GitHub.')
      }
    } catch (err) {
      console.error('[Reports] Error opening report:', err)
      alert('Error abriendo informe: ' + err.message)
    }
    setLoadingReport(null)
  }

  function toggleAuthor(name) {
    setExpandedAuthor(expandedAuthor === name ? null : name)
    setFilterAuthor(expandedAuthor === name ? null : name)
  }

  return (
    <div style={{ padding: '0 24px 40px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Code size={22} /> Developing
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            BlackWolf Engineering — Central + Enjambre
          </p>
        </div>
        <button onClick={() => { fetchCommits(); fetchReports() }} disabled={loading} style={{
          padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)',
          color: 'var(--text)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
        }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Team Cards — expandable with reports */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {Object.values(authorStats).map(a => {
          const isExpanded = expandedAuthor === a.name
          const authorReports = savedReports.filter(r => r.author === a.name)

          return (
            <div key={a.name} style={{
              borderRadius: 14, overflow: 'hidden',
              background: isExpanded ? `${a.color}08` : 'var(--bg-card)',
              border: `1px solid ${isExpanded ? `${a.color}30` : 'var(--border)'}`,
              transition: 'all 0.2s',
            }}>
              {/* Author header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                cursor: 'pointer',
              }} onClick={() => toggleAuthor(a.name)}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, background: `${a.color}20`, border: `1px solid ${a.color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: a.color,
                  flexShrink: 0,
                }}>
                  {a.name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                    {a.name} <span style={{ fontWeight: 400, opacity: 0.5, fontSize: 12 }}>{a.role}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {a.count} commits
                    {authorReports.length > 0 && <span style={{ marginLeft: 8 }}>• {authorReports.length} informe{authorReports.length > 1 ? 's' : ''}</span>}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleGenerateReport(a.name) }}
                  style={{
                    padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.3)',
                    background: 'rgba(139,92,246,0.1)', color: '#8B5CF6', fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <FileText size={11} /> Generar nuevo
                </button>
                <div style={{ color: 'var(--text-secondary)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  <ChevronDown size={16} />
                </div>
              </div>

              {/* Expanded: saved reports list */}
              {isExpanded && (
                <div style={{ padding: '0 16px 14px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  {authorReports.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 12 }}>
                      {authorReports.map(r => (
                        <div
                          key={r.name}
                          onClick={() => handleOpenSavedReport(r)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.08)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.2)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
                        >
                          <FolderOpen size={14} style={{ color: '#8B5CF6', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{r.label}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 1 }}>{r.date}</div>
                          </div>
                          {loadingReport === r.name ? (
                            <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Cargando...</span>
                          ) : (
                            <span style={{ fontSize: 11, color: 'rgba(139,92,246,0.7)' }}>Abrir →</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ paddingTop: 12, fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
                      Sin informes guardados — pulsa "Generar nuevo" para crear uno
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total Cambios', value: filtered.length, color: '#fff' },
          { label: 'Nuevas', value: filtered.filter(c => c.commit.message.startsWith('feat')).length, color: '#22C55E' },
          { label: 'Correcciones', value: filtered.filter(c => c.commit.message.startsWith('fix')).length, color: '#EF4444' },
          { label: 'AI-assisted', value: filtered.filter(c => c.commit.message.includes('Co-Authored-By: Claude')).length, color: '#8B5CF6' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 18px', flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: s.color, marginTop: 2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter indicator */}
      {filterAuthor && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Filtrando por: <strong style={{ color: '#fff' }}>{filterAuthor}</strong></span>
          <button onClick={() => setFilterAuthor(null)} style={{
            padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 10,
          }}>Limpiar</button>
        </div>
      )}

      {/* Commit list */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 40 }}>Cargando changelog...</div>
      ) : (
        Object.entries(grouped).map(([day, dayCommits]) => (
          <div key={day} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'capitalize', marginBottom: 8, paddingLeft: 4 }}>
              {day}
            </div>
            {dayCommits.map(c => <CommitCard key={c.sha + c._repoLabel} commit={c} />)}
          </div>
        ))
      )}

      {/* Report Modal */}
      <ReportModal report={reportPreview} authorName={reportAuthor} onClose={() => setReportPreview(null)} />
    </div>
  )
}
