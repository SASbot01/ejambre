// POST /api/bridge-enjambre — Bridge: Dashboard-Ops → Enjambre
// Forwards CRM events to Enjambre's webhook for lead sync + sequence enrollment
// Called from frontend when CRM status changes or from agent after prospecting

import { supabase, resolveClientId } from './lib/supabase.js'
import { emitEvent, EVENTS } from './lib/events.js'

const ENJAMBRE_WEBHOOK_URL = process.env.ENJAMBRE_WEBHOOK_URL || 'https://api-enjambre.blackwolfsec.io/api/webhooks/central'

async function forwardToEnjambre(payload) {
  try {
    const res = await fetch(ENJAMBRE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('[Bridge] Enjambre error:', err)
      return { ok: false, error: err }
    }
    return await res.json()
  } catch (err) {
    console.error('[Bridge] Enjambre unreachable:', err.message)
    return { ok: false, error: err.message }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { action, contactId, clientSlug, data: extraData } = req.body
    if (!action) return res.status(400).json({ error: 'action required' })

    const clientId = clientSlug ? await resolveClientId(clientSlug) : null

    // ── ACTION: sync_lead — Send enriched CRM contact to Enjambre
    if (action === 'sync_lead' && contactId) {
      const { data: contact } = await supabase
        .from('crm_contacts')
        .select('*')
        .eq('id', contactId)
        .single()

      if (!contact) return res.status(404).json({ error: 'Contact not found' })

      const customFields = typeof contact.custom_fields === 'string'
        ? JSON.parse(contact.custom_fields) : (contact.custom_fields || {})

      const result = await forwardToEnjambre({
        event: 'agent.lead_found',
        source: 'prospector',
        action: 'lead_created',
        data: {
          contactId: contact.id,
          company: contact.company || contact.name,
          country: contact.country || '',
          email: contact.email || '',
          phone: contact.phone || '',
          ceo_name: customFields.ceo_name || contact.name || '',
          ceo_email: customFields.ceo_email || contact.email || '',
          ceo_linkedin: customFields.ceo_linkedin || contact.linkedin || '',
          product: contact.product || contact.producto_interes || '',
          sector: customFields.sector_specific || '',
          estimated_revenue: customFields.estimated_revenue || '',
        },
        client_id: clientId,
        contact_id: contactId,
      })

      return res.status(200).json({ ok: true, action: 'sync_lead', enjambre: result })
    }

    // ── ACTION: status_changed — Notify Enjambre of pipeline change
    if (action === 'status_changed' && contactId) {
      const newStatus = extraData?.newStatus || extraData?.status
      if (!newStatus) return res.status(400).json({ error: 'newStatus required in data' })

      const result = await forwardToEnjambre({
        event: 'crm.status_changed',
        source: 'crm',
        action: 'status_changed',
        data: {
          contactId,
          newStatus,
          previousStatus: extraData?.previousStatus || null,
        },
        client_id: clientId,
        contact_id: contactId,
      })

      // Also emit internal event
      await emitEvent(EVENTS.CRM_STATUS_CHANGED, 'crm', 'status_changed', {
        contactId, newStatus, synced_to_enjambre: result?.ok || false,
      }, { clientId, contactId })

      return res.status(200).json({ ok: true, action: 'status_changed', enjambre: result })
    }

    // ── ACTION: bulk_sync — Sync all CRM contacts to Enjambre
    if (action === 'bulk_sync') {
      if (!clientId) return res.status(400).json({ error: 'clientSlug required for bulk_sync' })

      const { data: contacts } = await supabase
        .from('crm_contacts')
        .select('id, name, company, email, phone, country, status, product, linkedin, custom_fields')
        .eq('client_id', clientId)
        .not('status', 'in', '("won","lost")')
        .order('created_at', { ascending: false })
        .limit(100)

      let synced = 0
      let errors = 0

      for (const contact of (contacts || [])) {
        if (!contact.email) continue

        const customFields = typeof contact.custom_fields === 'string'
          ? JSON.parse(contact.custom_fields) : (contact.custom_fields || {})

        const result = await forwardToEnjambre({
          event: 'agent.lead_found',
          source: 'prospector',
          action: 'lead_created',
          data: {
            contactId: contact.id,
            company: contact.company || contact.name,
            country: contact.country || '',
            email: contact.email,
            phone: contact.phone || '',
            ceo_name: customFields.ceo_name || contact.name || '',
            ceo_email: customFields.ceo_email || contact.email || '',
            ceo_linkedin: customFields.ceo_linkedin || contact.linkedin || '',
            product: contact.product || '',
            sector: customFields.sector_specific || '',
          },
          client_id: clientId,
          contact_id: contact.id,
        })

        if (result?.ok) synced++
        else errors++
      }

      return res.status(200).json({ ok: true, action: 'bulk_sync', synced, errors, total: (contacts || []).length })
    }

    return res.status(400).json({ error: `Unknown action: ${action}` })
  } catch (err) {
    console.error('[Bridge] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}
