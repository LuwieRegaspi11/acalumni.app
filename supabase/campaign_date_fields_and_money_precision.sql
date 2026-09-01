-- =====================================================================
-- THREE NON-OVERLAPPING CAMPAIGN DATE FIELDS + MONEY PRECISION
--
-- donation_campaigns now has three distinct date/timestamp fields that
-- must never be conflated:
--
--   event_start_date -- (already renamed from `deadline`, see
--                        campaign_event_start_date_rename.sql). Date the
--                        real-world event/campaign starts. Purely
--                        informational, shown to donors. Independent of
--                        the two fields below -- never used in status
--                        logic, no validation dependency on either.
--
--   posted_date       -- (was `created_at`). Auto-set at insert time.
--                        Read-only / display-only from the app's side --
--                        never sent in an update payload, never used in
--                        Active/Scheduled/History status logic.
--
--   release_date      -- (was `release_at`). Admin-set date/time that
--                        ALONE controls the Scheduled -> Active
--                        transition: release_date <= now() => Active,
--                        release_date in the future => Scheduled. Must
--                        be >= posted_date (enforced app-side in
--                        CampaignFormModal, since posted_date isn't known
--                        client-side until insert).
--                        Unlike the old `release_at`, this is never
--                        nulled out once a campaign goes live -- it's
--                        kept as a permanent "released on" record so the
--                        campaigns table/detail view can always show a
--                        real "Releases On" value instead of a blank.
--
-- Status is auto-updated two ways, per the app's design:
--   1. DB-level: the release_scheduled_campaigns() pg_cron job (runs
--      every minute) flips `active` true once release_date passes.
--   2. App-level: DonationContext's getCampaignPhase()/isCampaignLive()
--      compare release_date to "now" on every render, so the UI is
--      correct immediately rather than waiting up to a minute for cron.
--
-- Also: every money column in the donation feature gets explicit 2-
-- decimal precision (was unconstrained `numeric`), so cents are always
-- well-defined instead of left to whatever the client happened to send.
--
-- Safe to re-run: every rename/alter is guarded by an existence/type
-- check.
-- =====================================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'donation_campaigns' and column_name = 'created_at'
  ) then
    alter table public.donation_campaigns rename column created_at to posted_date;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'donation_campaigns' and column_name = 'release_at'
  ) then
    alter table public.donation_campaigns rename column release_at to release_date;
  end if;
end $$;

comment on column public.donation_campaigns.posted_date is
  'Auto-set when the campaign row is created. Read-only, display-only -- never used in Active/Scheduled/History status logic.';
comment on column public.donation_campaigns.release_date is
  'Admin-set date/time the campaign becomes publicly visible/active. Alone controls Scheduled->Active (release_date <= now() => Active; future => Scheduled), auto-applied by release_scheduled_campaigns() and by the app''s on-load status check. Must be >= posted_date.';
comment on column public.donation_campaigns.event_start_date is
  'Date the associated event/campaign starts. Purely informational -- independent of release_date/posted_date and does not affect status.';

create or replace function public.release_scheduled_campaigns()
returns void
language sql
security definer
set search_path to 'public'
as $function$
  update public.donation_campaigns
  set active = true
  where active = false
    and ended_at is null
    and release_date is not null
    and release_date <= now();
$function$;

alter table public.donation_campaigns
  alter column goal_amount type numeric(12,2) using round(goal_amount, 2);
alter table public.donations
  alter column amount type numeric(12,2) using round(amount, 2);
alter table public.campaign_expenses
  alter column amount type numeric(12,2) using round(amount, 2);
