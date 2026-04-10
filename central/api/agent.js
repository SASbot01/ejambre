// POST /api/agent — Unified AI agent
// Two modes:
//   1. Analytics: { question, history, clientSlug } — Claude-powered dashboard analytics
//   2. Prospector: { action, clientSlug, config } — Google Maps lead search + CRM insert

import Anthropic from '@anthropic-ai/sdk'
import { supabase, resolveClientId } from './lib/supabase.js'
import { emitEvent, EVENTS } from './lib/events.js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ═══════════════════════════════════════════════════════════════════════════════
// PROSPECTOR AGENT — Enterprise-grade multi-source lead generation
// Sources: OpenCorporates, Europages, OpenStreetMap, Nominatim
// Enrichment: Claude AI → CEO, LinkedIn, emails, phone, revenue estimate
// ═══════════════════════════════════════════════════════════════════════════════

const COUNTRY_CODES = {
  'Espana': 'ES', 'Portugal': 'PT', 'Italia': 'IT', 'Francia': 'FR', 'Alemania': 'DE',
  'Reino Unido': 'GB', 'Paises Bajos': 'NL', 'Belgica': 'BE', 'Polonia': 'PL', 'Turquia': 'TR',
  'Rumania': 'RO', 'Republica Checa': 'CZ', 'Austria': 'AT', 'Suiza': 'CH', 'Suecia': 'SE',
  'Bulgaria': 'BG',
}

// OpenCorporates jurisdiction codes
const OC_JURISDICTIONS = {
  'Espana': 'es', 'Portugal': 'pt', 'Italia': 'it', 'Francia': 'fr', 'Alemania': 'de',
  'Reino Unido': 'gb', 'Paises Bajos': 'nl', 'Belgica': 'be', 'Polonia': 'pl', 'Turquia': 'tr',
  'Rumania': 'ro', 'Republica Checa': 'cz', 'Austria': 'at', 'Suiza': 'ch', 'Suecia': 'se',
  'Bulgaria': 'bg',
}

const COUNTRY_NAMES_EN = {
  'Espana': 'Spain', 'Portugal': 'Portugal', 'Italia': 'Italy', 'Francia': 'France',
  'Alemania': 'Germany', 'Reino Unido': 'United Kingdom', 'Paises Bajos': 'Netherlands',
  'Belgica': 'Belgium', 'Polonia': 'Poland', 'Turquia': 'Turkey', 'Rumania': 'Romania',
  'Republica Checa': 'Czech Republic', 'Austria': 'Austria', 'Suiza': 'Switzerland',
  'Suecia': 'Sweden', 'Bulgaria': 'Bulgaria',
}

// NACE codes for textile sector
const TEXTILE_NACE = ['13', '13.1', '13.2', '13.3', '13.9', '14', '14.1', '14.2', '14.3']

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE 1: OpenCorporates — Business registry data (free, no API key)
// Returns: company name, registration number, address, jurisdiction, officers
// ═══════════════════════════════════════════════════════════════════════════════
// OpenCorporates requires API token now — skip gracefully
async function searchOpenCorporates(country, maxResults) {
  const apiToken = process.env.OPENCORPORATES_TOKEN
  if (!apiToken) return [] // No token = skip this source silently

  const jurisdiction = OC_JURISDICTIONS[country]
  if (!jurisdiction) return []

  const searchTerms = ['textile', 'textil', 'fabric']
  const results = []
  const seen = new Set()

  for (const term of searchTerms) {
    if (results.length >= maxResults) break
    try {
      const params = new URLSearchParams({
        q: term, jurisdiction_code: jurisdiction,
        per_page: String(Math.min(30, maxResults)),
        api_token: apiToken,
      })
      const resp = await fetch(`https://api.opencorporates.com/v0.4/companies/search?${params}`)
      if (!resp.ok) continue
      const data = await resp.json()

      for (const item of (data?.results?.companies || [])) {
        if (results.length >= maxResults) break
        const c = item.company || {}
        const name = c.name || ''
        if (!name || seen.has(name.toLowerCase()) || c.inactive || c.dissolution_date) continue
        seen.add(name.toLowerCase())

        const officers = (c.officers || []).map(o => o.officer || {})
        const director = officers.find(o => /director|admin|gerente|ceo|president/i.test(o.position || ''))

        results.push({
          name, source_type: 'OpenCorporates',
          company_number: c.company_number || '',
          address: c.registered_address_in_full || '',
          city: c.registered_address?.locality || '', country,
          jurisdiction: c.jurisdiction_code || jurisdiction,
          incorporation_date: c.incorporation_date || '',
          company_type: c.company_type || '', status: c.current_status || '',
          registry_url: c.opencorporates_url || '',
          director_name: director?.name || '', director_position: director?.position || '',
          phone: '', email: '', website: '', lat: '', lng: '', maps_url: '',
        })
      }
      await new Promise(r => setTimeout(r, 500))
    } catch {}
  }
  return results
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE 2: Europages — European B2B directory
// ═══════════════════════════════════════════════════════════════════════════════
async function searchEuropages(country, maxResults, query = 'textile manufacturer') {
  const countryEn = COUNTRY_NAMES_EN[country] || country
  const results = []
  const searchTerm = encodeURIComponent(query.replace(/\s+/g, '%20'))

  try {
    const url = `https://www.europages.co.uk/companies/${searchTerm}/${countryEn.toLowerCase().replace(/\s+/g, '-')}.html`
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    })
    if (!resp.ok) return []
    const html = await resp.text()

    const seen = new Set()
    // Try structured data first
    const nameMatches = html.match(/data-company-name="([^"]+)"/gi) || []
    for (const match of nameMatches) {
      if (results.length >= maxResults) break
      const name = match.replace(/data-company-name="/, '').replace(/"$/, '').trim()
      if (!name || seen.has(name.toLowerCase())) continue
      seen.add(name.toLowerCase())
      results.push({
        name, source_type: 'Europages',
        company_number: '', address: '', city: '', country,
        jurisdiction: '', incorporation_date: '', company_type: '',
        status: 'active', registry_url: '',
        director_name: '', director_position: '',
        phone: '', email: '', website: '',
        lat: '', lng: '', maps_url: '',
      })
    }

    // Fallback: h3 headings
    if (results.length === 0) {
      const h3s = html.match(/<h[23][^>]*>([^<]{4,80})<\/h[23]>/gi) || []
      for (const h of h3s) {
        if (results.length >= maxResults) break
        const name = h.replace(/<\/?h[23][^>]*>/gi, '').trim()
        if (!name || name.length < 4 || seen.has(name.toLowerCase())) continue
        if (/search|filter|result|page|textile manufacturer|companies/i.test(name)) continue
        seen.add(name.toLowerCase())
        results.push({
          name, source_type: 'Europages',
          company_number: '', address: '', city: '', country,
          jurisdiction: '', incorporation_date: '', company_type: '',
          status: '', registry_url: '',
          director_name: '', director_position: '',
          phone: '', email: '', website: '',
          lat: '', lng: '', maps_url: '',
        })
      }
    }
  } catch {}

  return results
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE 3: OpenStreetMap Overpass (lightweight tag search)
// ═══════════════════════════════════════════════════════════════════════════════
async function searchOverpass(country, maxResults, query = 'textile') {
  const isoCode = COUNTRY_CODES[country] || country
  // Extract keywords from query for OSM tag matching
  const keywords = query.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2)
  const tagPattern = keywords.join('|') || 'textile'
  const q = `[out:json][timeout:25];area["ISO3166-1"="${isoCode}"]->.a;(nwr["craft"~"${tagPattern}"](area.a);nwr["shop"~"${tagPattern}"](area.a);nwr["industrial"~"${tagPattern}"](area.a);nwr["name"~"${tagPattern}",i](area.a);nwr["description"~"${tagPattern}",i](area.a););out center body ${maxResults * 2};`

  const resp = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(q)}`,
  })
  if (!resp.ok) return []
  const data = await resp.json()

  const seen = new Set()
  const results = []
  for (const el of (data.elements || [])) {
    if (results.length >= maxResults) break
    const t = el.tags || {}
    const name = t.name || t['name:es'] || t['name:en'] || t['name:it'] || t['name:de'] || t['name:fr'] || t['name:pt'] || ''
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    const lat = el.lat || el.center?.lat || ''
    const lng = el.lon || el.center?.lon || ''
    results.push({
      name, source_type: 'OpenStreetMap',
      address: [t['addr:street'], t['addr:housenumber'], t['addr:postcode'], t['addr:city']].filter(Boolean).join(', ') || '',
      city: t['addr:city'] || '', country,
      phone: t.phone || t['contact:phone'] || '',
      email: t.email || t['contact:email'] || '',
      website: t.website || t['contact:website'] || '',
      maps_url: lat && lng ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}` : '',
      lat, lng,
    })
  }
  return results
}

// ── SOURCE 4: Nominatim (free-text geocoding search) ──
async function searchNominatim(country, maxResults, query = 'textile') {
  const isoCode = (COUNTRY_CODES[country] || country).toLowerCase()
  // Build search terms from query — add variations
  const baseTerms = [query, `${query} factory`, `${query} manufacturer`, `${query} company`, `${query} supplier`]
  const terms = [...new Set(baseTerms)]
  const seen = new Set()
  const results = []

  for (const term of terms) {
    if (results.length >= maxResults) break
    try {
      const params = new URLSearchParams({
        q: `${term} ${country}`, format: 'json', limit: '10',
        countrycodes: isoCode, addressdetails: '1', extratags: '1',
      })
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { 'User-Agent': 'BlackWolfProspector/1.0' },
      })
      if (!resp.ok) continue
      const places = await resp.json()

      for (const p of places) {
        if (results.length >= maxResults) break
        const name = p.name || p.display_name?.split(',')[0] || ''
        if (!name || seen.has(name.toLowerCase())) continue
        seen.add(name.toLowerCase())
        const extra = p.extratags || {}
        const addr = p.address || {}
        results.push({
          name, source_type: 'Nominatim',
          address: [addr.road, addr.house_number, addr.postcode, addr.city || addr.town || addr.village].filter(Boolean).join(', ') || '',
          city: addr.city || addr.town || addr.village || '', country,
          phone: extra.phone || extra['contact:phone'] || '',
          email: extra.email || extra['contact:email'] || '',
          website: extra.website || extra['contact:website'] || '',
          maps_url: `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=17/${p.lat}/${p.lon}`,
          lat: p.lat, lng: p.lon,
        })
      }
      await new Promise(r => setTimeout(r, 1100))
    } catch { /* skip */ }
  }
  return results
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE 5: Kompass — Global B2B directory
// ═══════════════════════════════════════════════════════════════════════════════
async function searchKompass(country, maxResults, query = 'textile') {
  const countryEn = (COUNTRY_NAMES_EN[country] || country).toLowerCase().replace(/\s+/g, '-')
  const searchTerm = encodeURIComponent(query)
  const results = []

  try {
    // Kompass has country-specific subdomains
    const countryDomains = {
      'spain': 'es', 'portugal': 'pt', 'italy': 'it', 'france': 'fr', 'germany': 'de',
      'united-kingdom': 'gb', 'netherlands': 'nl', 'belgium': 'be', 'poland': 'pl',
      'turkey': 'tr', 'romania': 'ro', 'czech-republic': 'cz', 'austria': 'at',
      'switzerland': 'ch', 'sweden': 'se', 'bulgaria': 'bg',
    }
    const domain = countryDomains[countryEn] || 'com'
    const url = `https://${domain}.kompass.com/searchCompanies?text=${searchTerm}`
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    })
    if (!resp.ok) return []
    const html = await resp.text()

    const seen = new Set()
    // Extract company names from Kompass HTML
    const companyMatches = html.match(/class="[^"]*companyName[^"]*"[^>]*>([^<]{3,80})</gi) || []
    for (const match of companyMatches) {
      if (results.length >= maxResults) break
      const name = match.replace(/.*>/, '').trim()
      if (!name || seen.has(name.toLowerCase())) continue
      seen.add(name.toLowerCase())
      results.push({
        name, source_type: 'Kompass',
        company_number: '', address: '', city: '', country,
        jurisdiction: '', incorporation_date: '', company_type: '',
        status: 'active', registry_url: '',
        director_name: '', director_position: '',
        phone: '', email: '', website: '',
        lat: '', lng: '', maps_url: '',
      })
    }

    // Fallback: title/heading extraction
    if (results.length === 0) {
      const titles = html.match(/<h[23][^>]*class="[^"]*company[^"]*"[^>]*>([^<]{4,80})<\/h[23]>/gi) || []
      for (const t of titles) {
        if (results.length >= maxResults) break
        const name = t.replace(/<[^>]+>/g, '').trim()
        if (!name || name.length < 4 || seen.has(name.toLowerCase())) continue
        if (/search|filter|result|page|companies|kompass/i.test(name)) continue
        seen.add(name.toLowerCase())
        results.push({
          name, source_type: 'Kompass',
          company_number: '', address: '', city: '', country,
          phone: '', email: '', website: '',
          lat: '', lng: '', maps_url: '',
        })
      }
    }
  } catch {}

  return results
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE 6: Google Web Search (via scraping) — fallback for any query
// ═══════════════════════════════════════════════════════════════════════════════
async function searchGoogleWeb(country, maxResults, query = 'textile') {
  const countryEn = COUNTRY_NAMES_EN[country] || country
  const results = []

  try {
    const searchTerms = [
      `${query} companies ${countryEn}`,
      `${query} manufacturers ${countryEn} list`,
    ]

    const seen = new Set()
    for (const term of searchTerms) {
      if (results.length >= maxResults) break
      const url = `https://www.google.com/search?q=${encodeURIComponent(term)}&num=20`
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      })
      if (!resp.ok) continue
      const html = await resp.text()

      // Extract company-like names from search results — titles
      const titleMatches = html.match(/<h3[^>]*>([^<]{5,100})<\/h3>/gi) || []
      for (const match of titleMatches) {
        if (results.length >= maxResults) break
        const raw = match.replace(/<[^>]+>/g, '').trim()
        // Filter out generic results — keep ones that look like company names
        if (!raw || raw.length < 5) continue
        if (/top \d|best \d|list of|wikipedia|how to|what is|guide|review/i.test(raw)) continue
        // Extract the first part before " - " or " | " which is usually the company name
        const name = raw.split(/\s*[-|–—]\s*/)[0].trim()
        if (!name || name.length < 4 || seen.has(name.toLowerCase())) continue
        seen.add(name.toLowerCase())
        results.push({
          name, source_type: 'Google',
          company_number: '', address: '', city: '', country,
          phone: '', email: '', website: '',
          lat: '', lng: '', maps_url: '',
        })
      }
      await new Promise(r => setTimeout(r, 2000)) // Rate limit
    }
  } catch {}

  return results
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMBINED SEARCH — All sources in parallel, deduplicated, merged
// Priority: OpenCorporates (official data) > Europages (B2B) > OSM > Kompass > Google > Nominatim
// ═══════════════════════════════════════════════════════════════════════════════
async function searchBusinesses(country, maxResults = 20, query = 'textile') {
  // Run all sources in parallel with query parameter
  const [ocResults, epResults, osmResults, kpResults, gwResults] = await Promise.all([
    searchOpenCorporates(country, maxResults).catch(() => []),
    searchEuropages(country, Math.ceil(maxResults / 2), query).catch(() => []),
    searchOverpass(country, Math.ceil(maxResults / 2), query).catch(() => []),
    searchKompass(country, Math.ceil(maxResults / 3), query).catch(() => []),
    searchGoogleWeb(country, Math.ceil(maxResults / 3), query).catch(() => []),
  ])

  // Merge with deduplication — OpenCorporates first (best data quality)
  const seen = new Set()
  const all = []

  for (const r of [...ocResults, ...epResults, ...osmResults, ...kpResults, ...gwResults]) {
    if (all.length >= maxResults) break
    const key = r.name.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (!key || seen.has(key)) continue
    seen.add(key)
    all.push(r)
  }

  // Fill with Nominatim if needed
  if (all.length < maxResults) {
    const nomResults = await searchNominatim(country, maxResults - all.length, query).catch(() => [])
    for (const r of nomResults) {
      if (all.length >= maxResults) break
      const key = r.name.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (!key || seen.has(key)) continue
      seen.add(key)
      all.push(r)
    }
  }

  return all
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI ENRICHMENT — Claude finds CEO, LinkedIn, emails, phones, revenue
// ═══════════════════════════════════════════════════════════════════════════════
async function enrichWithAI(companies) {
  if (!companies.length) return []

  const companySummaries = companies.map((c, i) => {
    const parts = [`${i + 1}. "${c.name}" — ${c.country}`]
    if (c.address) parts.push(`Dir: ${c.address}`)
    if (c.website) parts.push(`Web: ${c.website}`)
    if (c.phone) parts.push(`Tel: ${c.phone}`)
    if (c.company_number) parts.push(`Reg: ${c.company_number}`)
    if (c.director_name) parts.push(`Director conocido: ${c.director_name} (${c.director_position || ''})`)
    if (c.incorporation_date) parts.push(`Fundada: ${c.incorporation_date}`)
    if (c.registry_url) parts.push(`Registro: ${c.registry_url}`)
    return parts.join(' | ')
  }).join('\n')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: `Eres un agente de inteligencia comercial B2B de nivel enterprise especializado en el sector textil europeo.

TU MISION: Para cada empresa, debes encontrar/deducir la maxima informacion de contacto posible para que un equipo de ventas pueda contactar al CEO/Director directamente.

REGLAS DE BUSQUEDA:
1. CEO/DIRECTOR: Si se proporciona un director conocido del registro mercantil, usalo. Si no, deduce el nombre mas probable segun el pais y tipo de empresa.

2. LINKEDIN DEL CEO: Genera la URL EXACTA de busqueda en LinkedIn:
   https://www.linkedin.com/search/results/people/?keywords=NOMBRE%20APELLIDO%20EMPRESA&origin=GLOBAL_SEARCH_HEADER

3. LINKEDIN DE LA EMPRESA: Genera la URL probable:
   https://www.linkedin.com/company/nombre-empresa/

4. TELEFONO DEL CEO: Si hay telefono de empresa, usa ese. Si no, genera formato del pais:
   ES: +34 9XX XXX XXX | IT: +39 0XX XXX XXXX | FR: +33 X XX XX XX XX | DE: +49 XXX XXXXXXX | PT: +351 XXX XXX XXX | UK: +44 XXXX XXXXXX | BG: +359 X XXX XXXX

5. TELEFONO EMPRESA: Usa el que venga de los datos o genera uno probable.

6. EMAILS: Genera MULTIPLES emails probables:
   - info@dominio.com, contacto@dominio.com, direccion@dominio.com
   - nombre.apellido@dominio.com (del CEO)
   - Si no hay web: info@nombreempresa.com, contacto@nombreempresa.es (segun pais)

7. FACTURACION ESTIMADA: Basandote en:
   - Tipo de empresa (SL, SA, SRL, GmbH, Ltd, etc.)
   - Fecha de fundacion (mas antigua = mas grande normalmente)
   - Sector especifico (fabricante > distribuidor > tienda)
   - Pais y region
   Estima facturacion anual en euros.

8. SECTOR: Clasifica especificamente: hilatura, tejeduria, confeccion, acabados textiles, fibras sinteticas, fibras naturales, maquinaria textil, distribucion textil, comercio textil

RESPONDE UNICAMENTE con JSON valido, sin texto antes ni despues.`,
    messages: [{
      role: 'user',
      content: `Analiza estas ${companies.length} empresas textiles y proporciona inteligencia comercial completa:

${companySummaries}

JSON array — cada elemento:
[{
  "index": 1,
  "ceo_name": "nombre completo del CEO/Director",
  "ceo_title": "CEO|Director General|Administrador|Gerente",
  "ceo_linkedin": "https://www.linkedin.com/search/results/people/?keywords=...",
  "ceo_phone": "+XX XXX XXX XXX",
  "ceo_email": "nombre@dominio.com",
  "company_linkedin": "https://www.linkedin.com/company/...",
  "company_phone": "+XX XXX XXX XXX",
  "company_emails": ["info@dominio.com", "contacto@dominio.com"],
  "company_website": "https://www.dominio.com",
  "estimated_revenue": "500K-2M EUR",
  "employee_count": "10-50",
  "company_size": "micro|pequena|mediana|grande",
  "sector_specific": "hilatura|tejeduria|confeccion|acabados|fibras|distribucion|comercio",
  "sector_tags": ["textil", "fabricacion", "tag3"],
  "nace_code": "13.XX",
  "commercial_notes": "observacion util para el equipo de ventas"
}]`
    }],
  })

  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('')
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return companies.map(() => ({}))
  try { return JSON.parse(jsonMatch[0]) } catch { return companies.map(() => ({})) }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRM INSERT — Full field mapping (every field in its proper column)
// ═══════════════════════════════════════════════════════════════════════════════
async function insertLeadsIntoCRM(clientId, leads, enrichments, runId, pipelineId) {
  const inserted = []
  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]
    const ai = enrichments[i] || {}

    // Deduplicate — check by company name (normalized) AND by email
    const normalizedName = lead.name.toLowerCase().replace(/[^a-z0-9]/g, '')
    const { data: existByName } = await supabase
      .from('crm_contacts').select('id, company')
      .eq('client_id', clientId).limit(100)
    const isDupByName = (existByName || []).some(c => (c.company || '').toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedName)

    const leadEmail = ai.ceo_email || ai.company_emails?.[0] || lead.email || ''
    let isDupByEmail = false
    if (leadEmail) {
      const { data: existByEmail } = await supabase
        .from('crm_contacts').select('id')
        .eq('client_id', clientId).eq('email', leadEmail).limit(1)
      isDupByEmail = existByEmail && existByEmail.length > 0
    }

    if (isDupByName || isDupByEmail) {
      inserted.push({ name: lead.name, crm_status: 'duplicate', crm_id: null })
      continue
    }

    const contactData = {
      client_id: clientId,
      // ── CEO/Director (persona de contacto) ──
      name: ai.ceo_name && ai.ceo_name !== 'No disponible' ? ai.ceo_name : (lead.director_name || `Director/a — ${lead.name}`),
      position: ai.ceo_title || lead.director_position || 'CEO / Director',
      // ── Empresa ──
      company: lead.name,
      // ── Contacto CEO (campos propios) ──
      email: ai.ceo_email || ai.company_emails?.[0] || lead.email || '',
      phone: ai.ceo_phone || ai.company_phone || lead.phone || '',
      // ── Empresa datos ──
      website: ai.company_website || lead.website || '',
      address: lead.address || '',
      country: lead.country || '',
      linkedin: ai.ceo_linkedin || '',
      // ── Nuevos campos propios (NO en notas) ──
      estimated_revenue: ai.estimated_revenue || '',
      company_linkedin: ai.company_linkedin || '',
      ceo_linkedin: ai.ceo_linkedin || '',
      company_phone: ai.company_phone || lead.phone || '',
      ceo_phone: ai.ceo_phone || '',
      nace_code: ai.nace_code || '',
      employee_count: ai.employee_count || '',
      tmview_data: JSON.stringify(lead.tmview_data || {}),
      // ── CRM metadata ──
      source: 'Agente Prospector',
      pipeline_id: pipelineId || 'd922fa5f-ce79-4787-aa22-09f17f4979a7', // Custom or default Leads Scrap pipeline
      status: 'raw',
      tags: JSON.stringify([
        ...(ai.sector_tags || ['textil']),
        ai.sector_specific || 'textil',
        ai.company_size || '',
        lead.source_type || '',
        'prospector-agent',
      ].filter(Boolean)),
      // ── Notes: SOLO contexto extra, nunca datos de contacto ──
      notes: [
        ai.commercial_notes || '',
        ai.estimated_revenue ? `Facturacion estimada: ${ai.estimated_revenue}` : '',
        ai.employee_count ? `Empleados estimados: ${ai.employee_count}` : '',
        ai.nace_code ? `NACE: ${ai.nace_code}` : '',
        lead.company_number ? `Registro mercantil: ${lead.company_number}` : '',
        lead.incorporation_date ? `Fundada: ${lead.incorporation_date}` : '',
        lead.registry_url ? `Registro: ${lead.registry_url}` : '',
      ].filter(Boolean).join('\n') || '',
      // ── Custom fields: datos estructurados extra ──
      custom_fields: JSON.stringify({
        agent_run_id: runId,
        source_type: lead.source_type || '',
        // CEO
        ceo_name: ai.ceo_name || '',
        ceo_linkedin: ai.ceo_linkedin || '',
        ceo_phone: ai.ceo_phone || '',
        ceo_email: ai.ceo_email || '',
        // Empresa
        company_linkedin: ai.company_linkedin || '',
        company_phone: ai.company_phone || '',
        company_emails: ai.company_emails || [],
        company_website: ai.company_website || '',
        // Registro mercantil
        company_number: lead.company_number || '',
        jurisdiction: lead.jurisdiction || '',
        incorporation_date: lead.incorporation_date || '',
        company_type: lead.company_type || '',
        registry_url: lead.registry_url || '',
        // Sector
        sector_specific: ai.sector_specific || '',
        nace_code: ai.nace_code || '',
        estimated_revenue: ai.estimated_revenue || '',
        employee_count: ai.employee_count || '',
        company_size: ai.company_size || '',
        // Geo
        lat: lead.lat || '', lng: lead.lng || '',
        maps_url: lead.maps_url || '',
      }),
      deal_value: 0,
    }

    const { data: contact, error } = await supabase
      .from('crm_contacts').insert(contactData).select('id').single()

    if (error) {
      inserted.push({ name: lead.name, crm_status: 'error', error: error.message })
    } else {
      // Activity log with full intelligence report
      await supabase.from('crm_activities').insert({
        client_id: clientId, contact_id: contact.id, type: 'note',
        title: `Lead capturado — ${lead.source_type || 'Prospector'}`,
        description: [
          `Empresa: ${lead.name}`,
          `Pais: ${lead.country}`,
          `CEO: ${ai.ceo_name || 'Por identificar'}`,
          `Email CEO: ${ai.ceo_email || 'N/A'}`,
          `LinkedIn CEO: ${ai.ceo_linkedin || 'N/A'}`,
          `LinkedIn Empresa: ${ai.company_linkedin || 'N/A'}`,
          `Tel empresa: ${ai.company_phone || lead.phone || 'N/A'}`,
          `Web: ${ai.company_website || lead.website || 'N/A'}`,
          `Facturacion: ${ai.estimated_revenue || 'N/A'}`,
          `Sector: ${ai.sector_specific || 'textil'}`,
          `Fuente: ${lead.source_type}`,
          lead.registry_url ? `Registro: ${lead.registry_url}` : '',
        ].filter(Boolean).join('\n'),
        performed_by: 'AI Prospector Agent',
      })
      inserted.push({ name: lead.name, crm_status: 'created', crm_id: contact.id })
      await emitEvent(EVENTS.AGENT_LEAD_FOUND, 'prospector', 'lead_created', {
        company: lead.name,
        country: lead.country,
        contactId: contact.id,
        email: ai.ceo_email || ai.company_emails?.[0] || lead.email || '',
        phone: ai.ceo_phone || ai.company_phone || lead.phone || '',
        ceo_name: ai.ceo_name || '',
        ceo_email: ai.ceo_email || '',
        ceo_linkedin: ai.ceo_linkedin || '',
        product: contactData.product || '',
        sector: ai.sector_specific || '',
        estimated_revenue: ai.estimated_revenue || '',
      }, { clientId, contactId: contact.id, agentRunId: runId })
    }
  }
  return inserted
}

// ── Run tracking helpers ──
async function createRun(clientId, config) {
  const { data, error } = await supabase.from('agent_runs').insert({
    client_id: clientId, agent_type: 'prospector', status: 'running', config,
    logs: JSON.stringify([{ time: new Date().toISOString(), type: 'info', msg: 'Iniciando busqueda en registros mercantiles, directorios B2B y mapas...' }]),
  }).select('id').single()
  if (error) throw new Error('Failed to create run: ' + error.message)
  return data.id
}

async function updateRun(runId, updates) {
  await supabase.from('agent_runs').update(updates).eq('id', runId)
}

async function appendLog(runId, log) {
  const { data } = await supabase.from('agent_runs').select('logs').eq('id', runId).single()
  const logs = JSON.parse(data?.logs || '[]')
  logs.push({ time: new Date().toISOString(), ...log })
  await supabase.from('agent_runs').update({ logs: JSON.stringify(logs) }).eq('id', runId)
}

// ── Prospector request handler ──
async function handleProspector(req, res) {
  const { action, clientSlug, config } = req.body
  const clientId = await resolveClientId(clientSlug || 'black-wolf')
  if (!clientId) return res.status(400).json({ error: 'Client not found' })

  try {
    switch (action) {
      case 'search': {
        const { query = 'fabricas textiles', countries = ['Espana', 'Portugal', 'Italia', 'Francia', 'Alemania'], maxPerCountry = 10, pipeline_id } = config || {}
        // Limit to 3 countries per run to stay within 300s Vercel timeout
        const limitedCountries = countries.slice(0, 3)
        const runId = await createRun(clientId, { query, countries: limitedCountries, maxPerCountry, pipeline_id })
        await emitEvent(EVENTS.AGENT_STARTED, 'prospector', 'search', { query, countries: limitedCountries, maxPerCountry, runId }, { clientId, agentRunId: runId })
        let allLeads = [], allEnrichments = []

        // Pre-load existing company names for fast dedup
        const { data: existingContacts } = await supabase.from('crm_contacts').select('company, email').eq('client_id', clientId)
        const existingNames = new Set((existingContacts || []).map(c => (c.company || '').toLowerCase().replace(/[^a-z0-9]/g, '')).filter(Boolean))
        const existingEmails = new Set((existingContacts || []).map(c => (c.email || '').toLowerCase()).filter(Boolean))

        if (countries.length > 3) {
          await appendLog(runId, { type: 'warning', msg: `Limitado a 3 paises por run (${limitedCountries.join(', ')}). Lanza otro run para los restantes.` })
        }

        for (let ci = 0; ci < limitedCountries.length; ci++) {
          const country = limitedCountries[ci]
          if (ci > 0) await new Promise(r => setTimeout(r, 1000))

          let attempt = 0
          let newFromCountry = 0
          const maxAttempts = 3 // Try up to 3 rounds per country to fill quota

          while (newFromCountry < maxPerCountry && attempt < maxAttempts) {
            attempt++
            const searchSize = Math.max(maxPerCountry * 2, (maxPerCountry - newFromCountry) * 3) // Search more to compensate duplicates

            await appendLog(runId, { type: 'info', msg: `[${ci + 1}/${countries.length}] ${country} — ronda ${attempt}: buscando ${searchSize} empresas...` })
            try {
              const places = await searchBusinesses(country, searchSize, query)

              // Pre-filter duplicates before AI enrichment (save API calls)
              const newPlaces = places.filter(p => {
                const norm = p.name.toLowerCase().replace(/[^a-z0-9]/g, '')
                if (existingNames.has(norm)) return false
                if (p.email && existingEmails.has(p.email.toLowerCase())) return false
                return true
              })

              await appendLog(runId, { type: 'success', msg: `${places.length} encontradas, ${newPlaces.length} nuevas (${places.length - newPlaces.length} duplicados filtrados)` })

              if (newPlaces.length > 0) {
                const batch = newPlaces.slice(0, maxPerCountry - newFromCountry)
                await appendLog(runId, { type: 'info', msg: `Enriqueciendo ${batch.length} empresas nuevas con IA...` })
                const enrichments = await enrichWithAI(batch)
                await appendLog(runId, { type: 'success', msg: `IA completada para ${country} (ronda ${attempt})` })
                allLeads.push(...batch)
                allEnrichments.push(...enrichments)
                newFromCountry += batch.length
                // Track new names to avoid within same run
                for (const p of batch) existingNames.add(p.name.toLowerCase().replace(/[^a-z0-9]/g, ''))
              }

              if (newPlaces.length === 0) break // No new results, stop
            } catch (err) {
              await appendLog(runId, { type: 'error', msg: `Error en ${country} ronda ${attempt}: ${err.message}` })
              break
            }
          }
          await appendLog(runId, { type: 'info', msg: `${country}: ${newFromCountry} leads nuevos encontrados en ${attempt} rondas` })
        }

        await appendLog(runId, { type: 'info', msg: `Insertando ${allLeads.length} leads en CRM BlackWolf...` })
        const results = await insertLeadsIntoCRM(clientId, allLeads, allEnrichments, runId, pipeline_id)
        const created = results.filter(r => r.crm_status === 'created').length
        const duplicates = results.filter(r => r.crm_status === 'duplicate').length
        const errors = results.filter(r => r.crm_status === 'error').length

        await appendLog(runId, { type: 'success', msg: `Scraping completado: ${created} nuevos, ${duplicates} duplicados, ${errors} errores` })

        // ── AUTO-PERSONALIZE + GROUP + SEND ──
        const newLeads = results.filter(r => r.crm_status === 'created' && r.crm_id)
        if (newLeads.length > 0) {
          await appendLog(runId, { type: 'info', msg: `Agrupando ${newLeads.length} leads por país/sector, creando emails y enviando...` })

          // Step 1: Load all new contacts and group by country+sector
          const groups = {}
          for (const lead of newLeads) {
            const { data: contact } = await supabase.from('crm_contacts').select('*').eq('id', lead.crm_id).single()
            if (!contact) continue
            const enrichData = typeof contact.enrichment_data === 'string' ? JSON.parse(contact.enrichment_data || '{}') : (contact.enrichment_data || {})
            const sector = (enrichData.sector || enrichData.sector_specific || 'manufactura').replace(/[/\\]/g, '-')
            const country = contact.country || 'Internacional'
            const groupKey = `${country}___${sector}`
            if (!groups[groupKey]) groups[groupKey] = { country, sector, contacts: [] }
            groups[groupKey].contacts.push({ contact, enrichData, leadName: lead.name })
          }

          await appendLog(runId, { type: 'info', msg: `${Object.keys(groups).length} grupos detectados (por país + sector)` })

          // Step 2: For each group, create ONE template + list, add all contacts, send emails
          const { data: emailConfig } = await supabase.from('email_config').select('*').eq('client_id', clientId).limit(1).single()
          let totalSent = 0, totalFailed = 0

          for (const [groupKey, group] of Object.entries(groups)) {
            try {
              // Find/create list
              const listName = `Prospector - ${group.country} - ${group.sector}`
              let { data: existingLists } = await supabase.from('email_lists').select('*').eq('client_id', clientId).eq('name', listName)
              let list = existingLists && existingLists[0]
              if (!list) {
                const { data: newList } = await supabase.from('email_lists').insert({
                  client_id: clientId, name: listName,
                  description: `Leads del prospector - ${group.country} - ${group.sector} (${group.contacts.length} empresas)`
                }).select().single()
                list = newList
              }

              // Generate ONE template for this group using Claude
              const companyNames = group.contacts.map(c => c.contact.company || c.contact.name).slice(0, 5).join(', ')
              const templatePrompt = `Write a cold email template in ${detectLang(group.country)} for a GROUP of ${group.contacts.length} companies in the ${group.sector} sector in ${group.country}.

Example companies in this group: ${companyNames}

WE ARE BlackWolf Security (web.blackwolfsec.io) offering:
1. Custom ERP system built for their industry
2. Cybersecurity (SOC, pentesting, compliance)
3. Process automation (AI agents, workflow optimization)
4. Complete digital transformation

OFFER: €10,000 package — process mapping, ERP, cybersecurity audit, automation, 3 months support.

The email must:
- Use {{name}} for the recipient name and {{company}} for company name (these will be replaced per recipient)
- Be 150-200 words, consultative tone
- Mention we work with ${group.sector} companies in ${group.country}
- Reference EU digitalization grants 2026
- Include link to web.blackwolfsec.io
- CTA: a visible button "Agendar llamada" / "Schedule a call" / "Запазете обаждане" (in their language) that links to https://web.blackwolfsec.io
- ALL links and buttons in the email MUST point to https://web.blackwolfsec.io
- Professional HTML with inline styles, dark design (#0A0A0A bg, #FF6B00 accent)
- The CTA button must be styled: background #FF6B00, color white, padding 14px 32px, border-radius 8px, font-weight bold, text-decoration none

Return ONLY JSON: {"subject":"...","html":"..."}`

              let emailTemplate = { subject: `Transformación digital para ${group.sector} en ${group.country}`, html: `<p>Estimado/a {{name}},</p><p>Desde BlackWolf Security ayudamos a empresas como {{company}} con su digitalización.</p><p><a href="https://web.blackwolfsec.io" style="background:#FF6B00;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Agendar llamada</a></p>` }
              try {
                const aiRes = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, messages: [{ role: 'user', content: templatePrompt }] })
                const text = aiRes.content[0]?.text || ''
                const jsonMatch = text.match(/\{[\s\S]*\}/)
                if (jsonMatch) emailTemplate = JSON.parse(jsonMatch[0])
              } catch (e) { /* use fallback */ }

              // Save template
              const templateName = `Prospector - ${group.country} - ${group.sector}`
              const { data: tpl } = await supabase.from('email_templates').insert({
                client_id: clientId, name: templateName, subject: emailTemplate.subject,
                html_content: emailTemplate.html, category: 'prospector-outreach'
              }).select().single()

              await appendLog(runId, { type: 'success', msg: `Plantilla creada: "${templateName}" → lista "${listName}" (${group.contacts.length} empresas)` })

              // Step 3: Add subscribers + send individual emails
              for (const { contact, enrichData } of group.contacts) {
                const subEmail = contact.owner_email || contact.email || enrichData.ownerEmail || enrichData.companyEmail
                if (!subEmail) { await supabase.from('crm_contacts').update({ status: 'ready' }).eq('id', contact.id); continue }

                // Add to list
                const { data: existSub } = await supabase.from('email_subscribers').select('id').eq('email', subEmail).eq('list_id', list.id).limit(1)
                if (!existSub || existSub.length === 0) {
                  await supabase.from('email_subscribers').insert({
                    client_id: clientId, list_id: list.id, email: subEmail,
                    name: enrichData.ownerName || contact.owner_name || contact.name || '', status: 'subscribed'
                  })
                }

                // Send email via Resend if config exists
                if (emailConfig && emailConfig.api_key) {
                  const ownerName = enrichData.ownerName || contact.owner_name || contact.name || 'Director/a'
                  const companyName = contact.company || contact.name || ''
                  const personalizedHtml = (emailTemplate.html || '')
                    .replace(/\{\{name\}\}/g, ownerName)
                    .replace(/\{\{company\}\}/g, companyName)
                  const personalizedSubject = (emailTemplate.subject || '')
                    .replace(/\{\{name\}\}/g, ownerName)
                    .replace(/\{\{company\}\}/g, companyName)

                  try {
                    const fromEmail = emailConfig.from_email || 'onboarding@resend.dev'
                    const fromName = emailConfig.from_name || 'BlackWolf Security'
                    const sendRes = await fetch('https://api.resend.com/emails', {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${emailConfig.api_key}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to: [subEmail], subject: personalizedSubject, html: personalizedHtml })
                    })
                    if (sendRes.ok) {
                      totalSent++
                      await supabase.from('crm_contacts').update({ status: 'sent', pipeline_id: SCRAP_PIPELINE_ID }).eq('id', contact.id)
                      await emitEvent(EVENTS.AGENT_EMAIL_SENT, 'prospector', 'email_sent', { to: subEmail, company: contact.company, subject: personalizedSubject }, { clientId, contactId: contact.id, agentRunId: runId })
                    } else {
                      totalFailed++
                      const err = await sendRes.json()
                      await supabase.from('crm_contacts').update({ status: 'ready' }).eq('id', contact.id)
                      if (totalFailed === 1) await appendLog(runId, { type: 'warning', msg: `Error enviando a ${subEmail}: ${err.message || JSON.stringify(err)}` })
                    }
                  } catch (e) {
                    totalFailed++
                    await supabase.from('crm_contacts').update({ status: 'ready' }).eq('id', contact.id)
                  }
                } else {
                  // No email config — just mark as ready
                  await supabase.from('crm_contacts').update({ status: 'ready' }).eq('id', contact.id)
                }
              }

              await appendLog(runId, { type: 'success', msg: `Lista "${listName}": ${group.contacts.length} leads añadidos` })
            } catch (e) {
              await appendLog(runId, { type: 'warning', msg: `Error en grupo ${group.country}/${group.sector}: ${e.message}` })
            }
          }

          const emailStatus = emailConfig?.api_key ? `${totalSent} emails enviados, ${totalFailed} fallidos` : 'Sin config Resend — emails no enviados'
          await appendLog(runId, { type: 'success', msg: `Personalizacion completada: ${Object.keys(groups).length} listas, ${newLeads.length} leads procesados. ${emailStatus}` })
        }

        // Sync new leads to Enjambre for follow-up sequences
        const ENJAMBRE_URL = process.env.ENJAMBRE_WEBHOOK_URL || 'https://api-enjambre.blackwolfsec.io/api/webhooks/central'
        let enjambreSynced = 0
        for (const lead of newLeads) {
          try {
            const { data: contact } = await supabase.from('crm_contacts').select('*').eq('id', lead.crm_id).single()
            if (!contact || !contact.email) continue
            const cf = typeof contact.custom_fields === 'string' ? JSON.parse(contact.custom_fields || '{}') : (contact.custom_fields || {})
            await fetch(ENJAMBRE_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event: 'agent.lead_found', source: 'prospector', action: 'lead_created',
                data: { contactId: contact.id, company: contact.company, country: contact.country, email: contact.email, phone: contact.phone || '', ceo_name: cf.ceo_name || contact.name, ceo_email: cf.ceo_email || contact.email, product: contact.product || '', sector: cf.sector_specific || '' },
                client_id: clientId, contact_id: contact.id,
              }),
              signal: AbortSignal.timeout(5000),
            })
            enjambreSynced++
          } catch { /* non-blocking */ }
        }
        if (enjambreSynced > 0) await appendLog(runId, { type: 'info', msg: `Enjambre: ${enjambreSynced} leads sincronizados para follow-up automático` })

        await updateRun(runId, {
          status: 'completed',
          results_summary: JSON.stringify({ total_found: allLeads.length, created, duplicates, errors, personalized: newLeads.length, countries_searched: limitedCountries, enjambre_synced: enjambreSynced }),
          completed_at: new Date().toISOString(),
        })
        return res.status(200).json({ runId, total: allLeads.length, created, duplicates, errors, personalized: newLeads.length, enjambre_synced: enjambreSynced, leads: results })
      }

      case 'enrich': {
        const { data: leads } = await supabase.from('crm_contacts').select('*')
          .eq('client_id', clientId).eq('source', 'Agente Prospector').ilike('name', '%Director%').limit(config?.limit || 50)
        if (!leads || leads.length === 0) return res.status(200).json({ message: 'No leads to enrich', count: 0 })

        const companies = leads.map(l => ({
          name: l.company, address: l.address || '', country: l.country || '', website: l.website || '',
        }))
        const enrichments = await enrichWithAI(companies)
        let updated = 0
        for (let i = 0; i < leads.length; i++) {
          const e = enrichments[i]
          if (!e || !e.estimated_ceo || e.estimated_ceo === 'No disponible') continue
          await supabase.from('crm_contacts').update({
            name: e.estimated_ceo,
            position: e.ceo_title || leads[i].position,
            email: e.contact_emails?.[0] || leads[i].email,
            phone: e.phone_guess || leads[i].phone,
            website: e.website_guess || leads[i].website,
            linkedin: e.linkedin_search_url || leads[i].linkedin,
          }).eq('id', leads[i].id)
          updated++
        }
        return res.status(200).json({ message: `${updated} leads enriched`, count: updated })
      }

      case 'tmview-parse': {
        // User pastes TMview page content → Claude extracts companies → insert into CRM
        const { pastedText, countries: tmCountries } = config || {}
        if (!pastedText || pastedText.length < 20) {
          return res.status(400).json({ error: 'Pega el contenido de TMview (minimo 20 caracteres)' })
        }

        const parseResponse = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 8192,
          system: `Eres un experto en datos de registros de marcas y propiedad industrial. El usuario ha copiado contenido de la web TMview (TMDN) que contiene informacion de marcas registradas del sector textil.

Tu trabajo: extraer TODAS las empresas/titulares de marcas que aparezcan en el texto pegado.

Para cada empresa extrae:
- Nombre del titular/solicitante de la marca (esto es la EMPRESA)
- Direccion completa
- Pais
- Nombre de la marca registrada
- Clase de Niza (24=textiles, 25=ropa, etc.)
- Estado de la marca
- Representante legal (si aparece)
- Numero de solicitud

IMPORTANTE: Los titulares de marcas textiles son las FABRICAS y EMPRESAS que buscamos como leads.
Responde SOLO con JSON valido.`,
          messages: [{
            role: 'user',
            content: `Contenido pegado de TMview:\n\n${pastedText.slice(0, 15000)}\n\nExtrae todas las empresas/titulares en JSON array:
[{
  "company_name": "nombre de la empresa titular",
  "trademark_name": "nombre de la marca",
  "address": "direccion completa",
  "country": "pais",
  "nice_classes": ["24", "25"],
  "status": "Registered|Filed|Expired",
  "representative": "representante legal si aparece",
  "application_number": "numero de solicitud",
  "applicant_type": "empresa|persona fisica"
}]`
          }],
        })

        const parseText = parseResponse.content.filter(b => b.type === 'text').map(b => b.text).join('')
        const parseMatch = parseText.match(/\[[\s\S]*\]/)
        let tmCompanies = []
        try { tmCompanies = JSON.parse(parseMatch[0]) } catch { return res.status(400).json({ error: 'No se pudieron extraer empresas del texto pegado' }) }

        if (tmCompanies.length === 0) {
          return res.status(200).json({ message: 'No se encontraron empresas en el texto', count: 0 })
        }

        // Prepare as leads for enrichment
        const tmLeads = tmCompanies.map(c => ({
          name: c.company_name,
          source_type: 'TMview',
          address: c.address || '',
          city: '', country: c.country || '',
          company_number: c.application_number || '',
          jurisdiction: '', incorporation_date: '',
          company_type: c.applicant_type || '',
          status: c.status || '',
          registry_url: 'https://www.tmdn.org/tmview/',
          director_name: c.representative || '',
          director_position: c.representative ? 'Representante Legal' : '',
          phone: '', email: '', website: '',
          lat: '', lng: '', maps_url: '',
          tmview_data: {
            trademark_name: c.trademark_name || '',
            nice_classes: c.nice_classes || [],
            application_number: c.application_number || '',
            representative: c.representative || '',
            status: c.status || '',
          },
        }))

        // Enrich with AI
        const tmEnrichments = await enrichWithAI(tmLeads)

        // Insert into CRM
        const tmResults = await insertLeadsIntoCRM(clientId, tmLeads, tmEnrichments, 'tmview-manual')
        const tmCreated = tmResults.filter(r => r.crm_status === 'created').length
        const tmDups = tmResults.filter(r => r.crm_status === 'duplicate').length

        return res.status(200).json({
          message: `TMview: ${tmCompanies.length} empresas extraidas, ${tmCreated} leads creados, ${tmDups} duplicados`,
          extracted: tmCompanies.length,
          created: tmCreated,
          duplicates: tmDups,
          companies: tmCompanies.map(c => c.company_name),
        })
      }

      case 'tmview-urls': {
        // Generate TMview search URLs for given countries
        const { countries: urlCountries } = config || {}
        const officeMap = {
          'Espana': 'ES', 'Portugal': 'PT', 'Italia': 'IT', 'Francia': 'FR', 'Alemania': 'DE',
          'Reino Unido': 'GB', 'Paises Bajos': 'NL', 'Belgica': 'BE', 'Polonia': 'PL', 'Turquia': 'TR',
          'Rumania': 'RO', 'Republica Checa': 'CZ', 'Austria': 'AT', 'Suiza': 'CH', 'Suecia': 'SE', 'Bulgaria': 'BG',
        }
        const urls = (urlCountries || []).map(c => ({
          country: c,
          url: `https://www.tmdn.org/tmview/#/tmview/results?page=1&pageSize=30&criteria=C&basicSearch=textile&offices=${officeMap[c] || c}&niceClass=24,25`,
          instructions: `Busca marcas textiles en ${c} (clases 24-25)`,
        }))
        return res.status(200).json({ urls })
      }

      case 'status': {
        const { runId } = config || {}
        if (!runId) return res.status(400).json({ error: 'runId required' })
        const { data: run } = await supabase.from('agent_runs').select('*').eq('id', runId).single()
        if (!run) return res.status(404).json({ error: 'Run not found' })
        return res.status(200).json({
          ...run, logs: JSON.parse(run.logs || '[]'),
          results_summary: run.results_summary ? JSON.parse(run.results_summary) : null,
          config: run.config ? (typeof run.config === 'string' ? JSON.parse(run.config) : run.config) : null,
        })
      }

      case 'history': {
        const { data: runs } = await supabase.from('agent_runs')
          .select('id, agent_type, status, results_summary, created_at, completed_at')
          .eq('client_id', clientId).eq('agent_type', 'prospector')
          .order('created_at', { ascending: false }).limit(20)
        return res.status(200).json({
          runs: (runs || []).map(r => ({ ...r, results_summary: r.results_summary ? JSON.parse(r.results_summary) : null })),
        })
      }

      case 'list-pipelines': {
        const { data: pipelines } = await supabase.from('crm_pipelines')
          .select('id, name, stages, is_default')
          .eq('client_id', clientId)
          .order('name', { ascending: true })
        return res.status(200).json({ pipelines: pipelines || [] })
      }

      default:
        return res.status(400).json({ error: 'Invalid action' })
    }
  } catch (error) {
    console.error('Prospector error:', error)
    return res.status(500).json({ error: error.message })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS AGENT — Claude-powered dashboard analysis
// ═══════════════════════════════════════════════════════════════════════════════

function buildSystemPrompt(clientName, productList) {
  const productsSection = productList.length > 0
    ? `\nPRODUCTOS DE ${clientName.toUpperCase()}:\n${productList.map(p => `- ${p.name} (€${p.price || 0})${p.active ? '' : ' [INACTIVO]'}`).join('\n')}`
    : ''

  return `Eres el Director de Analítica de ${clientName}. Tienes acceso COMPLETO a todos los datos del dashboard de ${clientName}: ventas, reportes del equipo, proyecciones, comisiones y métodos de pago. Tu trabajo es dar análisis profundos, detectar patrones y recomendar acciones.

═══ CONTEXTO DEL NEGOCIO ═══

La estructura del equipo:

ROLES:
- **Director**: visión global, acceso total
- **Manager**: gestiona closers y setters
- **Closer**: cierra ventas por teléfono. Métricas clave: llamadas agendadas, realizadas, ofertas, depósitos, cierres
- **Setter**: genera agendas desde DMs/redes. Métricas clave: conversaciones, follow ups, ofertas lanzadas, agendas
${productsSection}
MÉTRICAS FINANCIERAS:
- **Revenue**: valor total del contrato firmado (lo que el cliente se compromete a pagar)
- **Cash Collected (bruto)**: dinero efectivamente cobrado
- **Cash Neto**: cash collected MENOS comisiones de pasarela de pago (Stripe, PayPal, etc.)
- **Revenue Pendiente**: revenue - cash collected (lo que falta por cobrar)

VENTAS:
- Pueden ser "Pago único" o en "Cuotas" (2, 3, 6 cuotas, etc.)
- Cada cuota es un registro independiente con su installment_number
- Estados: Completada, Pendiente, Reembolso
- Se atribuyen a un closer (quien cierra) y opcionalmente un setter (quien agendó)

REPORTES DIARIOS:
- Setters reportan: conversaciones abiertas, follow ups, ofertas lanzadas, agendas conseguidas
- Closers reportan: llamadas agendadas, llamadas realizadas, ofertas lanzadas, depósitos, cierres
- Ratios setters: Booking Rate = agendas/conversaciones, Offer Rate = ofertas/conversaciones
- Ratios closers: Show Rate = realizadas/agendadas, Close Rate = cierres/realizadas

PROYECCIONES:
- Pueden ser por empresa (global), por closer (cash target) o por setter (agendas target)
- Se configuran mensual o semanalmente
- El % de cumplimiento = actual/target * 100

COMISIONES:
- Cada miembro del equipo tiene una tasa de comisión (commission_rate)
- Closers cobran comisión sobre SU cash neto personal
- Otros roles cobran comisión sobre el cash neto TOTAL del equipo
- Comisión = cash_base × commission_rate

MÉTODOS DE PAGO:
- Cada método (Stripe, PayPal, Transferencia, etc.) tiene una fee_rate
- La fee se resta del cash collected para obtener el cash neto

═══ INSTRUCCIONES ═══

1. Responde SIEMPRE en español
2. Sé directo y usa datos específicos con números concretos
3. Cuando analices rendimiento individual, SIEMPRE compara con el promedio del equipo
4. Calcula ratios y porcentajes cuando sean relevantes
5. Si detectas anomalías o tendencias negativas, sugiere acciones concretas
6. Usa formato markdown: títulos ##, negritas **, listas -, tablas si son útiles
7. Si no hay datos suficientes, dilo claramente y sugiere qué información haría falta
8. Puedes cruzar datos entre secciones (ej: correlacionar reportes de setters con ventas de closers)
9. Para preguntas de proyecciones, calcula el pace actual y si se alcanzará el target
10. Sé proactivo: si ves algo interesante en los datos relacionado con la pregunta, menciónalo`
}

// ─── Fetch dashboard data FILTERED by clientId ───
async function fetchClientData(clientId) {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const firstOfMonth = `${currentMonth}-01`
  const today = now.toISOString().split('T')[0]

  // Previous month
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  const prevFirstOfMonth = `${prevMonth}-01`
  const prevLastOfMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

  // Fetch everything in parallel — ALL filtered by client_id
  const [
    currentSalesResult,
    prevSalesResult,
    allSalesResult,
    currentReportsResult,
    prevReportsResult,
    teamResult,
    projectionsResult,
    feesResult,
    productsResult,
  ] = await Promise.all([
    supabase.from('sales_with_net_cash').select('*')
      .eq('client_id', clientId)
      .gte('date', firstOfMonth).order('date', { ascending: false }),
    supabase.from('sales_with_net_cash').select('*')
      .eq('client_id', clientId)
      .gte('date', prevFirstOfMonth).lte('date', prevLastOfMonth)
      .order('date', { ascending: false }),
    supabase.from('sales_with_net_cash').select('*')
      .eq('client_id', clientId)
      .order('date', { ascending: false }).limit(200),
    supabase.from('reports').select('*')
      .eq('client_id', clientId)
      .gte('date', firstOfMonth).order('date', { ascending: false }),
    supabase.from('reports').select('*')
      .eq('client_id', clientId)
      .gte('date', prevFirstOfMonth).lte('date', prevLastOfMonth)
      .order('date', { ascending: false }),
    supabase.from('team').select('*')
      .eq('client_id', clientId).order('name'),
    supabase.from('projections').select('*')
      .eq('client_id', clientId)
      .order('period', { ascending: false }).limit(50),
    supabase.from('payment_fees').select('*')
      .eq('client_id', clientId).order('method'),
    supabase.from('products').select('*')
      .eq('client_id', clientId).order('name'),
  ])

  const currentSales = currentSalesResult.data || []
  const prevSales = prevSalesResult.data || []
  const allSales = allSalesResult.data || []
  const currentReports = currentReportsResult.data || []
  const prevReports = prevReportsResult.data || []
  const team = teamResult.data || []
  const projections = projectionsResult.data || []
  const fees = feesResult.data || []
  const products = productsResult.data || []

  // ─── SALES SUMMARIES ───
  function summarizeSales(sales, label) {
    const totalRevenue = sales.reduce((s, v) => s + (Number(v.revenue) || 0), 0)
    const totalCash = sales.reduce((s, v) => s + (Number(v.net_cash) || 0), 0)
    const totalGross = sales.reduce((s, v) => s + (Number(v.cash_collected) || 0), 0)
    const count = sales.length

    const byCloser = {}
    for (const s of sales) {
      const c = s.closer || 'Sin closer'
      if (!byCloser[c]) byCloser[c] = { ventas: 0, revenue: 0, cashNeto: 0 }
      byCloser[c].ventas++
      byCloser[c].revenue += Number(s.revenue) || 0
      byCloser[c].cashNeto += Number(s.net_cash) || 0
    }

    const bySetter = {}
    for (const s of sales) {
      const st = s.setter || 'Sin setter'
      if (!bySetter[st]) bySetter[st] = { ventas: 0, revenue: 0, cashNeto: 0 }
      bySetter[st].ventas++
      bySetter[st].revenue += Number(s.revenue) || 0
      bySetter[st].cashNeto += Number(s.net_cash) || 0
    }

    const byProduct = {}
    for (const s of sales) {
      const p = s.product || 'Sin producto'
      if (!byProduct[p]) byProduct[p] = { ventas: 0, revenue: 0, cashNeto: 0 }
      byProduct[p].ventas++
      byProduct[p].revenue += Number(s.revenue) || 0
      byProduct[p].cashNeto += Number(s.net_cash) || 0
    }

    const byStatus = {}
    for (const s of sales) {
      byStatus[s.status] = (byStatus[s.status] || 0) + 1
    }

    const byMethod = {}
    for (const s of sales) {
      const m = s.payment_method || 'Desconocido'
      if (!byMethod[m]) byMethod[m] = { ventas: 0, cashBruto: 0 }
      byMethod[m].ventas++
      byMethod[m].cashBruto += Number(s.cash_collected) || 0
    }

    const byPayType = {}
    for (const s of sales) {
      const t = s.payment_type || 'Pago único'
      if (!byPayType[t]) byPayType[t] = { ventas: 0, revenue: 0 }
      byPayType[t].ventas++
      byPayType[t].revenue += Number(s.revenue) || 0
    }

    const byCountry = {}
    for (const s of sales) {
      const p = s.pais || 'Sin país'
      if (!byCountry[p]) byCountry[p] = { ventas: 0, revenue: 0 }
      byCountry[p].ventas++
      byCountry[p].revenue += Number(s.revenue) || 0
    }

    const byUtm = {}
    for (const s of sales) {
      const u = s.utm_source || 'Directo'
      if (!byUtm[u]) byUtm[u] = { ventas: 0, revenue: 0 }
      byUtm[u].ventas++
      byUtm[u].revenue += Number(s.revenue) || 0
    }

    const byDay = {}
    for (const s of sales) {
      if (!byDay[s.date]) byDay[s.date] = { revenue: 0, cashNeto: 0, ventas: 0 }
      byDay[s.date].revenue += Number(s.revenue) || 0
      byDay[s.date].cashNeto += Number(s.net_cash) || 0
      byDay[s.date].ventas++
    }

    return {
      periodo: label,
      totalVentas: count,
      revenue: totalRevenue,
      cashNeto: totalCash,
      cashBruto: totalGross,
      revenuePendiente: totalRevenue - totalGross,
      ticketMedio: count > 0 ? Math.round(totalRevenue / count) : 0,
      porCloser: byCloser,
      porSetter: bySetter,
      porProducto: byProduct,
      estadoVentas: byStatus,
      porMetodoPago: byMethod,
      porTipoPago: byPayType,
      porPais: byCountry,
      porUtmSource: byUtm,
      porDia: byDay,
    }
  }

  // ─── REPORTS SUMMARIES ───
  function summarizeReports(reports, label) {
    const setterReports = reports.filter(r => r.role === 'setter')
    const closerReports = reports.filter(r => r.role === 'closer')

    const setterTotals = {
      conversaciones: setterReports.reduce((s, r) => s + (r.conversations_opened || 0), 0),
      followUps: setterReports.reduce((s, r) => s + (r.follow_ups || 0), 0),
      ofertas: setterReports.reduce((s, r) => s + (r.offers_launched || 0), 0),
      agendas: setterReports.reduce((s, r) => s + (r.appointments_booked || 0), 0),
    }
    setterTotals.bookingRate = setterTotals.conversaciones > 0
      ? Math.round(setterTotals.agendas / setterTotals.conversaciones * 100) : 0
    setterTotals.offerRate = setterTotals.conversaciones > 0
      ? Math.round(setterTotals.ofertas / setterTotals.conversaciones * 100) : 0

    const closerTotals = {
      agendadas: closerReports.reduce((s, r) => s + (r.scheduled_calls || 0), 0),
      realizadas: closerReports.reduce((s, r) => s + (r.calls_made || 0), 0),
      ofertas: closerReports.reduce((s, r) => s + (r.offers_launched || 0), 0),
      depositos: closerReports.reduce((s, r) => s + (r.deposits || 0), 0),
      cierres: closerReports.reduce((s, r) => s + (r.closes || 0), 0),
    }
    closerTotals.showRate = closerTotals.agendadas > 0
      ? Math.round(closerTotals.realizadas / closerTotals.agendadas * 100) : 0
    closerTotals.closeRate = closerTotals.realizadas > 0
      ? Math.round(closerTotals.cierres / closerTotals.realizadas * 100) : 0

    const setterByPerson = {}
    for (const r of setterReports) {
      if (!setterByPerson[r.name]) setterByPerson[r.name] = { conversaciones: 0, followUps: 0, ofertas: 0, agendas: 0, dias: 0 }
      setterByPerson[r.name].conversaciones += r.conversations_opened || 0
      setterByPerson[r.name].followUps += r.follow_ups || 0
      setterByPerson[r.name].ofertas += r.offers_launched || 0
      setterByPerson[r.name].agendas += r.appointments_booked || 0
      setterByPerson[r.name].dias++
    }
    for (const name of Object.keys(setterByPerson)) {
      const p = setterByPerson[name]
      p.bookingRate = p.conversaciones > 0 ? Math.round(p.agendas / p.conversaciones * 100) : 0
      p.offerRate = p.conversaciones > 0 ? Math.round(p.ofertas / p.conversaciones * 100) : 0
    }

    const closerByPerson = {}
    for (const r of closerReports) {
      if (!closerByPerson[r.name]) closerByPerson[r.name] = { agendadas: 0, realizadas: 0, ofertas: 0, depositos: 0, cierres: 0, dias: 0 }
      closerByPerson[r.name].agendadas += r.scheduled_calls || 0
      closerByPerson[r.name].realizadas += r.calls_made || 0
      closerByPerson[r.name].ofertas += r.offers_launched || 0
      closerByPerson[r.name].depositos += r.deposits || 0
      closerByPerson[r.name].cierres += r.closes || 0
      closerByPerson[r.name].dias++
    }
    for (const name of Object.keys(closerByPerson)) {
      const p = closerByPerson[name]
      p.showRate = p.agendadas > 0 ? Math.round(p.realizadas / p.agendadas * 100) : 0
      p.closeRate = p.realizadas > 0 ? Math.round(p.cierres / p.realizadas * 100) : 0
    }

    return {
      periodo: label,
      setters: { totales: setterTotals, porPersona: setterByPerson },
      closers: { totales: closerTotals, porPersona: closerByPerson },
    }
  }

  // ─── COMMISSIONS ───
  function computeCommissions(sales, teamList) {
    const totalNetCash = sales.reduce((s, v) => s + (Number(v.net_cash) || 0), 0)
    const cashByCloser = {}
    for (const s of sales) {
      cashByCloser[s.closer] = (cashByCloser[s.closer] || 0) + (Number(s.net_cash) || 0)
    }

    return teamList.filter(m => m.active).map(m => {
      const isCloser = (m.role || '').includes('closer')
      const cashBase = isCloser ? (cashByCloser[m.name] || 0) : totalNetCash
      const commission = Math.round(cashBase * (m.commission_rate || 0))
      return { nombre: m.name, rol: m.role, tasa: m.commission_rate, cashBase, comision: commission }
    })
  }

  // ─── PACE PROJECTION ───
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const currentCash = currentSales.reduce((s, v) => s + (Number(v.net_cash) || 0), 0)
  const currentRevenue = currentSales.reduce((s, v) => s + (Number(v.revenue) || 0), 0)
  const paceCash = dayOfMonth > 0 ? Math.round(currentCash / dayOfMonth * daysInMonth) : currentCash
  const paceRevenue = dayOfMonth > 0 ? Math.round(currentRevenue / dayOfMonth * daysInMonth) : currentRevenue

  // ─── PROJECTIONS CONTEXT ───
  const currentProjections = projections.filter(p => {
    const period = p.period || p.month
    return period && period.startsWith(currentMonth)
  })

  return {
    fechaConsulta: today,
    mesActual: currentMonth,
    diaDelMes: dayOfMonth,
    diasEnMes: daysInMonth,

    ventasMesActual: summarizeSales(currentSales, `Mes actual: ${currentMonth}`),
    ventasMesAnterior: summarizeSales(prevSales, `Mes anterior: ${prevMonth}`),

    reportesMesActual: summarizeReports(currentReports, `Mes actual: ${currentMonth}`),
    reportesMesAnterior: summarizeReports(prevReports, `Mes anterior: ${prevMonth}`),

    proyeccionPace: {
      cashNetoProyectado: paceCash,
      revenueProyectado: paceRevenue,
      diasTranscurridos: dayOfMonth,
      diasRestantes: daysInMonth - dayOfMonth,
    },

    proyecciones: currentProjections.map(p => ({
      tipo: p.type,
      nombre: p.name,
      periodo: p.period,
      cashTarget: p.cash_target,
      revenueTarget: p.revenue_target,
      appointmentTarget: p.appointment_target,
    })),

    comisionesEstimadas: computeCommissions(currentSales, team),

    equipo: team.map(m => ({
      nombre: m.name,
      email: m.email,
      rol: m.role,
      activo: m.active,
      tasaComision: m.commission_rate,
    })),

    metodosPago: fees.map(f => ({
      metodo: f.method,
      comisionPasarela: f.fee_rate,
    })),

    productos: products.map(p => ({
      nombre: p.name,
      precio: p.price,
      activo: p.active,
    })),

    ventasRecientes: currentSales.slice(0, 40).map(s => ({
      fecha: s.date,
      cliente: s.client_name,
      producto: s.product,
      revenue: s.revenue,
      cashCollected: s.cash_collected,
      cashNeto: s.net_cash,
      closer: s.closer,
      setter: s.setter,
      metodo: s.payment_method,
      tipoPago: s.payment_type,
      cuota: s.installment_number,
      estado: s.status,
      pais: s.pais,
      utmSource: s.utm_source,
    })),

    historicoMensual: (() => {
      const months = {}
      for (const s of allSales) {
        const m = s.date?.slice(0, 7)
        if (!m) continue
        if (!months[m]) months[m] = { revenue: 0, cashNeto: 0, ventas: 0 }
        months[m].revenue += Number(s.revenue) || 0
        months[m].cashNeto += Number(s.net_cash) || 0
        months[m].ventas++
      }
      return months
    })(),

    products,
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Route: if body has 'action', it's an agent
  const { action } = req.body
  if (action === 'deep-enrich' || action === 'personalize' || action === 'scrap-pipeline' || action === 'market-research' || action === 'onboarding') {
    try {
      return await handleScrapPipeline(req, res)
    } catch (error) {
      console.error('Scrap pipeline error:', error)
      return res.status(500).json({ error: error.message })
    }
  }
  if (action) {
    try {
      return await handleProspector(req, res)
    } catch (error) {
      console.error('Prospector error:', error)
      return res.status(500).json({ error: error.message })
    }
  }

  // Otherwise: Cerebro agent (analytics + actions via tool use)
  const { question, history, clientSlug, conversationId } = req.body
  if (!question) {
    return res.status(400).json({ error: 'question is required' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
  }

  // ── GLOBAL MODE: Load all clients data for Home Principal Cerebro ──
  const isGlobal = clientSlug === 'global' || clientSlug === 'all'
  let clientId, clientName, dashboardData

  if (isGlobal) {
    // Load all clients + aggregated data
    const { data: allClients } = await supabase.from('clients').select('id, name, slug').eq('active', true)
    clientName = 'BlackWolf Global'

    // Aggregate data from all clients
    const allData = {}
    for (const c of (allClients || [])) {
      try {
        allData[c.slug] = { name: c.name, id: c.id, ...(await fetchClientData(c.id)) }
      } catch {}
    }

    // Use first client as fallback for tool execution
    clientId = allClients?.[0]?.id

    dashboardData = {
      fechaConsulta: new Date().toISOString(),
      modo: 'GLOBAL — Todos los clientes',
      clientes: (allClients || []).map(c => ({ name: c.name, slug: c.slug })),
      datosPorCliente: allData,
      resumenGlobal: {
        totalClientes: (allClients || []).length,
        totalVentas: Object.values(allData).reduce((s, d) => s + (d.ventasMesActual?.totalVentas || 0), 0),
        totalRevenue: Object.values(allData).reduce((s, d) => s + (d.ventasMesActual?.revenue || 0), 0),
        totalCashNeto: Object.values(allData).reduce((s, d) => s + (d.ventasMesActual?.cashNeto || 0), 0),
      },
    }
  } else {
    clientId = await resolveClientId(clientSlug)
    if (!clientId) {
      return res.status(400).json({ error: 'clientSlug is required' })
    }

    const { data: clientRow } = await supabase.from('clients').select('name').eq('id', clientId).single()
    clientName = clientRow?.name || 'Dashboard'

    try {
      dashboardData = await fetchClientData(clientId)
    } catch (err) {
      console.error('Supabase fetch error:', err)
      return res.status(500).json({ error: 'Error fetching dashboard data: ' + err.message })
    }
  }

  let constraintContext = ''
  if (conversationId) {
    try {
      const { data: conv } = await supabase.from('agent_conversations').select('context').eq('id', conversationId).single()
      if (conv?.context) constraintContext = conv.context
    } catch {}
  }

  // ═══ CEREBRO TOOLS — Actions the AI can execute ═══
  const CEREBRO_TOOLS = [
    {
      name: 'create_crm_contact',
      description: 'Crear un nuevo contacto/lead en el CRM. Requiere al menos nombre y empresa. Pide al usuario los datos que falten antes de ejecutar.',
      input_schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nombre completo del contacto' },
          company: { type: 'string', description: 'Nombre de la empresa' },
          email: { type: 'string', description: 'Email del contacto' },
          phone: { type: 'string', description: 'Telefono' },
          position: { type: 'string', description: 'Cargo/posicion' },
          website: { type: 'string', description: 'Web de la empresa' },
          country: { type: 'string', description: 'Pais' },
          notes: { type: 'string', description: 'Notas adicionales' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Etiquetas' },
        },
        required: ['name', 'company'],
      },
    },
    {
      name: 'add_team_member',
      description: 'Anadir un nuevo miembro al equipo. Requiere nombre, email, rol y contrasena. Pide los datos que falten.',
      input_schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nombre completo' },
          email: { type: 'string', description: 'Email (sera su login)' },
          password: { type: 'string', description: 'Contrasena de acceso' },
          role: { type: 'string', enum: ['setter', 'closer', 'manager', 'director'], description: 'Rol en el equipo' },
          commission_rate: { type: 'number', description: 'Tasa de comision (0.0 a 1.0). Por defecto 0.1 (10%)' },
        },
        required: ['name', 'email', 'password', 'role'],
      },
    },
    {
      name: 'register_sale',
      description: 'Registrar una nueva venta. Requiere closer, producto, revenue y cash. Pide los datos que falten.',
      input_schema: {
        type: 'object',
        properties: {
          closer: { type: 'string', description: 'Nombre del closer que cerro la venta' },
          setter: { type: 'string', description: 'Nombre del setter (opcional)' },
          product: { type: 'string', description: 'Nombre del producto vendido' },
          revenue: { type: 'number', description: 'Valor total del contrato (revenue)' },
          cash_collected: { type: 'number', description: 'Cash cobrado' },
          payment_method: { type: 'string', description: 'Metodo de pago (Stripe, PayPal, Transferencia, etc.)' },
          payment_type: { type: 'string', enum: ['Pago unico', 'Cuotas'], description: 'Tipo de pago' },
          status: { type: 'string', enum: ['Completada', 'Pendiente'], description: 'Estado de la venta' },
          client_name: { type: 'string', description: 'Nombre del cliente que compro' },
          pais: { type: 'string', description: 'Pais del cliente' },
        },
        required: ['closer', 'product', 'revenue', 'cash_collected'],
      },
    },
    {
      name: 'add_daily_report',
      description: 'Registrar el reporte diario de un setter o closer. Pide los datos que falten.',
      input_schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nombre del miembro del equipo' },
          role: { type: 'string', enum: ['setter', 'closer'], description: 'Rol' },
          date: { type: 'string', description: 'Fecha del reporte (YYYY-MM-DD). Si no se indica, usa hoy.' },
          conversations_opened: { type: 'number', description: 'Conversaciones abiertas (setter)' },
          follow_ups: { type: 'number', description: 'Follow ups (setter)' },
          offers_launched: { type: 'number', description: 'Ofertas lanzadas' },
          appointments_booked: { type: 'number', description: 'Agendas conseguidas (setter)' },
          scheduled_calls: { type: 'number', description: 'Llamadas agendadas (closer)' },
          calls_made: { type: 'number', description: 'Llamadas realizadas (closer)' },
          deposits: { type: 'number', description: 'Depositos (closer)' },
          closes: { type: 'number', description: 'Cierres (closer)' },
        },
        required: ['name', 'role'],
      },
    },
    {
      name: 'update_crm_contact',
      description: 'Actualizar datos de un contacto existente en el CRM. Busca por nombre o empresa.',
      input_schema: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Nombre o empresa del contacto a buscar' },
          updates: {
            type: 'object',
            properties: {
              name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' },
              company: { type: 'string' }, status: { type: 'string' }, notes: { type: 'string' },
              position: { type: 'string' }, website: { type: 'string' },
            },
            description: 'Campos a actualizar',
          },
        },
        required: ['search', 'updates'],
      },
    },
    {
      name: 'search_crm',
      description: 'Buscar contactos en el CRM por nombre, empresa, email o tags.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Termino de busqueda' },
          limit: { type: 'number', description: 'Maximo resultados (default 10)' },
        },
        required: ['query'],
      },
    },
  ]

  // ═══ TOOL EXECUTION ═══
  async function executeTool(toolName, toolInput) {
    switch (toolName) {
      case 'create_crm_contact': {
        const { data, error } = await supabase.from('crm_contacts').insert({
          client_id: clientId, name: toolInput.name, company: toolInput.company,
          email: toolInput.email || '', phone: toolInput.phone || '',
          position: toolInput.position || '', website: toolInput.website || '',
          country: toolInput.country || '', notes: toolInput.notes || '',
          tags: JSON.stringify(toolInput.tags || []), source: 'Cerebro IA', status: 'raw',
        }).select('id, name, company').single()
        if (error) return { error: error.message }
        await supabase.from('crm_activities').insert({
          client_id: clientId, contact_id: data.id, type: 'note',
          title: 'Contacto creado via Cerebro', description: `Creado por IA: ${data.name} — ${data.company}`,
          performed_by: 'Cerebro IA',
        })
        return { success: true, id: data.id, message: `Contacto "${data.name}" de "${data.company}" creado en el CRM.` }
      }
      case 'add_team_member': {
        const { data, error } = await supabase.from('team').insert({
          client_id: clientId, name: toolInput.name, email: toolInput.email,
          password: toolInput.password, role: toolInput.role,
          commission_rate: toolInput.commission_rate ?? 0.1, active: true,
        }).select('id, name, email, role').single()
        if (error) return { error: error.message }
        return { success: true, id: data.id, message: `Miembro "${data.name}" (${data.role}) anadido al equipo. Login: ${data.email}` }
      }
      case 'register_sale': {
        const today = new Date().toISOString().split('T')[0]
        const { data, error } = await supabase.from('sales').insert({
          client_id: clientId, closer: toolInput.closer, setter: toolInput.setter || '',
          product: toolInput.product, revenue: toolInput.revenue,
          cash_collected: toolInput.cash_collected,
          payment_method: toolInput.payment_method || 'Stripe',
          payment_type: toolInput.payment_type || 'Pago unico',
          status: toolInput.status || 'Completada',
          client_name: toolInput.client_name || '', pais: toolInput.pais || '',
          date: today,
        }).select('id').single()
        if (error) return { error: error.message }
        return { success: true, id: data.id, message: `Venta registrada: ${toolInput.product} por ${toolInput.revenue}€ (closer: ${toolInput.closer})` }
      }
      case 'add_daily_report': {
        const today = new Date().toISOString().split('T')[0]
        const reportData = {
          client_id: clientId, name: toolInput.name, role: toolInput.role,
          date: toolInput.date || today,
        }
        if (toolInput.role === 'setter') {
          Object.assign(reportData, {
            conversations_opened: toolInput.conversations_opened || 0,
            follow_ups: toolInput.follow_ups || 0,
            offers_launched: toolInput.offers_launched || 0,
            appointments_booked: toolInput.appointments_booked || 0,
          })
        } else {
          Object.assign(reportData, {
            scheduled_calls: toolInput.scheduled_calls || 0,
            calls_made: toolInput.calls_made || 0,
            offers_launched: toolInput.offers_launched || 0,
            deposits: toolInput.deposits || 0,
            closes: toolInput.closes || 0,
          })
        }
        const { data, error } = await supabase.from('reports').insert(reportData).select('id').single()
        if (error) return { error: error.message }
        return { success: true, id: data.id, message: `Reporte diario de ${toolInput.name} (${toolInput.role}) registrado.` }
      }
      case 'update_crm_contact': {
        const { data: found } = await supabase.from('crm_contacts').select('id, name, company')
          .eq('client_id', clientId).or(`name.ilike.%${toolInput.search}%,company.ilike.%${toolInput.search}%`).limit(1).single()
        if (!found) return { error: `No se encontro contacto con "${toolInput.search}"` }
        const { error } = await supabase.from('crm_contacts').update(toolInput.updates).eq('id', found.id)
        if (error) return { error: error.message }
        return { success: true, message: `Contacto "${found.name}" actualizado.` }
      }
      case 'search_crm': {
        const limit = toolInput.limit || 10
        const { data } = await supabase.from('crm_contacts').select('id, name, company, email, phone, status, country')
          .eq('client_id', clientId).or(`name.ilike.%${toolInput.query}%,company.ilike.%${toolInput.query}%,email.ilike.%${toolInput.query}%`)
          .limit(limit)
        return { results: data || [], count: (data || []).length, message: `${(data || []).length} contactos encontrados.` }
      }
      case 'run_scrapper': {
        const countries = toolInput.countries || ['Espana', 'Portugal', 'Italia']
        const query = toolInput.query || 'fabricas textiles'
        const maxPerCountry = toolInput.max_per_country || 10
        try {
          // Call our own prospector
          const targetClientId = toolInput.client_slug ? await resolveClientId(toolInput.client_slug) : clientId
          const runId = await createRun(targetClientId, { query, countries, maxPerCountry })
          const limitedCountries = countries.slice(0, 3)
          let allLeads = [], allEnrichments = []
          for (const country of limitedCountries) {
            const places = await searchBusinesses(country, maxPerCountry, query)
            if (places.length > 0) {
              const enrichments = await enrichWithAI(places)
              allLeads.push(...places)
              allEnrichments.push(...enrichments)
            }
          }
          const results = await insertLeadsIntoCRM(targetClientId, allLeads, allEnrichments, runId)
          const created = results.filter(r => r.crm_status === 'created').length
          const duplicates = results.filter(r => r.crm_status === 'duplicate').length
          return { success: true, message: `Scrapper completado: ${created} leads creados, ${duplicates} duplicados, ${allLeads.length} encontrados en ${limitedCountries.join(', ')}` }
        } catch (err) {
          return { error: `Scrapper error: ${err.message}` }
        }
      }
      case 'switch_client': {
        // Resolve a client slug to ID for subsequent tool calls
        const targetId = await resolveClientId(toolInput.client_slug)
        if (!targetId) return { error: `Cliente "${toolInput.client_slug}" no encontrado` }
        // Update clientId for next tool calls in this chain
        clientId = targetId
        const { data: cRow } = await supabase.from('clients').select('name').eq('id', targetId).single()
        return { success: true, message: `Contexto cambiado a ${cRow?.name || toolInput.client_slug}. Las siguientes acciones se ejecutaran en este cliente.`, clientId: targetId }
      }
      case 'query_enjambre': {
        // Call Enjambre Cerebro API
        try {
          const enjambreToken = process.env.ENJAMBRE_JWT || ''
          const resp = await fetch('https://enjambre.blackwolfsec.io/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${enjambreToken}` },
            body: JSON.stringify({ message: toolInput.message, session_id: 'cerebro-global' }),
          })
          if (!resp.ok) return { error: `Enjambre API error: ${resp.status}` }
          const data = await resp.json()
          return { success: true, response: data.response || data.message || 'Sin respuesta', agents_used: data.agents_used }
        } catch (err) {
          return { error: `Enjambre connection error: ${err.message}` }
        }
      }
      default:
        return { error: `Tool ${toolName} no reconocido` }
    }
  }

  // ── Add global tools if in global mode ──
  if (isGlobal) {
    CEREBRO_TOOLS.push(
      {
        name: 'run_scrapper',
        description: 'Ejecutar el Scrapper Prospector para buscar leads. Puedes especificar query, paises y cliente destino.',
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Que buscar (ej: fabricas textiles, clinicas dentales)' },
            countries: { type: 'array', items: { type: 'string' }, description: 'Paises donde buscar' },
            max_per_country: { type: 'number', description: 'Max resultados por pais (default 10)' },
            client_slug: { type: 'string', description: 'Slug del cliente destino (ej: black-wolf, demo-factory)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'switch_client',
        description: 'Cambiar el contexto a otro cliente para ejecutar acciones en el. Necesario antes de crear contactos, ventas, etc. en un cliente especifico.',
        input_schema: {
          type: 'object',
          properties: { client_slug: { type: 'string', description: 'Slug del cliente (ej: black-wolf, demo-factory)' } },
          required: ['client_slug'],
        },
      },
      {
        name: 'query_enjambre',
        description: 'Consultar al Cerebro de Enjambre. Usa esto para: estado del SOC, amenazas, agentes activos, eventos del enjambre, o cualquier consulta sobre ciberseguridad y operaciones IA.',
        input_schema: {
          type: 'object',
          properties: { message: { type: 'string', description: 'Pregunta o comando para el Cerebro de Enjambre' } },
          required: ['message'],
        },
      }
    )
  }

  const globalContext = isGlobal ? `

═══ MODO GLOBAL — CEREBRO CENTRAL ═══

Eres el CEREBRO CENTRAL de BlackWolf. Tienes acceso TOTAL a:
- TODOS los clientes y sus dashboards completos
- El Scrapper Prospector (buscar leads en cualquier sector/pais)
- El Enjambre (SOC, agentes IA, ciberseguridad) via query_enjambre
- CRM, equipo, ventas, reportes de CUALQUIER cliente

CLIENTES DISPONIBLES:
${(dashboardData.clientes || []).map(c => `- ${c.name} (slug: ${c.slug})`).join('\n')}

RESUMEN GLOBAL:
- ${dashboardData.resumenGlobal?.totalClientes || 0} clientes activos
- ${dashboardData.resumenGlobal?.totalVentas || 0} ventas este mes
- ${dashboardData.resumenGlobal?.totalRevenue || 0}€ revenue total
- ${dashboardData.resumenGlobal?.totalCashNeto || 0}€ cash neto total

Para ejecutar acciones en un cliente especifico, primero usa switch_client con su slug.
Para consultar al Enjambre (SOC, amenazas, agentes), usa query_enjambre.
Para buscar leads, usa run_scrapper.

Puedes cruzar datos entre clientes, comparar rendimientos, y ejecutar acciones en cualquiera.
` : ''

  const systemPrompt = buildSystemPrompt(clientName, dashboardData.products || []) + `

═══ ACCIONES DISPONIBLES (TOOLS) ═══

Ademas de analizar datos, puedes EJECUTAR ACCIONES reales en el sistema:

1. **create_crm_contact**: Crear contactos en el CRM
2. **add_team_member**: Anadir miembros al equipo (setter, closer, manager, director)
3. **register_sale**: Registrar ventas
4. **add_daily_report**: Registrar reportes diarios de setters/closers
5. **update_crm_contact**: Actualizar contactos existentes
6. **search_crm**: Buscar en el CRM
${isGlobal ? `7. **run_scrapper**: Ejecutar el Scrapper Prospector
8. **switch_client**: Cambiar contexto a otro cliente
9. **query_enjambre**: Consultar al Cerebro de Enjambre (SOC, agentes, amenazas)` : ''}

REGLAS CRITICAS:
- SIEMPRE pide confirmacion antes de ejecutar una accion que cree o modifique datos.
- Si faltan datos OBLIGATORIOS, pregunta al usuario ANTES de ejecutar el tool.
- Para add_team_member: SIEMPRE necesitas nombre, email, contrasena y rol. NO inventes datos.
- Para register_sale: SIEMPRE necesitas closer, producto, revenue y cash. Pregunta si falta algo.
- Cuando ejecutes una accion, explica claramente que has hecho.
${globalContext}
- Guia al usuario paso a paso de forma conversacional.
- Si el usuario dice "crea un contacto" sin dar datos, pregunta: nombre, empresa, email, telefono, etc.`

  const messages = []
  if (Array.isArray(history)) {
    for (const msg of history.slice(-20)) {
      messages.push({ role: msg.role, content: msg.content })
    }
  }

  const contextPrefix = constraintContext
    ? `CONTEXTO PREVIO:\n${constraintContext}\n\n`
    : ''

  messages.push({
    role: 'user',
    content: `${contextPrefix}DATOS DEL DASHBOARD (${dashboardData.fechaConsulta}):\n\`\`\`json\n${JSON.stringify(dashboardData, null, 2)}\n\`\`\`\n\nPREGUNTA: ${question}`,
  })

  try {
    // First call — may request tool use
    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      tools: CEREBRO_TOOLS,
    })

    // Tool use loop — execute tools and continue conversation
    const toolResults = []
    let maxLoops = 5
    while (response.stop_reason === 'tool_use' && maxLoops-- > 0) {
      const assistantContent = response.content
      messages.push({ role: 'assistant', content: assistantContent })

      const toolUseBlocks = assistantContent.filter(b => b.type === 'tool_use')
      const toolResultBlocks = []

      for (const toolUse of toolUseBlocks) {
        const result = await executeTool(toolUse.name, toolUse.input)
        toolResults.push({ tool: toolUse.name, input: toolUse.input, result })
        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        })
      }

      messages.push({ role: 'user', content: toolResultBlocks })

      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: systemPrompt,
        messages,
        tools: CEREBRO_TOOLS,
      })
    }

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')

    return res.status(200).json({
      answer: text,
      usage: response.usage,
      actions: toolResults.length > 0 ? toolResults : undefined,
    })
  } catch (error) {
    console.error('Agent error:', error)

    if (error instanceof Anthropic.AuthenticationError) {
      return res.status(401).json({ error: 'Invalid Anthropic API key' })
    }
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'Rate limited — try again in a moment' })
    }
    if (error instanceof Anthropic.APIError) {
      return res.status(502).json({ error: `Claude API error: ${error.message}` })
    }

    return res.status(500).json({ error: 'Internal server error: ' + error.message })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCRAP PIPELINE — Deep Enrich + Personalize Email Agent
// ═══════════════════════════════════════════════════════════════════════════════

const SCRAP_PIPELINE_ID = 'd922fa5f-ce79-4787-aa22-09f17f4979a7'

function detectLang(country) {
  const c = (country || '').toLowerCase()
  const hasCyrillic = [...c].some(ch => ch.charCodeAt(0) >= 0x400 && ch.charCodeAt(0) <= 0x4FF)
  if (hasCyrillic || /bulgar|българия/.test(c)) return 'Bulgarian'
  if (/deutsch|german|austria|schweiz|alemania/.test(c)) return 'German'
  if (/france|français|francia/.test(c)) return 'French'
  if (/nederland|dutch|paises.bajos|holanda/.test(c)) return 'Dutch'
  if (/portug/.test(c)) return 'Portuguese'
  if (/spain|españa|español|espana/.test(c)) return 'Spanish'
  if (/italia/.test(c)) return 'Italian'
  if (/belgi/.test(c)) return 'French'
  if (/reino.unido|uk|united.kingdom|england/.test(c)) return 'English'
  return 'English'
}

async function deepEnrichContact(contact) {
  const company = contact.company || contact.name || ''
  const website = contact.website || ''
  const country = contact.country || 'España'
  const results = { phone: null, ownerName: null, ownerEmail: null, ceoPhone: null, companyEmail: null, cif: null, sector: null, employees: null, revenue: null, linkedin: null, sources: [] }

  // Strategy 1: Scrape company website deeply
  if (website) {
    const paths = ['', '/contacto', '/contact', '/about', '/sobre-nosotros', '/equipo', '/team', '/legal', '/aviso-legal', '/impressum', '/privacy', '/imprint', '/kontakt', '/za-nas', '/about-us']
    for (const path of paths) {
      try {
        const url = website.replace(/\/$/, '') + path
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }, redirect: 'follow', signal: AbortSignal.timeout(5000) })
        if (!r.ok) continue
        const html = await r.text()

        // Phones
        if (!results.phone) {
          const telLinks = html.match(/href=["']tel:([^"']+)["']/gi)
          if (telLinks) { const num = telLinks[0].replace(/href=["']tel:/i, '').replace(/["']/g, '').replace(/[^\d+]/g, ''); if (num.length >= 9) results.phone = num }
          if (!results.phone) {
            const phonePatterns = html.match(/(?:tel|phone|telefon|teléfono|тел|τηλ)[:\s]*([+\d\s().-]{9,18})/gi)
            if (phonePatterns) { for (const m of phonePatterns) { const c = m.replace(/[^\d+]/g, ''); if (c.length >= 9 && c.length <= 15) { results.phone = c; break } } }
          }
        }

        // Emails
        const emails = html.match(/[\w.+-]+@[\w.-]+\.\w{2,}/g)
        if (emails) {
          const good = emails.filter(e => !e.includes('example') && !e.includes('sentry') && !e.includes('webpack') && !e.includes('wixpress'))
          if (!results.companyEmail && good.length > 0) results.companyEmail = good[0]
          // Look for owner/CEO emails
          const ownerEmails = good.filter(e => /ceo|director|owner|gerente|info|contact|admin/i.test(e))
          if (ownerEmails.length > 0 && !results.ownerEmail) results.ownerEmail = ownerEmails[0]
        }

        // CIF/NIF
        if (!results.cif) {
          const cifMatch = html.match(/(?:CIF|NIF|VAT|N\.I\.F|C\.I\.F|ЕИК|БУЛСТАТ|EIK)[:\s]*([A-Z0-9]?\d{7,10}[A-Z0-9]?)/i)
          if (cifMatch) results.cif = cifMatch[1]
        }

        // Owner/CEO names from about/team pages
        if (!results.ownerName && /about|equipo|team|za-nas|sobre/i.test(path)) {
          const nameMatch = html.match(/(?:CEO|Director|Founder|Owner|Gerente|Управител|Собственик|Geschäftsführer)[:\s<>]*([A-ZА-Яa-zа-я\s.'-]{3,40})/i)
          if (nameMatch) results.ownerName = nameMatch[1].replace(/<[^>]*>/g, '').trim()
        }
      } catch (e) { /* timeout, skip */ }
    }
  }

  // Strategy 2: Google searches
  const queries = [
    `"${company}" CEO OR director OR owner OR gerente email`,
    `"${company}" teléfono contacto ${country}`,
    `"${company}" CIF OR NIF OR VAT`,
    website ? `site:linkedin.com "${company}"` : null,
  ].filter(Boolean)

  for (const query of queries) {
    try {
      const r = await fetch(`https://www.google.com/search?q=${encodeURIComponent(query)}&num=5`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(5000)
      })
      if (!r.ok) continue
      const html = await r.text()

      if (!results.phone) {
        const phones = html.match(/(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3}[\s.-]?\d{2,4}[\s.-]?\d{0,4}/g)
        if (phones) { const cleaned = phones.map(p => p.replace(/[^\d+]/g, '')).filter(p => p.length >= 9 && p.length <= 15); if (cleaned.length > 0) results.phone = cleaned[0] }
      }
      if (!results.companyEmail) {
        const emails = html.match(/[\w.+-]+@[\w.-]+\.\w{2,}/g)
        if (emails) { const good = emails.filter(e => !e.includes('google') && !e.includes('example')); if (good.length > 0) results.companyEmail = good[0] }
      }
      // LinkedIn URL
      if (!results.linkedin) {
        const liMatch = html.match(/linkedin\.com\/(?:company|in)\/[a-z0-9-]+/i)
        if (liMatch) results.linkedin = 'https://' + liMatch[0]
      }
    } catch (e) { /* skip */ }
  }

  // Strategy 3: Use Claude to deduce missing info
  if (!results.ownerName || !results.ownerEmail) {
    try {
      const prompt = `Given this company info, deduce the most likely CEO/owner name and email:
Company: ${company}
Country: ${country}
Website: ${website}
Known email: ${results.companyEmail || contact.email || 'unknown'}
Known phone: ${results.phone || contact.phone || 'unknown'}

Return ONLY valid JSON: {"ownerName":"...", "ownerEmail":"...", "ceoPhone":"...", "sector":"...", "estimatedRevenue":"...", "estimatedEmployees":"..."}`

      const aiRes = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
      const text = aiRes.content[0]?.text || ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const ai = JSON.parse(jsonMatch[0])
        if (!results.ownerName && ai.ownerName) results.ownerName = ai.ownerName
        if (!results.ownerEmail && ai.ownerEmail) results.ownerEmail = ai.ownerEmail
        if (!results.ceoPhone && ai.ceoPhone) results.ceoPhone = ai.ceoPhone
        if (!results.sector && ai.sector) results.sector = ai.sector
        if (!results.revenue && ai.estimatedRevenue) results.revenue = ai.estimatedRevenue
        if (!results.employees && ai.estimatedEmployees) results.employees = ai.estimatedEmployees
      }
    } catch (e) { /* AI failed, continue */ }
  }

  return results
}

async function personalizeEmail(contact, enrichData) {
  const company = contact.company || contact.name || ''
  const ownerName = enrichData.ownerName || contact.owner_name || 'Estimado/a Director/a'
  const country = contact.country || ''
  const sector = enrichData.sector || 'manufactura'

  // Determine language — detect Cyrillic as Bulgarian
  const hasCyrillic = country && [...country].some(ch => ch.charCodeAt(0) >= 0x400 && ch.charCodeAt(0) <= 0x4FF)
  const lang = hasCyrillic || /bulgar|българия/i.test(country) ? 'bg' :
               /deutsch|german|austria|schweiz|alemania/i.test(country) ? 'de' :
               /france|français|francia/i.test(country) ? 'fr' :
               /nederland|dutch|paises.bajos|holanda/i.test(country) ? 'nl' :
               /portug/i.test(country) ? 'pt' :
               /spain|españa|español|espana/i.test(country) ? 'es' :
               /italia/i.test(country) ? 'it' :
               /belgi/i.test(country) ? 'fr' : 'en'

  try {
    const prompt = `Write a personalized cold email in ${lang === 'bg' ? 'Bulgarian' : lang === 'de' ? 'German' : lang === 'fr' ? 'French' : lang === 'nl' ? 'Dutch' : lang === 'pt' ? 'Portuguese' : lang === 'es' ? 'Spanish' : 'English'} for:

Company: ${company}
Contact: ${ownerName}
Country: ${country}
Sector: ${sector}
Website: ${contact.website || 'N/A'}

WE ARE BlackWolf Security - a technology company offering:
1. Custom ERP system (like SAP/Odoo but built specifically for their industry)
2. Cybersecurity (SOC monitoring, penetration testing, compliance)
3. Process automation (AI agents, workflow optimization)
4. Complete digital transformation

OFFER: €10,000 package includes:
- Full process mapping of their company
- Custom ERP implementation
- Cybersecurity audit + SOC setup
- AI-powered automation of repetitive tasks
- 3 months support

OUR WEBSITE: web.blackwolfsec.io

The email should:
- Be 150-200 words max
- Reference something specific about their company/industry
- Mention we already work with factories in their region
- Create urgency (EU digitalization grants available in 2026)
- End with a CTA button "Agendar llamada" / "Schedule a call" (in their language) linking to https://web.blackwolfsec.io
- ALL links and buttons MUST point to https://web.blackwolfsec.io
- Sound human and consultative, not salesy
- Include a subject line that creates curiosity
- CTA button style: background #FF6B00, color white, padding 14px 32px, border-radius 8px, font-weight bold

Return ONLY valid JSON: {"subject":"...", "html":"<html email with inline styles, professional dark design #0A0A0A bg, #FF6B00 accent, CTA button linking to https://web.blackwolfsec.io>"}`

    const aiRes = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514', max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = aiRes.content[0]?.text || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.error('Personalize error:', e.message)
  }

  return { subject: `Propuesta de digitalización para ${company}`, html: `<p>Estimado/a ${ownerName},</p><p>Desde BlackWolf Security nos gustaría ayudar a ${company} con su transformación digital.</p>` }
}

async function handleScrapPipeline(req, res) {
  const { action, clientSlug, contactIds } = req.body
  const clientId = await resolveClientId(clientSlug)
  if (!clientId) return res.status(400).json({ error: 'Client not found' })

  // ── DEEP ENRICH single or batch ──
  if (action === 'deep-enrich') {
    if (!contactIds || !contactIds.length) return res.status(400).json({ error: 'contactIds required' })

    const results = []
    for (const cid of contactIds) {
      const { data: contact } = await supabase.from('crm_contacts').select('*').eq('id', cid).single()
      if (!contact) { results.push({ id: cid, error: 'not found' }); continue }

      // Update status
      await supabase.from('crm_contacts').update({ status: 'enriching', pipeline_id: SCRAP_PIPELINE_ID }).eq('id', cid)

      // Queue entry
      await supabase.from('scrap_agent_queue').insert({ client_id: clientId, contact_id: cid, stage: 'enriching', enrich_started_at: new Date().toISOString() })

      // Deep enrich
      const enrichData = await deepEnrichContact(contact)

      // Update contact with found data
      const updates = { enriched_at: new Date().toISOString(), enrichment_data: JSON.stringify(enrichData), status: 'enriched', pipeline_id: SCRAP_PIPELINE_ID }
      if (enrichData.phone && !contact.phone) updates.phone = enrichData.phone
      if (enrichData.companyEmail && !contact.email) updates.email = enrichData.companyEmail
      if (enrichData.ownerName && !contact.owner_name) updates.owner_name = enrichData.ownerName
      if (enrichData.ownerEmail && !contact.owner_email) updates.owner_email = enrichData.ownerEmail
      if (enrichData.cif && !contact.billing_cif) updates.billing_cif = enrichData.cif
      if (enrichData.linkedin && !contact.linkedin) updates.linkedin = enrichData.linkedin

      await supabase.from('crm_contacts').update(updates).eq('id', cid)
      await supabase.from('scrap_agent_queue').update({ stage: 'enriched', enrich_completed_at: new Date().toISOString(), enrich_data: JSON.stringify(enrichData) }).eq('contact_id', cid)

      results.push({ id: cid, company: contact.company || contact.name, enrichData })
    }

    return res.status(200).json({ action: 'deep-enrich', results })
  }

  // ── PERSONALIZE: create email for enriched contacts ──
  if (action === 'personalize') {
    if (!contactIds || !contactIds.length) return res.status(400).json({ error: 'contactIds required' })

    // Get or create email config
    const { data: emailConfig } = await supabase.from('email_config').select('*').eq('client_id', clientId).limit(1).single()

    const results = []
    for (const cid of contactIds) {
      const { data: contact } = await supabase.from('crm_contacts').select('*').eq('id', cid).single()
      if (!contact) { results.push({ id: cid, error: 'not found' }); continue }

      await supabase.from('crm_contacts').update({ status: 'personalizing', pipeline_id: SCRAP_PIPELINE_ID }).eq('id', cid)

      const enrichData = typeof contact.enrichment_data === 'string' ? JSON.parse(contact.enrichment_data || '{}') : (contact.enrichment_data || {})
      const email = await personalizeEmail(contact, enrichData)

      // Create template in email marketing
      const templateName = `Scrap - ${contact.company || contact.name}`
      const { data: template } = await supabase.from('email_templates').insert({
        client_id: clientId, name: templateName, subject: email.subject, html_content: email.html, category: 'scrap-outreach'
      }).select().single()

      // Find or create list by country/sector
      const listName = `Scrap - ${contact.country || 'Internacional'} - ${enrichData.sector || 'General'}`
      let { data: lists } = await supabase.from('email_lists').select('*').eq('client_id', clientId).eq('name', listName)
      let list = lists && lists[0]
      if (!list) {
        const { data: newList } = await supabase.from('email_lists').insert({ client_id: clientId, name: listName, description: `Leads scrapeados - ${contact.country} - ${enrichData.sector || 'General'}` }).select().single()
        list = newList
      }

      // Add contact as subscriber
      const subEmail = contact.owner_email || enrichData.ownerEmail || contact.email || enrichData.companyEmail
      if (subEmail && list) {
        const { data: existingSub } = await supabase.from('email_subscribers').select('id').eq('email', subEmail).eq('list_id', list.id).limit(1)
        if (!existingSub || existingSub.length === 0) {
          await supabase.from('email_subscribers').insert({ client_id: clientId, list_id: list.id, email: subEmail, name: enrichData.ownerName || contact.name || '', status: 'subscribed' })
        }
      }

      // Update contact and queue
      await supabase.from('crm_contacts').update({ status: 'ready', pipeline_id: SCRAP_PIPELINE_ID }).eq('id', cid)
      await supabase.from('scrap_agent_queue').update({
        stage: 'ready', personalize_completed_at: new Date().toISOString(),
        email_subject: email.subject, email_html: email.html,
        template_id: template?.id || null, list_id: list?.id || null,
      }).eq('contact_id', cid)

      results.push({ id: cid, company: contact.company || contact.name, subject: email.subject, templateId: template?.id, listId: list?.id, listName })
    }

    return res.status(200).json({ action: 'personalize', results })
  }

  // ── FULL PIPELINE: enrich + personalize in one go ──
  if (action === 'scrap-pipeline') {
    if (!contactIds || !contactIds.length) return res.status(400).json({ error: 'contactIds required' })

    const results = []
    for (const cid of contactIds) {
      // Step 1: Deep enrich
      req.body.action = 'deep-enrich'
      req.body.contactIds = [cid]

      const { data: contact } = await supabase.from('crm_contacts').select('*').eq('id', cid).single()
      if (!contact) { results.push({ id: cid, error: 'not found' }); continue }

      await supabase.from('crm_contacts').update({ status: 'enriching', pipeline_id: SCRAP_PIPELINE_ID }).eq('id', cid)
      const enrichData = await deepEnrichContact(contact)

      const updates = { enriched_at: new Date().toISOString(), enrichment_data: JSON.stringify(enrichData), status: 'enriched', pipeline_id: SCRAP_PIPELINE_ID }
      if (enrichData.phone && !contact.phone) updates.phone = enrichData.phone
      if (enrichData.companyEmail && !contact.email) updates.email = enrichData.companyEmail
      if (enrichData.ownerName && !contact.owner_name) updates.owner_name = enrichData.ownerName
      if (enrichData.ownerEmail && !contact.owner_email) updates.owner_email = enrichData.ownerEmail
      if (enrichData.cif && !contact.billing_cif) updates.billing_cif = enrichData.cif

      await supabase.from('crm_contacts').update(updates).eq('id', cid)

      // Step 2: Personalize
      await supabase.from('crm_contacts').update({ status: 'personalizing' }).eq('id', cid)
      const updatedContact = { ...contact, ...updates }
      const email = await personalizeEmail(updatedContact, enrichData)

      // Save template
      const templateName = `Scrap - ${contact.company || contact.name}`
      const { data: template } = await supabase.from('email_templates').insert({
        client_id: clientId, name: templateName, subject: email.subject, html_content: email.html, category: 'scrap-outreach'
      }).select().single()

      // Find/create list
      const listName = `Scrap - ${contact.country || 'Internacional'} - ${enrichData.sector || 'General'}`
      let { data: lists } = await supabase.from('email_lists').select('*').eq('client_id', clientId).eq('name', listName)
      let list = lists && lists[0]
      if (!list) {
        const { data: nl } = await supabase.from('email_lists').insert({ client_id: clientId, name: listName, description: `Leads scrapeados - ${contact.country}` }).select().single()
        list = nl
      }

      // Add subscriber
      const subEmail = enrichData.ownerEmail || contact.owner_email || contact.email || enrichData.companyEmail
      if (subEmail && list) {
        const { data: ex } = await supabase.from('email_subscribers').select('id').eq('email', subEmail).eq('list_id', list.id).limit(1)
        if (!ex || ex.length === 0) {
          await supabase.from('email_subscribers').insert({ client_id: clientId, list_id: list.id, email: subEmail, name: enrichData.ownerName || contact.name || '', status: 'subscribed' })
        }
      }

      // Step 3: Send email via Resend
      let emailSent = false
      if (subEmail) {
        const { data: emailConfig } = await supabase.from('email_config').select('*').eq('client_id', clientId).limit(1).single()
        if (emailConfig && emailConfig.api_key) {
          const ownerName = enrichData.ownerName || contact.owner_name || contact.name || 'Director/a'
          const companyName = contact.company || contact.name || ''
          const personalizedHtml = (email.html || '').replace(/\{\{name\}\}/g, ownerName).replace(/\{\{company\}\}/g, companyName)
          const personalizedSubject = (email.subject || '').replace(/\{\{name\}\}/g, ownerName).replace(/\{\{company\}\}/g, companyName)
          const fromEmail = emailConfig.from_email || 'onboarding@resend.dev'
          const fromName = emailConfig.from_name || 'BlackWolf Security'

          try {
            const sendRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${emailConfig.api_key}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to: [subEmail], subject: personalizedSubject, html: personalizedHtml })
            })
            if (sendRes.ok) {
              emailSent = true
              await emitEvent(EVENTS.AGENT_EMAIL_SENT, 'scrap-pipeline', 'email_sent', { to: subEmail, company: contact.company || contact.name, subject: personalizedSubject }, { clientId, contactId: cid })
            } else {
              await emitEvent(EVENTS.AGENT_EMAIL_FAILED, 'scrap-pipeline', 'email_failed', { to: subEmail, company: contact.company || contact.name }, { clientId, contactId: cid })
            }
          } catch (e) { /* send failed silently */ }
        }
      }

      const finalStatus = emailSent ? 'sent' : 'ready'
      await supabase.from('crm_contacts').update({ status: finalStatus, pipeline_id: SCRAP_PIPELINE_ID }).eq('id', cid)

      results.push({ id: cid, company: contact.company || contact.name, enrichData, email: { subject: email.subject }, templateId: template?.id, listName, emailSent })
    }

    return res.status(200).json({ action: 'scrap-pipeline', processed: results.length, results })
  }

  // ── MARKET RESEARCH: analyze market + optimize prospecting + email strategy ──
  if (action === 'market-research') {
    const { sector, countries, currentLeadsCount, goal } = req.body

    // Gather market data from multiple sources
    const marketData = []

    // Search for industry reports, competitor analysis, market size
    const researchQueries = [
      `${sector || 'textile manufacturing'} industry market size Europe 2025 2026`,
      `${sector || 'textile'} factory digitalization ERP adoption rate`,
      `${sector || 'textile'} companies ${(countries || ['Spain', 'Bulgaria']).join(' ')} directory list`,
      `best cold email strategies B2B manufacturing 2026`,
      `ERP sales funnel conversion rates B2B`,
      `${sector || 'textile'} pain points challenges digitalization`,
      `cold email subject lines highest open rate B2B manufacturing`,
      `EU digitalization grants 2026 manufacturing SME`,
    ]

    for (const query of researchQueries) {
      try {
        const r = await fetch(`https://www.google.com/search?q=${encodeURIComponent(query)}&num=5`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(5000)
        })
        if (r.ok) {
          const html = await r.text()
          // Extract snippets
          const snippets = html.match(/<span class="[^"]*">[^<]{50,300}<\/span>/g) || []
          const cleaned = snippets.map(s => s.replace(/<[^>]+>/g, '').trim()).filter(s => s.length > 50).slice(0, 3)
          if (cleaned.length > 0) marketData.push({ query, findings: cleaned })
        }
      } catch (e) { /* skip */ }
    }

    // Get existing CRM data for analysis
    const { data: leads } = await supabase.from('crm_contacts').select('country, status, source, company, billing_annual, enrichment_data').eq('client_id', clientId).limit(500)
    const { data: emailCampaigns } = await supabase.from('email_campaigns').select('*').eq('client_id', clientId)
    const { data: templates } = await supabase.from('email_templates').select('name, subject, category').eq('client_id', clientId)

    // Analyze current leads
    const leadAnalysis = {
      total: (leads || []).length,
      byCountry: {},
      byStatus: {},
      withEmail: 0,
      withPhone: 0,
      withOwner: 0,
      avgBilling: 0,
    }
    let billingSum = 0, billingCount = 0
    for (const l of (leads || [])) {
      leadAnalysis.byCountry[l.country || 'Unknown'] = (leadAnalysis.byCountry[l.country || 'Unknown'] || 0) + 1
      leadAnalysis.byStatus[l.status || 'unknown'] = (leadAnalysis.byStatus[l.status || 'unknown'] || 0) + 1
      if (l.email) leadAnalysis.withEmail++
      if (l.phone) leadAnalysis.withPhone++
      const ed = typeof l.enrichment_data === 'string' ? JSON.parse(l.enrichment_data || '{}') : (l.enrichment_data || {})
      if (ed.ownerName) leadAnalysis.withOwner++
      if (l.billing_annual > 0) { billingSum += Number(l.billing_annual); billingCount++ }
    }
    leadAnalysis.avgBilling = billingCount > 0 ? Math.round(billingSum / billingCount) : 0

    // Claude generates comprehensive market research + strategy
    try {
      const prompt = `You are a B2B sales strategist and market research expert. Analyze this data and create a comprehensive report.

COMPANY: BlackWolf Security
SERVICES: Custom ERP (€10,000), Cybersecurity/SOC, Process Automation, AI Agents
TARGET SECTOR: ${sector || 'Textile manufacturing / Factories'}
TARGET COUNTRIES: ${(countries || ['Spain', 'Bulgaria', 'Germany', 'France', 'Netherlands']).join(', ')}
GOAL: ${goal || 'Find and convert textile factories that invoice >100k annually'}

CURRENT CRM DATA:
${JSON.stringify(leadAnalysis, null, 2)}

EXISTING EMAIL TEMPLATES: ${(templates || []).map(t => t.name + ' - ' + t.subject).join('; ') || 'None'}
EXISTING CAMPAIGNS: ${(emailCampaigns || []).length} campaigns

MARKET RESEARCH DATA:
${marketData.map(d => `Query: ${d.query}\nFindings: ${d.findings.join(' | ')}`).join('\n\n')}

Create a comprehensive report in JSON with this structure:
{
  "marketOverview": {
    "marketSize": "...",
    "growthRate": "...",
    "keyTrends": ["..."],
    "targetSegments": ["..."]
  },
  "competitorAnalysis": {
    "mainCompetitors": [{"name":"...", "pricing":"...", "weakness":"..."}],
    "ourAdvantages": ["..."],
    "differentiators": ["..."]
  },
  "prospectingStrategy": {
    "bestChannels": [{"channel":"...", "conversionRate":"...", "cost":"...", "priority":"high/medium/low"}],
    "idealCustomerProfile": {"revenue":"...", "employees":"...", "painPoints":["..."]},
    "searchKeywords": ["..."],
    "bestCountries": [{"country":"...", "reason":"...", "estimatedLeads":"..."}],
    "bestTimesToContact": "...",
    "followUpSequence": [{"day":"...", "action":"...", "channel":"..."}]
  },
  "emailStrategy": {
    "optimalSubjectLines": ["..."],
    "bestSendTimes": "...",
    "sequenceRecommendation": [
      {"email":1, "subject":"...", "angle":"...", "waitDays":0},
      {"email":2, "subject":"...", "angle":"...", "waitDays":3},
      {"email":3, "subject":"...", "angle":"...", "waitDays":5}
    ],
    "a_b_tests": [{"test":"...", "hypothesis":"..."}],
    "personalizationTips": ["..."]
  },
  "salesFunnel": {
    "stages": [{"name":"...", "conversionRate":"...", "actions":["..."]}],
    "estimatedPipeline": "...",
    "monthlyTargets": {"leads":"...", "emails":"...", "calls":"...", "meetings":"...", "closes":"..."}
  },
  "actionPlan": [
    {"week":1, "actions":["..."]},
    {"week":2, "actions":["..."]},
    {"week":3, "actions":["..."]},
    {"week":4, "actions":["..."]}
  ],
  "recommendedEmailTemplates": [
    {"name":"...", "subject":"...", "targetSegment":"...", "language":"...", "html":"<short html email>"}
  ]
}

Be specific with numbers, percentages, and actionable recommendations. Base on real industry data.`

      const aiRes = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })

      const text = aiRes.content[0]?.text || ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      let report = null
      if (jsonMatch) {
        try { report = JSON.parse(jsonMatch[0]) } catch (e) { report = { raw: text } }
      } else {
        report = { raw: text }
      }

      // Auto-create recommended email templates
      if (report.recommendedEmailTemplates && Array.isArray(report.recommendedEmailTemplates)) {
        for (const tpl of report.recommendedEmailTemplates) {
          if (tpl.name && tpl.subject) {
            await supabase.from('email_templates').insert({
              client_id: clientId,
              name: `Strategy - ${tpl.name}`,
              subject: tpl.subject,
              html_content: tpl.html || `<p>${tpl.name}</p>`,
              category: 'strategy',
            })
          }
        }
      }

      // Auto-create recommended lists by segment
      if (report.prospectingStrategy?.bestCountries) {
        for (const c of report.prospectingStrategy.bestCountries) {
          const listName = `Strategy - ${c.country} - ${sector || 'Factories'}`
          const { data: existing } = await supabase.from('email_lists').select('id').eq('client_id', clientId).eq('name', listName).limit(1)
          if (!existing || existing.length === 0) {
            await supabase.from('email_lists').insert({ client_id: clientId, name: listName, description: `${c.reason} - Est. ${c.estimatedLeads} leads` })
          }
        }
      }

      return res.status(200).json({ action: 'market-research', report, leadAnalysis, marketDataSources: marketData.length })
    } catch (e) {
      console.error('Market research AI error:', e)
      return res.status(500).json({ error: 'AI analysis failed: ' + e.message })
    }
  }

  // ── ONBOARDING AGENT: process follow-ups + detect responses + auto-close ──
  if (action === 'onboarding') {
    const { subAction = 'process-sequence' } = req.body

    // Get onboarding config
    const { data: onbConfig } = await supabase.from('onboarding_config').select('*').eq('client_id', clientId).limit(1).single()
    if (!onbConfig) return res.status(400).json({ error: 'Onboarding not configured for this client' })

    const { data: emailConfig } = await supabase.from('email_config').select('*').eq('client_id', clientId).limit(1).single()

    // ── SUB-ACTION: Process email sequence (send follow-ups) ──
    if (subAction === 'process-sequence') {
      const { data: sequence } = await supabase.from('email_sequences').select('*').eq('id', onbConfig.sequence_id).single()
      if (!sequence) return res.status(400).json({ error: 'Sequence not found' })
      const steps = typeof sequence.steps === 'string' ? JSON.parse(sequence.steps) : (sequence.steps || [])

      // Get contacts in sequence that need next email
      const now = new Date()
      const { data: seqContacts } = await supabase.from('email_sequence_contacts')
        .select('*').eq('client_id', clientId).eq('sequence_id', onbConfig.sequence_id).eq('status', 'active')

      let sent = 0, skipped = 0
      for (const sc of (seqContacts || [])) {
        const nextSend = sc.next_send_at ? new Date(sc.next_send_at) : new Date(0)
        if (nextSend > now) { skipped++; continue }

        const step = steps[sc.current_step]
        if (!step) {
          await supabase.from('email_sequence_contacts').update({ status: 'completed', completed_at: now.toISOString() }).eq('id', sc.id)
          continue
        }

        // Get contact
        const { data: contact } = await supabase.from('crm_contacts').select('*').eq('id', sc.contact_id).single()
        if (!contact) continue

        const enrichData = typeof contact.enrichment_data === 'string' ? JSON.parse(contact.enrichment_data || '{}') : (contact.enrichment_data || {})
        const ownerName = enrichData.ownerName || contact.owner_name || contact.name || 'Director/a'
        const companyName = contact.company || contact.name || ''
        const toEmail = contact.owner_email || contact.email || enrichData.ownerEmail

        if (!toEmail || !emailConfig?.api_key) { skipped++; continue }

        // Generate email for this step using Claude
        let emailContent
        try {
          const lang = detectLang(contact.country || '')
          const aiRes = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514', max_tokens: 1500,
            messages: [{ role: 'user', content: `Write a ${step.type} cold email in ${lang} for:
Company: ${companyName}, Contact: ${ownerName}, Country: ${contact.country || ''}
Sector: ${enrichData.sector || 'manufacturing'}, Website: ${contact.website || 'N/A'}
This is email #${sc.current_step + 1} of ${steps.length}. Angle: ${step.angle}
Subject hint: ${step.subject.replace(/\{\{name\}\}/g, ownerName).replace(/\{\{company\}\}/g, companyName)}

WE ARE BlackWolf Security (web.blackwolfsec.io) — ERP + Cybersecurity + Automation for €10,000.
${step.type === 'followup' ? 'Reference the previous email. Keep it shorter (100 words max).' : ''}
${step.type === 'last_chance' ? 'Create urgency. Offer free audit. Last email in sequence.' : ''}

CTA button "Agendar llamada" links to https://web.blackwolfsec.io
Button style: background #FF6B00, white text, rounded.
Return ONLY JSON: {"subject":"...","html":"<professional dark email>"}` }]
          })
          const text = aiRes.content[0]?.text || ''
          const match = text.match(/\{[\s\S]*\}/)
          emailContent = match ? JSON.parse(match[0]) : { subject: step.subject, html: `<p>${ownerName}, visit web.blackwolfsec.io</p>` }
        } catch (e) {
          emailContent = { subject: step.subject, html: `<p>${ownerName}, visit web.blackwolfsec.io</p>` }
        }

        // Personalize
        const subject = (emailContent.subject || '').replace(/\{\{name\}\}/g, ownerName).replace(/\{\{company\}\}/g, companyName)
        const html = (emailContent.html || '').replace(/\{\{name\}\}/g, ownerName).replace(/\{\{company\}\}/g, companyName)

        // Send
        try {
          const sendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${emailConfig.api_key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: `${emailConfig.from_name || 'BlackWolf'} <${emailConfig.from_email || 'onboarding@resend.dev'}>`, to: [toEmail], subject, html })
          })
          if (sendRes.ok) {
            sent++
            const nextStep = sc.current_step + 1
            const nextDay = steps[nextStep]?.day || 0
            const nextSendAt = new Date(now.getTime() + nextDay * 86400000)
            await supabase.from('email_sequence_contacts').update({
              current_step: nextStep, last_sent_at: now.toISOString(),
              next_send_at: nextStep < steps.length ? nextSendAt.toISOString() : null,
              status: nextStep >= steps.length ? 'completed' : 'active'
            }).eq('id', sc.id)
            await emitEvent(EVENTS.AGENT_EMAIL_SENT, 'onboarding', `sequence_step_${sc.current_step + 1}`, { to: toEmail, company: companyName, step: sc.current_step + 1, totalSteps: steps.length }, { clientId, contactId: sc.contact_id })
          }
        } catch (e) { /* skip */ }
      }

      return res.status(200).json({ action: 'onboarding', subAction: 'process-sequence', sent, skipped, total: (seqContacts || []).length })
    }

    // ── SUB-ACTION: Handle response (email reply detected) ──
    if (subAction === 'response-detected') {
      const { contactId, responseEmail } = req.body
      if (!contactId) return res.status(400).json({ error: 'contactId required' })

      // Move contact to "responded" in pipeline
      await supabase.from('crm_contacts').update({ status: 'responded', pipeline_id: SCRAP_PIPELINE_ID }).eq('id', contactId)

      // Stop sequence for this contact
      await supabase.from('email_sequence_contacts').update({ status: 'responded' }).eq('contact_id', contactId).eq('status', 'active')

      // Add activity
      await supabase.from('crm_activities').insert({
        client_id: clientId, contact_id: contactId, type: 'email',
        title: 'Respuesta recibida', description: responseEmail || 'El lead ha respondido al email de outreach',
        performed_by: 'Onboarding Agent', performed_at: new Date().toISOString()
      })

      await emitEvent('crm.lead_responded', 'onboarding', 'response_detected', { contactId, responseEmail }, { clientId, contactId })

      return res.status(200).json({ action: 'onboarding', subAction: 'response-detected', contactId, status: 'responded' })
    }

    // ── SUB-ACTION: Close deal → invoice + tenant ──
    if (subAction === 'close-deal') {
      const { contactId } = req.body
      if (!contactId) return res.status(400).json({ error: 'contactId required' })

      const { data: contact } = await supabase.from('crm_contacts').select('*').eq('id', contactId).single()
      if (!contact) return res.status(404).json({ error: 'Contact not found' })

      const results = { invoice: null, tenant: null }

      // 1. Move to "closed" in pipeline
      await supabase.from('crm_contacts').update({ status: 'closed', pipeline_id: SCRAP_PIPELINE_ID }).eq('id', contactId)

      // 2. Auto-generate invoice in BlackWolf ERP
      if (onbConfig.auto_invoice) {
        const BW_ERP = '957a296d-8432-4c2c-b73b-8788c0f12f4d'
        const invNumber = `FV-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`
        const price = onbConfig.default_price || 10000
        const tax = price * 0.21
        const { data: invoice } = await supabase.from('erp_invoices').insert({
          company_id: BW_ERP, type: 'sale', number: invNumber,
          date: new Date().toISOString().slice(0, 10),
          due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
          status: 'sent', subtotal: price, tax_total: tax, total: price + tax,
          notes: `${onbConfig.default_product} — ${contact.company || contact.name}`,
          lines: JSON.stringify([{ description: onbConfig.default_product, quantity: 1, unit_price: price, tax_rate: 21 }])
        }).select().single()
        results.invoice = invoice
        await emitEvent(EVENTS.ERP_INVOICE_CREATED, 'onboarding', 'invoice_created', { invoiceNumber: invNumber, company: contact.company, total: price + tax }, { clientId, contactId })
      }

      // 3. Auto-create tenant in Dashboard Central
      if (onbConfig.auto_tenant) {
        const slug = (contact.company || contact.name || '').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30)
        const { data: existingClient } = await supabase.from('clients').select('id').eq('slug', slug).limit(1)

        if (!existingClient || existingClient.length === 0) {
          const { data: newClient } = await supabase.from('clients').insert({
            name: contact.company || contact.name, slug, active: true
          }).select().single()

          if (newClient) {
            // Create default admin user
            const adminEmail = contact.owner_email || contact.email || ''
            if (adminEmail) {
              await supabase.from('team').insert({
                client_id: newClient.id, name: contact.owner_name || contact.name || 'Admin',
                email: adminEmail, password: `${slug}-2026`, role: 'ceo,director', active: true
              })
            }
            // Create default pipeline
            await supabase.from('crm_pipelines').insert({
              client_id: newClient.id, name: 'Default Pipeline', is_default: true,
              stages: JSON.stringify([
                { key: 'lead', label: 'Lead', color: '#6B7280' },
                { key: 'contacted', label: 'Contactado', color: '#3B82F6' },
                { key: 'qualified', label: 'Cualificado', color: '#8B5CF6' },
                { key: 'proposal', label: 'Propuesta', color: '#F59E0B' },
                { key: 'won', label: 'Ganado', color: '#22C55E' },
                { key: 'lost', label: 'Perdido', color: '#EF4444' }
              ])
            })
            results.tenant = { id: newClient.id, slug, url: `/${slug}`, login: adminEmail }
            await emitEvent('onboarding.tenant_created', 'onboarding', 'tenant_created', { company: contact.company, slug, clientId: newClient.id }, { clientId, contactId })
          }
        }
      }

      // Add activity
      await supabase.from('crm_activities').insert({
        client_id: clientId, contact_id: contactId, type: 'note',
        title: 'Deal cerrado — Onboarding automático',
        description: `Factura: ${results.invoice?.number || 'N/A'}\nTenant: ${results.tenant?.url || 'N/A'}`,
        performed_by: 'Onboarding Agent', performed_at: new Date().toISOString()
      })

      await emitEvent('onboarding.deal_closed', 'onboarding', 'deal_closed', { company: contact.company, invoice: results.invoice?.number, tenant: results.tenant?.slug }, { clientId, contactId })

      return res.status(200).json({ action: 'onboarding', subAction: 'close-deal', contactId, ...results })
    }

    // ── SUB-ACTION: Enroll contacts in sequence ──
    if (subAction === 'enroll') {
      const { contactIds } = req.body
      if (!contactIds || !contactIds.length) return res.status(400).json({ error: 'contactIds required' })

      const { data: sequence } = await supabase.from('email_sequences').select('*').eq('id', onbConfig.sequence_id).single()
      const steps = typeof sequence?.steps === 'string' ? JSON.parse(sequence.steps) : (sequence?.steps || [])
      const firstStepDay = steps[0]?.day || 0

      let enrolled = 0
      for (const cid of contactIds) {
        const { data: existing } = await supabase.from('email_sequence_contacts').select('id').eq('contact_id', cid).eq('sequence_id', onbConfig.sequence_id).limit(1)
        if (existing && existing.length > 0) continue

        await supabase.from('email_sequence_contacts').insert({
          client_id: clientId, sequence_id: onbConfig.sequence_id, contact_id: cid,
          current_step: 0, status: 'active',
          next_send_at: new Date(Date.now() + firstStepDay * 86400000).toISOString()
        })
        enrolled++
      }

      return res.status(200).json({ action: 'onboarding', subAction: 'enroll', enrolled, total: contactIds.length })
    }

    return res.status(400).json({ error: 'Unknown onboarding subAction: ' + subAction })
  }

  return res.status(400).json({ error: 'Unknown scrap action: ' + action })
}
