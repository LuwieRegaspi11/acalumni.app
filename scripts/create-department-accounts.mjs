#!/usr/bin/env node
// scripts/create-department-accounts.mjs
//
// Creates one Supabase Auth account per row in `departments`, using the
// email pattern [code]@asiancollege.edu.ph (e.g. cse@, baa@, cthm@).
//
// WHY THIS SCRIPT (and not a raw SQL insert into auth.users):
// Supabase's `auth.users` table stores password hashes, confirmation
// tokens, and identity records in a shape only GoTrue (the Auth service)
// is meant to write. A hand-written `insert into auth.users ...` can create
// a row that *looks* right but breaks login, password reset, or a future
// Supabase upgrade, and skips the `auth.identities` row entirely. The
// Admin API (`auth.admin.createUser`, service_role key only) is the
// supported way to create accounts outside the normal sign-up form, and
// it's how this project's existing department accounts (cse@, cthm@,
// baa@) were created.
//
// Once the auth.users row exists, this project's `handle_new_user()`
// Postgres trigger auto-creates the matching `public.profiles` row from
// the `user_metadata` passed here (name, role, department) — see
// supabase/schema.sql history / DATABASE-SETUP.md. Role is set to
// 'faculty' to match the existing department accounts (profiles.role is
// constrained to admin/alumni/faculty/representative — there is no
// per-department role). Department linkage is via profiles.department
// (text) = departments.code, since profiles has no department_id foreign
// key today — every other department-scoped table in this app (events,
// job_postings, announcements, donation_campaigns, ...) uses the same
// text-code convention, so this matches how the rest of the schema works.
//
// IDEMPOTENT: before creating an account, it checks for an existing
// profiles row with that email and skips it. Re-running is safe.
//
// USAGE:
//   SUPABASE_URL=https://amzteigyblhrbycussys.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service_role secret, Dashboard > Settings > API> \
//   node scripts/create-department-accounts.mjs
//
// Get the service_role key from the Supabase Dashboard only. Never put it
// in .env / commit it / expose it to the browser — it bypasses RLS.

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env vars. Required:');
  console.error('  SUPABASE_URL              (e.g. https://amzteigyblhrbycussys.supabase.co)');
  console.error('  SUPABASE_SERVICE_ROLE_KEY (Dashboard -> Settings -> API -> service_role secret)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function randomPassword() {
  return crypto.randomBytes(18).toString('base64url'); // 24-char random temp password
}

async function main() {
  const { data: departments, error: deptErr } = await supabase
    .from('departments')
    .select('code, name')
    .order('code');
  if (deptErr) throw deptErr;

  const { data: existingProfiles, error: profErr } = await supabase
    .from('profiles')
    .select('email');
  if (profErr) throw profErr;
  const existingEmails = new Set(existingProfiles.map((p) => p.email.toLowerCase()));

  const created = [];
  const skipped = [];
  const failed = [];

  for (const dept of departments) {
    const email = `${dept.code.toLowerCase()}@asiancollege.edu.ph`;

    if (existingEmails.has(email)) {
      skipped.push(email);
      continue;
    }

    const password = randomPassword();

    const { error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // matches existing accounts: no confirmation-email step
      user_metadata: {
        name: `${dept.name} Department Account`,
        role: 'faculty',
        department: dept.code,
      },
    });

    if (error) {
      failed.push({ email, error: error.message });
      continue;
    }

    created.push({ email, password, department: dept.code });
  }

  console.log(`\nCreated ${created.length} account(s):`);
  for (const c of created) {
    console.log(`  ${c.email}  (department: ${c.department})  temp password: ${c.password}`);
  }

  if (failed.length) {
    console.log(`\nFailed ${failed.length}:`);
    for (const f of failed) console.log(`  ${f.email}: ${f.error}`);
  }

  console.log(`\nSkipped ${skipped.length} (already exist): ${skipped.join(', ') || '(none)'}`);
  console.log('\nShare each temp password with the department securely and have them change it on first login.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
