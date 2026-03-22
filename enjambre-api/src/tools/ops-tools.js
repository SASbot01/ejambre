// ============================================
// AGENTE OPS/ERP - Herramientas para Claude
// Conecta con Dashboard-Ops via Supabase
// Tablas reales: sales, team, commission_payments,
// projections, products, payment_fees, sales_with_net_cash
// ============================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supabaseFetch(table, query = '') {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { error: 'Supabase no configurado. Configura SUPABASE_URL y SUPABASE_SERVICE_KEY.' };
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
  });
  if (!res.ok) throw new Error(`Supabase error: ${res.status} on ${table}`);
  return res.json();
}

export const opsTools = [
  {
    name: 'ops_get_sales_summary',
    description: 'Obtiene resumen de ventas real: revenue, cash_collected, net_cash, número de ventas, ticket promedio, desglose por closer, producto y método de pago.',
    input_schema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'week', 'month', 'last_month'],
          description: 'Período del resumen',
        },
        client_slug: {
          type: 'string',
          description: 'Slug del cliente/tenant (ej: fba-academy, detras-de-camara). Sin especificar = todos.',
        },
      },
      required: [],
    },
  },
  {
    name: 'ops_get_team_performance',
    description: 'Métricas del equipo de ventas real: nombre, rol, tasa de comisión, estado activo. Roles: closer, setter, ceo, director, cold_caller.',
    input_schema: {
      type: 'object',
      properties: {
        role: {
          type: 'string',
          enum: ['closer', 'setter', 'ceo', 'director', 'cold_caller', 'all'],
          description: 'Filtrar por rol',
        },
      },
      required: [],
    },
  },
  {
    name: 'ops_get_commissions',
    description: 'Estado de comisiones reales: member_id, período, cash_base, rate, commission_amount, status (pending/paid).',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'paid', 'all'],
          description: 'Filtrar por estado de pago',
        },
      },
      required: [],
    },
  },
  {
    name: 'ops_audit_transactions',
    description: 'Audita ventas buscando anomalías. Columnas disponibles: revenue, cash_collected, payment_method (Stripe/Transferencia/Tarjeta), closer, setter, client_email, pais, utm_source.',
    input_schema: {
      type: 'object',
      properties: {
        min_amount: { type: 'number', description: 'Revenue mínimo para filtrar' },
        payment_method: { type: 'string', description: 'Método de pago: Stripe, Transferencia, Tarjeta' },
        closer: { type: 'string', description: 'Nombre del closer' },
        pais: { type: 'string', description: 'País del cliente' },
      },
      required: [],
    },
  },
  {
    name: 'ops_get_projections',
    description: 'Proyecciones/targets semanales: cash_target, revenue_target, appointment_target por miembro o empresa. Formato período: YYYY-Wnn.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'ops_get_products',
    description: 'Catálogo de productos con precios. Ej: FBA Academy Pro ($2997), Mentoring 1:1 ($5000).',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'ops_get_daily_reports',
    description: 'Reportes de actividad diaria del equipo: conversations_opened, follow_ups, offers, appointments_booked, calls_made, deposits, closes. Por setter y closer.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Fecha en formato YYYY-MM-DD. Sin especificar = últimos 7 días.' },
        name: { type: 'string', description: 'Nombre del miembro del equipo' },
      },
      required: [],
    },
  },
  {
    name: 'ops_get_clients',
    description: 'Lista los clientes/tenants de la plataforma: nombre, slug, colores, estado.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

export const opsHandlers = {
  async ops_get_sales_summary({ period = 'month', client_slug }) {
    // Usar la vista sales_with_net_cash que incluye net_cash calculado
    let filter = '?select=date,revenue,cash_collected,net_cash,closer,setter,product,payment_method,pais,client_id&order=date.desc&limit=500';

    // Filtros de fecha usando la columna date
    const now = new Date();
    const dateFilters = {
      today: `&date=eq.${now.toISOString().slice(0, 10)}`,
      week: `&date=gte.${new Date(now - 7 * 86400000).toISOString().slice(0, 10)}`,
      month: `&date=gte.${new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)}`,
      last_month: `&date=gte.${new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)}&date=lt.${new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)}`,
    };
    filter += dateFilters[period] || '';

    const sales = await supabaseFetch('sales_with_net_cash', filter);
    if (sales.error) return sales;

    const totalRevenue = sales.reduce((sum, s) => sum + (Number(s.revenue) || 0), 0);
    const totalCash = sales.reduce((sum, s) => sum + (Number(s.cash_collected) || 0), 0);
    const totalNetCash = sales.reduce((sum, s) => sum + (Number(s.net_cash) || 0), 0);

    // Desglose por closer
    const byCloser = {};
    sales.forEach((s) => {
      if (!s.closer) return;
      if (!byCloser[s.closer]) byCloser[s.closer] = { ventas: 0, revenue: 0, cash: 0 };
      byCloser[s.closer].ventas++;
      byCloser[s.closer].revenue += Number(s.revenue) || 0;
      byCloser[s.closer].cash += Number(s.cash_collected) || 0;
    });

    // Desglose por producto
    const byProduct = {};
    sales.forEach((s) => {
      const prod = s.product || 'Sin producto';
      if (!byProduct[prod]) byProduct[prod] = { ventas: 0, revenue: 0 };
      byProduct[prod].ventas++;
      byProduct[prod].revenue += Number(s.revenue) || 0;
    });

    return {
      period,
      total_sales: sales.length,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      total_cash: Math.round(totalCash * 100) / 100,
      total_net_cash: Math.round(totalNetCash * 100) / 100,
      average_ticket: sales.length > 0 ? Math.round(totalRevenue / sales.length) : 0,
      by_closer: byCloser,
      by_product: byProduct,
    };
  },

  async ops_get_team_performance({ role = 'all' }) {
    let filter = '?select=id,name,email,role,active,commission_rate,closer_commission_rate,setter_commission_rate,commission_start_date&active=eq.true';
    const team = await supabaseFetch('team', filter);
    if (team.error) return team;

    if (role !== 'all') {
      return team.filter((m) => m.role?.toLowerCase().includes(role));
    }
    return team;
  },

  async ops_get_commissions({ status = 'all' }) {
    let filter = '?select=*&order=created_at.desc&limit=50';
    if (status !== 'all') {
      filter += `&status=eq.${status}`;
    }
    return supabaseFetch('commission_payments', filter);
  },

  async ops_audit_transactions({ min_amount, payment_method, closer, pais }) {
    let filter = '?select=date,client_name,client_email,product,revenue,cash_collected,payment_method,closer,setter,pais,utm_source,status&order=date.desc&limit=100';
    if (min_amount) filter += `&revenue=gte.${min_amount}`;
    if (payment_method) filter += `&payment_method=eq.${payment_method}`;
    if (closer) filter += `&closer=eq.${closer}`;
    if (pais) filter += `&pais=eq.${pais}`;

    const sales = await supabaseFetch('sales', filter);
    if (sales.error) return sales;
    return { transactions: sales, total: sales.length, filters_applied: { min_amount, payment_method, closer, pais } };
  },

  async ops_get_projections() {
    return supabaseFetch('projections', '?select=*&order=created_at.desc&limit=20');
  },

  async ops_get_products() {
    return supabaseFetch('products', '?select=*&active=eq.true&order=name');
  },

  async ops_get_daily_reports({ date, name }) {
    let filter = '?select=*&order=date.desc&limit=50';
    if (date) {
      filter += `&date=eq.${date}`;
    } else {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      filter += `&date=gte.${weekAgo}`;
    }
    if (name) filter += `&name=eq.${name}`;
    return supabaseFetch('reports', filter);
  },

  async ops_get_clients() {
    return supabaseFetch('clients', '?select=id,slug,name,active&order=name');
  },
};
