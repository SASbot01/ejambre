const API_BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
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
  const es = new EventSource(`${API_BASE}/events/stream`);
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
