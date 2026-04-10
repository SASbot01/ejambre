import { supabase, toAppFormat, resolveClientId } from './lib/supabase.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  const action = req.query.action

  // POST ?action=login — SuperAdmin login
  if (req.method === 'POST' && action === 'login') {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'email and password required' })

    const { data, error } = await supabase
      .from('superadmins')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .eq('active', true)
      .limit(1)

    if (error) return res.status(500).json({ error: error.message })
    if (!data || data.length === 0) return res.status(401).json({ error: 'Invalid credentials' })

    const user = toAppFormat(data[0], 'superadmins')
    delete user.password
    return res.status(200).json({ success: true, user })
  }

  // POST ?action=setup-demo — Create full demo with realistic manufacturing data
  if (req.method === 'POST' && action === 'setup-demo') {
    try {
      // ── 1. SuperAdmin ──
      const { data: existing } = await supabase.from('superadmins').select('id').eq('email', 'demo@blackwolfsec.io').limit(1)
      if (!existing || existing.length === 0) {
        await supabase.from('superadmins').insert({ email: 'demo@blackwolfsec.io', password: 'demo123', name: 'Demo User', active: true })
      }

      // ── 2. Client ──
      let clientId
      const { data: existingClient } = await supabase.from('clients').select('id').eq('slug', 'demo-factory')
      if (existingClient && existingClient.length > 0) {
        clientId = existingClient[0].id
        await supabase.from('clients').update({ name: 'TextilPro Manufacturing', active: true }).eq('id', clientId)
      } else {
        const { data: nc, error: ncErr } = await supabase.from('clients').insert({
          name: 'TextilPro Manufacturing',
          slug: 'demo-factory',
          active: true,
        }).select('id')
        if (ncErr) return res.status(500).json({ error: 'Client insert error: ' + ncErr.message })
        clientId = nc?.[0]?.id
      }
      if (!clientId) return res.status(500).json({ error: 'Failed to get client ID' })

      // Clean previous demo data
      await Promise.all([
        supabase.from('team').delete().eq('client_id', clientId),
        supabase.from('products').delete().eq('client_id', clientId),
        supabase.from('sales').delete().eq('client_id', clientId),
        supabase.from('reports').delete().eq('client_id', clientId),
        supabase.from('projections').delete().eq('client_id', clientId),
        supabase.from('payment_fees').delete().eq('client_id', clientId),
        supabase.from('crm_contacts').delete().eq('client_id', clientId),
        supabase.from('crm_activities').delete().eq('client_id', clientId),
      ])

      // ── 3. Team (manufacturing sales team) ──
      await supabase.from('team').insert([
        { client_id: clientId, name: 'Roberto Marin', email: 'roberto@textilpro.com', password: 'demo123', role: 'director', commission_rate: 0.05, active: true },
        { client_id: clientId, name: 'Elena Torres', email: 'elena@textilpro.com', password: 'demo123', role: 'manager', commission_rate: 0.06, active: true },
        { client_id: clientId, name: 'David Navarro', email: 'david@textilpro.com', password: 'demo123', role: 'closer', commission_rate: 0.10, active: true },
        { client_id: clientId, name: 'Sofia Ruiz', email: 'sofia@textilpro.com', password: 'demo123', role: 'closer', commission_rate: 0.10, active: true },
        { client_id: clientId, name: 'Pablo Garcia', email: 'pablo@textilpro.com', password: 'demo123', role: 'setter', commission_rate: 0.04, active: true },
        { client_id: clientId, name: 'Maria Lopez', email: 'maria@textilpro.com', password: 'demo123', role: 'setter', commission_rate: 0.04, active: true },
      ])

      // ── 4. Products (manufacturing services) ──
      await supabase.from('products').insert([
        { client_id: clientId, name: 'ERP Produccion Industrial', price: 18000, active: true },
        { client_id: clientId, name: 'Sistema SOC + Ciberseguridad', price: 12000, active: true },
        { client_id: clientId, name: 'Automatizacion de Planta', price: 25000, active: true },
        { client_id: clientId, name: 'CRM + Pipeline Comercial', price: 8000, active: true },
        { client_id: clientId, name: 'Consultoria Industry 4.0', price: 6000, active: true },
        { client_id: clientId, name: 'Mantenimiento Anual', price: 3600, active: true },
      ])

      // ── 5. Payment methods ──
      await supabase.from('payment_fees').insert([
        { client_id: clientId, method: 'Transferencia Bancaria', fee_rate: 0.00 },
        { client_id: clientId, method: 'Stripe', fee_rate: 0.029 },
        { client_id: clientId, method: 'PayPal', fee_rate: 0.035 },
        { client_id: clientId, method: 'Financiacion', fee_rate: 0.05 },
      ])

      // ── 6. Sales (last 3 months, manufacturing contracts) ──
      const now = new Date()
      const sales = []
      const closers = ['David Navarro', 'Sofia Ruiz']
      const setters = ['Pablo Garcia', 'Maria Lopez']
      const products = ['ERP Produccion Industrial', 'Sistema SOC + Ciberseguridad', 'Automatizacion de Planta', 'CRM + Pipeline Comercial', 'Consultoria Industry 4.0', 'Mantenimiento Anual']
      const prices = [18000, 12000, 25000, 8000, 6000, 3600]
      const methods = ['Transferencia Bancaria', 'Stripe', 'Financiacion']
      const countries = ['Espana', 'Portugal', 'Italia', 'Francia', 'Alemania']
      const factoryNames = [
        'Textil Iberica SL', 'FabriTex Portugal Lda', 'Tessuti Milano SRL', 'Filature Lyon SARL',
        'Weber Textil GmbH', 'Confecciones Levante SA', 'Hilados del Norte SL', 'TejidosPro SL',
        'Manufactura Andaluza SL', 'Cotton Express PT', 'Fibre Italia SpA', 'MegaTex France',
        'Stoff Berlin GmbH', 'Lana Gallega SL', 'Seda Valencia SL', 'EuroFabric BV',
        'Textil Castilla SL', 'TejidoSur SA', 'FabricaPlus SL', 'IndustriaTex SL',
        'Hilaturas Catalanas SL', 'TexPort Lda', 'Moda Industria SRL', 'Filatex SARL',
        'BayernStoff GmbH', 'AlgodonPro SL', 'SedaFina SL', 'TelaMax SL',
      ]

      for (let m = 2; m >= 0; m--) {
        const month = new Date(now.getFullYear(), now.getMonth() - m, 1)
        const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
        const salesCount = m === 0 ? 8 + Math.floor(Math.random() * 5) : 10 + Math.floor(Math.random() * 8)

        for (let s = 0; s < salesCount; s++) {
          const day = Math.min(1 + Math.floor(Math.random() * daysInMonth), m === 0 ? now.getDate() : daysInMonth)
          const date = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const pi = Math.floor(Math.random() * products.length)
          const revenue = prices[pi]
          const discount = Math.random() < 0.3 ? Math.round(revenue * 0.1) : 0
          const finalRevenue = revenue - discount
          const cashCollected = Math.random() < 0.7 ? finalRevenue : Math.round(finalRevenue * 0.5)
          const fIdx = (m * salesCount + s) % factoryNames.length

          sales.push({
            client_id: clientId,
            date,
            closer: closers[s % closers.length],
            setter: setters[s % setters.length],
            product: products[pi],
            revenue: finalRevenue,
            cash_collected: cashCollected,
            payment_method: methods[Math.floor(Math.random() * methods.length)],
            payment_type: cashCollected < finalRevenue ? 'Cuotas' : 'Pago unico',
            status: 'Completada',
            client_name: factoryNames[fIdx],
            pais: countries[Math.floor(Math.random() * countries.length)],
          })
        }
      }
      await supabase.from('sales').insert(sales)

      // ── 7. Daily reports (last 20 days) ──
      const reports = []
      for (let d = 19; d >= 0; d--) {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d)
        if (date.getDay() === 0 || date.getDay() === 6) continue // skip weekends
        const dateStr = date.toISOString().split('T')[0]

        // Setters
        for (const setter of setters) {
          reports.push({
            client_id: clientId, name: setter, role: 'setter', date: dateStr,
            conversations_opened: 15 + Math.floor(Math.random() * 20),
            follow_ups: 8 + Math.floor(Math.random() * 12),
            offers_launched: 3 + Math.floor(Math.random() * 6),
            appointments_booked: 2 + Math.floor(Math.random() * 4),
          })
        }
        // Closers
        for (const closer of closers) {
          reports.push({
            client_id: clientId, name: closer, role: 'closer', date: dateStr,
            scheduled_calls: 4 + Math.floor(Math.random() * 5),
            calls_made: 3 + Math.floor(Math.random() * 5),
            offers_launched: 2 + Math.floor(Math.random() * 4),
            deposits: Math.floor(Math.random() * 3),
            closes: Math.floor(Math.random() * 2),
          })
        }
      }
      await supabase.from('reports').insert(reports)

      // ── 8. Projections ──
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      await supabase.from('projections').insert([
        { client_id: clientId, type: 'company', period: currentMonth, period_type: 'monthly', target_name: 'TextilPro', target_value: 120000, metric: 'cash' },
        { client_id: clientId, type: 'closer', period: currentMonth, period_type: 'monthly', target_name: 'David Navarro', target_value: 60000, metric: 'cash' },
        { client_id: clientId, type: 'closer', period: currentMonth, period_type: 'monthly', target_name: 'Sofia Ruiz', target_value: 60000, metric: 'cash' },
        { client_id: clientId, type: 'setter', period: currentMonth, period_type: 'monthly', target_name: 'Pablo Garcia', target_value: 30, metric: 'agendas' },
        { client_id: clientId, type: 'setter', period: currentMonth, period_type: 'monthly', target_name: 'Maria Lopez', target_value: 30, metric: 'agendas' },
      ])

      // ── 9. CRM Contacts (factory leads / prospects) ──
      const crmContacts = [
        { name: 'Antonio Ferrer', company: 'Ferrer Textiles SA', email: 'aferrer@ferrertextiles.es', phone: '+34 612 345 678', position: 'Director General', country: 'Espana', status: 'contacted', notes: 'Interesado en ERP + automatizacion. Planta en Valencia con 120 empleados.' },
        { name: 'Lucia Martins', company: 'TecidoLuso Lda', email: 'lucia@tecidoluso.pt', phone: '+351 912 345 678', position: 'CEO', country: 'Portugal', status: 'negotiation', notes: 'Fabrica de tejidos tecnicos en Braga. Quiere SOC + CRM. Presupuesto aprobado.' },
        { name: 'Marco Bianchi', company: 'Tessiture Bianchi SRL', email: 'marco@tessiturebianchi.it', phone: '+39 333 456 789', position: 'Director de Operaciones', country: 'Italia', status: 'raw', notes: 'Contacto via LinkedIn. Fabrica de seda en Como.' },
        { name: 'Pierre Dupont', company: 'Filature Dupont SARL', email: 'p.dupont@filaturedupont.fr', phone: '+33 6 12 34 56 78', position: 'Directeur', country: 'Francia', status: 'won', notes: 'Cerrado ERP + Consultoria. Implementacion en enero.' },
        { name: 'Hans Mueller', company: 'Mueller Stoffe GmbH', email: 'h.mueller@muellerstoffe.de', phone: '+49 171 234 5678', position: 'Geschaftsfuhrer', country: 'Alemania', status: 'contacted', notes: 'Gran fabrica de telas industriales en Baviera. 250 empleados.' },
        { name: 'Carmen Vidal', company: 'Confecciones Vidal SL', email: 'carmen@confeccionesvidal.es', phone: '+34 622 987 654', position: 'Directora Comercial', country: 'Espana', status: 'negotiation', notes: 'Quiere CRM + automatizacion de pipeline. Seguimiento semanal.' },
        { name: 'Rita Santos', company: 'AlgodaoNorte PT', email: 'rita@algodaonorte.pt', phone: '+351 922 876 543', position: 'COO', country: 'Portugal', status: 'raw', notes: 'Referido por TecidoLuso. Fabrica de algodon organico.' },
        { name: 'Giuseppe Romano', company: 'Romano Filati SpA', email: 'g.romano@romanofilati.it', phone: '+39 348 765 432', position: 'Admin Delegato', country: 'Italia', status: 'won', notes: 'Cerrado paquete completo: ERP + SOC + CRM. Cliente premium.' },
        { name: 'Stefan Klein', company: 'Klein Weberei AG', email: 's.klein@kleinweberei.ch', phone: '+41 79 123 45 67', position: 'CEO', country: 'Suiza', status: 'contacted', notes: 'Tejeduria de precision. Alto poder adquisitivo. Quiere Industry 4.0.' },
        { name: 'Ana Beleza', company: 'ModaTex Barcelona SL', email: 'ana@modatex.es', phone: '+34 633 456 789', position: 'Responsable IT', country: 'Espana', status: 'lost', notes: 'Perdido por precio. Podria reactivarse en Q2.' },
        { name: 'Jean-Luc Martin', company: 'Martin Tissages SA', email: 'jl.martin@martintissages.fr', phone: '+33 7 65 43 21 09', position: 'DG', country: 'Francia', status: 'negotiation', notes: 'Propuesta enviada. Esperando aprobacion del consejo.' },
        { name: 'Thomas Weber', company: 'Weber Industrietextil GmbH', email: 't.weber@weberit.de', phone: '+49 160 987 6543', position: 'Leiter Produktion', country: 'Alemania', status: 'raw', notes: 'Contacto en feria Techtextil. Textiles industriales para automocion.' },
      ]

      for (const contact of crmContacts) {
        const { data: inserted } = await supabase.from('crm_contacts').insert({
          client_id: clientId,
          name: contact.name,
          company: contact.company,
          email: contact.email,
          phone: contact.phone,
          position: contact.position,
          country: contact.country,
          status: contact.status,
          notes: contact.notes,
          source: 'Demo Data',
          tags: JSON.stringify(['textil', 'manufactura', 'europa']),
        }).select('id').single()

        if (inserted) {
          await supabase.from('crm_activities').insert({
            client_id: clientId, contact_id: inserted.id, type: 'note',
            title: `Lead ${contact.status === 'won' ? 'cerrado' : 'registrado'}`,
            description: contact.notes,
            performed_by: 'Sistema',
          })
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Demo completa creada: demo@blackwolfsec.io / demo123 → TextilPro Manufacturing',
        clientSlug: 'demo-factory',
        data: {
          team: 6, products: 6, sales: sales.length, reports: reports.length,
          projections: 5, paymentMethods: 4, crmContacts: crmContacts.length,
        },
      })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // POST ?action=setup-client-types — Add client_type column and categorize clients
  if (req.method === 'POST' && action === 'setup-client-types') {
    try {
      // Add column if not exists (Supabase will ignore if already exists via RPC, but we use update directly)
      // Categorize existing clients
      const categories = {
        'black-wolf': 'admin',
        'detras-de-camara': 'growth',
        'enformaconhugo': 'growth',
        'fba-academy': 'growth',
        'luxury-interiors': 'growth',
        'demo-factory': 'manufactura',
      }

      for (const [slug, type] of Object.entries(categories)) {
        await supabase.from('clients').update({ client_type: type }).eq('slug', slug)
      }

      // Create a second manufactura demo client
      const { data: exists } = await supabase.from('clients').select('id').eq('slug', 'plasticos-europa')
      if (!exists || exists.length === 0) {
        const { data: nc } = await supabase.from('clients').insert({
          name: 'PlasticosEuropa Industrial',
          slug: 'plasticos-europa',
          active: true,
          client_type: 'manufactura',
        }).select('id')

        if (nc?.[0]?.id) {
          const cid = nc[0].id
          // Add minimal team + products
          await supabase.from('team').insert([
            { client_id: cid, name: 'Jorge Mendez', email: 'jorge@plasticoseuropa.es', password: 'demo123', role: 'director', commission_rate: 0.05, active: true },
            { client_id: cid, name: 'Carla Vega', email: 'carla@plasticoseuropa.es', password: 'demo123', role: 'closer', commission_rate: 0.10, active: true },
            { client_id: cid, name: 'Ruben Soto', email: 'ruben@plasticoseuropa.es', password: 'demo123', role: 'setter', commission_rate: 0.04, active: true },
          ])
          await supabase.from('products').insert([
            { client_id: cid, name: 'ERP Produccion Plasticos', price: 20000, active: true },
            { client_id: cid, name: 'Control de Calidad IoT', price: 15000, active: true },
            { client_id: cid, name: 'Ciberseguridad Industrial', price: 10000, active: true },
          ])
          // Sample sales
          const now = new Date()
          const sales = []
          for (let i = 0; i < 12; i++) {
            const day = 1 + Math.floor(Math.random() * Math.min(now.getDate(), 28))
            sales.push({
              client_id: cid,
              date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
              closer: 'Carla Vega', setter: 'Ruben Soto',
              product: ['ERP Produccion Plasticos', 'Control de Calidad IoT', 'Ciberseguridad Industrial'][i % 3],
              revenue: [20000, 15000, 10000][i % 3],
              cash_collected: [20000, 15000, 10000][i % 3] * (Math.random() < 0.6 ? 1 : 0.5),
              payment_method: 'Transferencia Bancaria',
              payment_type: 'Pago unico',
              status: 'Completada',
              client_name: ['PolymerTech SL', 'Envases Rapid SA', 'MoldPro GmbH', 'PlastForm Italia'][i % 4],
              pais: ['Espana', 'Alemania', 'Italia', 'Francia'][i % 4],
            })
          }
          await supabase.from('sales').insert(sales)
        }
      } else {
        await supabase.from('clients').update({ client_type: 'manufactura' }).eq('slug', 'plasticos-europa')
      }

      return res.status(200).json({ success: true, message: 'Client types configured: admin, growth, manufactura. New client PlasticosEuropa created.' })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // POST ?action=delete-sales — Delete sales by IDs
  if (req.method === 'POST' && action === 'delete-sales') {
    const { ids } = req.body
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' })
    const { error } = await supabase.from('sales').delete().in('id', ids)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true, deleted: ids.length })
  }

  // GET ?action=nodos — Full node graph data
  if (req.method === 'GET' && action === 'nodos') {
    try {
      const now = new Date()
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

      const [
        { data: clients },
        { data: allTeam },
        { data: allContacts },
        { data: allProducts },
        { data: recentSales },
        { data: recentReports },
        { data: crmActivities },
        { data: agentRuns },
      ] = await Promise.all([
        supabase.from('clients').select('id, name, slug, client_type, active, logo_url').eq('active', true).order('name'),
        supabase.from('team').select('id, client_id, name, role, email, active').eq('active', true),
        supabase.from('crm_contacts').select('id, client_id, name, company, status, country, source, created_at').order('created_at', { ascending: false }).limit(150),
        supabase.from('products').select('id, client_id, name, price, active').eq('active', true),
        supabase.from('sales_with_net_cash').select('id, client_id, date, closer, setter, product, revenue, cash_collected, net_cash, status, client_name, pais').gte('date', monthStart).order('date', { ascending: false }).limit(100),
        supabase.from('reports').select('id, client_id, name, role, date, conversations_opened, appointments_booked, calls_made, closes').gte('date', monthStart).order('date', { ascending: false }).limit(100),
        supabase.from('crm_activities').select('id, client_id, contact_id, type, title, description, performed_by, created_at').order('created_at', { ascending: false }).limit(80),
        supabase.from('agent_runs').select('id, client_id, agent_type, status, results_summary, created_at').order('created_at', { ascending: false }).limit(30),
      ])

      // Build client nodes with real business data
      const clientNodes = (clients || []).map(c => {
        const cSales = (recentSales || []).filter(s => s.client_id === c.id)
        const cContacts = (allContacts || []).filter(ct => ct.client_id === c.id)
        const cTeam = (allTeam || []).filter(t => t.client_id === c.id)
        const cProducts = (allProducts || []).filter(p => p.client_id === c.id)
        const cReports = (recentReports || []).filter(r => r.client_id === c.id)
        const cActivities = (crmActivities || []).filter(a => a.client_id === c.id)
        const cRuns = (agentRuns || []).filter(r => r.client_id === c.id)

        return {
          id: `client-${c.slug}`, label: c.name, slug: c.slug, type: 'client',
          category: c.client_type || 'growth',
          team: cTeam.map(t => ({ id: `team-${t.id}`, name: t.name, role: t.role, email: t.email })),
          contacts: cContacts.map(ct => ({ id: `contact-${ct.id}`, name: ct.name, company: ct.company, status: ct.status, country: ct.country, source: ct.source, created_at: ct.created_at })),
          products: cProducts.map(p => ({ id: `product-${p.id}`, name: p.name, price: p.price })),
          sales: cSales.map(s => ({ id: `sale-${s.id}`, date: s.date, closer: s.closer, setter: s.setter, product: s.product, revenue: s.revenue, cash: s.cash_collected, client_name: s.client_name, pais: s.pais, status: s.status })),
          reports: cReports.map(r => ({ id: `report-${r.id}`, name: r.name, role: r.role, date: r.date, conversations: r.conversations_opened, agendas: r.appointments_booked, calls: r.calls_made, closes: r.closes })),
          activities: cActivities.slice(0, 20).map(a => ({ id: `activity-${a.id}`, type: a.type, title: a.title, by: a.performed_by, at: a.created_at })),
          agentRuns: cRuns.map(r => { let summary = null; try { summary = r.results_summary ? JSON.parse(r.results_summary) : null } catch {} return { id: `run-${r.id}`, type: r.agent_type, status: r.status, at: r.created_at, summary } }),
          metrics: {
            revenue: cSales.reduce((s, v) => s + Number(v.revenue || 0), 0),
            cash: cSales.reduce((s, v) => s + Number(v.cash_collected || 0), 0),
            salesCount: cSales.length,
            contactsCount: cContacts.length,
            teamCount: cTeam.length,
            productsCount: cProducts.length,
            newLeads: cContacts.filter(ct => ct.status === 'raw').length,
            wonDeals: cContacts.filter(ct => ct.status === 'won').length,
          },
        }
      })

      const agentNodes = [
        { id: 'agent-cerebro', label: 'CEREBRO', type: 'agent', color: '#FF6B00', sub: 'Orquestador' },
        { id: 'agent-ciber', label: 'CIBER/SOC', type: 'agent', color: '#EF4444', sub: 'Ciberseguridad' },
        { id: 'agent-crm', label: 'CRM', type: 'agent', color: '#3B82F6', sub: 'Ventas' },
        { id: 'agent-ops', label: 'OPS/ERP', type: 'agent', color: '#22C55E', sub: 'Operaciones' },
        { id: 'agent-forms', label: 'FORMS', type: 'agent', color: '#A855F7', sub: 'Captura' },
        { id: 'agent-dev', label: 'DEV', type: 'agent', color: '#10B981', sub: 'Desarrollo' },
        { id: 'agent-prospector', label: 'PROSPECTOR', type: 'agent', color: '#EC4899', sub: 'Scrapper' },
      ]

      // Business flow edges (real connections)
      const flows = [
        { from: 'agent-prospector', to: 'agent-crm', label: 'Leads scrapeados', count: (allContacts || []).filter(c => c.source === 'Agente Prospector').length },
        { from: 'agent-forms', to: 'agent-crm', label: 'Leads capturados', count: (allContacts || []).filter(c => c.source === 'webhook' || c.source === 'form').length },
        { from: 'agent-crm', to: 'agent-ops', label: 'Ventas cerradas', count: (recentSales || []).length },
        { from: 'agent-cerebro', to: 'agent-ciber', label: 'Monitoreo SOC' },
        { from: 'agent-cerebro', to: 'agent-crm', label: 'Orquestacion CRM' },
        { from: 'agent-cerebro', to: 'agent-ops', label: 'Orquestacion OPS' },
        { from: 'agent-cerebro', to: 'agent-dev', label: 'Tareas dev' },
      ]

      return res.status(200).json({
        clients: clientNodes,
        agents: agentNodes,
        flows,
        summary: {
          totalClients: clientNodes.length,
          totalTeam: (allTeam || []).length,
          totalContacts: (allContacts || []).length,
          totalProducts: (allProducts || []).length,
          totalSales: (recentSales || []).length,
          totalRevenue: (recentSales || []).reduce((s, v) => s + Number(v.revenue || 0), 0),
          totalAgentRuns: (agentRuns || []).length,
          byType: {
            admin: clientNodes.filter(c => c.category === 'admin').length,
            growth: clientNodes.filter(c => c.category === 'growth').length,
            manufactura: clientNodes.filter(c => c.category === 'manufactura').length,
          },
        },
      })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // GET ?action=clients — List all clients with summary metrics
  if (req.method === 'GET' && action === 'clients') {
    const { data: clients, error } = await supabase
      .from('clients')
      .select('*')
      .order('name')

    if (error) return res.status(500).json({ error: error.message })

    // Get current month date range
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`

    // Get commissions
    const { data: commissions } = await supabase
      .from('superadmin_commissions')
      .select('*')

    // Get sales summary per client for current month
    const enriched = await Promise.all(clients.map(async (client) => {
      const { data: sales } = await supabase
        .from('sales')
        .select('revenue, cash_collected, status')
        .eq('client_id', client.id)
        .gte('date', monthStart)
        .lt('date', monthEnd)

      const totalRevenue = (sales || []).reduce((sum, s) => sum + Number(s.revenue || 0), 0)
      const totalCash = (sales || []).reduce((sum, s) => sum + Number(s.cash_collected || 0), 0)
      const totalSales = (sales || []).length
      const commission = commissions?.find(c => c.client_id === client.id)

      return {
        ...toAppFormat(client, 'clients'),
        monthRevenue: totalRevenue,
        monthCash: totalCash,
        monthSales: totalSales,
        commissionRate: commission ? Number(commission.commission_rate) : 0,
        commissionEarned: commission ? Math.round(totalCash * Number(commission.commission_rate)) : 0,
      }
    }))

    return res.status(200).json({ clients: enriched })
  }

  // GET ?action=dashboard — Aggregated global dashboard
  if (req.method === 'GET' && action === 'dashboard') {
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`

    const { data: sales } = await supabase
      .from('sales_with_net_cash')
      .select('*')
      .gte('date', monthStart)
      .lt('date', monthEnd)

    const { data: clients } = await supabase.from('clients').select('*').eq('active', true)
    const { data: commissions } = await supabase.from('superadmin_commissions').select('*')

    const totalRevenue = (sales || []).reduce((sum, s) => sum + Number(s.revenue || 0), 0)
    const totalCash = (sales || []).reduce((sum, s) => sum + Number(s.cash_collected || 0), 0)
    const totalNetCash = (sales || []).reduce((sum, s) => sum + Number(s.net_cash || 0), 0)

    // Commission per client
    const clientSummaries = (clients || []).map(c => {
      const clientSales = (sales || []).filter(s => s.client_id === c.id)
      const cash = clientSales.reduce((sum, s) => sum + Number(s.cash_collected || 0), 0)
      const revenue = clientSales.reduce((sum, s) => sum + Number(s.revenue || 0), 0)
      const comm = commissions?.find(co => co.client_id === c.id)
      const rate = comm ? Number(comm.commission_rate) : 0

      return {
        clientId: c.id,
        clientName: c.name,
        clientSlug: c.slug,
        logoUrl: c.logo_url,
        revenue,
        cash,
        salesCount: clientSales.length,
        commissionRate: rate,
        commissionEarned: Math.round(cash * rate),
      }
    })

    const totalCommission = clientSummaries.reduce((sum, c) => sum + c.commissionEarned, 0)

    return res.status(200).json({
      totalRevenue,
      totalCash,
      totalNetCash,
      totalSales: (sales || []).length,
      totalCommission,
      clients: clientSummaries,
    })
  }

  // GET ?action=commissions — SuperAdmin commission details
  if (req.method === 'GET' && action === 'commissions') {
    const { data, error } = await supabase
      .from('superadmin_commissions')
      .select('*, clients(name, slug, logo_url)')

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ commissions: data })
  }

  // PUT ?action=commission — Update commission rate for a client
  if (req.method === 'PUT' && action === 'commission') {
    const { clientId, commissionRate } = req.body
    if (!clientId) return res.status(400).json({ error: 'clientId is required' })

    const { data, error } = await supabase
      .from('superadmin_commissions')
      .update({ commission_rate: commissionRate })
      .eq('client_id', clientId)
      .select()

    if (error) return res.status(500).json({ error: error.message })
    if (!data || data.length === 0) {
      // Insert if not exists
      const { data: inserted, error: insertErr } = await supabase
        .from('superadmin_commissions')
        .insert({ client_id: clientId, commission_rate: commissionRate })
        .select()
      if (insertErr) return res.status(500).json({ error: insertErr.message })
      return res.status(200).json({ success: true, commission: inserted[0] })
    }

    return res.status(200).json({ success: true, commission: data[0] })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
