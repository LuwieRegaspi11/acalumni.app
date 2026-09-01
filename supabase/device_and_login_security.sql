-- =====================================================================
-- DEVICE & LOGIN SECURITY — "new device" detection, admin-forced MFA,
-- and login attempt rate limiting/lockout for the Identity Verification
-- & Secure Sign-In feature (see todos.md section 1 "During login").
--
-- Run once via Supabase SQL Editor (or MCP apply_migration). Safe to
-- re-run: column adds / table creates are guarded, functions are
-- CREATE OR REPLACE.
-- =====================================================================

alter table public.profiles
  add column if not exists require_mfa boolean not null default false;

-- ---------------------------------------------------------------------
-- known_devices — a lightweight, per-browser device fingerprint (a
-- random id the client generates and persists in localStorage, sent
-- back on every login). Not a security boundary by itself (it's
-- client-supplied) — it only decides whether to prompt for extra
-- verification on an unrecognized device, same trust level as e.g. a
-- "remember this browser" cookie elsewhere.
-- ---------------------------------------------------------------------
create table if not exists public.known_devices (
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id text not null,
  user_agent text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, device_id)
);

alter table public.known_devices enable row level security;

drop policy if exists "known_devices_select_self" on public.known_devices;
create policy "known_devices_select_self"
  on public.known_devices for select
  using (auth.uid() = user_id);
-- No client-side insert/update policy: only written via check_device()/
-- trust_device() below (SECURITY DEFINER), so a signed-in user can't
-- just mark an arbitrary device_id "known" for themselves without going
-- through whatever extra-verification step trust_device() gates on.

-- ---------------------------------------------------------------------
-- login_attempts — used only for the generic lockout counter. No RLS
-- policies (admin/audit visibility goes through audit_logs instead, via
-- record_login_attempt() calling log_audit() below).
-- ---------------------------------------------------------------------
create table if not exists public.login_attempts (
  email text not null,
  succeeded boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists login_attempts_email_idx on public.login_attempts (email, created_at desc);
alter table public.login_attempts enable row level security;
-- No policies — default deny for anon/authenticated; only reachable via
-- record_login_attempt() (SECURITY DEFINER) below.

-- ---------------------------------------------------------------------
-- record_login_attempt — call BEFORE trusting a login result. Returns
-- true if this email is currently locked out (5+ failures in the last
-- 15 minutes), in which case the caller should show a generic lockout
-- message regardless of whether the password just given was correct
-- (never reveal "this account doesn't exist" vs "wrong password").
-- ---------------------------------------------------------------------
create or replace function public.record_login_attempt(p_email text, p_succeeded boolean)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_recent_failures int;
begin
  insert into public.login_attempts (email, succeeded) values (lower(p_email), p_succeeded);

  if p_succeeded then
    -- A successful login clears the counter for this email.
    delete from public.login_attempts where email = lower(p_email) and succeeded = false;
    return false;
  end if;

  select count(*) into v_recent_failures
  from public.login_attempts
  where email = lower(p_email)
    and succeeded = false
    and created_at > now() - interval '15 minutes';

  perform public.log_audit(
    'Failed login attempt',
    'auth_security',
    format('email=%s recent_failures=%s', lower(p_email), v_recent_failures),
    case when v_recent_failures >= 5 then 'High' else 'Low' end
  );

  return v_recent_failures >= 5;
end;
$function$;

-- ---------------------------------------------------------------------
-- check_device / trust_device — run AFTER a successful password check,
-- for the now-authenticated caller (auth.uid()).
-- ---------------------------------------------------------------------
create or replace function public.check_device(p_device_id text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.known_devices
    where user_id = auth.uid() and device_id = p_device_id
  );
$function$;

create or replace function public.trust_device(p_device_id text, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.known_devices (user_id, device_id, user_agent)
  values (auth.uid(), p_device_id, p_user_agent)
  on conflict (user_id, device_id)
  do update set last_seen_at = now(), user_agent = coalesce(excluded.user_agent, public.known_devices.user_agent);

  perform public.log_audit('Device trusted', 'auth_security', format('device=%s', p_device_id), 'Low');
end;
$function$;
