-- =====================================================================
-- ALUMNI RECORDS — REQUIRED FIELDS  (pre-oral-defense panel request)
--
-- Full real name, course/program and batch (graduation) year are now
-- mandatory for every alumni record:
--
--   * Registration (Alumni Tracer Survey)  -> enforced in the form and in
--     the tracer-intake Edge Function.
--   * Roster (alumni_roster)               -> batch_year can no longer be
--     empty; the CSV importer rejects rows without one.
--   * Profiles                             -> a trigger below refuses an
--     alumni / batch-representative profile that lacks a real full name,
--     a program, or a batch year.
--
-- The trigger only inspects a row when it is being INSERTED, or when one
-- of those three columns is actually being changed — so legacy rows that
-- are still incomplete are not blocked from unrelated updates (approval,
-- deactivation, etc.). Use the "Incomplete records" filter in Alumni
-- Management to find and fix them, or run:
--     select id, name, email, program, batch_year
--     from public.profiles
--     where role in ('alumni','representative')
--       and (program is null or batch_year is null);
--
-- Safe to re-run.
-- =====================================================================

-- 1. Roster: batch_year required. NOT VALID = enforced for every new
--    insert/update, without failing on rows imported before this rule.
alter table public.alumni_roster
  drop constraint if exists alumni_roster_batch_year_required;
alter table public.alumni_roster
  add constraint alumni_roster_batch_year_required
  check (batch_year is not null) not valid;

-- 2. Profiles: required-field trigger.
create or replace function public.enforce_alumni_required_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parts text[];
  v_part text;
begin
  if new.role not in ('alumni', 'representative') then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.name is not distinct from old.name
     and new.program is not distinct from old.program
     and new.batch_year is not distinct from old.batch_year then
    return new;
  end if;

  -- Full real name: at least two words, each made of letters (plus
  -- . ' - ), no digits, and not an email address.
  v_parts := regexp_split_to_array(btrim(coalesce(new.name, '')), '\s+');
  if array_length(v_parts, 1) is null or array_length(v_parts, 1) < 2 or new.name like '%@%' then
    raise exception 'A full real name (first and last name) is required for alumni records.'
      using errcode = '23514';
  end if;
  foreach v_part in array v_parts loop
    if v_part !~ '^[[:alpha:]][[:alpha:].''’-]*$' then
      raise exception 'Name "%" contains characters that are not allowed in a real name.', new.name
        using errcode = '23514';
    end if;
  end loop;

  if nullif(btrim(coalesce(new.program, '')), '') is null then
    raise exception 'Course / program is required for alumni records.' using errcode = '23514';
  end if;

  if new.batch_year is null then
    raise exception 'Batch / graduation year is required for alumni records.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_alumni_required_fields on public.profiles;
create trigger enforce_alumni_required_fields
  before insert or update on public.profiles
  for each row execute function public.enforce_alumni_required_fields();

-- 3. Speeds up the Alumni Management batch / program grouping + the
--    "contact a whole batch" audience lookup.
create index if not exists profiles_batch_program_idx
  on public.profiles (batch_year, program)
  where role in ('alumni', 'representative');
