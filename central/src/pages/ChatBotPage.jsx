import { useState, useMemo, useEffect } from 'react'
import { useClientData } from '../hooks/useClientData'
import { useAsync } from '../hooks/useAsync'
import { MessageCircle, Zap, Users, Radio, Settings, Plus, Trash2, Send, Search, Bot, Instagram, Phone, X, Check, AlertCircle, Loader, RefreshCw, UserPlus, ArrowRight } from 'lucide-react'

const TABS = [
  { id: 'subscribers', label: 'Suscriptores', icon: Users },
  { id: 'sync-crm', label: 'Sync a CRM', icon: UserPlus },
  { id: 'config', label: 'Configuracion', icon: Settings },
]

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, flex: 1, minWidth: 170 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Icon size={16} style={{ color: color || 'var(--orange)' }} />
        <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
    </div>
  )
}

export default function ChatBotPage() {
  const { getChatContacts, addChatContact, deleteChatContact, getManychatConfig, saveManychatConfig, syncManychatSubscribers, syncManychatToCrm, getCrmContacts } = useClientData()

  const [contacts, contactsLoading, refreshContacts] = useAsync(getChatContacts, [])
  const [mcConfig, configLoading, refreshConfig] = useAsync(getManychatConfig, null)
  const [crmContacts, crmLoading] = useAsync(getCrmContacts, [])

  const [tab, setTab] = useState('subscribers')
  const [search, setSearch] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [syncCrmResult, setSyncCrmResult] = useState(null)

  // Config form
  const [configForm, setConfigForm] = useState(null)
  const [configSaving, setConfigSaving] = useState(false)
  const [configSaved, setConfigSaved] = useState(false)

  // CRM sync selection
  const [selectedContacts, setSelectedContacts] = useState({})
  const [syncingCrm, setSyncingCrm] = useState(false)

  const loading = contactsLoading || configLoading

  const hasApiKey = !!(mcConfig?.apiKey)

  // Stats
  const totalContacts = contacts.length
  const withEmail = contacts.filter(c => c.email).length
  const withPhone = contacts.filter(c => c.phone).length
  const crmEmails = new Set((crmContacts || []).map(c => (c.email || '').toLowerCase()).filter(Boolean))
  const crmInstagrams = new Set((crmContacts || []).map(c => (c.instagram || '').toLowerCase()).filter(Boolean))
  const notInCrm = contacts.filter(c => {
    if (c.email && crmEmails.has(c.email.toLowerCase())) return false
    if (c.username && crmInstagrams.has(c.username.toLowerCase())) return false
    return true
  })

  const filteredContacts = useMemo(() => {
    if (!search) return contacts
    return contacts.filter(c => (c.name + ' ' + c.username + ' ' + c.email + ' ' + c.phone).toLowerCase().includes(search.toLowerCase()))
  }, [contacts, search])

  // Handlers
  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const result = await syncManychatSubscribers()
      setSyncResult({ success: true, ...result })
      refreshContacts()
    } catch (e) {
      setSyncResult({ success: false, error: e.message })
    }
    setSyncing(false)
  }

  const handleSyncToCrm = async () => {
    const ids = Object.entries(selectedContacts).filter(([, v]) => v).map(([k]) => k)
    if (ids.length === 0) return
    setSyncingCrm(true)
    setSyncCrmResult(null)
    try {
      const result = await syncManychatToCrm(ids)
      setSyncCrmResult({ success: true, ...result })
      setSelectedContacts({})
    } catch (e) {
      setSyncCrmResult({ success: false, error: e.message })
    }
    setSyncingCrm(false)
  }

  const handleSaveConfig = async (e) => {
    e.preventDefault()
    setConfigSaving(true)
    try {
      await saveManychatConfig(configForm)
      refreshConfig()
      setConfigSaved(true)
      setTimeout(() => setConfigSaved(false), 3000)
    } catch (e) {
      alert('Error: ' + e.message)
    }
    setConfigSaving(false)
  }

  if (loading) return <div className="dashboard"><div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Cargando...</div></div>

  return (
    <div className="dashboard">
      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard icon={Users} label="Suscriptores ManyChat" value={totalContacts} />
        <StatCard icon={Instagram} label="Con email" value={withEmail} color="#22c55e" />
        <StatCard icon={Phone} label="Con telefono" value={withPhone} color="#60a5fa" />
        <StatCard icon={UserPlus} label="No estan en CRM" value={notInCrm.length} color="#fbbf24" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-card)', borderRadius: 10, padding: 4, border: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: tab === t.id ? 'var(--orange)' : 'transparent', color: tab === t.id ? '#fff' : 'var(--text-secondary)', transition: 'all .2s' }}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {/* API key warning */}
      {!hasApiKey && tab !== 'config' && (
        <div onClick={() => setTab('config')} style={{ padding: '12px 20px', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', cursor: 'pointer' }}>
          <AlertCircle size={16} style={{ color: '#fbbf24' }} />
          <span style={{ color: '#fbbf24', fontSize: 13, fontWeight: 600 }}>Conecta tu cuenta de ManyChat. Click aqui para configurar.</span>
        </div>
      )}

      {/* Sync result */}
      {syncResult && (
        <div style={{ padding: '12px 20px', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, background: syncResult.success ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${syncResult.success ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
          {syncResult.success ? <Check size={16} style={{ color: '#22c55e' }} /> : <AlertCircle size={16} style={{ color: '#ef4444' }} />}
          <span style={{ color: syncResult.success ? '#22c55e' : '#ef4444', fontSize: 13, fontWeight: 600 }}>
            {syncResult.success ? `Sincronizados ${syncResult.synced} suscriptores de ManyChat` : `Error: ${syncResult.error}`}
          </span>
          <button onClick={() => setSyncResult(null)} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={14} /></button>
        </div>
      )}

      {/* SUBSCRIBERS TAB */}
      {tab === 'subscribers' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ color: 'var(--text)', margin: 0, fontSize: 18 }}>Suscriptores de ManyChat</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ padding: '8px 12px 8px 30px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }} />
              </div>
              <button onClick={handleSync} disabled={syncing || !hasApiKey}
                style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: hasApiKey ? 'var(--orange)' : 'rgba(255,255,255,0.1)', color: hasApiKey ? '#fff' : '#666', cursor: hasApiKey ? 'pointer' : 'default', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                {syncing ? <Loader size={14} /> : <RefreshCw size={14} />}
                {syncing ? 'Sincronizando...' : 'Sincronizar ManyChat'}
              </button>
            </div>
          </div>

          {contacts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <Bot size={48} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p style={{ margin: '0 0 8px' }}>No hay suscriptores sincronizados</p>
              <p style={{ fontSize: 13 }}>Conecta tu ManyChat y pulsa "Sincronizar" para importar tus suscriptores.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Contacto</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Telefono</th>
                    <th>Tags</th>
                    <th>Ultima interaccion</th>
                    <th>En CRM</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map(c => {
                    const tags = Array.isArray(c.tags) ? c.tags : (typeof c.tags === 'string' ? (() => { try { return JSON.parse(c.tags) } catch { return [] } })() : [])
                    const inCrm = (c.email && crmEmails.has(c.email.toLowerCase())) || (c.username && crmInstagrams.has(c.username.toLowerCase()))
                    return (
                      <tr key={c.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,107,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange)' }}>{(c.name || '?')[0].toUpperCase()}</span>
                            </div>
                            <span className="cell-bold">{c.name || '—'}</span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{c.username ? '@' + c.username : '—'}</td>
                        <td>{c.email || '—'}</td>
                        <td>{c.phone || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {tags.slice(0, 3).map((t, i) => (
                              <span key={i} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, background: 'rgba(255,107,0,0.1)', color: 'var(--orange)' }}>{typeof t === 'string' ? t : t.name || t}</span>
                            ))}
                            {tags.length > 3 && <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>+{tags.length - 3}</span>}
                          </div>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.lastInteraction ? new Date(c.lastInteraction).toLocaleDateString() : '—'}</td>
                        <td>
                          {inCrm
                            ? <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>Si</span>
                            : <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>No</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {mcConfig?.lastSync && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>
              Ultima sincronizacion: {new Date(mcConfig.lastSync).toLocaleString()}
            </div>
          )}
        </>
      )}

      {/* SYNC TO CRM TAB */}
      {tab === 'sync-crm' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ color: 'var(--text)', margin: 0, fontSize: 18 }}>Enviar contactos al CRM</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '4px 0 0' }}>Selecciona contactos de ManyChat para anadirlos como leads en tu CRM</p>
            </div>
            <button onClick={handleSyncToCrm} disabled={syncingCrm || Object.values(selectedContacts).filter(Boolean).length === 0}
              style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: Object.values(selectedContacts).filter(Boolean).length > 0 ? 'var(--orange)' : 'rgba(255,255,255,0.1)', color: Object.values(selectedContacts).filter(Boolean).length > 0 ? '#fff' : '#666', cursor: Object.values(selectedContacts).filter(Boolean).length > 0 ? 'pointer' : 'default', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              {syncingCrm ? <Loader size={14} /> : <UserPlus size={14} />}
              {syncingCrm ? 'Sincronizando...' : `Enviar ${Object.values(selectedContacts).filter(Boolean).length} al CRM`}
            </button>
          </div>

          {syncCrmResult && (
            <div style={{ padding: '12px 20px', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, background: syncCrmResult.success ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${syncCrmResult.success ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
              {syncCrmResult.success ? <Check size={16} style={{ color: '#22c55e' }} /> : <AlertCircle size={16} style={{ color: '#ef4444' }} />}
              <span style={{ color: syncCrmResult.success ? '#22c55e' : '#ef4444', fontSize: 13, fontWeight: 600 }}>
                {syncCrmResult.success ? `${syncCrmResult.added} contactos anadidos al CRM, ${syncCrmResult.skipped} ya existian` : `Error: ${syncCrmResult.error}`}
              </span>
              <button onClick={() => setSyncCrmResult(null)} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={14} /></button>
            </div>
          )}

          {notInCrm.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <Check size={48} style={{ marginBottom: 12, opacity: 0.3, color: '#22c55e' }} />
              <p>Todos los contactos de ManyChat ya estan en el CRM.</p>
            </div>
          ) : (
            <>
              <div style={{ padding: '12px 20px', background: 'var(--bg-card)', borderRadius: '10px 10px 0 0', border: '1px solid var(--border)', borderBottom: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
                  <input type="checkbox"
                    checked={notInCrm.length > 0 && notInCrm.every(c => selectedContacts[c.id])}
                    onChange={() => {
                      const allSelected = notInCrm.every(c => selectedContacts[c.id])
                      const next = { ...selectedContacts }
                      notInCrm.forEach(c => { next[c.id] = !allSelected })
                      setSelectedContacts(next)
                    }}
                    style={{ accentColor: 'var(--orange)' }}
                  />
                  Seleccionar todos ({notInCrm.length} contactos no estan en CRM)
                </label>
                <span style={{ fontSize: 12, color: 'var(--orange)', fontWeight: 600 }}>{Object.values(selectedContacts).filter(Boolean).length} seleccionados</span>
              </div>
              <div className="table-wrapper" style={{ borderRadius: '0 0 10px 10px' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}></th>
                      <th>Contacto</th>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Telefono</th>
                      <th>Tags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notInCrm.map(c => {
                      const tags = Array.isArray(c.tags) ? c.tags : (typeof c.tags === 'string' ? (() => { try { return JSON.parse(c.tags) } catch { return [] } })() : [])
                      return (
                        <tr key={c.id} onClick={() => setSelectedContacts(prev => ({ ...prev, [c.id]: !prev[c.id] }))} style={{ cursor: 'pointer' }}>
                          <td><input type="checkbox" checked={!!selectedContacts[c.id]} onChange={() => {}} style={{ accentColor: 'var(--orange)' }} /></td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,107,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange)' }}>{(c.name || '?')[0].toUpperCase()}</span>
                              </div>
                              <span className="cell-bold">{c.name || '—'}</span>
                            </div>
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>{c.username ? '@' + c.username : '—'}</td>
                          <td>{c.email || '—'}</td>
                          <td>{c.phone || '—'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {tags.slice(0, 3).map((t, i) => (
                                <span key={i} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, background: 'rgba(255,107,0,0.1)', color: 'var(--orange)' }}>{typeof t === 'string' ? t : t.name || t}</span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* CONFIG TAB */}
      {tab === 'config' && (() => {
        const cf = configForm || mcConfig || { apiKey: '', pageId: '', webhookSecret: '', autoSyncCrm: false, syncTags: '' }
        if (!configForm) setTimeout(() => setConfigForm({ ...cf }), 0)

        return (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ color: 'var(--text)', margin: 0, fontSize: 18 }}>Configuracion de ManyChat</h3>
              {configSaved && <span style={{ color: '#22c55e', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={14} /> Guardado</span>}
            </div>

            <form onSubmit={handleSaveConfig}>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
                {/* ManyChat branding */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'rgba(0,132,255,0.08)', borderRadius: 8, border: '1px solid rgba(0,132,255,0.2)' }}>
                    <MessageCircle size={16} style={{ color: '#0084FF' }} />
                    <span style={{ fontWeight: 600, color: '#0084FF', fontSize: 14 }}>ManyChat</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                    Conecta tu cuenta de ManyChat para sincronizar suscriptores automaticamente y enviarlos al CRM.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>API Key de ManyChat *</label>
                    <input
                      type="password"
                      value={cf.apiKey || ''}
                      onChange={e => setConfigForm({ ...cf, apiKey: e.target.value })}
                      placeholder="Tu API Key de ManyChat..."
                      required
                      style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, fontFamily: 'monospace' }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                      Ve a ManyChat → Settings → API → Copiar el token
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Page ID (opcional)</label>
                    <input
                      value={cf.pageId || ''}
                      onChange={e => setConfigForm({ ...cf, pageId: e.target.value })}
                      placeholder="ID de tu pagina de Facebook/IG"
                      style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Tags para auto-sync al CRM</label>
                    <input
                      value={cf.syncTags || ''}
                      onChange={e => setConfigForm({ ...cf, syncTags: e.target.value })}
                      placeholder="lead, cliente, interesado"
                      style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                      Contactos con estos tags se sincronizaran automaticamente al CRM
                    </div>
                  </div>
                </div>

                {/* Webhook info */}
                <div style={{ marginTop: 24, padding: 16, background: 'rgba(59,130,246,0.08)', borderRadius: 10, border: '1px solid rgba(59,130,246,0.2)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#60a5fa', marginBottom: 8 }}>Webhook para ManyChat (automatico)</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                    Para sincronizar automaticamente cuando un contacto se etiqueta en ManyChat:<br />
                    1. En ManyChat → Settings → API → Webhooks<br />
                    2. Anade esta URL: <code style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{window.location.origin}/api/webhook/manychat</code><br />
                    3. Selecciona los eventos: <strong>subscriber_created</strong>, <strong>tag_added</strong><br />
                    4. Cada vez que alguien se suscriba o reciba un tag, se anadira al CRM automaticamente
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
                  <button type="submit" disabled={configSaving} className="btn-action" style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: configSaving ? 0.6 : 1 }}>
                    {configSaving ? <Loader size={14} /> : <Check size={14} />}
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
