-- =====================================================================
-- EVENT REGISTRANT VISIBILITY
-- Admin and faculty need to see the full roster of who registered for
-- an event (name, role, department, batch, contact info) from the
-- Event Management / Events & Calendar screens. events and
-- event_registrations are already fully readable by everyone
-- (events_read_all, event_regs_read_all), so the registration rows
-- themselves aren't the problem — but the existing profiles policy
-- ("Faculty can view alumni in their department") only lets faculty
-- read alumni rows in their OWN department, and never representative
-- (batch rep) rows at all. That means a faculty account resolving
-- event_registrations.alumni_id -> profiles for a shared/college-wide
-- event, or for a batch rep who registered, would get rows silently
-- filtered out by RLS instead of showing the real registrant list.
--
-- This adds one narrow, additive SELECT policy: a faculty account may
-- read a profile (any role, any department) if that profile has at
-- least one row in event_registrations. It doesn't widen faculty
-- access to alumni management/tracer data — only to the identity of
-- people who voluntarily registered for an event, which faculty
-- already sees the existence of via the shared calendar's registrant
-- counts.
--
-- Safe to re-run: the policy is dropped-if-exists before creating.
-- =====================================================================

drop policy if exists "Faculty can view event registrant profiles" on public.profiles;
create policy "Faculty can view event registrant profiles"
  on public.profiles for select
  using (
    current_user_role() = 'faculty'
    and exists (
      select 1 from public.event_registrations er
      where er.alumni_id = profiles.id
    )
  );
