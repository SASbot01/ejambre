// Conector: Detrás de Cámara Landing → Enjambre CRM
// Vigila la tabla pre_detrasdecamara en Supabase y sincroniza nuevos leads

const DCC_SUPABASE_URL = process.env.DCC_SUPABASE_URL || 'https://ohpwhpgefmnxsgtgtxeq.supabase.co';
const DCC_SUPABASE_KEY = process.env.DCC_SUPABASE_KEY;
const POLL_INTERVAL = 30_000; // 30 segundos

let lastSeenId = 0;
let pollTimer = null;

async function fetchNewLeads() {
  const res = await fetch(
    `${DCC_SUPABASE_URL}/rest/v1/pre_detrasdecamara?select=*&id=gt.${lastSeenId}&order=id.asc`,
    {
      headers: {
        apikey: DCC_SUPABASE_KEY,
        Authorization: `Bearer ${DCC_SUPABASE_KEY}`,
      },
    }
  );

  if (!res.ok) {
    console.error(`[DCC] Error fetching leads: ${res.status}`);
    return [];
  }

  return res.json();
}

async function syncLeadToCRM(lead, { eventBus, db }) {
  const { queryOne } = db;

  // Verificar si ya existe en nuestro sistema (por email)
  const existing = await queryOne(
    'SELECT id FROM leads WHERE email = $1 AND landing_source = $2',
    [lead.email, 'detrasdecamara']
  );

  if (existing) return null;

  // Insertar en nuestra tabla de leads local
  const newLead = await queryOne(
    `INSERT INTO leads (nombre, email, telefono, producto, landing_source, status, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      lead.nombre,
      lead.email,
      lead.telefono,
      'Detrás de Cámara',
      'detrasdecamara',
      'nuevo',
      JSON.stringify({
        source_id: lead.id,
        punto_actual: lead.punto_actual,
        genera_ingresos: lead.genera_ingresos,
        objetivo_filmmaking: lead.objetivo_filmmaking,
        bloqueo: lead.bloqueo,
        original_created_at: lead.created_at,
      }),
    ]
  );

  // Sincronizar al CRM principal (Supabase Dashboard-Ops)
  const crmSupabaseUrl = process.env.SUPABASE_URL;
  const crmSupabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (crmSupabaseUrl && crmSupabaseKey) {
    try {
      await fetch(`${crmSupabaseUrl}/rest/v1/crm_contacts`, {
        method: 'POST',
        headers: {
          apikey: crmSupabaseKey,
          Authorization: `Bearer ${crmSupabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=ignore-duplicates',
        },
        body: JSON.stringify({
          client_id: '02c92489-e226-410b-bb6c-66a2ec3d41c0',
          name: lead.nombre,
          email: lead.email,
          phone: lead.telefono,
          status: 'lead',
          source: 'Landing Pre-DCC',
          notes: `Punto actual: ${lead.punto_actual}\nGenera ingresos: ${lead.genera_ingresos}\nObjetivo: ${lead.objetivo_filmmaking}\nBloqueo: ${lead.bloqueo}`,
        }),
      });
    } catch (err) {
      console.error(`[DCC] Error syncing to CRM:`, err.message);
    }
  }

  // Publicar evento en el Enjambre
  await eventBus.publish('lead.created', 'forms', {
    lead_id: newLead.id,
    email: lead.email,
    nombre: lead.nombre,
    telefono: lead.telefono,
    producto: 'Detrás de Cámara',
    landing_source: 'detrasdecamara',
    punto_actual: lead.punto_actual,
    genera_ingresos: lead.genera_ingresos,
    objetivo_filmmaking: lead.objetivo_filmmaking,
    bloqueo: lead.bloqueo,
  });

  return newLead;
}

export async function startDCCConnector({ eventBus, db }) {
  if (!DCC_SUPABASE_KEY) {
    console.log('[DCC] Conector deshabilitado: DCC_SUPABASE_KEY no configurada');
    return;
  }

  // Obtener el último ID sincronizado
  const { queryOne } = db;
  const last = await queryOne(
    "SELECT metadata->>'source_id' as source_id FROM leads WHERE landing_source = 'detrasdecamara' ORDER BY created_at DESC LIMIT 1"
  );
  if (last?.source_id) {
    lastSeenId = parseInt(last.source_id, 10);
  }

  console.log(`[DCC] Conector Detrás de Cámara iniciado. Último ID: ${lastSeenId}`);

  const poll = async () => {
    try {
      const leads = await fetchNewLeads();
      for (const lead of leads) {
        const synced = await syncLeadToCRM(lead, { eventBus, db });
        if (synced) {
          console.log(`[DCC] Lead sincronizado: ${lead.nombre} (${lead.email})`);
        }
        lastSeenId = Math.max(lastSeenId, lead.id);
      }
    } catch (err) {
      console.error(`[DCC] Error en poll:`, err.message);
    }
  };

  // Primera ejecución inmediata
  await poll();

  // Poll periódico
  pollTimer = setInterval(poll, POLL_INTERVAL);
  console.log(`[DCC] Polling cada ${POLL_INTERVAL / 1000}s`);
}

export function stopDCCConnector() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log('[DCC] Conector detenido');
  }
}
