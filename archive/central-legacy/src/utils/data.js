import { supabase, toDb, toApp } from './supabase'

// Normalize date strings to YYYY-MM-DD for PostgreSQL
function normalizeDate(val) {
  if (!val || val === '') return new Date().toISOString().split('T')[0]
  const str = String(val).trim()
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  // DD/MM/YYYY or DD-MM-YYYY
  const parts = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/)
  if (parts) {
    let [, a, b, year] = parts
    let day, month
    if (parseInt(a) > 12) { day = a; month = b }
    else if (parseInt(b) > 12) { month = a; day = b }
    else { day = a; month = b } // Default DD/MM/YYYY
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  // Try native parsing
  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0]
  return new Date().toISOString().split('T')[0]
}

// ---- SALES ----
export async function getSales(clientId) {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .eq('client_id', clientId)
    .order('date', { ascending: false })
  if (error) throw error
  return data.map(row => toApp(row, 'sales'))
}

export async function addSale(sale, clientId) {
  const dbSale = toDb(sale, 'sales')
  delete dbSale.id
  dbSale.client_id = clientId
  const { data, error } = await supabase
    .from('sales')
    .insert(dbSale)
    .select()
    .single()
  if (error) throw error
  return toApp(data, 'sales')
}

export async function addSales(sales, clientId) {
  const dbSales = sales.map(s => {
    s.date = normalizeDate(s.date)
    const d = toDb(s, 'sales')
    delete d.id
    d.client_id = clientId
    return d
  })
  const { data, error } = await supabase
    .from('sales')
    .insert(dbSales)
    .select()
  if (error) throw error
  return data.map(row => toApp(row, 'sales'))
}

export async function updateSale(id, updates, clientId) {
  const dbUpdates = toDb(updates, 'sales')
  delete dbUpdates.id
  delete dbUpdates.client_id
  let query = supabase.from('sales').update(dbUpdates).eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

export async function deleteSale(id, clientId) {
  let query = supabase.from('sales').delete().eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

export async function getSalesWithNetCash(clientId) {
  const { data, error } = await supabase
    .from('sales_with_net_cash')
    .select('*')
    .eq('client_id', clientId)
    .order('date', { ascending: false })
  if (error) throw error
  return data.map(row => {
    const sale = toApp(row, 'sales')
    sale.netCash = Number(row.net_cash) || 0
    return sale
  })
}

// ---- REPORTS ----
export async function getReports(clientId) {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('client_id', clientId)
    .order('date', { ascending: false })
  if (error) throw error
  return data.map(row => toApp(row, 'reports'))
}

export async function addReport(report, clientId) {
  const dbReport = toDb(report, 'reports')
  delete dbReport.id
  dbReport.client_id = clientId
  const { data, error } = await supabase
    .from('reports')
    .insert(dbReport)
    .select()
    .single()
  if (error) throw error
  return toApp(data, 'reports')
}

export async function addReports(reports, clientId) {
  const dbReports = reports.map(r => {
    r.date = normalizeDate(r.date)
    if (r.role) r.role = r.role.toLowerCase().trim()
    const d = toDb(r, 'reports')
    delete d.id
    d.client_id = clientId
    return d
  })
  const { data, error } = await supabase
    .from('reports')
    .insert(dbReports)
    .select()
  if (error) throw error
  return data.map(row => toApp(row, 'reports'))
}

export async function updateReport(id, updates, clientId) {
  const dbUpdates = toDb(updates, 'reports')
  delete dbUpdates.id
  delete dbUpdates.client_id
  let query = supabase.from('reports').update(dbUpdates).eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

export async function deleteReport(id, clientId) {
  let query = supabase.from('reports').delete().eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

// ---- TEAM ----
export async function getTeam(clientId) {
  const { data, error } = await supabase
    .from('team')
    .select('*')
    .eq('client_id', clientId)
    .order('name')
  if (error) throw error
  return data.map(row => toApp(row, 'team'))
}

export async function addMember(member, clientId) {
  const dbMember = toDb(member, 'team')
  delete dbMember.id
  dbMember.client_id = clientId
  const { data, error } = await supabase
    .from('team')
    .insert(dbMember)
    .select()
    .single()
  if (error) throw error
  return toApp(data, 'team')
}

export async function updateMember(id, updates, clientId) {
  const dbUpdates = toDb(updates, 'team')
  delete dbUpdates.id
  delete dbUpdates.client_id
  let query = supabase.from('team').update(dbUpdates).eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

export async function deleteMember(id, clientId) {
  let query = supabase.from('team').delete().eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

// ---- COMMISSION PAYMENTS ----
export async function getCommissionPayments(clientId) {
  const { data, error } = await supabase
    .from('commission_payments')
    .select('*')
    .eq('client_id', clientId)
    .order('period_start', { ascending: false })
  if (error || !data) return [] // Table may not exist yet or RLS blocks
  return data.map(row => toApp(row, 'commission_payments'))
}

export async function upsertCommissionPayment(payment, clientId) {
  // Check if exists for same member + period + role
  const { data: existing } = await supabase
    .from('commission_payments')
    .select('id')
    .eq('client_id', clientId)
    .eq('member_id', payment.memberId)
    .eq('period_start', payment.periodStart)
    .eq('period_end', payment.periodEnd)
    .eq('role', payment.role)
    .maybeSingle()

  const dbPayment = toDb(payment, 'commission_payments')
  if (existing) {
    delete dbPayment.client_id
    const { error } = await supabase
      .from('commission_payments')
      .update(dbPayment)
      .eq('id', existing.id)
    if (error) throw error
  } else {
    dbPayment.client_id = clientId
    const { error } = await supabase
      .from('commission_payments')
      .insert(dbPayment)
    if (error) throw error
  }
}

export async function toggleCommissionPaid(paymentId, paid) {
  const { error } = await supabase
    .from('commission_payments')
    .update({
      status: paid ? 'paid' : 'pending',
      paid_at: paid ? new Date().toISOString() : null,
    })
    .eq('id', paymentId)
  if (error) throw error
}

export async function authenticateUser(email, password, clientId) {
  const { data, error } = await supabase
    .from('team')
    .select('*')
    .eq('client_id', clientId)
    .eq('email', email)
    .eq('password', password)
    .eq('active', true)
    .maybeSingle()
  if (error || !data) return null
  return toApp(data, 'team')
}

// ---- PROJECTIONS ----
export async function getProjections(clientId) {
  const { data, error } = await supabase
    .from('projections')
    .select('*')
    .eq('client_id', clientId)
    .order('period', { ascending: false })
  if (error) throw error
  return data.map(row => toApp(row, 'projections'))
}

export async function addProjection(projection, clientId) {
  const dbProjection = toDb(projection, 'projections')
  delete dbProjection.id
  dbProjection.client_id = clientId
  const { data, error } = await supabase
    .from('projections')
    .insert(dbProjection)
    .select()
    .single()
  if (error) throw error
  return toApp(data, 'projections')
}

export async function updateProjection(id, updates, clientId) {
  const dbUpdates = toDb(updates, 'projections')
  delete dbUpdates.id
  delete dbUpdates.client_id
  let query = supabase.from('projections').update(dbUpdates).eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

export async function deleteProjection(id, clientId) {
  let query = supabase.from('projections').delete().eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

// ---- PRODUCTS ----
export async function getProducts(clientId) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('client_id', clientId)
    .order('name')
  if (error) throw error
  return data.map(row => toApp(row, 'products'))
}

export async function addProduct(product, clientId) {
  const dbProduct = toDb(product, 'products')
  delete dbProduct.id
  dbProduct.client_id = clientId
  const { data, error } = await supabase
    .from('products')
    .insert(dbProduct)
    .select()
    .single()
  if (error) throw error
  return toApp(data, 'products')
}

export async function updateProduct(id, updates, clientId) {
  const dbUpdates = toDb(updates, 'products')
  delete dbUpdates.id
  delete dbUpdates.client_id
  let query = supabase.from('products').update(dbUpdates).eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

export async function deleteProduct(id, clientId) {
  let query = supabase.from('products').delete().eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

// ---- PAYMENT FEES ----
export async function getPaymentFees(clientId) {
  const { data, error } = await supabase
    .from('payment_fees')
    .select('*')
    .eq('client_id', clientId)
    .order('method')
  if (error) throw error
  return data.map(row => toApp(row, 'payment_fees'))
}

export async function addPaymentFee(fee, clientId) {
  const dbFee = toDb(fee, 'payment_fees')
  delete dbFee.id
  dbFee.client_id = clientId
  const { data, error } = await supabase
    .from('payment_fees')
    .insert(dbFee)
    .select()
    .single()
  if (error) throw error
  return toApp(data, 'payment_fees')
}

export async function updatePaymentFee(id, updates, clientId) {
  const dbUpdates = toDb(updates, 'payment_fees')
  delete dbUpdates.id
  delete dbUpdates.client_id
  let query = supabase.from('payment_fees').update(dbUpdates).eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

export async function deletePaymentFee(id, clientId) {
  let query = supabase.from('payment_fees').delete().eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

// ---- INSTALLMENT PLANS ----
export async function getInstallmentPlans(clientId) {
  const { data, error } = await supabase
    .from('installment_plans')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(r => toApp(r, 'installment_plans'))
}

export async function addInstallmentPlan(plan, clientId) {
  const dbPlan = toDb(plan, 'installment_plans')
  dbPlan.client_id = clientId
  const { data, error } = await supabase.from('installment_plans').insert(dbPlan).select().single()
  if (error) throw error
  return toApp(data, 'installment_plans')
}

export async function updateInstallmentPlan(id, updates, clientId) {
  const dbUpdates = toDb(updates, 'installment_plans')
  delete dbUpdates.id
  delete dbUpdates.client_id
  let query = supabase.from('installment_plans').update(dbUpdates).eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

export async function deleteInstallmentPlan(id, clientId) {
  let query = supabase.from('installment_plans').delete().eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

export async function getInstallmentPayments(planId) {
  const { data, error } = await supabase
    .from('installment_payments')
    .select('*')
    .eq('plan_id', planId)
    .order('installment_number', { ascending: true })
  if (error) throw error
  return (data || []).map(r => toApp(r, 'installment_payments'))
}

export async function updateInstallmentPayment(id, updates) {
  const dbUpdates = toDb(updates, 'installment_payments')
  delete dbUpdates.id
  const { error } = await supabase.from('installment_payments').update(dbUpdates).eq('id', id)
  if (error) throw error
}

export async function createInstallmentPlanWithPayments(plan, clientId) {
  // Create plan
  const created = await addInstallmentPlan(plan, clientId)
  // Create all installment payment rows
  const rows = []
  for (let i = 1; i <= plan.totalInstallments; i++) {
    rows.push({
      plan_id: created.id,
      installment_number: i,
      amount: plan.amountPerInstallment,
      paid: false,
    })
  }
  if (rows.length > 0) {
    const { error } = await supabase.from('installment_payments').insert(rows)
    if (error) throw error
  }
  return created
}

// ---- N8N CONFIG ----
export async function getN8nConfig(clientId) {
  const { data, error } = await supabase
    .from('n8n_config')
    .select('*')
    .eq('client_id', clientId)
    .limit(1)
    .maybeSingle()
  if (error || !data) return { id: null, webhookUrl: '', apiKey: '', enabled: false, lastSync: null }
  return toApp(data, 'n8n_config')
}

export async function saveN8nConfig(config, clientId) {
  const dbConfig = toDb(config, 'n8n_config')
  if (config.id) {
    delete dbConfig.id
    delete dbConfig.client_id
    let query = supabase.from('n8n_config').update(dbConfig).eq('id', config.id)
    if (clientId) query = query.eq('client_id', clientId)
    const { error } = await query
    if (error) throw error
  } else {
    dbConfig.client_id = clientId
    const { error } = await supabase
      .from('n8n_config')
      .insert(dbConfig)
    if (error) throw error
  }
}

// ---- CEO MEETINGS ----
export async function getCeoMeetings(clientId) {
  const { data, error } = await supabase
    .from('ceo_meetings')
    .select('*')
    .eq('client_id', clientId)
    .order('date', { ascending: false })
  if (error) throw error
  return data.map(row => toApp(row, 'ceo_meetings'))
}

export async function addCeoMeeting(meeting, clientId) {
  const dbMeeting = toDb(meeting, 'ceo_meetings')
  delete dbMeeting.id
  dbMeeting.client_id = clientId
  const { data, error } = await supabase
    .from('ceo_meetings')
    .insert(dbMeeting)
    .select()
    .single()
  if (error) throw error
  return toApp(data, 'ceo_meetings')
}

export async function updateCeoMeeting(id, updates, clientId) {
  const dbUpdates = toDb(updates, 'ceo_meetings')
  delete dbUpdates.id
  delete dbUpdates.client_id
  let query = supabase.from('ceo_meetings').update(dbUpdates).eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

export async function deleteCeoMeeting(id, clientId) {
  let query = supabase.from('ceo_meetings').delete().eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

// ---- CEO PROJECTS ----
export async function getCeoProjects(clientId) {
  const { data, error } = await supabase
    .from('ceo_projects')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(row => toApp(row, 'ceo_projects'))
}

export async function addCeoProject(project, clientId) {
  const dbProject = toDb(project, 'ceo_projects')
  delete dbProject.id
  dbProject.client_id = clientId
  const { data, error } = await supabase
    .from('ceo_projects')
    .insert(dbProject)
    .select()
    .single()
  if (error) throw error
  return toApp(data, 'ceo_projects')
}

export async function updateCeoProject(id, updates, clientId) {
  const dbUpdates = toDb(updates, 'ceo_projects')
  delete dbUpdates.id
  delete dbUpdates.client_id
  let query = supabase.from('ceo_projects').update(dbUpdates).eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

export async function deleteCeoProject(id, clientId) {
  let query = supabase.from('ceo_projects').delete().eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

// ---- CEO IDEAS ----
export async function getCeoIdeas(clientId) {
  const { data, error } = await supabase
    .from('ceo_ideas')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(row => toApp(row, 'ceo_ideas'))
}

export async function addCeoIdea(idea, clientId) {
  const dbIdea = toDb(idea, 'ceo_ideas')
  delete dbIdea.id
  dbIdea.client_id = clientId
  const { data, error } = await supabase
    .from('ceo_ideas')
    .insert(dbIdea)
    .select()
    .single()
  if (error) throw error
  return toApp(data, 'ceo_ideas')
}

export async function updateCeoIdea(id, updates, clientId) {
  const dbUpdates = toDb(updates, 'ceo_ideas')
  delete dbUpdates.id
  delete dbUpdates.client_id
  let query = supabase.from('ceo_ideas').update(dbUpdates).eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

export async function deleteCeoIdea(id, clientId) {
  let query = supabase.from('ceo_ideas').delete().eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

// ---- CEO DAILY DIGESTS ----
export async function getCeoDailyDigests(clientId) {
  const { data, error } = await supabase
    .from('ceo_daily_digests')
    .select('*')
    .eq('client_id', clientId)
    .order('date', { ascending: false })
  if (error) throw error
  return data.map(row => toApp(row, 'ceo_daily_digests'))
}

// ---- CEO WEEKLY DIGESTS ----
export async function getCeoWeeklyDigests(clientId) {
  const { data, error } = await supabase
    .from('ceo_weekly_digests')
    .select('*')
    .eq('client_id', clientId)
    .order('week_start', { ascending: false })
  if (error) throw error
  return data.map(row => toApp(row, 'ceo_weekly_digests'))
}

// ---- CEO TEAM NOTES ----
export async function getCeoTeamNotes(clientId) {
  const { data, error } = await supabase
    .from('ceo_team_notes')
    .select('*')
    .eq('client_id', clientId)
  if (error) throw error
  return data.map(row => toApp(row, 'ceo_team_notes'))
}

export async function saveCeoTeamNote(memberId, note, clientId) {
  const { data: existing } = await supabase
    .from('ceo_team_notes')
    .select('id')
    .eq('client_id', clientId)
    .eq('member_id', memberId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('ceo_team_notes')
      .update({ note, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('ceo_team_notes')
      .insert({ client_id: clientId, member_id: memberId, note })
    if (error) throw error
  }
}

// ---- CEO INTEGRATIONS ----
export async function getCeoIntegrations(clientId) {
  const { data, error } = await supabase
    .from('ceo_integrations')
    .select('*')
    .eq('client_id', clientId)
  if (error) throw error
  return data.map(row => toApp(row, 'ceo_integrations'))
}

export async function saveCeoIntegration(integration, clientId) {
  const dbInt = toDb(integration, 'ceo_integrations')
  const { data: existing } = await supabase
    .from('ceo_integrations')
    .select('id')
    .eq('client_id', clientId)
    .eq('service', dbInt.service)
    .maybeSingle()

  if (existing) {
    delete dbInt.id
    delete dbInt.client_id
    delete dbInt.service
    const { error } = await supabase
      .from('ceo_integrations')
      .update(dbInt)
      .eq('id', existing.id)
    if (error) throw error
  } else {
    delete dbInt.id
    dbInt.client_id = clientId
    const { error } = await supabase
      .from('ceo_integrations')
      .insert(dbInt)
    if (error) throw error
  }
}

// ---- CEO FINANCE ENTRIES ----
export async function getCeoFinanceEntries(clientId) {
  const { data, error } = await supabase
    .from('ceo_finance_entries')
    .select('*')
    .eq('client_id', clientId)
    .order('date', { ascending: false })
  if (error) throw error
  return data.map(row => toApp(row, 'ceo_finance_entries'))
}

export async function addCeoFinanceEntry(entry, clientId) {
  const dbEntry = toDb(entry, 'ceo_finance_entries')
  delete dbEntry.id
  dbEntry.client_id = clientId
  const { data, error } = await supabase
    .from('ceo_finance_entries')
    .insert(dbEntry)
    .select()
    .single()
  if (error) throw error
  return toApp(data, 'ceo_finance_entries')
}

export async function updateCeoFinanceEntry(id, updates, clientId) {
  const dbUpdates = toDb(updates, 'ceo_finance_entries')
  delete dbUpdates.id
  delete dbUpdates.client_id
  let query = supabase.from('ceo_finance_entries').update(dbUpdates).eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

export async function deleteCeoFinanceEntry(id, clientId) {
  let query = supabase.from('ceo_finance_entries').delete().eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

export async function getCeoFinanceSummary(clientId, yearMonth) {
  const monthStart = `${yearMonth}-01`
  const [year, month] = yearMonth.split('-').map(Number)
  const nextMonth = new Date(year, month, 1)
  const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`

  const [salesRes, teamRes, entriesRes] = await Promise.all([
    supabase.from('sales_with_net_cash').select('*').eq('client_id', clientId).gte('date', monthStart).lt('date', monthEnd),
    supabase.from('team').select('*').eq('client_id', clientId),
    supabase.from('ceo_finance_entries').select('*').eq('client_id', clientId).gte('date', monthStart).lt('date', monthEnd),
  ])

  if (salesRes.error) throw salesRes.error
  if (teamRes.error) throw teamRes.error
  if (entriesRes.error) throw entriesRes.error

  const sales = salesRes.data || []
  const teamData = teamRes.data || []
  const entries = entriesRes.data || []

  const revenue = sales.reduce((s, v) => s + Number(v.revenue || 0), 0)
  const cashCollected = sales.reduce((s, v) => s + Number(v.cash_collected || 0), 0)
  const netCash = sales.reduce((s, v) => s + Number(v.net_cash || 0), 0)
  const fees = cashCollected - netCash

  // Commission calculation (matches CommissionsPage dual-role logic)
  let commissions = 0
  teamData.filter(m => m.active !== false).forEach(m => {
    const roles = (m.role || '').split(',').map(r => r.trim())
    const csStart = m.commission_start_date || null
    const mgmtStart = m.mgmt_commission_start_date || null
    const csSales = csStart ? sales.filter(s => s.date >= csStart) : sales
    const mgmtSales = mgmtStart ? sales.filter(s => s.date >= mgmtStart) : sales
    const mNetCash = mgmtSales.reduce((s, v) => s + Number(v.net_cash || 0), 0)
    const closerCash = csSales.filter(s => s.closer === m.name).reduce((s, v) => s + Number(v.net_cash || 0), 0)
    const setterCash = csSales.filter(s => s.setter === m.name).reduce((s, v) => s + Number(v.net_cash || 0), 0)
    const isMulti = (roles.includes('closer') || roles.includes('setter')) && (roles.includes('manager') || roles.includes('director'))
    if (isMulti) {
      if (roles.includes('closer')) commissions += Math.round(closerCash * Number(m.closer_commission_rate || m.commission_rate || 0))
      if (roles.includes('setter')) commissions += Math.round(setterCash * Number(m.setter_commission_rate || m.commission_rate || 0))
      commissions += Math.round(mNetCash * Number(m.commission_rate || 0))
    } else if (roles.includes('closer')) {
      commissions += Math.round(closerCash * Number(m.closer_commission_rate || m.commission_rate || 0))
    } else if (roles.includes('setter')) {
      commissions += Math.round(setterCash * Number(m.setter_commission_rate || m.commission_rate || 0))
    } else {
      commissions += Math.round(mNetCash * Number(m.commission_rate || 0))
    }
  })

  const opex = entries.reduce((s, e) => s + Number(e.amount || 0), 0)
  const opexByCategory = entries.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount || 0)
    return acc
  }, {})

  return {
    revenue,
    cashCollected,
    netCash,
    fees,
    commissions,
    opex,
    opexByCategory,
    netProfit: netCash - commissions - opex,
    salesCount: sales.length,
  }
}

// Import a sale from Close CRM format
export async function importSaleFromClose(data, clientId) {
  const sale = {
    date: data.date || new Date().toISOString().split('T')[0],
    clientName: data.contact_name || data.clientName || '',
    clientEmail: data.contact_email || data.clientEmail || '',
    clientPhone: data.contact_phone || data.clientPhone || '',
    instagram: data['Instagram'] || data.instagram || '',
    product: data.product || data['Producto Interes'] || data.productoInteres || '',
    productoInteres: data['Producto Interes'] || data.productoInteres || '',
    paymentType: data['Tipo de pago'] || data.paymentType || 'Pago único',
    installmentNumber: data['Número de cuota'] || data.installmentNumber || 'Pago único',
    paymentMethod: data['Método de pago'] || data.paymentMethod || 'Transferencia',
    revenue: Number(data['Revenue (€)'] || data.revenue) || 0,
    cashCollected: Number(data['Cash Collected (€)'] || data.cashCollected) || 0,
    closer: data['Closer Asignado'] || data.closer || '',
    setter: data['Setter Asignado'] || data.setter || '',
    triager: data['Triager Asignado'] || data.triager || '',
    gestorAsignado: data['Gestor Asignado'] || data.gestorAsignado || '',
    utmSource: data['UTM Source'] || data.utmSource || '',
    utmMedium: data['UTM Medium'] || data.utmMedium || '',
    utmCampaign: data['UTM Campaign'] || data.utmCampaign || '',
    utmContent: data['UTM Content'] || data.utmContent || '',
    pais: data['País'] || data.pais || '',
    capitalDisponible: data['Capital Disponible'] || data.capitalDisponible || '',
    situacionActual: data['Situación Actual'] || data.situacionActual || '',
    expAmazon: data['Exp Amazon'] || data.expAmazon || '',
    decisorConfirmado: data['Decisor Confirmado'] || data.decisorConfirmado || '',
    fechaLlamada: data['Fecha de Llamada'] || data.fechaLlamada || '',
    status: data.status || 'Completada',
    notes: data['Notas'] || data.notes || '',
    source: 'close_crm',
    closeActivityId: data.activity_id || null,
  }
  return addSale(sale, clientId)
}

// ---- CLIENTS ----
export async function getClientBySlug(slug) {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('slug', slug)
    .single()
  if (error || !data) return null
  return toApp(data, 'clients')
}

export async function getClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('name')
  if (error) throw error
  return data.map(row => toApp(row, 'clients'))
}

// ---- SUPERADMIN ----
export async function authenticateSuperAdmin(email, password) {
  const { data, error } = await supabase
    .from('superadmins')
    .select('*')
    .eq('email', email)
    .eq('password', password)
    .eq('active', true)
    .maybeSingle()
  if (error || !data) return null
  const user = toApp(data, 'superadmins')
  delete user.password
  return user
}

export async function getSuperAdminCommissions() {
  const { data, error } = await supabase
    .from('superadmin_commissions')
    .select('*, clients(name, slug, logo_url)')
  if (error) throw error
  return data
}

export async function updateSuperAdminCommission(clientId, rate) {
  const { data, error } = await supabase
    .from('superadmin_commissions')
    .update({ commission_rate: rate })
    .eq('client_id', clientId)
    .select()
  if (error) throw error
  if (!data || data.length === 0) {
    const { data: inserted, error: insertErr } = await supabase
      .from('superadmin_commissions')
      .insert({ client_id: clientId, commission_rate: rate })
      .select()
    if (insertErr) throw insertErr
    return inserted[0]
  }
  return data[0]
}

// ---- CRM CONTACTS ----
export async function getCrmContacts(clientId) {
  // Paginate to get all contacts (Supabase default limit is 1000)
  const all = []
  let from = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await supabase
      .from('crm_contacts')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1)
    if (error || !data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return all.map(row => toApp(row, 'crm_contacts'))
}

// Columns in crm_contacts that are DATE/TIMESTAMP — empty strings must be null
const CRM_CONTACT_DATE_COLS = ['fecha_llamada']
function sanitizeCrmContactDbRow(d) {
  for (const k of CRM_CONTACT_DATE_COLS) {
    if (d[k] === '' || d[k] === undefined) d[k] = null
  }
  return d
}

export async function addCrmContact(contact, clientId) {
  const dbContact = sanitizeCrmContactDbRow(toDb(contact, 'crm_contacts'))
  delete dbContact.id
  dbContact.client_id = clientId
  const { data, error } = await supabase
    .from('crm_contacts')
    .insert(dbContact)
    .select()
    .single()
  if (error) throw error
  return toApp(data, 'crm_contacts')
}

export async function addCrmContacts(contacts, clientId) {
  const dbContacts = contacts.map(c => {
    const d = sanitizeCrmContactDbRow(toDb(c, 'crm_contacts'))
    delete d.id
    d.client_id = clientId
    return d
  })
  const { data, error } = await supabase
    .from('crm_contacts')
    .insert(dbContacts)
    .select()
  if (error) throw error
  return data.map(row => toApp(row, 'crm_contacts'))
}

export async function bulkUpdateCrmContacts(ids, updates, clientId) {
  const dbUpdates = sanitizeCrmContactDbRow(toDb(updates, 'crm_contacts'))
  delete dbUpdates.id
  delete dbUpdates.client_id
  dbUpdates.updated_at = new Date().toISOString()
  let query = supabase.from('crm_contacts').update(dbUpdates).in('id', ids)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

export async function updateCrmContact(id, updates, clientId) {
  const dbUpdates = sanitizeCrmContactDbRow(toDb(updates, 'crm_contacts'))
  delete dbUpdates.id
  delete dbUpdates.client_id
  dbUpdates.updated_at = new Date().toISOString()
  let query = supabase.from('crm_contacts').update(dbUpdates).eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

export async function deleteCrmContact(id, clientId) {
  let query = supabase.from('crm_contacts').delete().eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

// ---- CRM ACTIVITIES ----
export async function getCrmActivities(clientId, contactId) {
  let query = supabase.from('crm_activities').select('*').eq('client_id', clientId)
  if (contactId) query = query.eq('contact_id', contactId)
  query = query.order('performed_at', { ascending: false })
  const { data, error } = await query
  if (error) return []
  return data.map(row => toApp(row, 'crm_activities'))
}

export async function addCrmActivity(activity, clientId) {
  const dbActivity = toDb(activity, 'crm_activities')
  delete dbActivity.id
  dbActivity.client_id = clientId
  const { data, error } = await supabase
    .from('crm_activities')
    .insert(dbActivity)
    .select()
    .single()
  if (error) throw error
  // Update contact's last_activity_at
  if (dbActivity.contact_id) {
    await supabase.from('crm_contacts').update({ last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', dbActivity.contact_id)
  }
  return toApp(data, 'crm_activities')
}

export async function deleteCrmActivity(id, clientId) {
  let query = supabase.from('crm_activities').delete().eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

// ---- CRM CUSTOM FIELDS ----
export async function getCrmCustomFields(clientId) {
  const { data, error } = await supabase
    .from('crm_custom_fields')
    .select('*')
    .eq('client_id', clientId)
    .eq('active', true)
    .order('position')
  if (error) return []
  return data.map(row => toApp(row, 'crm_custom_fields'))
}

export async function addCrmCustomField(field, clientId) {
  const dbField = toDb(field, 'crm_custom_fields')
  delete dbField.id
  dbField.client_id = clientId
  const { data, error } = await supabase
    .from('crm_custom_fields')
    .insert(dbField)
    .select()
    .single()
  if (error) throw error
  return toApp(data, 'crm_custom_fields')
}

export async function updateCrmCustomField(id, updates, clientId) {
  const dbUpdates = toDb(updates, 'crm_custom_fields')
  delete dbUpdates.id
  delete dbUpdates.client_id
  let query = supabase.from('crm_custom_fields').update(dbUpdates).eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

export async function deleteCrmCustomField(id, clientId) {
  let query = supabase.from('crm_custom_fields').update({ active: false }).eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

// ---- CRM SMART VIEWS ----
export async function getCrmSmartViews(clientId) {
  const { data, error } = await supabase
    .from('crm_smart_views')
    .select('*')
    .eq('client_id', clientId)
    .order('position')
  if (error) return []
  return data.map(row => toApp(row, 'crm_smart_views'))
}

export async function addCrmSmartView(view, clientId) {
  const dbView = toDb(view, 'crm_smart_views')
  delete dbView.id
  dbView.client_id = clientId
  const { data, error } = await supabase
    .from('crm_smart_views')
    .insert(dbView)
    .select()
    .single()
  if (error) throw error
  return toApp(data, 'crm_smart_views')
}

export async function updateCrmSmartView(id, updates, clientId) {
  const dbUpdates = toDb(updates, 'crm_smart_views')
  delete dbUpdates.id
  delete dbUpdates.client_id
  let query = supabase.from('crm_smart_views').update(dbUpdates).eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

export async function deleteCrmSmartView(id, clientId) {
  let query = supabase.from('crm_smart_views').delete().eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

// ---- CRM PIPELINES ----
export async function getCrmPipelines(clientId) {
  const { data, error } = await supabase
    .from('crm_pipelines')
    .select('*')
    .eq('client_id', clientId)
  if (error) return []
  return data.map(row => toApp(row, 'crm_pipelines'))
}

export async function addCrmPipeline(pipeline, clientId) {
  const dbPipeline = toDb(pipeline, 'crm_pipelines')
  delete dbPipeline.id
  dbPipeline.client_id = clientId
  const { data, error } = await supabase
    .from('crm_pipelines')
    .insert(dbPipeline)
    .select()
    .single()
  if (error) throw error
  return toApp(data, 'crm_pipelines')
}

export async function updateCrmPipeline(id, updates, clientId) {
  const dbUpdates = toDb(updates, 'crm_pipelines')
  delete dbUpdates.id
  delete dbUpdates.client_id
  let query = supabase.from('crm_pipelines').update(dbUpdates).eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

export async function deleteCrmPipeline(id, clientId) {
  let query = supabase.from('crm_pipelines').delete().eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

// ---- CRM FILES ----
export async function getCrmFiles(clientId, contactId) {
  let query = supabase.from('crm_files').select('*').eq('client_id', clientId)
  if (contactId) query = query.eq('contact_id', contactId)
  query = query.order('created_at', { ascending: false })
  const { data, error } = await query
  if (error) return []
  return data.map(row => toApp(row, 'crm_files'))
}

export async function addCrmFile(file, clientId) {
  const dbFile = toDb(file, 'crm_files')
  delete dbFile.id
  dbFile.client_id = clientId
  const { data, error } = await supabase
    .from('crm_files')
    .insert(dbFile)
    .select()
    .single()
  if (error) throw error
  return toApp(data, 'crm_files')
}

export async function deleteCrmFile(id, clientId) {
  let query = supabase.from('crm_files').delete().eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

// ---- CRM TASKS ----
export async function getCrmTasks(clientId, contactId) {
  let query = supabase.from('crm_tasks').select('*').eq('client_id', clientId)
  if (contactId) query = query.eq('contact_id', contactId)
  query = query.order('due_date', { ascending: true })
  const { data, error } = await query
  if (error) return []
  return data.map(row => toApp(row, 'crm_tasks'))
}

export async function addCrmTask(task, clientId) {
  const dbTask = toDb(task, 'crm_tasks')
  delete dbTask.id
  dbTask.client_id = clientId
  const { data, error } = await supabase
    .from('crm_tasks')
    .insert(dbTask)
    .select()
    .single()
  if (error) throw error
  return toApp(data, 'crm_tasks')
}

export async function updateCrmTask(id, updates, clientId) {
  const dbUpdates = toDb(updates, 'crm_tasks')
  delete dbUpdates.id
  delete dbUpdates.client_id
  let query = supabase.from('crm_tasks').update(dbUpdates).eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

export async function deleteCrmTask(id, clientId) {
  let query = supabase.from('crm_tasks').delete().eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

// ---- EMAIL CONFIG ----
export async function getEmailConfig(clientId) {
  const { data, error } = await supabase.from('email_config').select('*').eq('client_id', clientId).limit(1).single()
  if (error || !data) return null
  return toApp(data, 'email_config')
}

export async function saveEmailConfig(config, clientId) {
  const db = toDb(config, 'email_config')
  delete db.id
  db.client_id = clientId
  db.updated_at = new Date().toISOString()
  const { data: existing } = await supabase.from('email_config').select('id').eq('client_id', clientId).limit(1)
  if (existing && existing.length > 0) {
    const { error } = await supabase.from('email_config').update(db).eq('client_id', clientId)
    if (error) throw error
  } else {
    const { error } = await supabase.from('email_config').insert(db)
    if (error) throw error
  }
}

export async function sendEmailCampaign(campaignId, clientId) {
  // Get config
  const { data: config } = await supabase.from('email_config').select('*').eq('client_id', clientId).limit(1).single()
  if (!config || !config.api_key) throw new Error('Configura tu API Key de Resend primero')

  // Get campaign
  const { data: campaign } = await supabase.from('email_campaigns').select('*').eq('id', campaignId).single()
  if (!campaign) throw new Error('Campaña no encontrada')

  // Get subscribers
  let subs = []
  if (campaign.list_id) {
    const { data } = await supabase.from('email_subscribers').select('*').eq('list_id', campaign.list_id).eq('status', 'subscribed')
    subs = data || []
  } else {
    const { data } = await supabase.from('email_subscribers').select('*').eq('client_id', clientId).eq('status', 'subscribed')
    subs = data || []
  }
  if (subs.length === 0) throw new Error('No hay suscriptores en la lista seleccionada')

  const fromEmail = campaign.from_email || config.from_email || 'onboarding@resend.dev'
  const fromName = campaign.from_name || config.from_name || 'Newsletter'
  const htmlContent = campaign.html_content || '<p>Sin contenido</p>'

  // Build email payloads
  const emails = subs.map(sub => ({
    from: `${fromName} <${fromEmail}>`,
    to: [sub.email],
    subject: campaign.subject || '(Sin asunto)',
    html: htmlContent
      .replace(/\{\{name\}\}/g, sub.name || 'Suscriptor')
      .replace(/\{\{email\}\}/g, sub.email),
  }))

  // Send via backend proxy (avoids CORS)
  const res = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resendApiKey: config.api_key, emails }),
  })

  const result = await res.json()
  if (!res.ok) throw new Error(result.error || 'Error enviando campaña')

  // Update campaign stats
  await supabase.from('email_campaigns').update({
    status: 'sent',
    sent_at: new Date().toISOString(),
    total_sent: result.sent || 0,
    updated_at: new Date().toISOString(),
  }).eq('id', campaignId)

  return result
}

// ---- EMAIL MARKETING ----
export async function getEmailLists(clientId) {
  const { data, error } = await supabase.from('email_lists').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
  if (error) return []
  return data.map(row => toApp(row, 'email_lists'))
}
export async function addEmailList(list, clientId) {
  const db = toDb(list, 'email_lists'); delete db.id; db.client_id = clientId
  const { data, error } = await supabase.from('email_lists').insert(db).select().single()
  if (error) throw error
  return toApp(data, 'email_lists')
}
export async function updateEmailList(id, updates, clientId) {
  const db = toDb(updates, 'email_lists'); delete db.id; delete db.client_id
  const { error } = await supabase.from('email_lists').update(db).eq('id', id)
  if (error) throw error
}
export async function deleteEmailList(id) {
  const { error } = await supabase.from('email_lists').delete().eq('id', id)
  if (error) throw error
}

export async function getEmailSubscribers(clientId, listId) {
  let query = supabase.from('email_subscribers').select('*').eq('client_id', clientId)
  if (listId) query = query.eq('list_id', listId)
  query = query.order('created_at', { ascending: false })
  const { data, error } = await query
  if (error) return []
  return data.map(row => toApp(row, 'email_subscribers'))
}
export async function addEmailSubscriber(sub, clientId) {
  const db = toDb(sub, 'email_subscribers'); delete db.id; db.client_id = clientId
  if (!db.list_id) db.list_id = null
  const { data, error } = await supabase.from('email_subscribers').insert(db).select().single()
  if (error) throw error
  return toApp(data, 'email_subscribers')
}
export async function updateEmailSubscriber(id, updates) {
  const db = toDb(updates, 'email_subscribers'); delete db.id; delete db.client_id
  const { error } = await supabase.from('email_subscribers').update(db).eq('id', id)
  if (error) throw error
}
export async function deleteEmailSubscriber(id) {
  const { error } = await supabase.from('email_subscribers').delete().eq('id', id)
  if (error) throw error
}

export async function getEmailTemplates(clientId) {
  const { data, error } = await supabase.from('email_templates').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
  if (error) return []
  return data.map(row => toApp(row, 'email_templates'))
}
export async function addEmailTemplate(tpl, clientId) {
  const db = toDb(tpl, 'email_templates'); delete db.id; db.client_id = clientId
  const { data, error } = await supabase.from('email_templates').insert(db).select().single()
  if (error) throw error
  return toApp(data, 'email_templates')
}
export async function updateEmailTemplate(id, updates) {
  const db = toDb(updates, 'email_templates'); delete db.id; delete db.client_id; db.updated_at = new Date().toISOString()
  const { error } = await supabase.from('email_templates').update(db).eq('id', id)
  if (error) throw error
}
export async function deleteEmailTemplate(id) {
  const { error } = await supabase.from('email_templates').delete().eq('id', id)
  if (error) throw error
}

export async function getEmailCampaigns(clientId) {
  const { data, error } = await supabase.from('email_campaigns').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
  if (error) return []
  return data.map(row => toApp(row, 'email_campaigns'))
}
export async function addEmailCampaign(campaign, clientId) {
  const db = toDb(campaign, 'email_campaigns'); delete db.id; db.client_id = clientId
  if (!db.list_id) db.list_id = null
  if (!db.template_id) db.template_id = null
  const { data, error } = await supabase.from('email_campaigns').insert(db).select().single()
  if (error) throw error
  return toApp(data, 'email_campaigns')
}
export async function updateEmailCampaign(id, updates) {
  const db = toDb(updates, 'email_campaigns'); delete db.id; delete db.client_id; db.updated_at = new Date().toISOString()
  if (db.list_id === '') db.list_id = null
  if (db.template_id === '') db.template_id = null
  const { error } = await supabase.from('email_campaigns').update(db).eq('id', id)
  if (error) throw error
}
export async function deleteEmailCampaign(id) {
  const { error } = await supabase.from('email_campaigns').delete().eq('id', id)
  if (error) throw error
}

// ---- ENRICH CONTACT ----
export async function enrichContact(contactId, clientId) {
  const { data: contact } = await supabase.from('crm_contacts').select('*').eq('id', contactId).single()
  if (!contact) throw new Error('Contacto no encontrado')

  const res = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'enrich',
      company: contact.company || contact.name || '',
      name: contact.name || '',
      website: contact.website || '',
      country: contact.country || 'España',
    }),
  })

  const result = await res.json()
  if (!res.ok) throw new Error(result.error || 'Error en enriquecimiento')

  const updates = { enriched_at: new Date().toISOString(), enrichment_data: JSON.stringify(result) }
  if (result.phone && !contact.phone) updates.phone = result.phone
  if (result.email && !contact.email) updates.email = result.email
  if (result.billing?.cif && !contact.billing_cif) updates.billing_cif = result.billing.cif

  await supabase.from('crm_contacts').update(updates).eq('id', contactId)
  return result
}

// ---- MANYCHAT CONFIG ----
export async function getManychatConfig(clientId) {
  const { data, error } = await supabase.from('manychat_config').select('*').eq('client_id', clientId).limit(1).single()
  if (error || !data) return null
  return toApp(data, 'manychat_config')
}

export async function saveManychatConfig(config, clientId) {
  const db = toDb(config, 'manychat_config')
  delete db.id
  db.client_id = clientId
  db.updated_at = new Date().toISOString()
  const { data: existing } = await supabase.from('manychat_config').select('id').eq('client_id', clientId).limit(1)
  if (existing && existing.length > 0) {
    const { error } = await supabase.from('manychat_config').update(db).eq('client_id', clientId)
    if (error) throw error
  } else {
    const { error } = await supabase.from('manychat_config').insert(db)
    if (error) throw error
  }
}

// ---- WHATSAPP CONFIG (per-client) ----
const ENJAMBRE_API = import.meta.env.VITE_ENJAMBRE_API_URL || 'https://enjambre.blackwolfsec.io'

export async function getWhatsappConfig(clientId) {
  const { data, error } = await supabase.from('whatsapp_config').select('*').eq('client_id', clientId).limit(1).single()
  if (error || !data) return null
  return toApp(data, 'whatsapp_config')
}

export async function saveWhatsappConfig(config, clientId) {
  const db = toDb(config, 'whatsapp_config')
  delete db.id
  db.client_id = clientId
  db.updated_at = new Date().toISOString()
  const { data: existing } = await supabase.from('whatsapp_config').select('id').eq('client_id', clientId).limit(1)
  if (existing && existing.length > 0) {
    const { error } = await supabase.from('whatsapp_config').update(db).eq('client_id', clientId)
    if (error) throw error
  } else {
    const { error } = await supabase.from('whatsapp_config').insert(db)
    if (error) throw error
  }
}

export async function sendWhatsappMessage(to, message, clientId) {
  const res = await fetch(`${ENJAMBRE_API}/api/whatsapp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: to.replace(/[^0-9]/g, ''), message, clientId }),
  })
  const result = await res.json()
  if (result.error) throw new Error(result.error)
  return result
}

export async function syncManychatSubscribers(clientId) {
  const { data: config } = await supabase.from('manychat_config').select('*').eq('client_id', clientId).limit(1).single()
  if (!config || !config.api_key) throw new Error('Configura tu API Key de ManyChat primero')

  // Fetch subscribers from ManyChat API via proxy
  const res = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'manychat', apiKey: config.api_key, endpoint: '/fb/subscriber/getSubscribers', method: 'GET' }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || 'Error conectando con ManyChat')

  const subscribers = result.data || []
  let synced = 0

  for (const sub of subscribers) {
    const contact = {
      client_id: clientId,
      platform_id: sub.id || '',
      platform: 'instagram',
      name: [sub.first_name, sub.last_name].filter(Boolean).join(' ') || sub.name || '',
      username: sub.ig_username || '',
      email: sub.email || '',
      phone: sub.phone || '',
      tags: JSON.stringify((sub.tags || []).map(t => t.name || t)),
      custom_data: JSON.stringify({ manychat_id: sub.id, gender: sub.gender, locale: sub.locale }),
      last_interaction: sub.last_interaction || new Date().toISOString(),
      subscribed: sub.status === 'active',
    }

    // Upsert by platform_id
    const { data: existing } = await supabase.from('chat_contacts').select('id').eq('client_id', clientId).eq('platform_id', contact.platform_id).limit(1)
    if (existing && existing.length > 0) {
      await supabase.from('chat_contacts').update(contact).eq('id', existing[0].id)
    } else {
      await supabase.from('chat_contacts').insert(contact)
    }
    synced++
  }

  // Update last_sync
  await supabase.from('manychat_config').update({ last_sync: new Date().toISOString() }).eq('client_id', clientId)

  return { synced, total: subscribers.length }
}

export async function syncManychatToCrm(contactIds, clientId) {
  // Get chat contacts
  const { data: chatContacts } = await supabase.from('chat_contacts').select('*').eq('client_id', clientId).in('id', contactIds)
  if (!chatContacts || chatContacts.length === 0) throw new Error('No se encontraron contactos')

  let added = 0
  for (const cc of chatContacts) {
    // Check if already in CRM by email or username
    let exists = false
    if (cc.email) {
      const { data } = await supabase.from('crm_contacts').select('id').eq('client_id', clientId).eq('email', cc.email).limit(1)
      if (data && data.length > 0) exists = true
    }
    if (!exists && cc.username) {
      const { data } = await supabase.from('crm_contacts').select('id').eq('client_id', clientId).eq('instagram', cc.username).limit(1)
      if (data && data.length > 0) exists = true
    }

    if (!exists) {
      const customData = typeof cc.custom_data === 'string' ? JSON.parse(cc.custom_data || '{}') : (cc.custom_data || {})
      const tags = typeof cc.tags === 'string' ? JSON.parse(cc.tags || '[]') : (cc.tags || [])
      await supabase.from('crm_contacts').insert({
        client_id: clientId,
        name: cc.name || cc.username || '',
        email: cc.email || '',
        phone: cc.phone || '',
        instagram: cc.username || '',
        source: 'manychat',
        status: 'lead',
        tags: JSON.stringify(tags),
        notes: `Importado desde ManyChat. ID: ${cc.platform_id}`,
      })
      added++
    }
  }

  return { added, skipped: chatContacts.length - added, total: chatContacts.length }
}

// ---- CHATBOT / MANYCHAT ----
export async function getChatFlows(clientId) {
  const { data, error } = await supabase.from('chat_flows').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
  if (error) return []
  return data.map(row => toApp(row, 'chat_flows'))
}
export async function addChatFlow(flow, clientId) {
  const db = toDb(flow, 'chat_flows'); delete db.id; db.client_id = clientId
  const { data, error } = await supabase.from('chat_flows').insert(db).select().single()
  if (error) throw error
  return toApp(data, 'chat_flows')
}
export async function updateChatFlow(id, updates) {
  const db = toDb(updates, 'chat_flows'); delete db.id; delete db.client_id; db.updated_at = new Date().toISOString()
  const { error } = await supabase.from('chat_flows').update(db).eq('id', id)
  if (error) throw error
}
export async function deleteChatFlow(id) {
  const { error } = await supabase.from('chat_flows').delete().eq('id', id)
  if (error) throw error
}

export async function getChatContacts(clientId) {
  const { data, error } = await supabase.from('chat_contacts').select('*').eq('client_id', clientId).order('last_interaction', { ascending: false })
  if (error) return []
  return data.map(row => toApp(row, 'chat_contacts'))
}
export async function addChatContact(contact, clientId) {
  const db = toDb(contact, 'chat_contacts'); delete db.id; db.client_id = clientId
  const { data, error } = await supabase.from('chat_contacts').insert(db).select().single()
  if (error) throw error
  return toApp(data, 'chat_contacts')
}
export async function updateChatContact(id, updates) {
  const db = toDb(updates, 'chat_contacts'); delete db.id; delete db.client_id
  const { error } = await supabase.from('chat_contacts').update(db).eq('id', id)
  if (error) throw error
}
export async function deleteChatContact(id) {
  const { error } = await supabase.from('chat_contacts').delete().eq('id', id)
  if (error) throw error
}

export async function getChatConversations(clientId) {
  const { data, error } = await supabase.from('chat_conversations').select('*').eq('client_id', clientId).order('last_message_at', { ascending: false })
  if (error) return []
  return data.map(row => toApp(row, 'chat_conversations'))
}
export async function addChatConversation(conv, clientId) {
  const db = toDb(conv, 'chat_conversations'); delete db.id; db.client_id = clientId
  if (!db.flow_id) db.flow_id = null
  if (!db.contact_id) db.contact_id = null
  const { data, error } = await supabase.from('chat_conversations').insert(db).select().single()
  if (error) throw error
  return toApp(data, 'chat_conversations')
}
export async function updateChatConversation(id, updates) {
  const db = toDb(updates, 'chat_conversations'); delete db.id; delete db.client_id
  const { error } = await supabase.from('chat_conversations').update(db).eq('id', id)
  if (error) throw error
}

export async function getChatMessages(clientId, conversationId) {
  let query = supabase.from('chat_messages').select('*').eq('client_id', clientId)
  if (conversationId) query = query.eq('conversation_id', conversationId)
  query = query.order('created_at', { ascending: true })
  const { data, error } = await query
  if (error) return []
  return data.map(row => toApp(row, 'chat_messages'))
}
export async function addChatMessage(msg, clientId) {
  const db = toDb(msg, 'chat_messages'); delete db.id; db.client_id = clientId
  const { data, error } = await supabase.from('chat_messages').insert(db).select().single()
  if (error) throw error
  return toApp(data, 'chat_messages')
}

export async function getChatBroadcasts(clientId) {
  const { data, error } = await supabase.from('chat_broadcasts').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
  if (error) return []
  return data.map(row => toApp(row, 'chat_broadcasts'))
}
export async function addChatBroadcast(broadcast, clientId) {
  const db = toDb(broadcast, 'chat_broadcasts'); delete db.id; db.client_id = clientId
  const { data, error } = await supabase.from('chat_broadcasts').insert(db).select().single()
  if (error) throw error
  return toApp(data, 'chat_broadcasts')
}
export async function updateChatBroadcast(id, updates) {
  const db = toDb(updates, 'chat_broadcasts'); delete db.id; delete db.client_id
  const { error } = await supabase.from('chat_broadcasts').update(db).eq('id', id)
  if (error) throw error
}
export async function deleteChatBroadcast(id) {
  const { error } = await supabase.from('chat_broadcasts').delete().eq('id', id)
  if (error) throw error
}

// ---- AI AGENT CHAT ----
export async function getAgentConversations(clientId) {
  const { data, error } = await supabase
    .from('agent_conversations').select('*')
    .eq('client_id', clientId)
    .order('updated_at', { ascending: false })
  if (error) return []
  return data.map(r => toApp(r, 'agent_conversations'))
}

export async function addAgentConversation(conv, clientId) {
  const dbConv = toDb({ ...conv, clientId }, 'agent_conversations')
  const { data, error } = await supabase
    .from('agent_conversations').insert(dbConv).select().single()
  if (error) throw error
  return toApp(data, 'agent_conversations')
}

export async function updateAgentConversation(id, updates, clientId) {
  const dbUpdates = toDb(updates, 'agent_conversations')
  let q = supabase.from('agent_conversations').update(dbUpdates).eq('id', id)
  if (clientId) q = q.eq('client_id', clientId)
  const { data, error } = await q.select().single()
  if (error) throw error
  return toApp(data, 'agent_conversations')
}

export async function deleteAgentConversation(id, clientId) {
  let q = supabase.from('agent_conversations').delete().eq('id', id)
  if (clientId) q = q.eq('client_id', clientId)
  const { error } = await q
  if (error) throw error
}

export async function getAgentMessages(conversationId) {
  const { data, error } = await supabase
    .from('agent_messages').select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) return []
  return data.map(r => toApp(r, 'agent_messages'))
}

export async function addAgentMessage(msg, clientId) {
  const dbMsg = toDb({ ...msg, clientId }, 'agent_messages')
  const { data, error } = await supabase
    .from('agent_messages').insert(dbMsg).select().single()
  if (error) throw error
  return toApp(data, 'agent_messages')
}

// ---- STORES (Gestión de Tiendas) ----
export async function getStores(clientId) {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(row => toApp(row, 'stores'))
}

export async function addStore(store, clientId) {
  const db = toDb(store, 'stores'); delete db.id; db.client_id = clientId
  const { data, error } = await supabase.from('stores').insert(db).select().single()
  if (error) throw error
  return toApp(data, 'stores')
}

export async function updateStore(id, updates, clientId) {
  const db = toDb(updates, 'stores'); delete db.id; delete db.client_id
  db.updated_at = new Date().toISOString()
  let query = supabase.from('stores').update(db).eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

export async function deleteStore(id, clientId) {
  let query = supabase.from('stores').delete().eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

// ---- STORE STEPS ----
export async function getStoreSteps(storeId) {
  const { data, error } = await supabase
    .from('store_steps')
    .select('*')
    .eq('store_id', storeId)
    .order('step_number', { ascending: true })
  if (error) throw error
  return data.map(row => toApp(row, 'store_steps'))
}

export async function updateStoreStep(id, updates) {
  const db = toDb(updates, 'store_steps'); delete db.id; delete db.store_id
  const { error } = await supabase.from('store_steps').update(db).eq('id', id)
  if (error) throw error
}

// ---- STORE ALERTS ----
export async function getStoreAlerts(clientId, resolved = false) {
  let query = supabase
    .from('store_alerts')
    .select('*')
    .eq('client_id', clientId)
    .eq('resolved', resolved)
    .order('created_at', { ascending: false })
  const { data, error } = await query
  if (error) throw error
  return data.map(row => toApp(row, 'store_alerts'))
}

export async function addStoreAlert(alert, clientId) {
  const db = toDb(alert, 'store_alerts'); delete db.id; db.client_id = clientId
  const { data, error } = await supabase.from('store_alerts').insert(db).select().single()
  if (error) throw error
  return toApp(data, 'store_alerts')
}

export async function resolveStoreAlert(id, resolvedBy, note) {
  const { error } = await supabase.from('store_alerts').update({
    resolved: true,
    resolved_at: new Date().toISOString(),
    resolved_by: resolvedBy,
    resolution_note: note || null,
  }).eq('id', id)
  if (error) throw error
}

// ---- STORE DAILY TRACKING ----
export async function getStoreDailyTracking(storeId) {
  const { data, error } = await supabase
    .from('store_daily_tracking')
    .select('*')
    .eq('store_id', storeId)
    .order('tracking_date', { ascending: true })
  if (error) throw error
  return data.map(row => toApp(row, 'store_daily_tracking'))
}

export async function addStoreDailyTracking(entry) {
  const db = toDb(entry, 'store_daily_tracking'); delete db.id
  const { data, error } = await supabase.from('store_daily_tracking').insert(db).select().single()
  if (error) throw error
  return toApp(data, 'store_daily_tracking')
}

// ---- STORE HISTORY ----
export async function getStoreHistory(storeId) {
  const { data, error } = await supabase
    .from('store_history')
    .select('*')
    .eq('store_id', storeId)
    .order('month', { ascending: false })
  if (error) throw error
  return data.map(row => toApp(row, 'store_history'))
}

export async function addStoreHistory(entry) {
  const db = toDb(entry, 'store_history'); delete db.id
  const { data, error } = await supabase.from('store_history').insert(db).select().single()
  if (error) throw error
  return toApp(data, 'store_history')
}

// ---- STORE CLIENTS (Portal Users) ----
export async function authenticateStoreClient(email, password, clientId) {
  const { data, error } = await supabase
    .from('store_clients')
    .select('*')
    .eq('client_id', clientId)
    .eq('email', email)
    .eq('password', password)
    .eq('active', true)
    .maybeSingle()
  if (error || !data) return null
  return toApp(data, 'store_clients')
}

export async function getStoreClients(clientId) {
  const { data, error } = await supabase
    .from('store_clients')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(row => toApp(row, 'store_clients'))
}

export async function addStoreClient(client, clientId) {
  const db = toDb(client, 'store_clients'); delete db.id; db.client_id = clientId
  const { data, error } = await supabase.from('store_clients').insert(db).select().single()
  if (error) throw error
  return toApp(data, 'store_clients')
}

export async function updateStoreClient(id, updates, clientId) {
  const db = toDb(updates, 'store_clients'); delete db.id; delete db.client_id
  let query = supabase.from('store_clients').update(db).eq('id', id)
  if (clientId) query = query.eq('client_id', clientId)
  const { error } = await query
  if (error) throw error
}

// ---- STORE TICKETS ----
export async function getStoreTickets(clientId, filters = {}) {
  let query = supabase
    .from('store_tickets')
    .select('*')
    .eq('client_id', clientId)
    .order('updated_at', { ascending: false })
  if (filters.gestorId) query = query.eq('assigned_gestor_id', filters.gestorId)
  if (filters.storeId) query = query.eq('store_id', filters.storeId)
  if (filters.status) query = query.eq('status', filters.status)
  const { data, error } = await query
  if (error) throw error
  return data.map(row => toApp(row, 'store_tickets'))
}

export async function addStoreTicket(ticket, clientId) {
  const db = toDb(ticket, 'store_tickets'); delete db.id; db.client_id = clientId
  const { data, error } = await supabase.from('store_tickets').insert(db).select().single()
  if (error) throw error
  return toApp(data, 'store_tickets')
}

export async function updateStoreTicket(id, updates) {
  const db = toDb(updates, 'store_tickets'); delete db.id; delete db.client_id
  db.updated_at = new Date().toISOString()
  const { error } = await supabase.from('store_tickets').update(db).eq('id', id)
  if (error) throw error
}

// ---- TICKET MESSAGES ----
export async function getTicketMessages(ticketId) {
  const { data, error } = await supabase
    .from('store_ticket_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data.map(row => toApp(row, 'store_ticket_messages'))
}

export async function addTicketMessage(message) {
  const db = toDb(message, 'store_ticket_messages'); delete db.id
  const { data, error } = await supabase.from('store_ticket_messages').insert(db).select().single()
  if (error) throw error
  return toApp(data, 'store_ticket_messages')
}

// ---- STORE CREATION ORCHESTRATOR ----
export async function createStoreWithClient({ storeData, clientPassword, gestorId, gestorName }, clientId) {
  // 1. Create store client (portal user)
  const storeClient = await addStoreClient({
    email: storeData.ownerEmail,
    password: clientPassword,
    name: storeData.ownerName,
    phone: storeData.ownerPhone || null,
    instagram: storeData.ownerInstagram || null,
  }, clientId)

  // 2. Create store
  const store = await addStore({
    ...storeData,
    gestorId: gestorId || null,
    gestorName: gestorName || null,
    storeClientId: storeClient.id,
    status: 'onboarding',
    currentStep: 1,
  }, clientId)

  // 3. Link store to client
  await updateStoreClient(storeClient.id, { storeId: store.id }, clientId)

  // 4. Create default onboarding steps based on service type
  const steps = getDefaultSteps(storeData.serviceType)
  for (const step of steps) {
    const db = toDb({ ...step, storeId: store.id }, 'store_steps')
    delete db.id
    await supabase.from('store_steps').insert(db)
  }

  return { store, storeClient }
}

export async function initStoreSteps(storeId, serviceType) {
  // Check if steps already exist
  const { data: existing } = await supabase
    .from('store_steps')
    .select('id')
    .eq('store_id', storeId)
    .limit(1)
  if (existing && existing.length > 0) return false // already has steps

  const steps = getDefaultSteps(serviceType || 'dwy')
  for (const step of steps) {
    const db = toDb({ ...step, storeId }, 'store_steps')
    delete db.id
    await supabase.from('store_steps').insert(db)
  }
  return true
}

function getDefaultSteps(serviceType) {
  const base = [
    {
      stepNumber: 1,
      title: 'Crear Cuenta Amazon Seller',
      description: 'Crea tu cuenta de vendedor en Amazon Seller Central. Sigue el vídeo paso a paso para completar el registro y la verificación de identidad.',
      stepType: 'video',
      videoUrl: 'https://www.youtube.com/embed/placeholder-crear-cuenta',
      requiresTeamAction: false,
      deliverables: [],
    },
    {
      stepNumber: 2,
      title: 'Creación de Marca',
      description: 'Define el nombre de tu marca en Amazon. Este nombre aparecerá en todos tus productos y listing.',
      stepType: 'input',
      videoUrl: 'https://www.youtube.com/embed/placeholder-marca',
      requiresTeamAction: false,
      deliverables: [
        { key: 'brand_name', label: 'Nombre de marca', type: 'text', required: true, value: '' },
      ],
    },
    {
      stepNumber: 3,
      title: 'Capital Disponible',
      description: 'Indica el capital que tienes disponible para invertir en inventario y publicidad. Esto nos ayuda a dimensionar tu primera compra.',
      stepType: 'input',
      requiresTeamAction: false,
      deliverables: [
        { key: 'capital', label: 'Capital disponible (€)', type: 'number', required: true, value: '' },
      ],
    },
    {
      stepNumber: 4,
      title: 'Brand Registry',
      description: 'Registra tu marca en Amazon Brand Registry para protegerla y acceder a herramientas avanzadas como A+ Content.',
      stepType: 'input',
      videoUrl: 'https://www.youtube.com/embed/placeholder-brand-registry',
      requiresTeamAction: false,
      deliverables: [
        { key: 'brand_registry_name', label: 'Marca registrada', type: 'text', required: true, value: '' },
      ],
    },
    {
      stepNumber: 5,
      title: 'Búsqueda de Producto',
      description: 'Tu gestor te asignará un producto basándose en tu capital y el análisis de mercado. Este paso se desbloquea cuando el equipo haya seleccionado tu producto.',
      stepType: 'blocked',
      videoUrl: 'https://www.youtube.com/embed/placeholder-producto',
      requiresTeamAction: true,
      deliverables: [],
    },
    {
      stepNumber: 6,
      title: 'Agente de Compras',
      description: 'El equipo te asignará un agente de compras para contactar proveedores y gestionar la fabricación. Este paso se desbloquea cuando se haya asignado un agente.',
      stepType: 'blocked',
      videoUrl: 'https://www.youtube.com/embed/placeholder-agente',
      requiresTeamAction: true,
      deliverables: [],
    },
    {
      stepNumber: 7,
      title: 'Generar Etiquetas',
      description: 'Genera las etiquetas FNSKU de Amazon para tus productos. Sigue el vídeo para descargarlas desde Seller Central.',
      stepType: 'video',
      videoUrl: 'https://www.youtube.com/embed/placeholder-etiquetas',
      requiresTeamAction: false,
      deliverables: [],
    },
    {
      stepNumber: 8,
      title: 'Envío a FBA',
      description: 'Prepara y envía tu inventario a los almacenes de Amazon FBA. El vídeo te guía paso a paso por el proceso de envío.',
      stepType: 'video',
      videoUrl: 'https://www.youtube.com/embed/placeholder-envio',
      requiresTeamAction: false,
      deliverables: [],
    },
    {
      stepNumber: 9,
      title: 'Vídeo de Feedback',
      description: 'Graba un breve vídeo contándonos tu experiencia hasta ahora. Esto nos ayuda a mejorar el proceso para futuros clientes.',
      stepType: 'input',
      requiresTeamAction: false,
      deliverables: [
        { key: 'feedback_video_url', label: 'URL del vídeo de feedback', type: 'url', required: true, value: '' },
      ],
    },
    {
      stepNumber: 10,
      title: 'Seguimiento Diario',
      description: 'Tu tienda ya está activa. A partir de ahora puedes registrar tus ventas diarias, gasto PPC y posición orgánica desde el panel de seguimiento.',
      stepType: 'tracking',
      requiresTeamAction: false,
      deliverables: [],
    },
  ]
  if (serviceType === 'diy') return base.slice(0, 7).map((s, i) => ({ ...s, stepNumber: i + 1 }))
  if (serviceType === 'dwy') return base.slice(0, 9).map((s, i) => ({ ...s, stepNumber: i + 1 }))
  // DFY gets all steps
  return base
}

export async function getAdminDashboardData() {
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`

  const [
    { data: clients },
    { data: sales },
    { data: commissions },
  ] = await Promise.all([
    supabase.from('clients').select('*').eq('active', true).order('name'),
    supabase.from('sales_with_net_cash').select('*').gte('date', monthStart).lt('date', monthEnd),
    supabase.from('superadmin_commissions').select('*'),
  ])

  const totalRevenue = (sales || []).reduce((sum, s) => sum + Number(s.revenue || 0), 0)
  const totalCash = (sales || []).reduce((sum, s) => sum + Number(s.cash_collected || 0), 0)
  const totalNetCash = (sales || []).reduce((sum, s) => sum + Number(s.net_cash || 0), 0)

  const clientSummaries = (clients || []).map(c => {
    const clientSales = (sales || []).filter(s => s.client_id === c.id)
    const cash = clientSales.reduce((sum, s) => sum + Number(s.cash_collected || 0), 0)
    const revenue = clientSales.reduce((sum, s) => sum + Number(s.revenue || 0), 0)
    const netCash = clientSales.reduce((sum, s) => sum + Number(s.net_cash || 0), 0)
    const comm = commissions?.find(co => co.client_id === c.id)
    const rate = comm ? Number(comm.commission_rate) : 0

    return {
      ...toApp(c, 'clients'),
      monthRevenue: revenue,
      monthCash: cash,
      monthNetCash: netCash,
      monthSales: clientSales.length,
      commissionRate: rate,
      commissionEarned: Math.round(cash * rate),
    }
  })

  const totalCommission = clientSummaries.reduce((sum, c) => sum + c.commissionEarned, 0)

  return {
    totalRevenue,
    totalCash,
    totalNetCash,
    totalSales: (sales || []).length,
    totalCommission,
    clients: clientSummaries,
  }
}
