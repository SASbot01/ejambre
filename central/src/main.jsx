import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ClientApp from './ClientApp.jsx'
import SuperAdminLogin from './pages/admin/SuperAdminLogin.jsx'
import AdminApp from './pages/admin/AdminApp.jsx'
import ErpApp from './pages/erp/ErpApp.jsx'
import GuiaLanding from './pages/asesoriasuiza/GuiaLanding.jsx'
import GuiaForm from './pages/asesoriasuiza/GuiaForm.jsx'
import GuiaThx from './pages/asesoriasuiza/GuiaThx.jsx'
import AsesoriaSuizaVsl from './pages/asesoriasuiza/Vsl.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SuperAdminLogin />} />
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="/erp/:companySlug/*" element={<ErpApp />} />
        {/* Asesoría Suiza — Growth Passport */}
        <Route path="/asesoriasuizaguia" element={<GuiaLanding />} />
        <Route path="/asesoriasuizaguia/form" element={<GuiaForm />} />
        <Route path="/asesoriasuizaguia/thx" element={<GuiaThx />} />
        <Route path="/asesoriasuiza" element={<AsesoriaSuizaVsl />} />
        <Route path="/:clientSlug/*" element={<ClientApp />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
