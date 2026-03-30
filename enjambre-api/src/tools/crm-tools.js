// ============================================
// AGENTE CRM - Herramientas para Claude
// Fuente DUAL:
//   1. Supabase (crm_contacts, crm_activities, crm_pipelines, sales) → datos reales del Dashboard-Ops
//   2. PostgreSQL local (leads) → leads de infoproductos via formularios
// ============================================

import { query, queryOne } from '../config/database.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supabaseFetch(table, qs = '') {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { error: 'Supabase no configurado' };
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${qs}`, {
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

async function supabaseInsert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Supabase insert error: ${res.status} - ${await res.text()}`);
  return res.json();
}

async function supabaseUpdate(table, id, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Supabase update error: ${res.status}`);
  return res.json();
}

export const crmTools = [
  {
    name: 'crm_search_contacts',
    description: 'Busca contactos en el CRM real (Supabase crm_contacts). Campos: name, email, phone, company, country, source, status, assigned_to, deal_value, instagram, whatsapp, linkedin, tags.',
    input_schema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Buscar por nombre, email o teléfono' },
        status: {
          type: 'string',
          enum: ['Lead', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost', 'all'],
          description: 'Estado en el pipeline',
        },
      },
      required: ['search'],
    },
  },
  {
    name: 'crm_create_contact',
    description: 'Crea un nuevo contacto en el CRM real (Supabase). Requiere client_id del tenant.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre completo' },
        email: { type: 'string', description: 'Email' },
        phone: { type: 'string', description: 'Teléfono' },
        company: { type: 'string', description: 'Empresa' },
        country: { type: 'string', description: 'País' },
        source: { type: 'string', description: 'Fuente del contacto' },
        instagram: { type: 'string', description: 'Instagram handle' },
        whatsapp: { type: 'string', description: 'WhatsApp' },
        deal_value: { type: 'number', description: 'Valor estimado del deal' },
        notes: { type: 'string', description: 'Notas' },
        client_id: { type: 'string', description: 'UUID del tenant/cliente' },
      },
      required: ['name', 'email', 'client_id'],
    },
  },
  {
    name: 'crm_update_contact_status',
    description: 'Actualiza el estado de un contacto en el pipeline: Lead, Contacted, Qualified, Proposal, Negotiation, Won, Lost.',
    input_schema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string', description: 'UUID del contacto' },
        status: {
          type: 'string',
          enum: ['Lead', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'],
          description: 'Nuevo estado',
        },
      },
      required: ['contact_id', 'status'],
    },
  },
  {
    name: 'crm_get_pipeline_summary',
    description: 'Resumen del pipeline de ventas real: cuántos contactos en cada etapa (Lead, Contacted, Qualified, Proposal, Negotiation, Won, Lost) y valor total.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'crm_get_activities',
    description: 'Historial de actividades del CRM: calls, emails, meetings, notes. Se puede filtrar por contacto.',
    input_schema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string', description: 'UUID del contacto para filtrar' },
        type: {
          type: 'string',
          enum: ['call', 'email', 'meeting', 'note', 'all'],
          description: 'Tipo de actividad',
        },
      },
      required: [],
    },
  },
  {
    name: 'crm_log_activity',
    description: 'Registra una actividad en el CRM: llamada, email, reunión o nota.',
    input_schema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string', description: 'UUID del contacto' },
        client_id: { type: 'string', description: 'UUID del tenant' },
        type: {
          type: 'string',
          enum: ['call', 'email', 'meeting', 'note'],
          description: 'Tipo de actividad',
        },
        title: { type: 'string', description: 'Título de la actividad' },
        description: { type: 'string', description: 'Descripción/notas' },
        outcome: { type: 'string', description: 'Resultado (ej: interested, not_interested, callback)' },
      },
      required: ['contact_id', 'client_id', 'type', 'title'],
    },
  },
  {
    name: 'crm_get_pipelines',
    description: 'Obtiene los pipelines configurados con sus etapas (stages con key, label, color).',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'crm_search_local_leads',
    description: 'Busca leads locales del Enjambre (formularios de infoproductos). Tabla separada de crm_contacts.',
    input_schema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Buscar por email, nombre o teléfono' },
        status: {
          type: 'string',
          enum: ['nuevo', 'contactado', 'calificado', 'propuesta', 'negociacion', 'ganado', 'perdido', 'todos'],
          description: 'Estado del lead',
        },
      },
      required: ['search'],
    },
  },
  {
    name: 'crm_get_leads_stats',
    description: 'Estadísticas y conteo de leads locales (formularios/infoproductos). Muestra total, por estado, por landing_source (ej: detrasdecamara), hoy y esta semana. Usa SIEMPRE esta herramienta cuando pregunten cuántos leads hay.',
    input_schema: {
      type: 'object',
      properties: {
        landing_source: { type: 'string', description: 'Filtrar por fuente: detrasdecamara, etc. Vacío = todas' },
      },
      required: [],
    },
  },
  {
    name: 'crm_list_all_leads',
    description: 'Lista TODOS los leads locales con nombre, email, teléfono, estado y fuente. Usa esta herramienta para ver el detalle de los leads.',
    input_schema: {
      type: 'object',
      properties: {
        landing_source: { type: 'string', description: 'Filtrar por fuente: detrasdecamara, etc.' },
        status: { type: 'string', description: 'Filtrar por estado: nuevo, contactado, calificado, etc.' },
        limit: { type: 'number', description: 'Límite de resultados (default 50)' },
      },
      required: [],
    },
  },
  {
    name: 'crm_find_contacts_by_email',
    description: 'Busca contactos por email exacto en ambos sistemas (Supabase CRM + leads locales). Útil para cruzar datos.',
    input_schema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email exacto a buscar' },
      },
      required: ['email'],
    },
  },
];

export const crmHandlers = {
  async crm_search_contacts({ search, status = 'all' }) {
    let filter = `?select=id,name,email,phone,company,country,source,status,assigned_to,deal_value,instagram,whatsapp,tags,notes,created_at&or=(name.ilike.*${search}*,email.ilike.*${search}*,phone.ilike.*${search}*)&order=created_at.desc&limit=50`;
    if (status !== 'all') {
      filter += `&status=eq.${status}`;
    }
    return supabaseFetch('crm_contacts', filter);
  },

  async crm_create_contact(data) {
    return supabaseInsert('crm_contacts', {
      client_id: data.client_id,
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      company: data.company || null,
      country: data.country || null,
      source: data.source || 'enjambre',
      instagram: data.instagram || null,
      whatsapp: data.whatsapp || null,
      deal_value: data.deal_value || null,
      notes: data.notes || null,
      status: 'Lead',
    });
  },

  async crm_update_contact_status({ contact_id, status }) {
    return supabaseUpdate('crm_contacts', contact_id, {
      status,
      updated_at: new Date().toISOString(),
    });
  },

  async crm_get_pipeline_summary() {
    const contacts = await supabaseFetch('crm_contacts', '?select=status,deal_value');
    if (contacts.error) return contacts;

    const summary = {};
    contacts.forEach((c) => {
      const s = c.status || 'Lead';
      if (!summary[s]) summary[s] = { count: 0, total_value: 0 };
      summary[s].count++;
      summary[s].total_value += Number(c.deal_value) || 0;
    });

    return {
      total_contacts: contacts.length,
      pipeline: summary,
    };
  },

  async crm_get_activities({ contact_id, type = 'all' }) {
    let filter = '?select=id,contact_id,type,title,description,outcome,performed_by,performed_at,created_at&order=created_at.desc&limit=50';
    if (contact_id) filter += `&contact_id=eq.${contact_id}`;
    if (type !== 'all') filter += `&type=eq.${type}`;
    return supabaseFetch('crm_activities', filter);
  },

  async crm_log_activity(data) {
    return supabaseInsert('crm_activities', {
      client_id: data.client_id,
      contact_id: data.contact_id,
      type: data.type,
      title: data.title,
      description: data.description || null,
      outcome: data.outcome || null,
      performed_by: 'enjambre-cerebro',
      performed_at: new Date().toISOString(),
    });
  },

  async crm_get_pipelines() {
    return supabaseFetch('crm_pipelines', '?select=*');
  },

  async crm_search_local_leads({ search, status = 'todos' }) {
    const conditions = [`(nombre ILIKE $1 OR email ILIKE $1 OR telefono ILIKE $1)`];
    const params = [`%${search}%`];

    if (status !== 'todos') {
      conditions.push(`status = $2`);
      params.push(status);
    }

    return query(
      `SELECT * FROM leads WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT 50`,
      params
    );
  },

  async crm_get_leads_stats({ landing_source } = {}) {
    let whereClause = '';
    const params = [];

    if (landing_source) {
      params.push(landing_source);
      whereClause = `WHERE landing_source = $1`;
    }

    const stats = await query(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status = 'nuevo') as nuevos,
         COUNT(*) FILTER (WHERE status = 'contactado') as contactados,
         COUNT(*) FILTER (WHERE status = 'calificado') as calificados,
         COUNT(*) FILTER (WHERE status = 'ganado') as ganados,
         COUNT(*) FILTER (WHERE status = 'perdido') as perdidos,
         COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as hoy,
         COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE)) as esta_semana
       FROM leads ${whereClause}`,
      params
    );

    const bySource = await query(
      `SELECT landing_source, COUNT(*) as total FROM leads ${whereClause} GROUP BY landing_source ORDER BY total DESC`,
      params
    );

    return { ...stats[0], por_fuente: bySource };
  },

  async crm_list_all_leads({ landing_source, status, limit = 50 } = {}) {
    const conditions = [];
    const params = [];

    if (landing_source) {
      params.push(landing_source);
      conditions.push(`landing_source = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(Number(limit));

    return query(
      `SELECT id, nombre, email, telefono, producto, landing_source, status, created_at
       FROM leads ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
      params
    );
  },

  async crm_find_contacts_by_email({ email }) {
    // Buscar en ambos sistemas
    const [supabaseContacts, localLeads] = await Promise.all([
      supabaseFetch('crm_contacts', `?select=*&email=eq.${email}`).catch(() => []),
      query('SELECT * FROM leads WHERE email = $1', [email]).catch(() => []),
    ]);

    return {
      crm_contacts: supabaseContacts,
      local_leads: localLeads,
      found_in: [
        ...(supabaseContacts?.length ? ['supabase_crm'] : []),
        ...(localLeads?.length ? ['local_leads'] : []),
      ],
    };
  },
};
