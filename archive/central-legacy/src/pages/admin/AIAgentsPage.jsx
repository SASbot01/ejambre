import { useState, useEffect, useRef } from 'react'

const API = import.meta.env.VITE_API_URL || ''

const EUROPEAN_COUNTRIES = [
  'Espana', 'Portugal', 'Italia', 'Francia', 'Alemania',
  'Reino Unido', 'Paises Bajos', 'Belgica', 'Polonia', 'Turquia',
  'Rumania', 'Republica Checa', 'Austria', 'Suiza', 'Suecia', 'Bulgaria',
]

const SEARCH_PRESETS = [
  { label: 'Fabricas textiles', query: 'fabricas textiles' },
  { label: 'Textile manufacturers', query: 'textile manufacturers' },
  { label: 'Confeccion industrial', query: 'empresas de confeccion industrial' },
  { label: 'Textile mills', query: 'textile mills factory' },
  { label: 'Fabric suppliers', query: 'fabric suppliers wholesale' },
  { label: 'Metalurgia', query: 'metalworking manufacturing' },
  { label: 'Alimentacion', query: 'food processing factories' },
  { label: 'Quimica', query: 'chemical manufacturing companies' },
  { label: 'Plasticos', query: 'plastic manufacturing' },
  { label: 'Madera / Muebles', query: 'furniture wood manufacturing' },
]

const PIPELINE_STEPS = [
  { key: 'search', icon: '🔍', name: 'Busqueda Multi-Fuente', desc: '6 fuentes: OSM + Europages + Kompass + Google + Nominatim + OpenCorp', color: '#FF6B00' },
  { key: 'enrich', icon: '🤖', name: 'AI Enrichment', desc: 'CEO, emails, LinkedIn, sector', color: '#8B5CF6' },
  { key: 'crm', icon: '📋', name: 'CRM Insert', desc: 'Leads con datos completos al CRM', color: '#22C55E' },
  { key: 'deep', icon: '🔬', name: 'Deep Scraping', desc: 'Web + Google: tel, email dueño, CIF', color: '#F59E0B' },
  { key: 'personalize', icon: '✍️', name: 'Email Personalizado', desc: 'Claude genera email a medida por empresa', color: '#3B82F6' },
  { key: 'lists', icon: '📧', name: 'Email Marketing', desc: 'Plantilla + lista segmentada auto', color: '#EC4899' },
  { key: 'research', icon: '📊', name: 'Market Research', desc: 'Analisis mercado + funnel + estrategia', color: '#14B8A6' },
]

const statusLabels = {
  pending: { label: 'Pendiente', color: '#FFB800' },
  idle: { label: 'Listo', color: '#555' },
  running: { label: 'En ejecucion', color: '#22C55E' },
  completed: { label: 'Completado', color: '#3B82F6' },
  failed: { label: 'Error', color: '#EF4444' },
}

const logTypeColors = { info: '#3B82F6', success: '#22C55E', warning: '#FFB800', error: '#EF4444' }

// Detect current pipeline phase from logs
function detectPhase(logs) {
  if (!logs || logs.length === 0) return null
  const lastMsg = [...logs].reverse().find(l => l.msg)?.msg || ''
  if (/market.*research|analisis.*mercado|estrategia/i.test(lastMsg)) return 'research'
  if (/personalizacion completada|listas creadas|plantillas.*creadas/i.test(lastMsg)) return 'lists'
  if (/personalizando|email creado para|plantilla.*lista/i.test(lastMsg)) return 'personalize'
  if (/deep.*scrap|scrapeando web|owner.*encontrad/i.test(lastMsg)) return 'deep'
  if (/scraping completado|insertando.*leads|nuevos.*duplicados/i.test(lastMsg)) return 'crm'
  if (/enriqueciendo|IA complet/i.test(lastMsg)) return 'enrich'
  if (/buscando|empresas encontrad|ronda/i.test(lastMsg)) return 'search'
  return 'search'
}

export default function AIAgentsPage() {
  const [activeTab, setActiveTab] = useState('config')
  const [agentStatus, setAgentStatus] = useState('idle')
  const [pipelinePhase, setPipelinePhase] = useState(null)

  const [searchQuery, setSearchQuery] = useState('fabricas textiles')
  const [customQuery, setCustomQuery] = useState('')
  const [selectedCountries, setSelectedCountries] = useState(['Espana', 'Portugal', 'Italia'])
  const [maxPerCountry, setMaxPerCountry] = useState(10)

  // CRM Pipeline selection
  const [pipelines, setPipelines] = useState([])
  const [selectedPipeline, setSelectedPipeline] = useState('')
  const [loadingPipelines, setLoadingPipelines] = useState(false)

  // Market Research state
  const [mrSector, setMrSector] = useState('textile manufacturing')
  const [mrCountries, setMrCountries] = useState('Spain, Bulgaria, Germany, France, Netherlands')
  const [mrGoal, setMrGoal] = useState('Find and convert textile factories >100k annual revenue with ERP + Cybersecurity services for €10,000')
  const [mrLoading, setMrLoading] = useState(false)
  const [mrReport, setMrReport] = useState(null)

  const [currentRunId, setCurrentRunId] = useState(null)
  const [logs, setLogs] = useState([])
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // TMview bot state
  const [tmviewStep, setTmviewStep] = useState('idle') // idle, urls, paste, processing, done
  const [tmviewUrls, setTmviewUrls] = useState([])
  const [tmviewPaste, setTmviewPaste] = useState('')
  const [tmviewResult, setTmviewResult] = useState(null)
  const [tmviewChat, setTmviewChat] = useState([])

  const logsEndRef = useRef(null)
  const tmviewChatRef = useRef(null)
  const pollRef = useRef(null)

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // Update pipeline phase from logs
  useEffect(() => {
    if (agentStatus === 'running') {
      setPipelinePhase(detectPhase(logs))
    } else if (agentStatus === 'completed') {
      setPipelinePhase('done')
    } else if (agentStatus === 'idle' || agentStatus === 'failed') {
      setPipelinePhase(null)
    }
  }, [logs, agentStatus])

  useEffect(() => { loadHistory(); loadPipelines() }, [])

  const loadPipelines = async () => {
    setLoadingPipelines(true)
    try {
      const resp = await fetch(`${API}/api/agent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list-pipelines', clientSlug: 'black-wolf' }),
      })
      if (resp.ok) {
        const data = await resp.json()
        setPipelines(data.pipelines || [])
        // Pre-select default pipeline
        const def = (data.pipelines || []).find(p => p.is_default)
        if (def) setSelectedPipeline(def.id)
      }
    } catch {}
    setLoadingPipelines(false)
  }

  // Poll for live logs
  useEffect(() => {
    if (agentStatus === 'running' && currentRunId) {
      pollRef.current = setInterval(async () => {
        try {
          const resp = await fetch(`${API}/api/agent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'status', clientSlug: 'black-wolf', config: { runId: currentRunId } }),
          })
          if (!resp.ok) return // silently skip failed polls
          const data = await resp.json()
          if (data.logs) setLogs(data.logs)
          if (data.status === 'completed' || data.status === 'failed') {
            setAgentStatus(data.status)
            if (data.results_summary) setResults(data.results_summary)
            clearInterval(pollRef.current)
            loadHistory()
          }
        } catch { /* ignore poll errors */ }
      }, 2000)
      return () => clearInterval(pollRef.current)
    }
  }, [agentStatus, currentRunId])

  const loadHistory = async () => {
    setLoadingHistory(true)
    try {
      const resp = await fetch(`${API}/api/agent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'history', clientSlug: 'black-wolf' }),
      })
      if (resp.ok) { const data = await resp.json(); setHistory(data.runs || []) }
    } catch {}
    setLoadingHistory(false)
  }

  const executeSearch = async () => {
    if (selectedCountries.length === 0) { setError('Selecciona al menos un pais'); return }
    const finalQuery = customQuery.trim() || searchQuery
    if (!finalQuery) { setError('Introduce un termino de busqueda'); return }
    setAgentStatus('running')
    setError(null)
    setResults(null)
    setLogs([{ time: new Date().toISOString(), type: 'info', msg: `Conectando con el agente prospector... Busqueda: "${finalQuery}"` }])
    setActiveTab('logs')
    setPipelinePhase('search')

    try {
      const resp = await fetch(`${API}/api/agent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search', clientSlug: 'black-wolf', config: { query: finalQuery, countries: selectedCountries, maxPerCountry, pipeline_id: selectedPipeline || undefined } }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Error en el agente')
      if (data.runId) setCurrentRunId(data.runId)
      setResults({ total_found: data.total, created: data.created, duplicates: data.duplicates, errors: data.errors, countries_searched: selectedCountries })
      setLogs(prev => [...prev, { time: new Date().toISOString(), type: 'success', msg: `Completado: ${data.created} leads creados en CRM BlackWolf` }])
      setAgentStatus('completed')
      loadHistory()
    } catch (err) {
      setError(err.message)
      setLogs(prev => [...prev, { time: new Date().toISOString(), type: 'error', msg: err.message }])
      setAgentStatus('failed')
    }
  }

  const executeEnrich = async () => {
    setAgentStatus('running')
    setError(null)
    setPipelinePhase('enrich')
    setLogs([{ time: new Date().toISOString(), type: 'info', msg: 'Buscando CEOs para leads existentes...' }])
    setActiveTab('logs')
    try {
      const resp = await fetch(`${API}/api/agent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enrich', clientSlug: 'black-wolf', config: { limit: 50 } }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Error')
      setLogs(prev => [...prev, { time: new Date().toISOString(), type: 'success', msg: data.message }])
      setAgentStatus('completed')
    } catch (err) {
      setError(err.message)
      setLogs(prev => [...prev, { time: new Date().toISOString(), type: 'error', msg: err.message }])
      setAgentStatus('failed')
    }
  }

  // ── TMview Bot ──
  const addChat = (role, text) => {
    setTmviewChat(prev => [...prev, { role, text, time: new Date().toISOString() }])
    setTimeout(() => tmviewChatRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const startTmview = async () => {
    setActiveTab('tmview')
    setTmviewStep('urls')
    setTmviewChat([])
    setTmviewResult(null)
    setTmviewPaste('')

    addChat('bot', `Hola! Soy tu agente de prospeccion. Voy a ayudarte a encontrar fabricas textiles en los registros oficiales de marcas europeas (TMview/TMDN).`)

    setTimeout(() => {
      addChat('bot', `Necesito que abras estos enlaces en tu navegador. Cada uno busca marcas textiles (clases Niza 24 y 25) en los paises que has seleccionado.`)
    }, 800)

    // Generate URLs
    try {
      const resp = await fetch(`${API}/api/agent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tmview-urls', clientSlug: 'black-wolf', config: { countries: selectedCountries } }),
      })
      const data = await resp.json()
      setTmviewUrls(data.urls || [])

      setTimeout(() => {
        addChat('bot', `He generado ${data.urls?.length || 0} enlaces de busqueda. Abre cada uno, espera a que carguen los resultados, y luego selecciona todo el contenido de la pagina (Ctrl+A) y copialo (Ctrl+C).`)
        addChat('bot', `Cuando tengas los datos copiados, pegalos en el cuadro de abajo y pulsa "Procesar". Yo me encargo de extraer las empresas, encontrar al CEO, su LinkedIn, email, telefono y facturacion estimada.`)
      }, 1500)
    } catch (err) {
      addChat('bot', `Error generando URLs: ${err.message}`)
    }
  }

  const processTmview = async () => {
    if (!tmviewPaste || tmviewPaste.length < 20) {
      addChat('bot', 'Necesito mas texto. Asegurate de copiar toda la pagina de resultados de TMview.')
      return
    }

    setTmviewStep('processing')
    addChat('user', `[Texto pegado: ${tmviewPaste.length} caracteres]`)
    addChat('bot', 'Recibido. Analizando el contenido con IA para extraer empresas titulares de marcas textiles...')

    try {
      const resp = await fetch(`${API}/api/agent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tmview-parse', clientSlug: 'black-wolf', config: { pastedText: tmviewPaste } }),
      })
      const data = await resp.json()

      if (!resp.ok) throw new Error(data.error || 'Error procesando')

      setTmviewResult(data)
      setTmviewStep('done')

      if (data.created > 0) {
        addChat('bot', `Excelente! He extraido ${data.extracted} empresas del texto.`)
        addChat('bot', `${data.created} leads nuevos creados en el CRM de BlackWolf con CEO, LinkedIn, email, telefono y facturacion estimada.${data.duplicates > 0 ? ` (${data.duplicates} ya existian)` : ''}`)
        addChat('bot', `Empresas añadidas:\n${data.companies?.map((c, i) => `  ${i + 1}. ${c}`).join('\n')}`)
        addChat('bot', 'Puedes ver los leads en Consola Central → BlackWolf → CRM. Quieres pegar mas resultados de otro pais?')
      } else if (data.duplicates > 0) {
        addChat('bot', `Encontre ${data.extracted} empresas pero todas ya estaban en el CRM (${data.duplicates} duplicados). Prueba con otro pais.`)
      } else {
        addChat('bot', data.message || 'No se encontraron empresas en el texto. Asegurate de copiar la pagina de resultados completa.')
      }
    } catch (err) {
      addChat('bot', `Error: ${err.message}. Intenta copiar el contenido de nuevo.`)
      setTmviewStep('paste')
    }
  }

  const toggleCountry = (c) => setSelectedCountries(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  const fmtTime = (iso) => { try { return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) } catch { return '' } }
  const fmtDate = (iso) => { try { return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }

  // Pipeline step state
  const getStepState = (stepKey) => {
    if (!pipelinePhase) return 'idle'
    const order = ['search', 'enrich', 'crm', 'deep', 'personalize', 'lists', 'research']
    const currentIdx = order.indexOf(pipelinePhase)
    const stepIdx = order.indexOf(stepKey)
    if (stepIdx < 0 || currentIdx < 0) return 'idle'
    if (stepIdx < currentIdx) return 'completed'
    if (stepIdx === currentIdx) return agentStatus === 'completed' ? 'completed' : 'active'
    return 'pending'
  }

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff', margin: 0 }}>Agente Prospector</h1>
          <p style={{ color: '#888', marginTop: 4, fontSize: '0.9rem' }}>Busqueda multi-fuente en 6 fuentes con IA — scrapea cualquier sector o nicho</p>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: `${(statusLabels[agentStatus]?.color || '#555')}22`, color: statusLabels[agentStatus]?.color || '#555' }}>
          {agentStatus === 'running' && <span className="agent-pulse">●</span>}
          {statusLabels[agentStatus]?.label || agentStatus}
        </div>
      </div>

      {/* Pipeline — lights up based on current phase */}
      <div style={{ background: '#111', border: '1px solid #1F1F1F', borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <p style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Pipeline de Prospeccion</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, flexWrap: 'wrap' }}>
          {PIPELINE_STEPS.map((step, i, arr) => {
            const state = getStepState(step.key)
            const isActive = state === 'active'
            const isCompleted = state === 'completed'
            const isLit = isActive || isCompleted
            const borderColor = isActive ? step.color : isCompleted ? '#22C55E' : '#1F1F1F'
            const bgColor = isActive ? `${step.color}15` : isCompleted ? '#22C55E0A' : '#0A0A0A'

            return (
              <div key={step.key} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  background: bgColor,
                  border: `2px solid ${borderColor}`,
                  borderRadius: 12, padding: '16px 20px', minWidth: 170, textAlign: 'center',
                  opacity: isLit ? 1 : 0.4,
                  transition: 'all 0.4s ease',
                  boxShadow: isActive ? `0 0 24px ${step.color}33` : 'none',
                  position: 'relative',
                }}>
                  {/* Active indicator */}
                  {isActive && (
                    <div style={{
                      position: 'absolute', top: -4, right: -4, width: 12, height: 12,
                      borderRadius: '50%', background: step.color,
                      boxShadow: `0 0 8px ${step.color}`,
                    }} className="agent-pulse" />
                  )}
                  {/* Completed check */}
                  {isCompleted && (
                    <div style={{
                      position: 'absolute', top: -4, right: -4, width: 18, height: 18,
                      borderRadius: '50%', background: '#22C55E', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#000', fontWeight: 700,
                    }}>✓</div>
                  )}
                  <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>{step.icon}</div>
                  <div style={{ color: isLit ? '#fff' : '#666', fontWeight: 600, fontSize: '0.85rem', transition: 'color 0.3s' }}>{step.name}</div>
                  <div style={{ color: isLit ? '#aaa' : '#444', fontSize: '0.7rem', marginTop: 4, transition: 'color 0.3s' }}>{step.desc}</div>
                  {isActive && (
                    <div style={{
                      marginTop: 8, padding: '2px 10px', borderRadius: 20, fontSize: '0.65rem',
                      fontWeight: 600, background: `${step.color}33`, color: step.color, display: 'inline-block',
                    }} className="agent-pulse">
                      Procesando...
                    </div>
                  )}
                </div>
                {i < arr.length - 1 && (
                  <div style={{
                    padding: '0 8px', fontSize: '1.2rem',
                    color: isCompleted ? '#22C55E' : '#333',
                    transition: 'color 0.3s',
                  }}>→</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Main Panel */}
      <div style={{ background: '#111', border: '1px solid #1F1F1F', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #1F1F1F', padding: '0 24px' }}>
          {[
            { key: 'config', label: 'Configuracion' },
            { key: 'tmview', label: 'TMview Bot' },
            { key: 'market', label: 'Market Research' },
            { key: 'logs', label: `Logs en vivo${agentStatus === 'running' ? ' ●' : ''}` },
            { key: 'results', label: 'Resultados' },
            { key: 'history', label: 'Historial' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              background: 'none', border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #FF6B00' : '2px solid transparent',
              color: activeTab === tab.key ? '#fff' : (tab.key === 'logs' && agentStatus === 'running') ? '#22C55E' : '#666',
              padding: '12px 20px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, transition: 'all 0.2s',
            }}>{tab.label}</button>
          ))}
        </div>

        <div style={{ padding: 24 }}>

          {/* CONFIG */}
          {activeTab === 'config' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <h3 style={{ color: '#FF6B00', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Busqueda Multi-Fuente</h3>

                {/* CRM Pipeline selector */}
                <div style={{ marginBottom: 16, background: '#0D0D0D', border: '1px solid #8B5CF6', borderRadius: 10, padding: 16 }}>
                  <label style={{ color: '#8B5CF6', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 8 }}>CRM / Pipeline destino</label>
                  {loadingPipelines ? (
                    <div style={{ color: '#666', fontSize: '0.8rem' }}>Cargando pipelines...</div>
                  ) : pipelines.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {pipelines.map(p => {
                        const sel = selectedPipeline === p.id
                        const stages = typeof p.stages === 'string' ? JSON.parse(p.stages || '[]') : (p.stages || [])
                        return (
                          <button key={p.id} onClick={() => setSelectedPipeline(p.id)} style={{
                            background: sel ? '#8B5CF622' : '#111', border: `1px solid ${sel ? '#8B5CF6' : '#333'}`,
                            borderRadius: 8, color: sel ? '#C4B5FD' : '#888', padding: '8px 14px',
                            cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, transition: 'all 0.15s',
                            textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2,
                          }}>
                            <span style={{ fontWeight: 600 }}>{sel ? '✓ ' : ''}{p.name}{p.is_default ? ' (default)' : ''}</span>
                            <span style={{ fontSize: '0.65rem', color: sel ? '#8B5CF680' : '#555' }}>{stages.length} etapas</span>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div style={{ color: '#666', fontSize: '0.8rem' }}>No hay pipelines. Se usara el pipeline por defecto (Leads Scrap).</div>
                  )}
                </div>

                {/* Search query — presets + custom */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ color: '#888', fontSize: '0.75rem', display: 'block', marginBottom: 6 }}>Busqueda rapida (presets)</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {SEARCH_PRESETS.map(p => (
                      <button key={p.query} onClick={() => { setSearchQuery(p.query); setCustomQuery('') }} style={{ background: searchQuery === p.query && !customQuery ? '#FF6B0022' : '#1a1a1a', border: `1px solid ${searchQuery === p.query && !customQuery ? '#FF6B00' : '#333'}`, borderRadius: 6, color: searchQuery === p.query && !customQuery ? '#FF6B00' : '#888', padding: '4px 10px', cursor: 'pointer', fontSize: '0.7rem' }}>{p.label}</button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ color: '#FF6B00', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: 6 }}>Busqueda personalizada (escribe lo que quieras scrapear)</label>
                  <input
                    value={customQuery}
                    onChange={e => setCustomQuery(e.target.value)}
                    style={{ width: '100%', background: '#0D0D0D', border: `1px solid ${customQuery ? '#FF6B00' : '#1F1F1F'}`, borderRadius: 8, color: '#fff', padding: '10px 12px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                    placeholder="ej: clinicas dentales, restaurantes, empresas de logistica, software companies..."
                  />
                  {customQuery && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF6B00' }} />
                      <span style={{ color: '#FF6B00', fontSize: '0.75rem', fontWeight: 500 }}>Buscara: "{customQuery}" (ignora presets)</span>
                      <button onClick={() => setCustomQuery('')} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.7rem', textDecoration: 'underline' }}>Limpiar</button>
                    </div>
                  )}
                  {!customQuery && (
                    <div style={{ color: '#555', fontSize: '0.7rem', marginTop: 4 }}>Dejalo vacio para usar el preset seleccionado: "{searchQuery}"</div>
                  )}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ color: '#888', fontSize: '0.75rem', display: 'block', marginBottom: 6 }}>Max resultados por pais</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[5, 10, 20, 40].map(n => (
                      <button key={n} onClick={() => setMaxPerCountry(n)} style={{ background: maxPerCountry === n ? '#FF6B0022' : '#1a1a1a', border: `1px solid ${maxPerCountry === n ? '#FF6B00' : '#333'}`, borderRadius: 6, color: maxPerCountry === n ? '#FF6B00' : '#888', padding: '6px 14px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>{n}</button>
                    ))}
                  </div>
                </div>
                {/* Sources info */}
                <div style={{ background: '#0D0D0D', border: '1px solid #1F1F1F', borderRadius: 8, padding: 16, marginTop: 12 }}>
                  <div style={{ color: '#888', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: 10 }}>Fuentes de datos (6 fuentes)</div>
                  {[
                    { name: 'OpenCorporates', desc: 'Registros mercantiles oficiales', color: '#EF4444' },
                    { name: 'Europages', desc: 'Directorio B2B europeo', color: '#3B82F6' },
                    { name: 'OpenStreetMap', desc: 'Tags industriales y comerciales', color: '#22C55E' },
                    { name: 'Kompass', desc: 'Directorio global de empresas', color: '#A855F7' },
                    { name: 'Google Web', desc: 'Busqueda web + extraccion', color: '#F59E0B' },
                    { name: 'Nominatim', desc: 'Busqueda geografica (fallback)', color: '#6B7280' },
                  ].map(s => (
                    <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
                      <span style={{ color: '#ddd', fontSize: '0.8rem', fontWeight: 500 }}>{s.name}</span>
                      <span style={{ color: '#666', fontSize: '0.7rem' }}>— {s.desc}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: '#0D0D0D', border: '1px solid #1F1F1F', borderRadius: 8, padding: 16, marginTop: 12 }}>
                  <div style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: 8 }}>Estimacion</div>
                  <div style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700 }}>~{selectedCountries.length * maxPerCountry} leads</div>
                  <div style={{ color: '#666', fontSize: '0.8rem', marginTop: 4 }}>{selectedCountries.length} paises x {maxPerCountry} por pais</div>
                </div>
              </div>
              <div>
                <h3 style={{ color: '#8B5CF6', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Paises objetivo</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {EUROPEAN_COUNTRIES.map(country => {
                    const sel = selectedCountries.includes(country)
                    return <button key={country} onClick={() => toggleCountry(country)} style={{ background: sel ? '#8B5CF622' : '#0D0D0D', border: `1px solid ${sel ? '#8B5CF6' : '#1F1F1F'}`, borderRadius: 8, color: sel ? '#C4B5FD' : '#666', padding: '8px 14px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, transition: 'all 0.15s' }}>{sel && '✓ '}{country}</button>
                  })}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={() => setSelectedCountries([...EUROPEAN_COUNTRIES])} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#888', padding: '4px 10px', cursor: 'pointer', fontSize: '0.7rem' }}>Todos</button>
                  <button onClick={() => setSelectedCountries([])} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#888', padding: '4px 10px', cursor: 'pointer', fontSize: '0.7rem' }}>Limpiar</button>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                  <button onClick={executeSearch} disabled={agentStatus === 'running'} style={{ flex: 1, background: agentStatus === 'running' ? '#333' : 'linear-gradient(135deg, #FF6B00, #FFB800)', border: 'none', borderRadius: 10, color: agentStatus === 'running' ? '#666' : '#000', fontWeight: 700, padding: '14px 24px', cursor: agentStatus === 'running' ? 'not-allowed' : 'pointer', fontSize: '0.95rem' }}>
                    {agentStatus === 'running' ? '⏳ Ejecutando...' : '🔍 Buscar Leads'}
                  </button>
                  <button onClick={executeEnrich} disabled={agentStatus === 'running'} style={{ background: agentStatus === 'running' ? '#333' : '#8B5CF622', border: `1px solid ${agentStatus === 'running' ? '#333' : '#8B5CF6'}`, borderRadius: 10, color: agentStatus === 'running' ? '#666' : '#C4B5FD', fontWeight: 600, padding: '14px 20px', cursor: agentStatus === 'running' ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}>
                    🤖 Re-enriquecer
                  </button>
                </div>
                {error && <div style={{ background: '#EF444422', border: '1px solid #EF4444', borderRadius: 8, padding: 12, marginTop: 12, color: '#FCA5A5', fontSize: '0.85rem' }}>{error}</div>}
              </div>
            </div>
          )}

          {/* TMVIEW BOT */}
          {activeTab === 'tmview' && (
            <div>
              {/* Chat area */}
              <div style={{ background: '#0A0A0A', borderRadius: 10, padding: 20, marginBottom: 16, maxHeight: 400, overflowY: 'auto' }}>
                {tmviewChat.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40 }}>
                    <div style={{ fontSize: '2rem', marginBottom: 12 }}>🤖</div>
                    <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: 16 }}>Asistente de prospeccion TMview</p>
                    <p style={{ color: '#666', fontSize: '0.8rem', marginBottom: 20 }}>Busca titulares de marcas textiles en el registro oficial europeo de marcas (TMDN). El bot te guia paso a paso.</p>
                    <button onClick={startTmview} style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, padding: '12px 28px', cursor: 'pointer', fontSize: '0.9rem' }}>
                      Iniciar busqueda en TMview
                    </button>
                  </div>
                ) : (
                  <>
                    {tmviewChat.map((msg, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        {msg.role === 'bot' && <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#8B5CF622', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', flexShrink: 0 }}>🤖</div>}
                        <div style={{
                          background: msg.role === 'user' ? '#6366F133' : '#1a1a1a',
                          border: `1px solid ${msg.role === 'user' ? '#6366F1' : '#1F1F1F'}`,
                          borderRadius: 10, padding: '10px 14px', maxWidth: '80%',
                          color: '#ddd', fontSize: '0.85rem', whiteSpace: 'pre-wrap', lineHeight: 1.5,
                        }}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    <div ref={tmviewChatRef} />
                  </>
                )}
              </div>

              {/* TMview URLs */}
              {tmviewUrls.length > 0 && tmviewStep !== 'done' && (
                <div style={{ background: '#1a1a1a', border: '1px solid #1F1F1F', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                  <div style={{ color: '#8B5CF6', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, marginBottom: 12 }}>
                    Enlaces TMview — abre cada uno y copia los resultados
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {tmviewUrls.map((u, i) => (
                      <a key={i} href={u.url} target="_blank" rel="noopener noreferrer" style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                        background: '#0D0D0D', border: '1px solid #333', borderRadius: 8,
                        color: '#C4B5FD', textDecoration: 'none', fontSize: '0.8rem',
                        transition: 'border-color 0.2s',
                      }}>
                        <span style={{ fontSize: '1rem' }}>🔗</span>
                        <span style={{ fontWeight: 600 }}>{u.country}</span>
                        <span style={{ color: '#666', flex: 1 }}>— {u.instructions}</span>
                        <span style={{ color: '#8B5CF6', fontSize: '0.7rem' }}>Abrir ↗</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Paste area */}
              {(tmviewStep === 'urls' || tmviewStep === 'paste' || tmviewStep === 'done') && tmviewChat.length > 0 && (
                <div style={{ background: '#1a1a1a', border: '1px solid #1F1F1F', borderRadius: 10, padding: 16 }}>
                  <div style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>
                    Pega aqui el contenido de TMview
                  </div>
                  <textarea
                    value={tmviewPaste}
                    onChange={e => setTmviewPaste(e.target.value)}
                    placeholder="Selecciona todo el contenido de la pagina de resultados de TMview (Ctrl+A) y pegalo aqui (Ctrl+V)..."
                    style={{
                      width: '100%', height: 120, background: '#0D0D0D', border: '1px solid #333',
                      borderRadius: 8, color: '#ccc', padding: 12, fontSize: '0.8rem',
                      fontFamily: 'monospace', resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                    <span style={{ color: '#555', fontSize: '0.75rem' }}>
                      {tmviewPaste.length > 0 ? `${tmviewPaste.length} caracteres` : 'Esperando contenido...'}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {tmviewStep === 'done' && (
                        <button onClick={() => { setTmviewPaste(''); setTmviewStep('paste') }} style={{
                          background: '#1a1a1a', border: '1px solid #333', borderRadius: 8,
                          color: '#888', padding: '8px 16px', cursor: 'pointer', fontSize: '0.8rem',
                        }}>Pegar mas datos</button>
                      )}
                      <button
                        onClick={processTmview}
                        disabled={tmviewStep === 'processing' || tmviewPaste.length < 20}
                        style={{
                          background: tmviewStep === 'processing' ? '#333' : 'linear-gradient(135deg, #8B5CF6, #6366F1)',
                          border: 'none', borderRadius: 8, color: tmviewStep === 'processing' ? '#666' : '#fff',
                          fontWeight: 600, padding: '8px 20px', cursor: tmviewStep === 'processing' ? 'not-allowed' : 'pointer',
                          fontSize: '0.85rem',
                        }}
                      >
                        {tmviewStep === 'processing' ? '⏳ Analizando...' : '🤖 Procesar con IA'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TMview results */}
              {tmviewResult && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}>
                  {[
                    { label: 'Empresas extraidas', value: tmviewResult.extracted, color: '#8B5CF6' },
                    { label: 'Leads creados', value: tmviewResult.created, color: '#22C55E' },
                    { label: 'Duplicados', value: tmviewResult.duplicates, color: '#FFB800' },
                  ].map(c => (
                    <div key={c.label} style={{ background: '#0D0D0D', border: '1px solid #1F1F1F', borderRadius: 10, padding: 16, textAlign: 'center' }}>
                      <div style={{ color: c.color, fontSize: '1.6rem', fontWeight: 700 }}>{c.value}</div>
                      <div style={{ color: '#666', fontSize: '0.7rem', marginTop: 4 }}>{c.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* MARKET RESEARCH */}
          {activeTab === 'market' && (
              <div>
                <h3 style={{ color: '#FF6B00', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Investigacion de Mercado + Estrategia de Ventas</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ color: '#888', fontSize: '0.75rem', display: 'block', marginBottom: 6 }}>Sector objetivo</label>
                    <input value={mrSector} onChange={e => setMrSector(e.target.value)} style={{ width: '100%', padding: '10px 14px', background: '#0A0A0A', border: '1px solid #222', borderRadius: 8, color: '#fff', fontSize: 14 }} />
                  </div>
                  <div>
                    <label style={{ color: '#888', fontSize: '0.75rem', display: 'block', marginBottom: 6 }}>Paises (separados por coma)</label>
                    <input value={mrCountries} onChange={e => setMrCountries(e.target.value)} style={{ width: '100%', padding: '10px 14px', background: '#0A0A0A', border: '1px solid #222', borderRadius: 8, color: '#fff', fontSize: 14 }} />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={{ color: '#888', fontSize: '0.75rem', display: 'block', marginBottom: 6 }}>Objetivo</label>
                    <textarea value={mrGoal} onChange={e => setMrGoal(e.target.value)} rows={2} style={{ width: '100%', padding: '10px 14px', background: '#0A0A0A', border: '1px solid #222', borderRadius: 8, color: '#fff', fontSize: 14, resize: 'vertical' }} />
                  </div>
                </div>
                <button onClick={async () => {
                  setMrLoading(true); setMrReport(null)
                  try {
                    const r = await fetch(`${API}/api/agent`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'market-research', clientSlug: selectedClient, sector: mrSector, countries: mrCountries.split(',').map(c => c.trim()), goal: mrGoal }) })
                    const data = await r.json()
                    if (r.ok) setMrReport(data.report); else alert('Error: ' + (data.error || 'Unknown'))
                  } catch (e) { alert('Error: ' + e.message) }
                  setMrLoading(false)
                }} disabled={mrLoading} style={{ padding: '12px 24px', borderRadius: 8, border: 'none', background: mrLoading ? '#333' : '#FF6B00', color: '#fff', cursor: mrLoading ? 'wait' : 'pointer', fontSize: 14, fontWeight: 700, marginBottom: 20 }}>
                  {mrLoading ? '🔍 Analizando mercado... (puede tardar 30-60s)' : '🚀 Lanzar Investigacion de Mercado'}
                </button>

                {mrReport && (
                  <div style={{ display: 'grid', gap: 16 }}>
                    {/* Market Overview */}
                    {mrReport.marketOverview && (
                      <div style={{ background: '#0A0A0A', border: '1px solid #222', borderRadius: 10, padding: 20 }}>
                        <h4 style={{ color: '#FF6B00', margin: '0 0 12px', fontSize: 14 }}>📊 Vision del Mercado</h4>
                        <div style={{ fontSize: 13, color: '#ccc', lineHeight: 1.8 }}>
                          <div><strong>Tamaño:</strong> {mrReport.marketOverview.marketSize}</div>
                          <div><strong>Crecimiento:</strong> {mrReport.marketOverview.growthRate}</div>
                          <div style={{ marginTop: 8 }}><strong>Tendencias:</strong></div>
                          <ul style={{ margin: '4px 0', paddingLeft: 20 }}>{(mrReport.marketOverview.keyTrends || []).map((t, i) => <li key={i}>{t}</li>)}</ul>
                        </div>
                      </div>
                    )}

                    {/* Prospecting Strategy */}
                    {mrReport.prospectingStrategy && (
                      <div style={{ background: '#0A0A0A', border: '1px solid #222', borderRadius: 10, padding: 20 }}>
                        <h4 style={{ color: '#22C55E', margin: '0 0 12px', fontSize: 14 }}>🎯 Estrategia de Prospeccion</h4>
                        <div style={{ fontSize: 13, color: '#ccc', lineHeight: 1.8 }}>
                          {mrReport.prospectingStrategy.idealCustomerProfile && (
                            <div style={{ marginBottom: 12 }}>
                              <strong>Cliente ideal:</strong> {mrReport.prospectingStrategy.idealCustomerProfile.revenue} facturacion, {mrReport.prospectingStrategy.idealCustomerProfile.employees} empleados
                              <div style={{ marginTop: 4 }}><strong>Pain points:</strong></div>
                              <ul style={{ margin: '4px 0', paddingLeft: 20 }}>{(mrReport.prospectingStrategy.idealCustomerProfile.painPoints || []).map((p, i) => <li key={i}>{p}</li>)}</ul>
                            </div>
                          )}
                          {mrReport.prospectingStrategy.bestCountries && (
                            <div><strong>Mejores paises:</strong>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                                {mrReport.prospectingStrategy.bestCountries.map((c, i) => (
                                  <span key={i} style={{ padding: '6px 12px', borderRadius: 8, background: '#1a1a1a', border: '1px solid #333', fontSize: 12 }}>
                                    <strong style={{ color: '#FF6B00' }}>{c.country}</strong> — {c.reason} (~{c.estimatedLeads} leads)
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {mrReport.prospectingStrategy.followUpSequence && (
                            <div style={{ marginTop: 12 }}><strong>Secuencia follow-up:</strong>
                              <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
                                {mrReport.prospectingStrategy.followUpSequence.map((f, i) => (
                                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', background: '#111', borderRadius: 6, fontSize: 12 }}>
                                    <span style={{ color: '#FF6B00', fontWeight: 700, minWidth: 50 }}>Dia {f.day}</span>
                                    <span style={{ color: '#888' }}>{f.channel}</span>
                                    <span style={{ color: '#ccc' }}>{f.action}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Email Strategy */}
                    {mrReport.emailStrategy && (
                      <div style={{ background: '#0A0A0A', border: '1px solid #222', borderRadius: 10, padding: 20 }}>
                        <h4 style={{ color: '#3B82F6', margin: '0 0 12px', fontSize: 14 }}>📧 Estrategia de Emails</h4>
                        <div style={{ fontSize: 13, color: '#ccc', lineHeight: 1.8 }}>
                          <div><strong>Mejor hora de envio:</strong> {mrReport.emailStrategy.bestSendTimes}</div>
                          {mrReport.emailStrategy.sequenceRecommendation && (
                            <div style={{ marginTop: 12 }}><strong>Secuencia de emails recomendada:</strong>
                              {mrReport.emailStrategy.sequenceRecommendation.map((e, i) => (
                                <div key={i} style={{ padding: '8px 12px', background: '#111', borderRadius: 6, marginTop: 6, display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <span style={{ color: '#FF6B00', fontWeight: 700, fontSize: 16 }}>#{e.email}</span>
                                  <div>
                                    <div style={{ fontWeight: 600, color: '#fff', fontSize: 12 }}>{e.subject}</div>
                                    <div style={{ fontSize: 11, color: '#888' }}>Angulo: {e.angle} · Esperar {e.waitDays} dias</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {mrReport.emailStrategy.optimalSubjectLines && (
                            <div style={{ marginTop: 12 }}><strong>Subject lines con mejor apertura:</strong>
                              <ul style={{ margin: '4px 0', paddingLeft: 20 }}>{mrReport.emailStrategy.optimalSubjectLines.map((s, i) => <li key={i} style={{ color: '#22C55E' }}>{s}</li>)}</ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Sales Funnel */}
                    {mrReport.salesFunnel && (
                      <div style={{ background: '#0A0A0A', border: '1px solid #222', borderRadius: 10, padding: 20 }}>
                        <h4 style={{ color: '#F59E0B', margin: '0 0 12px', fontSize: 14 }}>🏆 Funnel de Ventas</h4>
                        <div style={{ fontSize: 13, color: '#ccc' }}>
                          {mrReport.salesFunnel.stages && mrReport.salesFunnel.stages.map((s, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #1a1a1a' }}>
                              <span style={{ fontSize: 20 }}>{['🎯', '📧', '📞', '🤝', '💰', '🏆'][i] || '📌'}</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, color: '#fff' }}>{s.name}</div>
                                <div style={{ fontSize: 11, color: '#888' }}>{(s.actions || []).join(' → ')}</div>
                              </div>
                              <span style={{ color: '#FF6B00', fontWeight: 700 }}>{s.conversionRate}</span>
                            </div>
                          ))}
                          {mrReport.salesFunnel.monthlyTargets && (
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
                              {Object.entries(mrReport.salesFunnel.monthlyTargets).map(([k, v]) => (
                                <div key={k} style={{ padding: '8px 16px', background: '#111', borderRadius: 8, textAlign: 'center' }}>
                                  <div style={{ fontSize: 18, fontWeight: 700, color: '#FF6B00' }}>{v}</div>
                                  <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>{k}/mes</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Plan */}
                    {mrReport.actionPlan && (
                      <div style={{ background: '#0A0A0A', border: '1px solid #222', borderRadius: 10, padding: 20 }}>
                        <h4 style={{ color: '#EC4899', margin: '0 0 12px', fontSize: 14 }}>📋 Plan de Accion (4 semanas)</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          {mrReport.actionPlan.map((w, i) => (
                            <div key={i} style={{ padding: 16, background: '#111', borderRadius: 8, border: '1px solid #222' }}>
                              <div style={{ fontWeight: 700, color: '#FF6B00', marginBottom: 8 }}>Semana {w.week}</div>
                              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#ccc', lineHeight: 1.8 }}>
                                {(w.actions || []).map((a, j) => <li key={j}>{a}</li>)}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ fontSize: 12, color: '#666', textAlign: 'center', padding: 8 }}>
                      Las plantillas de email recomendadas y las listas por pais se han creado automaticamente en Email Marketing.
                    </div>
                  </div>
                )}
              </div>
          )}

          {/* LOGS — live feed */}
          {activeTab === 'logs' && (
            logs.length === 0
              ? <div style={{ color: '#555', textAlign: 'center', padding: 40, fontSize: '0.9rem' }}>No hay logs. Ejecuta una busqueda para ver actividad en tiempo real.</div>
              : <div style={{ background: '#0A0A0A', borderRadius: 8, padding: 16, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '0.78rem', maxHeight: 500, overflowY: 'auto' }}>
                  {logs.map((log, i) => (
                    <div key={i} style={{ padding: '5px 0', display: 'flex', gap: 12, borderLeft: `2px solid ${logTypeColors[log.type] || '#333'}`, paddingLeft: 12, marginBottom: 2 }}>
                      <span style={{ color: '#555', minWidth: 65, flexShrink: 0 }}>{fmtTime(log.time)}</span>
                      <span style={{ color: logTypeColors[log.type] || '#888', fontWeight: 700, minWidth: 55, textTransform: 'uppercase', fontSize: '0.65rem', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        {log.type === 'success' ? '✓' : log.type === 'error' ? '✗' : log.type === 'warning' ? '!' : '›'} {log.type}
                      </span>
                      <span style={{ color: log.type === 'error' ? '#FCA5A5' : log.type === 'success' ? '#86EFAC' : '#ccc' }}>{log.msg}</span>
                    </div>
                  ))}
                  {agentStatus === 'running' && (
                    <div style={{ padding: '8px 0 4px 14px', color: '#FF6B00' }} className="agent-pulse">▌ Procesando...</div>
                  )}
                  <div ref={logsEndRef} />
                </div>
          )}

          {/* RESULTS */}
          {activeTab === 'results' && (
            !results
              ? <div style={{ color: '#555', textAlign: 'center', padding: 40, fontSize: '0.9rem' }}>Ejecuta una busqueda primero.</div>
              : <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                    {[
                      { label: 'Total encontrados', value: results.total_found, color: '#FF6B00' },
                      { label: 'Leads creados', value: results.created, color: '#22C55E' },
                      { label: 'Duplicados', value: results.duplicates, color: '#FFB800' },
                      { label: 'Errores', value: results.errors, color: '#EF4444' },
                    ].map(c => (
                      <div key={c.label} style={{ background: '#0D0D0D', border: '1px solid #1F1F1F', borderRadius: 10, padding: 20, textAlign: 'center' }}>
                        <div style={{ color: c.color, fontSize: '2rem', fontWeight: 700 }}>{c.value}</div>
                        <div style={{ color: '#666', fontSize: '0.75rem', marginTop: 4 }}>{c.label}</div>
                      </div>
                    ))}
                  </div>
                  {results.countries_searched && (
                    <div style={{ background: '#0D0D0D', border: '1px solid #1F1F1F', borderRadius: 8, padding: 16 }}>
                      <div style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: 8 }}>Paises buscados</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {results.countries_searched.map(c => <span key={c} style={{ background: '#22C55E22', color: '#22C55E', padding: '4px 10px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 500 }}>{c}</span>)}
                      </div>
                    </div>
                  )}
                  <div style={{ background: '#22C55E11', border: '1px solid #22C55E33', borderRadius: 8, padding: 16, marginTop: 16, color: '#86EFAC', fontSize: '0.85rem' }}>
                    Leads insertados en CRM BlackWolf con email, telefono, web, pais y LinkedIn en sus campos correspondientes. Ve a Consola Central → BlackWolf → CRM para verlos.
                  </div>
                </div>
          )}

          {/* HISTORY */}
          {activeTab === 'history' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button onClick={loadHistory} disabled={loadingHistory} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#888', padding: '6px 14px', cursor: 'pointer', fontSize: '0.8rem' }}>{loadingHistory ? 'Cargando...' : '↻ Actualizar'}</button>
              </div>
              {history.length === 0
                ? <div style={{ color: '#555', textAlign: 'center', padding: 40, fontSize: '0.9rem' }}>{loadingHistory ? 'Cargando...' : 'Sin ejecuciones.'}</div>
                : <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #1F1F1F' }}>
                        {['ID', 'Fecha', 'Encontrados', 'Creados', 'Duplicados', 'Estado'].map(h => (
                          <th key={h} style={{ color: '#666', fontSize: '0.7rem', textTransform: 'uppercase', padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(run => {
                        const s = run.results_summary || {}
                        return (
                          <tr key={run.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                            <td style={{ padding: '10px 12px', color: '#aaa', fontSize: '0.8rem', fontFamily: 'monospace' }}>{run.id?.slice(0, 8)}</td>
                            <td style={{ padding: '10px 12px', color: '#ddd', fontSize: '0.85rem' }}>{fmtDate(run.created_at)}</td>
                            <td style={{ padding: '10px 12px', color: '#FF6B00', fontSize: '0.85rem', fontWeight: 600 }}>{s.total_found ?? '—'}</td>
                            <td style={{ padding: '10px 12px', color: '#22C55E', fontSize: '0.85rem', fontWeight: 600 }}>{s.created ?? '—'}</td>
                            <td style={{ padding: '10px 12px', color: '#FFB800', fontSize: '0.85rem' }}>{s.duplicates ?? '—'}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 600, background: `${statusLabels[run.status]?.color || '#555'}22`, color: statusLabels[run.status]?.color || '#555' }}>{statusLabels[run.status]?.label || run.status}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
              }
            </div>
          )}

        </div>
      </div>

      <style>{`
        @keyframes agentPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .agent-pulse {
          animation: agentPulse 1.2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
