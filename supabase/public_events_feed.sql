-- =====================================================================
-- HOMEPAGE EVENTS = THE ALUMNI EVENT CALENDAR
--
-- The public homepage's "Events" list now reads the very same `events`
-- table the alumni Events / Calendar uses, so anything the Alumni Head
-- creates there (seminars, workshops, reunions…) shows up on the homepage
-- for everyone — alumni or not. The calendar is already shared across all
-- departments for signed-in users, so the homepage shows every event too
-- (announcements stay limited to the "All Alumni" ones).
--
-- Replaces public_news_feed() — same name and argument, richer events:
-- department, capacity and how many have registered. Safe to re-run.
-- =====================================================================

create or replace function public.public_news_feed(p_limit integer default 6)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 6), 20));
  v_announcements jsonb;
  v_events jsonb;
begin
  select coalesce(jsonb_agg(a.item order by a.pinned desc, a.created_at desc), '[]'::jsonb)
    into v_announcements
  from (
    select jsonb_build_object(
             'id', x.id, 'title', x.title, 'summary', left(x.content, 240),
             'category', x.category, 'pinned', x.pinned, 'at', x.created_at
           ) as item,
           x.pinned, x.created_at
    from public.announcements x
    where x.target_dept = 'All Alumni'
    order by x.pinned desc, x.created_at desc
    limit v_limit
  ) a;

  -- Upcoming events (today onward), soonest first.
  select coalesce(jsonb_agg(e.item order by e.event_date), '[]'::jsonb)
    into v_events
  from (
    select jsonb_build_object(
             'id', x.id, 'title', x.title, 'summary', left(coalesce(x.description, ''), 600),
             'event_type', x.event_type, 'location', x.location, 'at', x.event_date,
             'department', coalesce(x.department, 'All'),
             'capacity', x.max_capacity,
             'registered', (select count(*) from public.event_registrations r where r.event_id = x.id),
             'image_url', case when x.image_url like 'http%' then x.image_url else null end
           ) as item,
           x.event_date
    from public.events x
    where x.event_date >= now() - interval '1 day'
    order by x.event_date asc
    limit v_limit
  ) e;

  -- Nothing upcoming: show the most recent past events instead of an empty box.
  if jsonb_array_length(v_events) = 0 then
    select coalesce(jsonb_agg(e.item order by e.event_date desc), '[]'::jsonb)
      into v_events
    from (
      select jsonb_build_object(
               'id', x.id, 'title', x.title, 'summary', left(coalesce(x.description, ''), 600),
               'event_type', x.event_type, 'location', x.location, 'at', x.event_date,
               'department', coalesce(x.department, 'All'),
               'capacity', x.max_capacity,
               'registered', (select count(*) from public.event_registrations r where r.event_id = x.id),
               'image_url', case when x.image_url like 'http%' then x.image_url else null end
             ) as item,
             x.event_date
      from public.events x
      order by x.event_date desc
      limit v_limit
    ) e;
  end if;

  return jsonb_build_object('announcements', v_announcements, 'events', v_events);
end;
$$;

revoke execute on function public.public_news_feed(integer) from public;
grant execute on function public.public_news_feed(integer) to anon, authenticated;
