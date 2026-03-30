import pg from 'pg';

const dbUrl = process.env.DATABASE_URL;
let poolConfig = { max: 20 };

if (dbUrl) {
  try {
    const url = new URL(dbUrl);
    poolConfig = {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.slice(1),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      max: 20,
    };
  } catch {
    poolConfig = { connectionString: dbUrl, max: 20 };
  }
}

export const db = new pg.Pool(poolConfig);

export async function query(text, params) {
  const result = await db.query(text, params);
  return result.rows;
}

export async function queryOne(text, params) {
  const rows = await query(text, params);
  return rows[0] || null;
}
