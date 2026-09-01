-- =====================================================================
-- DONATION CAMPAIGNS / EXPENSES — SCOPED VIEW ACCESS
-- Found during a role-permissions audit (2026-09-01), same class of gap
-- already closed for announcements (announcements_scoped_rls) and job
-- postings (job_postings_scoped_rls): `campaigns_select_all` and
-- `campaign_expenses_select_all` were `using (true)` — ANY signed-in
-- account (alumni, representative, faculty of another department) could
-- read EVERY department's campaigns and expense ledgers, not just the
-- ones meant for them. There was no RLS gap on the *write* side by the
-- time this ran (see faculty_campaign_department_scope.sql), only read.
--
-- New rule, matching the announcements/job_postings precedent exactly:
--   - Admin: unrestricted, sees every campaign/expense regardless of department.
--   - A department-specific campaign (department <> 'All') is visible only to:
--       * admin,
--       * faculty of that same department (their "full access, own
--         department only" already applies to writes; this is the read
--         side of the same boundary),
--       * alumni whose own department matches,
--       * batch representatives whose *assigned* department matches
--         (current_user_job_department() resolves to assigned_department
--         for role='representative', department for everyone else — the
--         same helper announcements/job_postings already rely on).
--   - A college-wide campaign (department = 'All', e.g. admin-posted) stays
--     visible to everyone, same as before.
-- campaign_expenses has no department column of its own — it inherits
-- visibility from its parent campaign's department via the same rule.
--
-- Safe to re-run: every statement drops-if-exists before creating.
-- =====================================================================

drop policy if exists "campaigns_select_all" on public.donation_campaigns;

create policy "campaigns_select_scoped"
  on public.donation_campaigns for select
  using (
    is_admin()
    or department = 'All'
    or department = current_user_job_department()
  );

drop policy if exists "campaign_expenses_select_all" on public.campaign_expenses;

create policy "campaign_expenses_select_scoped"
  on public.campaign_expenses for select
  using (
    exists (
      select 1 from public.donation_campaigns c
      where c.id = campaign_expenses.campaign_id
        and (
          is_admin()
          or c.department = 'All'
          or c.department = current_user_job_department()
        )
    )
  );
