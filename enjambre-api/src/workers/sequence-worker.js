// Sequence Follow-up Worker
// Runs every 60 seconds, checks for pending sequence steps and executes them

import { query, queryOne } from '../config/database.js';
import { sendWhatsAppNotification } from '../connectors/whatsapp.js';
import { eventBus } from '../events/event-bus.js';

const CHECK_INTERVAL = 60_000; // 1 minute
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'BlackWolf <noreply@blackwolfsec.io>';

async function sendEmail(to, subject, body) {
  if (!RESEND_API_KEY) {
    console.log(`[Sequences] Email skipped (no RESEND_API_KEY): ${to}`);
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html: body.replace(/\n/g, '<br>') }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[Sequences] Email error to ${to}:`, err);
      return false;
    }
    console.log(`[Sequences] Email sent to ${to}`);
    return true;
  } catch (err) {
    console.error(`[Sequences] Email failed to ${to}:`, err.message);
    return false;
  }
}

function renderTemplate(template, lead) {
  return template
    .replace(/\{\{nombre\}\}/g, lead.nombre || lead.email || 'cliente')
    .replace(/\{\{producto\}\}/g, lead.producto || 'nuestros servicios')
    .replace(/\{\{email\}\}/g, lead.email || '')
    .replace(/\{\{telefono\}\}/g, lead.telefono || '');
}

async function processEnrollments() {
  // Get enrollments due for execution
  const due = await query(`
    SELECT se.*, s.steps as sequence_steps, s.name as sequence_name,
           l.nombre, l.email, l.telefono, l.producto, l.status as lead_status
    FROM sequence_enrollments se
    JOIN sequences s ON s.id = se.sequence_id
    JOIN leads l ON l.id = se.lead_id
    WHERE se.status = 'active'
      AND se.next_fire_at <= NOW()
    ORDER BY se.next_fire_at ASC
    LIMIT 20
  `);

  for (const enrollment of due) {
    try {
      const steps = typeof enrollment.sequence_steps === 'string'
        ? JSON.parse(enrollment.sequence_steps)
        : enrollment.sequence_steps;

      const currentStep = steps[enrollment.current_step];
      if (!currentStep) {
        // All steps completed
        await queryOne(
          'UPDATE sequence_enrollments SET status = $1 WHERE id = $2 RETURNING *',
          ['completed', enrollment.id]
        );
        await eventBus.publish('sequence.completed', 'crm', {
          lead_id: enrollment.lead_id,
          sequence: enrollment.sequence_name,
        });
        continue;
      }

      // Check if lead responded (status changed from initial)
      if (enrollment.lead_status !== enrollment.metadata?.initial_status) {
        await queryOne(
          'UPDATE sequence_enrollments SET status = $1 WHERE id = $2 RETURNING *',
          ['responded', enrollment.id]
        );
        await eventBus.publish('sequence.responded', 'crm', {
          lead_id: enrollment.lead_id,
          new_status: enrollment.lead_status,
        });
        continue;
      }

      const message = renderTemplate(currentStep.template, enrollment);

      // Execute based on channel
      if (currentStep.channel === 'whatsapp' && enrollment.telefono) {
        await sendWhatsAppNotification(enrollment.telefono, message);
        console.log(`[Sequences] WhatsApp sent to ${enrollment.telefono} (step ${currentStep.step})`);
      } else if (currentStep.channel === 'email' && enrollment.email) {
        const subject = `${enrollment.producto || 'BlackWolf'} — Seguimiento`;
        const sent = await sendEmail(enrollment.email, subject, message);
        await eventBus.publish(sent ? 'sequence.email_sent' : 'sequence.email_pending', 'crm', {
          lead_id: enrollment.lead_id,
          email: enrollment.email,
          sent,
        });
      }

      // Move to next step
      const nextStep = steps[enrollment.current_step + 1];
      const nextFireAt = nextStep
        ? new Date(Date.now() + nextStep.delay_hours * 3600_000).toISOString()
        : null;

      if (nextFireAt) {
        await queryOne(
          `UPDATE sequence_enrollments
           SET current_step = current_step + 1, next_fire_at = $1, status = 'active'
           WHERE id = $2 RETURNING *`,
          [nextFireAt, enrollment.id]
        );
      } else {
        await queryOne(
          `UPDATE sequence_enrollments
           SET current_step = current_step + 1, next_fire_at = NULL, status = 'completed'
           WHERE id = $1 RETURNING *`,
          [enrollment.id]
        );
      }

      await eventBus.publish('sequence.step_executed', 'crm', {
        lead_id: enrollment.lead_id,
        step: currentStep.step,
        channel: currentStep.channel,
        sequence: enrollment.sequence_name,
      });

    } catch (err) {
      console.error(`[Sequences] Error processing enrollment ${enrollment.id}:`, err.message);
      await queryOne(
        'UPDATE sequence_enrollments SET status = $1 WHERE id = $2 RETURNING *',
        ['error', enrollment.id]
      );
    }
  }

  return due.length;
}

// Auto-enroll a lead into matching sequences
export async function enrollLead(leadId) {
  const lead = await queryOne('SELECT * FROM leads WHERE id = $1', [leadId]);
  if (!lead) return;

  // Find matching active sequences
  const sequences = await query(
    `SELECT * FROM sequences
     WHERE active = true
       AND (trigger_status = $1 OR trigger_status IS NULL)
       AND (product_filter IS NULL OR product_filter = $2)`,
    [lead.status, lead.producto]
  );

  for (const seq of sequences) {
    // Check if already enrolled
    const existing = await queryOne(
      'SELECT id FROM sequence_enrollments WHERE lead_id = $1 AND sequence_id = $2 AND status = $3',
      [leadId, seq.id, 'active']
    );
    if (existing) continue;

    const steps = typeof seq.steps === 'string' ? JSON.parse(seq.steps) : seq.steps;
    const firstStep = steps[0];
    const nextFireAt = firstStep
      ? new Date(Date.now() + (firstStep.delay_hours || 0) * 3600_000).toISOString()
      : null;

    await queryOne(
      `INSERT INTO sequence_enrollments (lead_id, sequence_id, next_fire_at, metadata)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [leadId, seq.id, nextFireAt, JSON.stringify({ initial_status: lead.status })]
    );

    console.log(`[Sequences] Lead ${leadId} enrolled in "${seq.name}"`);
  }
}

let intervalHandle = null;

export function startSequenceWorker() {
  console.log('[Sequences] Worker started - checking every 60s');

  // Run immediately once
  processEnrollments().then(count => {
    if (count > 0) console.log(`[Sequences] Processed ${count} enrollments`);
  }).catch(err => console.error('[Sequences] Error:', err.message));

  // Then run periodically
  intervalHandle = setInterval(async () => {
    try {
      const count = await processEnrollments();
      if (count > 0) console.log(`[Sequences] Processed ${count} enrollments`);
    } catch (err) {
      console.error('[Sequences] Error:', err.message);
    }
  }, CHECK_INTERVAL);
}

export function stopSequenceWorker() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[Sequences] Worker stopped');
  }
}
