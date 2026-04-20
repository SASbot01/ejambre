// GET  /api/sales        — list all sales (with optional filters)
// POST /api/sales        — create a new sale manually

import { supabase, toDbFormat, toAppFormat, resolveClientId } from './lib/supabase.js'

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // ── GET: List sales ──
  if (req.method === 'GET') {
    try {
      const clientId = await resolveClientId(req.query.clientSlug)
      if (!clientId) return res.status(400).json({ error: 'clientSlug is required' })

      let query = supabase.from('sales').select('*').eq('client_id', clientId).order('date', { ascending: false })

      // Optional date filters
      const { from, to, closer, product, status } = req.query
      if (from) query = query.gte('date', from)
      if (to) query = query.lte('date', to)
      if (closer) query = query.eq('closer', closer)
      if (product) query = query.eq('product', product)
      if (status) query = query.eq('status', status)

      const { data, error } = await query

      if (error) {
        return res.status(500).json({ error: error.message })
      }

      // Convert to app format
      const sales = (data || []).map(toAppFormat)
      return res.status(200).json({ sales, count: sales.length })
    } catch (err) {
      console.error('GET /api/sales error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  // ── POST: Create a sale ──
  if (req.method === 'POST') {
    try {
      const clientId = await resolveClientId(req.query.clientSlug)
      if (!clientId) return res.status(400).json({ error: 'clientSlug is required' })

      const sale = req.body

      if (!sale.clientName && !sale.client_name) {
        return res.status(400).json({ error: 'clientName is required' })
      }

      // Set defaults
      const saleData = {
        date: sale.date || new Date().toISOString().split('T')[0],
        source: sale.source || 'manual',
        status: sale.status || 'Completada',
        ...sale,
      }

      const dbSale = toDbFormat(saleData)
      dbSale.client_id = clientId
      const { data, error } = await supabase.from('sales').insert(dbSale).select()

      if (error) {
        return res.status(500).json({ error: error.message })
      }

      return res.status(201).json({ success: true, sale: toAppFormat(data[0]) })
    } catch (err) {
      console.error('POST /api/sales error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  // ── PUT: Update a sale ──
  if (req.method === 'PUT') {
    try {
      const clientId = await resolveClientId(req.query.clientSlug)
      if (!clientId) return res.status(400).json({ error: 'clientSlug is required' })

      const { id, ...updates } = req.body
      if (!id) return res.status(400).json({ error: 'id is required' })

      const dbUpdates = toDbFormat(updates)
      const { data, error } = await supabase.from('sales').update(dbUpdates).eq('id', id).eq('client_id', clientId).select()

      if (error) return res.status(500).json({ error: error.message })
      if (!data || data.length === 0) return res.status(404).json({ error: 'Sale not found' })

      return res.status(200).json({ success: true, sale: toAppFormat(data[0]) })
    } catch (err) {
      console.error('PUT /api/sales error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  // ── DELETE: Delete a sale ──
  if (req.method === 'DELETE') {
    try {
      const clientId = await resolveClientId(req.query.clientSlug)
      if (!clientId) return res.status(400).json({ error: 'clientSlug is required' })

      const { id } = req.query
      if (!id) return res.status(400).json({ error: 'id query param required' })

      const { error } = await supabase.from('sales').delete().eq('id', id).eq('client_id', clientId)
      if (error) return res.status(500).json({ error: error.message })

      return res.status(200).json({ success: true })
    } catch (err) {
      console.error('DELETE /api/sales error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
