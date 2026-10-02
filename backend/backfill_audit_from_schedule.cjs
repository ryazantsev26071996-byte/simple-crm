// One-time backfill: create lessons_deducted audit_log entries from schedule rows
// Run: node backend/backfill_audit_from_schedule.cjs
// Safe to re-run – skips rows that already have a matching "восстановлено" entry.

require('dotenv').config({ path: __dirname + '/.env' });

const URL  = process.env.SUPABASE_URL;
const KEY  = process.env.SUPABASE_SERVICE_KEY;

if (!URL || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

async function get(path) {
  const r = await fetch(`${URL}/rest/v1/${path}`, { headers });
  if (!r.ok) { const t = await r.text(); throw new Error(`GET ${path}: ${r.status} ${t}`); }
  return r.json();
}

async function post(path, body) {
  const r = await fetch(`${URL}/rest/v1/${path}`, {
    method: 'POST', headers, body: JSON.stringify(body),
  });
  if (!r.ok) { const t = await r.text(); throw new Error(`POST ${path}: ${r.status} ${t}`); }
  return r.json();
}

(async () => {
  console.log('Fetching attended schedule rows…');
  // Fetch all rows where attended=true and client_id is set
  const scheduleRows = await get(
    'schedule?attended=eq.true&client_id=not.is.null&select=id,date,time,client_id,teacher&order=date.asc,time.asc'
  );
  console.log(`  Found ${scheduleRows.length} attended schedule rows with a client.`);

  // Fetch existing backfilled entries so we can skip duplicates
  console.log('Fetching existing backfilled audit_log entries…');
  const existingRaw = await get(
    "audit_log?action=eq.lessons_deducted&entity=eq.client&new_value=like.восстановлено*&select=entity_id,new_value"
  );
  // Build dedup key: "clientId|date|time"
  const alreadyDone = new Set();
  for (const e of existingRaw) {
    // new_value format: "восстановлено из расписания: -1 занятие (2026-08-15 10:00)"
    const m = e.new_value.match(/\((\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})\)/);
    if (m) alreadyDone.add(`${e.entity_id}|${m[1]}|${m[2]}`);
  }
  console.log(`  Already backfilled: ${alreadyDone.size} entries.`);

  let inserted = 0;
  let skipped  = 0;

  for (const row of scheduleRows) {
    const key = `${row.client_id}|${row.date}|${row.time}`;
    if (alreadyDone.has(key)) { skipped++; continue; }

    // created_at: combine date + time, treat as Moscow time (UTC+3)
    const createdAt = `${row.date}T${row.time}:00+03:00`;

    await post('audit_log', {
      action: 'lessons_deducted',
      entity: 'client',
      entity_id: row.client_id,
      old_value: null,
      new_value: `восстановлено из расписания: -1 занятие (${row.date} ${row.time})`,
      performed_by: null,
      performed_by_name: row.teacher || null,
      created_at: createdAt,
    });
    alreadyDone.add(key);
    inserted++;
  }

  console.log(`\nBackfill done. Inserted: ${inserted}  Skipped (already existed): ${skipped}`);

  // ── Reconciliation report ──────────────────────────────────────────────────
  console.log('\nRunning reconciliation report…');

  // Count all audit entries (backfilled + real) per client
  const auditEntries = await get(
    "audit_log?action=in.(lessons_deducted,lessons_edited)&entity=eq.client&select=entity_id,action"
  );
  const auditCount = {};
  for (const e of auditEntries) {
    auditCount[e.entity_id] = (auditCount[e.entity_id] || 0) + 1;
  }

  // Fetch all clients' lessons_used
  const clients = await get('clients?select=id,name,lessons_used,is_unlimited&order=name.asc');

  console.log('\nClients where audit count ≠ lessons_used (excluding unlimited):');
  let mismatches = 0;
  for (const c of clients) {
    if (c.is_unlimited) continue;
    const used   = c.lessons_used || 0;
    const audit  = auditCount[c.id] || 0;
    if (audit !== used) {
      console.log(`  [${c.id}] ${c.name}: lessons_used=${used}, audit_entries=${audit}, diff=${audit - used}`);
      mismatches++;
    }
  }
  if (mismatches === 0) console.log('  None — all match perfectly.');
  else console.log(`\n  Total mismatches: ${mismatches}`);
  console.log('\nDone.');
})();
