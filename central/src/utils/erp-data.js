import { supabase } from './supabase'

// ── AUTH ──
export async function erpLogin(email, password, companySlug) {
  const { data: company } = await supabase.from('erp_companies').select('id,name,slug,logo_url,currency').eq('slug', companySlug).eq('active', true).single()
  if (!company) return null
  const { data: users } = await supabase.from('erp_users').select('*').eq('company_id', company.id).eq('email', email).eq('password', password).eq('active', true)
  if (!users || users.length === 0) return null
  const user = users[0]
  return { user: { id: user.id, name: user.name, email: user.email, role: user.role, modules: user.modules }, company }
}

export async function getErpCompanyBySlug(slug) {
  const { data } = await supabase.from('erp_companies').select('*').eq('slug', slug).eq('active', true).single()
  return data
}

// ── COMPANIES (admin) ──
export async function getErpCompanies() {
  const { data } = await supabase.from('erp_companies').select('*').order('name')
  return data || []
}
export async function addErpCompany(company) {
  const { data, error } = await supabase.from('erp_companies').insert(company).select().single()
  if (error) throw error
  return data
}
export async function updateErpCompany(id, updates) {
  const { error } = await supabase.from('erp_companies').update(updates).eq('id', id)
  if (error) throw error
}

// ── USERS ──
export async function getErpUsers(companyId) {
  const { data } = await supabase.from('erp_users').select('*').eq('company_id', companyId).order('name')
  return data || []
}
export async function addErpUser(user) {
  const { data, error } = await supabase.from('erp_users').insert(user).select().single()
  if (error) throw error
  return data
}
export async function updateErpUser(id, updates) {
  const { error } = await supabase.from('erp_users').update(updates).eq('id', id)
  if (error) throw error
}
export async function deleteErpUser(id) {
  const { error } = await supabase.from('erp_users').delete().eq('id', id)
  if (error) throw error
}

// ── PRODUCTS ──
export async function getErpProducts(companyId) {
  const { data } = await supabase.from('erp_products').select('*').eq('company_id', companyId).order('name')
  return data || []
}
export async function addErpProduct(product) {
  const { data, error } = await supabase.from('erp_products').insert(product).select().single()
  if (error) throw error
  return data
}
export async function updateErpProduct(id, updates) {
  const { error } = await supabase.from('erp_products').update(updates).eq('id', id)
  if (error) throw error
}
export async function deleteErpProduct(id) {
  const { error } = await supabase.from('erp_products').delete().eq('id', id)
  if (error) throw error
}

// ── CONTACTS (customers/suppliers) ──
export async function getErpContacts(companyId, type) {
  let q = supabase.from('erp_contacts').select('*').eq('company_id', companyId)
  if (type) q = q.eq('type', type)
  const { data } = await q.order('name')
  return data || []
}
export async function addErpContact(contact) {
  const { data, error } = await supabase.from('erp_contacts').insert(contact).select().single()
  if (error) throw error
  return data
}
export async function updateErpContact(id, updates) {
  const { error } = await supabase.from('erp_contacts').update(updates).eq('id', id)
  if (error) throw error
}
export async function deleteErpContact(id) {
  const { error } = await supabase.from('erp_contacts').delete().eq('id', id)
  if (error) throw error
}

// ── INVOICES ──
export async function getErpInvoices(companyId, type) {
  let q = supabase.from('erp_invoices').select('*').eq('company_id', companyId)
  if (type) q = q.eq('type', type)
  const { data } = await q.order('date', { ascending: false })
  return data || []
}
export async function addErpInvoice(invoice) {
  const { data, error } = await supabase.from('erp_invoices').insert(invoice).select().single()
  if (error) throw error
  return data
}
export async function updateErpInvoice(id, updates) {
  const { error } = await supabase.from('erp_invoices').update(updates).eq('id', id)
  if (error) throw error
}
export async function deleteErpInvoice(id) {
  const { error } = await supabase.from('erp_invoices').delete().eq('id', id)
  if (error) throw error
}

// ── STOCK ──
export async function getErpStockMoves(companyId, productId) {
  let q = supabase.from('erp_stock_moves').select('*').eq('company_id', companyId)
  if (productId) q = q.eq('product_id', productId)
  const { data } = await q.order('date', { ascending: false })
  return data || []
}
export async function addErpStockMove(move) {
  const { data, error } = await supabase.from('erp_stock_moves').insert(move).select().single()
  if (error) throw error
  // Update product stock
  if (move.product_id) {
    const qty = move.type === 'in' ? move.quantity : -move.quantity
    await supabase.rpc('increment_stock', { p_id: move.product_id, qty })
      .then(() => {})
      .catch(async () => {
        // Fallback: read and update manually
        const { data: prod } = await supabase.from('erp_products').select('stock_qty').eq('id', move.product_id).single()
        if (prod) await supabase.from('erp_products').update({ stock_qty: (prod.stock_qty || 0) + qty }).eq('id', move.product_id)
      })
  }
  return data
}

// ── EMPLOYEES ──
export async function getErpEmployees(companyId) {
  const { data } = await supabase.from('erp_employees').select('*').eq('company_id', companyId).order('name')
  return data || []
}
export async function addErpEmployee(employee) {
  const { data, error } = await supabase.from('erp_employees').insert(employee).select().single()
  if (error) throw error
  return data
}
export async function updateErpEmployee(id, updates) {
  const { error } = await supabase.from('erp_employees').update(updates).eq('id', id)
  if (error) throw error
}
export async function deleteErpEmployee(id) {
  const { error } = await supabase.from('erp_employees').delete().eq('id', id)
  if (error) throw error
}

// ── ACCOUNTING ──
export async function getErpAccounting(companyId, from, to) {
  let q = supabase.from('erp_accounting').select('*').eq('company_id', companyId)
  if (from) q = q.gte('date', from)
  if (to) q = q.lte('date', to)
  const { data } = await q.order('date', { ascending: false })
  return data || []
}
export async function addErpAccounting(entry) {
  const { data, error } = await supabase.from('erp_accounting').insert(entry).select().single()
  if (error) throw error
  return data
}

// ── DASHBOARD STATS ──
export async function getErpDashboardStats(companyId) {
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const yearStart = `${now.getFullYear()}-01-01`

  const [invoicesRes, productsRes, employeesRes, contactsRes] = await Promise.all([
    supabase.from('erp_invoices').select('*').eq('company_id', companyId).gte('date', yearStart),
    supabase.from('erp_products').select('id,stock_qty,sale_price,cost_price').eq('company_id', companyId),
    supabase.from('erp_employees').select('id,salary').eq('company_id', companyId).eq('active', true),
    supabase.from('erp_contacts').select('id,type').eq('company_id', companyId),
  ])

  const invoices = invoicesRes.data || []
  const products = productsRes.data || []
  const employees = employeesRes.data || []
  const contacts = contactsRes.data || []

  const salesInvoices = invoices.filter(i => i.type === 'sale')
  const purchaseInvoices = invoices.filter(i => i.type === 'purchase')
  const monthSales = salesInvoices.filter(i => i.date >= monthStart)
  const monthPurchases = purchaseInvoices.filter(i => i.date >= monthStart)

  return {
    totalRevenue: salesInvoices.reduce((s, i) => s + Number(i.total || 0), 0),
    monthRevenue: monthSales.reduce((s, i) => s + Number(i.total || 0), 0),
    totalExpenses: purchaseInvoices.reduce((s, i) => s + Number(i.total || 0), 0),
    monthExpenses: monthPurchases.reduce((s, i) => s + Number(i.total || 0), 0),
    pendingInvoices: salesInvoices.filter(i => i.status === 'sent' || i.status === 'draft').length,
    pendingAmount: salesInvoices.filter(i => i.status !== 'paid').reduce((s, i) => s + Number(i.total || 0) - Number(i.paid_amount || 0), 0),
    totalProducts: products.length,
    lowStock: products.filter(p => p.stock_qty <= (p.min_stock || 0)).length,
    stockValue: products.reduce((s, p) => s + (p.stock_qty || 0) * (p.cost_price || 0), 0),
    totalEmployees: employees.length,
    monthlySalaries: employees.reduce((s, e) => s + Number(e.salary || 0), 0),
    totalCustomers: contacts.filter(c => c.type === 'customer').length,
    totalSuppliers: contacts.filter(c => c.type === 'supplier').length,
  }
}
