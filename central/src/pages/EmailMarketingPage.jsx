import { useState, useMemo } from 'react'
import { useClientData } from '../hooks/useClientData'
import { useAsync } from '../hooks/useAsync'
import { Mail, Users, FileText, Send, Plus, Trash2, Edit3, Eye, ChevronRight, BarChart3, Search, Tag, X, Copy, ArrowLeft, Settings, Check, AlertCircle, Loader, Clock, Play, Pause } from 'lucide-react'

const TABS = [
  { id: 'campaigns', label: 'Campanas', icon: Send },
  { id: 'sequences', label: 'Secuencias', icon: Clock },
  { id: 'templates', label: 'Plantillas', icon: FileText },
]

const STATUS_COLORS = {
  draft: { bg: 'rgba(255,255,255,0.08)', color: '#999' },
  scheduled: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  sending: { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24' },
  sent: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
  subscribed: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
  unsubscribed: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
  bounced: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
  active: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
  paused: { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24' },
  completed: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
}

function Badge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.draft
  return <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>{status}</span>
}

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, flex: 1, minWidth: 180 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Icon size={16} style={{ color: 'var(--orange)' }} />
        <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ---- EMAIL EDITOR ----
function EmailEditor({ html, onChange }) {
  const [mode, setMode] = useState('visual')
  const [showBlocks, setShowBlocks] = useState(false)

  const insertBlock = (type) => {
    const blocks = {
      heading: '<h1 style="color:#333;font-family:Arial,sans-serif;margin:0 0 16px">Tu titulo aqui</h1>',
      text: '<p style="color:#555;font-family:Arial,sans-serif;font-size:16px;line-height:1.6;margin:0 0 16px">Tu texto aqui...</p>',
      button: '<table cellpadding="0" cellspacing="0" style="margin:20px 0"><tr><td style="background:var(--orange,#FF6B00);border-radius:8px;padding:14px 32px"><a href="#" style="color:#fff;text-decoration:none;font-weight:bold;font-size:16px">Click Aqui</a></td></tr></table>',
      image: '<img src="https://via.placeholder.com/600x300" alt="Image" style="max-width:100%;height:auto;border-radius:8px;margin:16px 0" />',
      divider: '<hr style="border:none;border-top:1px solid #eee;margin:24px 0" />',
      spacer: '<div style="height:32px"></div>',
      columns: '<table width="100%" cellpadding="0" cellspacing="0"><tr><td width="50%" style="padding-right:12px;vertical-align:top"><p style="color:#555;font-family:Arial,sans-serif">Columna 1</p></td><td width="50%" style="padding-left:12px;vertical-align:top"><p style="color:#555;font-family:Arial,sans-serif">Columna 2</p></td></tr></table>',
      social: '<table cellpadding="0" cellspacing="0" style="margin:16px 0"><tr><td style="padding:0 8px"><a href="#" style="color:#555;text-decoration:none">Instagram</a></td><td style="padding:0 8px"><a href="#" style="color:#555;text-decoration:none">Twitter</a></td><td style="padding:0 8px"><a href="#" style="color:#555;text-decoration:none">LinkedIn</a></td></tr></table>',
      footer: '<p style="color:#999;font-family:Arial,sans-serif;font-size:12px;text-align:center;margin:32px 0 0">Has recibido este email porque estas suscrito. <a href="#" style="color:#999">Cancelar suscripcion</a></p>',
    }
    onChange(html + '\n' + (blocks[type] || ''))
    setShowBlocks(false)
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => setMode('visual')} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: mode === 'visual' ? 'var(--orange)' : 'transparent', color: mode === 'visual' ? '#fff' : 'var(--text-secondary)' }}>Visual</button>
        <button onClick={() => setMode('html')} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: mode === 'html' ? 'var(--orange)' : 'transparent', color: mode === 'html' ? '#fff' : 'var(--text-secondary)' }}>HTML</button>
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowBlocks(!showBlocks)} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, background: 'transparent', color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Plus size={12} /> Bloque
          </button>
          {showBlocks && (
            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 4, zIndex: 100, minWidth: 160, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
              {['heading', 'text', 'button', 'image', 'divider', 'spacer', 'columns', 'social', 'footer'].map(b => (
                <button key={b} onClick={() => insertBlock(b)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 13, borderRadius: 4 }}
                  onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => e.target.style.background = 'transparent'}>
                  {b.charAt(0).toUpperCase() + b.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {mode === 'html' ? (
        <textarea value={html} onChange={e => onChange(e.target.value)}
          style={{ width: '100%', minHeight: 400, padding: 16, background: 'var(--bg)', color: 'var(--text)', border: 'none', fontFamily: 'monospace', fontSize: 13, resize: 'vertical' }} />
      ) : (
        <div style={{ minHeight: 400, padding: 24, background: '#fff', color: '#333' }}>
          <div dangerouslySetInnerHTML={{ __html: html || '<p style="color:#ccc;text-align:center;padding:60px">Haz click en "+ Bloque" para empezar a disenar tu email</p>' }} />
        </div>
      )}
    </div>
  )
}

// ---- CAMPAIGN FORM ----
function CampaignForm({ campaign, lists, templates, pipelines, crmContacts, onSave, onCancel }) {
  const [form, setForm] = useState(campaign || { name: '', subject: '', fromName: '', fromEmail: '', replyTo: '', listId: '', templateId: '', htmlContent: '', status: 'draft', recipientFilter: 'all', recipientIds: [], pipelineId: '' })
  const [activeSection, setActiveSection] = useState('details')
  const [recipientFilter, setRecipientFilter] = useState(campaign?.recipientFilter || 'all')
  const [selectedRecipients, setSelectedRecipients] = useState(new Set(campaign?.recipientIds || []))
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const allContactsWithEmail = (crmContacts || []).filter(c => c.email)

  // Filter by pipeline if selected
  const contactsWithEmail = useMemo(() => {
    if (!form.pipelineId) return allContactsWithEmail
    return allContactsWithEmail.filter(c => c.pipelineId === form.pipelineId)
  }, [allContactsWithEmail, form.pipelineId])

  const CRM_STATUSES = ['lead', 'contacted', 'qualified', 'proposal', 'negotiation', 'won']

  const filteredRecipients = recipientFilter === 'all'
    ? contactsWithEmail
    : contactsWithEmail.filter(c => c.status === recipientFilter)

  const toggleRecipient = (id) => {
    setSelectedRecipients(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAllFiltered = () => {
    const ids = filteredRecipients.map(c => c.id)
    setSelectedRecipients(new Set(ids))
  }

  const handleSave = () => {
    onSave({ ...form, recipientFilter, recipientIds: [...selectedRecipients] })
  }

  const selectedTemplate = templates.find(t => t.id === form.templateId)

  const applyTemplate = (tplId) => {
    const tpl = templates.find(t => t.id === tplId)
    if (tpl) {
      set('templateId', tplId)
      set('subject', tpl.subject || form.subject)
      set('htmlContent', tpl.htmlContent || '')
    }
  }

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {['details', 'content', 'preview'].map(s => (
          <button key={s} onClick={() => setActiveSection(s)}
            style={{ flex: 1, padding: '14px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: activeSection === s ? 'rgba(255,107,0,0.1)' : 'transparent', color: activeSection === s ? 'var(--orange)' : 'var(--text-secondary)', borderBottom: activeSection === s ? '2px solid var(--orange)' : '2px solid transparent' }}>
            {s === 'details' ? 'Detalles' : s === 'content' ? 'Contenido' : 'Preview'}
          </button>
        ))}
      </div>

      <div style={{ padding: 24 }}>
        {activeSection === 'details' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Nombre de campana</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej: Newsletter Marzo 2026" style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Asunto</label>
              <input value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Asunto del email..." style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Nombre remitente</label>
              <input value={form.fromName} onChange={e => set('fromName', e.target.value)} placeholder="Tu nombre o empresa" style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Email remitente</label>
              <input value={form.fromEmail} onChange={e => set('fromEmail', e.target.value)} placeholder="noreply@tuempresa.com" style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} />
            </div>
            {/* Pipeline selector */}
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Pipeline</label>
              <select value={form.pipelineId || ''} onChange={e => set('pipelineId', e.target.value)} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }}>
                <option value="">Todos los contactos</option>
                {(pipelines || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Destinatarios (desde CRM){form.pipelineId ? ' — filtrado por pipeline' : ''}</label>
              {/* Status filter */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                <button onClick={() => setRecipientFilter('all')} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: recipientFilter === 'all' ? 'var(--orange)' : 'var(--bg)', color: recipientFilter === 'all' ? '#fff' : 'var(--text-secondary)', border: `1px solid ${recipientFilter === 'all' ? 'var(--orange)' : 'var(--border)'}` }}>
                  Todos ({contactsWithEmail.length})
                </button>
                {CRM_STATUSES.map(st => {
                  const count = contactsWithEmail.filter(c => c.status === st).length
                  if (count === 0) return null
                  return (
                    <button key={st} onClick={() => setRecipientFilter(st)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: recipientFilter === st ? 'var(--orange)' : 'var(--bg)', color: recipientFilter === st ? '#fff' : 'var(--text-secondary)', border: `1px solid ${recipientFilter === st ? 'var(--orange)' : 'var(--border)'}`, textTransform: 'capitalize' }}>
                      {st} ({count})
                    </button>
                  )
                })}
              </div>
              {/* Contact list */}
              <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }}>
                <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{selectedRecipients.size} seleccionados</span>
                  <button onClick={selectAllFiltered} style={{ fontSize: 11, color: 'var(--orange)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Seleccionar todos</button>
                </div>
                {filteredRecipients.map(c => (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <input type="checkbox" checked={selectedRecipients.has(c.id)} onChange={() => toggleRecipient(c.id)} style={{ accentColor: 'var(--orange)' }} />
                    <span style={{ fontWeight: 500 }}>{c.name || 'Sin nombre'}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{c.email}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{c.status}</span>
                  </label>
                ))}
                {filteredRecipients.length === 0 && (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>Sin contactos con email en este filtro</div>
                )}
              </div>
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Plantilla</label>
              <select value={form.templateId} onChange={e => applyTemplate(e.target.value)} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }}>
                <option value="">Sin plantilla</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
        )}

        {activeSection === 'content' && (
          <EmailEditor html={form.htmlContent} onChange={v => set('htmlContent', v)} />
        )}

        {activeSection === 'preview' && (
          <div style={{ background: '#f5f5f5', borderRadius: 8, padding: 24, maxWidth: 640, margin: '0 auto' }}>
            <div style={{ background: '#fff', borderRadius: 8, padding: 32, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: 11, color: '#999', marginBottom: 8 }}>De: {form.fromName || '—'} &lt;{form.fromEmail || '—'}&gt;</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#333', marginBottom: 16, borderBottom: '1px solid #eee', paddingBottom: 12 }}>{form.subject || '(Sin asunto)'}</div>
              <div dangerouslySetInnerHTML={{ __html: form.htmlContent || '<p style="color:#ccc;text-align:center">Sin contenido</p>' }} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
          <button onClick={onCancel} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cancelar</button>
          <button onClick={handleSave} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: 'var(--orange)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Guardar campana</button>
        </div>
      </div>
    </div>
  )
}

// ---- SEQUENCE FORM ----
function SequenceForm({ templates, pipelines, crmContacts, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: '',
    pipelineId: '',
    fromName: '',
    fromEmail: '',
    steps: [{ delay: 0, delayUnit: 'days', templateId: '', subject: '', htmlContent: '' }]
  })

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const addStep = () => {
    setForm(p => ({
      ...p,
      steps: [...p.steps, { delay: 1, delayUnit: 'days', templateId: '', subject: '', htmlContent: '' }]
    }))
  }

  const removeStep = (idx) => {
    if (form.steps.length <= 1) return
    setForm(p => ({ ...p, steps: p.steps.filter((_, i) => i !== idx) }))
  }

  const updateStep = (idx, key, val) => {
    setForm(p => ({
      ...p,
      steps: p.steps.map((s, i) => i === idx ? { ...s, [key]: val } : s)
    }))
  }

  const applyTemplateToStep = (idx, tplId) => {
    const tpl = templates.find(t => t.id === tplId)
    if (tpl) {
      setForm(p => ({
        ...p,
        steps: p.steps.map((s, i) => i === idx ? { ...s, templateId: tplId, subject: tpl.subject || s.subject, htmlContent: tpl.htmlContent || '' } : s)
      }))
    } else {
      updateStep(idx, 'templateId', '')
    }
  }

  const computeCumulativeDelay = (idx) => {
    let total = 0
    for (let i = 0; i <= idx; i++) {
      const step = form.steps[i]
      const val = step.delay || 0
      total += step.delayUnit === 'hours' ? val : val * 24
    }
    return total
  }

  const formatDelay = (hours) => {
    if (hours === 0) return 'Inmediato'
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    const rem = hours % 24
    return rem > 0 ? `${days}d ${rem}h` : `${days}d`
  }

  const handleSave = () => {
    onSave({
      name: form.name,
      subject: form.steps[0]?.subject || form.name,
      fromName: form.fromName,
      fromEmail: form.fromEmail,
      status: 'draft',
      type: 'sequence',
      pipelineId: form.pipelineId,
      sequence_steps: JSON.stringify(form.steps),
      recipientFilter: 'all',
      recipientIds: [],
    })
  }

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: 24, borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ color: 'var(--text)', margin: '0 0 16px', fontSize: 18 }}>Nueva Secuencia</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Nombre de la secuencia</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej: Onboarding nuevos leads" style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} />
          </div>
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Pipeline</label>
            <select value={form.pipelineId} onChange={e => set('pipelineId', e.target.value)} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }}>
              <option value="">Todos los contactos</option>
              {(pipelines || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Nombre remitente</label>
            <input value={form.fromName} onChange={e => set('fromName', e.target.value)} placeholder="Tu nombre o empresa" style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} />
          </div>
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Email remitente</label>
            <input value={form.fromEmail} onChange={e => set('fromEmail', e.target.value)} placeholder="noreply@tuempresa.com" style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} />
          </div>
        </div>
      </div>

      {/* Timeline / Steps */}
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h4 style={{ color: 'var(--text)', margin: 0, fontSize: 15 }}>Pasos de la secuencia</h4>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{form.steps.length} {form.steps.length === 1 ? 'paso' : 'pasos'}</span>
        </div>

        <div style={{ position: 'relative', paddingLeft: 32 }}>
          {/* Timeline line */}
          <div style={{ position: 'absolute', left: 11, top: 0, bottom: 0, width: 2, background: 'var(--border)' }} />

          {form.steps.map((step, idx) => {
            const cumHours = computeCumulativeDelay(idx)
            return (
              <div key={idx} style={{ position: 'relative', marginBottom: 24 }}>
                {/* Timeline dot */}
                <div style={{ position: 'absolute', left: -32, top: 12, width: 24, height: 24, borderRadius: '50%', background: idx === 0 ? 'var(--orange)' : 'var(--bg-card)', border: `2px solid ${idx === 0 ? 'var(--orange)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: idx === 0 ? '#fff' : 'var(--text-secondary)' }}>{idx + 1}</span>
                </div>

                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
                  {/* Step header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>Paso {idx + 1}</span>
                      {idx === 0 ? (
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: 'rgba(255,107,0,0.12)', color: 'var(--orange)' }}>Inmediato</span>
                      ) : (
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}>
                          +{step.delay} {step.delayUnit === 'hours' ? 'horas' : 'dias'} (total: {formatDelay(cumHours)})
                        </span>
                      )}
                    </div>
                    {form.steps.length > 1 && (
                      <button onClick={() => removeStep(idx)} style={{ padding: 4, borderRadius: 4, border: 'none', background: 'rgba(239,68,68,0.1)', cursor: 'pointer', color: '#ef4444' }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {/* Delay (not for first step) */}
                    {idx > 0 && (
                      <>
                        <div>
                          <label style={{ display: 'block', marginBottom: 4, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Esperar</label>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input type="number" min="1" value={step.delay} onChange={e => updateStep(idx, 'delay', parseInt(e.target.value) || 1)}
                              style={{ width: 70, padding: '8px 10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }} />
                            <select value={step.delayUnit} onChange={e => updateStep(idx, 'delayUnit', e.target.value)}
                              style={{ padding: '8px 10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }}>
                              <option value="hours">Horas</option>
                              <option value="days">Dias</option>
                            </select>
                          </div>
                        </div>
                      </>
                    )}
                    {/* Template */}
                    <div style={idx === 0 ? { gridColumn: '1/2' } : {}}>
                      <label style={{ display: 'block', marginBottom: 4, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Plantilla</label>
                      <select value={step.templateId} onChange={e => applyTemplateToStep(idx, e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }}>
                        <option value="">Sin plantilla</option>
                        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    {/* Subject */}
                    <div style={{ gridColumn: '1/-1' }}>
                      <label style={{ display: 'block', marginBottom: 4, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Asunto</label>
                      <input value={step.subject} onChange={e => updateStep(idx, 'subject', e.target.value)} placeholder="Asunto del email..."
                        style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }} />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Add step button */}
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: -32, top: 8, width: 24, height: 24, borderRadius: '50%', background: 'var(--bg)', border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
              <Plus size={10} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <button onClick={addStep}
              style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '2px dashed var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all .2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--orange)'; e.currentTarget.style.color = 'var(--orange)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
              <Plus size={14} /> Anadir paso
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onCancel} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cancelar</button>
        <button onClick={handleSave} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: 'var(--orange)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Guardar secuencia</button>
      </div>
    </div>
  )
}

// ---- TEMPLATE FORM ----
function TemplateForm({ template, onSave, onCancel }) {
  const [form, setForm] = useState(template || { name: '', subject: '', htmlContent: '', category: 'general' })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Nombre plantilla</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Asunto por defecto</label>
          <input value={form.subject} onChange={e => set('subject', e.target.value)} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Categoria</label>
          <select value={form.category} onChange={e => set('category', e.target.value)} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }}>
            <option value="general">General</option>
            <option value="newsletter">Newsletter</option>
            <option value="promotional">Promocional</option>
            <option value="transactional">Transaccional</option>
            <option value="onboarding">Onboarding</option>
          </select>
        </div>
      </div>
      <EmailEditor html={form.htmlContent} onChange={v => set('htmlContent', v)} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button onClick={onCancel} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cancelar</button>
        <button onClick={() => onSave(form)} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: 'var(--orange)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Guardar plantilla</button>
      </div>
    </div>
  )
}

export default function EmailMarketingPage() {
  const { getEmailLists, addEmailList, updateEmailList, deleteEmailList, getEmailSubscribers, addEmailSubscriber, deleteEmailSubscriber, getEmailTemplates, addEmailTemplate, updateEmailTemplate, deleteEmailTemplate, getEmailCampaigns, addEmailCampaign, updateEmailCampaign, deleteEmailCampaign, getEmailConfig, saveEmailConfig, sendEmailCampaign, getCrmContacts, getCrmPipelines } = useClientData()

  const [lists, listsLoading, refreshLists] = useAsync(getEmailLists, [])
  const [subscribers, subsLoading, refreshSubs] = useAsync(getEmailSubscribers, [])
  const [templates, tplLoading, refreshTpls] = useAsync(getEmailTemplates, [])
  const [campaigns, campLoading, refreshCamps] = useAsync(getEmailCampaigns, [])
  const [emailConfig, configLoading, refreshConfig] = useAsync(getEmailConfig, null)
  const [crmContacts, crmLoading] = useAsync(getCrmContacts, [])
  const [pipelines, pipelinesLoading] = useAsync(getCrmPipelines, [])

  const [tab, setTab] = useState('campaigns')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [sending, setSending] = useState(null)
  const [sendResult, setSendResult] = useState(null)

  // Config form
  const [configForm, setConfigForm] = useState(null)
  const [configSaving, setConfigSaving] = useState(false)
  const [configSaved, setConfigSaved] = useState(false)

  // CRM import
  const [importListId, setImportListId] = useState(null)
  const [importSelected, setImportSelected] = useState({})
  const [importing, setImporting] = useState(false)

  // CRM contacts with email that are not already subscribers in a given list
  const crmWithEmail = useMemo(() => {
    return crmContacts.filter(c => c.email)
  }, [crmContacts])

  // Separate campaigns from sequences
  const regularCampaigns = useMemo(() => campaigns.filter(c => c.type !== 'sequence'), [campaigns])
  const sequences = useMemo(() => campaigns.filter(c => c.type === 'sequence'), [campaigns])

  const getImportableCrm = (listId) => {
    const subs = listId && listId !== '__all__' ? subscribers.filter(s => s.listId === listId) : subscribers
    const existingEmails = new Set(subs.map(s => s.email.toLowerCase()))
    return crmWithEmail.filter(c => !existingEmails.has(c.email.toLowerCase()))
  }

  const handleImportCrm = async () => {
    if (!importListId) return
    const selectedIds = Object.entries(importSelected).filter(([, v]) => v).map(([k]) => k)
    const toImport = crmWithEmail.filter(c => selectedIds.includes(c.id))
    if (toImport.length === 0) return

    const targetListId = importListId === '__all__' ? (selectedListId || '') : importListId
    setImporting(true)
    for (const c of toImport) {
      await addEmailSubscriber({ email: c.email, name: c.name || '', listId: targetListId, status: 'subscribed' })
    }
    setImporting(false)
    setImportListId(null)
    setImportSelected({})
    refreshSubs()
  }

  // List form
  const [listForm, setListForm] = useState({ name: '', description: '' })
  const [showListForm, setShowListForm] = useState(false)

  // Subscriber form
  const [subForm, setSubForm] = useState({ email: '', name: '', listId: '', status: 'subscribed' })
  const [showSubForm, setShowSubForm] = useState(false)
  const [selectedListId, setSelectedListId] = useState('')

  const loading = listsLoading || subsLoading || tplLoading || campLoading || configLoading || pipelinesLoading

  // Stats
  const totalSubs = subscribers.filter(s => s.status === 'subscribed').length
  const totalCampaigns = regularCampaigns.length
  const totalSent = campaigns.reduce((s, c) => s + (c.totalSent || 0), 0)
  const totalOpened = campaigns.reduce((s, c) => s + (c.totalOpened || 0), 0)
  const openRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : '0'

  const filteredSubs = useMemo(() => {
    let list = subscribers
    if (selectedListId) list = list.filter(s => s.listId === selectedListId)
    if (search) list = list.filter(s => (s.email + ' ' + s.name).toLowerCase().includes(search.toLowerCase()))
    return list
  }, [subscribers, selectedListId, search])

  // Handlers
  const handleSaveCampaign = async (form) => {
    if (editItem) {
      await updateEmailCampaign(editItem.id, form)
    } else {
      await addEmailCampaign(form)
    }
    refreshCamps()
    setShowForm(false)
    setEditItem(null)
  }

  const handleSaveSequence = async (form) => {
    if (editItem) {
      await updateEmailCampaign(editItem.id, form)
    } else {
      await addEmailCampaign(form)
    }
    refreshCamps()
    setShowForm(false)
    setEditItem(null)
  }

  const handleToggleSequenceStatus = async (seq) => {
    const newStatus = seq.status === 'active' ? 'paused' : 'active'
    await updateEmailCampaign(seq.id, { ...seq, status: newStatus })
    refreshCamps()
  }

  const handleSaveTemplate = async (form) => {
    if (editItem) {
      await updateEmailTemplate(editItem.id, form)
    } else {
      await addEmailTemplate(form)
    }
    refreshTpls()
    setShowForm(false)
    setEditItem(null)
  }

  const handleSaveList = async (e) => {
    e.preventDefault()
    if (editItem) {
      await updateEmailList(editItem.id, listForm)
    } else {
      await addEmailList(listForm)
    }
    refreshLists()
    setShowListForm(false)
    setEditItem(null)
    setListForm({ name: '', description: '' })
  }

  const handleSaveSub = async (e) => {
    e.preventDefault()
    await addEmailSubscriber(subForm)
    refreshSubs()
    setShowSubForm(false)
    setSubForm({ email: '', name: '', listId: '', status: 'subscribed' })
  }

  const handleSendCampaign = async (campaignId) => {
    if (!emailConfig?.apiKey) {
      alert('Primero configura tu API Key de Resend en la pestana de Configuracion')
      setTab('config')
      return
    }
    if (!confirm('¿Enviar esta campana a todos los suscriptores de la lista?')) return
    setSending(campaignId)
    setSendResult(null)
    try {
      const result = await sendEmailCampaign(campaignId)
      setSendResult({ success: true, ...result })
      refreshCamps()
    } catch (e) {
      setSendResult({ success: false, error: e.message })
    }
    setSending(null)
  }

  const handleSaveConfig = async (e) => {
    e.preventDefault()
    setConfigSaving(true)
    try {
      await saveEmailConfig(configForm)
      refreshConfig()
      setConfigSaved(true)
      setTimeout(() => setConfigSaved(false), 3000)
    } catch (e) {
      alert('Error: ' + e.message)
    }
    setConfigSaving(false)
  }

  const getSequenceSteps = (seq) => {
    try {
      return JSON.parse(seq.sequence_steps || '[]')
    } catch {
      return []
    }
  }

  const getPipelineName = (pipelineId) => {
    if (!pipelineId) return 'Todos'
    const p = (pipelines || []).find(p => p.id === pipelineId)
    return p ? p.name : 'Todos'
  }

  if (loading) return <div className="dashboard"><div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Cargando...</div></div>

  return (
    <div className="dashboard">
      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard icon={Users} label="Suscriptores" value={totalSubs} />
        <StatCard icon={Send} label="Campanas" value={totalCampaigns} />
        <StatCard icon={Clock} label="Secuencias" value={sequences.length} />
        <StatCard icon={Mail} label="Emails enviados" value={totalSent.toLocaleString()} />
        <StatCard icon={BarChart3} label="Tasa apertura" value={openRate + '%'} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-card)', borderRadius: 10, padding: 4, border: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setShowForm(false); setEditItem(null) }}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: tab === t.id ? 'var(--orange)' : 'transparent', color: tab === t.id ? '#fff' : 'var(--text-secondary)', transition: 'all .2s' }}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {/* Send result notification */}
      {sendResult && (
        <div style={{ padding: '12px 20px', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, background: sendResult.success ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${sendResult.success ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
          {sendResult.success ? <Check size={16} style={{ color: '#22c55e' }} /> : <AlertCircle size={16} style={{ color: '#ef4444' }} />}
          <span style={{ color: sendResult.success ? '#22c55e' : '#ef4444', fontSize: 13, fontWeight: 600 }}>
            {sendResult.success ? `Campana enviada: ${sendResult.sent} emails enviados${sendResult.failed ? `, ${sendResult.failed} fallidos` : ''}` : `Error: ${sendResult.error}`}
          </span>
          <button onClick={() => setSendResult(null)} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={14} /></button>
        </div>
      )}

      {/* Config warning */}
      {!emailConfig?.apiKey && tab !== 'config' && (
        <div onClick={() => setTab('config')} style={{ padding: '12px 20px', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', cursor: 'pointer' }}>
          <AlertCircle size={16} style={{ color: '#fbbf24' }} />
          <span style={{ color: '#fbbf24', fontSize: 13, fontWeight: 600 }}>Configura tu API Key de Resend para poder enviar emails. Click aqui.</span>
        </div>
      )}

      {/* CAMPAIGNS TAB */}
      {tab === 'campaigns' && !showForm && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ color: 'var(--text)', margin: 0, fontSize: 18 }}>Campanas de Email</h3>
            <button onClick={() => { setShowForm(true); setEditItem(null) }} className="btn-action" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={14} /> Nueva Campana</button>
          </div>
          {regularCampaigns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <Send size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p>No hay campanas aun. Crea tu primera campana de email.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {regularCampaigns.map(c => (
                <div key={c.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.subject || '(Sin asunto)'}{c.pipelineId ? ` — Pipeline: ${getPipelineName(c.pipelineId)}` : ''}</div>
                  </div>
                  <Badge status={c.status} />
                  <div style={{ textAlign: 'center', minWidth: 60 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{c.totalSent || 0}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Enviados</div>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: 60 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{c.totalOpened || 0}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Abiertos</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {c.status === 'draft' && (
                      <button onClick={() => handleSendCampaign(c.id)} disabled={sending === c.id}
                        style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--orange)', cursor: sending === c.id ? 'wait' : 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(255,107,0,0.3)' }}>
                        {sending === c.id ? <Loader size={14} className="spin" /> : <Send size={14} />} Enviar Campana
                      </button>
                    )}
                    <button onClick={() => { setEditItem(c); setShowForm(true) }} style={{ padding: 8, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.05)', cursor: 'pointer', color: 'var(--text-secondary)' }}><Edit3 size={14} /></button>
                    <button onClick={async () => { await deleteEmailCampaign(c.id); refreshCamps() }} style={{ padding: 8, borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.1)', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {tab === 'campaigns' && showForm && (
        <>
          <button onClick={() => { setShowForm(false); setEditItem(null) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0', border: 'none', background: 'none', color: 'var(--orange)', cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 12 }}><ArrowLeft size={14} /> Volver</button>
          <CampaignForm campaign={editItem} lists={lists} templates={templates} pipelines={pipelines} crmContacts={crmContacts} onSave={handleSaveCampaign} onCancel={() => { setShowForm(false); setEditItem(null) }} />
        </>
      )}

      {/* SEQUENCES TAB */}
      {tab === 'sequences' && !showForm && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ color: 'var(--text)', margin: 0, fontSize: 18 }}>Secuencias de Email</h3>
            <button onClick={() => { setShowForm(true); setEditItem(null) }} className="btn-action" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={14} /> Nueva Secuencia</button>
          </div>
          {sequences.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <Clock size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p>No hay secuencias aun. Crea tu primera secuencia de emails automaticos.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sequences.map(seq => {
                const steps = getSequenceSteps(seq)
                return (
                  <div key={seq.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,107,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Clock size={18} style={{ color: 'var(--orange)' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{seq.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 12 }}>
                        <span>Pipeline: {getPipelineName(seq.pipelineId)}</span>
                        <span>{steps.length} {steps.length === 1 ? 'paso' : 'pasos'}</span>
                      </div>
                    </div>
                    <Badge status={seq.status} />
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(seq.status === 'draft' || seq.status === 'paused') && (
                        <button onClick={() => handleToggleSequenceStatus({ ...seq, status: 'paused' })}
                          style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'rgba(34,197,94,0.15)', cursor: 'pointer', color: '#22c55e', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Play size={12} /> Activar
                        </button>
                      )}
                      {seq.status === 'active' && (
                        <button onClick={() => handleToggleSequenceStatus(seq)}
                          style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'rgba(251,191,36,0.15)', cursor: 'pointer', color: '#fbbf24', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Pause size={12} /> Pausar
                        </button>
                      )}
                      <button onClick={async () => { await deleteEmailCampaign(seq.id); refreshCamps() }} style={{ padding: 8, borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.1)', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
      {tab === 'sequences' && showForm && (
        <>
          <button onClick={() => { setShowForm(false); setEditItem(null) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0', border: 'none', background: 'none', color: 'var(--orange)', cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 12 }}><ArrowLeft size={14} /> Volver</button>
          <SequenceForm templates={templates} pipelines={pipelines} crmContacts={crmContacts} onSave={handleSaveSequence} onCancel={() => { setShowForm(false); setEditItem(null) }} />
        </>
      )}

      {/* Lists, subscribers, config removed — managed via CRM and /integraciones */}
      {false && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ color: 'var(--text)', margin: 0, fontSize: 18 }}>Listas de Contactos</h3>
            <button onClick={() => { setShowListForm(true); setEditItem(null); setListForm({ name: '', description: '' }) }} className="btn-action" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={14} /> Nueva Lista</button>
          </div>
          {showListForm && (
            <form onSubmit={handleSaveList} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Nombre</label>
                  <input value={listForm.name} onChange={e => setListForm({ ...listForm, name: e.target.value })} required style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Descripcion</label>
                  <input value={listForm.description} onChange={e => setListForm({ ...listForm, description: e.target.value })} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button type="button" onClick={() => setShowListForm(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
                <button type="submit" className="btn-action">Guardar</button>
              </div>
            </form>
          )}
          {lists.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <Users size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p>No hay listas. Crea tu primera lista de contactos.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {lists.map(l => {
                const count = subscribers.filter(s => s.listId === l.id && s.status === 'subscribed').length
                return (
                  <div key={l.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{l.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{l.description}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => { setEditItem(l); setListForm({ name: l.name, description: l.description || '' }); setShowListForm(true) }} style={{ padding: 6, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.05)', cursor: 'pointer', color: 'var(--text-secondary)' }}><Edit3 size={12} /></button>
                        <button onClick={async () => { await deleteEmailList(l.id); refreshLists() }} style={{ padding: 6, borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.1)', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={12} /></button>
                      </div>
                    </div>
                    <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(255,107,0,0.08)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Users size={14} style={{ color: 'var(--orange)' }} />
                      <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--orange)' }}>{count}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>suscriptores</span>
                    </div>
                    <button onClick={() => { setImportListId(l.id); setImportSelected({}) }}
                      style={{ marginTop: 8, width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      onMouseEnter={e => { e.target.style.borderColor = 'var(--orange)'; e.target.style.color = 'var(--orange)' }}
                      onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-secondary)' }}>
                      <Users size={12} /> Importar desde CRM ({getImportableCrm(l.id).length})
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* CRM Import Modal */}
          {importListId && (() => {
            const importable = getImportableCrm(importListId)
            const listName = lists.find(l => l.id === importListId)?.name || ''
            const allSelected = importable.length > 0 && importable.every(c => importSelected[c.id])
            const selectedCount = Object.values(importSelected).filter(Boolean).length

            return (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setImportListId(null)}>
                <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 16 }}>Importar contactos del CRM</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>a la lista: <strong>{listName}</strong></div>
                    </div>
                    <button onClick={() => setImportListId(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}><X size={18} /></button>
                  </div>

                  <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
                      <input type="checkbox" checked={allSelected} onChange={() => {
                        const next = {}
                        if (!allSelected) importable.forEach(c => { next[c.id] = true })
                        setImportSelected(next)
                      }} style={{ accentColor: 'var(--orange)' }} />
                      Seleccionar todos ({importable.length})
                    </label>
                    <span style={{ fontSize: 12, color: 'var(--orange)', fontWeight: 600 }}>{selectedCount} seleccionados</span>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px' }}>
                    {importable.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: 13 }}>
                        Todos los contactos del CRM con email ya estan en esta lista.
                      </div>
                    ) : importable.map(c => (
                      <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!importSelected[c.id]} onChange={() => setImportSelected(prev => ({ ...prev, [c.id]: !prev[c.id] }))} style={{ accentColor: 'var(--orange)' }} />
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,107,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--orange)' }}>{(c.name || c.email)[0].toUpperCase()}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>{c.name || '—'}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.email}</div>
                        </div>
                        {c.company && <span style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 4 }}>{c.company}</span>}
                        {c.status && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,107,0,0.1)', color: 'var(--orange)' }}>{c.status}</span>}
                      </label>
                    ))}
                  </div>

                  <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={() => setImportListId(null)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cancelar</button>
                    <button onClick={handleImportCrm} disabled={selectedCount === 0 || importing}
                      style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: selectedCount > 0 ? 'var(--orange)' : 'rgba(255,255,255,0.1)', color: selectedCount > 0 ? '#fff' : '#666', cursor: selectedCount > 0 ? 'pointer' : 'default', fontSize: 13, fontWeight: 600 }}>
                      {importing ? 'Importando...' : `Importar ${selectedCount} contactos`}
                    </button>
                  </div>
                </div>
              </div>
            )
          })()}
        </>
      )}

      {/* TEMPLATES TAB */}
      {tab === 'templates' && !showForm && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ color: 'var(--text)', margin: 0, fontSize: 18 }}>Plantillas de Email</h3>
            <button onClick={() => { setShowForm(true); setEditItem(null) }} className="btn-action" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={14} /> Nueva Plantilla</button>
          </div>
          {templates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <FileText size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p>No hay plantillas. Crea tu primera plantilla reutilizable.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {templates.map(t => (
                <div key={t.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ height: 140, background: '#fff', padding: 12, overflow: 'hidden' }}>
                    <div style={{ transform: 'scale(0.4)', transformOrigin: 'top left', width: '250%' }} dangerouslySetInnerHTML={{ __html: t.htmlContent || '<p style="color:#ccc;padding:20px">Sin contenido</p>' }} />
                  </div>
                  <div style={{ padding: 16 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{t.category}</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => { setEditItem(t); setShowForm(true) }} style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Edit3 size={12} /> Editar</button>
                      <button onClick={async () => { await deleteEmailTemplate(t.id); refreshTpls() }} style={{ padding: '8px 12px', borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.1)', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={12} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {tab === 'templates' && showForm && (
        <>
          <button onClick={() => { setShowForm(false); setEditItem(null) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0', border: 'none', background: 'none', color: 'var(--orange)', cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 12 }}><ArrowLeft size={14} /> Volver</button>
          <TemplateForm template={editItem} onSave={handleSaveTemplate} onCancel={() => { setShowForm(false); setEditItem(null) }} />
        </>
      )}

      {/* SUBSCRIBERS TAB */}
      {tab === 'subscribers' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ color: 'var(--text)', margin: 0, fontSize: 18 }}>Suscriptores</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={selectedListId} onChange={e => setSelectedListId(e.target.value)} style={{ padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }}>
                <option value="">Todas las listas</option>
                {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ padding: '8px 12px 8px 30px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }} />
              </div>
              <button onClick={() => { setImportListId(selectedListId || '__all__'); setImportSelected({}) }}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--orange)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={14} /> Importar CRM
              </button>
              <button onClick={() => setShowSubForm(true)} className="btn-action" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={14} /> Anadir</button>
            </div>
          </div>
          {showSubForm && (
            <form onSubmit={handleSaveSub} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Email</label>
                  <input type="email" value={subForm.email} onChange={e => setSubForm({ ...subForm, email: e.target.value })} required style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Nombre</label>
                  <input value={subForm.name} onChange={e => setSubForm({ ...subForm, name: e.target.value })} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Lista</label>
                  <select value={subForm.listId} onChange={e => setSubForm({ ...subForm, listId: e.target.value })} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }}>
                    <option value="">Sin lista</option>
                    {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button type="button" onClick={() => setShowSubForm(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
                <button type="submit" className="btn-action">Anadir suscriptor</button>
              </div>
            </form>
          )}
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Nombre</th>
                  <th>Lista</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredSubs.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>No hay suscriptores</td></tr>
                ) : filteredSubs.map(s => {
                  const list = lists.find(l => l.id === s.listId)
                  return (
                    <tr key={s.id}>
                      <td className="cell-bold">{s.email}</td>
                      <td>{s.name || '—'}</td>
                      <td>{list?.name || '—'}</td>
                      <td><Badge status={s.status} /></td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.subscribedAt ? new Date(s.subscribedAt).toLocaleDateString() : '—'}</td>
                      <td>
                        <button onClick={async () => { await deleteEmailSubscriber(s.id); refreshSubs() }} style={{ padding: 6, borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.1)', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* CONFIG TAB */}
      {tab === 'config' && (() => {
        const cf = configForm || emailConfig || { provider: 'resend', apiKey: '', fromName: '', fromEmail: '', replyTo: '', domain: '' }
        if (!configForm && emailConfig) setTimeout(() => setConfigForm({ ...emailConfig }), 0)
        if (!configForm && !emailConfig) setTimeout(() => setConfigForm({ provider: 'resend', apiKey: '', fromName: '', fromEmail: '', replyTo: '', domain: '' }), 0)
        return (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ color: 'var(--text)', margin: 0, fontSize: 18 }}>Configuracion de Email</h3>
              {configSaved && <span style={{ color: '#22c55e', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={14} /> Guardado</span>}
            </div>

            <form onSubmit={handleSaveConfig}>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
                {/* Provider */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Proveedor de email</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>Resend ofrece 3.000 emails gratis al mes. Despues cuesta $0.001 por email.</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'rgba(255,107,0,0.08)', borderRadius: 8, border: '1px solid rgba(255,107,0,0.2)' }}>
                    <Mail size={16} style={{ color: 'var(--orange)' }} />
                    <span style={{ fontWeight: 600, color: 'var(--orange)', fontSize: 14 }}>Resend</span>
                    <Check size={14} style={{ color: '#22c55e' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {/* API Key */}
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>API Key de Resend *</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="password"
                        value={cf.apiKey || ''}
                        onChange={e => setConfigForm({ ...cf, apiKey: e.target.value })}
                        placeholder="re_xxxxxxxxxxxx"
                        required
                        style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, fontFamily: 'monospace' }}
                      />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Consigue tu API Key en resend.com/api-keys</div>
                  </div>

                  {/* From Name */}
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Nombre del remitente</label>
                    <input
                      value={cf.fromName || ''}
                      onChange={e => setConfigForm({ ...cf, fromName: e.target.value })}
                      placeholder="Tu empresa o nombre"
                      style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }}
                    />
                  </div>

                  {/* From Email */}
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Email del remitente *</label>
                    <input
                      type="email"
                      value={cf.fromEmail || ''}
                      onChange={e => setConfigForm({ ...cf, fromEmail: e.target.value })}
                      placeholder="newsletter@tudominio.com"
                      required
                      style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Usa onboarding@resend.dev para probar sin dominio verificado</div>
                  </div>

                  {/* Reply To */}
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Responder a (Reply-To)</label>
                    <input
                      type="email"
                      value={cf.replyTo || ''}
                      onChange={e => setConfigForm({ ...cf, replyTo: e.target.value })}
                      placeholder="soporte@tuempresa.com"
                      style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }}
                    />
                  </div>

                  {/* Domain */}
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Dominio</label>
                    <input
                      value={cf.domain || ''}
                      onChange={e => setConfigForm({ ...cf, domain: e.target.value })}
                      placeholder="tuempresa.com"
                      style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Verifica tu dominio en Resend para mejor entregabilidad</div>
                  </div>
                </div>

                {/* DNS Info */}
                <div style={{ marginTop: 24, padding: 16, background: 'rgba(59,130,246,0.08)', borderRadius: 10, border: '1px solid rgba(59,130,246,0.2)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#60a5fa', marginBottom: 8 }}>Configuracion DNS (para dominio propio)</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                    Para enviar desde tu propio dominio, anade estos registros DNS:<br />
                    1. Ve a <strong>resend.com/domains</strong> y anade tu dominio<br />
                    2. Resend te dara registros <strong>SPF, DKIM y DMARC</strong><br />
                    3. Anadeselos en tu proveedor de DNS (Cloudflare, GoDaddy, etc.)<br />
                    4. Espera a que se verifiquen (puede tardar hasta 48h)<br />
                    <br />
                    Mientras tanto puedes usar <strong>onboarding@resend.dev</strong> como remitente de prueba.
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
                  <button type="submit" disabled={configSaving} className="btn-action" style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: configSaving ? 0.6 : 1 }}>
                    {configSaving ? <Loader size={14} className="spin" /> : <Check size={14} />}
                    {configSaving ? 'Guardando...' : 'Guardar configuracion'}
                  </button>
                </div>
              </div>
            </form>
          </>
        )
      })()}
    </div>
  )
}
