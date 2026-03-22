import React, { useState, useEffect } from 'react';
import { getAgentStatus } from '../../services/api.js';
import { Shield, Users, TrendingUp, FileText } from 'lucide-react';

const AGENT_CONFIG = {
  ciber: { icon: Shield, label: 'CIBER / SOC', description: 'Ciberseguridad' },
  crm: { icon: Users, label: 'CRM', description: 'Ventas & Leads' },
  ops: { icon: TrendingUp, label: 'OPS / ERP', description: 'Operaciones' },
  forms: { icon: FileText, label: 'FORMS', description: 'Infoproductos' },
};

export default function AgentPanel() {
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    getAgentStatus().then(setAgents).catch(() => {});
    const interval = setInterval(() => {
      getAgentStatus().then(setAgents).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="agents-grid">
      {agents.map((agent) => {
        const config = AGENT_CONFIG[agent.agent_name] || {};
        const Icon = config.icon || Shield;
        const metrics = agent.metrics || {};

        return (
          <div key={agent.agent_name} className="agent-card">
            <div className="agent-header">
              <div className={`agent-icon ${agent.agent_name}`}>
                <Icon size={20} />
              </div>
              <div>
                <div className="agent-name">{config.label || agent.agent_name}</div>
                <div className="agent-status">
                  {agent.status === 'online' ? 'Activo' : 'Inactivo'}
                </div>
              </div>
            </div>
            <div className="agent-metrics">
              {Object.entries(metrics).slice(0, 4).map(([key, val]) => (
                <div key={key} className="agent-metric">
                  <div className="agent-metric-label">{key}</div>
                  <div className="agent-metric-value">{val}</div>
                </div>
              ))}
              {Object.keys(metrics).length === 0 && (
                <>
                  <div className="agent-metric">
                    <div className="agent-metric-label">Estado</div>
                    <div className="agent-metric-value" style={{ color: 'var(--accent-green)', fontSize: 14 }}>Online</div>
                  </div>
                  <div className="agent-metric">
                    <div className="agent-metric-label">Latencia</div>
                    <div className="agent-metric-value" style={{ fontSize: 14 }}>—</div>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
