// POST /api/send-email — API proxy (Resend + ManyChat + Events) to avoid CORS
// Actions:
//   { action: "send-emails", resendApiKey, emails }
//   { action: "manychat", apiKey, endpoint, method, body }
//   { action: "events-list", limit, offset, eventType, source }
//   { action: "events-subscribe", name, url, secret, events }
//   { action: "events-unsubscribe", webhookId }
//   { action: "events-webhooks" }
//   Legacy: { resendApiKey, emails } (backwards compat)

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_KEY || '')

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { action } = req.body

    // ── ManyChat Proxy ──
    if (action === 'manychat') {
      const { apiKey, endpoint, method = 'GET', body } = req.body
      if (!apiKey) return res.status(400).json({ error: 'apiKey is required' })
      if (!endpoint) return res.status(400).json({ error: 'endpoint is required' })

      const url = `https://api.manychat.com${endpoint}`
      const options = {
        method,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      }
      if (body && method !== 'GET') options.body = JSON.stringify(body)

      const response = await fetch(url, options)
      const data = await response.json()

      if (!response.ok) {
        return res.status(response.status).json({ error: data.message || data.error || 'ManyChat API error', details: data })
      }
      return res.status(200).json(data)
    }

    // ── Enrich/Scrape Company Data ──
    if (action === 'enrich') {
      const { company, name, website, country } = req.body
      if (!company && !website) return res.status(400).json({ error: 'company or website required' })

      const results = { phone: null, email: null, owner: null, billing: null, sources: [] }

      // Strategy 1: Google search for phone number
      const queries = [
        `"${company}" teléfono contacto ${country || 'España'}`,
        `"${company}" phone number contact`,
        website ? `site:${website} teléfono OR phone OR contacto` : null,
        `"${company}" CIF facturación`,
      ].filter(Boolean)

      for (const query of queries) {
        try {
          const gRes = await fetch(`https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY || ''}&cx=${process.env.GOOGLE_CX || ''}&q=${encodeURIComponent(query)}&num=5`)
          if (gRes.ok) {
            const gData = await gRes.json()
            for (const item of (gData.items || [])) {
              const snippet = (item.snippet || '') + ' ' + (item.title || '')
              // Extract phone numbers (Spanish/international format)
              const phones = snippet.match(/(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3}[\s.-]?\d{2,4}[\s.-]?\d{0,4}/g)
              if (phones && !results.phone) {
                const cleaned = phones.map(p => p.replace(/[^\d+]/g, '')).filter(p => p.length >= 9)
                if (cleaned.length > 0) {
                  results.phone = cleaned[0]
                  results.sources.push({ type: 'phone', source: 'google', url: item.link })
                }
              }
              // Extract emails
              const emails = snippet.match(/[\w.+-]+@[\w.-]+\.\w{2,}/g)
              if (emails && !results.email) {
                results.email = emails[0]
                results.sources.push({ type: 'email', source: 'google', url: item.link })
              }
            }
          }
        } catch (e) { /* skip */ }
      }

      // Strategy 2: Scrape company website for contact info
      if (website) {
        const contactPaths = ['/contacto', '/contact', '/about', '/sobre-nosotros', '/legal', '/aviso-legal', '/impressum']
        for (const path of ['', ...contactPaths]) {
          try {
            const url = website.replace(/\/$/, '') + path
            const pageRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow', signal: AbortSignal.timeout(5000) })
            if (pageRes.ok) {
              const html = await pageRes.text()
              // Extract phones from HTML
              if (!results.phone) {
                const phoneMatches = html.match(/(?:tel:|phone:|teléfono|telefono|telf?\.?:?\s*)([+\d\s().-]{9,18})/gi)
                if (phoneMatches) {
                  for (const m of phoneMatches) {
                    const cleaned = m.replace(/[^\d+]/g, '')
                    if (cleaned.length >= 9) { results.phone = cleaned; results.sources.push({ type: 'phone', source: 'website', url }); break }
                  }
                }
                // Also try href="tel:" pattern
                const telLinks = html.match(/href=["']tel:([^"']+)["']/gi)
                if (telLinks && !results.phone) {
                  const num = telLinks[0].replace(/href=["']tel:/i, '').replace(/["']/g, '').replace(/[^\d+]/g, '')
                  if (num.length >= 9) { results.phone = num; results.sources.push({ type: 'phone', source: 'website-tel', url }) }
                }
              }
              // Extract emails from HTML
              if (!results.email) {
                const emailMatches = html.match(/[\w.+-]+@[\w.-]+\.\w{2,}/g)
                if (emailMatches) {
                  const good = emailMatches.filter(e => !e.includes('example') && !e.includes('sentry') && !e.includes('webpack'))
                  if (good.length > 0) { results.email = good[0]; results.sources.push({ type: 'email', source: 'website', url }) }
                }
              }
              // Extract CIF/NIF from legal pages
              if (!results.billing) {
                const cifMatch = html.match(/(?:CIF|NIF|VAT|N\.I\.F|C\.I\.F)[:\s]*([A-Z]?\d{7,8}[A-Z]?)/i)
                if (cifMatch) { results.billing = { cif: cifMatch[1] }; results.sources.push({ type: 'cif', source: 'website', url }) }
              }
              if (results.phone && results.email) break // Got what we need
            }
          } catch (e) { /* skip timeouts */ }
        }
      }

      // Strategy 3: Try LinkedIn company page (public info)
      if (company && !results.phone) {
        try {
          const liRes = await fetch(`https://www.google.com/search?q=${encodeURIComponent(company + ' site:linkedin.com/company')}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' }, signal: AbortSignal.timeout(5000)
          })
          if (liRes.ok) {
            const liHtml = await liRes.text()
            const phones = liHtml.match(/(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3}[\s.-]?\d{2,4}/g)
            if (phones) {
              const cleaned = phones.map(p => p.replace(/[^\d+]/g, '')).filter(p => p.length >= 9 && p.length <= 15)
              if (cleaned.length > 0) { results.phone = cleaned[0]; results.sources.push({ type: 'phone', source: 'linkedin' }) }
            }
          }
        } catch (e) { /* skip */ }
      }

      return res.status(200).json(results)
    }

    // ── EVENTS API — for external swarm to monitor all system activity ──
    if (action === 'events-list') {
      const { limit = 50, offset = 0, eventType, source } = req.body
      let q = supabase.from('system_events').select('*').order('created_at', { ascending: false }).range(offset, offset + limit - 1)
      if (eventType) q = q.eq('event_type', eventType)
      if (source) q = q.eq('source', source)
      const { data, error } = await q
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ events: data, count: data?.length || 0 })
    }

    if (action === 'events-subscribe') {
      const { name, url, secret = '', events = ['*'] } = req.body
      if (!name || !url) return res.status(400).json({ error: 'name and url required' })
      const { data, error } = await supabase.from('webhook_config').insert({ name, url, secret, events, active: true }).select().single()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(201).json({ webhook: data, message: `Webhook "${name}" subscribed to: ${events.join(', ')}` })
    }

    if (action === 'events-unsubscribe') {
      const { webhookId } = req.body
      if (!webhookId) return res.status(400).json({ error: 'webhookId required' })
      await supabase.from('webhook_config').delete().eq('id', webhookId)
      return res.status(200).json({ message: 'Webhook removed' })
    }

    if (action === 'events-webhooks') {
      const { data } = await supabase.from('webhook_config').select('*').order('created_at', { ascending: false })
      return res.status(200).json({ webhooks: data || [] })
    }

    // ── Resend Email Sending (default / legacy) ──
    const { resendApiKey, emails } = req.body
    if (!resendApiKey) return res.status(400).json({ error: 'resendApiKey is required' })
    if (!emails || !emails.length) return res.status(400).json({ error: 'emails array is required' })

    let sent = 0
    let failed = 0
    let lastError = null

    for (const email of emails) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(email),
        })

        if (response.ok) {
          sent++
        } else {
          const err = await response.json()
          lastError = err.message || JSON.stringify(err)
          failed++
        }
      } catch (e) {
        lastError = e.message
        failed++
      }
    }

    return res.status(200).json({ sent, failed, total: emails.length, lastError })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
