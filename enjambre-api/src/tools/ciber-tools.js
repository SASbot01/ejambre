// ============================================
// AGENTE CIBER - Herramientas para Claude
// Conecta con BlackWolf SOC API
//
// AUTH: Spring Security JWT con companyDomain
// Endpoints confirmados: threats, incidents, sensors,
// assets, ueba/profiles
// ============================================

const SOC_URL = process.env.SOC_API_URL || 'https://soc.blackwolfsec.io';
const SOC_EMAIL = process.env.SOC_USERNAME || '';
const SOC_PASSWORD = process.env.SOC_PASSWORD || '';
const SOC_DOMAIN = process.env.SOC_COMPANY_DOMAIN || 'blackwolfsec.io';

let jwtToken = null;
let refreshToken = null;
let tokenExpiry = 0;

async function authenticate() {
  const res = await fetch(`${SOC_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: SOC_EMAIL,
      password: SOC_PASSWORD,
      companyDomain: SOC_DOMAIN,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`SOC login failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  jwtToken = data.accessToken;
  refreshToken = data.refreshToken;
  // Token dura 900s (15min), renovar a los 13min
  tokenExpiry = Date.now() + 13 * 60 * 1000;
  return jwtToken;
}

async function getToken() {
  if (jwtToken && Date.now() < tokenExpiry) return jwtToken;

  // Intentar refresh primero
  if (refreshToken) {
    try {
      const res = await fetch(`${SOC_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (res.ok) {
        const data = await res.json();
        jwtToken = data.accessToken;
        refreshToken = data.refreshToken;
        tokenExpiry = Date.now() + 13 * 60 * 1000;
        return jwtToken;
      }
    } catch {}
  }

  // Login completo
  return authenticate();
}

async function socFetch(path, options = {}) {
  if (!SOC_EMAIL || !SOC_PASSWORD) {
    return {
      error: 'SOC no configurado. Configura SOC_USERNAME y SOC_PASSWORD en .env',
      hint: 'También necesitas SOC_COMPANY_DOMAIN (default: blackwolfsec.io)',
    };
  }

  try {
    const token = await getToken();
    const res = await fetch(`${SOC_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (res.status === 401) {
      // Token expiró, re-autenticar
      jwtToken = null;
      tokenExpiry = 0;
      const newToken = await authenticate();
      const retry = await fetch(`${SOC_URL}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newToken}`,
          ...options.headers,
        },
      });
      if (!retry.ok) return { error: `SOC API ${retry.status} en ${path}` };
      return retry.json();
    }

    if (!res.ok) return { error: `SOC API ${res.status} en ${path}` };
    return res.json();
  } catch (err) {
    return { error: `SOC conexión fallida: ${err.message}` };
  }
}

export const ciberTools = [
  {
    name: 'ciber_get_active_threats',
    description: 'Obtiene amenazas del SOC. Campos: threatType (RECONNAISSANCE, BRUTE_FORCE, EXPLOIT, MALWARE, etc.), severity (1-10), srcIp, dstIp, dstPort, status, description, sensorId.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Máximo de resultados. Default 20.' },
      },
      required: [],
    },
  },
  {
    name: 'ciber_get_incidents',
    description: 'Lista incidentes de seguridad. Campos: title, severity (low/medium/high/critical), status (open/resolved), assignedTo, sourceThreatId, slaDeadline.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['open', 'in_progress', 'resolved', 'all'],
          description: 'Filtrar por estado',
        },
      },
      required: [],
    },
  },
  {
    name: 'ciber_get_sensors',
    description: 'Lista sensores del SOC: nombre, tipo (IDS, HONEYPOT, WAF, FIM, etc.), estado, amenazas detectadas.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'ciber_get_assets',
    description: 'Inventario de activos protegidos: nombre, tipo, IP, hostname, criticidad, estado.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'ciber_get_ueba_profiles',
    description: 'Perfiles de comportamiento UEBA: anomalías detectadas por IP/usuario.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'ciber_get_soc_status',
    description: 'Estado general del SOC: resumen de amenazas recientes, incidentes abiertos, sensores activos.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'ciber_search_threats_by_ip',
    description: 'Busca amenazas relacionadas con una IP específica (como origen o destino).',
    input_schema: {
      type: 'object',
      properties: {
        ip: { type: 'string', description: 'IP a buscar' },
      },
      required: ['ip'],
    },
  },
];

export const ciberHandlers = {
  async ciber_get_active_threats({ limit = 20 }) {
    const result = await socFetch(`/api/v1/threats?limit=${limit}`);
    // La API devuelve paginado con content[]
    if (result?.content) return result.content;
    return result;
  },

  async ciber_get_incidents({ status = 'all' }) {
    const result = await socFetch('/api/v1/incidents');
    if (result?.error) return result;
    if (status === 'all') return Array.isArray(result) ? result.slice(0, 50) : result;
    return (Array.isArray(result) ? result : []).filter(
      (i) => i.status?.toLowerCase() === status.toLowerCase()
    );
  },

  async ciber_get_sensors() {
    return socFetch('/api/v1/sensors');
  },

  async ciber_get_assets() {
    return socFetch('/api/v1/assets');
  },

  async ciber_get_ueba_profiles() {
    return socFetch('/api/v1/ueba/profiles');
  },

  async ciber_get_soc_status() {
    const [threats, incidents, sensors] = await Promise.all([
      socFetch('/api/v1/threats?limit=5'),
      socFetch('/api/v1/incidents'),
      socFetch('/api/v1/sensors'),
    ]);

    const recentThreats = threats?.content || threats;
    const openIncidents = Array.isArray(incidents)
      ? incidents.filter((i) => i.status === 'open')
      : [];
    const activeSensors = Array.isArray(sensors)
      ? sensors.filter((s) => s.status === 'active' || s.status === 'online')
      : [];

    return {
      soc_url: SOC_URL,
      authenticated: !!jwtToken,
      threats_last_5: Array.isArray(recentThreats) ? recentThreats.map((t) => ({
        type: t.threatType,
        severity: t.severity,
        src_ip: t.srcIp,
        description: t.description?.slice(0, 100),
        time: t.timestamp,
      })) : [],
      open_incidents: openIncidents.length,
      total_incidents: Array.isArray(incidents) ? incidents.length : 0,
      active_sensors: activeSensors.length,
      total_sensors: Array.isArray(sensors) ? sensors.length : 0,
    };
  },

  async ciber_search_threats_by_ip({ ip }) {
    // Obtener threats y filtrar por IP
    const result = await socFetch('/api/v1/threats?limit=200');
    const threats = result?.content || result;
    if (!Array.isArray(threats)) return result;

    return threats.filter(
      (t) => t.srcIp === ip || t.dstIp === ip
    ).slice(0, 50);
  },
};
