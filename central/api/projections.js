// GET    /api/projections  — list projections (with optional filters)
// POST   /api/projections  — create a projection
// PUT    /api/projections  — update a projection
// DELETE /api/projections  — delete a projection

import { supabase, toDbFormat, toAppFormat, resolveClientId } from './lib/supabase.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  // ── GET: List projections ──
  if (req.method === 'GET') {
    try {
      const clientId = await resolveClientId(req.query.clientSlug)
      if (!clientId) return res.status(400).json({ error: 'clientSlug is required' })

      let query = supabase.from('projections').select('*').eq('client_id', clientId).order('period', { ascending: false })

      const { period, periodType, type, memberId } = req.query
      if (period) query = query.eq('period', period)
      if (periodType) query = query.eq('period_type', periodType)
      if (type) query = query.eq('type', type)
      if (memberId) query = query.eq('member_id', memberId)

      const { data, error } = await query
      if (error) return res.status(500).json({ error: error.message })

      const projections = (data || []).map(p => toAppFormat(p, 'projections'))
      return res.status(200).json({ projections, count: projections.length })
    } catch (err) {
      console.error('GET /api/projections error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  // ── POST: Create projection ──
  if (req.method === 'POST') {
    try {
      const clientId = await resolveClientId(req.query.clientSlug)
      if (!clientId) return res.status(400).json({ error: 'clientSlug is required' })

      const projection = req.body
      if (!projection.period || !projection.name) {
        return res.status(400).json({ error: 'period and name are required' })
      }

      const dbProjection = toDbFormat(projection, 'projections')
      dbProjection.client_id = clientId
      const { data, error } = await supabase.from('projections').insert(dbProjection).select()
      if (error) return res.status(500).json({ error: error.message })

      return res.status(201).json({ success: true, projection: toAppFormat(data[0], 'projections') })
    } catch (err) {
      console.error('POST /api/projections error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  // ── PUT: Update projection ──
  if (req.method === 'PUT') {
    try {
      const clientId = await resolveClientId(req.query.clientSlug)
      if (!clientId) return res.status(400).json({ error: 'clientSlug is required' })

      const { id, ...updates } = req.body
      if (!id) return res.status(400).json({ error: 'id is required' })

      const dbUpdates = toDbFormat(updates, 'projections')
      const { data, error } = await supabase.from('projections').update(dbUpdates).eq('id', id).eq('client_id', clientId).select()
      if (error) return res.status(500).json({ error: error.message })
      if (!data || data.length === 0) return res.status(404).json({ error: 'Projection not found' })

      return res.status(200).json({ success: true, projection: toAppFormat(data[0], 'projections') })
    } catch (err) {
      console.error('PUT /api/projections error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  // ── DELETE: Delete projection ──
  if (req.method === 'DELETE') {
    try {
      const clientId = await resolveClientId(req.query.clientSlug)
      if (!clientId) return res.status(400).json({ error: 'clientSlug is required' })

      const { id } = req.query
      if (!id) return res.status(400).json({ error: 'id query param required' })

      const { error } = await supabase.from('projections').delete().eq('id', id).eq('client_id', clientId)
      if (error) return res.status(500).json({ error: error.message })

      return res.status(200).json({ success: true })
    } catch (err) {
      console.error('DELETE /api/projections error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
