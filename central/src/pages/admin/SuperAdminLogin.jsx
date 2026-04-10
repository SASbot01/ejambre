import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authenticateSuperAdmin } from '../../utils/data'

export default function SuperAdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (localStorage.getItem('bw_superadmin')) {
      navigate('/admin')
    }
  }, [navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Completa todos los campos')
      return
    }
    setLoading(true)
    const user = await authenticateSuperAdmin(email, password)
    if (user) {
      localStorage.setItem('bw_superadmin', user.email)
      navigate('/admin')
    } else {
      setError('Credenciales incorrectas')
      setLoading(false)
    }
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-glow" />
      <div className="admin-login-card">
        <img src="/assets/logos/blackwolf.png" alt="BlackWolf" className="admin-login-logo" />
        <h1 className="admin-login-title">BLACKWOLF</h1>
        <p className="admin-login-subtitle">Panel de Administración</p>
        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="admin-input-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@blackwolfsec.io"
              autoComplete="email"
            />
          </div>
          <div className="admin-input-group">
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          {error && <div className="admin-login-error">{error}</div>}
          <button type="submit" className="admin-login-btn" disabled={loading}>
            {loading ? 'Entrando...' : 'Acceder'}
          </button>
        </form>
      </div>
    </div>
  )
}
