-- =====================================================================
-- PERFORMANCE INDEXES — purely additive, no behavior change.
--
-- Fixes two categories the Supabase performance advisor flagged:
--
--   1. Foreign keys with no covering index. Postgres doesn't create one
--      automatically for a FK column (only for the referenced side's
--      primary key) — without it, every ON DELETE/UPDATE cascade check
--      and every join/filter on that column does a sequential scan
--      instead of an index lookup. Harmless at this app's current size,
--      but the fix costs nothing and only gets more valuable as tables
--      like `donations`, `event_registrations`, and `audit_logs` grow.
--
--   2. `login_attempts` has no primary key at all (it was created as a
--      pure append-only log: email, succeeded, created_at). Adding a
--      synthetic `id` gives every row a stable identity — useful for
--      any future admin tooling over this table — without touching any
--      existing column or the record_login_attempt()/check_device()
--      functions that write to it (they only ever INSERT, never
--      reference `id`).
--
-- Safe to re-run: every statement is guarded (IF NOT EXISTS).
-- =====================================================================

-- ---- 1. Missing foreign-key indexes ----
create index if not exists idx_profiles_batch_verified_by on public.profiles(batch_verified_by);
create index if not exists idx_events_created_by on public.events(created_by);
create index if not exists idx_event_registrations_alumni_id on public.event_registrations(alumni_id);
create index if not exists idx_donations_campaign_id on public.donations(campaign_id);
create index if not exists idx_donations_donor_id on public.donations(donor_id);
create index if not exists idx_campaign_expenses_campaign_id on public.campaign_expenses(campaign_id);
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_audit_logs_actor_id on public.audit_logs(actor_id);
create index if not exists idx_announcements_created_by on public.announcements(created_by);
create index if not exists idx_job_postings_posted_by on public.job_postings(posted_by);
create index if not exists idx_tracer_surveys_created_by on public.tracer_surveys(created_by);
create index if not exists idx_tracer_survey_responses_respondent_id on public.tracer_survey_responses(respondent_id);
create index if not exists idx_alumni_tracer_intake_linked_profile_id on public.alumni_tracer_intake(linked_profile_id);
create index if not exists idx_alumni_tracer_intake_linked_response_id on public.alumni_tracer_intake(linked_response_id);
create index if not exists idx_alumni_tracer_intake_matched_roster_id on public.alumni_tracer_intake(matched_roster_id);
create index if not exists idx_alumni_tracer_intake_possible_duplicate_profile_id on public.alumni_tracer_intake(possible_duplicate_profile_id);
create index if not exists idx_alumni_tracer_intake_reviewed_by on public.alumni_tracer_intake(reviewed_by);

-- ---- 2. Primary key for login_attempts ----
alter table public.login_attempts add column if not exists id bigint generated always as identity;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.login_attempts'::regclass and contype = 'p'
  ) then
    alter table public.login_attempts add primary key (id);
  end if;
end $$;
