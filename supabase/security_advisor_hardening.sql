-- =====================================================================
-- SECURITY ADVISOR HARDENING
--
-- Three narrow fixes surfaced by Supabase's own security advisor
-- (mcp get_advisors), each verified against how the frontend actually
-- calls these functions before changing anything, so nothing already
-- working breaks:
--
-- 1. set_updated_at() had no `search_path` pinned, unlike every other
--    function in this schema (they all set `SET search_path TO
--    'public'`). Low real risk here (it only does `new.updated_at =
--    now()`), but there's no reason for it to be the one inconsistent
--    function, and a mutable search_path is exactly the kind of thing
--    that turns into a real hijack risk the moment someone adds an
--    unqualified reference to this function later.
--
-- 2. release_scheduled_campaigns() flips a donation campaign's `active`
--    flag to true once its `release_date` has passed. It's meant to be
--    driven by a cron job (see the comment in
--    src/app/components/shared/DonationContext.tsx), but had no
--    internal auth check and was directly callable by anyone —
--    including a signed-out visitor — via
--    /rest/v1/rpc/release_scheduled_campaigns. Grep of src/ confirms
--    nothing in the frontend calls it directly, so revoking EXECUTE
--    from anon/authenticated removes public access with zero feature
--    impact; a service_role-driven cron job is unaffected (it isn't
--    subject to these grants).
--
-- 3. log_audit() writes into public.audit_logs (the admin's Audit Logs
--    screen) with no role check at all — any signed-in account, alumni
--    included, could call supabase.rpc('log_audit', {...}) directly
--    with fully attacker-controlled action/module/details/severity
--    text, independent of the app's own UI. Grep of src/ shows the
--    *legitimate* callers are admin (BatchRepresentatives.tsx,
--    TracerSurveys.tsx), representative (RepresentativeDashboard.tsx),
--    and faculty (FacultyTracerSurveys.tsx) — never an alumni-facing
--    screen. This adds that same restriction inside the function
--    itself (the only place it can actually be enforced), so the
--    existing call sites keep working unchanged and a plain alumni
--    account can no longer forge entries in the security audit trail.
--
-- Deliberately NOT touched here (reported separately, not fixed
-- automatically — each is a product/design tradeoff, not a plain bug):
--   - notify_role() accepts fully free-text title/message and can
--     target 'admin' from an alumni account by design (see
--     DonationPortal.tsx's donation-submitted notice) — closing the
--     free-text/phishing angle without breaking that feature needs an
--     actual design decision, not a one-line grant change.
--   - record_login_attempt() / check_device() / trust_device() and the
--     policy-less login_attempts table: none of these are called from
--     anywhere in src/ today. The brute-force-lockout/device-trust
--     feature they implement exists in the database but was never
--     wired into AuthContext.tsx's login() — it currently does
--     nothing either way.
--   - auth_leaked_password_protection is a Supabase Auth *project
--     setting* (Dashboard -> Authentication -> Policies), not
--     something expressible as SQL here.
--
-- Safe to re-run: CREATE OR REPLACE + idempotent REVOKE/GRANT.
-- =====================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = 'public'
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

revoke execute on function public.release_scheduled_campaigns() from public, anon, authenticated;

create or replace function public.log_audit(
  p_action text, p_module text, p_details text default null, p_severity text default 'Low'
)
returns void
language plpgsql
security definer
set search_path = 'public'
as $function$
begin
  -- coalesce(), not a bare `current_user_role() not in (...)`: for an
  -- anonymous caller (no session, current_user_role() returns null)
  -- `null not in (...)` evaluates to null/"unknown" in SQL, which
  -- plpgsql's `if` treats as false and would silently let the check
  -- pass — exactly the anon-callable gap the advisor flagged in the
  -- first place. Coalescing to '' makes that case correctly no match
  -- and raise, same as any other disallowed role.
  if coalesce(public.current_user_role(), '') not in ('admin', 'faculty', 'representative') then
    raise exception 'Only an admin, faculty, or batch representative account can write to the audit log.';
  end if;

  insert into public.audit_logs (actor_id, actor_role, action, module, details, severity)
  values (auth.uid(), public.current_user_role(), p_action, p_module, p_details, coalesce(p_severity, 'Low'));
end;
$function$;
