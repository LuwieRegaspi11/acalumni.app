-- =====================================================================
-- DONATIONS & TRANSPARENCY  (pre-oral-defense panel request)
--
--   1. Campaign cover photo + project photo gallery
--        donation_campaigns.cover_image_url
--        public.campaign_photos                 (gallery rows)
--        Storage bucket "campaign-photos"        (public read, admin write)
--   2. Donor consent
--        donations.is_anonymous                  ("Show my name" = false,
--                                                 "Anonymous" = true)
--        public.set_donation_anonymity()         (a donor can change their
--                                                 mind later)
--   3. Privacy-aware read APIs (SECURITY DEFINER, so the names of
--      anonymous donors never leave the database for non-admins):
--        public.top_donors(limit)                Top Donors leaderboard
--        public.campaign_donor_list(campaign)    donor list modal
--        public.campaign_donor_credits(campaign) "Donated by" credit
--        public.public_campaign_showcase()       homepage campaigns/projects
--        public.public_news_feed(limit)          homepage announcements+events
--
-- Run after remove_faculty_role.sql. Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Columns, gallery table, storage bucket
-- ---------------------------------------------------------------------
alter table public.donation_campaigns
  add column if not exists cover_image_url text;

alter table public.donations
  add column if not exists is_anonymous boolean not null default false;

create table if not exists public.campaign_photos (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.donation_campaigns(id) on delete cascade,
  storage_path text not null,            -- path inside the "campaign-photos" bucket
  caption      text,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists campaign_photos_campaign_idx
  on public.campaign_photos (campaign_id, sort_order, created_at);

alter table public.campaign_photos enable row level security;

-- Read: whoever can see the parent campaign (campaigns' own RLS applies
-- inside this sub-select, so department scoping carries over for free).
drop policy if exists "campaign_photos_select_visible" on public.campaign_photos;
create policy "campaign_photos_select_visible"
  on public.campaign_photos for select
  using (exists (select 1 from public.donation_campaigns c where c.id = campaign_photos.campaign_id));

-- Write: Alumni Head (admin) only.
drop policy if exists "campaign_photos_write_admin" on public.campaign_photos;
create policy "campaign_photos_write_admin"
  on public.campaign_photos for all
  using (public.is_admin())
  with check (public.is_admin());

-- Storage bucket: public read (these are marketing photos shown on the
-- homepage), admin-only write, images only, 5 MB each.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('campaign-photos', 'campaign-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "campaign_photos_bucket_read" on storage.objects;
create policy "campaign_photos_bucket_read"
  on storage.objects for select
  using (bucket_id = 'campaign-photos');

drop policy if exists "campaign_photos_bucket_insert_admin" on storage.objects;
create policy "campaign_photos_bucket_insert_admin"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'campaign-photos' and public.is_admin());

drop policy if exists "campaign_photos_bucket_update_admin" on storage.objects;
create policy "campaign_photos_bucket_update_admin"
  on storage.objects for update to authenticated
  using (bucket_id = 'campaign-photos' and public.is_admin());

drop policy if exists "campaign_photos_bucket_delete_admin" on storage.objects;
create policy "campaign_photos_bucket_delete_admin"
  on storage.objects for delete to authenticated
  using (bucket_id = 'campaign-photos' and public.is_admin());

-- ---------------------------------------------------------------------
-- 2. Let a donor change their name-visibility choice later
-- ---------------------------------------------------------------------
create or replace function public.set_donation_anonymity(p_donation_id uuid, p_anonymous boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;
  update public.donations
     set is_anonymous = coalesce(p_anonymous, false)
   where id = p_donation_id
     and donor_id = auth.uid();
  if not found then
    raise exception 'Donation not found.';
  end if;
end;
$$;

revoke execute on function public.set_donation_anonymity(uuid, boolean) from public, anon;
grant execute on function public.set_donation_anonymity(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 3a. Top Donors leaderboard
--     Only verified donations count. A donor who chose "Show my name"
--     appears under their name; a donor who chose "Anonymous" appears as
--     "Anonymous" (no name, no batch, no program, no id). Someone with
--     both kinds of donations gets two rows: one named, one anonymous.
-- ---------------------------------------------------------------------
create or replace function public.top_donors(p_limit integer default 10)
returns table (
  rank          bigint,
  display_name  text,
  batch_year    integer,
  program       text,
  total_amount  numeric,
  donation_count bigint,
  is_anonymous  boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with per_donor as (
    select d.donor_id, d.is_anonymous, sum(d.amount) as total, count(*) as cnt
    from public.donations d
    where d.status = 'verified'
    group by d.donor_id, d.is_anonymous
  )
  select
    row_number() over (order by pd.total desc, pd.cnt desc, p.name) as rank,
    case when pd.is_anonymous then 'Anonymous' else p.name end,
    case when pd.is_anonymous then null else p.batch_year end,
    case when pd.is_anonymous then null else p.program end,
    pd.total,
    pd.cnt,
    pd.is_anonymous
  from per_donor pd
  join public.profiles p on p.id = pd.donor_id
  order by pd.total desc, pd.cnt desc, p.name
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$$;

revoke execute on function public.top_donors(integer) from public;
grant execute on function public.top_donors(integer) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Shared visibility rule for the campaign-scoped readers below: admin
-- sees everything; everyone else (including signed-out visitors) only
-- sees released campaigns that are college-wide or in their own
-- department.
-- ---------------------------------------------------------------------
create or replace function public.can_view_campaign(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.donation_campaigns c
    where c.id = p_campaign_id
      and (
        public.is_admin()
        or (
          (c.release_date is null and c.active or c.release_date <= now())
          and (c.department = 'All' or c.department = public.current_user_job_department())
        )
      )
  );
$$;

revoke execute on function public.can_view_campaign(uuid) from public;
grant execute on function public.can_view_campaign(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3b. Donor list for one campaign (the "Donors — <campaign>" modal).
--     The admin sees real names plus an is_anonymous flag (needed for
--     verification and audit); everyone else sees "Anonymous" for donors
--     who chose it.
-- ---------------------------------------------------------------------
create or replace function public.campaign_donor_list(p_campaign_id uuid)
returns table (
  id            uuid,
  display_name  text,
  amount        numeric,
  created_at    timestamptz,
  is_anonymous  boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.id,
    case when d.is_anonymous and not public.is_admin() then 'Anonymous'
         else coalesce(p.name, 'Anonymous') end,
    d.amount,
    d.created_at,
    d.is_anonymous
  from public.donations d
  left join public.profiles p on p.id = d.donor_id
  where d.campaign_id = p_campaign_id
    and d.status = 'verified'
    and public.can_view_campaign(p_campaign_id)
  order by d.created_at desc;
$$;

revoke execute on function public.campaign_donor_list(uuid) from public, anon;
grant execute on function public.campaign_donor_list(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3c. "Donated by" credit: named (consenting) donors + a count of the
--     anonymous ones. Callable by signed-out visitors for released,
--     college-wide campaigns (that is what the homepage shows).
-- ---------------------------------------------------------------------
create or replace function public.campaign_donor_credits(p_campaign_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when not public.can_view_campaign(p_campaign_id) then
    jsonb_build_object('named', '[]'::jsonb, 'anonymous_count', 0)
  else jsonb_build_object(
    'named', coalesce((
      select jsonb_agg(jsonb_build_object('name', x.name, 'batch_year', x.batch_year, 'total', x.total) order by x.total desc, x.name)
      from (
        select p.name, p.batch_year, sum(d.amount) as total
        from public.donations d
        join public.profiles p on p.id = d.donor_id
        where d.campaign_id = p_campaign_id and d.status = 'verified' and not d.is_anonymous
        group by p.id, p.name, p.batch_year
      ) x
    ), '[]'::jsonb),
    'anonymous_count', (
      select count(distinct d.donor_id)
      from public.donations d
      where d.campaign_id = p_campaign_id and d.status = 'verified' and d.is_anonymous
    )
  ) end;
$$;

revoke execute on function public.campaign_donor_credits(uuid) from public;
grant execute on function public.campaign_donor_credits(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3d. Homepage: released, college-wide campaigns with raised amount,
--     cover, gallery and donor credits. (Department-specific campaigns
--     stay inside the portal, matching donation_campaigns_scoped_rls.sql.)
-- ---------------------------------------------------------------------
create or replace function public.public_campaign_showcase()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with raised as (
    select d.campaign_id, sum(d.amount) as total
    from public.donations d
    where d.status = 'verified' and d.campaign_id is not null
    group by d.campaign_id
  ),
  visible as (
    select c.*, coalesce(r.total, 0) as raised
    from public.donation_campaigns c
    left join raised r on r.campaign_id = c.id
    where c.department = 'All'
      and ((c.release_date is null and c.active) or c.release_date <= now())
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', v.id,
      'name', v.name,
      'description', v.description,
      'goal', v.goal_amount,
      'raised', v.raised,
      'cover_image_url', v.cover_image_url,
      'active', v.active,
      'ended_at', v.ended_at,
      'event_start_date', v.event_start_date,
      'photos', (
        select coalesce(jsonb_agg(jsonb_build_object('path', p.storage_path, 'caption', p.caption) order by p.sort_order, p.created_at), '[]'::jsonb)
        from public.campaign_photos p where p.campaign_id = v.id
      ),
      'donors', (
        select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'total', x.total) order by x.total desc, x.name), '[]'::jsonb)
        from (
          select pr.name, sum(d.amount) as total
          from public.donations d
          join public.profiles pr on pr.id = d.donor_id
          where d.campaign_id = v.id and d.status = 'verified' and not d.is_anonymous
          group by pr.id, pr.name
        ) x
      ),
      'anonymous_count', (
        select count(distinct d.donor_id)
        from public.donations d
        where d.campaign_id = v.id and d.status = 'verified' and d.is_anonymous
      )
    ) order by v.posted_date desc
  ), '[]'::jsonb)
  from visible v;
$$;

revoke execute on function public.public_campaign_showcase() from public;
grant execute on function public.public_campaign_showcase() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3e. Homepage news feed: latest all-alumni announcements + upcoming
--     college-wide events (falls back to the most recent past ones).
-- ---------------------------------------------------------------------
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

  select coalesce(jsonb_agg(e.item order by e.event_date), '[]'::jsonb)
    into v_events
  from (
    select jsonb_build_object(
             'id', x.id, 'title', x.title, 'summary', left(coalesce(x.description, ''), 240),
             'event_type', x.event_type, 'location', x.location, 'at', x.event_date,
             'image_url', case when x.image_url like 'http%' then x.image_url else null end
           ) as item,
           x.event_date
    from public.events x
    where coalesce(x.department, 'All') = 'All'
      and x.event_date >= now() - interval '1 day'
    order by x.event_date asc
    limit v_limit
  ) e;

  -- Nothing upcoming: show the latest past events instead of an empty box.
  if jsonb_array_length(v_events) = 0 then
    select coalesce(jsonb_agg(e.item order by e.event_date desc), '[]'::jsonb)
      into v_events
    from (
      select jsonb_build_object(
               'id', x.id, 'title', x.title, 'summary', left(coalesce(x.description, ''), 240),
               'event_type', x.event_type, 'location', x.location, 'at', x.event_date,
               'image_url', case when x.image_url like 'http%' then x.image_url else null end
             ) as item,
             x.event_date
      from public.events x
      where coalesce(x.department, 'All') = 'All'
      order by x.event_date desc
      limit v_limit
    ) e;
  end if;

  return jsonb_build_object('announcements', v_announcements, 'events', v_events);
end;
$$;

revoke execute on function public.public_news_feed(integer) from public;
grant execute on function public.public_news_feed(integer) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3f. Homepage headline numbers — live counts instead of hard-coded text.
-- ---------------------------------------------------------------------
create or replace function public.public_landing_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'alumni_count', (
      select count(*) from public.profiles
      where role in ('alumni', 'representative') and registration_status = 'approved'
    ),
    'total_raised', (
      select coalesce(sum(amount), 0) from public.donations where status = 'verified'
    )
  );
$$;

revoke execute on function public.public_landing_stats() from public;
grant execute on function public.public_landing_stats() to anon, authenticated;
