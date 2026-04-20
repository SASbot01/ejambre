import { useState } from 'react'

export default function ClientLogin({ clientConfig, onLogin, authenticateUser, authenticateStoreClient }) {
  const [loginTab, setLoginTab] = useState('team')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Completa todos los campos')
      return
    }
    setLoading(true)
    try {
      if (loginTab === 'store_client') {
        const sc = await authenticateStoreClient(email, password)
        if (sc) {
          onLogin(sc.email, 'store_client', sc)
        } else {
          setError('Credenciales incorrectas')
          setLoading(false)
        }
      } else {
        const user = await authenticateUser(email, password)
        if (user) {
          onLogin(user.email, 'team')
        } else {
          setError('Credenciales incorrectas')
          setLoading(false)
        }
      }
    } catch {
      setError('Error al iniciar sesión')
      setLoading(false)
    }
  }

  function switchTab(tab) {
    setLoginTab(tab)
    setError('')
    setEmail('')
    setPassword('')
  }

  return (
    <div className="login-page">
      <div className="login-glow" />
      <div className="login-card">
        {clientConfig?.logoUrl && (
          <img src={clientConfig.logoUrl} alt={clientConfig.name} className="login-logo" />
        )}
        <h1 className="login-title">{clientConfig?.name || 'Dashboard'}</h1>
        <p className="login-subtitle">Accede al panel de control</p>

        <div className="login-tabs">
          <button
            type="button"
            className={`login-tab${loginTab === 'team' ? ' login-tab--active' : ''}`}
            onClick={() => switchTab('team')}
          >
            Equipo
          </button>
          <button
            type="button"
            className={`login-tab${loginTab === 'store_client' ? ' login-tab--active' : ''}`}
            onClick={() => switchTab('store_client')}
          >
            Mi Tienda
          </button>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              autoComplete="email"
            />
          </div>
          <div className="input-group">
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
