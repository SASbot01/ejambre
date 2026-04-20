// Conector: Detrás de Cámara Landing → Enjambre CRM
// Vigila la tabla pre_detrasdecamara en Supabase (proyecto DCC) y sincroniza
// cada nuevo lead al CRM principal (Dashboard-Ops-) asignándolo al pipeline
// "Lanzamiento" en el stage "Leads" con todos los campos del form.

const DCC_SUPABASE_URL = process.env.DCC_SUPABASE_URL || 'https://ohpwhpgefmnxsgtgtxeq.supabase.co';
const DCC_SUPABASE_KEY = process.env.DCC_SUPABASE_KEY;
const POLL_INTERVAL = 30_000;

// Target en el CRM principal. El slug se resuelve dinámicamente a client_id al arrancar.
const DCC_CLIENT_SLUG = process.env.DCC_CLIENT_SLUG || 'detras-de-camara';
const DCC_PIPELINE_NAME = process.env.DCC_PIPELINE_NAME || 'Lanzamiento';
const DCC_STAGE_KEY = process.env.DCC_STAGE_KEY || 'leads';
const DCC_LANDING_URL = process.env.DCC_LANDING_URL || 'https://detrasdecamara.org/';

let lastSeenId = 0;
let pollTimer = null;

// Cache resuelto al arrancar (evita lookup en cada lead)
let targetCache = null; // { clientId, pipelineId, stageKey }

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

// Resuelve client_id + pipeline_id del CRM principal. Idempotente, cachea.
async function resolveTarget() {
  if (targetCache) return targetCache;

  const crmUrl = process.env.SUPABASE_URL;
  const crmKey = process.env.SUPABASE_SERVICE_KEY;
  if (!crmUrl || !crmKey) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY no configuradas — no puedo sincronizar al CRM');
  }

  const hdr = { apikey: crmKey, Authorization: `Bearer ${crmKey}` };

  // 1) client_id por slug
  const cRes = await fetch(`${crmUrl}/rest/v1/clients?slug=eq.${encodeURIComponent(DCC_CLIENT_SLUG)}&select=id&limit=1`, { headers: hdr });
  if (!cRes.ok) throw new Error(`clients lookup: ${cRes.status}`);
  const cs = await cRes.json();
  if (!cs.length) throw new Error(`Cliente '${DCC_CLIENT_SLUG}' no existe en CRM principal`);
  const clientId = cs[0].id;

  // 2) pipeline_id por nombre
  const pRes = await fetch(
    `${crmUrl}/rest/v1/crm_pipelines?client_id=eq.${clientId}&name=eq.${encodeURIComponent(DCC_PIPELINE_NAME)}&select=id,stages&limit=1`,
    { headers: hdr }
  );
  if (!pRes.ok) throw new Error(`pipelines lookup: ${pRes.status}`);
  const ps = await pRes.json();
  if (!ps.length) {
    // El pipeline debería existir tras aplicar migration 020. Avisamos pero dejamos pipeline_id=null
    // para que el contacto igual se cree (degradación suave).
    console.warn(`[DCC] Pipeline '${DCC_PIPELINE_NAME}' no encontrado para ${DCC_CLIENT_SLUG} — aplicar migration 020_dcc_lanzamiento_pipeline.sql`);
    targetCache = { clientId, pipelineId: null, stageKey: DCC_STAGE_KEY };
    return targetCache;
  }

  targetCache = { clientId, pipelineId: ps[0].id, stageKey: DCC_STAGE_KEY };
  console.log(`[DCC] Target resuelto: client=${DCC_CLIENT_SLUG} (${clientId}) pipeline=${DCC_PIPELINE_NAME} (${ps[0].id}) stage=${DCC_STAGE_KEY}`);
  return targetCache;
}

async function syncLeadToCRM(lead, { eventBus, db }) {
  const { queryOne } = db;

  // Idempotencia: evitar duplicados por email
  const existing = await queryOne(
    'SELECT id FROM leads WHERE email = $1 AND landing_source = $2',
    [lead.email, 'detrasdecamara']
  );
  if (existing) return null;

  // Tabla local leads (enjambre-api) — historial bruto
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

  // Sincronizar al CRM principal (Dashboard-Ops / Supabase central) con pipeline + stage + custom_fields
  const crmUrl = process.env.SUPABASE_URL;
  const crmKey = process.env.SUPABASE_SERVICE_KEY;
  if (crmUrl && crmKey) {
    try {
      const target = await resolveTarget();

      // custom_fields estructurados — visibles en el detalle del lead
      const customFields = {
        form: 'pre-detrasdecamara',
        landing_url: DCC_LANDING_URL,
        submitted_at: lead.created_at || new Date().toISOString(),
        punto_actual: lead.punto_actual || null,
        genera_ingresos: lead.genera_ingresos || null,
        objetivo_filmmaking: lead.objetivo_filmmaking || null,
        bloqueo: lead.bloqueo || null,
        source_id: lead.id,
      };

      // notes legible (sigue siendo útil para la vista de actividad rápida)
      const notes = [
        `Formulario: pre-detrasdecamara (${DCC_LANDING_URL})`,
        `Punto actual: ${lead.punto_actual || '—'}`,
        `Genera ingresos: ${lead.genera_ingresos || '—'}`,
        `Objetivo filmmaking: ${lead.objetivo_filmmaking || '—'}`,
        `Bloqueo principal: ${lead.bloqueo || '—'}`,
      ].join('\n');

      const tags = ['pre-detrasdecamara', 'landing'];
      if (lead.genera_ingresos && /^Si/i.test(lead.genera_ingresos)) tags.push('genera-ingresos');
      if (lead.punto_actual && /Ya vivo/i.test(lead.punto_actual)) tags.push('profesional');

      const body = {
        client_id: target.clientId,
        name: lead.nombre || lead.email,
        email: lead.email,
        phone: lead.telefono,
        status: 'lead',
        source: 'pre-detrasdecamara',
        vertical: 'filmmaking',
        notes,
        tags,
        custom_fields: customFields,
      };
      if (target.pipelineId) {
        body.pipeline_id = target.pipelineId;
        body.stage_key = target.stageKey;
      }

      const res = await fetch(`${crmUrl}/rest/v1/crm_contacts`, {
        method: 'POST',
        headers: {
          apikey: crmKey,
          Authorization: `Bearer ${crmKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=ignore-duplicates,return=representation',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error(`[DCC] CRM insert status=${res.status} body=${text.slice(0, 200)}`);
      } else {
        const rows = await res.json().catch(() => []);
        const contactId = Array.isArray(rows) ? rows[0]?.id : null;
        if (contactId) {
          // Actividad inicial en crm_activities
          await fetch(`${crmUrl}/rest/v1/crm_activities`, {
            method: 'POST',
            headers: {
              apikey: crmKey,
              Authorization: `Bearer ${crmKey}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({
              client_id: target.clientId,
              contact_id: contactId,
              type: 'note',
              title: 'Lead capturado desde pre-detrasdecamara',
              description: notes,
              performed_by: 'DCC Connector',
              performed_at: new Date().toISOString(),
            }),
          }).catch(err => console.error('[DCC] crm_activities insert failed:', err?.message));
        }
      }
    } catch (err) {
      console.error(`[DCC] Error syncing to CRM:`, err.message);
    }
  }

  // Evento de orquestación
  await eventBus.publish('lead.created', 'forms', {
    lead_id: newLead.id,
    email: lead.email,
    nombre: lead.nombre,
    telefono: lead.telefono,
    producto: 'Detrás de Cámara',
    landing_source: 'detrasdecamara',
    pipeline: DCC_PIPELINE_NAME,
    stage: DCC_STAGE_KEY,
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

  const { queryOne } = db;
  const last = await queryOne(
    "SELECT metadata->>'source_id' as source_id FROM leads WHERE landing_source = 'detrasdecamara' ORDER BY created_at DESC LIMIT 1"
  );
  if (last?.source_id) {
    lastSeenId = parseInt(last.source_id, 10);
  }

  // Resolver target una vez al arrancar (falla ruidoso si no hay pipeline)
  try {
    await resolveTarget();
  } catch (err) {
    console.warn(`[DCC] No se pudo resolver target al arrancar: ${err.message}. Reintentará en cada lead.`);
  }

  console.log(`[DCC] Conector Detrás de Cámara iniciado. Último ID: ${lastSeenId}`);

  const poll = async () => {
    try {
      const leads = await fetchNewLeads();
      for (const lead of leads) {
        const synced = await syncLeadToCRM(lead, { eventBus, db });
        if (synced) {
          console.log(`[DCC] Lead sincronizado al pipeline "${DCC_PIPELINE_NAME}/${DCC_STAGE_KEY}": ${lead.nombre} (${lead.email})`);
        }
        lastSeenId = Math.max(lastSeenId, lead.id);
      }
    } catch (err) {
      console.error(`[DCC] Error en poll:`, err.message);
    }
  };

  await poll();
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
