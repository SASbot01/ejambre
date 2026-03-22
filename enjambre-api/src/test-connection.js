// ============================================
// TEST DE CONEXIÓN - Verifica SOC + Supabase
// Ejecutar: node --env-file=.env src/test-connection.js
// ============================================

import { ciberHandlers } from './tools/ciber-tools.js';
import { opsHandlers } from './tools/ops-tools.js';
import { crmHandlers } from './tools/crm-tools.js';

async function test() {
  console.log('🐺 ENJAMBRE - Test de Conexiones\n');

  // === SOC ===
  console.log('=== AGENTE CIBER (SOC) ===');
  try {
    const status = await ciberHandlers.ciber_get_soc_status();
    if (status.error) {
      console.log('❌ SOC:', status.error);
    } else {
      console.log('✅ SOC conectado');
      console.log(`   Amenazas recientes: ${status.threats_last_5?.length || 0}`);
      console.log(`   Incidentes abiertos: ${status.open_incidents}`);
      console.log(`   Sensores: ${status.active_sensors}/${status.total_sensors}`);
      if (status.threats_last_5?.[0]) {
        const t = status.threats_last_5[0];
        console.log(`   Última amenaza: ${t.type} sev:${t.severity} desde ${t.src_ip}`);
      }
    }
  } catch (e) {
    console.log('❌ SOC error:', e.message);
  }

  // === SUPABASE OPS ===
  console.log('\n=== AGENTE OPS (Supabase) ===');
  try {
    const sales = await opsHandlers.ops_get_sales_summary({ period: 'month' });
    if (sales.error) {
      console.log('❌ OPS:', sales.error);
    } else {
      console.log('✅ OPS conectado');
      console.log(`   Ventas este mes: ${sales.total_sales}`);
      console.log(`   Revenue: $${sales.total_revenue}`);
      console.log(`   Cash: $${sales.total_cash}`);
      console.log(`   Ticket promedio: $${sales.average_ticket}`);
    }
  } catch (e) {
    console.log('❌ OPS error:', e.message);
  }

  // === SUPABASE TEAM ===
  try {
    const team = await opsHandlers.ops_get_team_performance({ role: 'all' });
    if (!team.error) {
      console.log(`   Equipo activo: ${team.length} miembros`);
      team.slice(0, 3).forEach((m) => console.log(`   - ${m.name} (${m.role})`));
    }
  } catch {}

  // === SUPABASE PRODUCTS ===
  try {
    const products = await opsHandlers.ops_get_products();
    if (Array.isArray(products)) {
      console.log(`   Productos: ${products.length}`);
      products.slice(0, 3).forEach((p) => console.log(`   - ${p.name}: $${p.price}`));
    }
  } catch {}

  // === SUPABASE CRM ===
  console.log('\n=== AGENTE CRM (Supabase) ===');
  try {
    const pipeline = await crmHandlers.crm_get_pipeline_summary();
    if (pipeline.error) {
      console.log('❌ CRM:', pipeline.error);
    } else {
      console.log('✅ CRM conectado');
      console.log(`   Total contactos: ${pipeline.total_contacts}`);
      Object.entries(pipeline.pipeline || {}).forEach(([status, data]) => {
        console.log(`   ${status}: ${data.count} contactos ($${data.total_value})`);
      });
    }
  } catch (e) {
    console.log('❌ CRM error:', e.message);
  }

  // === CLIENTS ===
  try {
    const clients = await opsHandlers.ops_get_clients();
    if (Array.isArray(clients)) {
      console.log(`\n=== TENANTS ===`);
      clients.forEach((c) => console.log(`   ${c.active ? '✅' : '❌'} ${c.name} (${c.slug})`));
    }
  } catch {}

  console.log('\n🐺 Test completado.');
}

test().catch(console.error);
