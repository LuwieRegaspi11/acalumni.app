-- =====================================================================
-- REGISTRATION IDENTITY WIRING — supersedes the handle_new_user()
-- version in registration_simplification.sql (and folds in the role
-- fix from signup_role_hardening.sql, which superseded it live -- this
-- version never went further than a draft). Adds:
--   1. `date_of_birth` copied from signup metadata into `profiles`.
--   2. A companion `identity_verifications` row created for every new
--      account, so the ID-verification pipeline (identity_verification.sql)
--      has somewhere to record progress from the moment the account
--      exists.
--
-- Mobile-OTP enforcement, which this file used to also wire in here, has
-- been removed: the `mobile-otp` Edge Function and `otp_verifications`
-- table are gone (see the "remove_mobile_otp" migration) since the
-- feature was never actually deployed or reachable from the app.
--
-- Note: the "every alumni signup requires manual admin review
-- regardless" policy from registration_simplification.sql is
-- unchanged — this only affects the identity-verification pipeline
-- status shown to the admin, not registration_status/auto-approval.
--
-- Run once via Supabase SQL Editor (or MCP apply_migration). Safe to
-- re-run: function is CREATE OR REPLACE.
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (
    id, name, email, role, department, batch_year, program, profile_image,
    phone, address, date_of_birth, student_id, id_type, id_document_url, registration_status
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    new.email,
    -- Never trust a client-supplied role: every self-service sign-up is
    -- 'alumni'. Other roles are only ever granted by an admin editing
    -- the profile afterward (an already-authenticated, already-gated
    -- path — see batch_representative_assignment_guard.sql and
    -- signup_role_hardening.sql).
    'alumni',
    new.raw_user_meta_data->>'department',
    nullif(new.raw_user_meta_data->>'batch_year', '')::int,
    new.raw_user_meta_data->>'program',
    new.raw_user_meta_data->>'profile_image',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'address',
    nullif(new.raw_user_meta_data->>'date_of_birth', '')::date,
    new.raw_user_meta_data->>'student_id',
    new.raw_user_meta_data->>'id_type',
    new.raw_user_meta_data->>'id_document',
    -- Every alumni signup lands in 'pending' for manual admin review.
    'pending'
  )
  on conflict (id) do nothing;

  insert into public.identity_verifications (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$function$;
