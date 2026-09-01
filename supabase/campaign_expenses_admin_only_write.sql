-- =====================================================================
-- CAMPAIGN EXPENSES — ADMIN-ONLY WRITE
-- The campaign-name click-through (DonorListModal) is now shared as a
-- view for every role — admin, faculty, alumni, and batch representative
-- all land on the same donor list + expense ledger. The UI only shows
-- the add/delete-expense controls to admin (see DonorListModal.tsx's
-- `canManageExpenses`); this migration makes that the enforced boundary
-- server-side too; faculty previously could log/delete expenses on
-- their own department's campaigns (campaign_expenses_write_faculty_own_dept,
-- added in faculty_campaign_department_scope.sql) — that policy is
-- dropped here so a faculty account can no longer do this via a direct
-- API call either, matching the UI exactly.
--
-- Read access (campaign_expenses_select_scoped) is untouched — everyone
-- still sees the expense ledger for campaigns in their department scope,
-- just can no longer write to it unless they're admin.
--
-- Safe to re-run: drops-if-exists before the (unchanged) admin policy is
-- left in place.
-- =====================================================================

drop policy if exists "campaign_expenses_write_faculty_own_dept" on public.campaign_expenses;

-- campaign_expenses_write_admin (using is_admin() / with check is_admin())
-- already exists from faculty_campaign_department_scope.sql and needs no
-- change — it's now the only write policy left on this table.
