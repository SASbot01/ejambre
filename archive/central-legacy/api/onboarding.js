import { supabase, resolveClientId } from './lib/supabase.js'

// Product → Service type mapping for BlackWolf
const PRODUCT_SERVICE_MAP = {
  'CyberGuard Pro': { serviceType: 'standard', steps: getCyberGuardSteps() },
  'SOC-as-a-Service': { serviceType: 'premium', steps: getSocSteps() },
  'Pentesting Premium': { serviceType: 'premium', steps: getPentestSteps() },
  // FBA Academy products use default store steps
}

function getCyberGuardSteps() {
  return [
    { stepNumber: 1, title: 'Bienvenida y acceso al portal', stepType: 'video', description: 'Video de bienvenida + credenciales de acceso' },
    { stepNumber: 2, title: 'Auditoría inicial de seguridad', stepType: 'blocked', requiresTeamAction: true, description: 'El equipo ciber realiza escaneo inicial de tu infraestructura' },
    { stepNumber: 3, title: 'Configurar agentes de monitoreo', stepType: 'blocked', requiresTeamAction: true, description: 'Instalación de sensores y agentes en tu red' },
    { stepNumber: 4, title: 'Revisión de resultados', stepType: 'video', description: 'Video explicando los hallazgos de la auditoría' },
    { stepNumber: 5, title: 'Plan de remediación', stepType: 'input', description: 'Priorización y plan de acción para las vulnerabilidades encontradas' },
    { stepNumber: 6, title: 'Implementación de mejoras', stepType: 'blocked', requiresTeamAction: true, description: 'El equipo implementa las mejoras de seguridad acordadas' },
    { stepNumber: 7, title: 'Verificación final y entrega', stepType: 'video', description: 'Confirmación de que todos los cambios están aplicados' },
    { stepNumber: 8, title: 'Monitoreo continuo activo', stepType: 'tracking', description: 'Dashboard de monitoreo en tiempo real activado' },
  ]
}

function getSocSteps() {
  return [
    { stepNumber: 1, title: 'Bienvenida y kickoff', stepType: 'video', description: 'Llamada de kickoff con el equipo SOC' },
    { stepNumber: 2, title: 'Inventario de activos', stepType: 'input', description: 'Listado de servidores, IPs, dominios y servicios a monitorear' },
    { stepNumber: 3, title: 'Configurar SIEM', stepType: 'blocked', requiresTeamAction: true, description: 'Configuración del SIEM y conexión de fuentes de logs' },
    { stepNumber: 4, title: 'Integrar alertas', stepType: 'blocked', requiresTeamAction: true, description: 'Configurar canales de notificación (email, Slack, WhatsApp)' },
    { stepNumber: 5, title: 'Playbooks de respuesta', stepType: 'video', description: 'Revisión de playbooks automáticos de respuesta a incidentes' },
    { stepNumber: 6, title: 'Simulacro de incidente', stepType: 'blocked', requiresTeamAction: true, description: 'Test de detección y respuesta con escenario controlado' },
    { stepNumber: 7, title: 'Go-live monitoreo 24/7', stepType: 'tracking', description: 'SOC operativo monitoreando tu infraestructura' },
  ]
}

function getPentestSteps() {
  return [
    { stepNumber: 1, title: 'Bienvenida y scope', stepType: 'video', description: 'Definición del alcance del pentesting' },
    { stepNumber: 2, title: 'Autorización y documentación', stepType: 'input', description: 'Firma de autorización de pruebas y alcance' },
    { stepNumber: 3, title: 'Reconocimiento', stepType: 'blocked', requiresTeamAction: true, description: 'Fase de reconocimiento e identificación de superficie de ataque' },
    { stepNumber: 4, title: 'Pruebas de penetración', stepType: 'blocked', requiresTeamAction: true, description: 'Ejecución de pruebas activas de seguridad' },
    { stepNumber: 5, title: 'Informe de resultados', stepType: 'blocked', requiresTeamAction: true, description: 'Elaboración del informe ejecutivo y técnico' },
    { stepNumber: 6, title: 'Presentación de hallazgos', stepType: 'video', description: 'Reunión de presentación de resultados' },
    { stepNumber: 7, title: 'Remediación y re-test', stepType: 'blocked', requiresTeamAction: true, description: 'Verificación de que las vulnerabilidades han sido corregidas' },
    { stepNumber: 8, title: 'Certificado de seguridad', stepType: 'input', description: 'Emisión del certificado de pentesting completado' },
  ]
}

function getDefaultSteps(serviceType) {
  return [
    { stepNumber: 1, title: 'Bienvenida y acceso', stepType: 'video', description: 'Acceso al portal de cliente' },
    { stepNumber: 2, title: 'Kick-off meeting', stepType: 'video', description: 'Reunión inicial con el equipo' },
    { stepNumber: 3, title: 'Configuración inicial', stepType: 'blocked', requiresTeamAction: true, description: 'Setup del servicio por el equipo técnico' },
    { stepNumber: 4, title: 'Verificación y entrega', stepType: 'input', description: 'Confirmación de que todo está operativo' },
    { stepNumber: 5, title: 'Seguimiento activo', stepType: 'tracking', description: 'Monitoreo y seguimiento continuo' },
  ]
}

// Auto-provision: creates store, client portal user, steps, and alert
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { contactId, clientSlug } = req.body
    if (!contactId || !clientSlug) return res.status(400).json({ error: 'contactId and clientSlug required' })

    const clientId = await resolveClientId(clientSlug)
    if (!clientId) return res.status(404).json({ error: 'Client not found' })

    // 1. Get the won contact
    const { data: contact, error: contactErr } = await supabase
      .from('crm_contacts')
      .select('*')
      .eq('id', contactId)
      .single()

    if (contactErr || !contact) return res.status(404).json({ error: 'Contact not found' })

    // 2. Find a gestor with lowest capacity
    const { data: gestores } = await supabase
      .from('team')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_gestor', true)
      .eq('active', true)
      .order('created_at')

    let gestorId = null, gestorName = null
    if (gestores && gestores.length > 0) {
      // Get store counts per gestor
      const { data: stores } = await supabase
        .from('stores')
        .select('gestor_id')
        .eq('client_id', clientId)
        .in('status', ['onboarding', 'active'])

      const counts = {}
      for (const s of (stores || [])) {
        counts[s.gestor_id] = (counts[s.gestor_id] || 0) + 1
      }

      // Pick gestor with fewest active stores
      gestores.sort((a, b) => (counts[a.id] || 0) - (counts[b.id] || 0))
      gestorId = gestores[0].id
      gestorName = gestores[0].name
    }

    // 3. Determine service type and steps from product
    const product = contact.product || contact.producto_interes || ''
    const mapping = PRODUCT_SERVICE_MAP[product] || { serviceType: 'standard', steps: null }

    // 4. Generate temp password for client portal
    const tempPassword = `BW-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

    // 5. Create store client (portal user)
    const { data: storeClient, error: scErr } = await supabase
      .from('store_clients')
      .insert({
        client_id: clientId,
        email: contact.email,
        password_hash: tempPassword, // In production, hash this
        name: contact.name,
        phone: contact.phone,
      })
      .select()
      .single()

    if (scErr) console.error('Store client creation error:', scErr)

    // 6. Create store
    const { data: store, error: storeErr } = await supabase
      .from('stores')
      .insert({
        client_id: clientId,
        owner_name: contact.name,
        owner_email: contact.email,
        owner_phone: contact.phone || contact.whatsapp,
        owner_instagram: contact.instagram,
        brand_name: contact.company || contact.name,
        status: 'onboarding',
        gestor_id: gestorId,
        gestor_name: gestorName,
        service_type: mapping.serviceType,
        start_date: new Date().toISOString().split('T')[0],
        notes: `Auto-provisioned from CRM contact ${contactId}. Product: ${product}`,
        capital_disponible: contact.deal_value || null,
      })
      .select()
      .single()

    if (storeErr) return res.status(500).json({ error: 'Failed to create store', details: storeErr })

    // 7. Create onboarding steps
    const steps = mapping.steps || getDefaultSteps(mapping.serviceType)
    if (steps && steps.length > 0) {
      const stepRows = steps.map(s => ({
        store_id: store.id,
        step_number: s.stepNumber,
        title: s.title,
        description: s.description || '',
        step_type: s.stepType || 'video',
        requires_team_action: s.requiresTeamAction || false,
        video_url: s.videoUrl || null,
      }))

      await supabase.from('store_steps').insert(stepRows)
    }

    // 8. Update store total_steps
    await supabase.from('stores').update({ total_steps: steps.length }).eq('id', store.id)

    // 9. Link store to store_client
    if (storeClient) {
      await supabase.from('store_clients').update({ store_id: store.id }).eq('id', storeClient.id)
    }

    // 10. Create welcome alert for gestor
    await supabase.from('store_alerts').insert({
      store_id: store.id,
      client_id: clientId,
      alert_type: 'new_client',
      title: `Nuevo cliente: ${contact.name}`,
      message: `Cliente ganado desde CRM. Producto: ${product}. Gestor asignado: ${gestorName || 'Sin asignar'}. Password temporal: ${tempPassword}`,
      priority: 'high',
    })

    // 11. Update CRM contact with store reference
    await supabase.from('crm_contacts').update({
      notes: `${contact.notes || ''}\n\n[AUTO] Store creada: ${store.id} | Portal: ${tempPassword}`.trim()
    }).eq('id', contactId)

    return res.status(200).json({
      ok: true,
      store_id: store.id,
      portal_password: tempPassword,
      gestor: gestorName,
      steps_count: steps.length,
      service_type: mapping.serviceType,
    })
  } catch (err) {
    console.error('Auto-provision error:', err)
    return res.status(500).json({ error: err.message })
  }
}
