-- =====================================================================
-- BATCH REPRESENTATIVE OFFERS
--
-- Promoting an alumnus to batch representative is now an OFFER the alumnus
-- accepts or declines, instead of the admin flipping their role directly:
--
--   1. Admin picks an alumnus  -> offer_batch_rep(alumni_id)
--        * a pending row in public.rep_offers
--        * an in-app notification for the alumnus (linked to the offer, so
--          the bell panel / popup can show Accept + Decline buttons)
--   2. Alumnus responds        -> respond_to_rep_offer(offer_id, accept)
--        * Accept : role becomes 'representative' with the offered batch /
--                   department / program (any previous rep for that exact
--                   combination goes back to alumni)
--        * Decline: nothing changes, they stay an alumnus
--        * Either way every admin is notified and the action is audit-logged.
--
-- Run after remove_faculty_role.sql. Safe to re-run.
-- =====================================================================

-- 1. Offers table -------------------------------------------------------
create table if not exists public.rep_offers (
  id            uuid primary key default gen_random_uuid(),
  alumni_id     uuid not null references public.profiles(id) on delete cascade,
  batch_year    integer not null,
  department    text not null,
  program       text not null,
  status        text not null default 'pending'
                check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  offered_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  responded_at  timestamptz
);

create index if not exists rep_offers_alumni_status_idx on public.rep_offers (alumni_id, status);

alter table public.rep_offers enable row level security;

-- An alumnus sees only their own offers; the admin sees and manages all.
drop policy if exists "rep_offers_select_own_or_admin" on public.rep_offers;
create policy "rep_offers_select_own_or_admin"
  on public.rep_offers for select
  using (alumni_id = auth.uid() or public.is_admin());

drop policy if exists "rep_offers_admin_write" on public.rep_offers;
create policy "rep_offers_admin_write"
  on public.rep_offers for all
  using (public.is_admin())
  with check (public.is_admin());

-- 2. Link a notification to its offer ----------------------------------
alter table public.notifications
  add column if not exists offer_id uuid references public.rep_offers(id) on delete cascade;

-- 3. Let the accept function through the role guard ---------------------
-- guard_representative_assignment() blocks every non-admin from changing
-- role / assigned_*. respond_to_rep_offer() runs as the alumnus (it still
-- sees their JWT), so it flags its own transaction; set_config is not
-- callable through the API, only from inside database functions.
create or replace function public.guard_representative_assignment()
returns trigger
language plpgsql
set search_path = 'public'
as $function$
begin
  if auth.role() is null or auth.role() = 'service_role' then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  -- Set only by respond_to_rep_offer() for an accepted, admin-issued offer.
  if current_setting('app.rep_offer_accept', true) = '1' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role = 'representative'
       or new.assigned_batch_year is not null
       or new.assigned_department is not null
       or new.assigned_program is not null then
      raise exception 'Only an admin can assign the representative role or a batch assignment.';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.role is distinct from old.role
       or new.assigned_batch_year is distinct from old.assigned_batch_year
       or new.assigned_department is distinct from old.assigned_department
       or new.assigned_program is distinct from old.assigned_program
       or new.assigned_at is distinct from old.assigned_at then
      raise exception 'Only an admin can change role or representative assignment fields.';
    end if;
  end if;

  return new;
end;
$function$;

-- The rep-edit guard would otherwise refuse the demotion of the previous
-- representative (a "different alumnus's row" edited by a non-admin).
create or replace function public.guard_representative_profile_edit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() is null or auth.role() = 'service_role' then
    return new;
  end if;
  if public.is_admin() or new.id = auth.uid() then
    return new;
  end if;
  if current_setting('app.rep_offer_accept', true) = '1' then
    return new;
  end if;
  if (to_jsonb(new) - 'batch_verified' - 'batch_verified_by' - 'batch_verified_at')
     is distinct from
     (to_jsonb(old) - 'batch_verified' - 'batch_verified_by' - 'batch_verified_at')
  then
    raise exception 'A batch representative can only update batch_verified, batch_verified_by, and batch_verified_at on another alumnus''s profile.';
  end if;
  return new;
end;
$$;

-- Live updates for the admin's offers table (ignore if already added).
do $$
begin
  alter publication supabase_realtime add table public.rep_offers;
exception when duplicate_object or undefined_object then null;
end
$$;

-- 4. Admin sends an offer -----------------------------------------------
create or replace function public.offer_batch_rep(p_alumni_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alumnus public.profiles%rowtype;
  v_offer uuid;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can offer the batch representative role.';
  end if;

  select * into v_alumnus from public.profiles where id = p_alumni_id;
  if not found then
    raise exception 'Alumnus not found.';
  end if;
  if v_alumnus.role <> 'alumni' then
    raise exception '% is already a % account.', v_alumnus.name, v_alumnus.role;
  end if;
  if v_alumnus.registration_status is distinct from 'approved' or v_alumnus.active = false then
    raise exception '% must be an approved, active alumni account before being offered the role.', v_alumnus.name;
  end if;
  if v_alumnus.batch_year is null or coalesce(v_alumnus.department, '') = '' or coalesce(v_alumnus.program, '') = '' then
    raise exception 'This profile is missing a batch year, department or program — complete it before making an offer.';
  end if;

  -- Only one open offer per alumnus.
  update public.rep_offers set status = 'cancelled', responded_at = now()
   where alumni_id = p_alumni_id and status = 'pending';

  insert into public.rep_offers (alumni_id, batch_year, department, program, offered_by)
  values (p_alumni_id, v_alumnus.batch_year, v_alumnus.department, v_alumnus.program, auth.uid())
  returning id into v_offer;

  insert into public.notifications (user_id, title, message, type, offer_id)
  values (
    p_alumni_id,
    'Batch Representative Offer',
    format('The Alumni Head would like you to be the batch representative for Batch %s · %s · %s. Do you accept?',
           v_alumnus.batch_year, v_alumnus.department, v_alumnus.program),
    'info',
    v_offer
  );

  begin  -- the audit trail must never block an offer
    insert into public.audit_logs (actor_id, actor_role, action, module, details, severity)
    values (auth.uid(), 'admin', format('Offered %s the batch representative role', v_alumnus.name),
            'Batch Representatives',
            format('Batch %s · %s · %s', v_alumnus.batch_year, v_alumnus.department, v_alumnus.program), 'Medium');
  exception when others then null;
  end;

  return v_offer;
end;
$$;

-- 5. Alumnus accepts / declines -----------------------------------------
create or replace function public.respond_to_rep_offer(p_offer_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.rep_offers%rowtype;
  v_name text;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  select * into v_offer from public.rep_offers
   where id = p_offer_id and alumni_id = auth.uid() and status = 'pending'
   for update;
  if not found then
    raise exception 'This offer is no longer available.';
  end if;

  select name into v_name from public.profiles where id = auth.uid();

  if p_accept then
    perform set_config('app.rep_offer_accept', '1', true);  -- transaction-local

    -- One representative per batch + department + program: the previous
    -- holder (if any) goes back to being an alumnus.
    update public.profiles
       set role = 'alumni', assigned_batch_year = null, assigned_department = null,
           assigned_program = null, assigned_at = null
     where role = 'representative'
       and assigned_batch_year = v_offer.batch_year
       and assigned_department = v_offer.department
       and assigned_program = v_offer.program
       and id <> auth.uid();

    update public.profiles
       set role = 'representative',
           assigned_batch_year = v_offer.batch_year,
           assigned_department = v_offer.department,
           assigned_program = v_offer.program,
           assigned_at = now()
     where id = auth.uid();

    perform set_config('app.rep_offer_accept', '0', true);
    v_status := 'accepted';
  else
    v_status := 'rejected';
  end if;

  update public.rep_offers set status = v_status, responded_at = now() where id = p_offer_id;
  update public.notifications set read = true where offer_id = p_offer_id and user_id = auth.uid();

  -- Tell every admin what the alumnus decided.
  insert into public.notifications (user_id, title, message, type)
  select a.id,
         case when p_accept then 'Batch Representative Offer Accepted' else 'Batch Representative Offer Declined' end,
         format('%s %s the offer to be batch representative for Batch %s · %s · %s.',
                coalesce(v_name, 'An alumnus'),
                case when p_accept then 'accepted' else 'declined' end,
                v_offer.batch_year, v_offer.department, v_offer.program),
         case when p_accept then 'success' else 'warning' end
    from public.profiles a
   where a.role = 'admin';

  begin  -- the audit trail must never block the response
    insert into public.audit_logs (actor_id, actor_role, action, module, details, severity)
    values (auth.uid(), case when p_accept then 'representative' else 'alumni' end,
            format('%s %s the batch representative offer', coalesce(v_name, 'An alumnus'),
                   case when p_accept then 'accepted' else 'declined' end),
            'Batch Representatives',
            format('Batch %s · %s · %s', v_offer.batch_year, v_offer.department, v_offer.program), 'Medium');
  exception when others then null;
  end;

  return v_status;
end;
$$;

revoke execute on function public.offer_batch_rep(uuid) from public, anon;
revoke execute on function public.respond_to_rep_offer(uuid, boolean) from public, anon;
grant execute on function public.offer_batch_rep(uuid) to authenticated;
grant execute on function public.respond_to_rep_offer(uuid, boolean) to authenticated;
