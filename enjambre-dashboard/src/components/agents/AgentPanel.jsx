import React, { memo, useState, useEffect, useMemo } from 'react';
import { getAgentStatus } from '../../services/api.js';
import {
  Shield, Users, TrendingUp, FileText, Bot, MessageSquare,
  Globe, Search, X, Clock, Zap, Wrench, ChevronRight, Code2,
} from 'lucide-react';

const AGENTS = [
  {
    id: 'cerebro',
    icon: Bot,
    label: 'CEREBRO',
    subtitle: 'Orquestador IA',
    description: 'Cerebro central del Enjambre. Orquesta todos los agentes usando Claude, toma decisiones autonomas y coordina acciones entre sistemas.',
    color: '#FF6B00',
    tools: ['Orquestacion multi-agente', 'Toma de decisiones', 'Correlacion de datos', 'Auto-trigger por eventos'],
    alwaysOnline: true,
  },
  {
    id: 'ciber',
    icon: Shield,
    label: 'CIBER / SOC',
    subtitle: 'Ciberseguridad',
    description: 'Monitoreo 24/7 del SOC. Detecta amenazas, gestiona incidentes, analiza comportamiento de usuarios y correlaciona IPs sospechosas.',
    color: '#EF4444',
    tools: ['Amenazas activas', 'Gestion de incidentes', 'Sensores IDS/WAF/FIM', 'Inventario de activos', 'Perfiles UEBA', 'Estado SOC', 'Busqueda por IP'],
  },
  {
    id: 'crm',
    icon: Users,
    label: 'CRM / Ventas',
    subtitle: 'Pipeline & Leads',
    description: 'Gestion de contactos, pipeline de ventas y seguimiento de leads. Conectado a Supabase CRM y base local de infoproductos.',
    color: '#3B82F6',
    tools: ['Buscar contactos', 'Crear contacto', 'Mover pipeline', 'Resumen pipeline', 'Historial actividades', 'Registrar actividad', 'Leads locales', 'Stats de leads', 'Busqueda por email'],
  },
  {
    id: 'ops',
    icon: TrendingUp,
    label: 'OPS / ERP',
    subtitle: 'Operaciones',
    description: 'Revenue tracking, rendimiento de equipo, comisiones y proyecciones. Conectado a Dashboard-Ops via Supabase.',
    color: '#22C55E',
    tools: ['Resumen ventas', 'Rendimiento equipo', 'Comisiones', 'Auditoria transacciones', 'Proyecciones', 'Catalogo productos', 'Reportes diarios', 'Lista clientes'],
  },
  {
    id: 'forms',
    icon: FileText,
    label: 'FORMS',
    subtitle: 'Webhooks',
    description: 'Captura de leads desde landings y formularios externos. Recibe webhooks, crea leads y dispara eventos automaticos.',
    color: '#A855F7',
    tools: ['Webhook receptor', 'Creacion de leads', 'Evento lead.created', 'UTM tracking'],
  },
  {
    id: 'discord',
    icon: MessageSquare,
    label: 'DISCORD',
    subtitle: 'Bot Connector',
    description: 'Bot de Discord para interactuar con el Enjambre via chat. Soporta sesiones por usuario y comandos directos.',
    color: '#5865F2',
    tools: ['Chat con Cerebro', 'Sesiones por usuario', 'Comando !reset', 'Comando !status'],
  },
  {
    id: 'dcc',
    icon: Globe,
    label: 'DCC LANDING',
    subtitle: 'Sync Leads',
    description: 'Sincroniza leads desde la landing "Detras de Camara" (Supabase externo). Polling cada 30 segundos con deduplicacion.',
    color: '#F59E0B',
    tools: ['Polling 30s', 'Sync a CRM', 'Sync a leads local', 'Evento lead.created'],
  },
  {
    id: 'developer',
    icon: Code2,
    label: 'DEV AGENT',
    subtitle: 'Developer IA',
    description: 'Analiza, optimiza y actualiza los proyectos de BlackWolf. Acceso a Enjambre, SOC y Dashboard-Ops. No toca datos de clientes.',
    color: '#10B981',
    tools: ['Analisis de codigo', 'Optimizacion', 'Deploy', 'Git push', 'Tickets', 'Code review'],
  },
  {
    id: 'prospector',
    icon: Search,
    label: 'PROSPECTOR',
    subtitle: 'Lead Generation',
    description: 'Pipeline de 7 fases para generacion de leads B2B. Busca empresas, enriquece con IA, scraping profundo y emails personalizados.',
    color: '#EC4899',
    tools: ['Busqueda multi-fuente', 'Enriquecimiento IA', 'Insert CRM', 'Deep scraping', 'Emails personalizados', 'Listas email', 'Market research'],
  },
];

const AgentPanel = memo(({ events = [] }) => {
  const [agentStatuses, setAgentStatuses] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);

  useEffect(() => {
    getAgentStatus().then(setAgentStatuses).catch(() => {});
    const interval = setInterval(() => {
      getAgentStatus().then(setAgentStatuses).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const getStatus = useMemo(() => (agentId) => {
    const agent = AGENTS.find(a => a.id === agentId);
    if (agent?.alwaysOnline) return true;
    const s = agentStatuses.find(a => a.agent_name === agentId);
    return s?.status === 'online';
  }, [agentStatuses]);

  const getMetrics = useMemo(() => (agentId) => {
    const s = agentStatuses.find(a => a.agent_name === agentId);
    return s?.metrics || {};
  }, [agentStatuses]);

  const getAgentEvents = useMemo(() => (agentId) => {
    if (agentId === 'cerebro') return events.slice(0, 30);
    return events.filter(e => e.source_agent === agentId).slice(0, 30);
  }, [events]);

  const selected = AGENTS.find(a => a.id === selectedAgent);

  return (
    <>
      {/* Connection visualization */}
      <div className="agents-connection">
        <div className="conn-node" />
        <div className="conn-line" />
        <div className="conn-node" style={{ width: 14, height: 14 }} />
        <div className="conn-line" />
        <div className="conn-node" />
      </div>

      {/* Agent Grid */}
      <div className="agents-grid-full">
        {AGENTS.map((agent) => {
          const Icon = agent.icon;
          const online = getStatus(agent.id);
          const metrics = getMetrics(agent.id);
          const agentEvents = getAgentEvents(agent.id);

          return (
            <button
              key={agent.id}
              className={`agent-card-mini ${selectedAgent === agent.id ? 'selected' : ''}`}
              onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
              style={{ '--agent-color': agent.color }}
            >
              <div className="agent-card-mini-glow" />
              <div className="agent-card-mini-icon" style={{ background: `${agent.color}15`, color: agent.color }}>
                <Icon size={20} />
              </div>
              <div className="agent-card-mini-info">
                <div className="agent-card-mini-name">{agent.label}</div>
                <div className="agent-card-mini-sub">{agent.subtitle}</div>
              </div>
              <div className="agent-card-mini-status">
                <div className={`status-indicator ${online ? 'online' : 'offline'}`}
                  style={{ background: online ? '#22C55E' : '#EF4444' }} />
              </div>
              {agentEvents.length > 0 && (
                <span className="agent-card-mini-count">{agentEvents.length}</span>
              )}
              <ChevronRight size={14} className="agent-card-mini-arrow" />
            </button>
          );
        })}
      </div>

      {/* Agent Detail Panel */}
      {selected && (
        <div className="agent-detail-panel fade-in">
          <div className="agent-detail-header">
            <div className="agent-detail-title-row">
              <div className="agent-detail-icon" style={{ background: `${selected.color}15`, color: selected.color }}>
                <selected.icon size={24} />
              </div>
              <div>
                <h3 className="agent-detail-name">{selected.label}</h3>
                <span className="agent-detail-sub">{selected.subtitle}</span>
              </div>
              <button className="agent-detail-close" onClick={() => setSelectedAgent(null)}>
                <X size={18} />
              </button>
            </div>
            <p className="agent-detail-desc">{selected.description}</p>
          </div>

          {/* Tools */}
          <div className="agent-detail-section">
            <div className="agent-detail-section-title">
              <Wrench size={14} />
              Herramientas ({selected.tools.length})
            </div>
            <div className="agent-detail-tools">
              {selected.tools.map((tool) => (
                <span key={tool} className="agent-tool-tag" style={{ borderColor: `${selected.color}30`, color: selected.color }}>
                  {tool}
                </span>
              ))}
            </div>
          </div>

          {/* Metrics */}
          {Object.keys(getMetrics(selected.id)).length > 0 && (
            <div className="agent-detail-section">
              <div className="agent-detail-section-title">
                <Zap size={14} />
                Metricas
              </div>
              <div className="agent-metrics">
                {Object.entries(getMetrics(selected.id)).slice(0, 6).map(([key, val]) => (
                  <div key={key} className="agent-metric">
                    <div className="agent-metric-label">{key}</div>
                    <div className="agent-metric-value">{val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity History */}
          <div className="agent-detail-section">
            <div className="agent-detail-section-title">
              <Clock size={14} />
              Historial de actividad
            </div>
            <div className="agent-detail-history">
              {getAgentEvents(selected.id).length === 0 ? (
                <div className="agent-history-empty">Sin actividad reciente</div>
              ) : (
                getAgentEvents(selected.id).map((event, i) => (
                  <div key={i} className="agent-history-item">
                    <span className="agent-history-time">
                      {new Date(event.timestamp || Date.now()).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span className="agent-history-type">{event.event_type}</span>
                    <span className="agent-history-text">
                      {formatPayload(event)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
});

function formatPayload(event) {
  const p = event.payload || {};
  const type = event.event_type || '';
  if (type === 'lead.created') return `${p.email || '?'} — ${p.producto || ''}`;
  if (type === 'threat.detected') return `${p.severity || '?'}: ${p.type || '?'} desde ${p.source_ip || '?'}`;
  if (type === 'tool.executed') return `Tool: ${p.tool || '?'}`;
  if (type === 'tool.error') return `Error: ${p.tool || '?'}`;
  if (type === 'sale.closed') return `$${p.amount || '?'} por ${p.closer || '?'}`;
  return JSON.stringify(p).slice(0, 80);
}

export default AgentPanel;