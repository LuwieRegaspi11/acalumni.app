-- =====================================================================
-- DONOR RANKING — for inspiring alumni and for thanking donors at events
--
--   * top_donors(limit, year)   public/alumni leaderboard. VERIFIED
--     donations only (the admin has confirmed the payment). Donors who
--     chose "Anonymous" appear as "Anonymous". New optional year filter.
--   * admin_donor_ranking(year, campaign)   admin only. The same ranking
--     with the real names, emails and a flag telling the admin whether each
--     donor may be announced by name, so thanks can be given in person at
--     events without breaking anyone's "Anonymous" choice.
--
-- Run after donations_transparency.sql. Safe to re-run.
-- =====================================================================

-- Replace the one-argument version with one that also takes a year.
drop function if exists public.top_donors(integer);
drop function if exists public.top_donors(integer, integer);

create or replace function public.top_donors(p_limit integer default 10, p_year integer default null)
returns table (
  rank           bigint,
  display_name   text,
  batch_year     integer,
  program        text,
  profile_image  text,
  total_amount   numeric,
  donation_count bigint,
  is_anonymous   boolean
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
      and (p_year is null or extract(year from coalesce(d.verified_at, d.created_at)) = p_year)
    group by d.donor_id, d.is_anonymous
  )
  select
    row_number() over (order by pd.total desc, pd.cnt desc, p.name) as rank,
    case when pd.is_anonymous then 'Anonymous' else p.name end,
    case when pd.is_anonymous then null else p.batch_year end,
    case when pd.is_anonymous then null else p.program end,
    case when pd.is_anonymous then null else p.profile_image end,
    pd.total,
    pd.cnt,
    pd.is_anonymous
  from per_donor pd
  join public.profiles p on p.id = pd.donor_id
  order by pd.total desc, pd.cnt desc, p.name
  limit greatest(1, least(coalesce(p_limit, 10), 100));
$$;

revoke execute on function public.top_donors(integer, integer) from public;
grant execute on function public.top_donors(integer, integer) to anon, authenticated;

-- Admin-only ranking with real identities --------------------------------
create or replace function public.admin_donor_ranking(p_year integer default null, p_campaign_id uuid default null)
returns table (
  rank            bigint,
  donor_id        uuid,
  name            text,
  email           text,
  batch_year      integer,
  program         text,
  total_amount    numeric,
  donation_count  bigint,
  anonymous_count bigint,
  last_donated    timestamptz,
  can_announce    boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the admin can view the full donor ranking.';
  end if;

  return query
  with per_donor as (
    select d.donor_id as did,
           sum(d.amount) as total,
           count(*) as cnt,
           count(*) filter (where d.is_anonymous) as anon_cnt,
           max(coalesce(d.verified_at, d.created_at)) as last_at
    from public.donations d
    where d.status = 'verified'
      and (p_year is null or extract(year from coalesce(d.verified_at, d.created_at)) = p_year)
      and (p_campaign_id is null or d.campaign_id = p_campaign_id)
    group by d.donor_id
  )
  select
    row_number() over (order by pd.total desc, pd.cnt desc, p.name),
    p.id, p.name, p.email, p.batch_year, p.program,
    pd.total, pd.cnt, pd.anon_cnt, pd.last_at,
    (pd.anon_cnt = 0)
  from per_donor pd
  join public.profiles p on p.id = pd.did
  order by pd.total desc, pd.cnt desc, p.name;
end;
$$;

revoke execute on function public.admin_donor_ranking(integer, uuid) from public, anon;
grant execute on function public.admin_donor_ranking(integer, uuid) to authenticated;

-- "Your rank" for the signed-in alumnus: where they stand among all donors,
-- how much they have given (verified only) and how far the next rank is.
create or replace function public.my_donor_rank(p_year integer default null)
returns table (
  rank           bigint,
  total_amount   numeric,
  donation_count bigint,
  gap_to_next    numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with t as (
    select d.donor_id, sum(d.amount) as total, count(*) as cnt
    from public.donations d
    where d.status = 'verified'
      and (p_year is null or extract(year from coalesce(d.verified_at, d.created_at)) = p_year)
    group by d.donor_id
  ),
  r as (
    select t.donor_id, t.total, t.cnt,
           rank() over (order by t.total desc) as rk,
           (select min(t2.total) from t t2 where t2.total > t.total) as next_total
    from t
  )
  select r.rk, r.total, r.cnt, case when r.next_total is null then 0 else r.next_total - r.total end
  from r
  where r.donor_id = auth.uid();
$$;

revoke execute on function public.my_donor_rank(integer) from public, anon;
grant execute on function public.my_donor_rank(integer) to authenticated;
