-- =====================================================================
-- PAYMENT DESTINATIONS — replaces the old fixed GCash/Bank columns on
-- `system_settings` (gcash_number, gcash_name, bank_name,
-- bank_account_name, bank_account_number) with an admin-managed,
-- ordered list of payment destinations. Each entry is a Bank,
-- E-Wallet, or Other payment channel donors can pay into, optionally
-- with a QR code image, shown as selectable cards on the Donation
-- Center (alumni only ever see the active ones).
--
-- Already applied directly to this project's live Supabase instance
-- via MCP (including the one-time data migration that carried the
-- existing GCash + BDO values over as the first two rows) — this file
-- only documents that change for anyone setting up a fresh copy of the
-- schema. See DATABASE-SETUP.md.
--
-- Run this once in Supabase -> SQL Editor -> New query -> Run.
-- =====================================================================

create table if not exists public.payment_destinations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('Bank', 'E-Wallet', 'Other')),
  provider_name text not null,
  account_name text not null,
  account_number text not null,
  qr_code_url text,       -- storage path/URL in the public 'public-assets' bucket, 'payment-qr/' folder
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.payment_destinations enable row level security;

-- Anyone signed in can read (donors need to see active destinations).
create policy "payment_destinations_select_all"
  on public.payment_destinations for select
  using (true);

-- Only admins can add/edit/delete/reorder.
create policy "payment_destinations_write_admin"
  on public.payment_destinations for all
  using (is_admin())
  with check (is_admin());

-- QR code images live in the existing public 'public-assets' bucket
-- (already publicly readable via the `public_assets_select_all`
-- policy), under a new 'payment-qr/' folder, admin-only to write —
-- same pattern as the existing 'branding/' folder used for the
-- university logo.
create policy "public_assets_payment_qr_admin"
  on storage.objects for all
  using (
    bucket_id = 'public-assets'
    and (storage.foldername(name))[1] = 'payment-qr'
    and is_admin()
  )
  with check (
    bucket_id = 'public-assets'
    and (storage.foldername(name))[1] = 'payment-qr'
    and is_admin()
  );

-- One-time data migration: carries over the old GCash + Bank config
-- from system_settings so nothing is lost. Safe to re-run — only
-- fires while payment_destinations is still empty.
insert into public.payment_destinations (type, provider_name, account_name, account_number, is_active, sort_order)
select 'E-Wallet', 'GCash', s.gcash_name, s.gcash_number, true, 0
from public.system_settings s
where s.id = true
  and coalesce(s.gcash_number, '') <> ''
  and not exists (select 1 from public.payment_destinations);

insert into public.payment_destinations (type, provider_name, account_name, account_number, is_active, sort_order)
select 'Bank', s.bank_name, s.bank_account_name, s.bank_account_number, true, 1
from public.system_settings s
where s.id = true
  and coalesce(s.bank_account_number, '') <> ''
  and not exists (select 1 from public.payment_destinations where provider_name = s.bank_name and sort_order = 1);

-- The old gcash_*/bank_* columns on system_settings are left in place
-- (not dropped) — they're simply no longer read or written by the app.
-- Drop them yourself once you've confirmed the new table is working:
--
-- alter table public.system_settings
--   drop column if exists gcash_number,
--   drop column if exists gcash_name,
--   drop column if exists bank_name,
--   drop column if exists bank_account_name,
--   drop column if exists bank_account_number;
