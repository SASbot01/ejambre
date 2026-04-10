import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useClient } from '../contexts/ClientContext'
import { useClientData } from '../hooks/useClientData'
import { useAsync } from '../hooks/useAsync'

// Parse stages safely — handles both JSON string and array
function parseStages(stages) {
  if (!stages) return null
  if (Array.isArray(stages)) return stages
  if (typeof stages === 'string') {
    try { const parsed = JSON.parse(stages); return Array.isArray(parsed) ? parsed : null } catch { return null }
  }
  return null
}
import ImportModal from '../components/ImportModal'
import StoreCreationModal from '../components/StoreCreationModal'
import {
  Search, Plus, Settings, X, ChevronDown, ChevronLeft, ChevronRight,
  Phone, Mail, Building2, User, Tag, Calendar, DollarSign,
  Clock, MessageSquare, Video, FileText, Trash2, Edit3,
  Filter, LayoutGrid, List, Eye, Save, Globe, Hash, CheckSquare, Link, MailIcon,
  Palette, ArrowUp, ArrowDown, Upload, Paperclip, MapPin, ExternalLink,
  Check, Square, Flag,
} from 'lucide-react'

// ─── Constants ──────────────────────────────────────────────────────────────────
const DEFAULT_STATUSES = [
  { key: 'lead',        label: 'Lead',         color: '#6B7280' },
  { key: 'contacted',   label: 'Contactado',   color: '#3B82F6' },
  { key: 'qualified',   label: 'Cualificado',  color: '#8B5CF6' },
  { key: 'proposal',    label: 'Propuesta',    color: '#F59E0B' },
  { key: 'negotiation', label: 'Negociación',  color: '#FF6B00' },
  { key: 'won',         label: 'Ganado',       color: '#22C55E' },
  { key: 'lost',        label: 'Perdido',      color: '#EF4444' },
]

const ACTIVITY_TYPES = [
  { key: 'call',     label: 'Llamada',  icon: Phone },
  { key: 'email',    label: 'Email',    icon: Mail },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { key: 'meeting',  label: 'Reunión',  icon: Video },
  { key: 'note',     label: 'Nota',     icon: FileText },
]

const FIELD_TYPE_ICONS = {
  text: FileText, number: Hash, date: Calendar, select: ChevronDown,
  checkbox: CheckSquare, url: Link, email: MailIcon, phone: Phone, currency: DollarSign,
}
const FIELD_TYPES = ['text', 'number', 'date', 'datetime', 'select', 'checkbox', 'url', 'email', 'phone', 'currency']
const SOURCE_OPTIONS = ['Website', 'Referral', 'Social Media', 'Cold Call', 'Ad Campaign', 'Event', 'Other']
const STAGE_COLORS = [
  '#6B7280', '#3B82F6', '#8B5CF6', '#F59E0B', '#FF6B00',
  '#22C55E', '#EF4444', '#EC4899', '#14B8A6', '#F97316',
  '#06B6D4', '#A855F7', '#84CC16', '#E11D48',
]

const FILTER_FIELDS = [
  { key: 'status', label: 'Estado', type: 'select' },
  { key: 'assigned_closer', label: 'Closer', type: 'select' },
  { key: 'assigned_setter', label: 'Setter', type: 'select' },
  { key: 'assigned_cold_caller', label: 'Cold Caller', type: 'select' },
  { key: 'source', label: 'Fuente', type: 'select' },
  { key: 'company', label: 'Empresa', type: 'text' },
  { key: 'country', label: 'País', type: 'text' },
  { key: 'tags', label: 'Tags', type: 'text' },
  { key: 'dealValue', label: 'Valor', type: 'number' },
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'phone', label: 'Teléfono', type: 'text' },
  { key: 'name', label: 'Nombre', type: 'text' },
  { key: 'notes', label: 'Notas', type: 'text' },
  { key: 'updated_at', label: 'Último cambio', type: 'date' },
  { key: 'created_at', label: 'Fecha creación', type: 'date' },
]
const FILTER_OPS = [
  { key: 'equals', label: 'es igual a' },
  { key: 'not_equals', label: 'no es igual a' },
  { key: 'contains', label: 'contiene' },
  { key: 'gt', label: 'mayor que' },
  { key: 'lt', label: 'menor que' },
  { key: 'is_empty', label: 'está vacío' },
  { key: 'is_not_empty', label: 'no está vacío' },
  { key: 'in_last', label: 'en los últimos' },
]

const emptyContact = {
  name: '', email: '', phone: '', company: '', status: 'lead',
  assigned_closer: '', assigned_setter: '', assigned_cold_caller: '',
  source: '', tags: '', notes: '',
  address: '', whatsapp: '', zoom_link: '', website: '', instagram: '', country: '',
  pipelineId: '', customFields: '',
  // Lead profile
  producto_interes: '', capital_disponible: '', situacion_actual: '',
  exp_amazon: '', decisor_confirmado: '', fecha_llamada: '',
  // UTMs & Attribution
  utm_source: '', utm_medium: '', utm_campaign: '', utm_content: '',
  triager: '', gestor_asignado: '',
  // Payment
  deal_value: '', product: '', payment_type: '', payment_method: '',
  // Facturación / Empresa
  owner_name: '', owner_email: '', billing_annual: '', billing_cif: '', billing_address: '',
}

// ─── Utility ────────────────────────────────────────────────────────────────────
const fmt = (v) => {
  const n = Number(v)
  if (!n && n !== 0) return '—'
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })
}
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
const generateFieldKey = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

// ─── Filter matching ────────────────────────────────────────────────────────────
function matchesFilter(contact, filter) {
  const { field, op, value } = filter
  const raw = field?.startsWith('cf_')
    ? (contact.customFields?.[field.slice(3)] || '')
    : (contact[field] || '')
  const cv = String(raw)
  switch (op) {
    case 'equals': return cv === value
    case 'not_equals': return cv !== value
    case 'contains': return cv.toLowerCase().includes((value || '').toLowerCase())
    case 'gt': return Number(cv) > Number(value)
    case 'lt': return Number(cv) < Number(value)
    case 'is_empty': return !cv || cv === '—'
    case 'is_not_empty': return !!cv && cv !== '—'
    case 'in_last': {
      const dateVal = new Date(raw)
      if (isNaN(dateVal)) return false
      const [amt, unit] = (value || '').split('_')
      const n = Number(amt) || 0
      const now = new Date()
      let ms = 0
      switch(unit) {
        case 'hours': ms = n * 3600000; break
        case 'days': ms = n * 86400000; break
        case 'weeks': ms = n * 604800000; break
        case 'months': ms = n * 2592000000; break
        default: ms = n * 86400000
      }
      return (now - dateVal) <= ms
    }
    default: return true
  }
}

// ─── Shared Styles ──────────────────────────────────────────────────────────────
const S = {
  input: {
    width: '100%', padding: '8px 10px', background: 'var(--bg-card)',
    border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)',
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
  },
  inputSm: {
    width: '100%', padding: '6px 8px', background: 'var(--bg)',
    border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)',
    fontSize: 11, outline: 'none', boxSizing: 'border-box',
  },
  label: { fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4, display: 'block' },
  sectionLabel: {
    fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10,
  },
  pill: {
    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px',
    background: 'rgba(255,107,0,.1)', border: '1px solid rgba(255,107,0,.25)',
    borderRadius: 20, fontSize: 11, color: 'var(--orange)', fontWeight: 600,
  },
  btnGhost: {
    padding: '5px 12px', background: 'transparent', border: '1px solid var(--border)',
    borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12,
  },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000 },
  modal: {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
    maxWidth: '95vw', maxHeight: '85vh', background: 'var(--bg-card)',
    border: '1px solid var(--border)', borderRadius: 14,
    boxShadow: '0 12px 48px rgba(0,0,0,.5)', zIndex: 1001,
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  modalHeader: {
    padding: '16px 20px', borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
}

// ═════════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════════
export default function CrmPage() {
  const { clientSlug } = useClient()
  const en = clientSlug === 'black-wolf'
  const L = (es, enText) => en ? enText : es

  // Locale-aware formatters
  const locale = en ? 'en-US' : 'es-ES'
  const fmtL = (v) => {
    const n = Number(v)
    if (!n && n !== 0) return '—'
    return n.toLocaleString(locale, { style: 'currency', currency: en ? 'USD' : 'EUR', minimumFractionDigits: 0 })
  }
  const fmtDateL = (d) => d ? new Date(d).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
  const fmtDateTimeL = (d) => d ? new Date(d).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

  const {
    getCrmContacts, addCrmContact, updateCrmContact, deleteCrmContact,
    getCrmActivities, addCrmActivity, deleteCrmActivity,
    getCrmCustomFields, addCrmCustomField, updateCrmCustomField, deleteCrmCustomField,
    getCrmSmartViews, addCrmSmartView, updateCrmSmartView, deleteCrmSmartView,
    getCrmPipelines, addCrmPipeline, updateCrmPipeline, deleteCrmPipeline,
    getCrmFiles, addCrmFile, deleteCrmFile,
    getCrmTasks, addCrmTask, updateCrmTask, deleteCrmTask,
    getTeam, addSale, getProducts, getPaymentFees,
    addCrmContacts, bulkUpdateCrmContacts,
    enrichContact,
    getWhatsappConfig, saveWhatsappConfig, sendWhatsappMessage,
  } = useClientData()

  // Translated constants
  const ACTIVITY_TYPES_L = en ? [
    { key: 'call', label: 'Call', icon: Phone },
    { key: 'email', label: 'Email', icon: Mail },
    { key: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
    { key: 'meeting', label: 'Meeting', icon: Video },
    { key: 'note', label: 'Note', icon: FileText },
  ] : ACTIVITY_TYPES

  const FILTER_FIELDS_L = en ? [
    { key: 'status', label: 'Status', type: 'select' },
    { key: 'assigned_closer', label: 'Closer', type: 'select' },
    { key: 'assigned_setter', label: 'Setter', type: 'select' },
    { key: 'assigned_cold_caller', label: 'Cold Caller', type: 'select' },
    { key: 'source', label: 'Source', type: 'select' },
    { key: 'company', label: 'Company', type: 'text' },
    { key: 'country', label: 'Country', type: 'text' },
    { key: 'tags', label: 'Tags', type: 'text' },
    { key: 'dealValue', label: 'Value', type: 'number' },
    { key: 'email', label: 'Email', type: 'text' },
    { key: 'phone', label: 'Phone', type: 'text' },
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'notes', label: 'Notes', type: 'text' },
    { key: 'updated_at', label: 'Last change', type: 'date' },
    { key: 'created_at', label: 'Created', type: 'date' },
  ] : FILTER_FIELDS

  const FILTER_OPS_L = en ? [
    { key: 'equals', label: 'equals' },
    { key: 'not_equals', label: 'not equals' },
    { key: 'contains', label: 'contains' },
    { key: 'gt', label: 'greater than' },
    { key: 'lt', label: 'less than' },
    { key: 'is_empty', label: 'is empty' },
    { key: 'is_not_empty', label: 'is not empty' },
    { key: 'in_last', label: 'in the last' },
  ] : FILTER_OPS

  const [contacts, contactsLoading, refreshContacts] = useAsync(getCrmContacts, [])
  const [customFields, , refreshFields] = useAsync(getCrmCustomFields, [])
  const [smartViews, , refreshViews] = useAsync(getCrmSmartViews, [])
  const [pipelines, , refreshPipelines] = useAsync(getCrmPipelines, [])
  const [team] = useAsync(getTeam, [])
  const [products] = useAsync(getProducts, [])
  const [paymentFees] = useAsync(getPaymentFees, [])
  const [whatsappConfig] = useAsync(getWhatsappConfig, null)

  // ─── Pipeline selection ───────────────────────────────────────────────────
  const [activePipelineId, setActivePipelineId] = useState(null)
  const activePipeline = useMemo(() => {
    if (!pipelines?.length) return null
    if (activePipelineId) return pipelines.find(p => p.id === activePipelineId) || pipelines[0]
    return pipelines.find(p => p.isDefault) || pipelines[0]
  }, [pipelines, activePipelineId])

  const DEFAULT_STATUSES_EN = [
    { key: 'lead',        label: 'Lead',         color: '#6B7280' },
    { key: 'contacted',   label: 'Contacted',    color: '#3B82F6' },
    { key: 'qualified',   label: 'Qualified',    color: '#8B5CF6' },
    { key: 'proposal',    label: 'Proposal',     color: '#F59E0B' },
    { key: 'negotiation', label: 'Negotiation',  color: '#FF6B00' },
    { key: 'won',         label: 'Won',          color: '#22C55E' },
    { key: 'lost',        label: 'Lost',         color: '#EF4444' },
  ]
  const STATUSES = useMemo(() => parseStages(activePipeline?.stages) || (en ? DEFAULT_STATUSES_EN : DEFAULT_STATUSES), [activePipeline, en])
  const STATUS_MAP = useMemo(() => Object.fromEntries(STATUSES.map(s => [s.key, s])), [STATUSES])

  // ─── URL params (for sidebar navigation to tasks view) ────────────────────
  const [searchParams] = useSearchParams()
  const urlView = searchParams.get('view')

  // ─── UI State ─────────────────────────────────────────────────────────────
  const [view, setView] = useState(urlView || 'kanban') // kanban | list | calendar | tasks
  useEffect(() => { if (urlView && ['kanban', 'list', 'calendar', 'tasks'].includes(urlView)) setView(urlView) }, [urlView])
  const [search, setSearch] = useState('')
  const [activeViewId, setActiveViewId] = useState(null)
  const [showNewContact, setShowNewContact] = useState(false)
  const [showCustomFields, setShowCustomFields] = useState(false)
  const [showPipelineEditor, setShowPipelineEditor] = useState(false)
  const [selectedContact, setSelectedContact] = useState(null)
  const [sortCol, setSortCol] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
  const [draggedId, setDraggedId] = useState(null)
  const [showPipelineDropdown, setShowPipelineDropdown] = useState(false)
  const [listVisibleFields, setListVisibleFields] = useState(['name', 'email', 'phone', 'status', 'dealValue'])
  const [showListSettings, setShowListSettings] = useState(false)
  const [saleModalContact, setSaleModalContact] = useState(null) // contact to register sale for
  const [storeCreationContact, setStoreCreationContact] = useState(null) // contact to create store for
  const [showImport, setShowImport] = useState(false)
  const [bulkSelected, setBulkSelected] = useState(new Set()) // selected contact IDs for bulk ops
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [bulkForm, setBulkForm] = useState({})
  const [showViews, setShowViews] = useState(window.innerWidth > 768)

  // ─── All Tasks (for tasks view) ────────────────────────────────────────────
  const [allTasks, , refreshAllTasks] = useAsync(getCrmTasks, [])

  // ─── Custom fields as filter fields ────────────────────────────────────────
  const CF_TYPE_MAP = { text: 'text', number: 'number', date: 'date', datetime: 'date', select: 'select', checkbox: 'text', url: 'text', email: 'text', phone: 'text', currency: 'number' }
  const allFilterFields = useMemo(() => [
    ...FILTER_FIELDS_L,
    ...(customFields || []).map(f => ({
      key: `cf_${f.fieldKey || f.field_key || f.id}`, label: f.name, type: CF_TYPE_MAP[f.fieldType || f.type] || 'text',
      cfOptions: f.options,
    })),
  ], [customFields])

  // ─── Advanced Filters ─────────────────────────────────────────────────────
  const [filters, setFilters] = useState([]) // [{field, op, value}]
  const [showFilterAdd, setShowFilterAdd] = useState(false)

  // ─── Smart View state ─────────────────────────────────────────────────────
  const [svCreating, setSvCreating] = useState(false)
  const [svEditing, setSvEditing] = useState(null)
  const [svForm, setSvForm] = useState({ name: '', filters: [] })

  // Clear active view when switching pipelines if view doesn't belong to new pipeline
  useEffect(() => {
    if (activeViewId) {
      const sv = smartViews.find(v => v.id === activeViewId)
      if (sv?.pipelineId && sv.pipelineId !== activePipeline?.id) {
        selectSmartView(null)
      }
    }
  }, [activePipeline?.id])

  const selectSmartView = (id) => {
    setActiveViewId(id)
    if (id) {
      const sv = smartViews.find(v => v.id === id)
      if (sv?.filters) {
        setFilters(Array.isArray(sv.filters) ? [...sv.filters] : [])
      }
    } else {
      setFilters([])
    }
  }

  // ─── Filtering ────────────────────────────────────────────────────────────
  const filteredContacts = useMemo(() => {
    let list = [...contacts]
    // Pipeline filter — only filter if user explicitly selected a pipeline
    if (activePipelineId && activePipeline) {
      list = list.filter(c => !c.pipelineId || c.pipelineId === activePipeline.id)
    }
    // Search
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q)
      )
    }
    // Advanced filters
    for (const f of filters) {
      if (f.field && f.op) list = list.filter(c => matchesFilter(c, f))
    }
    return list
  }, [contacts, search, filters, activePipeline])

  const sortedContacts = useMemo(() => {
    const list = [...filteredContacts]
    list.sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol]
      if (sortCol === 'dealValue') { va = Number(va) || 0; vb = Number(vb) || 0 }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [filteredContacts, sortCol, sortDir])

  const kanbanColumns = useMemo(() =>
    STATUSES.map(s => {
      const items = filteredContacts.filter(c => c.status === s.key)
      const total = items.reduce((sum, c) => sum + (Number(c.dealValue) || 0), 0)
      return { ...s, items, total }
    }), [filteredContacts, STATUSES])

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const openContact = (contact) => setSelectedContact(contact)
  const closeContact = () => setSelectedContact(null)

  const handleSaveNewContact = async (e) => {
    e.preventDefault()
    const form = e.target
    const fd = new FormData(form)
    const payload = {
      name: fd.get('name'), email: fd.get('email'), phone: fd.get('phone'),
      company: fd.get('company'), status: fd.get('status') || 'lead',
      dealValue: Number(fd.get('dealValue')) || 0,
      assigned_closer: fd.get('assigned_closer'), assigned_setter: fd.get('assigned_setter'),
      assigned_cold_caller: fd.get('assigned_cold_caller'), source: fd.get('source'),
      tags: fd.get('tags'), notes: fd.get('notes'),
      address: fd.get('address'), whatsapp: fd.get('whatsapp'),
      zoom_link: fd.get('zoom_link'), website: fd.get('website'),
      instagram: fd.get('instagram'),
      pipelineId: activePipeline?.id || '',
      customFields: {},
    }
    try {
      await addCrmContact(payload)
      refreshContacts()
      setShowNewContact(false)
    } catch (err) { alert(L('Error al guardar contacto.', 'Error saving contact.')) }
  }

  const handleUpdateContact = async (updates) => {
    if (!selectedContact) return
    try {
      await updateCrmContact(selectedContact.id, updates)
      refreshContacts()
      setSelectedContact(prev => ({ ...prev, ...updates }))
    } catch (err) { console.error('Error updating contact:', err) }
  }

  const handleDeleteContact = async () => {
    if (!selectedContact || !confirm(L('¿Eliminar este contacto?', 'Delete this contact?'))) return
    await deleteCrmContact(selectedContact.id)
    refreshContacts()
    closeContact()
  }

  // ─── Import & Bulk handlers ─────────────────────────────────────────────
  const handleImportCrm = async (rows) => {
    const contacts = rows.map(r => ({
      ...r,
      status: r.status || 'lead',
      pipelineId: activePipeline?.id || '',
    }))
    await addCrmContacts(contacts)
    refreshContacts()
  }

  const toggleBulkSelect = (id) => {
    setBulkSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const selectAllFiltered = () => {
    if (bulkSelected.size === sortedContacts.length) setBulkSelected(new Set())
    else setBulkSelected(new Set(sortedContacts.map(c => c.id)))
  }
  const [bulkSaving, setBulkSaving] = useState(false)
  const handleBulkEdit = async () => {
    if (bulkSelected.size === 0 || bulkSaving) return
    const updates = {}
    Object.entries(bulkForm).forEach(([k, v]) => { if (v !== '' && v !== undefined && v !== null) updates[k] = v })
    if (Object.keys(updates).length === 0) return
    // Convert tags from comma-separated string to JSONB array
    if (updates.tags && typeof updates.tags === 'string') {
      updates.tags = updates.tags.split(',').map(t => t.trim()).filter(Boolean)
    }
    setBulkSaving(true)
    try {
      await bulkUpdateCrmContacts([...bulkSelected], updates)
      refreshContacts()
      setBulkSelected(new Set())
      setShowBulkEdit(false)
      setBulkForm({})
    } catch (err) {
      console.error('Bulk update error:', err)
      alert(L ? L('Error al actualizar: ' + (err.message || err), 'Update error: ' + (err.message || err)) : 'Update error: ' + (err.message || err))
    } finally {
      setBulkSaving(false)
    }
  }
  const handleBulkDelete = async () => {
    if (bulkSelected.size === 0) return
    if (!confirm(L(`¿Eliminar ${bulkSelected.size} contactos?`, `Delete ${bulkSelected.size} contacts?`))) return
    for (const id of bulkSelected) await deleteCrmContact(id)
    refreshContacts()
    setBulkSelected(new Set())
  }

  const handleStatusChange = async (contactId, newStatus) => {
    const contact = contacts.find(c => c.id === contactId) || selectedContact
    const previousStatus = contact?.status
    await updateCrmContact(contactId, { status: newStatus })
    refreshContacts()
    if (selectedContact?.id === contactId) setSelectedContact(prev => ({ ...prev, status: newStatus }))

    // Sync status change to Enjambre (updates lead + pauses sequences if needed)
    fetch('/api/bridge-enjambre', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'status_changed', contactId, clientSlug, data: { newStatus, previousStatus } }),
    }).catch(() => {})

    // Show sale registration popup when status changes to 'won'
    if (newStatus === 'won' && contact) {
      setSaleModalContact({ ...contact, status: newStatus })
      // Auto-provision store for won contacts
      try {
        const resp = await fetch('/api/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contactId, clientSlug }),
        })
        const result = await resp.json()
        if (result.ok) {
          console.log('[Auto-Onboarding] Store created:', result.store_id)
        }
      } catch (err) {
        console.error('[Auto-Onboarding] Error:', err)
      }
    }
  }

  // ─── Filter helpers ───────────────────────────────────────────────────────
  const addFilter = (field) => {
    setFilters(prev => [...prev, { field, op: 'equals', value: '' }])
    setShowFilterAdd(false)
  }
  const updateFilter = (idx, updates) => setFilters(prev => prev.map((f, i) => i === idx ? { ...f, ...updates } : f))
  const removeFilter = (idx) => setFilters(prev => prev.filter((_, i) => i !== idx))
  const clearFilters = () => { setFilters([]); setActiveViewId(null) }

  // ─── Smart View Handlers ──────────────────────────────────────────────────
  const svStartCreate = () => {
    setSvForm({ name: '', filters: [...filters] })
    setSvCreating(true); setSvEditing(null)
  }
  const svStartEdit = (v) => {
    setSvForm({ name: v.name, filters: Array.isArray(v.filters) ? [...v.filters] : [] })
    setSvEditing(v.id); setSvCreating(false)
  }
  const svHandleSave = async () => {
    if (!svForm.name.trim()) return
    try {
      const payload = { ...svForm, pipelineId: activePipeline?.id || null }
      if (svEditing) await updateCrmSmartView(svEditing, payload)
      else await addCrmSmartView(payload)
      refreshViews(); setSvCreating(false); setSvEditing(null)
    } catch (err) { console.error('Error saving smart view:', err) }
  }
  const svHandleDelete = async (id) => {
    if (!confirm(L('¿Eliminar esta vista?', 'Delete this view?'))) return
    await deleteCrmSmartView(id)
    refreshViews()
    if (activeViewId === id) selectSmartView(null)
  }

  // ─── Drag & Drop ──────────────────────────────────────────────────────────
  const onDragStart = (e, contactId) => {
    setDraggedId(contactId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', contactId)
  }
  const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
  const onDrop = async (e, statusKey) => {
    e.preventDefault()
    const id = draggedId || e.dataTransfer.getData('text/plain')
    if (!id) return
    setDraggedId(null)
    await handleStatusChange(id, statusKey)
  }

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (contactsLoading) {
    return <div className="dashboard"><div style={{ textAlign: 'center', padding: 60, color: '#999' }}>{L('Cargando CRM...', 'Loading CRM...')}</div></div>
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════════
  return (
    <div className="crm-page" style={{ position: 'relative', overflow: 'hidden' }}>

      {/* ─── Top Bar ──────────────────────────────────────────────────────── */}
      <div className="crm-toolbar" style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        marginBottom: 0, padding: '0 0 16px', borderBottom: '1px solid var(--border)',
      }}>
        {/* Toggle Views sidebar */}
        <button
          onClick={() => setShowViews(!showViews)}
          className="crm-views-toggle"
          style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px',
            background: showViews ? 'rgba(255,107,0,.1)' : 'var(--bg-card)',
            border: '1px solid ' + (showViews ? 'rgba(255,107,0,.3)' : 'var(--border)'),
            borderRadius: 8, cursor: 'pointer',
            color: showViews ? 'var(--orange)' : 'var(--text-secondary)',
            fontSize: 13, fontWeight: 600, transition: 'all .2s',
          }}
          title={showViews ? L('Ocultar vistas', 'Hide views') : L('Mostrar vistas', 'Show views')}
        >
          <Eye size={14} /> <span className="crm-views-toggle__label">{L('Vistas', 'Views')}</span>
        </button>
        {/* Pipeline Selector */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowPipelineDropdown(!showPipelineDropdown)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 8, cursor: 'pointer', color: 'var(--text)', fontSize: 13, fontWeight: 700,
            }}
          >
            {activePipeline?.name || 'Pipeline'} <ChevronDown size={14} />
          </button>
          {showPipelineDropdown && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4, minWidth: 200,
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,.4)', zIndex: 100, overflow: 'hidden',
            }}>
              {pipelines.map(p => (
                <div
                  key={p.id}
                  onClick={() => { setActivePipelineId(p.id); setShowPipelineDropdown(false) }}
                  style={{
                    padding: '8px 14px', fontSize: 13, cursor: 'pointer',
                    background: p.id === activePipeline?.id ? 'rgba(255,107,0,.1)' : 'transparent',
                    color: p.id === activePipeline?.id ? 'var(--orange)' : 'var(--text)',
                    fontWeight: p.id === activePipeline?.id ? 700 : 400,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = p.id === activePipeline?.id ? 'rgba(255,107,0,.1)' : 'transparent'}
                >
                  {p.name} {p.isDefault && <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>(default)</span>}
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', padding: '6px 8px' }}>
                <button
                  onClick={() => { setShowPipelineDropdown(false); setShowPipelineEditor(true) }}
                  style={{
                    width: '100%', padding: '6px', display: 'flex', alignItems: 'center', gap: 6,
                    background: 'transparent', border: '1px dashed var(--border)', borderRadius: 6,
                    cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12, justifyContent: 'center',
                  }}
                >
                  <Settings size={12} /> {L('Gestionar Pipelines', 'Manage Pipelines')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* View toggles */}
        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {[
            { key: 'kanban', label: 'Kanban', Icon: LayoutGrid },
            { key: 'list', label: L('Lista', 'List'), Icon: List },
            { key: 'calendar', label: L('Calendario', 'Calendar'), Icon: Calendar },
            { key: 'tasks', label: L('Tareas', 'Tasks'), Icon: CheckSquare },
          ].map((v, vi) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px',
                background: view === v.key ? 'var(--orange)' : 'var(--bg-card)',
                color: view === v.key ? '#000' : 'var(--text-secondary)',
                border: 'none', borderLeft: vi > 0 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all .2s',
              }}
            >
              <v.Icon size={14} /> {v.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 8, flex: '1 1 200px', maxWidth: 320,
        }}>
          <Search size={15} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={L('Buscar contactos...', 'Search contacts...')}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 13, width: '100%' }}
          />
          {search && <X size={14} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setSearch('')} />}
        </div>

        <div className="crm-toolbar__actions" style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => setShowImport(true)}
            className="crm-toolbar__btn-ghost"
            style={{ ...S.btnGhost, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px' }}
            title={L('Importar CSV/Excel', 'Import CSV/Excel')}>
            <Upload size={15} /> <span className="crm-hide-mobile">{L('Importar', 'Import')}</span>
          </button>
          <button onClick={() => setShowCustomFields(true)}
            className="crm-toolbar__btn-ghost"
            style={{ ...S.btnGhost, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px' }}
            title={L('Campos Personalizados', 'Custom Fields')}>
            <Settings size={15} />
          </button>
          <button className="btn-action crm-toolbar__add" onClick={() => setShowNewContact(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={15} /> <span className="crm-hide-mobile">{L('Nuevo Contacto', 'New Contact')}</span>
          </button>
        </div>
      </div>

      {/* ─── Bulk Actions Bar ──────────────────────────────────────────── */}
      {bulkSelected.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
          background: 'rgba(255,107,0,.08)', border: '1px solid rgba(255,107,0,.2)',
          borderRadius: 8, marginTop: 8,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--orange)' }}>
            {bulkSelected.size} {L('seleccionados', 'selected')}
          </span>
          <button onClick={() => setShowBulkEdit(true)}
            style={{ ...S.btnGhost, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, borderColor: 'var(--orange)', color: 'var(--orange)' }}>
            <Edit3 size={13} /> {L('Editar en masa', 'Bulk Edit')}
          </button>
          <button onClick={async () => {
            const ids = [...bulkSelected]
            if (!confirm(L(`¿Lanzar Scrap Pipeline en ${ids.length} contactos? (Enriquecer + Crear email personalizado)`, `Launch Scrap Pipeline on ${ids.length} contacts?`))) return
            try {
              const r = await fetch('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'scrap-pipeline', clientSlug, contactIds: ids }) })
              const result = await r.json()
              if (r.ok) { alert(L(`Pipeline completado: ${result.processed} contactos procesados`, `Pipeline done: ${result.processed} contacts processed`)); refreshContacts() }
              else alert('Error: ' + (result.error || 'Unknown'))
            } catch (e) { alert('Error: ' + e.message) }
          }}
            style={{ ...S.btnGhost, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, borderColor: '#22C55E', color: '#22C55E' }}>
            <Search size={13} /> {L('Scrap Pipeline', 'Scrap Pipeline')}
          </button>
          <button onClick={handleBulkDelete}
            style={{ ...S.btnGhost, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, borderColor: '#EF4444', color: '#EF4444' }}>
            <Trash2 size={13} /> {L('Eliminar', 'Delete')}
          </button>
          <button onClick={() => setBulkSelected(new Set())}
            style={{ ...S.btnGhost, fontSize: 12 }}>
            {L('Deseleccionar', 'Deselect All')}
          </button>
        </div>
      )}

      {/* ─── Bulk Edit Modal ──────────────────────────────────────────── */}
      {showBulkEdit && (
        <>
          <div onClick={() => setShowBulkEdit(false)} style={S.overlay} />
          <div style={{ ...S.modal, width: 480 }}>
            <div style={S.modalHeader}>
              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>
                {L('Editar en masa', 'Bulk Edit')} — {bulkSelected.size} {L('contactos', 'contacts')}
              </div>
              <button onClick={() => setShowBulkEdit(false)} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '16px 20px', overflowY: 'auto', maxHeight: '60vh' }}>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                {L('Solo los campos con valor se actualizarán. Deja vacío para no cambiar.', 'Only fields with a value will be updated. Leave empty to skip.')}
              </p>
              <div style={{ display: 'grid', gap: 10 }}>
                <div>
                  <label style={S.label}>{L('Estado', 'Status')}</label>
                  <select value={bulkForm.status || ''} onChange={e => setBulkForm(p => ({ ...p, status: e.target.value }))} style={S.input}>
                    <option value="">— {L('No cambiar', 'No change')} —</option>
                    {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                {[
                  { label: 'Closer', key: 'assigned_closer' },
                  { label: 'Setter', key: 'assigned_setter' },
                  { label: 'Cold Caller', key: 'assigned_cold_caller' },
                  { label: 'Triager', key: 'triager' },
                  { label: L('Gestor Asignado', 'Assigned Manager'), key: 'gestor_asignado' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={S.label}>{f.label}</label>
                    <select value={bulkForm[f.key] || ''} onChange={e => setBulkForm(p => ({ ...p, [f.key]: e.target.value }))} style={S.input}>
                      <option value="">— {L('No cambiar', 'No change')} —</option>
                      {team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                    </select>
                  </div>
                ))}
                <div>
                  <label style={S.label}>{L('Fuente', 'Source')}</label>
                  <select value={bulkForm.source || ''} onChange={e => setBulkForm(p => ({ ...p, source: e.target.value }))} style={S.input}>
                    <option value="">— {L('No cambiar', 'No change')} —</option>
                    {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Pipeline</label>
                  <select value={bulkForm.pipelineId || ''} onChange={e => setBulkForm(p => ({ ...p, pipelineId: e.target.value }))} style={S.input}>
                    <option value="">— {L('No cambiar', 'No change')} —</option>
                    {(pipelines || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Tags ({L('añadir/reemplazar', 'add/replace')})</label>
                  <input value={bulkForm.tags || ''} onChange={e => setBulkForm(p => ({ ...p, tags: e.target.value }))} style={S.input} placeholder="vip, follow-up" />
                </div>
                {[
                  { label: L('Producto', 'Product'), key: 'product' },
                  { label: L('Tipo Pago', 'Payment Type'), key: 'payment_type' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={S.label}>{f.label}</label>
                    <input value={bulkForm[f.key] || ''} onChange={e => setBulkForm(p => ({ ...p, [f.key]: e.target.value }))} style={S.input} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowBulkEdit(false)} style={{ ...S.btnGhost, padding: '9px 20px', fontSize: 13 }}>{L('Cancelar', 'Cancel')}</button>
                <button onClick={handleBulkEdit} className="btn-action" disabled={bulkSaving} style={{ padding: '9px 20px', fontSize: 13, opacity: bulkSaving ? 0.6 : 1 }}>
                  {bulkSaving ? L('Guardando...', 'Saving...') : L('Aplicar cambios', 'Apply Changes')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ─── Main Layout: Sidebar + Content ──────────────────────────────── */}
      <div className="crm-body" style={{ display: 'flex', gap: 0, marginTop: 0 }}>

        {/* ─── Smart Views Left Sidebar ──────────────────────────────────── */}
        {showViews && <div className="crm-sidebar-overlay" onClick={() => setShowViews(false)} />}
        {showViews && (
        <div className="crm-sidebar" style={{
          width: 220, minWidth: 220, flexShrink: 0, borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)', overflowY: 'auto',
          background: 'rgba(255,255,255,.01)',
        }}>
          <div style={{ padding: '14px 14px 10px', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {L('Vistas', 'Views')}
          </div>
          <SidebarViewItem label={L('Todos los contactos', 'All contacts')} icon={<Filter size={13} />}
            active={!activeViewId} onClick={() => selectSmartView(null)} count={contacts.length} />
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 12px' }} />
          {smartViews.filter(v => !v.pipelineId || v.pipelineId === activePipeline?.id).map(v => (
            <SidebarViewItem key={v.id} label={v.name} icon={<Eye size={13} />}
              active={activeViewId === v.id} onClick={() => selectSmartView(v.id)}
              onEdit={() => svStartEdit(v)} onDelete={() => svHandleDelete(v.id)} />
          ))}
          {smartViews.filter(v => !v.pipelineId || v.pipelineId === activePipeline?.id).length === 0 && !svCreating && (
            <div style={{ padding: '16px 14px', fontSize: 11, color: 'var(--text-secondary)', opacity: 0.5, textAlign: 'center' }}>
              {L('Sin vistas guardadas', 'No saved views')}
            </div>
          )}
          {/* SV Create/Edit */}
          {(svCreating || svEditing) && (
            <div style={{ margin: '4px 8px', padding: 10, background: 'rgba(255,107,0,.04)', border: '1px solid rgba(255,107,0,.2)', borderRadius: 8 }}>
              <input value={svForm.name} onChange={e => setSvForm(p => ({ ...p, name: e.target.value }))}
                placeholder={L('Nombre de la vista', 'View name')} autoFocus style={{ ...S.inputSm, marginBottom: 6 }} />
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>
                {L(`Filtros actuales (${filters.length}) se guardarán con la vista`, `Current filters (${filters.length}) will be saved with the view`)}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => { setSvCreating(false); setSvEditing(null) }}
                  style={{ flex: 1, padding: '4px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 10 }}>
                  {L('Cancelar', 'Cancel')}
                </button>
                <button onClick={() => { setSvForm(p => ({ ...p, filters: [...filters] })); svHandleSave() }}
                  style={{ flex: 1, padding: '4px', background: 'var(--orange)', color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>
                  {svEditing ? L('Guardar', 'Save') : L('Crear', 'Create')}
                </button>
              </div>
            </div>
          )}
          <div style={{ flex: 1 }} />
          {!svCreating && !svEditing && (
            <button onClick={svStartCreate}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', margin: '8px',
                background: 'transparent', border: '1px dashed var(--border)', borderRadius: 8,
                cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500,
                width: 'calc(100% - 16px)', boxSizing: 'border-box', transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--orange)'; e.currentTarget.style.color = 'var(--orange)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              <Plus size={13} /> {L('Nueva vista', 'New view')}
            </button>
          )}
        </div>
        )}

        {/* ─── Right Content Area ────────────────────────────────────────── */}
        <div className="crm-content" style={{ flex: 1, minWidth: 0, paddingLeft: showViews ? 16 : 0, paddingTop: 16 }}>

          {/* Pipeline Summary Strip */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 4, alignItems: 'center' }}>
            {STATUSES.map(s => {
              const count = filteredContacts.filter(c => c.status === s.key).length
              return (
                <div key={s.key} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 20, fontSize: 12, whiteSpace: 'nowrap',
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text)' }}>{count}</span>
                </div>
              )
            })}
          </div>

          {/* ─── Advanced Filters ──────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            {filters.map((f, idx) => {
              const ff = allFilterFields.find(x => x.key === f.field)
              return (
                <div key={idx} style={S.pill}>
                  <select value={f.field} onChange={e => updateFilter(idx, { field: e.target.value })}
                    style={{ background: 'transparent', border: 'none', color: 'var(--orange)', fontSize: 11, fontWeight: 600, outline: 'none' }}>
                    {allFilterFields.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
                  </select>
                  <select value={f.op} onChange={e => updateFilter(idx, { op: e.target.value })}
                    style={{ background: 'transparent', border: 'none', color: 'var(--orange)', fontSize: 10, outline: 'none' }}>
                    {FILTER_OPS_L.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                  {!['is_empty', 'is_not_empty'].includes(f.op) && (
                    f.op === 'in_last' ? (
                      <>
                        <input type="number" value={(f.value || '').split('_')[0] || ''}
                          onChange={e => updateFilter(idx, { value: `${e.target.value}_${(f.value || '').split('_')[1] || 'days'}` })}
                          style={{ background: 'transparent', border: 'none', color: 'var(--orange)', fontSize: 11, outline: 'none', width: 30, textAlign: 'center' }}
                          min="1" />
                        <select value={(f.value || '').split('_')[1] || 'days'}
                          onChange={e => updateFilter(idx, { value: `${(f.value || '').split('_')[0] || '7'}_${e.target.value}` })}
                          style={{ background: 'transparent', border: 'none', color: 'var(--orange)', fontSize: 10, outline: 'none' }}>
                          <option value="hours">{L('horas', 'hours')}</option>
                          <option value="days">{L('días', 'days')}</option>
                          <option value="weeks">{L('semanas', 'weeks')}</option>
                          <option value="months">{L('meses', 'months')}</option>
                        </select>
                      </>
                    ) : ff?.type === 'select' ? (
                      <select value={f.value || ''} onChange={e => updateFilter(idx, { value: e.target.value })}
                        style={{ background: 'transparent', border: 'none', color: 'var(--orange)', fontSize: 11, outline: 'none', maxWidth: 90 }}>
                        <option value="">--</option>
                        {f.field === 'status' && STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                        {(f.field === 'assigned_closer' || f.field === 'assigned_setter' || f.field === 'assigned_cold_caller') && team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                        {f.field === 'source' && SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        {ff?.cfOptions && ff.cfOptions.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : ff?.type === 'date' ? (
                      <input type="date" value={f.value || ''} onChange={e => updateFilter(idx, { value: e.target.value })}
                        style={{ background: 'transparent', border: 'none', color: 'var(--orange)', fontSize: 11, outline: 'none', colorScheme: 'dark' }} />
                    ) : (
                      <input value={f.value || ''} onChange={e => updateFilter(idx, { value: e.target.value })}
                        placeholder="..." style={{ background: 'transparent', border: 'none', color: 'var(--orange)', fontSize: 11, outline: 'none', width: 60 }} />
                    )
                  )}
                  <X size={12} style={{ cursor: 'pointer', opacity: .7 }} onClick={() => removeFilter(idx)} />
                </div>
              )
            })}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowFilterAdd(!showFilterAdd)}
                style={{ ...S.btnGhost, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 10px' }}>
                <Plus size={12} /> {L('Filtro', 'Filter')}
              </button>
              {showFilterAdd && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: 4, minWidth: 180,
                  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,.4)', zIndex: 50, maxHeight: 400, overflowY: 'auto',
                }}>
                  {FILTER_FIELDS_L.map(f => (
                    <div key={f.key} onClick={() => addFilter(f.key)}
                      style={{ padding: '7px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--text)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      {f.label}
                    </div>
                  ))}
                  {customFields && customFields.length > 0 && (
                    <>
                      <div style={{ padding: '4px 14px', fontSize: 9, fontWeight: 700, color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: '1px', borderTop: '1px solid var(--border)', marginTop: 2, paddingTop: 8 }}>
                        {L('Campos Personalizados', 'Custom Fields')}
                      </div>
                      {customFields.map(f => {
                        const fk = f.fieldKey || f.field_key || f.id
                        return (
                          <div key={`cf_${fk}`} onClick={() => addFilter(`cf_${fk}`)}
                            style={{ padding: '7px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--text)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.04)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            {f.name}
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
            {filters.length > 0 && (
              <button onClick={clearFilters}
                style={{ padding: '4px 10px', fontSize: 11, background: 'rgba(239,68,68,.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,.25)', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                {L('Limpiar', 'Clear')}
              </button>
            )}
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 4 }}>
              {filteredContacts.length} {L(`contacto${filteredContacts.length !== 1 ? 's' : ''}`, `contact${filteredContacts.length !== 1 ? 's' : ''}`)}
            </span>
          </div>

          {/* ─── Kanban View ──────────────────────────────────────────────── */}
          {view === 'kanban' && (
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16, minHeight: 'calc(100vh - 340px)' }}>
              {kanbanColumns.map(col => (
                <div key={col.key} onDragOver={onDragOver} onDrop={e => onDrop(e, col.key)}
                  style={{
                    minWidth: 260, maxWidth: 300, flex: '0 0 260px', display: 'flex', flexDirection: 'column',
                    background: 'rgba(255,255,255,.02)', borderRadius: 12, border: '1px solid var(--border)',
                  }}>
                  <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `2px solid ${col.color}` }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: col.color }} />
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', flex: 1 }}>{col.label}</span>
                    <span style={{ fontSize: 11, background: `${col.color}22`, color: col.color, padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                      {col.items.length}
                    </span>
                  </div>
                  {col.total > 0 && (
                    <div style={{ padding: '6px 16px', fontSize: 11, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                      Total: {fmtL(col.total)}
                    </div>
                  )}
                  <div style={{ padding: 8, flex: 1, overflowY: 'auto' }}>
                    {col.items.length === 0 && (
                      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12, opacity: 0.5 }}>{L('Sin contactos', 'No contacts')}</div>
                    )}
                    {col.items.map(c => (
                      <KanbanCard key={c.id} contact={c} onDragStart={onDragStart} onClick={() => openContact(c)} isDragging={draggedId === c.id} en={en}
                        selected={bulkSelected.has(c.id)} onToggleSelect={toggleBulkSelect} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ─── List View (Card/Bubble Style) ─────────────────────────── */}
          {view === 'list' && (() => {
            const LIST_COLS = [
              { key: 'name', label: L('Nombre', 'Name') }, { key: 'email', label: 'Email' },
              { key: 'phone', label: L('Teléfono', 'Phone') }, { key: 'company', label: L('Empresa', 'Company') },
              { key: 'status', label: L('Estado', 'Status') }, { key: 'dealValue', label: L('Valor', 'Value') },
              { key: 'assigned_closer', label: 'Closer' }, { key: 'assigned_setter', label: 'Setter' },
              { key: 'assigned_cold_caller', label: 'Cold Caller' }, { key: 'source', label: L('Fuente', 'Source') },
              { key: 'tags', label: 'Tags' }, { key: 'created_at', label: L('Creado', 'Created') },
            ]
            const visCols = LIST_COLS.filter(c => listVisibleFields.includes(c.key))
            const renderField = (c, key) => {
              if (key === 'status') return (
                <select value={c.status} onClick={e => e.stopPropagation()} onChange={e => handleStatusChange(c.id, e.target.value)}
                  style={{ background: `${STATUS_MAP[c.status]?.color || '#666'}22`, color: STATUS_MAP[c.status]?.color || '#999', border: `1px solid ${STATUS_MAP[c.status]?.color || '#666'}44`, borderRadius: 6, padding: '2px 6px', fontSize: 10, fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
                  {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              )
              if (key === 'dealValue') return <span style={{ fontWeight: 700, color: 'var(--orange)', fontSize: 12 }}>{fmtL(c.dealValue)}</span>
              if (key === 'created_at') return <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{fmtDateL(c.created_at)}</span>
              return <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c[key] || '—'}</span>
            }
            return (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {visCols.filter(c => c.key !== 'name').map(col => (
                      <span key={col.key} onClick={() => handleSort(col.key)} style={{ fontSize: 10, color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                        {col.label}{sortCol === col.key && <span style={{ marginLeft: 2 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                      </span>
                    ))}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <button onClick={() => setShowListSettings(!showListSettings)} style={{ ...S.btnGhost, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                      <Settings size={12} /> {L('Columnas', 'Columns')}
                    </button>
                    {showListSettings && (
                      <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowListSettings(false)} />
                        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, minWidth: 180, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.4)', zIndex: 50, padding: '6px 0' }}>
                          {LIST_COLS.map(col => (
                            <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--text)' }}>
                              <input type="checkbox" checked={listVisibleFields.includes(col.key)}
                                onChange={() => setListVisibleFields(prev => prev.includes(col.key) ? prev.filter(k => k !== col.key) : [...prev, col.key])}
                                style={{ accentColor: 'var(--orange)' }} />
                              {col.label}
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {sortedContacts.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>{L('No hay contactos', 'No contacts')}</div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '0 16px' }}>
                  <span onClick={selectAllFiltered} style={{ cursor: 'pointer', color: bulkSelected.size === sortedContacts.length && sortedContacts.length > 0 ? 'var(--orange)' : 'var(--text-secondary)' }}>
                    {bulkSelected.size === sortedContacts.length && sortedContacts.length > 0 ? <Check size={14} /> : <Square size={14} />}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                    {L('Seleccionar todo', 'Select All')}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {sortedContacts.map(c => (
                    <div key={c.id} onClick={() => openContact(c)}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px', background: bulkSelected.has(c.id) ? 'rgba(255,107,0,.06)' : 'var(--bg-card)', border: `1px solid ${bulkSelected.has(c.id) ? 'rgba(255,107,0,.3)' : 'var(--border)'}`, borderRadius: 13, cursor: 'pointer', transition: 'all .15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--orange)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(255,107,0,.08)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = bulkSelected.has(c.id) ? 'rgba(255,107,0,.3)' : 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}>
                      <span onClick={e => { e.stopPropagation(); toggleBulkSelect(c.id) }} style={{ cursor: 'pointer', color: bulkSelected.has(c.id) ? 'var(--orange)' : 'var(--text-secondary)', flexShrink: 0 }}>
                        {bulkSelected.has(c.id) ? <Check size={14} /> : <Square size={14} />}
                      </span>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,107,0,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: 'var(--orange)', flexShrink: 0 }}>
                        {(c.name || '?')[0].toUpperCase()}
                      </div>
                      <div style={{ flex: '0 0 auto', minWidth: 120 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{c.name || L('Sin nombre', 'No name')}</div>
                        {listVisibleFields.includes('company') && c.company && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{c.company}</div>}
                      </div>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', minWidth: 0 }}>
                        {visCols.filter(col => !['name', 'company'].includes(col.key)).map(col => (
                          <div key={col.key} style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.3px' }}>{col.label}</span>
                            {renderField(c, col.key)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* ─── Calendar View ────────────────────────────────────────────── */}
          {view === 'calendar' && (
            <CalendarView
              contacts={filteredContacts}
              getCrmActivities={getCrmActivities}
              onContactClick={openContact}
              en={en}
            />
          )}

          {/* ─── Tasks View ───────────────────────────────────────────────── */}
          {view === 'tasks' && (
            <TasksView
              tasks={allTasks || []} contacts={contacts} team={team}
              onToggle={async (t) => { await updateCrmTask(t.id, { completed: !t.completed }); refreshAllTasks() }}
              onDelete={async (t) => { if (confirm(L('¿Eliminar tarea?', 'Delete task?'))) { await deleteCrmTask(t.id); refreshAllTasks() } }}
              onAdd={async (data) => { await addCrmTask(data); refreshAllTasks() }}
              onUpdate={async (id, data) => { await updateCrmTask(id, data); refreshAllTasks() }}
              onContactClick={openContact}
              en={en}
            />
          )}
        </div>
      </div>

      {/* ─── Contact Detail Sidebar ───────────────────────────────────── */}
      {selectedContact && (
        <ContactSidebar
          contact={selectedContact} customFields={customFields} team={team}
          statuses={STATUSES} statusMap={STATUS_MAP} pipelines={pipelines || []}
          products={products || []} paymentFees={paymentFees || []}
          onClose={closeContact} onUpdate={handleUpdateContact} onDelete={handleDeleteContact}
          onStatusChange={handleStatusChange}
          getCrmActivities={getCrmActivities} addCrmActivity={addCrmActivity} deleteCrmActivity={deleteCrmActivity}
          getCrmFiles={getCrmFiles} addCrmFile={addCrmFile} deleteCrmFile={deleteCrmFile}
          onEnrich={enrichContact}
          en={en}
          whatsappConnected={!!whatsappConfig?.connected}
          sendWhatsappMessage={sendWhatsappMessage}
          saveWhatsappConfig={saveWhatsappConfig}
          whatsappConfig={whatsappConfig}
        />
      )}

      {/* ─── Pipeline Editor Modal ──────────────────────────────────────── */}
      {showPipelineEditor && (
        <PipelineEditorModal
          pipelines={pipelines || []}
          activePipeline={activePipeline}
          onClose={() => setShowPipelineEditor(false)}
          en={en}
          onSavePipeline={async (id, data) => {
            try {
              if (id) await updateCrmPipeline(id, data)
              else { const p = await addCrmPipeline(data); setActivePipelineId(p?.id) }
              await refreshPipelines()
            } catch (err) { console.error('Pipeline save error:', err); alert(L('Error al guardar pipeline.', 'Error saving pipeline.')) }
          }}
          onDeletePipeline={async (id) => {
            if (!confirm(L('¿Eliminar este pipeline?', 'Delete this pipeline?'))) return
            await deleteCrmPipeline(id)
            await refreshPipelines()
            if (activePipelineId === id) setActivePipelineId(null)
          }}
        />
      )}

      {/* ─── Custom Fields Modal ──────────────────────────────────────── */}
      {showCustomFields && (
        <CustomFieldsModal fields={customFields} onClose={() => setShowCustomFields(false)}
          onAdd={addCrmCustomField} onUpdate={updateCrmCustomField} onDelete={deleteCrmCustomField} refresh={refreshFields} en={en} />
      )}

      {/* ─── New Contact Modal ────────────────────────────────────────── */}
      {showNewContact && (
        <NewContactModal customFields={customFields} team={team} statuses={STATUSES}
          onClose={() => setShowNewContact(false)} onSave={handleSaveNewContact} en={en} />
      )}

      {/* ─── Import Modal ──────────────────────────────────────────────── */}
      {showImport && (
        <ImportModal type="crm" onImport={handleImportCrm} onClose={() => setShowImport(false)} />
      )}

      {/* ─── Sale Registration Modal ──────────────────────────────────── */}
      {saleModalContact && (
        <SaleRegistrationModal
          contact={saleModalContact}
          team={team} products={products || []} paymentFees={paymentFees || []}
          onClose={() => setSaleModalContact(null)}
          onSave={async (saleData) => {
            try {
              await addSale(saleData)
              const contactForStore = saleModalContact
              setSaleModalContact(null)
              refreshContacts()
              // Offer store creation after sale
              setStoreCreationContact(contactForStore)
            } catch (err) { console.error('Error registering sale:', err); alert(L('Error al registrar venta.', 'Error registering sale.')) }
          }}
          en={en}
        />
      )}

      {storeCreationContact && (
        <StoreCreationModal
          contact={storeCreationContact}
          onClose={() => setStoreCreationContact(null)}
          onCreated={() => setStoreCreationContact(null)}
        />
      )}

      {/* Click away for filter dropdown */}
      {showFilterAdd && <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowFilterAdd(false)} />}
      {showPipelineDropdown && <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setShowPipelineDropdown(false)} />}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════════
// SIDEBAR VIEW ITEM
// ═════════════════════════════════════════════════════════════════════════════════
function SidebarViewItem({ label, icon, active, onClick, onEdit, onDelete, count }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', cursor: 'pointer',
        background: active ? 'rgba(255,107,0,.1)' : hovered ? 'rgba(255,255,255,.03)' : 'transparent',
        borderLeft: active ? '3px solid var(--orange)' : '3px solid transparent', transition: 'all .12s',
      }}>
      <span style={{ color: active ? 'var(--orange)' : 'var(--text-secondary)', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 12, color: active ? 'var(--orange)' : 'var(--text)', fontWeight: active ? 700 : 400, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {count !== undefined && (
        <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, background: 'rgba(255,255,255,.05)', padding: '1px 6px', borderRadius: 8 }}>{count}</span>
      )}
      {hovered && onEdit && (
        <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
          <button onClick={onEdit} style={{ padding: 3, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', lineHeight: 1 }}>
            <Edit3 size={11} />
          </button>
          <button onClick={onDelete} style={{ padding: 3, background: 'transparent', border: 'none', cursor: 'pointer', color: '#EF4444', lineHeight: 1 }}>
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════════
// KANBAN CARD
// ═════════════════════════════════════════════════════════════════════════════════
function KanbanCard({ contact, onDragStart, onClick, isDragging, en, selected, onToggleSelect }) {
  const L = (es, enText) => en ? enText : es
  const fmtL = (v) => { const n = Number(v); if (!n && n !== 0) return '—'; return n.toLocaleString(en ? 'en-US' : 'es-ES', { style: 'currency', currency: en ? 'USD' : 'EUR', minimumFractionDigits: 0 }) }
  const c = contact
  const tags = (Array.isArray(c.tags) ? c.tags : (c.tags || '').split(',')).map(t => String(t).trim()).filter(Boolean)
  return (
    <div draggable onDragStart={e => onDragStart(e, c.id)} onClick={onClick}
      style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 8,
        cursor: 'grab', transition: 'all .2s', opacity: isDragging ? 0.4 : 1,
        transform: isDragging ? 'scale(.95)' : 'none', boxShadow: '0 1px 3px rgba(0,0,0,.15)',
      }}
      onMouseEnter={e => { if (!isDragging) { e.currentTarget.style.borderColor = 'var(--orange)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(255,107,0,.12)' } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.15)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span onClick={e => { e.stopPropagation(); onToggleSelect?.(c.id) }} style={{ cursor: 'pointer', color: selected ? 'var(--orange)' : 'var(--text-secondary)', flexShrink: 0 }}>
          {selected ? <Check size={14} /> : <Square size={14} />}
        </span>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{c.name || L('Sin nombre', 'No name')}</span>
      </div>
      {c.company && <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}><Building2 size={11} /> {c.company}</div>}
      {Number(c.dealValue) > 0 && <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--orange)', marginBottom: 6 }}>{fmtL(c.dealValue)}</div>}
      {(c.assigned_closer || c.assigned_setter || c.assigned_cold_caller) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
          {c.assigned_closer && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User size={11} /> <span style={{ opacity: .6 }}>C:</span> {c.assigned_closer}</div>}
          {c.assigned_setter && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User size={11} /> <span style={{ opacity: .6 }}>S:</span> {c.assigned_setter}</div>}
          {c.assigned_cold_caller && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User size={11} /> <span style={{ opacity: .6 }}>CC:</span> {c.assigned_cold_caller}</div>}
        </div>
      )}
      {tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {tags.slice(0, 3).map(t => (
            <span key={t} style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, background: 'rgba(255,107,0,.12)', color: 'var(--orange)', fontWeight: 600 }}>{t}</span>
          ))}
          {tags.length > 3 && <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>+{tags.length - 3}</span>}
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════════
// CALENDAR VIEW
// ═════════════════════════════════════════════════════════════════════════════════
function CalendarView({ contacts, getCrmActivities, onContactClick, en }) {
  const L = (es, enText) => en ? enText : es
  const locale = en ? 'en-US' : 'es-ES'
  const fmtDateTimeL = (d) => d ? new Date(d).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [allActivities, setAllActivities] = useState([])
  const [selectedDay, setSelectedDay] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const acts = []
      for (const c of contacts.slice(0, 100)) {
        try {
          const a = await getCrmActivities(c.id)
          acts.push(...a.map(x => ({ ...x, contactName: c.name, contactId: c.id })))
        } catch {}
      }
      if (!cancelled) setAllActivities(acts)
    }
    load()
    return () => { cancelled = true }
  }, [contacts, getCrmActivities, month])

  const year = month.getFullYear(), mo = month.getMonth()
  const firstDay = new Date(year, mo, 1).getDay() || 7 // Mon=1
  const daysInMonth = new Date(year, mo + 1, 0).getDate()
  const weeks = Math.ceil((firstDay - 1 + daysInMonth) / 7)
  const monthName = month.toLocaleDateString(locale, { month: 'long', year: 'numeric' })

  const scheduledActivities = useMemo(() =>
    allActivities.filter(a => a.scheduledAt && ['meeting', 'call'].includes(a.type)),
    [allActivities])

  const getActivitiesForDay = (day) => {
    return scheduledActivities.filter(a => {
      const d = new Date(a.scheduledAt)
      return d.getFullYear() === year && d.getMonth() === mo && d.getDate() === day
    })
  }

  const today = new Date()
  const isToday = (day) => today.getFullYear() === year && today.getMonth() === mo && today.getDate() === day

  const dayEvents = selectedDay ? getActivitiesForDay(selectedDay) : []

  return (
    <div>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => setMonth(new Date(year, mo - 1, 1))} style={{ ...S.btnGhost, padding: '6px 8px' }}><ChevronLeft size={16} /></button>
        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', textTransform: 'capitalize', minWidth: 160, textAlign: 'center' }}>{monthName}</span>
        <button onClick={() => setMonth(new Date(year, mo + 1, 1))} style={{ ...S.btnGhost, padding: '6px 8px' }}><ChevronRight size={16} /></button>
      </div>
      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 1 }}>
        {(en ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']).map(d => (
          <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{d}</div>
        ))}
      </div>
      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {Array.from({ length: weeks * 7 }, (_, i) => {
          const day = i - (firstDay - 2)
          const valid = day >= 1 && day <= daysInMonth
          const acts = valid ? getActivitiesForDay(day) : []
          return (
            <div key={i} onClick={() => valid && setSelectedDay(day === selectedDay ? null : day)}
              style={{
                minHeight: 72, padding: 6, background: valid ? 'var(--bg-card)' : 'transparent',
                border: valid ? `1px solid ${selectedDay === day ? 'var(--orange)' : 'var(--border)'}` : 'none',
                borderRadius: 6, cursor: valid ? 'pointer' : 'default', transition: 'all .15s',
              }}>
              {valid && (
                <>
                  <div style={{
                    fontSize: 12, fontWeight: isToday(day) ? 800 : 500,
                    color: isToday(day) ? 'var(--orange)' : 'var(--text)',
                    marginBottom: 4,
                  }}>{day}</div>
                  {acts.slice(0, 3).map((a, j) => (
                    <div key={j} style={{
                      fontSize: 9, padding: '1px 4px', marginBottom: 1, borderRadius: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      background: a.type === 'meeting' ? 'rgba(139,92,246,.2)' : 'rgba(59,130,246,.2)',
                      color: a.type === 'meeting' ? '#A78BFA' : '#60A5FA',
                    }}>{a.contactName}</div>
                  ))}
                  {acts.length > 3 && <div style={{ fontSize: 9, color: 'var(--text-secondary)' }}>+{acts.length - 3}</div>}
                </>
              )}
            </div>
          )
        })}
      </div>
      {/* Selected day events */}
      {selectedDay && (
        <div style={{ marginTop: 16, padding: 14, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ ...S.sectionLabel, marginBottom: 8 }}>{selectedDay} {monthName} - {L('Eventos', 'Events')} ({dayEvents.length})</div>
          {dayEvents.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-secondary)', opacity: .5 }}>{L('Sin eventos', 'No events')}</div>}
          {dayEvents.map((a, i) => {
            const at = ACTIVITY_TYPES.find(x => x.key === a.type) || ACTIVITY_TYPES[3]
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                onClick={() => { const c = contacts.find(x => x.id === a.contactId); if (c) onContactClick(c) }}>
                <at.icon size={13} style={{ color: 'var(--orange)' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{a.contactName}</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{a.description?.slice(0, 40)}</span>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginLeft: 'auto' }}>{fmtDateTimeL(a.scheduledAt)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════════
// CONTACT SIDEBAR (with tabs: Details / Files)
// ═════════════════════════════════════════════════════════════════════════════════
function ContactSidebar({
  contact, customFields, team, statuses, statusMap, pipelines, products, paymentFees,
  onClose, onUpdate, onDelete, onStatusChange, onEnrich,
  getCrmActivities, addCrmActivity, deleteCrmActivity,
  getCrmFiles, addCrmFile, deleteCrmFile,
  en,
  whatsappConnected, sendWhatsappMessage, saveWhatsappConfig, whatsappConfig,
}) {
  const L = (es, enText) => en ? enText : es
  const locale = en ? 'en-US' : 'es-ES'
  const fmtL = (v) => { const n = Number(v); if (!n && n !== 0) return '—'; return n.toLocaleString(locale, { style: 'currency', currency: en ? 'USD' : 'EUR', minimumFractionDigits: 0 }) }
  const fmtDateL = (d) => d ? new Date(d).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
  const fmtDateTimeL = (d) => d ? new Date(d).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
  const ACTIVITY_TYPES_L = en ? [
    { key: 'call', label: 'Call', icon: Phone },
    { key: 'email', label: 'Email', icon: Mail },
    { key: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
    { key: 'meeting', label: 'Meeting', icon: Video },
    { key: 'note', label: 'Note', icon: FileText },
  ] : ACTIVITY_TYPES
  const STATUSES = statuses
  const [tab, setTab] = useState('details') // details | whatsapp | files
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})

  // WhatsApp messaging
  const [waMessage, setWaMessage] = useState('')
  const [waSending, setWaSending] = useState(false)
  const [waSent, setWaSent] = useState(false)
  const [setterEnabled, setSetterEnabled] = useState(whatsappConfig?.setterEnabled || false)
  const [setterMessage, setSetterMessage] = useState(whatsappConfig?.setterMessage || '')

  // Activities
  const [activities, activitiesLoading, refreshActivities] = useAsync(
    useCallback(() => getCrmActivities(contact.id), [contact.id]), []
  )
  const [newActivity, setNewActivity] = useState({ type: 'note', description: '', scheduledAt: '' })
  const [showActivityForm, setShowActivityForm] = useState(false)

  // Files
  const [files, , refreshFiles] = useAsync(
    useCallback(() => getCrmFiles(contact.id), [contact.id]), []
  )
  const fileInputRef = useRef(null)

  // Notes editing
  const [notesEdit, setNotesEdit] = useState(null)

  const s = statusMap[contact.status] || STATUSES[0]

  const startEditing = () => {
    setEditForm({
      name: contact.name || '', email: contact.email || '', phone: contact.phone || '',
      company: contact.company || '', dealValue: contact.dealValue || contact.deal_value || '',
      assigned_closer: contact.assigned_closer || '', assigned_setter: contact.assigned_setter || '',
      assigned_cold_caller: contact.assigned_cold_caller || '', source: contact.source || '',
      tags: contact.tags || '', address: contact.address || '',
      whatsapp: contact.whatsapp || '', zoom_link: contact.zoom_link || '',
      website: contact.website || '', instagram: contact.instagram || '',
      country: contact.country || '',
      pipelineId: contact.pipelineId || '',
      customFields: contact.customFields || {},
      // Lead profile
      producto_interes: contact.producto_interes || '',
      capital_disponible: contact.capital_disponible || '',
      situacion_actual: contact.situacion_actual || '',
      exp_amazon: contact.exp_amazon || '',
      decisor_confirmado: contact.decisor_confirmado || '',
      fecha_llamada: contact.fecha_llamada || '',
      // UTMs & Attribution
      utm_source: contact.utm_source || '',
      utm_medium: contact.utm_medium || '',
      utm_campaign: contact.utm_campaign || '',
      utm_content: contact.utm_content || '',
      triager: contact.triager || '',
      gestor_asignado: contact.gestor_asignado || '',
      // Payment
      product: contact.product || '',
      payment_type: contact.payment_type || '',
      payment_method: contact.payment_method || '',
    })
    setEditing(true)
  }

  const saveEdit = async () => {
    await onUpdate({ ...editForm, dealValue: Number(editForm.dealValue) || 0 })
    setEditing(false)
  }

  // Auto-save when closing sidebar if in edit mode
  const handleClose = async () => {
    if (editing) {
      await onUpdate({ ...editForm, dealValue: Number(editForm.dealValue) || 0 })
    }
    onClose()
  }

  const handleAddActivity = async (e) => {
    e.preventDefault()
    if (!newActivity.description.trim()) return
    await addCrmActivity({
      contact_id: contact.id, type: newActivity.type,
      description: newActivity.description,
      scheduledAt: newActivity.scheduledAt || undefined,
    })
    refreshActivities()
    setNewActivity({ type: 'note', description: '', scheduledAt: '' })
    setShowActivityForm(false)
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    await addCrmFile({ contact_id: contact.id, name: file.name, size: file.size, type: file.type })
    refreshFiles()
  }

  const handleSaveNotes = async () => {
    if (notesEdit === null) return
    await onUpdate({ notes: notesEdit })
    setNotesEdit(null)
  }

  // ─── About section link helper ────────────────────────────────────────
  const LinkRow = ({ icon, label, value, href }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
      <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 70, flexShrink: 0 }}>{label}</span>
      {href && value ? (
        <a href={href} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--orange)', textDecoration: 'none', fontWeight: 500 }}>
          {value} <ExternalLink size={10} style={{ verticalAlign: 'middle' }} />
        </a>
      ) : (
        <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{value || '—'}</span>
      )}
    </div>
  )

  return (
    <>
      <div onClick={handleClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 999 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 500, maxWidth: '100vw',
        background: 'var(--bg)', borderLeft: '1px solid var(--border)', zIndex: 1000,
        display: 'flex', flexDirection: 'column', animation: 'slideInRight .25s ease-out',
        boxShadow: '-8px 0 30px rgba(0,0,0,.3)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, background: `${s.color}22`, color: s.color }}>
            {(contact.name || '?')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contact.name || L('Sin nombre', 'No name')}</div>
              {contact.phone && (
                <button onClick={() => setTab('whatsapp')}
                  title="WhatsApp" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '50%', background: whatsappConnected ? '#25D36622' : 'rgba(255,255,255,.06)', color: whatsappConnected ? '#25D366' : 'var(--text-secondary)', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                  <MessageSquare size={13} />
                </button>
              )}
              {contact.instagram && (
                <a href={`https://instagram.com/${contact.instagram.replace(/^@/, '')}`} target="_blank" rel="noreferrer"
                  title="Instagram" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '50%', background: '#E1306C22', color: '#E1306C', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                  <Globe size={13} />
                </a>
              )}
            </div>
            {contact.company && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{contact.company}</div>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {!editing && <button onClick={async () => { try { const r = await onEnrich(contact.id); alert(`Enriquecido: ${r.phone ? 'Tel: ' + r.phone : 'Sin tel'}, ${r.email ? 'Email: ' + r.email : 'Sin email'}, ${r.billing?.cif ? 'CIF: ' + r.billing.cif : ''}`) } catch (e) { alert('Error: ' + e.message) } }}
              style={{ padding: '6px 10px', background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 6, cursor: 'pointer', color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}><Search size={13} /> {L('Enriquecer', 'Enrich')}</button>}
            {!editing && <button onClick={startEditing} style={{ ...S.btnGhost, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}><Edit3 size={13} /> {L('Editar', 'Edit')}</button>}
            <button onClick={onDelete} style={{ padding: '6px 10px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 6, cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center', fontSize: 12 }}><Trash2 size={13} /></button>
            <button onClick={handleClose} style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={18} /></button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {[{ key: 'details', label: L('Detalles', 'Details') }, { key: 'whatsapp', label: 'WhatsApp' }, { key: 'files', label: L('Archivos', 'Files') }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: '10px', background: 'transparent', border: 'none',
                borderBottom: tab === t.key ? '2px solid var(--orange)' : '2px solid transparent',
                color: tab === t.key ? 'var(--orange)' : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all .15s',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {tab === 'details' && (
            <>
              {/* Status buttons */}
              <div style={{ marginBottom: 20 }}>
                <div style={S.sectionLabel}>{L('Estado', 'Status')}</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {STATUSES.map(st => (
                    <button key={st.key} onClick={() => onStatusChange(contact.id, st.key)}
                      style={{
                        padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                        background: contact.status === st.key ? `${st.color}33` : 'var(--bg-card)',
                        color: contact.status === st.key ? st.color : 'var(--text-secondary)',
                        border: contact.status === st.key ? `1px solid ${st.color}` : '1px solid var(--border)',
                      }}>
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pipeline selector */}
              <div style={{ marginBottom: 20 }}>
                <div style={S.sectionLabel}>Pipeline</div>
                <select value={contact.pipelineId || ''} 
                  onChange={e => onUpdate({ pipelineId: e.target.value })}
                  style={S.input}>
                  {(pipelines || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* SECTIONS - Read-only / Edit mode */}
              {!editing ? (
                <>
                  {/* Datos del Cliente */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={S.sectionLabel}>{L('Datos del Cliente', 'Client Data')}</div>
                    <div style={{ display: 'grid', gap: 2 }}>
                      <LinkRow icon={<Mail size={13} />} label="Email" value={contact.email} href={contact.email ? `mailto:${contact.email}` : null} />
                      <LinkRow icon={<Phone size={13} />} label={L('Teléfono', 'Phone')} value={contact.phone} />
                      <LinkRow icon={<Building2 size={13} />} label={L('Empresa', 'Company')} value={contact.company} />
                      <LinkRow icon={<MapPin size={13} />} label={L('País', 'Country')} value={contact.country} />
                      <LinkRow icon={<MapPin size={13} />} label={L('Dirección', 'Address')} value={contact.address} />
                      <LinkRow icon={<MessageSquare size={13} />} label="WhatsApp" value={contact.whatsapp}
                        href={contact.whatsapp ? `https://wa.me/${contact.whatsapp.replace(/[^0-9]/g, '')}` : null} />
                      <LinkRow icon={<Globe size={13} />} label="Instagram" value={contact.instagram ? `@${contact.instagram.replace(/^@/, '')}` : ''}
                        href={contact.instagram ? `https://instagram.com/${contact.instagram.replace(/^@/, '')}` : null} />
                      <LinkRow icon={<Globe size={13} />} label="Website" value={contact.website ? L('Visitar', 'Visit') : ''} href={contact.website} />
                      <LinkRow icon={<Video size={13} />} label="Zoom" value={contact.zoom_link ? L('Enlace', 'Link') : ''} href={contact.zoom_link} />
                      <LinkRow icon={<Globe size={13} />} label={L('Fuente', 'Source')} value={contact.source} />
                      <LinkRow icon={<Calendar size={13} />} label={L('Creado', 'Created')} value={fmtDateL(contact.created_at)} />
                    </div>
                    {contact.tags && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0' }}>
                        <Tag size={13} style={{ color: 'var(--text-secondary)', marginTop: 2 }} />
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {(Array.isArray(contact.tags) ? contact.tags : (contact.tags || '').split(',')).map(t => String(t).trim()).filter(Boolean).map(t => (
                            <span key={t} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: 'rgba(255,107,0,.12)', color: 'var(--orange)', fontWeight: 600 }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Equipo Asignado */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={S.sectionLabel}>{L('Equipo Asignado', 'Assigned Team')}</div>
                    <div style={{ display: 'grid', gap: 2 }}>
                      <LinkRow icon={<User size={13} />} label="Closer" value={contact.assigned_closer} />
                      <LinkRow icon={<User size={13} />} label="Setter" value={contact.assigned_setter} />
                      <LinkRow icon={<User size={13} />} label="Cold Caller" value={contact.assigned_cold_caller} />
                      <LinkRow icon={<User size={13} />} label="Triager" value={contact.triager} />
                      <LinkRow icon={<User size={13} />} label={L('Gestor', 'Manager')} value={contact.gestor_asignado} />
                    </div>
                  </div>

                  {/* Perfil del Lead */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={S.sectionLabel}>{L('Perfil del Lead', 'Lead Profile')}</div>
                    <div style={{ display: 'grid', gap: 2 }}>
                      <LinkRow icon={<FileText size={13} />} label={L('Situación', 'Situation')} value={contact.situacion_actual} />
                      <LinkRow icon={<DollarSign size={13} />} label={L('Capital', 'Capital')} value={contact.capital_disponible} />
                      <LinkRow icon={<FileText size={13} />} label="Exp Amazon" value={contact.exp_amazon} />
                      <LinkRow icon={<Check size={13} />} label={L('Decisor', 'Decider')} value={contact.decisor_confirmado} />
                      <LinkRow icon={<FileText size={13} />} label={L('Producto Interés', 'Product Interest')} value={contact.producto_interes} />
                      <LinkRow icon={<Calendar size={13} />} label={L('Fecha Llamada', 'Call Date')} value={fmtDateL(contact.fecha_llamada)} />
                    </div>
                  </div>

                  {/* UTMs & Atribución */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={S.sectionLabel}>UTMs & {L('Atribución', 'Attribution')}</div>
                    <div style={{ display: 'grid', gap: 2 }}>
                      <LinkRow icon={<Globe size={13} />} label="UTM Source" value={contact.utm_source} />
                      <LinkRow icon={<Globe size={13} />} label="UTM Medium" value={contact.utm_medium} />
                      <LinkRow icon={<Globe size={13} />} label="UTM Campaign" value={contact.utm_campaign} />
                      <LinkRow icon={<Globe size={13} />} label="UTM Content" value={contact.utm_content} />
                    </div>
                  </div>

                  {/* Pago */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={S.sectionLabel}>{L('Pago', 'Payment')}</div>
                    <div style={{ display: 'grid', gap: 2 }}>
                      <LinkRow icon={<DollarSign size={13} />} label={L('Valor', 'Value')} value={fmtL(contact.dealValue || contact.deal_value)} />
                      <LinkRow icon={<FileText size={13} />} label={L('Producto', 'Product')} value={contact.product} />
                      <LinkRow icon={<FileText size={13} />} label={L('Tipo Pago', 'Pay Type')} value={contact.payment_type} />
                      <LinkRow icon={<FileText size={13} />} label={L('Método', 'Method')} value={contact.payment_method} />
                    </div>
                  </div>

                  {/* Facturación / Empresa */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={S.sectionLabel}>{L('Facturación / Empresa', 'Billing / Company')}</div>
                    <div style={{ display: 'grid', gap: 2 }}>
                      <LinkRow icon={<User size={13} />} label={L('Dueño / Owner', 'Owner')} value={contact.owner_name || contact.ownerName} />
                      <LinkRow icon={<Mail size={13} />} label={L('Email del Dueño', 'Owner Email')} value={contact.owner_email || contact.ownerEmail} href={(contact.owner_email || contact.ownerEmail) ? `mailto:${contact.owner_email || contact.ownerEmail}` : null} />
                      <LinkRow icon={<DollarSign size={13} />} label={L('Facturación Anual', 'Annual Revenue')} value={contact.billing_annual || contact.billingAnnual ? fmtL(contact.billing_annual || contact.billingAnnual) : ''} />
                      <LinkRow icon={<FileText size={13} />} label="CIF / NIF" value={contact.billing_cif || contact.billingCif} />
                      <LinkRow icon={<MapPin size={13} />} label={L('Dir. Fiscal', 'Billing Address')} value={contact.billing_address || contact.billingAddress} />
                    </div>
                  </div>

                  {/* Custom fields display */}
                  {customFields.length > 0 && contact.customFields && Object.keys(contact.customFields).length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={S.sectionLabel}>{L('Campos Personalizados', 'Custom Fields')}</div>
                      {customFields.map(f => {
                        const val = contact.customFields?.[f.fieldKey || f.field_key || f.id || f.name]
                        if (val === undefined || val === '') return null
                        return (
                          <div key={f.id || f.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{f.name}</span>
                            <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{(f.fieldType || f.type) === 'checkbox' ? (val ? L('Sí', 'Yes') : 'No') : String(val)}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : (
                /* Edit Form - Organized by sections */
                <div style={{ marginBottom: 24 }}>
                  {/* Datos del Cliente */}
                  <div style={{ ...S.sectionLabel, color: 'var(--orange)' }}>{L('Datos del Cliente', 'Client Data')}</div>
                  <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                    {[
                      { label: L('Nombre', 'Name'), key: 'name' }, { label: 'Email', key: 'email', type: 'email' },
                      { label: L('Teléfono', 'Phone'), key: 'phone' }, { label: L('Empresa', 'Company'), key: 'company' },
                      { label: L('País', 'Country'), key: 'country' },
                      { label: L('Dirección', 'Address'), key: 'address' }, { label: 'WhatsApp', key: 'whatsapp' },
                      { label: 'Instagram', key: 'instagram' },
                      { label: 'Website', key: 'website', type: 'url' },
                      { label: 'Zoom Link', key: 'zoom_link', type: 'url' },
                      { label: 'Tags', key: 'tags' },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={S.label}>{f.label}</label>
                        <input type={f.type || 'text'} value={editForm[f.key] || ''} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} style={S.input} />
                      </div>
                    ))}
                    <div>
                      <label style={S.label}>{L('Fuente', 'Source')}</label>
                      <select value={editForm.source} onChange={e => setEditForm(p => ({ ...p, source: e.target.value }))} style={S.input}>
                        <option value="">{L('— Seleccionar —', '— Select —')}</option>
                        {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={S.label}>Pipeline</label>
                      <select value={editForm.pipelineId || ''} onChange={e => setEditForm(p => ({ ...p, pipelineId: e.target.value }))} style={S.input}>
                        {(pipelines || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Equipo Asignado */}
                  <div style={{ ...S.sectionLabel, color: 'var(--orange)' }}>{L('Equipo Asignado', 'Assigned Team')}</div>
                  <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                    {[
                      { label: 'Closer', key: 'assigned_closer' },
                      { label: 'Setter', key: 'assigned_setter' },
                      { label: 'Cold Caller', key: 'assigned_cold_caller' },
                      { label: 'Triager', key: 'triager' },
                      { label: L('Gestor Asignado', 'Assigned Manager'), key: 'gestor_asignado' },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={S.label}>{f.label}</label>
                        <select value={editForm[f.key] || ''} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} style={S.input}>
                          <option value="">{L('— Sin asignar —', '— Unassigned —')}</option>
                          {team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>

                  {/* Perfil del Lead */}
                  <div style={{ ...S.sectionLabel, color: 'var(--orange)' }}>{L('Perfil del Lead', 'Lead Profile')}</div>
                  <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                    {[
                      { label: L('Situación Actual', 'Current Situation'), key: 'situacion_actual' },
                      { label: L('Capital Disponible', 'Available Capital'), key: 'capital_disponible' },
                      { label: 'Exp Amazon', key: 'exp_amazon' },
                      { label: L('Producto Interés', 'Product Interest'), key: 'producto_interes' },
                      { label: L('Fecha Llamada', 'Call Date'), key: 'fecha_llamada', type: 'date' },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={S.label}>{f.label}</label>
                        <input type={f.type || 'text'} value={editForm[f.key] || ''} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} style={S.input} />
                      </div>
                    ))}
                    <div>
                      <label style={S.label}>{L('Decisor Confirmado', 'Decision Maker')}</label>
                      <select value={editForm.decisor_confirmado || ''} onChange={e => setEditForm(p => ({ ...p, decisor_confirmado: e.target.value }))} style={S.input}>
                        <option value="">—</option>
                        <option value="Sí">{L('Sí', 'Yes')}</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                  </div>

                  {/* UTMs & Atribución */}
                  <div style={{ ...S.sectionLabel, color: 'var(--orange)' }}>UTMs & {L('Atribución', 'Attribution')}</div>
                  <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                    {[
                      { label: 'UTM Source', key: 'utm_source' },
                      { label: 'UTM Medium', key: 'utm_medium' },
                      { label: 'UTM Campaign', key: 'utm_campaign' },
                      { label: 'UTM Content', key: 'utm_content' },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={S.label}>{f.label}</label>
                        <input value={editForm[f.key] || ''} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} style={S.input} />
                      </div>
                    ))}
                  </div>

                  {/* Pago */}
                  <div style={{ ...S.sectionLabel, color: 'var(--orange)' }}>{L('Pago', 'Payment')}</div>
                  <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                    <div>
                      <label style={S.label}>{L('Valor del Trato', 'Deal Value')}</label>
                      <input type="number" value={editForm.dealValue || ''} onChange={e => setEditForm(p => ({ ...p, dealValue: e.target.value }))} style={S.input} />
                    </div>
                    <div>
                      <label style={S.label}>{L('Producto', 'Product')}</label>
                      <select value={editForm.product || ''} onChange={e => setEditForm(p => ({ ...p, product: e.target.value }))} style={S.input}>
                        <option value="">—</option>
                        {(products || []).filter(p => p.active !== false).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={S.label}>{L('Tipo de Pago', 'Payment Type')}</label>
                      <select value={editForm.payment_type || ''} onChange={e => setEditForm(p => ({ ...p, payment_type: e.target.value }))} style={S.input}>
                        <option value="">—</option>
                        {['Pago único', '2 cuotas', '3 cuotas', '4 cuotas', '5 cuotas', '6 cuotas'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={S.label}>{L('Método de Pago', 'Payment Method')}</label>
                      <select value={editForm.payment_method || ''} onChange={e => setEditForm(p => ({ ...p, payment_method: e.target.value }))} style={S.input}>
                        <option value="">—</option>
                        {(paymentFees || []).map(f => <option key={f.method} value={f.method}>{f.method}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Facturación / Empresa */}
                  <div style={{ ...S.sectionLabel, color: 'var(--orange)' }}>{L('Facturación / Empresa', 'Billing / Company')}</div>
                  <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                    {[
                      { label: L('Dueño / Owner', 'Owner Name'), key: 'owner_name' },
                      { label: L('Email del Dueño', 'Owner Email'), key: 'owner_email', type: 'email' },
                      { label: 'CIF / NIF', key: 'billing_cif' },
                      { label: L('Dir. Fiscal', 'Billing Address'), key: 'billing_address' },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={S.label}>{f.label}</label>
                        <input type={f.type || 'text'} value={editForm[f.key] || ''} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} style={S.input} />
                      </div>
                    ))}
                    <div>
                      <label style={S.label}>{L('Facturación Anual (€)', 'Annual Revenue (€)')}</label>
                      <input type="number" value={editForm.billing_annual || ''} onChange={e => setEditForm(p => ({ ...p, billing_annual: e.target.value }))} style={S.input} placeholder="100000" />
                    </div>
                  </div>

                  {/* Custom Fields */}
                  {customFields.map(f => (
                    <CustomFieldInput key={f.id || f.name} field={{ ...f, type: f.fieldType || f.type }} value={editForm.customFields?.[f.fieldKey || f.field_key || f.id || f.name] || ''}
                      onChange={v => setEditForm(p => ({ ...p, customFields: { ...p.customFields, [f.fieldKey || f.field_key || f.id || f.name]: v } }))} />
                  ))}

                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    <button onClick={() => setEditing(false)} style={{ ...S.btnGhost, flex: 1, padding: '8px', fontSize: 13 }}>{L('Cancelar', 'Cancel')}</button>
                    <button onClick={saveEdit} className="btn-action" style={{ flex: 1, padding: '8px', fontSize: 13 }}><Save size={13} style={{ marginRight: 4 }} /> {L('Guardar', 'Save')}</button>
                  </div>
                </div>
              )}

              {/* NOTES section */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={S.sectionLabel}>{L('Notas', 'Notes')}</span>
                  {notesEdit === null ? (
                    <button onClick={() => setNotesEdit(contact.notes || '')} style={{ ...S.btnGhost, fontSize: 10, padding: '3px 8px' }}><Edit3 size={10} /></button>
                  ) : (
                    <button onClick={handleSaveNotes} style={{ padding: '3px 8px', background: 'var(--orange)', color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>{L('Guardar', 'Save')}</button>
                  )}
                </div>
                {notesEdit !== null ? (
                  <textarea value={notesEdit} onChange={e => setNotesEdit(e.target.value)} rows={4}
                    style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit', fontSize: 12 }} />
                ) : (
                  <div style={{ padding: 10, background: 'var(--bg-card)', borderRadius: 8, fontSize: 13, color: 'var(--text)', lineHeight: 1.5, border: '1px solid var(--border)', minHeight: 40 }}>
                    {contact.notes || <span style={{ color: 'var(--text-secondary)', opacity: .5 }}>{L('Sin notas', 'No notes')}</span>}
                  </div>
                )}
              </div>

              {/* ACTIVITY timeline */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={S.sectionLabel}>{L('Actividad', 'Activity')}</span>
                  <button onClick={() => setShowActivityForm(!showActivityForm)}
                    style={{ padding: '4px 10px', background: 'var(--orange)', color: '#000', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Plus size={12} /> {L('Añadir', 'Add')}
                  </button>
                </div>
                {showActivityForm && (
                  <form onSubmit={handleAddActivity} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      {ACTIVITY_TYPES_L.map(at => (
                        <button key={at.key} type="button" onClick={() => setNewActivity(p => ({ ...p, type: at.key }))}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                            background: newActivity.type === at.key ? 'var(--orange)' : 'transparent',
                            color: newActivity.type === at.key ? '#000' : 'var(--text-secondary)',
                          }}>
                          <at.icon size={12} /> {at.label}
                        </button>
                      ))}
                    </div>
                    <textarea value={newActivity.description} onChange={e => setNewActivity(p => ({ ...p, description: e.target.value }))}
                      placeholder={L('Descripción...', 'Description...')} rows={2}
                      style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit', fontSize: 12, marginBottom: 6 }} />
                    {['meeting', 'call'].includes(newActivity.type) && (
                      <input type="datetime-local" value={newActivity.scheduledAt || ''} onChange={e => setNewActivity(p => ({ ...p, scheduledAt: e.target.value }))}
                        style={{ ...S.input, fontSize: 12, marginBottom: 6, colorScheme: 'dark' }} />
                    )}
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => setShowActivityForm(false)} style={{ ...S.btnGhost, fontSize: 11 }}>{L('Cancelar', 'Cancel')}</button>
                      <button type="submit" style={{ padding: '5px 12px', background: 'var(--orange)', color: '#000', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>{L('Guardar', 'Save')}</button>
                    </div>
                  </form>
                )}
                {activitiesLoading ? (
                  <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 12 }}>{L('Cargando...', 'Loading...')}</div>
                ) : activities.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)', fontSize: 12, opacity: .5 }}>{L('Sin actividades', 'No activity')}</div>
                ) : (
                  <div style={{ position: 'relative', paddingLeft: 20 }}>
                    <div style={{ position: 'absolute', left: 6, top: 4, bottom: 4, width: 1, background: 'var(--border)' }} />
                    {activities.map((act, idx) => {
                      const at = ACTIVITY_TYPES_L.find(a => a.key === act.type) || ACTIVITY_TYPES_L[3]
                      return (
                        <div key={act.id || idx} style={{ position: 'relative', marginBottom: 12, paddingBottom: 12, borderBottom: idx < activities.length - 1 ? '1px solid rgba(255,255,255,.03)' : 'none' }}>
                          <div style={{ position: 'absolute', left: -17, top: 3, width: 12, height: 12, borderRadius: '50%', background: 'var(--bg)', border: '2px solid var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--orange)' }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                <at.icon size={12} style={{ color: 'var(--orange)' }} />
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{at.label}</span>
                                <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{fmtDateTimeL(act.created_at)}</span>
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{act.description}</div>
                            </div>
                            <button onClick={() => { if (confirm(L('¿Eliminar?', 'Delete?'))) { deleteCrmActivity(act.id); refreshActivities() } }}
                              style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', opacity: .4 }}
                              onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '.4'}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* WHATSAPP TAB */}
          {tab === 'whatsapp' && (
            <div>
              {/* Connection status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600,
                  background: whatsappConnected ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  color: whatsappConnected ? '#22C55E' : '#EF4444',
                  border: `1px solid ${whatsappConnected ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: whatsappConnected ? '#22C55E' : '#EF4444' }} />
                  {whatsappConnected ? (en ? 'Connected' : 'Conectado') : (en ? 'Disconnected' : 'Desconectado')}
                </div>
              </div>

              {!whatsappConnected ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                  <MessageSquare size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
                  <p style={{ margin: '0 0 8px', fontSize: 14 }}>{L('WhatsApp no conectado', 'WhatsApp not connected')}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{L('Ve a Integraciones para conectar WhatsApp con QR', 'Go to Integrations to connect WhatsApp via QR')}</p>
                </div>
              ) : (
                <>
                  {/* Quick send */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={S.sectionLabel}>{L('Enviar mensaje', 'Send message')}</div>
                    <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                      {L('A:', 'To:')} {contact.phone || contact.whatsapp || L('Sin numero', 'No number')}
                    </div>
                    <textarea
                      value={waMessage}
                      onChange={e => setWaMessage(e.target.value)}
                      placeholder={en ? 'Write your message...' : 'Escribe tu mensaje...'}
                      rows={3}
                      style={{ ...S.input, resize: 'vertical', minHeight: 60, fontFamily: 'inherit' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <button
                        disabled={waSending || !waMessage.trim() || !(contact.phone || contact.whatsapp)}
                        onClick={async () => {
                          const phone = contact.phone || contact.whatsapp
                          if (!phone || !waMessage.trim()) return
                          setWaSending(true)
                          try {
                            await sendWhatsappMessage(phone, waMessage.trim())
                            await addCrmActivity({ contactId: contact.id, type: 'whatsapp', description: waMessage.trim() })
                            setWaMessage('')
                            setWaSent(true)
                            setTimeout(() => setWaSent(false), 3000)
                          } catch (err) {
                            alert('Error: ' + err.message)
                          }
                          setWaSending(false)
                        }}
                        style={{
                          padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                          fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                          background: waSending || !waMessage.trim() ? 'rgba(255,255,255,.06)' : '#25D366',
                          color: waSending || !waMessage.trim() ? 'var(--text-secondary)' : '#fff',
                          transition: 'all .2s',
                        }}
                      >
                        <MessageSquare size={14} />
                        {waSending ? (en ? 'Sending...' : 'Enviando...') : (en ? 'Send WhatsApp' : 'Enviar WhatsApp')}
                      </button>
                      {waSent && <span style={{ color: '#22C55E', fontSize: 12, fontWeight: 600 }}>✓ {en ? 'Sent' : 'Enviado'}</span>}
                    </div>
                  </div>

                  {/* Setter Automatico */}
                  <div style={{
                    marginBottom: 20, padding: 16, borderRadius: 12,
                    background: 'rgba(37,211,102,0.04)', border: '1px solid rgba(37,211,102,0.15)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                          {L('Setter Automatico', 'Auto Setter')}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                          {L('Responde automaticamente a mensajes entrantes con IA', 'Automatically replies to incoming messages with AI')}
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          const next = !setterEnabled
                          setSetterEnabled(next)
                          try {
                            await saveWhatsappConfig({ setterEnabled: next, setterMessage })
                          } catch {}
                        }}
                        style={{
                          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                          background: setterEnabled ? '#25D366' : 'rgba(255,255,255,.1)',
                          position: 'relative', transition: 'background .2s', flexShrink: 0,
                        }}
                      >
                        <div style={{
                          width: 18, height: 18, borderRadius: '50%', background: '#fff',
                          position: 'absolute', top: 3,
                          left: setterEnabled ? 23 : 3,
                          transition: 'left .2s',
                        }} />
                      </button>
                    </div>
                    {setterEnabled && (
                      <>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 6 }}>
                          {L('Mensaje personalizado del setter (opcional)', 'Custom setter message (optional)')}
                        </div>
                        <textarea
                          value={setterMessage}
                          onChange={e => setSetterMessage(e.target.value)}
                          onBlur={async () => {
                            try { await saveWhatsappConfig({ setterEnabled, setterMessage }) } catch {}
                          }}
                          placeholder={en ? 'Custom greeting or instructions for the AI setter...' : 'Saludo personalizado o instrucciones para el setter IA...'}
                          rows={3}
                          style={{ ...S.input, resize: 'vertical', minHeight: 60, fontFamily: 'inherit', fontSize: 12 }}
                        />
                      </>
                    )}
                  </div>

                  {/* Recent WhatsApp activities */}
                  <div>
                    <div style={S.sectionLabel}>{L('Historial WhatsApp', 'WhatsApp History')}</div>
                    {(activities || []).filter(a => a.type === 'whatsapp').length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '12px 0' }}>
                        {L('No hay mensajes enviados aun', 'No messages sent yet')}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(activities || []).filter(a => a.type === 'whatsapp').slice(0, 20).map(a => (
                          <div key={a.id} style={{
                            padding: '10px 12px', borderRadius: 10,
                            background: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.1)',
                          }}>
                            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{a.description}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>{fmtDateTimeL(a.createdAt || a.created_at)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* FILES TAB */}
          {tab === 'files' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={S.sectionLabel}>{L('Archivos', 'Files')}</span>
                <button onClick={() => fileInputRef.current?.click()}
                  style={{ padding: '6px 12px', background: 'var(--orange)', color: '#000', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Upload size={13} /> {L('Subir', 'Upload')}
                </button>
                <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileUpload} />
              </div>
              {(!files || files.length === 0) ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', opacity: .5, fontSize: 13 }}>
                  <Paperclip size={24} style={{ marginBottom: 8, opacity: .3 }} /><br />
                  {L('Sin archivos adjuntos', 'No attached files')}
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 6 }}>
                  {files.map(f => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <Paperclip size={14} style={{ color: 'var(--orange)', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{f.type} {f.size ? `- ${(f.size / 1024).toFixed(1)}KB` : ''}</div>
                      </div>
                      <button onClick={() => { if (confirm(L('¿Eliminar archivo?', 'Delete file?'))) { deleteCrmFile(f.id); refreshFiles() } }}
                        style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: '#EF4444' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </>
  )
}

// ─── Custom Field Input ─────────────────────────────────────────────────────────
function CustomFieldInput({ field, value, onChange }) {
  if (field.type === 'checkbox') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} style={{ accentColor: 'var(--orange)' }} />
        <span style={{ fontSize: 13, color: 'var(--text)' }}>{field.name}</span>
      </label>
    )
  }
  return (
    <div>
      <label style={S.label}>{field.name}</label>
      {field.type === 'select' ? (
        <select value={value} onChange={e => onChange(e.target.value)} style={S.input}>
          <option value="">—</option>
          {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={field.type === 'datetime' ? 'datetime-local' : field.type === 'date' ? 'date' : field.type === 'number' || field.type === 'currency' ? 'number' : field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : field.type === 'phone' ? 'tel' : 'text'}
          value={value} onChange={e => onChange(e.target.value)}
          style={{ ...S.input, ...(field.type === 'date' || field.type === 'datetime' ? { colorScheme: 'dark' } : {}) }} />
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════════
// PIPELINE EDITOR MODAL (multi-pipeline)
// ═════════════════════════════════════════════════════════════════════════════════
function PipelineEditorModal({ pipelines, activePipeline, onClose, onSavePipeline, onDeletePipeline, en }) {
  const L = (es, enText) => en ? enText : es
  const [selectedId, setSelectedId] = useState(activePipeline?.id || null)
  const selected = pipelines.find(p => p.id === selectedId)
  const [name, setName] = useState(selected?.name || '')
  const [stages, setStages] = useState(() => (parseStages(selected?.stages) || DEFAULT_STATUSES).map((s, i) => ({ ...s, position: i })))
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (selected) { setName(selected.name); setStages((parseStages(selected.stages) || DEFAULT_STATUSES).map((s, i) => ({ ...s, position: i }))) }
  }, [selectedId])

  const updateStage = (idx, field, value) => setStages(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  const moveStage = (idx, dir) => {
    const n = [...stages]; const j = idx + dir
    if (j < 0 || j >= n.length) return
    ;[n[idx], n[j]] = [n[j], n[idx]]; setStages(n)
  }
  const addStage = () => setStages(prev => [...prev, { key: `stage_${Date.now()}`, label: L('Nueva Etapa', 'New Stage'), color: '#6B7280' }])
  const removeStage = (idx) => { if (stages.length > 2) setStages(prev => prev.filter((_, i) => i !== idx)) }

  const handleSave = async () => {
    const cleanStages = stages.map(({ position, ...rest }) => rest)
    try {
      if (creating) {
        await onSavePipeline(null, { name: name || L('Nuevo Pipeline', 'New Pipeline'), stages: cleanStages, isDefault: false })
        setCreating(false)
      } else if (selected) {
        await onSavePipeline(selected.id, { name, stages: cleanStages })
      }
      onClose()
    } catch (err) {
      console.error('Pipeline save error:', err)
    }
  }

  const startNew = () => {
    setCreating(true); setSelectedId(null)
    setName(L('Nuevo Pipeline', 'New Pipeline'))
    setStages(DEFAULT_STATUSES.map((s, i) => ({ ...s, position: i })))
  }

  return (
    <>
      <div onClick={onClose} style={S.overlay} />
      <div style={{ ...S.modal, width: 620 }}>
        <div style={S.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Palette size={16} style={{ color: 'var(--orange)' }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Pipelines</span>
          </div>
          <button onClick={onClose} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Pipeline list */}
          <div style={{ width: 160, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '8px 0' }}>
            {pipelines.map(p => (
              <div key={p.id} onClick={() => { setSelectedId(p.id); setCreating(false) }}
                style={{
                  padding: '8px 14px', fontSize: 12, cursor: 'pointer',
                  background: p.id === selectedId && !creating ? 'rgba(255,107,0,.1)' : 'transparent',
                  color: p.id === selectedId && !creating ? 'var(--orange)' : 'var(--text)',
                  fontWeight: p.id === selectedId && !creating ? 700 : 400, borderLeft: p.id === selectedId && !creating ? '3px solid var(--orange)' : '3px solid transparent',
                }}>
                {p.name}
              </div>
            ))}
            <button onClick={startNew}
              style={{ width: 'calc(100% - 16px)', margin: '8px 8px', padding: '6px', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', background: 'transparent', border: '1px dashed var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 11 }}>
              <Plus size={12} /> {L('Nuevo', 'New')}
            </button>
          </div>
          {/* Editor */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>{L('Nombre', 'Name')}</label>
              <input value={name} onChange={e => setName(e.target.value)} style={S.input} />
            </div>
            {stages.map((stage, idx) => (
              <div key={stage.key + idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <button onClick={() => moveStage(idx, -1)} disabled={idx === 0}
                    style={{ padding: 0, background: 'transparent', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? 'var(--border)' : 'var(--text-secondary)', lineHeight: 1 }}>
                    <ArrowUp size={11} />
                  </button>
                  <button onClick={() => moveStage(idx, 1)} disabled={idx === stages.length - 1}
                    style={{ padding: 0, background: 'transparent', border: 'none', cursor: idx === stages.length - 1 ? 'default' : 'pointer', color: idx === stages.length - 1 ? 'var(--border)' : 'var(--text-secondary)', lineHeight: 1 }}>
                    <ArrowDown size={11} />
                  </button>
                </div>
                <input type="color" value={stage.color} onChange={e => updateStage(idx, 'color', e.target.value)}
                  style={{ width: 26, height: 26, padding: 0, border: '2px solid var(--border)', borderRadius: 5, cursor: 'pointer', background: 'transparent' }} />
                <input value={stage.label} onChange={e => updateStage(idx, 'label', e.target.value)}
                  style={{ flex: 1, padding: '5px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', fontSize: 12, outline: 'none' }} />
                <span style={{ fontSize: 9, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{stage.key}</span>
                <button onClick={() => removeStage(idx)} disabled={stages.length <= 2}
                  style={{ padding: 3, background: 'transparent', border: 'none', cursor: stages.length <= 2 ? 'default' : 'pointer', color: stages.length <= 2 ? 'var(--border)' : '#EF4444' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <button onClick={addStage}
              style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, padding: '6px 14px', background: 'transparent', border: '1px dashed var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 11, width: '100%', justifyContent: 'center' }}>
              <Plus size={13} /> {L('Añadir etapa', 'Add stage')}
            </button>
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          {selected && !creating && (
            <button onClick={() => onDeletePipeline(selected.id)}
              style={{ padding: '8px 14px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 6, cursor: 'pointer', color: '#EF4444', fontSize: 12 }}>
              {L('Eliminar Pipeline', 'Delete Pipeline')}
            </button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ ...S.btnGhost, padding: '8px 18px', fontSize: 13 }}>{L('Cancelar', 'Cancel')}</button>
            <button onClick={handleSave} className="btn-action" style={{ padding: '8px 18px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Save size={14} /> {L('Guardar', 'Save')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ═════════════════════════════════════════════════════════════════════════════════
// CUSTOM FIELDS MODAL
// ═════════════════════════════════════════════════════════════════════════════════
function CustomFieldsModal({ fields, onClose, onAdd, onUpdate, onDelete, refresh, en }) {
  const L = (es, enText) => en ? enText : es
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', type: 'text', options: '', position: 0 })

  const startCreate = () => { setForm({ name: '', type: 'text', options: '', position: fields.length }); setCreating(true); setEditingId(null) }
  const startEdit = (f) => { setForm({ name: f.name, type: f.fieldType || f.type, options: (f.options || []).join(', '), position: f.position || 0 }); setEditingId(f.id); setCreating(false) }

  const handleSave = async () => {
    if (!form.name.trim()) return
    const payload = {
      name: form.name, fieldKey: generateFieldKey(form.name), fieldType: form.type, position: form.position,
      options: form.type === 'select' ? form.options.split(',').map(o => o.trim()).filter(Boolean) : [],
    }
    if (editingId) await onUpdate(editingId, payload)
    else await onAdd(payload)
    refresh(); setCreating(false); setEditingId(null); setForm({ name: '', type: 'text', options: '', position: 0 })
  }

  const moveField = async (field, direction) => {
    const sorted = [...fields].sort((a, b) => (a.position || 0) - (b.position || 0))
    const idx = sorted.findIndex(f => f.id === field.id); const j = idx + direction
    if (j < 0 || j >= sorted.length) return
    await onUpdate(field.id, { position: sorted[j].position || j })
    await onUpdate(sorted[j].id, { position: field.position || idx })
    refresh()
  }

  const sortedFields = [...fields].sort((a, b) => (a.position || 0) - (b.position || 0))

  return (
    <>
      <div onClick={onClose} style={S.overlay} />
      <div style={{ ...S.modal, width: 520 }}>
        <div style={S.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={16} style={{ color: 'var(--orange)' }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{L('Campos Personalizados', 'Custom Fields')}</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={startCreate} style={{ padding: '5px 12px', background: 'var(--orange)', color: '#000', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Plus size={13} /> {L('Añadir', 'Add')}
            </button>
            <button onClick={onClose} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={18} /></button>
          </div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 20px' }}>
          {sortedFields.length === 0 && !creating && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>{L('No hay campos personalizados.', 'No custom fields.')}</div>
          )}
          {sortedFields.map((f, idx) => {
            const Icon = FIELD_TYPE_ICONS[f.fieldType || f.type] || FileText
            const isE = editingId === f.id
            return (
              <div key={f.id} style={{ padding: '10px 12px', marginBottom: 6, background: isE ? 'rgba(255,107,0,.05)' : 'var(--bg)', border: `1px solid ${isE ? 'var(--orange)' : 'var(--border)'}`, borderRadius: 8 }}>
                {!isE ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <button onClick={() => moveField(f, -1)} disabled={idx === 0} style={{ padding: 0, background: 'transparent', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? 'var(--border)' : 'var(--text-secondary)', fontSize: 10, lineHeight: 1 }}>&#9650;</button>
                      <button onClick={() => moveField(f, 1)} disabled={idx === sortedFields.length - 1} style={{ padding: 0, background: 'transparent', border: 'none', cursor: idx === sortedFields.length - 1 ? 'default' : 'pointer', color: idx === sortedFields.length - 1 ? 'var(--border)' : 'var(--text-secondary)', fontSize: 10, lineHeight: 1 }}>&#9660;</button>
                    </div>
                    <Icon size={14} style={{ color: 'var(--orange)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{f.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                        {f.fieldType || f.type}{(f.fieldKey || f.field_key) && <span style={{ fontFamily: 'monospace', marginLeft: 6, opacity: 0.6 }}>({f.fieldKey || f.field_key})</span>}
                      </div>
                    </div>
                    <button onClick={() => startEdit(f)} style={{ ...S.btnGhost, padding: '4px 8px', fontSize: 11 }}><Edit3 size={12} /></button>
                    <button onClick={() => { if (confirm(L('¿Eliminar?', 'Delete?'))) { onDelete(f.id); refresh() } }}
                      style={{ padding: '4px 8px', background: 'transparent', border: '1px solid rgba(239,68,68,.3)', borderRadius: 5, cursor: 'pointer', color: '#EF4444', fontSize: 11 }}><Trash2 size={12} /></button>
                  </div>
                ) : (
                  <FieldForm form={form} setForm={setForm} onSave={handleSave} onCancel={() => setEditingId(null)} isEdit en={en} />
                )}
              </div>
            )
          })}
          {creating && (
            <div style={{ padding: 12, marginTop: 8, background: 'rgba(255,107,0,.05)', border: '1px solid var(--orange)', borderRadius: 8 }}>
              <FieldForm form={form} setForm={setForm} onSave={handleSave} onCancel={() => setCreating(false)} en={en} />
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function FieldForm({ form, setForm, onSave, onCancel, isEdit, en }) {
  const L = (es, enText) => en ? enText : es
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 3 }}>{L('Nombre', 'Name')}</label>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ej: LinkedIn" style={S.inputSm} />
        </div>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 3 }}>{L('Tipo', 'Type')}</label>
          <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={S.inputSm}>
            {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      {form.name && <div style={{ marginBottom: 8, fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>field_key: <span style={{ color: 'var(--orange)' }}>{generateFieldKey(form.name)}</span></div>}
      {form.type === 'select' && (
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 3 }}>{L('Opciones (coma)', 'Options (comma)')}</label>
          <input value={form.options} onChange={e => setForm(p => ({ ...p, options: e.target.value }))} placeholder="A, B, C" style={S.inputSm} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ ...S.btnGhost, fontSize: 11 }}>{L('Cancelar', 'Cancel')}</button>
        <button onClick={onSave} style={{ padding: '5px 12px', background: 'var(--orange)', color: '#000', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>{isEdit ? L('Actualizar', 'Update') : L('Crear', 'Create')}</button>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════════
// TASKS VIEW (all tasks across contacts)
// ═════════════════════════════════════════════════════════════════════════════════
function TasksView({ tasks, contacts, team, onToggle, onDelete, onAdd, onUpdate, onContactClick, en }) {
  const L = (es, enText) => en ? enText : es
  const locale = en ? 'en-US' : 'es-ES'
  const fmtDateL = (d) => d ? new Date(d).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
  const [showAdd, setShowAdd] = useState(false)
  const emptyForm = { title: '', contact_id: '', dueDate: '', assignedTo: '', description: '', priority: 'medium' }
  const [form, setForm] = useState(emptyForm)
  const [filterStatus, setFilterStatus] = useState('all')
  const contactMap = useMemo(() => Object.fromEntries((contacts || []).map(c => [c.id, c])), [contacts])
  const filtered = useMemo(() => {
    let list = [...(tasks || [])]
    if (filterStatus === 'pending') list = list.filter(t => !t.completed)
    else if (filterStatus === 'completed') list = list.filter(t => t.completed)
    return list.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1
      const pa = { high: 0, medium: 1, low: 2 }
      if ((pa[a.priority] ?? 1) !== (pa[b.priority] ?? 1)) return (pa[a.priority] ?? 1) - (pa[b.priority] ?? 1)
      if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate)
      return a.dueDate ? -1 : b.dueDate ? 1 : 0
    })
  }, [tasks, filterStatus])
  const pending = (tasks || []).filter(t => !t.completed).length, completed = (tasks || []).filter(t => t.completed).length
  const handleAdd = async () => { if (!form.title.trim()) return; await onAdd({ ...form, completed: false }); setForm(emptyForm); setShowAdd(false) }
  const prioColor = (p) => p === 'high' ? '#EF4444' : p === 'low' ? '#6B7280' : '#F59E0B'
  const prioLabel = (p) => p === 'high' ? L('Alta', 'High') : p === 'low' ? L('Baja', 'Low') : L('Media', 'Medium')
  const fl = { fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 2 }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[{ k: 'all', l: L('Todas', 'All') }, { k: 'pending', l: L('Pendientes', 'Pending') }, { k: 'completed', l: L('Completadas', 'Completed') }].map(f => (
            <button key={f.k} onClick={() => setFilterStatus(f.k)}
              style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', background: filterStatus === f.k ? 'var(--orange)' : 'var(--bg-card)', color: filterStatus === f.k ? '#000' : 'var(--text-secondary)' }}>{f.l}</button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{pending} {L(`pendiente${pending !== 1 ? 's' : ''}`, 'pending')} / {completed} {L(`completada${completed !== 1 ? 's' : ''}`, 'completed')}</span>
        <button onClick={() => setShowAdd(!showAdd)} style={{ marginLeft: 'auto', padding: '6px 14px', background: 'var(--orange)', color: '#000', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Plus size={13} /> {L('Nueva Tarea', 'New Task')}
        </button>
      </div>
      {showAdd && (
        <div style={{ padding: 14, background: 'var(--bg-card)', border: '1px solid var(--orange)', borderRadius: 10, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div style={{ gridColumn: 'span 2' }}><label style={fl}>{L('Título *', 'Title *')}</label>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder={L('Título de la tarea...', 'Task title...')} style={S.input} /></div>
            <div><label style={fl}>{L('Contacto', 'Contact')}</label>
              <select value={form.contact_id} onChange={e => setForm(p => ({ ...p, contact_id: e.target.value }))} style={S.input}>
                <option value="">{L('— Ninguno —', '— None —')}</option>{contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label style={fl}>{L('Fecha límite', 'Due date')}</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} style={{ ...S.input, colorScheme: 'dark' }} /></div>
            <div><label style={fl}>{L('Asignar a', 'Assign to')}</label>
              <select value={form.assignedTo} onChange={e => setForm(p => ({ ...p, assignedTo: e.target.value }))} style={S.input}>
                <option value="">—</option>{team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}</select></div>
            <div><label style={fl}>{L('Prioridad', 'Priority')}</label>
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} style={S.input}>
                <option value="low">{L('Baja', 'Low')}</option><option value="medium">{L('Media', 'Medium')}</option><option value="high">{L('Alta', 'High')}</option></select></div>
            <div style={{ gridColumn: 'span 2' }}><label style={fl}>{L('Descripción', 'Description')}</label>
              <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder={L('Notas...', 'Notes...')} style={S.input} /></div>
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowAdd(false)} style={{ ...S.btnGhost, fontSize: 11 }}>{L('Cancelar', 'Cancel')}</button>
            <button onClick={handleAdd} style={{ padding: '6px 14px', background: 'var(--orange)', color: '#000', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>{L('Crear', 'Create')}</button>
          </div>
        </div>
      )}
      {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: 13 }}>{L('No hay tareas', 'No tasks')}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filtered.map(t => {
          const ct = contactMap[t.contactId || t.contact_id]
          return (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, transition: 'all .15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,107,0,.3)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
              <button onClick={() => onToggle(t)} style={{ padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', color: t.completed ? 'var(--orange)' : 'var(--text-secondary)', flexShrink: 0 }}>
                {t.completed ? <Check size={18} /> : <Square size={18} />}</button>
              <div style={{ flex: 1, minWidth: 0 }}>
                {ct && (
                  <button onClick={() => onContactClick(ct)} style={{ padding: '2px 10px', marginBottom: 4, background: 'rgba(255,107,0,.08)', border: '1px solid rgba(255,107,0,.2)', borderRadius: 6, cursor: 'pointer', color: 'var(--orange)', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <User size={11} /> {ct.name} {ct.company && <span style={{ fontWeight: 400, opacity: .7 }}>({ct.company})</span>}
                  </button>
                )}
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', textDecoration: t.completed ? 'line-through' : 'none', opacity: t.completed ? .5 : 1 }}>{t.title}</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                  {t.priority && <span style={{ fontSize: 10, color: prioColor(t.priority), fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}><Flag size={9} /> {prioLabel(t.priority)}</span>}
                  {t.dueDate && <span style={{ fontSize: 10, color: new Date(t.dueDate) < new Date() && !t.completed ? '#EF4444' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 2 }}><Clock size={9} /> {fmtDateL(t.dueDate)}</span>}
                  {t.assignedTo && <span style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 2 }}><User size={9} /> {t.assignedTo}</span>}
                  {t.description && <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontStyle: 'italic' }}>{t.description.slice(0, 50)}</span>}
                </div>
              </div>
              <button onClick={() => onDelete(t)} style={{ padding: 3, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', opacity: .4, flexShrink: 0 }}><Trash2 size={13} /></button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════════
// NEW CONTACT MODAL
// ═════════════════════════════════════════════════════════════════════════════════
function NewContactModal({ customFields, team, statuses, onClose, onSave, en }) {
  const L = (es, enText) => en ? enText : es
  const STATUSES = statuses || DEFAULT_STATUSES
  const inputStyle = { width: '100%', padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }

  return (
    <>
      <div onClick={onClose} style={S.overlay} />
      <div style={{ ...S.modal, width: 600 }}>
        <div style={S.modalHeader}>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{L('Nuevo Contacto', 'New Contact')}</span>
          <button onClick={onClose} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={18} /></button>
        </div>
        <form onSubmit={onSave} style={{ overflowY: 'auto', flex: 1, padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[
              { name: 'name', label: L('Nombre *', 'Name *'), required: true, placeholder: L('Nombre completo', 'Full name') },
              { name: 'email', label: 'Email', type: 'email', placeholder: 'email@example.com' },
              { name: 'phone', label: L('Teléfono', 'Phone'), placeholder: '+1 555 000 000' },
              { name: 'company', label: L('Empresa', 'Company'), placeholder: L('Nombre de empresa', 'Company name') },
            ].map(f => (
              <div key={f.name}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4, display: 'block' }}>{f.label}</label>
                <input name={f.name} type={f.type || 'text'} required={f.required} placeholder={f.placeholder} style={inputStyle} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4, display: 'block' }}>{L('Estado', 'Status')}</label>
              <select name="status" style={inputStyle}>{STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4, display: 'block' }}>{L('Valor', 'Value')}</label>
              <input name="dealValue" type="number" placeholder="0" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4, display: 'block' }}>Closer</label>
              <select name="assigned_closer" style={inputStyle}>
                <option value="">—</option>{team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4, display: 'block' }}>Setter</label>
              <select name="assigned_setter" style={inputStyle}>
                <option value="">—</option>{team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4, display: 'block' }}>Cold Caller</label>
              <select name="assigned_cold_caller" style={inputStyle}>
                <option value="">—</option>{team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4, display: 'block' }}>{L('Fuente', 'Source')}</label>
              <select name="source" style={inputStyle}>
                <option value="">—</option>{SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {[
              { name: 'address', label: L('Dirección', 'Address'), placeholder: L('Dirección', 'Address') },
              { name: 'whatsapp', label: 'WhatsApp', placeholder: '+1...' },
              { name: 'zoom_link', label: 'Zoom', placeholder: 'https://zoom.us/...' },
              { name: 'website', label: 'Website', placeholder: 'https://...' },
              { name: 'instagram', label: 'Instagram', placeholder: L('@usuario', '@username') },
            ].map(f => (
              <div key={f.name}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4, display: 'block' }}>{f.label}</label>
                <input name={f.name} placeholder={f.placeholder} style={inputStyle} />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4, display: 'block' }}>Tags</label>
            <input name="tags" placeholder={L('vip, seguimiento', 'vip, follow-up')} style={inputStyle} />
          </div>
          {/* Facturación */}
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--orange)', marginBottom: 8, marginTop: 16 }}>{L('Facturación / Empresa', 'Billing / Company')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            {[
              { name: 'owner_name', label: L('Dueño / Owner', 'Owner'), placeholder: L('Nombre del dueño', 'Owner name') },
              { name: 'owner_email', label: L('Email del Dueño', 'Owner Email'), placeholder: 'owner@empresa.com' },
              { name: 'billing_cif', label: 'CIF / NIF', placeholder: 'B12345678' },
              { name: 'billing_address', label: L('Dir. Fiscal', 'Billing Address'), placeholder: L('Dirección fiscal', 'Billing address') },
            ].map(f => (
              <div key={f.name}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4, display: 'block' }}>{f.label}</label>
                <input name={f.name} placeholder={f.placeholder} style={inputStyle} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4, display: 'block' }}>{L('Facturación Anual (€)', 'Annual Revenue (€)')}</label>
              <input name="billing_annual" type="number" placeholder="100000" style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4, display: 'block' }}>{L('Notas', 'Notes')}</label>
            <textarea name="notes" rows={3} placeholder={L('Notas...', 'Notes...')} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <button type="button" onClick={onClose} style={{ ...S.btnGhost, padding: '9px 20px', fontSize: 13 }}>{L('Cancelar', 'Cancel')}</button>
            <button type="submit" className="btn-action" style={{ padding: '9px 20px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><Save size={14} /> {L('Guardar', 'Save')}</button>
          </div>
        </form>
      </div>
    </>
  )
}

// ═════════════════════════════════════════════════════════════════════════════════
// SALE REGISTRATION MODAL (triggered when lead status → won)
// ═════════════════════════════════════════════════════════════════════════════════
function SaleRegistrationModal({ contact, team, products, paymentFees, onClose, onSave, en }) {
  const L = (es, enText) => en ? enText : es
  const closers = team.filter(m => (m.role || '').includes('closer'))
  const setters = team.filter(m => (m.role || '').includes('setter'))
  const today = new Date().toISOString().slice(0, 10)

  const PAYMENT_TYPES = ['Pago único', '2 cuotas', '3 cuotas', '4 cuotas', '5 cuotas', '6 cuotas']
  const getInstallments = (pt) => {
    if (pt === 'Pago único') return ['Pago único']
    const n = parseInt(pt)
    return Array.from({ length: n }, (_, i) => `${i + 1}/${n}`)
  }

  const [form, setForm] = useState({
    date: today,
    clientName: contact.name || '',
    clientEmail: contact.email || '',
    clientPhone: contact.phone || '',
    instagram: contact.instagram || '',
    pais: contact.country || '',
    product: contact.product || products.find(p => p.active !== false)?.name || '',
    paymentType: contact.payment_type || 'Pago único',
    installmentNumber: contact.payment_type && contact.payment_type !== 'Pago único' ? '1/' + parseInt(contact.payment_type) : 'Pago único',
    paymentMethod: contact.payment_method || paymentFees[0]?.method || 'Transferencia',
    revenue: contact.dealValue || contact.deal_value || '',
    cashCollected: '',
    closer: contact.assigned_closer || '',
    setter: contact.assigned_setter || '',
    triager: contact.triager || '',
    gestorAsignado: contact.gestor_asignado || '',
    utmSource: contact.utm_source || '', utmMedium: contact.utm_medium || '',
    utmCampaign: contact.utm_campaign || '', utmContent: contact.utm_content || '',
    productoInteres: contact.producto_interes || '',
    capitalDisponible: contact.capital_disponible || '',
    situacionActual: contact.situacion_actual || '',
    expAmazon: contact.exp_amazon || '',
    decisorConfirmado: contact.decisor_confirmado || '',
    fechaLlamada: contact.fecha_llamada || '',
    status: 'Completada',
    notes: '',
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.clientName || !form.revenue || !form.closer) {
      alert(L('Nombre, Revenue y Closer son obligatorios.', 'Name, Revenue and Closer are required.'))
      return
    }
    onSave({
      ...form,
      revenue: +form.revenue,
      cashCollected: +(form.cashCollected || form.revenue),
      source: 'close_crm',
      closeActivityId: contact.id,
    })
  }

  const inputStyle = {
    width: '100%', padding: '8px 10px', background: 'var(--bg)',
    border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)',
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
  }

  const currentFee = paymentFees.find(f => f.method === form.paymentMethod)
  const feeRate = currentFee ? (currentFee.feeRate || 0) : 0
  const grossCash = +(form.cashCollected || form.revenue) || 0
  const netCash = Math.round(grossCash * (1 - feeRate) * 100) / 100

  return (
    <>
      <div onClick={onClose} style={S.overlay} />
      <div style={{ ...S.modal, width: 640 }}>
        <div style={S.modalHeader}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>
              {L('Registrar Venta', 'Register Sale')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {contact.name} — {L('Lead marcado como Ganado', 'Lead marked as Won')}
            </div>
          </div>
          <button onClick={onClose} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', flex: 1, padding: '16px 20px', maxHeight: '70vh' }}>
          {/* Section 1: Sale Info */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
            {L('Datos de la Venta', 'Sale Data')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div>
              <label style={S.label}>{L('Fecha', 'Date')}</label>
              <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={S.label}>{L('Estado', 'Status')}</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} style={inputStyle}>
                <option value="Completada">{L('Completada', 'Completed')}</option>
                <option value="Pendiente">{L('Pendiente', 'Pending')}</option>
              </select>
            </div>
            <div>
              <label style={S.label}>Closer *</label>
              <select value={form.closer} onChange={e => setForm(p => ({ ...p, closer: e.target.value }))} style={inputStyle}>
                <option value="">—</option>
                {closers.length > 0 ? closers.map(m => <option key={m.id} value={m.name}>{m.name}</option>) :
                  team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Setter</label>
              <select value={form.setter} onChange={e => setForm(p => ({ ...p, setter: e.target.value }))} style={inputStyle}>
                <option value="">—</option>
                {setters.length > 0 ? setters.map(m => <option key={m.id} value={m.name}>{m.name}</option>) :
                  team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            </div>
          </div>

          {/* Section 2: Client Data */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
            {L('Datos del Cliente', 'Client Data')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { key: 'clientName', label: L('Nombre *', 'Name *'), required: true },
              { key: 'clientEmail', label: 'Email', type: 'email' },
              { key: 'clientPhone', label: L('Teléfono', 'Phone') },
              { key: 'instagram', label: 'Instagram' },
              { key: 'pais', label: L('País', 'Country') },
              { key: 'fechaLlamada', label: L('Fecha Llamada', 'Call Date'), type: 'date' },
            ].map(f => (
              <div key={f.key}>
                <label style={S.label}>{f.label}</label>
                <input type={f.type || 'text'} value={form[f.key]} required={f.required}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={inputStyle} />
              </div>
            ))}
          </div>

          {/* Section 3: Lead Profile */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
            {L('Perfil del Lead', 'Lead Profile')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div>
              <label style={S.label}>{L('Situación Actual', 'Current Situation')}</label>
              <input value={form.situacionActual} onChange={e => setForm(p => ({ ...p, situacionActual: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={S.label}>{L('Capital Disponible', 'Available Capital')}</label>
              <input value={form.capitalDisponible} onChange={e => setForm(p => ({ ...p, capitalDisponible: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={S.label}>Exp Amazon</label>
              <input value={form.expAmazon} onChange={e => setForm(p => ({ ...p, expAmazon: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={S.label}>{L('Decisor Confirmado', 'Decision Maker')}</label>
              <select value={form.decisorConfirmado} onChange={e => setForm(p => ({ ...p, decisorConfirmado: e.target.value }))} style={inputStyle}>
                <option value="">—</option>
                <option value="Sí">{L('Sí', 'Yes')}</option>
                <option value="No">No</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={S.label}>{L('Producto Interés', 'Product Interest')}</label>
              <input value={form.productoInteres} onChange={e => setForm(p => ({ ...p, productoInteres: e.target.value }))} style={inputStyle} />
            </div>
          </div>

          {/* Section 4: UTMs */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
            UTMs & {L('Atribución', 'Attribution')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { key: 'utmSource', label: 'UTM Source' },
              { key: 'utmMedium', label: 'UTM Medium' },
              { key: 'utmCampaign', label: 'UTM Campaign' },
              { key: 'utmContent', label: 'UTM Content' },
              { key: 'triager', label: 'Triager' },
              { key: 'gestorAsignado', label: L('Gestor Asignado', 'Assigned Manager') },
            ].map(f => (
              <div key={f.key}>
                <label style={S.label}>{f.label}</label>
                <input value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={inputStyle} />
              </div>
            ))}
          </div>

          {/* Section 5: Payment */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
            {L('Pago', 'Payment')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div>
              <label style={S.label}>{L('Producto', 'Product')}</label>
              <select value={form.product} onChange={e => setForm(p => ({ ...p, product: e.target.value }))} style={inputStyle}>
                {products.filter(p => p.active !== false).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>{L('Tipo de Pago', 'Payment Type')}</label>
              <select value={form.paymentType} onChange={e => {
                const inst = getInstallments(e.target.value)
                setForm(p => ({ ...p, paymentType: e.target.value, installmentNumber: inst[0] }))
              }} style={inputStyle}>
                {PAYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>{L('Nº Cuota', 'Installment #')}</label>
              <select value={form.installmentNumber} onChange={e => setForm(p => ({ ...p, installmentNumber: e.target.value }))} style={inputStyle}>
                {getInstallments(form.paymentType).map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>{L('Método de Pago', 'Payment Method')}</label>
              <select value={form.paymentMethod} onChange={e => setForm(p => ({ ...p, paymentMethod: e.target.value }))} style={inputStyle}>
                {paymentFees.map(f => <option key={f.method} value={f.method}>{f.method} ({((f.feeRate || 0) * 100).toFixed(1)}%)</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Revenue * ({L('total del deal', 'total deal value')})</label>
              <input type="number" value={form.revenue} required
                onChange={e => setForm(p => ({ ...p, revenue: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={S.label}>Cash Collected</label>
              <input type="number" value={form.cashCollected} placeholder={form.revenue || '0'}
                onChange={e => setForm(p => ({ ...p, cashCollected: e.target.value }))} style={inputStyle} />
            </div>
          </div>
          {/* Fee preview */}
          {grossCash > 0 && (
            <div style={{ padding: '8px 12px', background: 'rgba(255,107,0,.06)', border: '1px solid rgba(255,107,0,.15)', borderRadius: 8, marginBottom: 16, fontSize: 12 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Fee: </span>
              <span style={{ color: 'var(--orange)', fontWeight: 700 }}>{(feeRate * 100).toFixed(1)}%</span>
              <span style={{ color: 'var(--text-secondary)' }}> → Net: </span>
              <span style={{ color: '#22C55E', fontWeight: 700 }}>{netCash.toLocaleString(en ? 'en-US' : 'es-ES', { style: 'currency', currency: en ? 'USD' : 'EUR', minimumFractionDigits: 0 })}</span>
            </div>
          )}

          {/* Notes */}
          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>{L('Notas', 'Notes')}</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <button type="button" onClick={onClose} style={{ ...S.btnGhost, padding: '9px 20px', fontSize: 13 }}>
              {L('Omitir', 'Skip')}
            </button>
            <button type="submit" className="btn-action" style={{ padding: '9px 20px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <DollarSign size={14} /> {L('Registrar Venta', 'Register Sale')}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
