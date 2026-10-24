-- =====================================================================
-- REMOVE THE FACULTY ROLE  (pre-oral-defense panel request)
--
-- The Alumni Head (role = 'admin') is now the only account that manages
-- the system. This migration:
--
--   1. Refuses to run while any profile still has role = 'faculty'
--      (see the check below) — it never deletes accounts on its own.
--   2. Replaces the profiles.role CHECK so it allows only
--      'admin' | 'alumni' | 'representative'.
--   3. Drops every RLS policy that exists only for faculty (their names
--      all contain "faculty"), and rewrites any remaining policy that
--      mentions 'faculty' so the role is simply gone from it.
--   4. Re-creates the helper RPCs that still referenced the role
--      (notify_role, notify_user, log_audit) and retires is_faculty().
--
-- BEFORE YOU RUN IT: if the guard below stops with "N faculty
-- profile(s) still exist", either delete those users in
-- Dashboard -> Authentication -> Users (profiles cascade), or re-assign
-- them first, e.g.
--     update public.profiles set role = 'alumni' where role = 'faculty';
-- then run this file again.
--
-- Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Guard — never silently orphan or delete real accounts.
-- ---------------------------------------------------------------------
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.profiles where role = 'faculty';
  if v_count > 0 then
    raise exception
      '% faculty profile(s) still exist. Delete or re-assign them first (see the header of remove_faculty_role.sql), then re-run.',
      v_count;
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 1. profiles.role CHECK — drop whatever the live constraint is called
--    (it was created inline, so its name is auto-generated) and add a
--    named one without 'faculty'.
-- ---------------------------------------------------------------------
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
      and pg_get_constraintdef(oid) ilike '%alumni%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end
$$;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'alumni', 'representative'));

-- ---------------------------------------------------------------------
-- 2. RLS policies.
--    a) Faculty-only policies: dropped outright.
--    b) Any other policy whose USING / WITH CHECK still mentions
--       'faculty': strip it from IN-lists and turn
--       "current_user_role() = 'faculty'" into "false". Policies that
--       still mention it after that are reported in a NOTICE so you can
--       review them by hand (none are expected).
-- ---------------------------------------------------------------------
do $$
declare
  p record;
  v_using text;
  v_check text;
begin
  -- a) faculty-only policies
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and policyname ilike '%faculty%'
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    raise notice 'Dropped faculty policy % on %.%', p.policyname, p.schemaname, p.tablename;
  end loop;

  -- b) shared policies that still list the role
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ilike '%faculty%' or coalesce(with_check, '') ilike '%faculty%')
  loop
    v_using := p.qual;
    v_check := p.with_check;

    if v_using is not null then
      v_using := regexp_replace(v_using, ',\s*''faculty''::text', '', 'g');
      v_using := regexp_replace(v_using, '''faculty''::text\s*,\s*', '', 'g');
      v_using := regexp_replace(v_using, 'current_user_role\(\)\s*=\s*''faculty''::text', 'false', 'g');
    end if;
    if v_check is not null then
      v_check := regexp_replace(v_check, ',\s*''faculty''::text', '', 'g');
      v_check := regexp_replace(v_check, '''faculty''::text\s*,\s*', '', 'g');
      v_check := regexp_replace(v_check, 'current_user_role\(\)\s*=\s*''faculty''::text', 'false', 'g');
    end if;

    if coalesce(v_using, '') ilike '%faculty%' or coalesce(v_check, '') ilike '%faculty%' then
      raise notice 'REVIEW BY HAND: policy % on %.% still mentions faculty', p.policyname, p.schemaname, p.tablename;
    else
      if v_using is not null and v_check is not null then
        execute format('alter policy %I on %I.%I using (%s) with check (%s)',
          p.policyname, p.schemaname, p.tablename, v_using, v_check);
      elsif v_using is not null then
        execute format('alter policy %I on %I.%I using (%s)',
          p.policyname, p.schemaname, p.tablename, v_using);
      else
        execute format('alter policy %I on %I.%I with check (%s)',
          p.policyname, p.schemaname, p.tablename, v_check);
      end if;
      raise notice 'Rewrote policy % on %.% without faculty', p.policyname, p.schemaname, p.tablename;
    end if;
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- 3. Helper RPCs that still referenced the role.
-- ---------------------------------------------------------------------
create or replace function public.notify_role(
  p_role text, p_title text, p_message text, p_type text default 'info', p_department text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;
  if p_role not in ('admin', 'alumni', 'representative') then
    raise exception 'invalid role';
  end if;

  insert into public.notifications (user_id, title, message, type)
  select p.id, p_title, p_message, p_type
  from public.profiles p
  where p.role = p_role
    and (
      p_department is null
      or p.department = p_department
      or p.assigned_department = p_department
    );
end;
$$;

create or replace function public.notify_user(
  p_user_id uuid, p_title text, p_message text, p_type text default 'info'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  insert into public.notifications (user_id, title, message, type)
  values (p_user_id, p_title, p_message, p_type);
end;
$$;

revoke execute on function public.notify_role(text, text, text, text, text) from public;
revoke execute on function public.notify_user(uuid, text, text, text) from public;
grant execute on function public.notify_role(text, text, text, text, text) to authenticated;
grant execute on function public.notify_user(uuid, text, text, text) to authenticated;

create or replace function public.log_audit(
  p_action text, p_module text, p_details text default null, p_severity text default 'Low'
)
returns void
language plpgsql
security definer
set search_path = 'public'
as $function$
begin
  if coalesce(public.current_user_role(), '') not in ('admin', 'representative') then
    raise exception 'Only an admin or batch representative account can write to the audit log.';
  end if;

  insert into public.audit_logs (actor_id, actor_role, action, module, details, severity)
  values (auth.uid(), public.current_user_role(), p_action, p_module, p_details, coalesce(p_severity, 'Low'));
end;
$function$;

-- is_faculty() is no longer used anywhere. Drop it; if some object we
-- don't know about still depends on it, keep a stub that always says
-- "no" so nothing breaks.
do $$
begin
  begin
    drop function if exists public.is_faculty();
  exception when dependent_objects_still_exist then
    create or replace function public.is_faculty()
    returns boolean language sql stable security definer set search_path = public
    as 'select false';
    raise notice 'is_faculty() is still referenced by another object; replaced with a stub that returns false.';
  end;
end
$$;

-- ---------------------------------------------------------------------
-- 4. Faculty-only leftovers.
--    profiles.position was the faculty job title (alumni use
--    current_position), and nothing in the app reads it any more.
-- ---------------------------------------------------------------------
alter table public.profiles drop column if exists position;

-- ---------------------------------------------------------------------
-- 5. Final sweep — report anything in the live database that still
--    mentions the role, so nothing is left behind unnoticed. Expect no
--    "STILL MENTIONS FACULTY" lines; if one appears, open that object and
--    remove the faculty branch by hand.
-- ---------------------------------------------------------------------
do $$
declare
  r record;
  v_found boolean := false;
begin
  for r in
    select p.proname as name
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ilike '%faculty%'
  loop
    v_found := true;
    raise notice 'STILL MENTIONS FACULTY: function public.%', r.name;
  end loop;

  for r in
    select policyname, tablename from pg_policies
    where schemaname in ('public', 'storage')
      and (policyname ilike '%faculty%' or coalesce(qual, '') ilike '%faculty%' or coalesce(with_check, '') ilike '%faculty%')
  loop
    v_found := true;
    raise notice 'STILL MENTIONS FACULTY: policy % on %', r.policyname, r.tablename;
  end loop;

  for r in
    select conrelid::regclass as tbl, conname from pg_constraint
    where connamespace = 'public'::regnamespace and pg_get_constraintdef(oid) ilike '%faculty%'
  loop
    v_found := true;
    raise notice 'STILL MENTIONS FACULTY: constraint % on %', r.conname, r.tbl;
  end loop;

  if not v_found then
    raise notice 'Faculty role fully removed: no functions, policies or constraints mention it.';
  end if;
end
$$;
