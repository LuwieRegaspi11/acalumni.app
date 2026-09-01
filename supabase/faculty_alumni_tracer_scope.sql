-- =====================================================================
-- FACULTY ALUMNI & TRACER SCOPE
-- Gives faculty accounts the same Alumni Management / Tracer Surveys /
-- Tracer Responses capabilities admin has, scoped to their own
-- department (profiles.department) — mirrors the department-scoping
-- pattern already used for donations (see
-- faculty_campaign_department_scope.sql) and reuses its helper
-- functions (current_user_role(), current_user_department(), is_admin()).
--
-- Prior to this migration:
--   - profiles had a faculty SELECT policy ("Faculty can view alumni in
--     their department") but NO faculty UPDATE policy, so faculty could
--     view but never edit/verify alumni.
--   - graduate_tracer_responses (the Graduate Tracer Survey table, see
--     graduate_tracer_survey.sql) had no faculty policy at all — only
--     the respondent themselves and admins could read it.
--   - tracer_surveys allowed everyone to SELECT (tracer_surveys_select_all)
--     but only admins to write (tracer_surveys_write_admin), so faculty
--     could never create/deploy/close their own surveys.
--
-- Safe to re-run: every policy is dropped-if-exists before creating.
-- =====================================================================

-- ---- profiles: faculty can edit/verify alumni in their own department ----
-- `with check` mirrors `using` exactly, so a faculty account can never use
-- this policy to move a row to a different department or change its role
-- away from 'alumni' — the resulting row must still satisfy both
-- conditions. role/assigned_* changes are additionally blocked outright
-- for any non-admin by the existing guard_representative_assignment
-- trigger (batch_representative_assignment_guard.sql), which runs
-- regardless of which RLS policy allowed the UPDATE.
drop policy if exists "Faculty can update alumni in their department" on public.profiles;
create policy "Faculty can update alumni in their department"
  on public.profiles for update
  using (current_user_role() = 'faculty' and role = 'alumni' and department = current_user_department())
  with check (current_user_role() = 'faculty' and role = 'alumni' and department = current_user_department());

-- ---- graduate_tracer_responses: faculty can view responses from their department ----
-- Same join shape as the existing tracer_responses_select_scoped policy
-- on tracer_survey_responses (the legacy survey table) — kept as an
-- explicit EXISTS/join rather than the current_user_department() helper
-- so it reads identically to that precedent.
drop policy if exists "Faculty can view tracer responses in their department" on public.graduate_tracer_responses;
create policy "Faculty can view tracer responses in their department"
  on public.graduate_tracer_responses for select
  using (exists (
    select 1 from public.profiles me
    join public.profiles resp on resp.id = graduate_tracer_responses.respondent_id
    where me.id = auth.uid() and me.role = 'faculty' and resp.department = me.department
  ));

-- ---- tracer_surveys: faculty can create/deploy/close surveys for their own department ----
-- Mirrors campaigns_write_faculty_own_dept in faculty_campaign_department_scope.sql.
-- `with check` requires target_dept = current_user_department(), so a
-- faculty account can never create (or edit into) a college-wide 'All'
-- survey or one targeted at another department; `using` means their
-- write access (activate/close/edit) never reaches surveys they don't
-- already own the target department of.
drop policy if exists "tracer_surveys_write_faculty_own_dept" on public.tracer_surveys;
create policy "tracer_surveys_write_faculty_own_dept"
  on public.tracer_surveys for all
  using (current_user_role() = 'faculty' and target_dept = current_user_department())
  with check (current_user_role() = 'faculty' and target_dept = current_user_department());
