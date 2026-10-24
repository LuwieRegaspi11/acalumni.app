-- =====================================================================
-- EVENT TYPES (Seminar / Workshop) — pre-oral-defense panel request
--
-- Adds events.event_type so the Alumni Head can schedule Seminars and
-- Workshops alongside ordinary events. Existing events become 'General'.
--
-- (Announcement / event notifications themselves need no table change:
--  they write to the existing public.notifications table from the
--  notify-alumni Edge Function — see supabase/functions/notify-alumni.)
--
-- Safe to re-run.
-- =====================================================================

alter table public.events
  add column if not exists event_type text not null default 'General';

alter table public.events
  drop constraint if exists events_event_type_check;
alter table public.events
  add constraint events_event_type_check
  check (event_type in ('General', 'Seminar', 'Workshop'));

create index if not exists events_event_type_idx on public.events (event_type);
