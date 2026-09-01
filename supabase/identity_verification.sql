-- =====================================================================
-- IDENTITY VERIFICATION — dormant shell for the Identity Verification
-- & Secure Sign-In feature. This originally also created the mobile-OTP
-- pipeline (removed — see the "remove_mobile_otp" migration) and an
-- OCR-based ID/face-verification pipeline: `run_identity_match()`,
-- `admin_review_identity()`, the ID/face columns on
-- `identity_verifications`, and the private `id-documents` Storage
-- bucket the verify-id Edge Function uploaded into. All of that was
-- removed by the "remove_id_verification_pipeline" migration — like
-- mobile-otp, verify-id was never called from anywhere in src/, so
-- nothing outside this dormant table was actually affected.
--
-- What's left is just a per-user placeholder row, kept in case a
-- verification pipeline is rebuilt later. `profiles.date_of_birth`
-- (added below) is likewise unused today but harmless to keep as a
-- general profile field.
--
-- Run once via Supabase SQL Editor (or MCP apply_migration). Safe to
-- re-run: every create is guarded / CREATE OR REPLACE.
-- =====================================================================

alter table public.profiles
  add column if not exists date_of_birth date;

create table if not exists public.identity_verifications (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.identity_verifications enable row level security;

drop policy if exists "identity_verifications_select_self_or_admin" on public.identity_verifications;
create policy "identity_verifications_select_self_or_admin"
  on public.identity_verifications for select
  using (auth.uid() = user_id or is_admin());

-- The only way a row exists at all right now: the account owner (or the
-- registration trigger, see registration_identity_wiring.sql) creates
-- their own default row. No update policy — there is nothing left on
-- this table for anyone to update.
drop policy if exists "identity_verifications_insert_self" on public.identity_verifications;
create policy "identity_verifications_insert_self"
  on public.identity_verifications for insert
  with check (auth.uid() = user_id);
