import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Field maps: camelCase (app) ↔ snake_case (DB)
const SALES_MAP = {
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
}

const REPORTS_MAP = {
  clientId: 'client_id',
  conversationsOpened: 'conversations_opened',
  followUps: 'follow_ups',
  offersLaunched: 'offers_launched',
  appointmentsBooked: 'appointments_booked',
  scheduledCalls: 'scheduled_calls',
  callsMade: 'calls_made',
  pickUps: 'pick_ups',
  scheduleCalls: 'schedule_calls',
}

const TEAM_MAP = {
  clientId: 'client_id',
  commissionRate: 'commission_rate',
  closerCommissionRate: 'closer_commission_rate',
  setterCommissionRate: 'setter_commission_rate',
  commissionStartDate: 'commission_start_date',
  mgmtCommissionStartDate: 'mgmt_commission_start_date',
  isGestor: 'is_gestor',
  gestorCommissionRate: 'gestor_commission_rate',
  gestorStartDate: 'gestor_start_date',
  gestorCapacity: 'gestor_capacity',
  calendarUrl: 'calendar_url',
}

const PROJECTIONS_MAP = {
  clientId: 'client_id',
  periodType: 'period_type',
  memberId: 'member_id',
  cashTarget: 'cash_target',
  revenueTarget: 'revenue_target',
  appointmentTarget: 'appointment_target',
}

const FEES_MAP = {
  clientId: 'client_id',
  feeRate: 'fee_rate',
}

const PRODUCTS_MAP = {
  clientId: 'client_id',
}

const N8N_MAP = {
  clientId: 'client_id',
  webhookUrl: 'webhook_url',
  apiKey: 'api_key',
  lastSync: 'last_sync',
}

const CLIENTS_MAP = {
  logoUrl: 'logo_url',
  primaryColor: 'primary_color',
  secondaryColor: 'secondary_color',
  bgColor: 'bg_color',
  bgCardColor: 'bg_card_color',
  bgSidebarColor: 'bg_sidebar_color',
  borderColor: 'border_color',
  textColor: 'text_color',
  textSecondaryColor: 'text_secondary_color',
  clientType: 'client_type',
}

// ---- CEO Mind field maps ----
const CEO_MEETINGS_MAP = {
  clientId: 'client_id',
  durationMinutes: 'duration_minutes',
  actionItems: 'action_items',
  keyTopics: 'key_topics',
  transcriptUrl: 'transcript_url',
}

const CEO_PROJECTS_MAP = {
  clientId: 'client_id',
  startDate: 'start_date',
  endDate: 'end_date',
}

const CEO_IDEAS_MAP = {
  clientId: 'client_id',
  meetingId: 'meeting_id',
  projectId: 'project_id',
}

const CEO_DAILY_DIGESTS_MAP = {
  clientId: 'client_id',
  keyMetrics: 'key_metrics',
  decisionsNeeded: 'decisions_needed',
  generatedAt: 'generated_at',
}

const CEO_WEEKLY_DIGESTS_MAP = {
  clientId: 'client_id',
  weekStart: 'week_start',
  weekEnd: 'week_end',
  numbersSummary: 'numbers_summary',
  executiveSummary: 'executive_summary',
  decisionsTaken: 'decisions_taken',
  nextSteps: 'next_steps',
  generatedAt: 'generated_at',
}

const CEO_TEAM_NOTES_MAP = {
  clientId: 'client_id',
  memberId: 'member_id',
  updatedAt: 'updated_at',
}

const CEO_INTEGRATIONS_MAP = {
  clientId: 'client_id',
  apiKey: 'api_key',
  lastSync: 'last_sync',
}

const CEO_FINANCE_ENTRIES_MAP = {
  clientId: 'client_id',
}

const SUPERADMINS_MAP = {}

const COMMISSION_PAYMENTS_MAP = {
  clientId: 'client_id',
  memberId: 'member_id',
  periodStart: 'period_start',
  periodEnd: 'period_end',
  cashBase: 'cash_base',
  commissionAmount: 'commission_amount',
  paidAt: 'paid_at',
}

const SA_COMMISSIONS_MAP = {
  clientId: 'client_id',
  commissionRate: 'commission_rate',
}

const CRM_CONTACTS_MAP = {
  clientId: 'client_id',
  dealValue: 'deal_value',
  customFields: 'custom_fields',
  lastActivityAt: 'last_activity_at',
  updatedAt: 'updated_at',
  pipelineId: 'pipeline_id',
  ownerName: 'owner_name',
  ownerEmail: 'owner_email',
  billingAnnual: 'billing_annual',
  billingCif: 'billing_cif',
  billingAddress: 'billing_address',
  enrichedAt: 'enriched_at',
  enrichmentData: 'enrichment_data',
}

const CRM_ACTIVITIES_MAP = {
  clientId: 'client_id',
  contactId: 'contact_id',
  customType: 'custom_type',
  durationMinutes: 'duration_minutes',
  performedBy: 'performed_by',
  performedAt: 'performed_at',
  fileUrl: 'file_url',
  scheduledAt: 'scheduled_at',
}

const CRM_FILES_MAP = {
  clientId: 'client_id',
  contactId: 'contact_id',
  fileName: 'file_name',
  fileUrl: 'file_url',
  fileSize: 'file_size',
  fileType: 'file_type',
  uploadedBy: 'uploaded_by',
}

const CRM_TASKS_MAP = {
  clientId: 'client_id',
  contactId: 'contact_id',
  dueDate: 'due_date',
  assignedTo: 'assigned_to',
  completedAt: 'completed_at',
}

const CRM_CUSTOM_FIELDS_MAP = {
  clientId: 'client_id',
  fieldKey: 'field_key',
  fieldType: 'field_type',
}

const CRM_SMART_VIEWS_MAP = {
  clientId: 'client_id',
  pipelineId: 'pipeline_id',
  sortBy: 'sort_by',
  sortDir: 'sort_dir',
  createdBy: 'created_by',
}

const CRM_PIPELINES_MAP = {
  clientId: 'client_id',
  isDefault: 'is_default',
}

const EMAIL_CONFIG_MAP = {
  clientId: 'client_id',
  apiKey: 'api_key',
  fromName: 'from_name',
  fromEmail: 'from_email',
  replyTo: 'reply_to',
  updatedAt: 'updated_at',
}

const EMAIL_LISTS_MAP = {
  clientId: 'client_id',
}

const EMAIL_SUBSCRIBERS_MAP = {
  clientId: 'client_id',
  listId: 'list_id',
  customData: 'custom_data',
  subscribedAt: 'subscribed_at',
  unsubscribedAt: 'unsubscribed_at',
}

const EMAIL_TEMPLATES_MAP = {
  clientId: 'client_id',
  htmlContent: 'html_content',
  jsonContent: 'json_content',
  updatedAt: 'updated_at',
}

const EMAIL_CAMPAIGNS_MAP = {
  clientId: 'client_id',
  fromName: 'from_name',
  fromEmail: 'from_email',
  replyTo: 'reply_to',
  listId: 'list_id',
  templateId: 'template_id',
  htmlContent: 'html_content',
  scheduledAt: 'scheduled_at',
  sentAt: 'sent_at',
  totalSent: 'total_sent',
  totalOpened: 'total_opened',
  totalClicked: 'total_clicked',
  totalBounced: 'total_bounced',
  totalUnsubscribed: 'total_unsubscribed',
  updatedAt: 'updated_at',
}

const MANYCHAT_CONFIG_MAP = {
  clientId: 'client_id',
  apiKey: 'api_key',
  pageId: 'page_id',
  webhookSecret: 'webhook_secret',
  autoSyncCrm: 'auto_sync_crm',
  syncTags: 'sync_tags',
  lastSync: 'last_sync',
  updatedAt: 'updated_at',
}

const WHATSAPP_CONFIG_MAP = {
  clientId: 'client_id',
  phoneNumber: 'phone_number',
  allowedNumbers: 'allowed_numbers',
  groupId: 'group_id',
  setterEnabled: 'setter_enabled',
  setterMessage: 'setter_message',
  setterDelayMinutes: 'setter_delay_minutes',
  updatedAt: 'updated_at',
}

const CHAT_FLOWS_MAP = {
  clientId: 'client_id',
  triggerType: 'trigger_type',
  triggerValue: 'trigger_value',
  updatedAt: 'updated_at',
}

const CHAT_CONTACTS_MAP = {
  clientId: 'client_id',
  platformId: 'platform_id',
  avatarUrl: 'avatar_url',
  customData: 'custom_data',
  lastInteraction: 'last_interaction',
}

const CHAT_CONVERSATIONS_MAP = {
  clientId: 'client_id',
  contactId: 'contact_id',
  flowId: 'flow_id',
  assignedTo: 'assigned_to',
  lastMessage: 'last_message',
  lastMessageAt: 'last_message_at',
  unreadCount: 'unread_count',
}

const CHAT_MESSAGES_MAP = {
  clientId: 'client_id',
  conversationId: 'conversation_id',
  senderType: 'sender_type',
  messageType: 'message_type',
  mediaUrl: 'media_url',
}

const CHAT_BROADCASTS_MAP = {
  clientId: 'client_id',
  messageContent: 'message_content',
  messageType: 'message_type',
  mediaUrl: 'media_url',
  targetTags: 'target_tags',
  scheduledAt: 'scheduled_at',
  sentAt: 'sent_at',
  totalSent: 'total_sent',
  totalDelivered: 'total_delivered',
  totalRead: 'total_read',
}

const INSTALLMENT_PLANS_MAP = {
  clientId: 'client_id',
  saleId: 'sale_id',
  clientName: 'client_name',
  clientEmail: 'client_email',
  clientPhone: 'client_phone',
  paymentMethod: 'payment_method',
  totalInstallments: 'total_installments',
  amountPerInstallment: 'amount_per_installment',
  totalAmount: 'total_amount',
  startDate: 'start_date',
  updatedAt: 'updated_at',
}

const INSTALLMENT_PAYMENTS_MAP = {
  planId: 'plan_id',
  installmentNumber: 'installment_number',
  paidDate: 'paid_date',
  markedBy: 'marked_by',
}

const AGENT_CONVERSATIONS_MAP = {
  clientId: 'client_id',
  userEmail: 'user_email',
  updatedAt: 'updated_at',
}

const AGENT_MESSAGES_MAP = {
  conversationId: 'conversation_id',
  clientId: 'client_id',
}

const COLD_CALL_REPORTS_MAP = {
  clientId: 'client_id',
  pickUps: 'pick_ups',
  scheduleCalls: 'schedule_calls',
}

const STORES_MAP = {
  clientId: 'client_id',
  ownerName: 'owner_name',
  ownerEmail: 'owner_email',
  ownerPhone: 'owner_phone',
  ownerInstagram: 'owner_instagram',
  brandName: 'brand_name',
  amazonMarketplace: 'amazon_marketplace',
  capitalDisponible: 'capital_disponible',
  gestorId: 'gestor_id',
  gestorName: 'gestor_name',
  serviceType: 'service_type',
  followupDays: 'followup_days',
  startDate: 'start_date',
  endDate: 'end_date',
  currentStep: 'current_step',
  totalSteps: 'total_steps',
  productName: 'product_name',
  productAsin: 'product_asin',
  agentName: 'agent_name',
  upsellOffered: 'upsell_offered',
  upsellResult: 'upsell_result',
  crmContactId: 'crm_contact_id',
  storeClientId: 'store_client_id',
  updatedAt: 'updated_at',
}

const STORE_STEPS_MAP = {
  storeId: 'store_id',
  stepNumber: 'step_number',
  stepType: 'step_type',
  videoUrl: 'video_url',
  actionUrl: 'action_url',
  inputField: 'input_field',
  inputValue: 'input_value',
  completedAt: 'completed_at',
  requiresTeamAction: 'requires_team_action',
  teamActionDone: 'team_action_done',
}

const STORE_ALERTS_MAP = {
  storeId: 'store_id',
  clientId: 'client_id',
  alertType: 'alert_type',
  resolvedAt: 'resolved_at',
  resolvedBy: 'resolved_by',
  resolutionNote: 'resolution_note',
}

const STORE_DAILY_TRACKING_MAP = {
  storeId: 'store_id',
  trackingDate: 'tracking_date',
  dayNumber: 'day_number',
  dailySales: 'daily_sales',
  dailyUnits: 'daily_units',
  ppcSpend: 'ppc_spend',
  organicPosition: 'organic_position',
  conversionRate: 'conversion_rate',
}

const STORE_HISTORY_MAP = {
  storeId: 'store_id',
  monthlyRevenue: 'monthly_revenue',
  monthlyUnits: 'monthly_units',
  monthlyPpc: 'monthly_ppc',
  profitMargin: 'profit_margin',
  healthStatus: 'health_status',
}

const STORE_CLIENTS_MAP = {
  clientId: 'client_id',
  storeId: 'store_id',
  lastLogin: 'last_login',
}

const STORE_TICKETS_MAP = {
  storeId: 'store_id',
  clientId: 'client_id',
  openedBy: 'opened_by',
  openedByName: 'opened_by_name',
  assignedGestorId: 'assigned_gestor_id',
  scheduledCallAt: 'scheduled_call_at',
  resolvedAt: 'resolved_at',
  updatedAt: 'updated_at',
}

const STORE_TICKET_MESSAGES_MAP = {
  ticketId: 'ticket_id',
  senderType: 'sender_type',
  senderName: 'sender_name',
}

const TABLE_MAPS = {
  sales: SALES_MAP,
  reports: REPORTS_MAP,
  team: TEAM_MAP,
  projections: PROJECTIONS_MAP,
  payment_fees: FEES_MAP,
  products: PRODUCTS_MAP,
  n8n_config: N8N_MAP,
  clients: CLIENTS_MAP,
  superadmins: SUPERADMINS_MAP,
  superadmin_commissions: SA_COMMISSIONS_MAP,
  ceo_meetings: CEO_MEETINGS_MAP,
  ceo_projects: CEO_PROJECTS_MAP,
  ceo_ideas: CEO_IDEAS_MAP,
  ceo_daily_digests: CEO_DAILY_DIGESTS_MAP,
  ceo_weekly_digests: CEO_WEEKLY_DIGESTS_MAP,
  ceo_team_notes: CEO_TEAM_NOTES_MAP,
  ceo_integrations: CEO_INTEGRATIONS_MAP,
  ceo_finance_entries: CEO_FINANCE_ENTRIES_MAP,
  commission_payments: COMMISSION_PAYMENTS_MAP,
  crm_contacts: CRM_CONTACTS_MAP,
  crm_activities: CRM_ACTIVITIES_MAP,
  crm_custom_fields: CRM_CUSTOM_FIELDS_MAP,
  crm_smart_views: CRM_SMART_VIEWS_MAP,
  crm_pipelines: CRM_PIPELINES_MAP,
  crm_files: CRM_FILES_MAP,
  crm_tasks: CRM_TASKS_MAP,
  email_config: EMAIL_CONFIG_MAP,
  email_lists: EMAIL_LISTS_MAP,
  email_subscribers: EMAIL_SUBSCRIBERS_MAP,
  email_templates: EMAIL_TEMPLATES_MAP,
  email_campaigns: EMAIL_CAMPAIGNS_MAP,
  manychat_config: MANYCHAT_CONFIG_MAP,
  whatsapp_config: WHATSAPP_CONFIG_MAP,
  chat_flows: CHAT_FLOWS_MAP,
  chat_contacts: CHAT_CONTACTS_MAP,
  chat_conversations: CHAT_CONVERSATIONS_MAP,
  chat_messages: CHAT_MESSAGES_MAP,
  chat_broadcasts: CHAT_BROADCASTS_MAP,
  installment_plans: INSTALLMENT_PLANS_MAP,
  installment_payments: INSTALLMENT_PAYMENTS_MAP,
  stores: STORES_MAP,
  store_steps: STORE_STEPS_MAP,
  store_alerts: STORE_ALERTS_MAP,
  store_daily_tracking: STORE_DAILY_TRACKING_MAP,
  store_history: STORE_HISTORY_MAP,
  store_clients: STORE_CLIENTS_MAP,
  store_tickets: STORE_TICKETS_MAP,
  store_ticket_messages: STORE_TICKET_MESSAGES_MAP,
  agent_conversations: AGENT_CONVERSATIONS_MAP,
  agent_messages: AGENT_MESSAGES_MAP,
}

// Valid DB columns per table (prevents unknown fields from causing insert errors)
const VALID_COLUMNS = {
  sales: new Set(['client_id', 'date', 'client_name', 'client_email', 'client_phone', 'instagram', 'product', 'producto_interes', 'payment_type', 'installment_number', 'payment_method', 'revenue', 'cash_collected', 'closer', 'setter', 'triager', 'gestor_asignado', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'pais', 'capital_disponible', 'situacion_actual', 'exp_amazon', 'decisor_confirmado', 'fecha_llamada', 'status', 'notes', 'source', 'close_activity_id']),
  reports: new Set(['client_id', 'date', 'role', 'name', 'conversations_opened', 'follow_ups', 'offers_launched', 'appointments_booked', 'scheduled_calls', 'calls_made', 'deposits', 'closes', 'deals', 'pick_ups', 'offers', 'schedule_calls']),
  team: new Set(['client_id', 'name', 'email', 'password', 'role', 'active', 'commission_rate', 'closer_commission_rate', 'setter_commission_rate', 'commission_start_date', 'mgmt_commission_start_date', 'is_gestor', 'gestor_commission_rate', 'gestor_start_date', 'gestor_capacity', 'calendar_url']),
  projections: new Set(['client_id', 'period', 'period_type', 'type', 'member_id', 'name', 'cash_target', 'revenue_target', 'appointment_target']),
  payment_fees: new Set(['client_id', 'method', 'fee_rate']),
  products: new Set(['client_id', 'name', 'price', 'active']),
  n8n_config: new Set(['client_id', 'webhook_url', 'api_key', 'enabled', 'last_sync']),
  ceo_meetings: new Set(['client_id', 'title', 'date', 'duration_minutes', 'participants', 'summary', 'action_items', 'key_topics', 'sentiment', 'transcript_url', 'status', 'source']),
  ceo_projects: new Set(['client_id', 'name', 'description', 'owner', 'priority', 'status', 'start_date', 'end_date', 'progress', 'tags']),
  ceo_ideas: new Set(['client_id', 'title', 'description', 'source', 'priority', 'status', 'meeting_id', 'project_id']),
  ceo_daily_digests: new Set(['client_id', 'date', 'summary', 'key_metrics', 'decisions_needed', 'highlights', 'alerts', 'generated_at']),
  ceo_weekly_digests: new Set(['client_id', 'week_start', 'week_end', 'numbers_summary', 'executive_summary', 'decisions_taken', 'next_steps', 'alerts', 'generated_at']),
  ceo_team_notes: new Set(['client_id', 'member_id', 'note', 'updated_at']),
  ceo_integrations: new Set(['client_id', 'service', 'api_key', 'config', 'enabled', 'last_sync']),
  ceo_finance_entries: new Set(['client_id', 'date', 'category', 'description', 'amount', 'recurring', 'notes']),
  commission_payments: new Set(['client_id', 'member_id', 'period_start', 'period_end', 'role', 'cash_base', 'rate', 'commission_amount', 'status', 'paid_at', 'notes']),
  crm_contacts: new Set(['client_id', 'name', 'email', 'phone', 'company', 'position', 'instagram', 'country', 'source', 'status', 'assigned_to', 'assigned_closer', 'assigned_setter', 'assigned_cold_caller', 'tags', 'custom_fields', 'notes', 'deal_value', 'last_activity_at', 'updated_at', 'address', 'whatsapp', 'zoom_link', 'website', 'linkedin', 'pipeline_id', 'producto_interes', 'capital_disponible', 'situacion_actual', 'exp_amazon', 'decisor_confirmado', 'fecha_llamada', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'triager', 'gestor_asignado', 'product', 'payment_type', 'payment_method', 'owner_name', 'owner_email', 'billing_annual', 'billing_cif', 'billing_address', 'enriched_at', 'enrichment_data']),
  crm_activities: new Set(['client_id', 'contact_id', 'type', 'custom_type', 'title', 'description', 'outcome', 'duration_minutes', 'performed_by', 'performed_at', 'file_url', 'scheduled_at']),
  crm_custom_fields: new Set(['client_id', 'name', 'field_key', 'field_type', 'options', 'required', 'position', 'active']),
  crm_smart_views: new Set(['client_id', 'name', 'filters', 'columns', 'sort_by', 'sort_dir', 'color', 'icon', 'position', 'created_by', 'pipeline_id']),
  crm_pipelines: new Set(['client_id', 'name', 'stages', 'is_default']),
  crm_files: new Set(['client_id', 'contact_id', 'file_name', 'file_url', 'file_size', 'file_type', 'uploaded_by']),
  crm_tasks: new Set(['client_id', 'contact_id', 'title', 'description', 'due_date', 'assigned_to', 'completed', 'completed_at', 'priority']),
  email_config: new Set(['client_id', 'provider', 'api_key', 'from_name', 'from_email', 'reply_to', 'domain', 'verified', 'updated_at']),
  email_lists: new Set(['client_id', 'name', 'description']),
  email_subscribers: new Set(['client_id', 'list_id', 'email', 'name', 'status', 'tags', 'custom_data', 'subscribed_at', 'unsubscribed_at']),
  email_templates: new Set(['client_id', 'name', 'subject', 'html_content', 'json_content', 'category', 'updated_at']),
  email_campaigns: new Set(['client_id', 'name', 'subject', 'from_name', 'from_email', 'reply_to', 'list_id', 'template_id', 'html_content', 'status', 'scheduled_at', 'sent_at', 'total_sent', 'total_opened', 'total_clicked', 'total_bounced', 'total_unsubscribed', 'updated_at']),
  manychat_config: new Set(['client_id', 'api_key', 'page_id', 'webhook_secret', 'auto_sync_crm', 'sync_tags', 'last_sync', 'updated_at']),
  whatsapp_config: new Set(['client_id', 'connected', 'phone_number', 'allowed_numbers', 'group_id', 'setter_enabled', 'setter_message', 'setter_delay_minutes', 'updated_at']),
  chat_flows: new Set(['client_id', 'name', 'description', 'trigger_type', 'trigger_value', 'channel', 'active', 'nodes', 'updated_at']),
  chat_contacts: new Set(['client_id', 'platform_id', 'platform', 'name', 'username', 'email', 'phone', 'avatar_url', 'tags', 'custom_data', 'last_interaction', 'subscribed']),
  chat_conversations: new Set(['client_id', 'contact_id', 'flow_id', 'channel', 'status', 'assigned_to', 'last_message', 'last_message_at', 'unread_count']),
  chat_messages: new Set(['client_id', 'conversation_id', 'sender_type', 'content', 'message_type', 'media_url', 'metadata']),
  chat_broadcasts: new Set(['client_id', 'name', 'channel', 'message_content', 'message_type', 'media_url', 'target_tags', 'status', 'scheduled_at', 'sent_at', 'total_sent', 'total_delivered', 'total_read']),
  installment_plans: new Set(['client_id', 'sale_id', 'client_name', 'client_email', 'client_phone', 'payment_method', 'product', 'closer', 'total_installments', 'amount_per_installment', 'total_amount', 'start_date', 'status', 'notes', 'updated_at']),
  installment_payments: new Set(['plan_id', 'installment_number', 'amount', 'paid', 'paid_date', 'marked_by', 'notes']),
  stores: new Set(['client_id', 'owner_name', 'owner_email', 'owner_phone', 'owner_instagram', 'brand_name', 'amazon_marketplace', 'capital_disponible', 'status', 'gestor_id', 'gestor_name', 'service_type', 'followup_days', 'start_date', 'end_date', 'current_step', 'total_steps', 'product_name', 'product_asin', 'agent_name', 'upsell_offered', 'upsell_result', 'crm_contact_id', 'store_client_id', 'notes', 'updated_at']),
  store_steps: new Set(['store_id', 'step_number', 'title', 'description', 'step_type', 'video_url', 'action_url', 'input_field', 'input_value', 'deliverables', 'completed', 'completed_at', 'requires_team_action', 'team_action_done']),
  store_alerts: new Set(['store_id', 'client_id', 'alert_type', 'title', 'message', 'priority', 'resolved', 'resolved_at', 'resolved_by', 'resolution_note']),
  store_daily_tracking: new Set(['store_id', 'tracking_date', 'day_number', 'daily_sales', 'daily_units', 'ppc_spend', 'organic_position', 'sessions', 'conversion_rate', 'notes']),
  store_history: new Set(['store_id', 'month', 'monthly_revenue', 'monthly_units', 'monthly_ppc', 'profit_margin', 'health_status', 'notes']),
  store_clients: new Set(['client_id', 'store_id', 'email', 'password', 'name', 'phone', 'instagram', 'active', 'last_login']),
  store_tickets: new Set(['store_id', 'client_id', 'opened_by', 'opened_by_name', 'assigned_gestor_id', 'subject', 'status', 'priority', 'category', 'scheduled_call_at', 'resolved_at', 'updated_at']),
  store_ticket_messages: new Set(['ticket_id', 'sender_type', 'sender_name', 'content']),
  agent_conversations: new Set(['client_id', 'user_email', 'title', 'context', 'updated_at']),
  agent_messages: new Set(['conversation_id', 'client_id', 'role', 'content']),
}

function buildReverse(map) {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]))
}

const REVERSE_MAPS = Object.fromEntries(
  Object.entries(TABLE_MAPS).map(([table, map]) => [table, buildReverse(map)])
)

export function toDb(obj, table) {
  const map = TABLE_MAPS[table] || {}
  const valid = VALID_COLUMNS[table]
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'netCash' || key === 'net_cash' || key === 'created_at') continue
    const dbKey = map[key] || key
    if (valid && !valid.has(dbKey)) continue // Skip unknown columns
    result[dbKey] = value
  }
  return result
}

export function toApp(row, table) {
  const reverse = REVERSE_MAPS[table] || {}
  const result = {}
  for (const [key, value] of Object.entries(row)) {
    if (key === 'created_at') continue
    const appKey = reverse[key] || key
    result[appKey] = value
  }
  return result
}
