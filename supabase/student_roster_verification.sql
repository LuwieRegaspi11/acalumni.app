-- =====================================================================
-- STUDENT ROSTER VERIFICATION — auto-approve alumni registrations that
-- match the official student list exactly; anything else stays
-- 'pending' for manual review in Pending Registrations.
--
-- Only affects role = 'alumni'. Faculty/representative signups keep
-- their existing behavior (auto-approved; they're created by/vetted
-- through other means, not self-registration).
--
-- Run this once in Supabase -> SQL Editor -> New query -> Run.
-- Safe to re-run: table creation is guarded, the function is CREATE OR
-- REPLACE, and the roster upsert-friendly (student_id is the primary
-- key so re-importing the same CSV just overwrites, not duplicates).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The official roster you import from the registrar's records.
-- Match is exact on student_id + name (case-insensitive, trimmed) —
-- `name` here must be entered the same way profiles.name is built at
-- signup: "<First Name> <Last Name>" (see AuthContext.tsx register()).
-- ---------------------------------------------------------------------
create table if not exists public.student_roster (
  student_id text primary key,        -- format YYYY-NNNNNNN, e.g. 2023-2110585
  name text not null,                 -- "First Last", exactly as registrar records it
  department text,
  program text,
  batch_year integer,
  created_at timestamptz not null default now()
);

alter table public.student_roster enable row level security;

-- Admin-only: this is internal verification data, not something any
-- other role (including faculty/reps) needs to read or write.
drop policy if exists "student_roster_select_admin" on public.student_roster;
create policy "student_roster_select_admin"
  on public.student_roster for select
  using (is_admin());

drop policy if exists "student_roster_write_admin" on public.student_roster;
create policy "student_roster_write_admin"
  on public.student_roster for all
  using (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------
-- 2. Extend the signup trigger: for alumni, look up the roster by
-- student_id and require the name to match exactly (case/whitespace
-- insensitive). Match -> auto-approved. No match / no roster row ->
-- pending, same as today.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role text := coalesce(new.raw_user_meta_data->>'role', 'alumni');
  v_name text := coalesce(new.raw_user_meta_data->>'name', new.email);
  v_student_id text := new.raw_user_meta_data->>'student_id';
  v_roster_match boolean := false;
begin
  if v_role = 'alumni' and v_student_id is not null then
    select exists (
      select 1
      from public.student_roster r
      where r.student_id = v_student_id
        and lower(trim(r.name)) = lower(trim(v_name))
    ) into v_roster_match;
  end if;

  insert into public.profiles (
    id, name, email, role, department, batch_year, program, profile_image,
    phone, student_id, registration_status
  ) values (
    new.id,
    v_name,
    new.email,
    v_role,
    new.raw_user_meta_data->>'department',
    nullif(new.raw_user_meta_data->>'batch_year', '')::int,
    new.raw_user_meta_data->>'program',
    new.raw_user_meta_data->>'profile_image',
    new.raw_user_meta_data->>'phone',
    v_student_id,
    case
      when v_role <> 'alumni' then 'approved'
      when v_roster_match then 'approved'
      else 'pending'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

-- ---------------------------------------------------------------------
-- 3. One-time backfill (optional): re-check EXISTING pending alumni
-- against the roster and auto-approve any that now match, now that
-- you've imported it. Safe to re-run — only touches rows still
-- 'pending'. Skip/delete this block if you'd rather leave existing
-- pending accounts for manual review regardless.
-- ---------------------------------------------------------------------
update public.profiles p
set registration_status = 'approved', active = true
where p.role = 'alumni'
  and p.registration_status = 'pending'
  and p.student_id is not null
  and exists (
    select 1 from public.student_roster r
    where r.student_id = p.student_id
      and lower(trim(r.name)) = lower(trim(p.name))
  );

-- ---------------------------------------------------------------------
-- 4. Import the roster itself — replace with your registrar's actual
-- data (CSV export -> INSERT, or use Supabase Dashboard -> Table
-- Editor -> student_roster -> Import data from CSV once this file has
-- been run). Example shape:
--
-- insert into public.student_roster (student_id, name, department, program, batch_year) values
--   ('2023-2110585', 'Juan Dela Cruz', 'CSE', 'BSIT', 2023),
--   ('2022-2098231', 'Maria Santos', 'BAA', 'BSA', 2022)
-- on conflict (student_id) do update
--   set name = excluded.name,
--       department = excluded.department,
--       program = excluded.program,
--       batch_year = excluded.batch_year;
-- =====================================================================
