#!/usr/bin/env node
// scripts/import-alumni.mjs
//
// Bulk-imports alumni from a CSV file: creates one Supabase Auth
// account per valid row and auto-approves it (registration_status =
// 'approved') so admins don't have to review each one individually in
// Pending Registrations. Rows that fail validation, or already exist,
// are skipped and reported — nothing partial or guessed is written.
//
// WHY A LOCAL SCRIPT (and not an in-app upload button):
// This project is a static Vite SPA with no backend server (see
// DATABASE-SETUP.md) — everything ships straight to the browser.
// Creating accounts requires Supabase's Admin API, which only works
// with the service_role key, and that key must never reach client
// code (it bypasses Row Level Security entirely). This follows the
// same pattern already established by
// scripts/create-department-accounts.mjs: run locally, key in an env
// var, never committed, never bundled.
//
// WHY EACH VALID ROW GETS A SECOND (UPDATE) CALL:
// public.handle_new_user() — the trigger that turns a new auth.users
// row into a public.profiles row — unconditionally sets role='alumni'
// and registration_status='pending' for every signup, regardless of
// what's passed in, specifically so a self-service sign-up can never
// grant itself an approved/admin account (see
// supabase/signup_role_hardening.sql). That protection is exactly
// right for the public sign-up form and we don't want to weaken it,
// so instead this script does what an admin approving in Pending
// Registrations does: after the account is created, it makes a
// second, explicit update to registration_status via the service_role
// key. supabase/registration_status_guard.sql already trusts
// service_role for that column, so no schema change is needed.
//
// VALIDATION — a row is only imported if ALL of these hold:
//   - name, email, department, program, batch_year are all present
//     (non-empty after trimming).
//   - email looks like an email address.
//   - department is one of the codes in src/lib/academicPrograms.ts
//     (BAA / CSE / CTHM), and program is one of that department's
//     program codes — typos are flagged, not silently accepted.
//   - batch_year parses as a plausible year.
//   - email doesn't already belong to an existing profile, and isn't
//     repeated earlier in the same CSV.
// Anything that fails is listed at the end with the reason and CSV
// row number, so it can be fixed and re-run — re-running is safe,
// already-imported rows are skipped as duplicates rather than
// re-created.
//
// EMAIL DELIVERY: each valid row gets an invite email (Supabase Auth's
// built-in "invite" flow — they set their own password by following
// the link, no temp password ever passes through the admin). Supabase
// projects without custom SMTP configured have a LOW built-in email
// rate limit (a handful per hour) — for a CSV of more than a few
// alumni, configure Custom SMTP under Supabase Dashboard -> Authentication
// -> Emails first, or the later invites in the batch will fail/queue.
//
// USAGE:
//   SUPABASE_URL=https://amzteigyblhrbycussys.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service_role secret, Dashboard > Settings > API> \
//   node scripts/import-alumni.mjs path/to/alumni.csv
//
// CSV COLUMNS (header row required, any order, case-insensitive):
//   name, email, department, program, batch_year
//   optional: phone, graduation_date (YYYY-MM-DD)
// See scripts/alumni-import-template.csv for a starting point.
//
// Get the service_role key from the Supabase Dashboard only. Never put
// it in .env / commit it / expose it to the browser.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// ---------------------------------------------------------------------
// Keep in sync with src/lib/academicPrograms.ts (the single source of
// truth for the app's own pickers). Duplicated here because this is a
// plain Node script with no build step / TS import of the app source.
// ---------------------------------------------------------------------
const PROGRAMS_BY_DEPT = {
  BAA: ['BSA', 'BSMM', 'BSFM'],
  CSE: ['BMMA', 'BSCpE', 'BSCS', 'BSIT'],
  CTHM: ['BSHM', 'BSTM'],
};
const DEPARTMENTS = Object.keys(PROGRAMS_BY_DEPT);

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const csvPath = process.argv[2];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env vars. Required:');
  console.error('  SUPABASE_URL              (e.g. https://amzteigyblhrbycussys.supabase.co)');
  console.error('  SUPABASE_SERVICE_ROLE_KEY (Dashboard -> Settings -> API -> service_role secret)');
  process.exit(1);
}
if (!csvPath) {
  console.error('Usage: node scripts/import-alumni.mjs path/to/alumni.csv');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------
// Minimal CSV parser: handles quoted fields (with embedded commas,
// quotes doubled as "", and newlines), CRLF/LF line endings, and a
// leading UTF-8 BOM (common in Excel exports). No dependency needed
// for a format this small.
// ---------------------------------------------------------------------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM

  const endField = () => { row.push(field); field = ''; };
  const endRow = () => { endField(); rows.push(row); row = []; };

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { endField(); i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { endRow(); i++; continue; }
    field += c; i++;
  }
  // Last field/row (if the file doesn't end with a newline).
  if (field.length > 0 || row.length > 0) endRow();

  return rows.filter(r => !(r.length === 1 && r[0] === ''));
}

function parseRows(csvText) {
  const table = parseCsv(csvText);
  if (table.length === 0) return [];
  const header = table[0].map(h => h.trim().toLowerCase());
  return table.slice(1).map((cols, idx) => {
    const record = {};
    header.forEach((key, colIdx) => { record[key] = (cols[colIdx] ?? '').trim(); });
    record.__row = idx + 2; // +1 for 0-index, +1 for the header row itself
    return record;
  });
}

function validateRow(record, seenEmails) {
  const reasons = [];

  const name = record.name || '';
  const email = (record.email || '').toLowerCase();
  const departmentRaw = record.department || '';
  const programRaw = record.program || '';
  const batchYearRaw = record.batch_year || '';

  if (!name) reasons.push('missing name');
  if (!email) reasons.push('missing email');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) reasons.push(`invalid email "${email}"`);

  const department = departmentRaw.toUpperCase();
  if (!departmentRaw) reasons.push('missing department');
  else if (!DEPARTMENTS.includes(department)) {
    reasons.push(`unknown department "${departmentRaw}" (expected one of ${DEPARTMENTS.join(', ')})`);
  }

  const program = programRaw.toUpperCase();
  if (!programRaw) reasons.push('missing program');
  else if (DEPARTMENTS.includes(department) && !PROGRAMS_BY_DEPT[department].includes(program)) {
    reasons.push(`program "${programRaw}" is not offered under department "${department}" (expected one of ${PROGRAMS_BY_DEPT[department]?.join(', ') || '(fix department first)'})`);
  }

  const batchYear = Number.parseInt(batchYearRaw, 10);
  const currentYear = new Date().getFullYear();
  if (!batchYearRaw) reasons.push('missing batch_year');
  else if (!Number.isInteger(batchYear) || batchYear < 1950 || batchYear > currentYear + 1) {
    reasons.push(`implausible batch_year "${batchYearRaw}"`);
  }

  if (email && seenEmails.has(email)) reasons.push(`duplicate email within this CSV (also row ${seenEmails.get(email)})`);

  return {
    valid: reasons.length === 0,
    reasons,
    normalized: { name, email, department, program, batchYear, phone: record.phone || '', graduationDate: record.graduation_date || '' },
  };
}

async function main() {
  const csvText = readFileSync(csvPath, 'utf8');
  const records = parseRows(csvText);
  if (records.length === 0) {
    console.error('No data rows found in the CSV.');
    process.exit(1);
  }

  const { data: existingProfiles, error: profErr } = await supabase
    .from('profiles')
    .select('email');
  if (profErr) throw profErr;
  const existingEmails = new Set(existingProfiles.map(p => (p.email || '').toLowerCase()));

  const seenEmails = new Map();
  const invalid = [];
  const duplicates = [];
  const toImport = [];

  for (const record of records) {
    const { valid, reasons, normalized } = validateRow(record, seenEmails);
    if (normalized.email) seenEmails.set(normalized.email, record.__row);

    if (!valid) {
      invalid.push({ row: record.__row, name: normalized.name, reasons });
      continue;
    }
    if (existingEmails.has(normalized.email)) {
      duplicates.push({ row: record.__row, name: normalized.name, reason: `email ${normalized.email} already has an account` });
      continue;
    }
    toImport.push({ row: record.__row, ...normalized });
  }

  console.log(`Parsed ${records.length} row(s): ${toImport.length} valid, ${duplicates.length} duplicate, ${invalid.length} invalid.\n`);

  const created = [];
  const failed = [];

  for (const alum of toImport) {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(alum.email, {
      data: {
        name: alum.name,
        department: alum.department,
        program: alum.program,
        batch_year: String(alum.batchYear),
        phone: alum.phone || undefined,
      },
    });

    if (error) {
      failed.push({ row: alum.row, name: alum.name, email: alum.email, error: error.message });
      continue;
    }

    // handle_new_user() just created the profiles row as role='alumni',
    // registration_status='pending' (by design — see header comment).
    // Promote it now, the same way an admin approval would.
    const updatePayload = { registration_status: 'approved', active: true };
    if (alum.graduationDate) updatePayload.graduation_date = alum.graduationDate;

    const { error: updateErr } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', data.user.id);

    if (updateErr) {
      failed.push({ row: alum.row, name: alum.name, email: alum.email, error: `account created but auto-approve failed: ${updateErr.message}` });
      continue;
    }

    created.push(alum);
    // Gentle pacing — avoids tripping Supabase's built-in email rate
    // limit on projects without custom SMTP configured.
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`Imported and auto-approved ${created.length} alumni:`);
  for (const c of created) console.log(`  row ${c.row}: ${c.name} <${c.email}> (${c.department}/${c.program}, batch ${c.batchYear})`);

  if (duplicates.length) {
    console.log(`\nSkipped ${duplicates.length} duplicate(s):`);
    for (const d of duplicates) console.log(`  row ${d.row}: ${d.name} — ${d.reason}`);
  }

  if (invalid.length) {
    console.log(`\nSkipped ${invalid.length} invalid row(s) — fix and re-run to import just these:`);
    for (const v of invalid) console.log(`  row ${v.row}: ${v.name || '(no name)'} — ${v.reasons.join('; ')}`);
  }

  if (failed.length) {
    console.log(`\nFailed ${failed.length} (account or approval step errored):`);
    for (const f of failed) console.log(`  row ${f.row}: ${f.name} <${f.email}> — ${f.error}`);
  }

  console.log('\nEach imported alumnus has been emailed an invite link to set their password.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
