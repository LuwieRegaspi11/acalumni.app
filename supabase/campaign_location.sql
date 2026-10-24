-- =====================================================================
-- CAMPAIGN LOCATION ("where") + homepage projects
--
-- Adds an optional location to donation campaigns/projects and returns it
-- from public_campaign_showcase(), so the homepage's Alumni Projects cards can
-- show: title, description, when, where, and the funds accumulated so far.
--
-- Run after donations_transparency.sql. Safe to re-run.
-- =====================================================================

alter table public.donation_campaigns
  add column if not exists location text;

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
      'location', v.location,
      'photos', (
        select coalesce(jsonb_agg(jsonb_build_object('path', p.storage_path, 'caption', p.caption) order by p.sort_order, p.created_at), '[]'::jsonb)
        from public.campaign_photos p where p.campaign_id = v.id
      ),
      'donors', '[]'::jsonb,
      'anonymous_count', 0
    ) order by v.posted_date desc
  ), '[]'::jsonb)
  from visible v;
$$;

revoke execute on function public.public_campaign_showcase() from public;
grant execute on function public.public_campaign_showcase() to anon, authenticated;
