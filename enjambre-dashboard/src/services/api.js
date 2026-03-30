const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('enjambre_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('enjambre_token');
    localStorage.removeItem('enjambre_user');
    window.location.reload();
    throw new Error('Sesión expirada');
  }
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

// Chat con el Cerebro
export async function sendChat(message, sessionId = 'dashboard') {
  return request('/chat', {
    method: 'POST',
    body: JSON.stringify({ message, session_id: sessionId }),
  });
}

// Eventos
export function subscribeEvents(onEvent) {
  const token = getToken();
  const es = new EventSource(`${API_BASE}/events/stream${token ? `?token=${token}` : ''}`);
  es.onmessage = (e) => {
    try {
      onEvent(JSON.parse(e.data));
    } catch {}
  };
  es.onerror = () => {
    setTimeout(() => subscribeEvents(onEvent), 3000);
    es.close();
  };
  return () => es.close();
}

export async function getEvents(limit = 50) {
  return request(`/events?limit=${limit}`);
}

// Agentes
export async function getAgentStatus() {
  return request('/agents/status');
}

// Leads
export async function getLeads(status) {
  const qs = status ? `?status=${status}` : '';
  return request(`/leads${qs}`);
}

export async function getLeadStats() {
  return request('/leads/stats');
}

// Decisiones
export async function getDecisions(limit = 20) {
  return request(`/decisions?limit=${limit}`);
}

// Health
export async function getHealth() {
  return request('/health');
}

// Logout
export function logout() {
  localStorage.removeItem('enjambre_token');
  localStorage.removeItem('enjambre_user');
  window.location.reload();
}
