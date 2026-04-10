// POST /api/webhook/sale
// Receives a sale from N8n (Close CRM data) and stores it in Supabase

import { supabase, toDbFormat, transformCloseData, resolveClientId } from '../lib/supabase.js'
import { emitEvent, EVENTS } from '../lib/events.js'

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  // Validate API key
  const apiKey = req.headers['x-api-key']
  if (!apiKey || apiKey !== process.env.WEBHOOK_API_KEY) {
    return res.status(401).json({ error: 'Invalid or missing API key' })
  }

  try {
    const clientId = await resolveClientId(req.query.clientSlug)
    if (!clientId) return res.status(400).json({ error: 'clientSlug is required' })

    const data = req.body

    // Check for duplicate (by close_activity_id)
    if (data.activity_id || data.closeActivityId) {
      const activityId = data.activity_id || data.closeActivityId
      const { data: existing } = await supabase
        .from('sales')
        .select('id')
        .eq('close_activity_id', activityId)
        .eq('client_id', clientId)
        .limit(1)

      if (existing && existing.length > 0) {
        return res.status(409).json({
          error: 'Duplicate: sale with this activity_id already exists',
          existingId: existing[0].id,
        })
      }
    }

    // Transform Close CRM data to our format
    const sale = transformCloseData(data)

    // Convert to DB format and insert
    const dbSale = toDbFormat(sale)
    dbSale.client_id = clientId
    const { data: result, error } = await supabase
      .from('sales')
      .insert(dbSale)
      .select()

    if (error) {
      console.error('Supabase insert error:', error)
      return res.status(500).json({ error: error.message })
    }

    await emitEvent(EVENTS.SALE_IMPORTED, 'webhook', 'sale_imported', { clientName: result[0]?.client_name, revenue: result[0]?.revenue, closer: result[0]?.closer }, { clientId })

    return res.status(201).json({
      success: true,
      message: 'Sale imported successfully',
      sale: result[0],
    })
  } catch (err) {
    console.error('Webhook handler error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
