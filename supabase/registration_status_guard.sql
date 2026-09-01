-- =====================================================================
-- REGISTRATION STATUS / ACCOUNT ACTIVE GUARD
--
-- Context: the Pending Account Approval feature (registration_status
-- column on public.profiles, default 'pending'; PendingApprovalPage.tsx;
-- admin/PendingRegistrations.tsx approve/reject UI; the pending-status
-- redirect in App.tsx's ProtectedRoute) already exists end-to-end.
--
-- The gap this file closes: same class of issue as
-- batch_representative_assignment_guard.sql. "Users can update their
-- own profile" only checks `using (auth.uid() = id)` for UPDATE, with
-- no WITH CHECK, so Postgres RLS reuses that USING expression for the
-- new row too and only re-verifies row ownership — not which columns
-- changed. AuthContext.tsx's updateProfile() never sends
-- registration_status or active, but nothing server-side stopped a
-- signed-in user from calling the Supabase REST API directly to PATCH
-- their own profiles row with registration_status: 'approved' (or
-- 'active: true'), bypassing admin approval entirely. Declarative RLS
-- can't express "did this specific column change" (can't compare
-- against the row's previous value), so — matching the established
-- pattern in batch_representative_assignment_guard.sql — this uses a
-- BEFORE INSERT OR UPDATE trigger instead.
--
-- What's protected: registration_status and active, for requests
-- coming through PostgREST as an ordinary signed-in user
-- (auth.role() = 'authenticated') who isn't an admin. Admins
-- (is_admin() = true), the service_role key, and direct DB connections
-- (SQL Editor, CLI migrations, the handle_new_user() signup trigger,
-- which runs as the trigger owner not as the end user) are unaffected.
--
-- What's deliberately NOT touched: every other self-editable profile
-- field (name, phone, department, program, employment_status, etc.)
-- and the separate guard_representative_assignment trigger/policies —
-- out of scope for this change.
--
-- Safe to re-run: function is CREATE OR REPLACE; trigger is dropped
-- and recreated. Purely additive — no data is changed, no existing
-- policy, table, or trigger is altered or dropped.
-- =====================================================================

create or replace function public.guard_registration_status()
returns trigger
language plpgsql
set search_path = 'public'
as $function$
begin
  -- Trust direct DB connections (SQL Editor, CLI migrations, the
  -- handle_new_user() signup trigger, backend jobs authenticated with
  -- the service_role key) — not PostgREST end-user requests.
  if auth.role() is null or auth.role() = 'service_role' then
    return new;
  end if;

  -- Admins may freely approve/reject registrations and (de)activate
  -- accounts via the existing PendingRegistrations.tsx / user
  -- management UI.
  if public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.registration_status is not null and new.registration_status <> 'pending' then
      raise exception 'Only an admin can set registration status to anything other than pending.';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.registration_status is distinct from old.registration_status
       or new.active is distinct from old.active then
      raise exception 'Only an admin can change registration status or account active state.';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists guard_registration_status on public.profiles;
create trigger guard_registration_status
  before insert or update on public.profiles
  for each row
  execute function public.guard_registration_status();
