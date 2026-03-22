import pg from 'pg';

export const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
});

export async function query(text, params) {
  const result = await db.query(text, params);
  return result.rows;
}

export async function queryOne(text, params) {
  const rows = await query(text, params);
  return rows[0] || null;
}
