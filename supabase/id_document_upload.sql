-- =====================================================================
-- ID DOCUMENT UPLOAD — adds an ID Type + uploaded ID document to
-- registration, alongside the existing typed Student ID field (which
-- stays as-is — it's what the roster-verification auto-approval logic
-- keys off, see student_roster_verification.sql).
--
-- Follows the same convention already used for profile_image: the
-- image is base64-encoded client-side and passed through
-- auth.signUp()'s user metadata, then copied straight into a
-- `profiles` text column by the handle_new_user() trigger — no
-- Storage bucket, since there's no guaranteed authenticated session
-- immediately post-signup to do a Storage upload.
--
-- Run this once in Supabase -> SQL Editor -> New query -> Run.
-- Safe to re-run: column adds are guarded, function is CREATE OR
-- REPLACE.
-- =====================================================================

alter table public.profiles
  add column if not exists id_type text,
  add column if not exists id_document_url text;

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
    phone, student_id, id_type, id_document_url, registration_status
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
    new.raw_user_meta_data->>'student_id',
    new.raw_user_meta_data->>'id_type',
    new.raw_user_meta_data->>'id_document',
    case when v_role = 'alumni' then 'pending' else 'approved' end
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;
