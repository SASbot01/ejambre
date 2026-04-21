// Dona CRM — Comandante. Proceso independiente.
// Arranca: node src/army/commanders/crm.js  (o vía systemd dona-crm.service)

import { BaseCommander } from '../base-commander.js';
import { crmTools, crmHandlers } from '../../tools/crm-tools.js';

const commander = new BaseCommander({
  name: 'crm',
  displayName: 'Dona CRM',
  doctrineFile: 'crm.md',
  tools: crmTools,
  handlers: crmHandlers,
  model: process.env.AGENT_CRM_MODEL || 'claude-haiku-4-5-20251001',
  patrolEverySec: parseInt(process.env.AGENT_CRM_PATROL_SEC || '300', 10),
  patrolPrompt: `Ciclo de patrulla. Observa el estado del pipeline y responde brevemente en español:
1. ¿Cuántos leads hay en el pipeline ahora mismo? ¿Hay alguno nuevo desde hace < 1h?
2. ¿Hay leads estancados (sin actividad > 48h)?
3. ¿Algún setter sobrecargado (> 15 leads asignados)?
4. Reporta al General las 3 observaciones + cualquier anomalía que detectes.

Usa tus tools para obtener datos reales. Si una tool falla, intenta otra alternativa antes de reportar error. No mutes datos — si necesitas aprobación para algo, lo indicas en el reporte.`,
});

commander.start();
