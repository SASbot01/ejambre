// ============================================
// Bulk WhatsApp Send — Creator Founder Event
// Sends message to all CRM contacts with 15-20s delays
// ============================================

import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://kyxupfowsfkyqklxhtyo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5eHVwZm93c2ZreXFrbHhodHlvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjA2NzExMywiZXhwIjoyMDg3NjQzMTEzfQ.AUfdNycSDVFa-jUcnhNsxY9UBHTZ1-mZC8XnUmF8SZs'
);

const CLIENT_ID = 'c8d40521-8183-4dce-b271-bebbb587449b';
const API_BASE = 'http://localhost:3500';

const MESSAGE = `Buenas, soy Alex, del equipo de Creator Founder.

🚨 Vi que contestaste el primer formulario para solicitar la asistencia al evento presencial de CF!
Para poder confirmar tu asistencia de manera definitiva, necesito que rellenes este formulario de aquí.
El aforo es limitado, por lo que recomiendo que lo rellenes cuanto antes.
El día 20 de Abril cerrará el plazo para apuntarse‼️

👉 https://forms.gle/HjjG9od9ey1j3caQ6

📌 Horario:
10:00 – 14:00 / 16:00 – 21:30

📍 Ubicación:
The Palace Hotel
Plaza de las Cortes, 7 — Madrid`;

// ── Phone number normalization ──
function cleanPhone(raw) {
  if (!raw) return null;
  let num = raw.replace(/[\s\-\(\)]/g, '');

  // Already has + prefix with country code
  if (num.startsWith('+')) {
    return num.replace('+', '');
  }

  // Starts with 00 (international)
  if (num.startsWith('00')) {
    return num.slice(2);
  }

  // Detect country by number pattern
  // Spanish mobile: 6xx xxx xxx or 7xx xxx xxx (9 digits)
  // Spanish landline: 9xx xxx xxx (9 digits)
  if (/^[679]\d{8}$/.test(num)) {
    return '34' + num;
  }

  // UK mobile: 07xxxxxxxxx (11 digits starting with 0)
  if (/^07\d{9}$/.test(num)) {
    return '44' + num.slice(1);
  }

  // French mobile: 06/07 xxxxxxxx (10 digits)
  if (/^0[67]\d{8}$/.test(num)) {
    return '33' + num.slice(1);
  }

  // Already has country code (starts with 34, 44, 41, etc.) and is long enough
  if (num.length >= 11 && /^(34|44|41|33|49|39|351|52)/.test(num)) {
    return num;
  }

  // Fallback: assume Spanish if 9 digits
  if (num.length === 9) {
    return '34' + num;
  }

  // If 10+ digits, assume it already includes country code
  if (num.length >= 10) {
    return num;
  }

  console.warn(`  ⚠️  Could not determine country for: ${raw} -> skipping`);
  return null;
}

function randomDelay(minSec, maxSec) {
  const ms = (Math.random() * (maxSec - minSec) + minSec) * 1000;
  return new Promise(r => setTimeout(r, ms));
}

// ── Main ──
async function main() {
  console.log('📋 Fetching CRM contacts for Creator Founder...');
  const { data: contacts, error } = await sb
    .from('crm_contacts')
    .select('id, name, phone, whatsapp, email')
    .eq('client_id', CLIENT_ID);

  if (error) { console.error('DB Error:', error); process.exit(1); }
  console.log(`✅ ${contacts.length} contacts found\n`);

  // Already sent phones (from previous runs)
  const alreadySent = new Set([
    '34639408280','34692395147','34669799269','34636365362',
    '34634712201','34660125261','34609227763','34674444914','34629149633',
    '34615043957','34605136541','34640025221','34692221830','34645071983',
    '34643229740','34618376305','34625245350','34613175587','34675684074',
    '34622015514','34644745439','34661237709','34688817083','34635076769',
    '34644894243','34646677380','34653264930','34681937990','34615458307',
    '34657212691','34689530880','34658778202','34638456476','34643073461',
    '34608049288','34640015542','34629555201','34665199980','34686902052',
    '34658071889','34639168916','34673139648','34633835968','34689373111',
    '34699759131','34657546473','34623000742','34638395345','34678010566',
    '34646387634','34628600031','447849386432','34628134073','34631595144',
    '34659215616','34652036196','34620388815',
  ]);

  // Prepare send list
  const sendList = [];
  const skipped = [];

  for (const c of contacts) {
    const rawPhone = c.whatsapp || c.phone;
    const cleaned = cleanPhone(rawPhone);
    if (cleaned && alreadySent.has(cleaned)) {
      // Already sent in previous run
      continue;
    } else if (cleaned) {
      sendList.push({ ...c, cleanedPhone: cleaned });
    } else {
      skipped.push({ name: c.name, phone: rawPhone });
    }
  }

  console.log(`📨 Will send to: ${sendList.length} contacts`);
  if (skipped.length > 0) {
    console.log(`⏭️  Skipped (bad phone): ${skipped.length}`);
    skipped.forEach(s => console.log(`   - ${s.name} | ${s.phone}`));
  }
  console.log('');

  let sent = 0;
  let failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < sendList.length; i++) {
    const c = sendList[i];
    const chatId = `${c.cleanedPhone}@c.us`;

    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: chatId,
          message: MESSAGE,
          clientId: CLIENT_ID,
        }),
      });
      const data = await res.json();

      if (data.ok) {
        sent++;
        console.log(`✅ [${i + 1}/${sendList.length}] ${c.name} -> ${c.cleanedPhone}`);

        // Log as CRM activity
        await sb.from('crm_messages').insert({
          client_id: CLIENT_ID,
          contact_id: c.id,
          channel: 'whatsapp',
          direction: 'outbound',
          sender_name: 'Alex (bulk)',
          content: MESSAGE,
          status: 'sent',
        });
      } else {
        failed++;
        console.log(`❌ [${i + 1}/${sendList.length}] ${c.name} -> ${c.cleanedPhone} | Error: ${data.error}`);
      }
    } catch (err) {
      failed++;
      console.log(`❌ [${i + 1}/${sendList.length}] ${c.name} -> ${c.cleanedPhone} | ${err.message}`);
    }

    // Wait 15-20 seconds before next message (except last)
    if (i < sendList.length - 1) {
      const waitSec = Math.round(15 + Math.random() * 5);
      process.stdout.write(`   ⏳ Waiting ${waitSec}s...\r`);
      await randomDelay(15, 20);
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log('\n══════════════════════════════════════');
  console.log(`✅ Sent: ${sent} | ❌ Failed: ${failed} | ⏭️ Skipped: ${skipped.length}`);
  console.log(`⏱️  Total time: ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
  console.log('══════════════════════════════════════');
}

main().catch(console.error);
