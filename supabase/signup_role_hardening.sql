-- =====================================================================
-- SIGNUP ROLE HARDENING
--
-- Context: public.handle_new_user() (see registration_simplification.sql,
-- which itself superseded student_roster_verification.sql) reads the
-- new account's role like this:
--
--   v_role text := coalesce(new.raw_user_meta_data->>'role', 'alumni');
--   ...
--   case when v_role = 'alumni' then 'pending' else 'approved' end
--
-- The gap this file closes: `raw_user_meta_data` is arbitrary,
-- caller-supplied JSON passed straight through by Supabase Auth's
-- signUp() — anyone with the public anon key (visible in every browser
-- bundle) can call it directly (bypassing the app's UI entirely, which
-- never sends a `role` field and only ever produces alumni signups) with
-- `options.data.role` set to `"admin"`, `"faculty"`, or `"representative"`.
-- Because handle_new_user() is a SECURITY DEFINER trigger on
-- auth.users, it runs with elevated privileges and outside PostgREST
-- (auth.role() is null/'service_role' here), so neither
-- guard_representative_assignment (batch_representative_assignment_guard.sql)
-- nor guard_registration_status (registration_status_guard.sql) apply —
-- those two only guard PostgREST UPDATEs from an already-authenticated
-- user, not this INSERT path. The result: a brand-new, fully-approved
-- admin account, created straight through public sign-up, with zero
-- review.
--
-- The fix: self-service sign-up may only ever create 'alumni' accounts.
-- Faculty/representative/admin accounts are provisioned by an existing
-- admin changing `role` afterward (UserAccountManagement.tsx /
-- BatchRepresentatives.tsx), which is already correctly gated by the
-- "Admins can update all profiles" policy + the guard triggers above.
-- Client-supplied role is now ignored entirely instead of trusted.
--
-- Safe to re-run: function is CREATE OR REPLACE. Purely additive — no
-- data is changed, no existing policy, table, or trigger is altered.
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
    phone, address, student_id, id_type, id_document_url, registration_status
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    new.email,
    -- Never trust a client-supplied role: every self-service sign-up is
    -- 'alumni'. Other roles are only ever granted by an admin editing
    -- the profile afterward (an already-authenticated, already-gated
    -- path — see batch_representative_assignment_guard.sql).
    'alumni',
    new.raw_user_meta_data->>'department',
    nullif(new.raw_user_meta_data->>'batch_year', '')::int,
    new.raw_user_meta_data->>'program',
    new.raw_user_meta_data->>'profile_image',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'address',
    new.raw_user_meta_data->>'student_id',
    new.raw_user_meta_data->>'id_type',
    new.raw_user_meta_data->>'id_document',
    -- Every alumni signup lands in 'pending' for manual admin review.
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;
