import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ClientApp from './ClientApp.jsx'
import SuperAdminLogin from './pages/admin/SuperAdminLogin.jsx'
import AdminApp from './pages/admin/AdminApp.jsx'
import ErpApp from './pages/erp/ErpApp.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SuperAdminLogin />} />
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="/erp/:companySlug/*" element={<ErpApp />} />
        <Route path="/:clientSlug/*" element={<ClientApp />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
