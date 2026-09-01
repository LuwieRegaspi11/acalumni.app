-- =====================================================================
-- NOTIFICATION RPC HARDENING + REPRESENTATIVE PROFILE-EDIT SCOPE GUARD
-- Run once in the Supabase SQL editor (or via the Supabase MCP/CLI).
--
-- Found during a full role-permissions scan (2026-08-31).
--
-- 1. notify_role() / notify_user() are SECURITY DEFINER functions with
--    NO authorization check at all. Because Supabase exposes every
--    public function as a PostgREST RPC endpoint, anyone who has the
--    app's public anon key (which is, by design, visible in the
--    browser bundle -- see .env) could call
--      POST /rest/v1/rpc/notify_role   { p_role: 'admin', p_title: '...', p_message: '...' }
--      POST /rest/v1/rpc/notify_user   { p_user_id: '<any uuid>', p_title: '...', p_message: '...' }
--    with NO session/login at all and blast arbitrary (phishing-capable)
--    notification text at every account of a role, or at one specific
--    account. Legitimate callers (NotificationContext.tsx's `trigger`)
--    are always signed in first -- an alumnus/rep submitting a donation
--    notifies admin/faculty, and admin/faculty reviewing a
--    registration/donation or publishing an event notifies a specific
--    alumnus or a whole role -- so requiring auth.uid() is not null
--    closes the anonymous attack surface without breaking any real
--    flow. notify_user's actual callers (PendingRegistrations.tsx,
--    DonationManagementView.tsx) are additionally always admin/faculty,
--    so that one is narrowed further to staff-only.
--
-- 2. "Representatives can verify their assigned batch" (profiles UPDATE
--    policy) scopes WHICH ROWS a rep may touch (their assigned batch's
--    alumni) but RLS can't restrict WHICH COLUMNS -- nothing stopped a
--    rep from crafting a raw PATCH request that rewrites an alumnus's
--    name/email/department/batch_year/etc. instead of just the
--    batch_verified* columns the "Verify Batch Mate" button actually
--    sets (see RepresentativeDashboard.tsx's handleVerify). This mirrors
--    the same class of gap closed for role/assignment fields by
--    guard_representative_assignment() in
--    batch_representative_assignment_guard.sql -- same fix, different
--    columns: a BEFORE UPDATE trigger that, for a non-admin editing
--    someone else's row, only allows batch_verified/batch_verified_by/
--    batch_verified_at to change.
-- =====================================================================

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
  if p_role not in ('admin', 'alumni', 'faculty', 'representative') then
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
  if not (public.is_admin() or public.is_faculty()) then
    raise exception 'not authorized';
  end if;

  insert into public.notifications (user_id, title, message, type)
  values (p_user_id, p_title, p_message, p_type);
end;
$$;

-- Belt-and-suspenders on top of the in-function checks above: the anon
-- (never-signed-in) role has no legitimate reason to call either RPC.
-- Note: Postgres grants EXECUTE to the PUBLIC pseudo-role by default when
-- a function is created, and every role (anon included) implicitly holds
-- PUBLIC's privileges -- so this has to revoke from PUBLIC itself, not
-- just from anon, or anon keeps executing it via that inherited grant.
revoke execute on function public.notify_role(text, text, text, text, text) from public;
revoke execute on function public.notify_user(uuid, text, text, text) from public;
grant execute on function public.notify_role(text, text, text, text, text) to authenticated;
grant execute on function public.notify_user(uuid, text, text, text) to authenticated;

create or replace function public.guard_representative_profile_edit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Trust direct DB connections (SQL Editor, CLI migrations, service-role
  -- jobs) same as the sibling guards in registration_status_guard.sql /
  -- batch_representative_assignment_guard.sql.
  if auth.role() is null or auth.role() = 'service_role' then
    return new;
  end if;

  -- Admins may edit any field on any profile. Self-updates go through
  -- ProfilePage/AuthContext.updateProfile, an already-narrow allowlist
  -- of a person's own fields -- leave those alone here.
  if public.is_admin() or new.id = auth.uid() then
    return new;
  end if;

  -- Anyone else reaching this point is a representative updating a
  -- *different* alumnus's row via the "Representatives can verify their
  -- assigned batch" policy. Only the 3 verification columns may change;
  -- diffing the rows as jsonb (rather than hardcoding every other column)
  -- keeps this correct automatically as columns are added later.
  if (to_jsonb(new) - 'batch_verified' - 'batch_verified_by' - 'batch_verified_at')
     is distinct from
     (to_jsonb(old) - 'batch_verified' - 'batch_verified_by' - 'batch_verified_at')
  then
    raise exception 'A batch representative can only update batch_verified, batch_verified_by, and batch_verified_at on another alumnus''s profile.';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_representative_profile_edit on public.profiles;
create trigger guard_representative_profile_edit
  before update on public.profiles
  for each row execute function public.guard_representative_profile_edit();
