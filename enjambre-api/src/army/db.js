// ============================================================================
// Dona — Pool Postgres dedicado para el ejército.
// Los datos operacionales del ejército (heartbeats, decisiones, órdenes) viven
// en el postgres local del stack (no Supabase). Así cada Comandante puede
// leer/escribir libremente sin pasar por el compatibility layer a Supabase.
// ============================================================================

import pg from 'pg';

const { Pool } = pg;

// DATABASE_URL viene del docker-compose, formato:
// postgresql://<user>:<password>@postgres:5432/<db>
const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER || 'enjambre'}:${process.env.POSTGRES_PASSWORD}@postgres:5432/${process.env.POSTGRES_DB || 'enjambre'}`;

export const armyDb = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 30_000,
});

armyDb.on('error', err => {
  console.error('[ArmyDB] idle client error:', err.message);
});

export async function armyQuery(sql, params = []) {
  const res = await armyDb.query(sql, params);
  return res.rows;
}
