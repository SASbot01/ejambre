import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import AdminLayout from '../../components/AdminLayout'
import HomePrincipal from './HomePrincipal'
import AdminDashboard from './AdminDashboard'
import AdminConsole from './AdminConsole'
import AIAgentsPage from './AIAgentsPage'
import SocPage from './SocPage'
import ErpAdmin from './ErpAdmin'

export default function AdminApp() {
  const [user, setUser] = useState(() => localStorage.getItem('bw_superadmin') || null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!user) navigate('/')
  }, [user, navigate])

  function handleLogout() {
    localStorage.removeItem('bw_superadmin')
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('bw_client_')) localStorage.removeItem(key)
    })
    setUser(null)
  }

  if (!user) return null

  // Home Principal renders WITHOUT AdminLayout (full-screen iPad experience)
  const isHome = location.pathname === '/admin' || location.pathname === '/admin/'

  if (isHome) {
    return <HomePrincipal />
  }

  return (
    <AdminLayout user={user} onLogout={handleLogout}>
      <Routes>
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="consola" element={<AdminConsole />} />
        <Route path="erp" element={<ErpAdmin />} />
        <Route path="ai-agents" element={<AIAgentsPage />} />
        <Route path="soc" element={<SocPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminLayout>
  )
}
