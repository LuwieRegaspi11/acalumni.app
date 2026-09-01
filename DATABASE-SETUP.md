# Database Setup

The whole app — accounts, alumni records, donations, events,
announcements, job postings, tracer surveys, audit logs, batch
representative assignment, and system settings — is backed by
**Supabase** (hosted Postgres + Auth + Storage). Nothing is hardcoded
in-memory anymore.

**This project's Supabase instance is already fully provisioned** —
14 tables, RLS policies on every one of them, 12 SECURITY DEFINER
helper functions/RPCs (`is_admin()`, `notify_user()`, `log_audit()`,
etc.), and two Storage buckets (`donation-proofs` private,
`public-assets` public) — so if you're working on this exact project
you can skip straight to step 3 (get your API keys) or, if you already
have a `.env`, just `pnpm install && pnpm dev`.

The steps below are for standing up a **fresh copy** of this schema in
a brand-new Supabase project (e.g. forking the app).

## 1. Create a Supabase project

1. Go to https://supabase.com and sign up (free tier is enough to start).
2. Click **New Project**. Pick a name, a database password (save it
   somewhere safe), and a region close to your users.
3. Wait a minute or two for it to finish provisioning.

## 2. Create the schema

`supabase/schema.sql` in this repo only documents the original
`profiles` table shape — the live schema has grown well beyond it
(departments, announcements, events, donations, notifications, job
postings, audit logs, tracer surveys, system settings, plus every
RLS policy and helper function). If you're setting up a fresh
project, the fastest path is asking an agent with Supabase MCP access
to replicate the existing project's schema (`list_tables` /
`pg_policies` / `pg_get_functiondef` on the working project, then
`apply_migration` the same DDL onto the new one) rather than
hand-copying SQL here.

## 3. Get your API keys

1. In Supabase, go to **Settings -> API**.
2. Copy the **Project URL** and the **anon public** key.
3. In this project, copy `.env.example` to a new file named `.env`
   in the project root, and paste your values in:
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
   `.env` is already git-ignored, so your keys won't get committed.

## 4. Install the new dependency and run

```
pnpm install
pnpm dev
```

(`@supabase/supabase-js` was added to `package.json` — this installs it.)

## 5. Try it

- Go to `/register` and create a real account. It's saved in your
  Supabase project (check **Table Editor -> profiles** to see it).
- Go to `/login` and sign in with that account.

## Expense receipts (Fund Transparency)

Admins can attach a receipt image when logging what a campaign's funds
were spent on (Donation Management -> Log Expense), which alumni can
then view on their Fund Transparency page. This needs one extra
column: open **SQL Editor -> New query**, paste in
`supabase/donation_expense_receipts.sql`, and click **Run**. See the
comments in that file if your `donation-proofs` Storage bucket's
upload policy needs to be widened to allow admin uploads too.

## Payment destinations (Payment Config / Donation Center)

The old fixed GCash/Bank fields on System Settings -> Payment Config
have been replaced by an admin-managed, reorderable list of payment
destinations (Bank / E-Wallet / Other), each with its own QR code.
This needs one new table + a storage policy for QR uploads: open
**SQL Editor -> New query**, paste in `supabase/payment_destinations.sql`,
and click **Run**. It also carries over your existing GCash/Bank values
as the first two entries so nothing is lost. The Donation Center only
shows entries marked Active, in the order set there.

## Creating new accounts

Register through `/register` — new alumni accounts start
`registration_status = 'pending'` and land on a restricted view until
an admin approves them in **Pending Registrations**. Non-alumni roles
(faculty, representative) aren't self-serve; promote an existing
account by updating its `role` column directly:

```sql
update public.profiles set role = 'faculty' where email = 'someone@asiancollege.edu.ph';
```

Batch representatives are a special case — assign them from
**Admin -> Batch Representatives** in the app itself (it validates the
alumni's own batch year/department/program match the assignment and
enforces one rep per combination), rather than by hand in SQL.

## Everything is connected

Every admin/alumni/faculty/representative screen reads and writes
through Supabase now — there's no remaining mock-data area. The one
deliberate exception: the "Generate PDF" / "Export" / "Generate
Letters" buttons in Reports and Tracer Surveys are UI-only (no
file-generation library wired in yet).
