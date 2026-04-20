import { useState } from 'react'
import { useClientData } from '../../hooks/useClientData'
import { useAsync } from '../../hooks/useAsync'

const PRIORITY_COLORS = { urgent: '#ef4444', high: '#f97316', medium: '#eab308', low: '#6b7280' }
const TYPE_LABELS = {
  needs_product: 'Necesita producto',
  needs_agent: 'Necesita agente',
  client_issue: 'Problema cliente',
  step_blocked: 'Paso bloqueado',
  upsell_ready: 'Upsell listo',
}

export default function StoreAlerts() {
  const { getStoreAlerts, resolveStoreAlert } = useClientData()
  const [showResolved, setShowResolved] = useState(false)

  const getPending = () => getStoreAlerts(false)
  const getResolved = () => getStoreAlerts(true)

  const [pending, pendingLoading] = useAsync(getPending, [])
  const [resolved, resolvedLoading] = useAsync(getResolved, [])

  const alerts = showResolved ? resolved : pending
  const loading = showResolved ? resolvedLoading : pendingLoading

  async function handleResolve(alertId) {
    await resolveStoreAlert(alertId, 'admin', '')
    window.location.reload()
  }

  return (
    <div className="store-alerts-page">
      <div className="store-alerts-page__header">
        <h3 className="stores-section-title">
          {showResolved ? 'Alertas Resueltas' : 'Alertas Pendientes'} ({alerts.length})
        </h3>
        <button
          className="stores-filter-clear"
          onClick={() => setShowResolved(!showResolved)}
        >
          {showResolved ? 'Ver pendientes' : 'Ver resueltas'}
        </button>
      </div>

      {loading ? (
        <div className="stores-loading">Cargando alertas...</div>
      ) : alerts.length === 0 ? (
        <div className="stores-empty">{showResolved ? 'No hay alertas resueltas' : 'Sin alertas pendientes'}</div>
      ) : (
        <div className="store-alerts-grid">
          {alerts.map(alert => (
            <div key={alert.id} className="store-alert-card">
              <div className="store-alert-card__header">
                <span className="store-alert-card__priority" style={{ background: PRIORITY_COLORS[alert.priority] }}>
                  {alert.priority}
                </span>
                <span className="store-alert-card__type">{TYPE_LABELS[alert.alertType] || alert.alertType}</span>
              </div>
              <h4 className="store-alert-card__title">{alert.title}</h4>
              {alert.message && <p className="store-alert-card__message">{alert.message}</p>}
              {!showResolved && (
                <button className="store-alert-card__resolve" onClick={() => handleResolve(alert.id)}>
                  Marcar resuelta
                </button>
              )}
              {showResolved && alert.resolvedBy && (
                <p className="store-alert-card__resolved-info">
                  Resuelta por: {alert.resolvedBy}
                  {alert.resolutionNote && ` — ${alert.resolutionNote}`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
