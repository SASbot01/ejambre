// GET    /api/products  — list all products for a client
// POST   /api/products  — create a product
// PUT    /api/products  — update a product
// DELETE /api/products  — delete a product

import { supabase, toDbFormat, toAppFormat, resolveClientId } from './lib/supabase.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  // ── GET: List products ──
  if (req.method === 'GET') {
    try {
      const clientId = await resolveClientId(req.query.clientSlug)
      if (!clientId) return res.status(400).json({ error: 'clientSlug is required' })

      const { data, error } = await supabase.from('products').select('*').eq('client_id', clientId).order('name')
      if (error) return res.status(500).json({ error: error.message })

      const products = (data || []).map(p => toAppFormat(p, 'products'))
      return res.status(200).json({ products, count: products.length })
    } catch (err) {
      console.error('GET /api/products error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  // ── POST: Create product ──
  if (req.method === 'POST') {
    try {
      const clientId = await resolveClientId(req.query.clientSlug)
      if (!clientId) return res.status(400).json({ error: 'clientSlug is required' })

      const product = req.body
      if (!product.name) {
        return res.status(400).json({ error: 'name is required' })
      }

      const dbProduct = toDbFormat(product, 'products')
      dbProduct.client_id = clientId
      const { data, error } = await supabase.from('products').insert(dbProduct).select()
      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ error: 'A product with this name already exists' })
        }
        return res.status(500).json({ error: error.message })
      }

      return res.status(201).json({ success: true, product: toAppFormat(data[0], 'products') })
    } catch (err) {
      console.error('POST /api/products error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  // ── PUT: Update product ──
  if (req.method === 'PUT') {
    try {
      const clientId = await resolveClientId(req.query.clientSlug)
      if (!clientId) return res.status(400).json({ error: 'clientSlug is required' })

      const { id, ...updates } = req.body
      if (!id) return res.status(400).json({ error: 'id is required' })

      const dbUpdates = toDbFormat(updates, 'products')
      const { data, error } = await supabase.from('products').update(dbUpdates).eq('id', id).eq('client_id', clientId).select()
      if (error) return res.status(500).json({ error: error.message })
      if (!data || data.length === 0) return res.status(404).json({ error: 'Product not found' })

      return res.status(200).json({ success: true, product: toAppFormat(data[0], 'products') })
    } catch (err) {
      console.error('PUT /api/products error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  // ── DELETE: Delete product ──
  if (req.method === 'DELETE') {
    try {
      const clientId = await resolveClientId(req.query.clientSlug)
      if (!clientId) return res.status(400).json({ error: 'clientSlug is required' })

      const { id } = req.query
      if (!id) return res.status(400).json({ error: 'id query param required' })

      const { error } = await supabase.from('products').delete().eq('id', id).eq('client_id', clientId)
      if (error) return res.status(500).json({ error: error.message })

      return res.status(200).json({ success: true })
    } catch (err) {
      console.error('DELETE /api/products error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
