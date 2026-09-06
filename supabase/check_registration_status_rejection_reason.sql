-- =====================================================================
-- CHECK_REGISTRATION_STATUS — REJECTION REASON
--
-- AuthPage.tsx's status screen (shown after a rejected sign-in attempt,
-- or via the manual "Check registration status" link) called this RPC
-- but only ever got back `status` + `name` — a rejected alumnus had no
-- way to learn WHY, even though PendingRegistrations.tsx's Reject
-- action already collects an admin-entered reason
-- (alumni_tracer_intake.rejection_reason). Surface it here instead of
-- building a separate email-sending pipeline: this is the one place a
-- rejected account (which is signed out immediately and can never see
-- an in-app notification -- see AuthContext.tsx's login()) actually
-- reaches after being rejected.
--
-- The only writer of profiles.registration_status = 'rejected' is
-- tracer-intake's handleReview reject branch, which always sets
-- alumni_tracer_intake.rejection_reason and .linked_profile_id together
-- in the same update -- so the most recent rejected intake row linked
-- to this profile is always the right one to show. `reviewed_at desc`
-- (falling back to created_at) picks the latest if a profile somehow
-- accumulates more than one over time.
--
-- Changing the RETURNS TABLE column list isn't possible via a plain
-- CREATE OR REPLACE (Postgres: "cannot change return type of existing
-- function") — has to be dropped and recreated, so grants are
-- reapplied explicitly afterward (a DROP wipes them). PUBLIC (which
-- already implicitly covers anon/authenticated) had EXECUTE on the
-- original function -- deliberate, since this is called before login --
-- so anon/authenticated/service_role are re-granted explicitly here.
--
-- Run once via Supabase SQL Editor (or MCP apply_migration). Safe to
-- re-run: guarded DROP + CREATE + explicit re-grant every time.
-- =====================================================================

drop function if exists public.check_registration_status(text);

create function public.check_registration_status(p_email text)
returns table(status text, name text, rejection_reason text)
language sql
stable security definer
set search_path to 'public'
as $function$
  select
    coalesce(p.registration_status, 'approved') as status,
    p.name,
    (
      select ati.rejection_reason
      from public.alumni_tracer_intake ati
      where ati.linked_profile_id = p.id
        and ati.status = 'rejected'
      order by ati.reviewed_at desc nulls last, ati.created_at desc
      limit 1
    ) as rejection_reason
  from public.profiles p
  where lower(p.email) = lower(p_email)
  limit 1;
$function$;

grant execute on function public.check_registration_status(text) to anon, authenticated, service_role;
