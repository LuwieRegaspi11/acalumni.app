-- =====================================================================
-- CAMPAIGN "DEADLINE" -> "EVENT START DATE"
-- The New Campaign form's date field was a countdown-to-deadline; it's
-- now an event start date instead (purely informational — it does not
-- put a campaign into History, that's still only ended_at/active). This
-- renames the column to match what the app now stores in it.
--
-- Note: existing rows keep whatever date they already had — no data
-- migration, just a rename. `department` is untouched by this file; see
-- faculty_campaign_department_scope.sql for that column's RLS policies.
--
-- Safe to re-run: guarded by a column-existence check.
-- =====================================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'donation_campaigns' and column_name = 'deadline'
  ) then
    alter table public.donation_campaigns rename column deadline to event_start_date;
  end if;
end $$;

comment on column public.donation_campaigns.event_start_date is
  'Date the associated event/campaign starts. Purely informational -- does not affect active/ended status (see ended_at).';
