-- =====================================================================
-- BATCH REPRESENTATIVE ASSIGNMENT GUARD
--
-- Context: batch_year (an alumnus's own graduation year) and the
-- assigned_batch_year / assigned_department / assigned_program /
-- assigned_at columns (which batch a representative is assigned to)
-- already exist on public.profiles (see schema.sql), and the Batch
-- Representatives admin page (src/app/components/admin/
-- BatchRepresentatives.tsx) already assigns/reassigns/removes reps by
-- writing role='representative' + those assigned_* columns. So does the
-- "Admins can update all profiles" RLS policy (using is_admin()) that
-- already exists on this project.
--
-- The gap this file closes: "Users can update their own profile" only
-- checks `using (auth.uid() = id)` for UPDATE, with no WITH CHECK. In
-- Postgres RLS, an UPDATE policy with no WITH CHECK reuses the USING
-- expression for the check on the new row too — which still only
-- verifies row ownership, not which columns changed. That means any
-- signed-in alumni could bypass the admin-only UI entirely and call the
-- Supabase REST API directly to PATCH their own profiles row with
-- role: 'representative' plus any assigned_batch_year/department/
-- program they like, self-assigning the role. Declarative RLS can't
-- fix this on its own (a policy's USING/WITH CHECK can't compare
-- against the *previous* value of a column), so this uses a BEFORE
-- INSERT OR UPDATE trigger instead, which can see OLD vs NEW.
--
-- What's protected: role, assigned_batch_year, assigned_department,
-- assigned_program, assigned_at, for requests coming through PostgREST
-- as an ordinary signed-in user (auth.role() = 'authenticated') who
-- isn't an admin. Admins (is_admin() = true), the service_role key,
-- and direct DB connections (SQL Editor, CLI migrations) are
-- unaffected — they can still assign/reassign/remove representatives,
-- or run scripts like admin_reassignment.sql, exactly as today.
--
-- What's deliberately NOT touched: `batch_year` itself (an alumnus's
-- own graduation year — legitimately self-editable via the normal
-- Profile page/ProfileUpdate flow in AuthContext.tsx, and never written
-- by the assignment flow) and `batch_verified` / `batch_verified_by`
-- (governed by the separate "Representatives can verify their assigned
-- batch" policy — out of scope for this change; don't touch unrelated
-- policies).
--
-- Safe to re-run: function is CREATE OR REPLACE; trigger is dropped
-- and recreated. Purely additive — no data is changed, no existing
-- policy or table is altered or dropped.
-- =====================================================================

create or replace function public.guard_representative_assignment()
returns trigger
language plpgsql
set search_path = 'public'
as $function$
begin
  -- Trust direct DB connections (Supabase SQL Editor, CLI migrations,
  -- backend jobs authenticated with the service_role key) — these
  -- aren't PostgREST end-user requests, they already require full
  -- database/service credentials to reach at all, and scripts like
  -- admin_reassignment.sql need to be able to write `role` directly.
  -- auth.role() is null for a plain DB connection (no JWT in scope)
  -- and 'service_role' for the service key; ordinary signed-in users
  -- coming through the app are 'authenticated'.
  if auth.role() is null or auth.role() = 'service_role' then
    return new;
  end if;

  -- Admins may freely assign/reassign/remove representatives.
  if public.is_admin() then
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

drop trigger if exists guard_representative_assignment on public.profiles;
create trigger guard_representative_assignment
  before insert or update on public.profiles
  for each row
  execute function public.guard_representative_assignment();
