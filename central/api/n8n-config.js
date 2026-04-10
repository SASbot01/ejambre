// GET  /api/n8n-config  — get the N8n config
// PUT  /api/n8n-config  — update the N8n config

import { supabase, toDbFormat, toAppFormat, resolveClientId } from './lib/supabase.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  // ── GET: Get config ──
  if (req.method === 'GET') {
    try {
      const clientId = await resolveClientId(req.query.clientSlug)
      if (!clientId) return res.status(400).json({ error: 'clientSlug is required' })

      const { data, error } = await supabase.from('n8n_config').select('*').eq('client_id', clientId).limit(1)
      if (error) return res.status(500).json({ error: error.message })

      if (!data || data.length === 0) {
        // Create default config if none exists
        const defaultConfig = { webhook_url: '', api_key: '', enabled: false, last_sync: null, client_id: clientId }
        const { data: created, error: insertErr } = await supabase
          .from('n8n_config')
          .insert(defaultConfig)
          .select()

        if (insertErr) return res.status(500).json({ error: insertErr.message })
        return res.status(200).json({ config: toAppFormat(created[0], 'n8n_config') })
      }

      return res.status(200).json({ config: toAppFormat(data[0], 'n8n_config') })
    } catch (err) {
      console.error('GET /api/n8n-config error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  // ── PUT: Update config ──
  if (req.method === 'PUT') {
    try {
      const clientId = await resolveClientId(req.query.clientSlug)
      if (!clientId) return res.status(400).json({ error: 'clientSlug is required' })

      const updates = req.body

      // Get existing config to find id
      const { data: existing } = await supabase.from('n8n_config').select('id').eq('client_id', clientId).limit(1)

      if (!existing || existing.length === 0) {
        // Insert new
        const dbConfig = toDbFormat(updates, 'n8n_config')
        dbConfig.client_id = clientId
        const { data, error } = await supabase.from('n8n_config').insert(dbConfig).select()
        if (error) return res.status(500).json({ error: error.message })
        return res.status(200).json({ success: true, config: toAppFormat(data[0], 'n8n_config') })
      }

      // Update existing
      const dbUpdates = toDbFormat(updates, 'n8n_config')
      const { data, error } = await supabase
        .from('n8n_config')
        .update(dbUpdates)
        .eq('id', existing[0].id)
        .eq('client_id', clientId)
        .select()

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ success: true, config: toAppFormat(data[0], 'n8n_config') })
    } catch (err) {
      console.error('PUT /api/n8n-config error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
