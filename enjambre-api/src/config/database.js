// ============================================
// DATABASE — Supabase Only
// Sin dependencia de pg directo
// ============================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[DB] SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridos en .env');
  process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// ── Compatibility layer: query() y queryOne() via Supabase RPC ──
// Para queries SQL complejas, usamos supabase.rpc o el REST API
// Para queries simples, parseamos y usamos el query builder

// Generic SQL execution via Supabase's PostgREST isn't possible,
// so we provide helper functions that the codebase can migrate to.

// ── Direct table helpers ──
export async function query(sql, params = []) {
  // Parse simple queries and route to Supabase query builder
  const parsed = parseSimpleQuery(sql, params);
  if (parsed) return parsed;

  // Fallback: log warning for complex queries that need migration
  console.warn('[DB] Complex query needs migration to Supabase client:', sql.slice(0, 80));
  return [];
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

// ── SQL Parser for common patterns ──
function parseSimpleQuery(sql, params) {
  const clean = sql.replace(/\s+/g, ' ').trim();

  // SELECT * FROM table (with optional WHERE, ORDER, LIMIT)
  const selectMatch = clean.match(/^SELECT \* FROM (\w+)(.*)/i);
  if (selectMatch) {
    return handleSelect(selectMatch[1], selectMatch[2], params);
  }

  // SELECT with specific columns or aggregates
  const selectColsMatch = clean.match(/^SELECT (.+) FROM (\w+)(.*)/i);
  if (selectColsMatch) {
    return handleSelectCols(selectColsMatch[2], selectColsMatch[1], selectColsMatch[3], params);
  }

  // INSERT INTO table (...) VALUES (...) RETURNING *
  const insertMatch = clean.match(/^INSERT INTO (\w+) \(([^)]+)\) VALUES \(([^)]+)\) RETURNING \*/i);
  if (insertMatch) {
    return handleInsert(insertMatch[1], insertMatch[2], insertMatch[3], params);
  }

  // INSERT INTO table (...) VALUES (...) — without RETURNING
  const insertNoRetMatch = clean.match(/^INSERT INTO (\w+) \(([^)]+)\) VALUES \(([^)]+)\)$/i);
  if (insertNoRetMatch) {
    return handleInsert(insertNoRetMatch[1], insertNoRetMatch[2], insertNoRetMatch[3], params, false);
  }

  // UPDATE table SET ... WHERE ... RETURNING *
  const updateMatch = clean.match(/^UPDATE (\w+) SET (.+) WHERE (.+?)(?:\s+RETURNING \*)?$/i);
  if (updateMatch) {
    return handleUpdate(updateMatch[1], updateMatch[2], updateMatch[3], params, clean.includes('RETURNING'));
  }

  return null; // Not parseable — fallback
}

async function handleSelect(table, rest, params) {
  let q = supabase.from(table).select('*');
  q = applyWhere(q, rest, params);
  q = applyOrderLimit(q, rest, params);
  const { data, error } = await q;
  if (error) throw new Error(`[DB] SELECT ${table}: ${error.message}`);
  return data || [];
}

async function handleSelectCols(table, cols, rest, params) {
  // For COUNT(*) FILTER queries (lead stats), use a dedicated handler
  if (cols.includes('COUNT(*)') && cols.includes('FILTER')) {
    return handleAggregateSelect(table, cols, rest, params);
  }

  // For JOINs, use specific handlers
  if (rest.includes('JOIN')) {
    return handleJoinSelect(table, cols, rest, params);
  }

  let selectCols = cols.trim() === '*' ? '*' : cols.trim();
  let q = supabase.from(table).select(selectCols);
  q = applyWhere(q, rest, params);
  q = applyOrderLimit(q, rest, params);
  const { data, error } = await q;
  if (error) throw new Error(`[DB] SELECT ${table}: ${error.message}`);
  return data || [];
}

async function handleAggregateSelect(table, cols, rest, params) {
  // Special case: leads/stats query
  if (table === 'leads') {
    const { data, error, count } = await supabase.from('leads').select('*', { count: 'exact' });
    if (error) throw new Error(`[DB] leads stats: ${error.message}`);
    const rows = data || [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    return [{
      total: rows.length,
      nuevos: rows.filter(r => r.status === 'nuevo').length,
      contactados: rows.filter(r => r.status === 'contactado').length,
      calificados: rows.filter(r => r.status === 'calificado').length,
      ganados: rows.filter(r => r.status === 'ganado').length,
      perdidos: rows.filter(r => r.status === 'perdido').length,
      hoy: rows.filter(r => new Date(r.created_at) >= today).length,
      esta_semana: rows.filter(r => new Date(r.created_at) >= weekStart).length,
    }];
  }
  return [];
}

async function handleJoinSelect(table, cols, rest, params) {
  // sequence_enrollments JOIN sequences JOIN leads
  if (table === 'sequence_enrollments' && rest.includes('sequences') && rest.includes('leads')) {
    const statusParam = params[0] || 'active';
    const limitParam = params[1] || 50;

    const { data, error } = await supabase
      .from('sequence_enrollments')
      .select('*, sequences(name), leads(nombre, email, telefono, producto)')
      .eq('status', statusParam)
      .order('next_fire_at', { ascending: true })
      .limit(limitParam);

    if (error) throw new Error(`[DB] JOIN enrollments: ${error.message}`);
    // Flatten the joined data
    return (data || []).map(row => ({
      ...row,
      sequence_name: row.sequences?.name,
      nombre: row.leads?.nombre,
      email: row.leads?.email,
      telefono: row.leads?.telefono,
      producto: row.leads?.producto,
      sequences: undefined,
      leads: undefined,
    }));
  }
  return [];
}

async function handleInsert(table, colsStr, valsStr, params, returning = true) {
  const cols = colsStr.split(',').map(c => c.trim());
  const obj = {};
  cols.forEach((col, i) => {
    let val = params[i];
    // Handle JSON stringification
    if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
      try { val = JSON.parse(val); } catch {}
    }
    obj[col] = val;
  });

  const q = supabase.from(table).insert(obj);
  if (returning) {
    const { data, error } = await q.select().single();
    if (error) throw new Error(`[DB] INSERT ${table}: ${error.message}`);
    return [data];
  } else {
    const { error } = await q;
    if (error) throw new Error(`[DB] INSERT ${table}: ${error.message}`);
    return [];
  }
}

async function handleUpdate(table, setClause, whereClause, params, returning) {
  // Parse SET clause: col1 = $1, col2 = COALESCE($2, col2), ...
  const updates = {};
  const setParts = setClause.split(',').map(s => s.trim());

  for (const part of setParts) {
    const eqMatch = part.match(/(\w+)\s*=\s*(.+)/);
    if (!eqMatch) continue;
    const col = eqMatch[1].trim();
    let val = eqMatch[2].trim();

    if (val === 'NOW()' || val === 'now()') {
      updates[col] = new Date().toISOString();
    } else if (val.match(/^\$\d+$/)) {
      const idx = parseInt(val.slice(1)) - 1;
      updates[col] = params[idx];
    } else if (val.match(/^COALESCE\(\$(\d+)/i)) {
      const idx = parseInt(val.match(/\$(\d+)/)[1]) - 1;
      if (params[idx] != null) updates[col] = params[idx];
    }
  }

  // Parse WHERE clause
  let q = supabase.from(table).update(updates);
  q = applyWhereClause(q, whereClause, params);

  if (returning) {
    const { data, error } = await q.select().single();
    if (error) throw new Error(`[DB] UPDATE ${table}: ${error.message}`);
    return [data];
  } else {
    const { error } = await q;
    if (error && !error.message.includes('No rows found')) throw new Error(`[DB] UPDATE ${table}: ${error.message}`);
    return [];
  }
}

// ── WHERE clause helpers ──
function applyWhere(q, rest, params) {
  if (!rest) return q;
  const whereMatch = rest.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s*$)/i);
  if (!whereMatch) return q;
  return applyWhereClause(q, whereMatch[1], params);
}

function applyWhereClause(q, clause, params) {
  if (!clause) return q;
  // Split by AND
  const conditions = clause.split(/\s+AND\s+/i);
  for (const cond of conditions) {
    const eqMatch = cond.match(/(\S+)\s*=\s*\$(\d+)/);
    if (eqMatch) {
      const col = eqMatch[1].replace(/['"]/g, '');
      const idx = parseInt(eqMatch[2]) - 1;
      // Handle JSONB operator ->>
      if (col.includes('->>')) {
        const [tbl, jsonPath] = col.split('->>');
        q = q.filter(tbl.trim(), 'eq', params[idx]);
      } else {
        q = q.eq(col, params[idx]);
      }
    }
  }
  return q;
}

function applyOrderLimit(q, rest, params) {
  if (!rest) return q;

  // ORDER BY
  const orderMatch = rest.match(/ORDER BY\s+(\w+)\s+(ASC|DESC)/i);
  if (orderMatch) {
    q = q.order(orderMatch[1], { ascending: orderMatch[2].toUpperCase() === 'ASC' });
  }

  // LIMIT
  const limitMatch = rest.match(/LIMIT\s+\$(\d+)/i);
  if (limitMatch) {
    const idx = parseInt(limitMatch[1]) - 1;
    q = q.limit(params[idx]);
  } else {
    const literalLimit = rest.match(/LIMIT\s+(\d+)/i);
    if (literalLimit) q = q.limit(parseInt(literalLimit[1]));
  }

  // OFFSET
  const offsetMatch = rest.match(/OFFSET\s+\$(\d+)/i);
  if (offsetMatch) {
    const idx = parseInt(offsetMatch[1]) - 1;
    q = q.range(params[idx], params[idx] + (params[parseInt(limitMatch?.[1]) - 1] || 50) - 1);
  }

  return q;
}

// ── DB pool compatibility (for graceful shutdown) ──
export const db = {
  end: async () => { /* Supabase client doesn't need explicit close */ },
};
