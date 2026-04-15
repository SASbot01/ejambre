import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
const JWT_EXPIRY = '24h';

// Hash password with SHA-256 (no bcrypt dependency needed)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Admin credentials - stored as hash
const ADMIN_USER = {
  email: 'admin@blackwolfsec.io',
  password_hash: hashPassword('Enjambre2026!Bw'),
  name: 'Admin BlackWolf',
  role: 'admin',
};

export function authenticate(email, password) {
  if (email === ADMIN_USER.email && hashPassword(password) === ADMIN_USER.password_hash) {
    const token = jwt.sign(
      { email: ADMIN_USER.email, name: ADMIN_USER.name, role: ADMIN_USER.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
    return { token, user: { email: ADMIN_USER.email, name: ADMIN_USER.name, role: ADMIN_USER.role } };
  }
  return null;
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// Fastify auth hook - skip for health, login, and webhooks
const PUBLIC_PATHS = ['/health', '/api/auth/login', '/api/forms/webhook', '/api/webhooks/soc', '/api/webhooks/whatsapp', '/api/webhooks/central', '/api/webhooks/manychat'];

export function authHook(app) {
  app.addHook('onRequest', async (req, reply) => {
    const [path, queryString] = req.url.split('?');

    if (PUBLIC_PATHS.some((p) => path === p)) return;
    if (!path.startsWith('/api')) return;

    // Check Authorization header first, then query param (for SSE)
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else if (queryString) {
      const params = new URLSearchParams(queryString);
      token = params.get('token');
    }

    if (!token) {
      reply.code(401).send({ error: 'Token requerido' });
      return;
    }

    const user = verifyToken(token);
    if (!user) {
      reply.code(401).send({ error: 'Token inválido o expirado' });
      return;
    }

    req.user = user;
  });
}
