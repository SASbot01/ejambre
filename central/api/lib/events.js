// System Events — centralized event bus for all dashboard activity
// Every agent action, CRM change, email sent, ERP action emits an event
// Events are stored in system_events table and forwarded to configured webhooks

import { supabase } from './supabase.js'

// Cache webhook configs (refresh every 5 min)
let webhookCache = null
let webhookCacheTime = 0

async function getWebhooks() {
  if (webhookCache && Date.now() - webhookCacheTime < 300000) return webhookCache
  const { data } = await supabase.from('webhook_config').select('*').eq('active', true)
  webhookCache = data || []
  webhookCacheTime = Date.now()
  return webhookCache
}

export async function emitEvent(eventType, source, action, data = {}, opts = {}) {
  const event = {
    event_type: eventType,
    source,
    action,
    data: JSON.stringify(data),
    client_id: opts.clientId || null,
    contact_id: opts.contactId || null,
    agent_run_id: opts.agentRunId || null,
  }

  // Store in DB
  const { data: inserted } = await supabase.from('system_events').insert(event).select().single()

  // Forward to webhooks
  const webhooks = await getWebhooks()
  for (const wh of webhooks) {
    // Check if webhook subscribes to this event type
    if (wh.events && wh.events.length > 0 && !wh.events.includes('*') && !wh.events.includes(eventType)) continue

    try {
      const payload = {
        id: inserted?.id,
        event: eventType,
        source,
        action,
        data,
        timestamp: new Date().toISOString(),
        ...(opts.clientId && { client_id: opts.clientId }),
        ...(opts.contactId && { contact_id: opts.contactId }),
        ...(opts.agentRunId && { agent_run_id: opts.agentRunId }),
      }

      const headers = { 'Content-Type': 'application/json' }
      if (wh.secret) headers['X-Webhook-Secret'] = wh.secret

      fetch(wh.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      }).then(async (res) => {
        if (inserted?.id) {
          await supabase.from('system_events').update({ webhook_sent: true }).eq('id', inserted.id)
        }
      }).catch(() => {})
    } catch (e) { /* non-blocking */ }
  }

  return inserted
}

// Pre-defined event types
export const EVENTS = {
  // Agent events
  AGENT_STARTED: 'agent.started',
  AGENT_COMPLETED: 'agent.completed',
  AGENT_FAILED: 'agent.failed',
  AGENT_LEAD_FOUND: 'agent.lead_found',
  AGENT_LEAD_ENRICHED: 'agent.lead_enriched',
  AGENT_EMAIL_SENT: 'agent.email_sent',
  AGENT_EMAIL_FAILED: 'agent.email_failed',
  AGENT_TEMPLATE_CREATED: 'agent.template_created',
  AGENT_LIST_CREATED: 'agent.list_created',

  // CRM events
  CRM_CONTACT_CREATED: 'crm.contact_created',
  CRM_CONTACT_UPDATED: 'crm.contact_updated',
  CRM_CONTACT_DELETED: 'crm.contact_deleted',
  CRM_STATUS_CHANGED: 'crm.status_changed',
  CRM_PIPELINE_MOVED: 'crm.pipeline_moved',

  // Email events
  EMAIL_CAMPAIGN_SENT: 'email.campaign_sent',
  EMAIL_DELIVERED: 'email.delivered',
  EMAIL_BOUNCED: 'email.bounced',

  // ERP events
  ERP_INVOICE_CREATED: 'erp.invoice_created',
  ERP_STOCK_MOVED: 'erp.stock_moved',
  ERP_ORDER_CREATED: 'erp.order_created',

  // Sales events
  SALE_CREATED: 'sale.created',
  SALE_IMPORTED: 'sale.imported',
}
