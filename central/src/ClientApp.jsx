import { useState, useEffect, useMemo } from 'react'
import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
import { ClientContext } from './contexts/ClientContext'
import { getClientBySlug, getTeam, authenticateUser, authenticateStoreClient, getStoreTickets } from './utils/data'
import { getPrimaryRole, hasRole, isGestorManager as checkIsGestorManager } from './utils/roles'
import ClientLogin from './pages/ClientLogin'
import Layout from './components/Layout'
import AgentChat from './components/AgentChat'
import SalesDashboard from './pages/SalesDashboard'
import ReportsDashboard from './pages/ReportsDashboard'
import SalesTable from './pages/SalesTable'
import ReportsTable from './pages/ReportsTable'
import NewSale from './pages/NewSale'
import NewReport from './pages/NewReport'
// Marketing, Content, ChatBot removed — not in current scope
import TeamPage from './pages/TeamPage'
import ProjectionsPage from './pages/ProjectionsPage'
import CommissionsPage from './pages/CommissionsPage'
import PaymentMethodsPage from './pages/PaymentMethodsPage'
import ProductsPage from './pages/ProductsPage'
import SettingsPage from './pages/SettingsPage'
import IntegrationsPage from './pages/IntegrationsPage'
import CrmPage from './pages/CrmPage'
import CeoOverview from './pages/ceo-mind/CeoOverview'
import CeoEquipo from './pages/ceo-mind/CeoEquipo'
import CeoMeetings from './pages/ceo-mind/CeoMeetings'
import CeoProyectos from './pages/ceo-mind/CeoProyectos'
import CeoIdeas from './pages/ceo-mind/CeoIdeas'
import CeoPulsoSemanal from './pages/ceo-mind/CeoPulsoSemanal'
import CeoRoadmap from './pages/ceo-mind/CeoRoadmap'
import CeoFinanzas from './pages/ceo-mind/CeoFinanzas'
import InstallmentPaymentsPage from './pages/InstallmentPaymentsPage'
import TaskManagementPage from './pages/TaskManagementPage'
import PlanningPage from './pages/PlanningPage'
import EmailMarketingPage from './pages/EmailMarketingPage'
// ChatBotPage removed
import HomePage from './pages/HomePage'
import MiniLayout from './components/MiniLayout'
import StoresHome from './pages/stores/StoresHome'
import StoresList from './pages/stores/StoresList'
import StoreDetail from './pages/stores/StoreDetail'
import StoresGestores from './pages/stores/StoresGestores'
import StoreAlerts from './pages/stores/StoreAlerts'
import StoresSettings from './pages/stores/StoresSettings'
import StoreTickets from './pages/stores/StoreTickets'
import TicketDetail from './pages/stores/TicketDetail'
import GestorDashboard from './pages/stores/GestorDashboard'
import ClientPortal from './pages/stores/ClientPortal'
import FormacionHome from './pages/formacion/FormacionHome'
import CursoDetail from './pages/formacion/CursoDetail'
import ComunidadHome from './pages/formacion/ComunidadHome'

export default function ClientApp() {
  const { clientSlug } = useParams()
  const [clientConfig, setClientConfig] = useState(null)
  const [clientLoading, setClientLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [user, setUser] = useState(() => {
    // Check if superadmin is logged in
    const sa = localStorage.getItem('bw_superadmin')
    if (sa) return sa
    return localStorage.getItem(`bw_client_${clientSlug}_user`) || null
  })
  const [userRole, setUserRole] = useState(null)
  const [userMember, setUserMember] = useState(null)
  const [userType, setUserType] = useState(() => {
    return localStorage.getItem(`bw_client_${clientSlug}_usertype`) || 'team'
  })
  const [storeClient, setStoreClient] = useState(null)
  const [appLoading, setAppLoading] = useState(true)

  const isSuperAdmin = !!localStorage.getItem('bw_superadmin')
  const location = useLocation()

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  // Load client config
  useEffect(() => {
    setClientLoading(true)
    getClientBySlug(clientSlug).then(config => {
      if (!config) {
        setNotFound(true)
      } else {
        setClientConfig(config)
      }
      setClientLoading(false)
    })
  }, [clientSlug])

  // Load user role once we have client config + user
  useEffect(() => {
    if (!user || !clientConfig) {
      setUserRole(null)
      setUserMember(null)
      setStoreClient(null)
      setAppLoading(false)
      return
    }

    if (isSuperAdmin) {
      setUserRole('ceo,director')
      setUserMember({ name: 'Super Admin', email: user, role: 'ceo,director', isGestor: false, active: true })
      setUserType('team')
      setStoreClient(null)
      setAppLoading(false)
      return
    }

    if (userType === 'store_client') {
      // Store client — no team role needed
      setUserRole(null)
      setUserMember(null)
      // storeClient is set during login
      setAppLoading(false)
      return
    }

    getTeam(clientConfig.id).then(team => {
      const member = team.find(m => m.email === user)
      setUserRole(member?.role || 'closer')
      setUserMember(member || null)
      setAppLoading(false)
    })
  }, [user, clientConfig, userType])

  function handleLogin(email, type = 'team', storeClientData = null) {
    localStorage.setItem(`bw_client_${clientSlug}_user`, email)
    localStorage.setItem(`bw_client_${clientSlug}_usertype`, type)
    setUserType(type)
    if (type === 'store_client' && storeClientData) {
      setStoreClient(storeClientData)
    }
    setUser(email)
  }

  function handleLogout() {
    if (isSuperAdmin) {
      window.location.href = '/admin'
      return
    }
    localStorage.removeItem(`bw_client_${clientSlug}_user`)
    localStorage.removeItem(`bw_client_${clientSlug}_usertype`)
    setUser(null)
    setUserType('team')
    setStoreClient(null)
    setUserMember(null)
  }

  const clientAuth = useMemo(() => {
    if (!clientConfig) return () => null
    return (email, password) => authenticateUser(email, password, clientConfig.id)
  }, [clientConfig])

  const storeClientAuth = useMemo(() => {
    if (!clientConfig) return () => null
    return (email, password) => authenticateStoreClient(email, password, clientConfig.id)
  }, [clientConfig])

  // Build CSS custom properties from client config
  const cssVars = useMemo(() => {
    if (!clientConfig) return {}
    return {
      '--orange': clientConfig.primaryColor,
      '--yellow': clientConfig.secondaryColor,
      '--bg': clientConfig.bgColor,
      '--bg-card': clientConfig.bgCardColor,
      '--bg-card-hover': clientConfig.bgCardColor,
      '--bg-sidebar': clientConfig.bgSidebarColor,
      '--border': clientConfig.borderColor,
      '--border-focus': clientConfig.primaryColor,
      '--text': clientConfig.textColor,
      '--text-secondary': clientConfig.textSecondaryColor,
      '--gradient': `linear-gradient(135deg, ${clientConfig.primaryColor}, ${clientConfig.secondaryColor})`,
      '--glow': `${clientConfig.primaryColor}40`,
    }
  }, [clientConfig, clientSlug])

  // Lightweight ticket badge count
  const [openTicketCount, setOpenTicketCount] = useState(0)
  useEffect(() => {
    if (!clientConfig?.id || userType === 'store_client') return
    getStoreTickets(clientConfig.id).then(tickets => {
      setOpenTicketCount(tickets.filter(t => t.status !== 'resolved' && t.status !== 'closed').length)
    }).catch(() => {})
  }, [clientConfig?.id, userType])

  const ctxValue = useMemo(() => ({
    clientSlug,
    clientId: clientConfig?.id || null,
    clientConfig,
    userMember,
    userType,
    storeClient,
  }), [clientSlug, clientConfig, userMember, userType, storeClient])

  if (clientLoading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#999' }}>Cargando...</div>
  }

  if (notFound) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#999', flexDirection: 'column', gap: '16px' }}>
        <h1 style={{ fontSize: '2rem', color: '#fff' }}>404</h1>
        <p>Cliente no encontrado</p>
      </div>
    )
  }

  if (appLoading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#999' }}>Cargando...</div>
  }

  if (!user) {
    return (
      <ClientContext.Provider value={ctxValue}>
        <div style={cssVars}>
          <ClientLogin clientConfig={clientConfig} onLogin={handleLogin} authenticateUser={clientAuth} authenticateStoreClient={storeClientAuth} />
        </div>
      </ClientContext.Provider>
    )
  }

  // Store client portal — redirect everything to /tiendas
  const isStoreClientUser = userType === 'store_client'

  const primaryRole = getPrimaryRole(userRole)
  const isCeo = hasRole(userRole, 'ceo')
  const isDirector = primaryRole === 'director'
  const isDirectorOrCeo = isDirector || isCeo

  // Gestor-only: has isGestor flag but is NOT manager/director/ceo
  const isGestorOnly = userMember && userMember.isGestor && !checkIsGestorManager(userMember) && !isCeo

  const cleanPath = location.pathname.replace(/\/+$/, '')
  const isHome = cleanPath === `/${clientSlug}`
  const p = `/${clientSlug}`

  // Which section are we in?
  const managementPaths = ['equipo', 'proyecciones', 'comisiones', 'productos', 'metodos-pago', 'settings', 'integraciones']
  const taskPaths = ['task-management', 'planning']
  const storesPaths = ['tiendas']
  const ceoPaths = ['ceo']
  const formacionPaths = ['formacion', 'comunidad']

  const subPath = cleanPath.replace(p, '').replace(/^\//, '')
  const isManagement = managementPaths.some(mp => subPath === mp || subPath.startsWith(mp + '/'))
  const isTask = taskPaths.some(tp => subPath === tp || subPath.startsWith(tp + '/'))
  const isStores = storesPaths.some(sp => subPath === sp || subPath.startsWith(sp + '/'))
  const isCeoSection = ceoPaths.some(cp => subPath === cp || subPath.startsWith(cp + '/'))
  const isFormacion = formacionPaths.some(fp => subPath === fp || subPath.startsWith(fp + '/'))

  const managementTabs = [
    { to: `${p}/equipo`, label: 'Equipo' },
    { to: `${p}/proyecciones`, label: 'Proyecciones' },
    { to: `${p}/comisiones`, label: 'Comisiones' },
    { to: `${p}/productos`, label: 'Productos' },
    { to: `${p}/metodos-pago`, label: 'Pagos' },
    { to: `${p}/settings`, label: 'Settings' },
    { to: `${p}/integraciones`, label: 'Integraciones' },
  ]

  const taskTabs = [
    { to: `${p}/task-management`, label: 'Task Board', end: true },
    { to: `${p}/planning`, label: 'Planning' },
  ]

  const storesTabs = isStoreClientUser ? [
    { to: `${p}/tiendas`, label: 'Mi Tienda', end: true },
    { to: `${p}/tiendas/tickets`, label: 'Tickets', badge: openTicketCount },
  ] : isGestorOnly ? [
    { to: `${p}/tiendas`, label: 'Mi Dashboard', end: true },
    { to: `${p}/tiendas/lista`, label: 'Mis Tiendas' },
    { to: `${p}/tiendas/tickets`, label: 'Tickets', badge: openTicketCount },
  ] : [
    { to: `${p}/tiendas`, label: 'Home', end: true },
    { to: `${p}/tiendas/lista`, label: 'Tiendas' },
    { to: `${p}/tiendas/gestores`, label: 'Gestores' },
    { to: `${p}/tiendas/tickets`, label: 'Tickets', badge: openTicketCount },
    { to: `${p}/tiendas/settings`, label: 'Settings' },
  ]

  const ceoTabs = [
    { to: `${p}/ceo`, label: 'Overview', end: true },
    { to: `${p}/ceo/equipo`, label: 'Equipo' },
    { to: `${p}/ceo/meetings`, label: 'Meetings' },
    { to: `${p}/ceo/proyectos`, label: 'Proyectos' },
    { to: `${p}/ceo/ideas`, label: 'Ideas' },
    { to: `${p}/ceo/pulso`, label: 'Pulso Semanal' },
    { to: `${p}/ceo/roadmap`, label: 'Roadmap' },
    { to: `${p}/ceo/finanzas`, label: 'Finanzas' },
  ]

  const formacionTabs = [
    { to: `${p}/formacion`, label: 'Formación', end: true },
    { to: `${p}/comunidad`, label: 'Comunidad' },
  ]

  // Store clients can only access /tiendas (never applies to superadmin)
  if (isStoreClientUser && !isStores && !isSuperAdmin) {
    return (
      <ClientContext.Provider value={ctxValue}>
        <div style={cssVars}>
          <Navigate to={`${p}/tiendas`} replace />
        </div>
      </ClientContext.Provider>
    )
  }

  // Gestor-only users: redirect home to /tiendas (never applies to superadmin)
  if (isGestorOnly && isHome && !isSuperAdmin) {
    return (
      <ClientContext.Provider value={ctxValue}>
        <div style={cssVars}>
          <Navigate to={`${p}/tiendas`} replace />
        </div>
      </ClientContext.Provider>
    )
  }

  return (
    <ClientContext.Provider value={ctxValue}>
      <div style={cssVars}>
        <AgentChat>
        {isHome ? (
          <HomePage role={userRole} user={user} />

        ) : isManagement ? (
          <MiniLayout title="Management" tabs={managementTabs}>
            <Routes>
              <Route path="equipo" element={isDirectorOrCeo ? <TeamPage /> : <Navigate to={`${p}/`} replace />} />
              <Route path="proyecciones" element={<ProjectionsPage user={user} role={userRole} />} />
              <Route path="comisiones" element={<CommissionsPage user={user} role={userRole} />} />
              <Route path="metodos-pago" element={isDirectorOrCeo ? <PaymentMethodsPage /> : <Navigate to={`${p}/`} replace />} />
              <Route path="productos" element={isDirectorOrCeo ? <ProductsPage /> : <Navigate to={`${p}/`} replace />} />
              <Route path="settings" element={<SettingsPage user={user} />} />
              <Route path="integraciones" element={<IntegrationsPage />} />
              <Route path="*" element={<Navigate to={`${p}/equipo`} replace />} />
            </Routes>
          </MiniLayout>

        ) : isTask ? (
          <MiniLayout title="Tareas" tabs={taskTabs}>
            <Routes>
              <Route path="task-management" element={<TaskManagementPage />} />
              <Route path="planning" element={<PlanningPage />} />
              <Route path="*" element={<Navigate to={`${p}/task-management`} replace />} />
            </Routes>
          </MiniLayout>

        ) : isStores ? (
          <MiniLayout title={isStoreClientUser ? (clientSlug === 'black-wolf' ? 'My Store' : 'Mi Tienda') : isGestorOnly ? (clientSlug === 'black-wolf' ? 'My Stores' : 'Mis Tiendas') : (clientSlug === 'black-wolf' ? 'Client Management' : 'Gestión de Clientes')} tabs={storesTabs} onLogout={isStoreClientUser || isGestorOnly ? handleLogout : undefined}>
            <Routes>
              {isStoreClientUser ? (
                <>
                  <Route path="tiendas" element={<ClientPortal />} />
                  <Route path="tiendas/tickets" element={<StoreTickets />} />
                  <Route path="tiendas/tickets/:ticketId" element={<TicketDetail />} />
                  <Route path="*" element={<Navigate to={`${p}/tiendas`} replace />} />
                </>
              ) : isGestorOnly ? (
                <>
                  <Route path="tiendas" element={<GestorDashboard gestorId={userMember?.id} />} />
                  <Route path="tiendas/lista" element={<StoresList gestorId={userMember?.id} />} />
                  <Route path="tiendas/lista/:storeId" element={<StoreDetail />} />
                  <Route path="tiendas/tickets" element={<StoreTickets gestorId={userMember?.id} />} />
                  <Route path="tiendas/tickets/:ticketId" element={<TicketDetail />} />
                  <Route path="*" element={<Navigate to={`${p}/tiendas`} replace />} />
                </>
              ) : (
                <>
                  {/* Full manager/director/CEO view */}
                  <Route path="tiendas" element={<StoresHome />} />
                  <Route path="tiendas/lista" element={<StoresList />} />
                  <Route path="tiendas/lista/:storeId" element={<StoreDetail />} />
                  <Route path="tiendas/gestores" element={<StoresGestores />} />
                  <Route path="tiendas/tickets" element={<StoreTickets />} />
                  <Route path="tiendas/tickets/:ticketId" element={<TicketDetail />} />
                  <Route path="tiendas/settings" element={<StoresSettings />} />
                  <Route path="*" element={<Navigate to={`${p}/tiendas`} replace />} />
                </>
              )}
            </Routes>
          </MiniLayout>

        ) : isFormacion ? (
          <MiniLayout title="Formación y Comunidad" tabs={formacionTabs}>
            <Routes>
              <Route path="formacion" element={<FormacionHome />} />
              <Route path="formacion/:cursoId" element={<CursoDetail />} />
              <Route path="comunidad" element={<ComunidadHome />} />
              <Route path="*" element={<Navigate to={`${p}/formacion`} replace />} />
            </Routes>
          </MiniLayout>

        ) : isCeoSection && isCeo ? (
          <MiniLayout title="CEO Mind" tabs={ceoTabs}>
            <Routes>
              <Route path="ceo" element={<CeoOverview />} />
              <Route path="ceo/equipo" element={<CeoEquipo />} />
              <Route path="ceo/meetings" element={<CeoMeetings />} />
              <Route path="ceo/proyectos" element={<CeoProyectos />} />
              <Route path="ceo/ideas" element={<CeoIdeas />} />
              <Route path="ceo/pulso" element={<CeoPulsoSemanal />} />
              <Route path="ceo/roadmap" element={<CeoRoadmap />} />
              <Route path="ceo/finanzas" element={<CeoFinanzas />} />
              <Route path="*" element={<Navigate to={`${p}/ceo`} replace />} />
            </Routes>
          </MiniLayout>

        ) : (
          <Layout user={user} onLogout={handleLogout} role={userRole} clientConfig={clientConfig} clientSlug={clientSlug} isSuperAdmin={isSuperAdmin}>
            <Routes>
              {/* Gestión Comercial */}
              <Route path="ventas" element={<SalesDashboard />} />
              <Route path="reportes" element={<ReportsDashboard />} />
              <Route path="ventas/tabla" element={<SalesTable />} />
              <Route path="reportes/tabla" element={<ReportsTable />} />
              <Route path="ventas/nueva" element={<NewSale />} />
              <Route path="reportes/nuevo" element={<NewReport />} />
              <Route path="crm" element={<CrmPage />} />
              <Route path="pagos-plazos" element={<InstallmentPaymentsPage user={user} />} />
              <Route path="email-marketing" element={isDirectorOrCeo ? <EmailMarketingPage /> : <Navigate to={`${p}/ventas`} replace />} />
              <Route path="*" element={<Navigate to={`${p}/`} replace />} />
            </Routes>
          </Layout>
        )}
        </AgentChat>
      </div>
    </ClientContext.Provider>
  )
}
