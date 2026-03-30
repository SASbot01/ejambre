import React, { useState, useEffect } from 'react';
import { getLeadStats } from '../../services/api.js';
import { Zap, TrendingUp, UserPlus, MessageCircle, Trophy, XCircle } from 'lucide-react';

export default function KPIPanel() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    getLeadStats().then(setStats).catch(() => {});
    const interval = setInterval(() => {
      getLeadStats().then(setStats).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const kpis = [
    { label: 'Leads Hoy', value: stats?.hoy ?? '—', color: 'orange', icon: Zap },
    { label: 'Esta Semana', value: stats?.esta_semana ?? '—', color: 'blue', icon: TrendingUp },
    { label: 'Nuevos', value: stats?.nuevos ?? '—', color: 'yellow', icon: UserPlus },
    { label: 'Contactados', value: stats?.contactados ?? '—', color: 'purple', icon: MessageCircle },
    { label: 'Ganados', value: stats?.ganados ?? '—', color: 'green', icon: Trophy },
    { label: 'Perdidos', value: stats?.perdidos ?? '—', color: 'red', icon: XCircle },
  ];

  const colorMap = {
    orange: { bg: 'rgba(255,107,0,0.1)', text: 'var(--orange)' },
    blue: { bg: 'rgba(59,130,246,0.1)', text: 'var(--info)' },
    yellow: { bg: 'rgba(255,184,0,0.1)', text: 'var(--warning)' },
    purple: { bg: 'rgba(168,85,247,0.1)', text: '#A855F7' },
    green: { bg: 'rgba(34,197,94,0.1)', text: 'var(--success)' },
    red: { bg: 'rgba(239,68,68,0.1)', text: 'var(--danger)' },
  };

  return (
    <div className="kpi-grid">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        const colors = colorMap[kpi.color];
        return (
          <div key={kpi.label} className={`kpi ${kpi.color}`}>
            <div className="kpi-icon" style={{ background: colors.bg, color: colors.text }}>
              <Icon size={18} />
            </div>
            <span className="kpi-label">{kpi.label}</span>
            <span className={`kpi-value ${kpi.color}`}>{kpi.value}</span>
          </div>
        );
      })}
    </div>
  );
}
