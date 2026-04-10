// GET    /api/team        — list all team members
// POST   /api/team        — add a new member
// PUT    /api/team        — update a member
// DELETE /api/team        — delete a member
// POST   /api/team?action=login — authenticate

import { supabase, toDbFormat, toAppFormat, resolveClientId } from './lib/supabase.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  // ── POST with action=login: Authenticate ──
  if (req.method === 'POST' && req.query.action === 'login') {
    try {
      const { email, password } = req.body
      if (!email || !password) {
        return res.status(400).json({ error: 'email and password required' })
      }

      const clientSlug = req.body.clientSlug || req.query.clientSlug
      const clientId = await resolveClientId(clientSlug)
      if (!clientId) return res.status(400).json({ error: 'clientSlug is required' })

      const { data, error } = await supabase
        .from('team')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .eq('active', true)
        .eq('client_id', clientId)
        .limit(1)

      if (error) return res.status(500).json({ error: error.message })
      if (!data || data.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' })
      }

      const user = toAppFormat(data[0], 'team')
      // Don't send password back
      delete user.password
      return res.status(200).json({ success: true, user, clientSlug })
    } catch (err) {
      console.error('POST /api/team?action=login error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  // ── GET: List team members ──
  if (req.method === 'GET') {
    try {
      const clientId = await resolveClientId(req.query.clientSlug)
      if (!clientId) return res.status(400).json({ error: 'clientSlug is required' })

      let query = supabase.from('team').select('*').eq('client_id', clientId).order('name')

      const { role, active } = req.query
      if (role) query = query.eq('role', role)
      if (active !== undefined) query = query.eq('active', active === 'true')

      const { data, error } = await query
      if (error) return res.status(500).json({ error: error.message })

      const team = (data || []).map(m => {
        const member = toAppFormat(m, 'team')
        delete member.password // Never expose passwords
        return member
      })
      return res.status(200).json({ team, count: team.length })
    } catch (err) {
      console.error('GET /api/team error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  // ── POST: Add member ──
  if (req.method === 'POST') {
    try {
      const clientId = await resolveClientId(req.query.clientSlug)
      if (!clientId) return res.status(400).json({ error: 'clientSlug is required' })

      const member = req.body
      if (!member.name || !member.email) {
        return res.status(400).json({ error: 'name and email are required' })
      }

      const dbMember = toDbFormat(member, 'team')
      dbMember.client_id = clientId
      const { data, error } = await supabase.from('team').insert(dbMember).select()
      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ error: 'A member with this email already exists' })
        }
        return res.status(500).json({ error: error.message })
      }

      const result = toAppFormat(data[0], 'team')
      delete result.password
      return res.status(201).json({ success: true, member: result })
    } catch (err) {
      console.error('POST /api/team error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  // ── PUT: Update member ──
  if (req.method === 'PUT') {
    try {
      const clientId = await resolveClientId(req.query.clientSlug)
      if (!clientId) return res.status(400).json({ error: 'clientSlug is required' })

      const { id, ...updates } = req.body
      if (!id) return res.status(400).json({ error: 'id is required' })

      const dbUpdates = toDbFormat(updates, 'team')
      const { data, error } = await supabase.from('team').update(dbUpdates).eq('id', id).eq('client_id', clientId).select()
      if (error) return res.status(500).json({ error: error.message })
      if (!data || data.length === 0) return res.status(404).json({ error: 'Member not found' })

      const result = toAppFormat(data[0], 'team')
      delete result.password
      return res.status(200).json({ success: true, member: result })
    } catch (err) {
      console.error('PUT /api/team error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  // ── DELETE: Delete member ──
  if (req.method === 'DELETE') {
    try {
      const clientId = await resolveClientId(req.query.clientSlug)
      if (!clientId) return res.status(400).json({ error: 'clientSlug is required' })

      const { id } = req.query
      if (!id) return res.status(400).json({ error: 'id query param required' })

      const { error } = await supabase.from('team').delete().eq('id', id).eq('client_id', clientId)
      if (error) return res.status(500).json({ error: error.message })

      return res.status(200).json({ success: true })
    } catch (err) {
      console.error('DELETE /api/team error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
