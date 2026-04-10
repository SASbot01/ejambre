import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables')
}

export const supabase = createClient(supabaseUrl || '', supabaseServiceKey || '')

// ── Field mapping: camelCase (app) ↔ snake_case (DB) ──

// Sales field mapping
const SALES_FIELD_MAP = {
  clientId: 'client_id',
  clientName: 'client_name',
  clientEmail: 'client_email',
  clientPhone: 'client_phone',
  paymentType: 'payment_type',
  installmentNumber: 'installment_number',
  paymentMethod: 'payment_method',
  cashCollected: 'cash_collected',
  productoInteres: 'producto_interes',
  gestorAsignado: 'gestor_asignado',
  utmSource: 'utm_source',
  utmMedium: 'utm_medium',
  utmCampaign: 'utm_campaign',
  utmContent: 'utm_content',
  capitalDisponible: 'capital_disponible',
  situacionActual: 'situacion_actual',
  expAmazon: 'exp_amazon',
  decisorConfirmado: 'decisor_confirmado',
  fechaLlamada: 'fecha_llamada',
  closeActivityId: 'close_activity_id',
  createdAt: 'created_at',
}

// Reports field mapping
const REPORTS_FIELD_MAP = {
  clientId: 'client_id',
  conversationsOpened: 'conversations_opened',
  followUps: 'follow_ups',
  offersLaunched: 'offers_launched',
  appointmentsBooked: 'appointments_booked',
  scheduledCalls: 'scheduled_calls',
  callsMade: 'calls_made',
  createdAt: 'created_at',
}

// Team field mapping
const TEAM_FIELD_MAP = {
  clientId: 'client_id',
  commissionRate: 'commission_rate',
  createdAt: 'created_at',
}

// Projections field mapping
const PROJECTIONS_FIELD_MAP = {
  clientId: 'client_id',
  periodType: 'period_type',
  memberId: 'member_id',
  cashTarget: 'cash_target',
  revenueTarget: 'revenue_target',
  appointmentTarget: 'appointment_target',
  createdAt: 'created_at',
}

// Payment fees field mapping
const FEES_FIELD_MAP = {
  clientId: 'client_id',
  feeRate: 'fee_rate',
  createdAt: 'created_at',
}

// Products field mapping
const PRODUCTS_FIELD_MAP = {
  clientId: 'client_id',
  createdAt: 'created_at',
}

// N8n config field mapping
const N8N_FIELD_MAP = {
  clientId: 'client_id',
  webhookUrl: 'webhook_url',
  apiKey: 'api_key',
  lastSync: 'last_sync',
  createdAt: 'created_at',
}

const CLIENTS_FIELD_MAP = {
  logoUrl: 'logo_url',
  primaryColor: 'primary_color',
  secondaryColor: 'secondary_color',
  bgColor: 'bg_color',
  bgCardColor: 'bg_card_color',
  bgSidebarColor: 'bg_sidebar_color',
  borderColor: 'border_color',
  textColor: 'text_color',
  textSecondaryColor: 'text_secondary_color',
  createdAt: 'created_at',
}

const SUPERADMINS_FIELD_MAP = {
  createdAt: 'created_at',
}

const SA_COMMISSIONS_FIELD_MAP = {
  clientId: 'client_id',
  commissionRate: 'commission_rate',
  createdAt: 'created_at',
}

// ---- CEO Mind field maps ----
const CEO_MEETINGS_FIELD_MAP = {
  clientId: 'client_id',
  durationMinutes: 'duration_minutes',
  actionItems: 'action_items',
  keyTopics: 'key_topics',
  transcriptUrl: 'transcript_url',
  createdAt: 'created_at',
}

const CEO_PROJECTS_FIELD_MAP = {
  clientId: 'client_id',
  startDate: 'start_date',
  endDate: 'end_date',
  createdAt: 'created_at',
}

const CEO_IDEAS_FIELD_MAP = {
  clientId: 'client_id',
  meetingId: 'meeting_id',
  projectId: 'project_id',
  createdAt: 'created_at',
}

const CEO_DAILY_DIGESTS_FIELD_MAP = {
  clientId: 'client_id',
  keyMetrics: 'key_metrics',
  decisionsNeeded: 'decisions_needed',
  generatedAt: 'generated_at',
  createdAt: 'created_at',
}

const CEO_WEEKLY_DIGESTS_FIELD_MAP = {
  clientId: 'client_id',
  weekStart: 'week_start',
  weekEnd: 'week_end',
  numbersSummary: 'numbers_summary',
  executiveSummary: 'executive_summary',
  decisionsTaken: 'decisions_taken',
  nextSteps: 'next_steps',
  generatedAt: 'generated_at',
  createdAt: 'created_at',
}

const CEO_TEAM_NOTES_FIELD_MAP = {
  clientId: 'client_id',
  memberId: 'member_id',
  updatedAt: 'updated_at',
  createdAt: 'created_at',
}

const CEO_INTEGRATIONS_FIELD_MAP = {
  clientId: 'client_id',
  apiKey: 'api_key',
  lastSync: 'last_sync',
  createdAt: 'created_at',
}

const CEO_FINANCE_ENTRIES_FIELD_MAP = {
  clientId: 'client_id',
  createdAt: 'created_at',
}

// Legacy alias for backward compat
const FIELD_MAP = SALES_FIELD_MAP

// All table field maps
export const TABLE_FIELD_MAPS = {
  sales: SALES_FIELD_MAP,
  reports: REPORTS_FIELD_MAP,
  team: TEAM_FIELD_MAP,
  projections: PROJECTIONS_FIELD_MAP,
  payment_fees: FEES_FIELD_MAP,
  products: PRODUCTS_FIELD_MAP,
  n8n_config: N8N_FIELD_MAP,
  clients: CLIENTS_FIELD_MAP,
  superadmins: SUPERADMINS_FIELD_MAP,
  superadmin_commissions: SA_COMMISSIONS_FIELD_MAP,
  ceo_meetings: CEO_MEETINGS_FIELD_MAP,
  ceo_projects: CEO_PROJECTS_FIELD_MAP,
  ceo_ideas: CEO_IDEAS_FIELD_MAP,
  ceo_daily_digests: CEO_DAILY_DIGESTS_FIELD_MAP,
  ceo_weekly_digests: CEO_WEEKLY_DIGESTS_FIELD_MAP,
  ceo_team_notes: CEO_TEAM_NOTES_FIELD_MAP,
  ceo_integrations: CEO_INTEGRATIONS_FIELD_MAP,
  ceo_finance_entries: CEO_FINANCE_ENTRIES_FIELD_MAP,
}

function buildReverseMap(map) {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]))
}

const REVERSE_MAP = buildReverseMap(SALES_FIELD_MAP)

const TABLE_REVERSE_MAPS = {
  sales: REVERSE_MAP,
  reports: buildReverseMap(REPORTS_FIELD_MAP),
  team: buildReverseMap(TEAM_FIELD_MAP),
  projections: buildReverseMap(PROJECTIONS_FIELD_MAP),
  payment_fees: buildReverseMap(FEES_FIELD_MAP),
  products: buildReverseMap(PRODUCTS_FIELD_MAP),
  n8n_config: buildReverseMap(N8N_FIELD_MAP),
  clients: buildReverseMap(CLIENTS_FIELD_MAP),
  superadmins: buildReverseMap(SUPERADMINS_FIELD_MAP),
  superadmin_commissions: buildReverseMap(SA_COMMISSIONS_FIELD_MAP),
  ceo_meetings: buildReverseMap(CEO_MEETINGS_FIELD_MAP),
  ceo_projects: buildReverseMap(CEO_PROJECTS_FIELD_MAP),
  ceo_ideas: buildReverseMap(CEO_IDEAS_FIELD_MAP),
  ceo_daily_digests: buildReverseMap(CEO_DAILY_DIGESTS_FIELD_MAP),
  ceo_weekly_digests: buildReverseMap(CEO_WEEKLY_DIGESTS_FIELD_MAP),
  ceo_team_notes: buildReverseMap(CEO_TEAM_NOTES_FIELD_MAP),
  ceo_integrations: buildReverseMap(CEO_INTEGRATIONS_FIELD_MAP),
  ceo_finance_entries: buildReverseMap(CEO_FINANCE_ENTRIES_FIELD_MAP),
}

export function toDbFormat(obj, table = 'sales') {
  const fieldMap = TABLE_FIELD_MAPS[table] || SALES_FIELD_MAP
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'id' && !value) continue
    if (key === 'netCash') continue // computed field, don't store
    const dbKey = fieldMap[key] || key
    result[dbKey] = value
  }
  return result
}

export function toAppFormat(row, table = 'sales') {
  const reverseMap = TABLE_REVERSE_MAPS[table] || REVERSE_MAP
  const result = {}
  for (const [key, value] of Object.entries(row)) {
    if (key === 'created_at') continue
    const appKey = reverseMap[key] || key
    result[appKey] = value
  }
  return result
}

export async function resolveClientId(slugOrId) {
  if (!slugOrId) return null
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId)) return slugOrId
  const { data, error } = await supabase
    .from('clients')
    .select('id')
    .eq('slug', slugOrId)
    .single()
  if (error || !data) return null
  return data.id
}

// Transform Close CRM webhook data to our app format
export function transformCloseData(data) {
  return {
    date: data.date || new Date().toISOString().split('T')[0],
    clientName: data.contact_name || data.clientName || '',
    clientEmail: data.contact_email || data.clientEmail || '',
    clientPhone: data.contact_phone || data.clientPhone || '',
    instagram: data['Instagram'] || data.instagram || '',
    product: data.product || data['Producto Interes'] || data.productoInteres || '',
    productoInteres: data['Producto Interes'] || data.productoInteres || '',
    paymentType: data['Tipo de pago'] || data.paymentType || 'Pago único',
    installmentNumber: data['Número de cuota'] || data.installmentNumber || 'Pago único',
    paymentMethod: data['Método de pago'] || data.paymentMethod || 'Transferencia',
    revenue: Number(data['Revenue (€)'] || data.revenue) || 0,
    cashCollected: Number(data['Cash Collected (€)'] || data.cashCollected) || 0,
    closer: data['Closer Asignado'] || data.closer || '',
    setter: data['Setter Asignado'] || data.setter || '',
    triager: data['Triager Asignado'] || data.triager || '',
    gestorAsignado: data['Gestor Asignado'] || data.gestorAsignado || '',
    utmSource: data['UTM Source'] || data.utmSource || '',
    utmMedium: data['UTM Medium'] || data.utmMedium || '',
    utmCampaign: data['UTM Campaign'] || data.utmCampaign || '',
    utmContent: data['UTM Content'] || data.utmContent || '',
    pais: data['País'] || data.pais || '',
    capitalDisponible: data['Capital Disponible'] || data.capitalDisponible || '',
    situacionActual: data['Situación Actual'] || data.situacionActual || '',
    expAmazon: data['Exp Amazon'] || data.expAmazon || '',
    decisorConfirmado: data['Decisor Confirmado'] || data.decisorConfirmado || '',
    fechaLlamada: data['Fecha de Llamada'] || data.fechaLlamada || '',
    status: data.status || 'Completada',
    notes: data['Notas'] || data.notes || '',
    source: 'close_crm',
    closeActivityId: data.activity_id || null,
  }
}
