import React, { useState, useEffect } from 'react';
import { getLeadStats, getHealth } from '../../services/api.js';

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
    { label: 'Leads Hoy', value: stats?.hoy ?? '—', color: 'cyan' },
    { label: 'Esta Semana', value: stats?.esta_semana ?? '—', color: 'blue' },
    { label: 'Nuevos', value: stats?.nuevos ?? '—', color: 'yellow' },
    { label: 'Contactados', value: stats?.contactados ?? '—', color: 'purple' },
    { label: 'Ganados', value: stats?.ganados ?? '—', color: 'green' },
    { label: 'Perdidos', value: stats?.perdidos ?? '—', color: 'red' },
  ];

  return (
    <div className="kpi-grid">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="kpi">
          <span className="kpi-label">{kpi.label}</span>
          <span className={`kpi-value ${kpi.color}`}>{kpi.value}</span>
        </div>
      ))}
    </div>
  );
}
