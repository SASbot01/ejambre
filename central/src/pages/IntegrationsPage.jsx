import { useState, useEffect } from 'react'
import { useClient } from '../contexts/ClientContext'
import { useClientData } from '../hooks/useClientData'
import { useAsync } from '../hooks/useAsync'
import { motion } from 'framer-motion'

const API_URL = import.meta.env.VITE_API_URL || window.location.origin

// ─── Integration Definitions ───
const INTEGRATIONS = [
  {
    key: 'whatsapp',
    name: 'WhatsApp Agent',
    icon: '\uD83D\uDCAC',
    color: '#25D366',
    description: 'Agente IA que responde WhatsApp como tu — conexion directa sin APIs externas',
    descriptionEn: 'AI agent that replies on WhatsApp as you — direct connection, no external APIs',
    provider: 'whatsapp-web',
    steps: [
      { label: 'El agente se ejecuta automaticamente — no necesitas instalar nada', labelEn: 'The agent runs automatically — no installation needed' },
      { label: 'Configura los numeros permitidos y guarda las credenciales', labelEn: 'Configure allowed numbers and save credentials' },
      { label: 'Escanea el codigo QR que aparecera abajo para vincular tu WhatsApp', labelEn: 'Scan the QR code that appears below to link your WhatsApp' },
      { label: 'El agente responde automaticamente con IA usando tu contexto', labelEn: 'The agent responds automatically with AI using your context' },
      { label: 'Los resumenes se reenvian a un grupo de WhatsApp central', labelEn: 'Summaries are forwarded to a central WhatsApp group' },
    ],
    hasQR: true,
    fields: [
      { key: 'allowedNumbers', label: 'Numeros permitidos (separados por coma)', labelEn: 'Allowed numbers (comma separated)', type: 'text', placeholder: '34600000000, 34611111111' },
      { key: 'groupId', label: 'ID del grupo central (se muestra en logs al conectar)', labelEn: 'Central group ID (shown in logs on connect)', type: 'text', placeholder: '120363000000000000@g.us' },
    ],
    showWebhook: false,
    troubleshooting: [
      'Si el QR expira, recarga el panel — se genera uno nuevo automaticamente',
      'Solo puede haber una sesion de WhatsApp Web activa por numero',
      'Si ya tienes WhatsApp Web abierto en otro sitio, cierra esa sesion primero',
      'El agente simula delays humanos (1-5 min) para no parecer bot',
      'Usa el comando "reset" en cualquier chat para limpiar el historial del agente',
    ],
  },
  {
    key: 'instagram',
    name: 'Instagram DMs',
    icon: '\uD83D\uDCF7',
    color: '#E1306C',
    description: 'Enviar mensajes directos de Instagram desde el CRM',
    descriptionEn: 'Send Instagram DMs from the CRM',
    provider: 'meta',
    steps: [
      { label: 'Crea una app en Meta for Developers y agrega el producto Instagram', labelEn: 'Create an app in Meta for Developers and add the Instagram product' },
      { label: 'Vincula tu cuenta de Instagram Business a una pagina de Facebook', labelEn: 'Link your Instagram Business account to a Facebook page' },
      { label: 'Genera un Access Token permanente desde Business Settings', labelEn: 'Generate a permanent Access Token from Business Settings' },
    ],
    fields: [
      { key: 'apiKey', label: 'Access Token de Meta', labelEn: 'Meta Access Token', type: 'password', placeholder: 'EAAxxxxxxx...' },
    ],
    troubleshooting: [
      'Instagram debe ser una cuenta Business, no personal',
      'La cuenta debe estar vinculada a una Facebook Page',
      'Los mensajes solo se pueden enviar a usuarios que han interactuado primero (ventana de 24h)',
    ],
  },
  {
    key: 'email',
    name: 'Email (Resend)',
    icon: '📧',
    color: '#3B82F6',
    description: 'Enviar emails transaccionales y de marketing',
    descriptionEn: 'Send transactional and marketing emails',
    provider: 'resend',
    steps: [
      { label: 'Crea una cuenta en Resend', labelEn: 'Create a Resend account', url: 'https://resend.com', urlLabel: 'Abrir Resend' },
      { label: 'Verifica tu dominio en Resend → Domains', labelEn: 'Verify your domain in Resend → Domains' },
      { label: 'Genera un API Key en Resend → API Keys', labelEn: 'Generate an API Key in Resend → API Keys' },
      { label: 'Pega tu API Key y configura el remitente', labelEn: 'Paste your API Key and configure the sender' },
    ],
    fields: [
      { key: 'apiKey', label: 'Resend API Key', labelEn: 'Resend API Key', type: 'password', placeholder: 're_xxxxxxxxxxxx' },
      { key: 'fromEmail', label: 'Email del remitente', labelEn: 'Sender email', type: 'email', placeholder: 'noreply@tudominio.com' },
      { key: 'fromName', label: 'Nombre del remitente', labelEn: 'Sender name', type: 'text', placeholder: 'Tu Empresa' },
    ],
    troubleshooting: [
      'El dominio debe estar verificado con los registros DNS correctos',
      'Usa un email del dominio verificado como remitente',
      'Los API keys de tipo "Sending" son suficientes',
    ],
  },
  {
    key: 'n8n',
    name: 'N8n Workflows',
    icon: '⚡',
    color: '#FF6D00',
    description: 'Automatizaciones y workflows con N8n',
    descriptionEn: 'Automations and workflows with N8n',
    provider: 'n8n',
    steps: [
      { label: 'Instala N8n (self-hosted) o crea cuenta en n8n.cloud', labelEn: 'Install N8n (self-hosted) or create n8n.cloud account', url: 'https://n8n.io', urlLabel: 'Abrir N8n' },
      { label: 'Ve a Settings → API → genera un API Key', labelEn: 'Go to Settings → API → generate an API Key' },
      { label: 'Copia la URL de tu instancia', labelEn: 'Copy your instance URL' },
    ],
    fields: [
      { key: 'instanceUrl', label: 'URL de instancia', labelEn: 'Instance URL', type: 'text', placeholder: 'https://n8n.tudominio.com' },
      { key: 'apiKey', label: 'N8n API Key', labelEn: 'N8n API Key', type: 'password', placeholder: 'n8n_api_xxxx' },
    ],
    troubleshooting: [
      'Asegurate de que tu instancia de N8n es accesible desde internet',
      'El API Key necesita permisos de lectura y ejecucion',
    ],
  },
]

// ─── Styles ───
function getS(m) {
  return {
    page: { padding: m ? '0 12px 32px' : '0 24px 40px', maxWidth: 960, margin: '0 auto' },
    card: {
      background: 'var(--bg-card, rgba(255,255,255,0.03))',
      borderRadius: 16, border: '1px solid var(--border, rgba(255,255,255,0.06))',
      overflow: 'hidden', marginBottom: 14, transition: 'all 0.25s',
    },
    header: {
      display: 'flex', alignItems: 'center', gap: 14, padding: m ? '14px 16px' : '18px 22px',
      cursor: 'pointer', userSelect: 'none',
    },
    iconBox: (color) => ({
      width: 42, height: 42, borderRadius: 12,
      background: `${color}15`, border: `1px solid ${color}25`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '1.2rem', flexShrink: 0,
    }),
    statusDot: (connected) => ({
      width: 10, height: 10, borderRadius: '50%',
      background: connected ? '#22C55E' : 'rgba(255,255,255,0.15)',
      border: connected ? '1px solid #22C55E40' : '1px solid rgba(255,255,255,0.1)',
      flexShrink: 0,
    }),
    body: { padding: m ? '0 16px 18px' : '0 22px 24px' },
    step: {
      background: 'var(--bg, rgba(255,255,255,0.02))',
      border: '1px solid var(--border, rgba(255,255,255,0.06))',
      borderRadius: 10, padding: '12px 14px', marginBottom: 8,
    },
    input: {
      width: '100%', padding: '10px 14px',
      background: 'var(--bg, rgba(255,255,255,0.02))',
      border: '1px solid var(--border, rgba(255,255,255,0.06))',
      borderRadius: 10, color: 'var(--text, #fff)',
      fontSize: 14, outline: 'none', boxSizing: 'border-box',
    },
    btn: (variant = 'primary', color = 'var(--orange, #FF6B00)') => ({
      padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
      fontSize: 13, fontWeight: 600, border: 'none',
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: variant === 'primary' ? color : 'rgba(255,255,255,0.06)',
      color: variant === 'primary' ? '#fff' : 'var(--text-secondary, rgba(255,255,255,0.5))',
      transition: 'all 0.2s',
    }),
    label: { fontSize: 11, color: 'var(--text-secondary, rgba(255,255,255,0.5))', fontWeight: 600, marginBottom: 6, display: 'block' },
    hint: { fontSize: 11, color: 'var(--text-secondary, rgba(255,255,255,0.4))', marginTop: 4 },
    saved: { color: '#22C55E', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 },
  }
}

const ENJAMBRE_API = import.meta.env.VITE_ENJAMBRE_API_URL || 'https://enjambre.blackwolfsec.io'

// ─── WhatsApp QR Panel ───
function WhatsAppQRPanel({ en, s, color, clientId, onConnectedChange }) {
  const [waStatus, setWaStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [restarting, setRestarting] = useState(false)
  const [lastConnected, setLastConnected] = useState(null)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const url = clientId
          ? `${ENJAMBRE_API}/api/whatsapp/status?clientId=${clientId}`
          : `${ENJAMBRE_API}/api/whatsapp/status`
        const res = await fetch(url)
        if (res.ok) {
          const status = await res.json()
          setWaStatus(status)
          if (onConnectedChange && status.connected !== lastConnected) {
            setLastConnected(status.connected)
            onConnectedChange(status.connected)
          }
        }
      } catch {}
      setLoading(false)
    }
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [clientId, lastConnected])

  async function handleRestart() {
    setRestarting(true)
    try {
      await fetch(`${ENJAMBRE_API}/api/whatsapp/restart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })
      setTimeout(async () => {
        try {
          const url = clientId
            ? `${ENJAMBRE_API}/api/whatsapp/status?clientId=${clientId}`
            : `${ENJAMBRE_API}/api/whatsapp/status`
          const res = await fetch(url)
          if (res.ok) setWaStatus(await res.json())
        } catch {}
        setRestarting(false)
      }, 4000)
    } catch { setRestarting(false) }
  }

  if (loading) return <div style={{ padding: 12, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{en ? 'Checking WhatsApp status...' : 'Verificando estado de WhatsApp...'}</div>

  const connected = waStatus?.connected
  const qrImage = waStatus?.qrImage

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>
        {en ? 'WhatsApp Connection' : 'Conexion WhatsApp'}
      </div>

      {/* Status badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600,
          background: connected ? 'rgba(34,197,94,0.1)' : qrImage ? 'rgba(255,184,0,0.1)' : 'rgba(239,68,68,0.1)',
          color: connected ? '#22C55E' : qrImage ? '#FFB800' : '#EF4444',
          border: `1px solid ${connected ? 'rgba(34,197,94,0.2)' : qrImage ? 'rgba(255,184,0,0.2)' : 'rgba(239,68,68,0.2)'}`,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? '#22C55E' : qrImage ? '#FFB800' : '#EF4444' }} />
          {connected ? (en ? 'Connected' : 'Conectado') : qrImage ? (en ? 'Scan QR' : 'Escanea el QR') : (en ? 'Disconnected' : 'Desconectado')}
        </div>
        {waStatus?.activeConversations > 0 && (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
            {waStatus.activeConversations} {en ? 'active chats' : 'chats activos'}
          </span>
        )}
      </div>

      {/* QR Code */}
      {!connected && qrImage && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ background: '#fff', padding: 14, borderRadius: 14, display: 'inline-block' }}>
            <img src={qrImage} alt="QR" style={{ display: 'block', width: 200, height: 200 }} />
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>
            {en ? 'Open WhatsApp → Linked Devices → Scan this code' : 'Abre WhatsApp → Dispositivos vinculados → Escanea este codigo'}
          </div>
        </div>
      )}

      {/* Connected message */}
      {connected && (
        <div style={{ ...s.step, borderColor: 'rgba(34,197,94,0.15)', background: 'rgba(34,197,94,0.06)', marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: '#fff' }}>
            {en ? 'WhatsApp is connected and processing messages automatically.' : 'WhatsApp esta conectado y procesando mensajes automaticamente.'}
          </div>
        </div>
      )}

      {/* Restart / Generate QR button */}
      <button
        onClick={handleRestart}
        disabled={restarting}
        style={{
          ...s.btn('secondary'),
          opacity: restarting ? 0.5 : 1,
          cursor: restarting ? 'not-allowed' : 'pointer',
        }}
      >
        {restarting ? (en ? 'Restarting...' : 'Reiniciando...') : connected ? (en ? 'Reconnect' : 'Reconectar') : (en ? 'Generate new QR' : 'Generar nuevo QR')}
      </button>
    </div>
  )
}

// ─── Integration Card ───
function IntegrationCard({ integration, en, m, formData, setFormData, onSave, saving, savedKey, connectionStatus, clientSlug, clientId, onConnectedChange }) {
  const [expanded, setExpanded] = useState(false)
  const [showTroubleshooting, setShowTroubleshooting] = useState(false)
  const s = getS(m)
  const connected = connectionStatus[integration.key]
  const isShared = integration.sharedWith

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ ...s.card, borderColor: expanded ? `${integration.color}30` : undefined }}
    >
      {/* Header */}
      <div style={s.header} onClick={() => setExpanded(!expanded)}>
        <div style={s.iconBox(integration.color)}>{integration.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
            {integration.name}
            <span style={s.statusDot(connected)} title={connected ? 'Connected' : 'Not configured'} />
          </div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
            {en ? integration.descriptionEn : integration.description}
          </div>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          ▾
        </span>
      </div>

      {/* Body */}
      {expanded && (
        <div style={s.body}>
          {/* Shared notice */}
          {isShared && (
            <div style={{ ...s.step, borderColor: `${integration.color}20`, background: `${integration.color}08`, marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: integration.color, fontWeight: 600 }}>
                {en ? `Uses the same credentials as ${INTEGRATIONS.find(i => i.key === isShared)?.name}` : `Usa las mismas credenciales que ${INTEGRATIONS.find(i => i.key === isShared)?.name}`}
              </div>
            </div>
          )}

          {/* Setup Steps */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>
              {en ? 'Setup Guide' : 'Guia de Configuracion'}
            </div>
            {integration.steps.map((step, i) => (
              <div key={i} style={s.step}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 22, height: 22, borderRadius: 7, background: `${integration.color}20`, color: integration.color, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--text, #fff)', lineHeight: 1.4 }}>
                      {en ? step.labelEn : step.label}
                    </div>
                    {step.url && (
                      <a href={step.url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 12, color: integration.color, textDecoration: 'none', marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {step.urlLabel || 'Open'} →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Input Fields */}
          {integration.fields.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>
                {en ? 'Credentials' : 'Credenciales'}
              </div>
              {integration.fields.map(field => (
                <div key={field.key} style={{ marginBottom: 12 }}>
                  <label style={s.label}>{en ? field.labelEn : field.label}</label>
                  <input
                    style={s.input}
                    type={field.type}
                    value={formData[integration.key]?.[field.key] || ''}
                    onChange={e => setFormData(prev => ({
                      ...prev,
                      [integration.key]: { ...(prev[integration.key] || {}), [field.key]: e.target.value }
                    }))}
                    placeholder={field.placeholder}
                  />
                </div>
              ))}

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
                <button
                  onClick={() => onSave(integration.key)}
                  disabled={saving === integration.key}
                  style={s.btn('primary', integration.color)}
                >
                  {saving === integration.key ? (en ? 'Saving...' : 'Guardando...') : (en ? 'Save' : 'Guardar')}
                </button>
                {savedKey === integration.key && (
                  <span style={s.saved}>✓ {en ? 'Saved' : 'Guardado'}</span>
                )}
              </div>
            </div>
          )}

          {/* WhatsApp QR Code */}
          {integration.hasQR && <WhatsAppQRPanel en={en} s={s} color={integration.color} clientId={clientId} onConnectedChange={onConnectedChange} />}

          {/* Webhook URL for inbound messages */}
          {integration.showWebhook && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>
                {en ? 'Inbound Webhook URL' : 'URL Webhook de Entrada'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg, rgba(255,255,255,0.02))', borderRadius: 8, border: '1px solid var(--border, rgba(255,255,255,0.06))', padding: '8px 12px' }}>
                <code style={{ flex: 1, fontSize: 11, color: 'var(--text, #fff)', wordBreak: 'break-all' }}>
                  {API_URL}{integration.webhookPath}?clientSlug={clientSlug}
                </code>
                <button
                  onClick={() => { navigator.clipboard.writeText(`${API_URL}${integration.webhookPath}?clientSlug=${clientSlug}`).catch(() => {}) }}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                >
                  Copy
                </button>
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                {en
                  ? 'Configure this URL in Meta → WhatsApp → Configuration → Webhook URL'
                  : 'Configura esta URL en Meta → WhatsApp → Configuration → Webhook URL'}
              </div>
            </div>
          )}

          {/* Troubleshooting */}
          {integration.troubleshooting?.length > 0 && (
            <div>
              <button
                onClick={() => setShowTroubleshooting(!showTroubleshooting)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 12, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                {showTroubleshooting ? '▾' : '▸'} {en ? 'Troubleshooting' : 'Solucion de problemas'}
              </button>
              {showTroubleshooting && (
                <div style={{ marginTop: 8 }}>
                  {integration.troubleshooting.map((tip, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', padding: '4px 0', display: 'flex', gap: 6 }}>
                      <span style={{ color: '#F59E0B' }}>!</span> {tip}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ─── Main Page ───
export default function IntegrationsPage() {
  const { clientSlug, clientId } = useClient()
  const { getEmailConfig, saveEmailConfig, getManychatConfig, saveManychatConfig, getN8nConfig, saveN8nConfig, getUserIntegrations, saveUserIntegration, getWhatsappConfig, saveWhatsappConfig } = useClientData()
  const en = clientSlug === 'black-wolf'
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const h = e => setM(e.matches)
    setM(mq.matches); mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])

  const s = getS(m)

  // Load configs
  const [emailConfig] = useAsync(() => getEmailConfig(), null)
  const [manychatConfig] = useAsync(() => getManychatConfig(), null)
  const [whatsappConfig] = useAsync(() => getWhatsappConfig(), null)
  const [n8nConfig] = useAsync(() => getN8nConfig(), null)

  const [formData, setFormData] = useState({})
  const [saving, setSaving] = useState(null)
  const [savedKey, setSavedKey] = useState(null)

  // Populate forms when configs load
  useEffect(() => {
    if (emailConfig) {
      setFormData(prev => ({ ...prev, email: {
        apiKey: emailConfig.apiKey || '',
        fromEmail: emailConfig.fromEmail || '',
        fromName: emailConfig.fromName || '',
      }}))
    }
  }, [emailConfig])

  useEffect(() => {
    if (whatsappConfig) {
      setFormData(prev => ({ ...prev, whatsapp: {
        allowedNumbers: whatsappConfig.allowedNumbers || '',
        groupId: whatsappConfig.groupId || '',
      }}))
    }
  }, [whatsappConfig])

  useEffect(() => {
    if (manychatConfig) {
      setFormData(prev => ({ ...prev, instagram: {
        apiKey: manychatConfig.apiKey || '',
      }}))
    }
  }, [manychatConfig])

  useEffect(() => {
    if (n8nConfig) {
      setFormData(prev => ({ ...prev, n8n: {
        instanceUrl: n8nConfig.webhookUrl || '',
        apiKey: n8nConfig.apiKey || '',
      }}))
    }
  }, [n8nConfig])

  // Connection status
  const connectionStatus = {
    whatsapp: !!(whatsappConfig?.connected),
    instagram: !!(manychatConfig?.apiKey),
    email: !!(emailConfig?.apiKey),
    n8n: !!(n8nConfig?.apiKey && n8nConfig?.enabled),
  }

  async function handleSave(key) {
    setSaving(key)
    try {
      if (key === 'whatsapp') {
        await saveWhatsappConfig({
          allowedNumbers: formData.whatsapp?.allowedNumbers || '',
          groupId: formData.whatsapp?.groupId || '',
        })
      } else if (key === 'instagram') {
        await saveManychatConfig({
          apiKey: formData.instagram?.apiKey || '',
        })
      } else if (key === 'email') {
        await saveEmailConfig({
          resendApiKey: formData.email?.apiKey || '',
          fromEmail: formData.email?.fromEmail || '',
          fromName: formData.email?.fromName || '',
        })
      } else if (key === 'n8n') {
        await saveN8nConfig({
          id: n8nConfig?.id || undefined,
          webhookUrl: formData.n8n?.instanceUrl || '',
          apiKey: formData.n8n?.apiKey || '',
          enabled: true,
        })
      }
      setSavedKey(key)
      setTimeout(() => setSavedKey(null), 2500)
    } catch (err) {
      console.error('Save error:', err)
    }
    setSaving(null)
  }

  const connectedCount = Object.values(connectionStatus).filter(Boolean).length

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, color: '#fff', fontSize: m ? '1.1rem' : '1.3rem', fontWeight: 700, letterSpacing: -0.3 }}>
          {en ? 'Integrations' : 'Integraciones'}
        </h2>
        <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
          {en
            ? `Connect your APIs to enable messaging, automation and more. ${connectedCount}/4 connected.`
            : `Conecta tus APIs para habilitar mensajeria, automatizacion y mas. ${connectedCount}/4 conectadas.`
          }
        </p>
      </div>

      {/* Webhook URL info */}
      <div style={{ ...s.card, padding: m ? 14 : 18, marginBottom: 20, borderColor: 'rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>
          Webhook URL
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg, rgba(255,255,255,0.02))', borderRadius: 8, border: '1px solid var(--border, rgba(255,255,255,0.06))', padding: '8px 12px' }}>
          <code style={{ flex: 1, fontSize: 12, color: 'var(--text, #fff)', wordBreak: 'break-all' }}>
            {API_URL}/api/webhook/sale?clientSlug={clientSlug}
          </code>
          <button
            onClick={() => { navigator.clipboard.writeText(`${API_URL}/api/webhook/sale?clientSlug=${clientSlug}`).catch(() => {}) }}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 11 }}
          >
            Copy
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
          {en ? 'Use this URL to receive webhooks from external systems (Close CRM, Meta, etc.)' : 'Usa esta URL para recibir webhooks de sistemas externos (Close CRM, Meta, etc.)'}
        </div>
      </div>

      {/* Integration Cards */}
      {INTEGRATIONS.map(integration => (
        <IntegrationCard
          key={integration.key}
          integration={integration}
          en={en}
          m={m}
          formData={formData}
          setFormData={setFormData}
          onSave={handleSave}
          saving={saving}
          savedKey={savedKey}
          connectionStatus={connectionStatus}
          clientSlug={clientSlug}
          clientId={clientId}
          onConnectedChange={async (connected) => {
            if (integration.key === 'whatsapp') {
              try { await saveWhatsappConfig({ connected }) } catch {}
            }
          }}
        />
      ))}
    </div>
  )
}
