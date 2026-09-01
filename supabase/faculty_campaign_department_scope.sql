-- =====================================================================
-- FACULTY CAMPAIGN DEPARTMENT SCOPE
-- Prior to this migration, `campaigns_write_staff` granted ANY faculty
-- account full INSERT/UPDATE/DELETE on donation_campaigns, regardless
-- of department (a faculty member from CSE could edit/delete a CTHM
-- or college-wide "All" campaign). This tightens campaign writes so a
-- faculty account can only create/edit/end/delete campaigns for their
-- own department, while admins keep unrestricted access.
--
-- `donations` and `campaign_expenses` already have (or, for expenses,
-- now get) equivalent scoping — see donations_select_own_or_scoped_staff
-- / donations_update_scoped_staff, which already restrict faculty to
-- donations from donors in their own department.
--
-- Safe to re-run: every statement drops-if-exists before creating.
-- =====================================================================

-- ---- donation_campaigns ------------------------------------------------
drop policy if exists "campaigns_write_staff" on public.donation_campaigns;

create policy "campaigns_write_admin"
  on public.donation_campaigns for all
  using (is_admin())
  with check (is_admin());

-- Faculty may only write campaigns whose department equals their own —
-- this also blocks faculty from creating/editing college-wide ("All")
-- campaigns, matching the app's "no department picker" faculty UI.
create policy "campaigns_write_faculty_own_dept"
  on public.donation_campaigns for all
  using (current_user_role() = 'faculty' and department = current_user_department())
  with check (current_user_role() = 'faculty' and department = current_user_department());

-- ---- campaign_expenses --------------------------------------------------
-- Same tightening for expense logging, so a faculty account can't log
-- (or delete) expenses against another department's campaign.
drop policy if exists "campaign_expenses_write_staff" on public.campaign_expenses;

create policy "campaign_expenses_write_admin"
  on public.campaign_expenses for all
  using (is_admin())
  with check (is_admin());

create policy "campaign_expenses_write_faculty_own_dept"
  on public.campaign_expenses for all
  using (
    current_user_role() = 'faculty'
    and exists (
      select 1 from public.donation_campaigns c
      where c.id = campaign_expenses.campaign_id
        and c.department = current_user_department()
    )
  )
  with check (
    current_user_role() = 'faculty'
    and exists (
      select 1 from public.donation_campaigns c
      where c.id = campaign_expenses.campaign_id
        and c.department = current_user_department()
    )
  );
