import { useState, useEffect, useCallback } from 'react'
import { useClientData } from '../hooks/useClientData'
import { useAsync } from '../hooks/useAsync'

const ROLE_LABELS = { director: 'Director', manager: 'Manager', closer: 'Closer', setter: 'Setter' }

const FIELD_MAPPING = [
  { close: 'Contact Name', app: 'clientName', type: 'Texto', src: 'Contacto' },
  { close: 'Contact Email', app: 'clientEmail', type: 'Texto', src: 'Contacto' },
  { close: 'Contact Phone', app: 'clientPhone', type: 'Texto', src: 'Contacto' },
  { close: 'Instagram', app: 'instagram', type: 'Texto', src: 'Lead Field' },
  { close: 'Closer Asignado', app: 'closer', type: 'Texto', src: 'Lead Field' },
  { close: 'Setter Asignado', app: 'setter', type: 'Texto', src: 'Lead Field' },
  { close: 'Triager Asignado', app: 'triager', type: 'Texto', src: 'Lead Field' },
  { close: 'UTM Source', app: 'utmSource', type: 'Texto', src: 'Lead Field' },
  { close: 'UTM Medium', app: 'utmMedium', type: 'Texto', src: 'Lead Field' },
  { close: 'UTM Campaign', app: 'utmCampaign', type: 'Texto', src: 'Lead Field' },
  { close: 'UTM Content', app: 'utmContent', type: 'Texto', src: 'Lead Field' },
  { close: 'Producto Interes', app: 'productoInteres', type: 'Texto', src: 'Lead Field' },
  { close: 'Capital Disponible', app: 'capitalDisponible', type: 'Texto', src: 'Lead Field' },
  { close: 'Situación Actual', app: 'situacionActual', type: 'Texto', src: 'Lead Field' },
  { close: 'País', app: 'pais', type: 'Texto', src: 'Lead Field' },
  { close: 'Gestor Asignado', app: 'gestorAsignado', type: 'Texto', src: 'Lead Field' },
  { close: 'Fecha de Llamada', app: 'fechaLlamada', type: 'Fecha', src: 'Lead Field' },
  { close: 'Exp Amazon', app: 'expAmazon', type: 'Texto', src: 'Lead Field' },
  { close: 'Decisor Confirmado', app: 'decisorConfirmado', type: 'Texto', src: 'Lead Field' },
  { close: 'Tipo de pago', app: 'paymentType', type: 'Dropdown', src: 'Pago Recibido' },
  { close: 'Cash Collected (€)', app: 'cashCollected', type: 'Número', src: 'Pago Recibido' },
  { close: 'Revenue (€)', app: 'revenue', type: 'Número', src: 'Pago Recibido' },
  { close: 'Método de pago', app: 'paymentMethod', type: 'Dropdown', src: 'Pago Recibido' },
  { close: 'Número de cuota', app: 'installmentNumber', type: 'Dropdown', src: 'Pago Recibido' },
  { close: 'Notas', app: 'notes', type: 'Textarea', src: 'Pago Recibido' },
]

const ENJAMBRE_API = import.meta.env.VITE_ENJAMBRE_API_URL || 'https://enjambre.blackwolfsec.io'

function WhatsAppSetup() {
  const [waStatus, setWaStatus] = useState(null)
  const [waLoading, setWaLoading] = useState(true)
  const [restarting, setRestarting] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${ENJAMBRE_API}/api/whatsapp/status`)
      if (res.ok) {
        const data = await res.json()
        setWaStatus(data)
      }
    } catch {}
    setWaLoading(false)
  }, [])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  async function handleRestart() {
    setRestarting(true)
    try {
      await fetch(`${ENJAMBRE_API}/api/whatsapp/restart`, { method: 'POST' })
      // Wait a moment for the QR to generate
      setTimeout(fetchStatus, 3000)
    } catch {}
    setRestarting(false)
  }

  if (waLoading) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', padding: '16px 0' }}>Verificando estado de WhatsApp...</div>
  }

  const connected = waStatus?.connected
  const qrImage = waStatus?.qrImage

  return (
    <div style={{ maxWidth: 600 }}>
      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        {connected ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 100, fontSize: '0.75rem', fontWeight: 600,
            background: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.2)',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E' }} />
            Conectado
          </span>
        ) : (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 100, fontSize: '0.75rem', fontWeight: 600,
            background: qrImage ? 'rgba(255,184,0,0.1)' : 'rgba(239,68,68,0.1)',
            color: qrImage ? '#FFB800' : '#EF4444',
            border: `1px solid ${qrImage ? 'rgba(255,184,0,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: qrImage ? '#FFB800' : '#EF4444' }} />
            {qrImage ? 'Esperando escaneo' : 'Desconectado'}
          </span>
        )}
        {waStatus?.activeConversations > 0 && (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {waStatus.activeConversations} conversaciones activas
          </span>
        )}
      </div>

      {/* Connected state */}
      {connected && (
        <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 'var(--radius-sm)', padding: '16px 20px', marginBottom: 16 }}>
          <p style={{ color: 'var(--text)', fontSize: '0.85rem', margin: 0 }}>
            WhatsApp esta conectado y funcionando correctamente. Los mensajes se estan procesando automaticamente.
          </p>
        </div>
      )}

      {/* QR Code display */}
      {!connected && qrImage && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ background: '#fff', padding: 16, borderRadius: 14, display: 'inline-block', marginBottom: 12 }}>
            <img src={qrImage} alt="QR Code" style={{ display: 'block', width: 220, height: 220 }} />
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 8 }}>
            Escanea este codigo con WhatsApp para vincular tu cuenta.
          </p>
        </div>
      )}

      {/* Setup Guide */}
      {!connected && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
            Como conectar
          </div>

          {[
            { num: 1, title: 'Abre WhatsApp en tu telefono', text: 'Asegurate de tener la ultima version de WhatsApp instalada.' },
            { num: 2, title: 'Ve a Dispositivos vinculados', text: 'En Android: Menu (⋮) → Dispositivos vinculados. En iPhone: Ajustes → Dispositivos vinculados.' },
            { num: 3, title: 'Escanea el codigo QR', text: 'Toca "Vincular un dispositivo" y apunta la camara al codigo QR que aparece arriba.' },
            { num: 4, title: 'Listo', text: 'Una vez escaneado, la conexion se establecera automaticamente. Los mensajes se procesaran en segundo plano.' },
          ].map(step => (
            <div key={step.num} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0,
              }}>
                {step.num}
              </div>
              <div>
                <strong style={{ color: 'var(--text)', fontSize: '0.85rem', display: 'block', marginBottom: 2 }}>{step.title}</strong>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', margin: 0, lineHeight: 1.5 }}>{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Restart button */}
      <button
        onClick={handleRestart}
        disabled={restarting}
        className="btn-action btn-action--secondary"
        style={{ padding: '8px 18px', fontSize: '0.82rem' }}
      >
        {restarting ? 'Reiniciando...' : connected ? 'Reconectar WhatsApp' : 'Generar nuevo QR'}
      </button>
    </div>
  )
}

export default function SettingsPage({ user }) {
  const { getTeam, updateMember, getN8nConfig, saveN8nConfig, importSaleFromClose } = useClientData()
  const [team, teamLoading] = useAsync(getTeam, [])
  const [n8nConfig, n8nLoading, , setN8nConfig] = useAsync(getN8nConfig, { id: null, webhookUrl: '', apiKey: '', enabled: false, lastSync: null })

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')

  // N8n integration state
  const [webhookUrl, setWebhookUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [importMessage, setImportMessage] = useState('')
  const [importStatus, setImportStatus] = useState('')

  useEffect(() => { if (n8nConfig) setWebhookUrl(n8nConfig.webhookUrl || '') }, [n8nConfig])

  if (teamLoading || n8nLoading) return <div className="dashboard"><div style={{textAlign:'center',padding:60,color:'#999'}}>Cargando configuración...</div></div>

  const member = team.find(m => m.email === user)

  if (!member) {
    return (
      <div className="dashboard">
        <div className="empty-page">
          <div className="empty-icon">⚠️</div>
          <h2>Usuario no encontrado</h2>
          <p>No se encontró tu perfil en el equipo.</p>
        </div>
      </div>
    )
  }

  const isDirector = member.role === 'director'

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setMessage('')
    if (currentPassword !== member.password) { setMessage('La contraseña actual es incorrecta'); setMessageType('error'); return }
    if (newPassword.length < 4) { setMessage('La nueva contraseña debe tener al menos 4 caracteres'); setMessageType('error'); return }
    if (newPassword !== confirmPassword) { setMessage('Las contraseñas no coinciden'); setMessageType('error'); return }
    await updateMember(member.id, { password: newPassword })
    setMessage('Contraseña actualizada correctamente')
    setMessageType('success')
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
  }

  const toggleEnabled = async () => {
    const updated = { ...n8nConfig, enabled: !n8nConfig.enabled }
    await saveN8nConfig(updated)
    setN8nConfig(updated)
  }

  const saveWebhookUrl = async () => {
    const updated = { ...n8nConfig, webhookUrl }
    await saveN8nConfig(updated)
    setN8nConfig(updated)
  }

  const copyApiKey = () => {
    navigator.clipboard.writeText(n8nConfig.apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleImport = async () => {
    try {
      const data = JSON.parse(importJson)
      await importSaleFromClose(data)
      setImportMessage('Venta importada correctamente')
      setImportStatus('success')
      setImportJson('')
    } catch (err) {
      setImportMessage('Error: ' + (err.message || 'JSON inválido'))
      setImportStatus('error')
    }
    setTimeout(() => setImportMessage(''), 5000)
  }

  return (
    <div className="dashboard">
      {/* ═══ PROFILE ═══ */}
      <div className="settings-profile">
        <div className="team-card" style={{ maxWidth: 400 }}>
          <div className="team-card-header">
            <div className="team-avatar" style={{ width: 56, height: 56, fontSize: '1.3rem' }}>{member.name.charAt(0)}</div>
            <div className="team-card-info">
              <div className="team-card-name" style={{ fontSize: '1.1rem' }}>{member.name}</div>
              <div className="team-card-email">{member.email}</div>
            </div>
          </div>
          <div className="team-card-details">
            <span className={`badge badge--${member.role}`}>{ROLE_LABELS[member.role]}</span>
            <span className="badge badge--completada">Activo</span>
          </div>
        </div>
      </div>

      {/* ═══ CHANGE PASSWORD ═══ */}
      <div className="section-label-dash" style={{ marginTop: 32 }}>Cambiar Contraseña</div>
      <div className="form-card" style={{ maxWidth: 500 }}>
        <form onSubmit={handlePasswordChange}>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="form-group">
              <label>Contraseña actual</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Nueva contraseña</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Confirmar nueva contraseña</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
            </div>
          </div>
          {message && (
            <div className={messageType === 'error' ? 'login-error' : 'settings-success'} style={{ marginTop: 16 }}>
              {message}
            </div>
          )}
          <div className="form-actions">
            <button type="submit" className="btn-action">Cambiar Contraseña</button>
          </div>
        </form>
      </div>

      {/* ═══ WHATSAPP (Director only) ═══ */}
      {isDirector && (
        <>
          <div className="section-label-dash" style={{ marginTop: 40 }}>WhatsApp</div>
          <div className="form-card" style={{ maxWidth: 700 }}>
            <WhatsAppSetup />
          </div>
        </>
      )}

      {/* ═══ N8N INTEGRATION (Director only) ═══ */}
      {isDirector && (
        <>
          <div className="section-label-dash" style={{ marginTop: 40 }}>Integración Close CRM → N8n</div>
          <div className="form-card" style={{ maxWidth: 800 }}>
            {/* Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <span className={`badge badge--${n8nConfig.enabled ? 'completada' : 'pendiente'}`}>
                {n8nConfig.enabled ? 'Integración Activa' : 'Integración Inactiva'}
              </span>
              <button
                className="btn-action"
                style={{ padding: '6px 16px', fontSize: '0.8rem' }}
                onClick={toggleEnabled}
              >
                {n8nConfig.enabled ? 'Desactivar' : 'Activar'}
              </button>
            </div>

            {/* Webhook URL */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Webhook URL</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={webhookUrl}
                  onChange={e => setWebhookUrl(e.target.value)}
                  placeholder="https://tu-backend.com/api/webhook/sales"
                  style={{ flex: 1 }}
                />
                <button
                  className="btn-action btn-action--secondary"
                  style={{ padding: '8px 16px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                  onClick={saveWebhookUrl}
                >
                  Guardar
                </button>
              </div>
              <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: 4, display: 'block' }}>
                URL donde N8n enviará los datos. Necesitas un backend (Supabase, Vercel Function, etc.) para recibir webhooks.
              </small>
            </div>

            {/* API Key */}
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label>API Key</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={n8nConfig.apiKey}
                  readOnly
                  style={{ fontFamily: 'monospace', fontSize: '0.78rem', flex: 1 }}
                />
                <button
                  className="btn-action btn-action--secondary"
                  style={{ padding: '8px 16px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                  onClick={copyApiKey}
                >
                  {copied ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
              <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: 4, display: 'block' }}>
                Incluir como header <code style={{ color: 'var(--orange)' }}>X-API-Key</code> en las peticiones de N8n.
              </small>
            </div>

            {/* Field Mapping */}
            <div className="section-label-dash" style={{ marginTop: 0, marginBottom: 12 }}>Mapeo de Campos</div>
            <div className="table-wrapper" style={{ marginBottom: 24 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Origen</th>
                    <th>Close CRM</th>
                    <th></th>
                    <th>Dashboard</th>
                    <th>Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {FIELD_MAPPING.map((f, i) => (
                    <tr key={i}>
                      <td><span className={`badge badge--${f.src === 'Pago Recibido' ? 'completada' : f.src === 'Lead Field' ? 'setter' : 'product'}`} style={{ fontSize: '0.65rem' }}>{f.src}</span></td>
                      <td className="cell-bold">{f.close}</td>
                      <td style={{ color: 'var(--orange)', fontWeight: 700 }}>→</td>
                      <td><code style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{f.app}</code></td>
                      <td style={{ color: 'var(--text-muted)' }}>{f.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Test Import */}
            <div className="section-label-dash" style={{ marginTop: 0, marginBottom: 12 }}>Importar Venta (Test)</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 8 }}>
              Pega un JSON con los datos de la venta para probar la importación. Acepta tanto nombres de campos de Close CRM como nombres internos.
            </p>
            <textarea
              value={importJson}
              onChange={e => setImportJson(e.target.value)}
              rows={10}
              placeholder={`{
  "date": "2026-02-26",
  "clientName": "Juan Pérez",
  "clientEmail": "juan@email.com",
  "clientPhone": "+34 600 000 000",
  "product": "FBA Academy Pro",
  "paymentType": "Pago único",
  "installmentNumber": "Pago único",
  "paymentMethod": "Stripe",
  "revenue": 2997,
  "cashCollected": 2997,
  "closer": "Emi",
  "setter": "Víctor",
  "pais": "España",
  "utmSource": "instagram",
  "utmCampaign": "webinar_feb",
  "notes": "Importado desde N8n"
}`}
              style={{
                width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                color: 'var(--text)', fontFamily: 'monospace', fontSize: '0.78rem',
                resize: 'vertical', outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn-action" onClick={handleImport} disabled={!importJson.trim()}>
                Importar Venta
              </button>
            </div>
            {importMessage && (
              <div className={importStatus === 'success' ? 'settings-success' : 'login-error'} style={{ marginTop: 12 }}>
                {importMessage}
              </div>
            )}

            {/* N8n Workflow Guide */}
            <div className="section-label-dash" style={{ marginTop: 32, marginBottom: 12 }}>Guía: Automatización N8n</div>
            <div className="integration-guide">
              <div className="guide-step">
                <div className="guide-step-num">1</div>
                <div>
                  <strong>Trigger: Close CRM Webhook</strong>
                  <p>Configura un webhook en Close CRM que dispare cuando se crea un Custom Activity "Pago Recibido".</p>
                  <p>Close CRM → Settings → Integrations → Webhooks → Add Webhook</p>
                </div>
              </div>
              <div className="guide-step">
                <div className="guide-step-num">2</div>
                <div>
                  <strong>N8n: Recibir Webhook</strong>
                  <p>Crea un workflow en N8n con un nodo "Webhook" como trigger. Este recibirá los datos de Close.</p>
                </div>
              </div>
              <div className="guide-step">
                <div className="guide-step-num">3</div>
                <div>
                  <strong>N8n: Obtener datos del Lead</strong>
                  <p>Usa un nodo HTTP Request para hacer GET a la API de Close y obtener los custom fields del lead (UTMs, país, capital, etc.).</p>
                  <p><code style={{ color: 'var(--orange)', fontSize: '0.78rem' }}>GET https://api.close.com/api/v1/lead/{'{{lead_id}}'}</code></p>
                </div>
              </div>
              <div className="guide-step">
                <div className="guide-step-num">4</div>
                <div>
                  <strong>N8n: Transformar datos</strong>
                  <p>Usa un nodo "Function" para mapear los campos de Close al formato del dashboard (ver tabla de mapeo arriba).</p>
                </div>
              </div>
              <div className="guide-step">
                <div className="guide-step-num">5</div>
                <div>
                  <strong>N8n: Enviar al Dashboard</strong>
                  <p>HTTP POST al webhook URL con el JSON transformado y el header X-API-Key.</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 4 }}>
                    Para esto necesitas un backend. Opciones recomendadas: Supabase (gratis), Vercel Serverless Functions, o Firebase.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
