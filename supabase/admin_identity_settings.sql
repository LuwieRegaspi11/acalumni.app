-- =====================================================================
-- ADMIN IDENTITY SETTINGS — feature toggles for the Identity
-- Verification feature, added to the existing `system_settings`
-- singleton row (edited from SystemSettings.tsx, same as every other
-- branding/config field there).
--
-- Run once via Supabase SQL Editor (or MCP apply_migration). Safe to
-- re-run: column adds are guarded.
-- =====================================================================

alter table public.system_settings
  add column if not exists enable_face_verification boolean not null default false,
  add column if not exists force_mfa_all_logins boolean not null default false;
