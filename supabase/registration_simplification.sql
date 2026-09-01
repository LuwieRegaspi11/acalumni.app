-- =====================================================================
-- REGISTRATION SIMPLIFICATION — implements the professor's feedback:
--   1. Every alumni signup must go through manual admin review, even if
--      it matches the student_roster (the roster-match auto-approval
--      shortcut from student_roster_verification.sql is removed here).
--   2. The signup form now collects a home Address, so `profiles` needs
--      an `address` column and the trigger needs to copy it over.
--
-- Run this once in Supabase -> SQL Editor -> New query -> Run.
-- Safe to re-run: column add is guarded, function is CREATE OR REPLACE.
-- Supersedes the handle_new_user() version in student_roster_verification.sql.
-- =====================================================================

alter table public.profiles
  add column if not exists address text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role text := coalesce(new.raw_user_meta_data->>'role', 'alumni');
begin
  insert into public.profiles (
    id, name, email, role, department, batch_year, program, profile_image,
    phone, address, student_id, id_type, id_document_url, registration_status
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    new.email,
    v_role,
    new.raw_user_meta_data->>'department',
    nullif(new.raw_user_meta_data->>'batch_year', '')::int,
    new.raw_user_meta_data->>'program',
    new.raw_user_meta_data->>'profile_image',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'address',
    new.raw_user_meta_data->>'student_id',
    new.raw_user_meta_data->>'id_type',
    new.raw_user_meta_data->>'id_document',
    -- Every alumni signup now lands in 'pending' for manual admin review,
    -- regardless of student_roster match. Non-alumni roles (faculty/rep)
    -- keep their existing behavior (auto-approved; vetted another way).
    case when v_role = 'alumni' then 'pending' else 'approved' end
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;
