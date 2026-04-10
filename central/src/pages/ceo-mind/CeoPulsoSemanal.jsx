import { useState, useMemo } from 'react'
import { useAsync } from '../../hooks/useAsync'
import { useClientData } from '../../hooks/useClientData'

function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

function formatWeekRange(weekStart) {
  const start = new Date(weekStart)
  const end = new Date(start); end.setDate(start.getDate() + 6)
  return `${start.toLocaleDateString('es', { day: 'numeric', month: 'short' })} — ${end.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

const MOCK_DIGEST = {
  numbersSummary: '• 12 ventas cerradas (↑15% vs semana anterior)\n• €47,500 en cash collected\n• 3 meetings con clientes clave\n• 2 proyectos avanzaron a siguiente fase',
  executiveSummary: 'Semana fuerte en ventas con el lanzamiento de la campaña de Facebook Ads. El equipo de setters superó la meta de appointments por primera vez en el mes.',
  decisionsTaken: '• Aprobado presupuesto Q2 de marketing\n• Contratación de nuevo closer aprobada\n• Migración a nuevo CRM planificada para abril',
  nextSteps: '• Onboarding del nuevo closer (responsable: Manager)\n• Preparar presentación para investors (responsable: CEO)\n• Lanzar campaña de retargeting (responsable: Marketing)',
  alerts: '• Churn rate subió a 5.2% — requiere atención\n• Servidor de pagos reportó 2 incidentes esta semana',
}

export default function CeoPulsoSemanal() {
  const { getCeoWeeklyDigests } = useClientData()
  const [digests] = useAsync(getCeoWeeklyDigests, [])
  const [weekOffset, setWeekOffset] = useState(0)

  const currentWeekStart = useMemo(() => {
    const now = new Date(); now.setDate(now.getDate() + weekOffset * 7)
    return getWeekStart(now)
  }, [weekOffset])

  const digest = digests.find(d => (d.weekStart || d.week_start) === currentWeekStart)
  const showMock = !digest && weekOffset === 0
  const data = digest || (showMock ? MOCK_DIGEST : null)

  return (
    <div className="form-page">
      <h2 style={{ margin: '0 0 24px', color: '#fff' }}>📊 Pulso Semanal</h2>

      <div className="ceo-phase-banner">
        <span className="ceo-phase-banner__icon">🤖</span>
        <div className="ceo-phase-banner__text"><strong>Claude AI generará automáticamente este resumen</strong> — Fase 2. Mientras tanto, se muestra un ejemplo.</div>
      </div>

      <div className="ceo-week-selector" style={{ margin: '20px 0' }}>
        <button onClick={() => setWeekOffset(w => w - 1)}>← Anterior</button>
        <span>{formatWeekRange(currentWeekStart)}</span>
        <button onClick={() => setWeekOffset(w => w + 1)}>Siguiente →</button>
      </div>

      {data ? (
        <div className="ceo-digest-content">
          {data.numbersSummary && <><h4>📈 Números</h4><p style={{ whiteSpace: 'pre-wrap' }}>{data.numbersSummary}</p></>}
          {(data.executiveSummary || data.executive_summary) && <><h4>📋 Resumen Ejecutivo</h4><p style={{ whiteSpace: 'pre-wrap' }}>{data.executiveSummary || data.executive_summary}</p></>}
          {(data.decisionsTaken || data.decisions_taken) && <><h4>✅ Decisiones</h4><p style={{ whiteSpace: 'pre-wrap' }}>{data.decisionsTaken || data.decisions_taken}</p></>}
          {(data.nextSteps || data.next_steps) && <><h4>➡️ Próximos Pasos</h4><p style={{ whiteSpace: 'pre-wrap' }}>{data.nextSteps || data.next_steps}</p></>}
          {data.alerts && <><h4>⚠️ Alertas</h4><p style={{ whiteSpace: 'pre-wrap' }}>{data.alerts}</p></>}
          {showMock && <div style={{ marginTop: 16, padding: 12, background: 'rgba(255,184,0,0.08)', borderRadius: 8, fontSize: '0.78rem', color: '#b89a3a' }}>ℹ️ Este es un ejemplo. Los datos reales se generarán con Claude AI en Fase 2.</div>}
        </div>
      ) : (
        <div className="form-card" style={{ textAlign: 'center', color: '#666', padding: 40 }}>No hay resumen disponible para esta semana.</div>
      )}
    </div>
  )
}
