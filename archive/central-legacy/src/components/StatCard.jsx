export default function StatCard({ label, value, sub, trend, icon }) {
  const isPositive = trend && trend > 0
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span className="stat-card-icon">{icon}</span>
        {trend !== undefined && (
          <span className={`stat-trend ${isPositive ? 'stat-trend--up' : 'stat-trend--down'}`}>
            {isPositive ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{label}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  )
}
