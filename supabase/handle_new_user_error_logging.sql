-- =====================================================================
-- HANDLE_NEW_USER ERROR LOGGING — makes handle_new_user() log loudly on
-- failure instead of silently leaving an orphaned auth.users row with
-- no matching profiles row.
--
-- Found via two real accounts with a confirmed auth.users row but no
-- profiles row at all (avropelos.student@asiancollege.edu.ph, a real
-- signup from 2026-08-19, and a pre-existing test stub account) — both
-- were completely unable to sign in: the app's login() reads the
-- profiles row to learn registration_status, and with none to find, it
-- reported a misleading "couldn't reach the server" error instead of
-- ever reaching the Pending Approval page. Both accounts were manually
-- fixed (backfilled / removed) directly in the database.
--
-- An unhandled exception in an AFTER INSERT trigger already rolls back
-- the whole transaction (so the auth.users row wouldn't be created
-- either) -- this doesn't change that. It only adds a clear, greppable
-- log line identifying which signup failed and why, so a recurrence
-- shows up in Supabase's Postgres logs instead of leaving the same
-- silent-orphan mystery to debug from scratch next time.
--
-- Run this once in Supabase -> SQL Editor -> New query -> Run.
-- Safe to re-run: function is CREATE OR REPLACE.
-- Supersedes the handle_new_user() version in registration_simplification.sql
-- (as already hardened for role by signup_role_hardening.sql).
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
    -- path -- see batch_representative_assignment_guard.sql).
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
exception
  when others then
    raise warning 'handle_new_user() failed to create a profiles row for user % (%): % (SQLSTATE %)',
      new.id, new.email, sqlerrm, sqlstate;
    raise;
end;
$function$;
