// GET  /api/reports   — list all reports (with optional filters)
// POST /api/reports   — create a new report
// PUT  /api/reports   — update a report
// DELETE /api/reports — delete a report

import { supabase, toDbFormat, toAppFormat, resolveClientId } from './lib/supabase.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  // ── GET: List reports ──
  if (req.method === 'GET') {
    try {
      const clientId = await resolveClientId(req.query.clientSlug)
      if (!clientId) return res.status(400).json({ error: 'clientSlug is required' })

      let query = supabase.from('reports').select('*').eq('client_id', clientId).order('date', { ascending: false })

      const { from, to, role, name } = req.query
      if (from) query = query.gte('date', from)
      if (to) query = query.lte('date', to)
      if (role) query = query.eq('role', role)
      if (name) query = query.eq('name', name)

      const { data, error } = await query
      if (error) return res.status(500).json({ error: error.message })

      const reports = (data || []).map(r => toAppFormat(r, 'reports'))
      return res.status(200).json({ reports, count: reports.length })
    } catch (err) {
      console.error('GET /api/reports error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  // ── POST: Create report ──
  if (req.method === 'POST') {
    try {
      const clientId = await resolveClientId(req.query.clientSlug)
      if (!clientId) return res.status(400).json({ error: 'clientSlug is required' })

      const report = req.body
      if (!report.name && !report.role) {
        return res.status(400).json({ error: 'name and role are required' })
      }

      const dbReport = toDbFormat(report, 'reports')
      dbReport.client_id = clientId
      const { data, error } = await supabase.from('reports').insert(dbReport).select()
      if (error) return res.status(500).json({ error: error.message })

      return res.status(201).json({ success: true, report: toAppFormat(data[0], 'reports') })
    } catch (err) {
      console.error('POST /api/reports error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  // ── PUT: Update report ──
  if (req.method === 'PUT') {
    try {
      const clientId = await resolveClientId(req.query.clientSlug)
      if (!clientId) return res.status(400).json({ error: 'clientSlug is required' })

      const { id, ...updates } = req.body
      if (!id) return res.status(400).json({ error: 'id is required' })

      const dbUpdates = toDbFormat(updates, 'reports')
      const { data, error } = await supabase.from('reports').update(dbUpdates).eq('id', id).eq('client_id', clientId).select()
      if (error) return res.status(500).json({ error: error.message })
      if (!data || data.length === 0) return res.status(404).json({ error: 'Report not found' })

      return res.status(200).json({ success: true, report: toAppFormat(data[0], 'reports') })
    } catch (err) {
      console.error('PUT /api/reports error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  // ── DELETE: Delete report ──
  if (req.method === 'DELETE') {
    try {
      const clientId = await resolveClientId(req.query.clientSlug)
      if (!clientId) return res.status(400).json({ error: 'clientSlug is required' })

      const { id } = req.query
      if (!id) return res.status(400).json({ error: 'id query param required' })

      const { error } = await supabase.from('reports').delete().eq('id', id).eq('client_id', clientId)
      if (error) return res.status(500).json({ error: error.message })

      return res.status(200).json({ success: true })
    } catch (err) {
      console.error('DELETE /api/reports error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
