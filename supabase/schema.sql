-- =====================================================================
-- ACCOUNTS SCHEMA
-- Run this once in your Supabase project's SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste this whole file -> Run).
--
-- Supabase already provides a built-in `auth.users` table that stores
-- email + password securely — you never touch that table directly.
-- This file creates a `profiles` table that stores the extra fields
-- this app needs per account (name, role, department, etc.) and links
-- each row 1:1 to an `auth.users` row.
-- =====================================================================

-- 1. The accounts table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null check (role in ('admin', 'alumni', 'faculty', 'representative')),
  department text,
  batch_year integer,
  program text,
  profile_image text,
  assigned_batch_year integer,   -- batch representatives only
  assigned_department text,      -- batch representatives only
  assigned_program text,         -- batch representatives only
  created_at timestamptz not null default now()
);

-- 2. Row Level Security — locks the table down so people can only
--    read/edit their own account by default.
alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Note: admin/directory-style screens that need to list ALL alumni
-- (e.g. Alumni Database, Batch Representatives) will need a broader
-- select policy later, e.g.:
--   create policy "Admins can view all profiles"
--     on public.profiles for select
--     using (exists (
--       select 1 from public.profiles p
--       where p.id = auth.uid() and p.role = 'admin'
--     ));
-- Add that once you're ready to connect those screens to real data too.

-- 3. (Optional but recommended) seed the 4 demo accounts shown on the
--    sign-in screen, so the "Demo Accounts" quick-login buttons keep
--    working. Run this section AFTER you have manually created these
--    4 users once via the app's Sign Up form (or via Supabase Auth ->
--    Users -> Add user in the dashboard) using these exact emails.
--    Then update their role/department here:
--
-- update public.profiles set role = 'admin' where email = 'admin@asiancollege.edu';
-- update public.profiles set role = 'alumni', department = 'CSE', batch_year = 2022, program = 'BSIT' where email = 'alumni@asiancollege.edu';
-- update public.profiles set role = 'representative', department = 'CSE', batch_year = 2022, program = 'BSIT', assigned_batch_year = 2022, assigned_department = 'CSE', assigned_program = 'BSIT' where email = 'rep@asiancollege.edu';
-- update public.profiles set role = 'faculty', department = 'CSE' where email = 'faculty@asiancollege.edu';
