-- =====================================================================
-- ADMIN ACCOUNT REASSIGNMENT
-- Replaces the old admin profile with a new one across every table
-- that has a foreign key into public.profiles(id), then deletes the
-- old profile row.
--
-- Old admin : leregaspi.student@asiancollege.edu.ph
-- New admin : admin@asiancollege.edu.ph
--
-- Run this in Supabase Dashboard -> SQL Editor -> New query.
-- Safe to re-run: every step is idempotent (UPDATE/UPSERT by id, a
-- guarded DELETE that no-ops once the row is gone).
--
-- Recommended flow:
--   1. Run STEP 0 - STEP 4 (everything up to and including the
--      verification SELECT).
--   2. Look at the verification SELECT's output - every "remaining"
--      column must read 0.
--   3. Only then run STEP 5 (the guarded delete). It re-checks the
--      same counts itself and refuses to delete if anything still
--      points at the old id, so running the whole file top-to-bottom
--      in one go is also safe.
--
-- NOT included here on purpose: deleting the old `auth.users` row.
-- Do that afterwards via Dashboard -> Authentication -> Users ->
-- Delete user (or supabase.auth.admin.deleteUser), not raw SQL -
-- Supabase Auth keeps related state (sessions, identities, refresh
-- tokens) in sync when you delete through it; a manual `delete from
-- auth.users` bypasses that.
-- =====================================================================

-- ---------------------------------------------------------------------
-- STEP 0. Identify old/new accounts by email (change these two lines
-- if you ever reuse this script for a different handover).
-- ---------------------------------------------------------------------
set myapp.old_admin_email = 'leregaspi.student@asiancollege.edu.ph';
set myapp.new_admin_email = 'admin@asiancollege.edu.ph';

drop table if exists _admin_migration_ids;
create temp table _admin_migration_ids as
select
  (select id from auth.users where email = current_setting('myapp.old_admin_email')) as old_id,
  (select id from auth.users where email = current_setting('myapp.new_admin_email')) as new_id;

-- Guard: fail loudly instead of silently reassigning nothing / the
-- wrong thing if either email doesn't resolve to an auth user, or
-- resolves to the same user, or the old id doesn't match the id you
-- were expecting to retire.
do $$
declare
  v_old uuid;
  v_new uuid;
begin
  select old_id, new_id into v_old, v_new from _admin_migration_ids;

  if v_old is null then
    raise exception 'Old admin email % not found in auth.users', current_setting('myapp.old_admin_email');
  end if;
  if v_new is null then
    raise exception 'New admin email % not found in auth.users - create that auth user first (Dashboard -> Authentication -> Users -> Add user, or have them sign up)', current_setting('myapp.new_admin_email');
  end if;
  if v_old = v_new then
    raise exception 'Old and new admin resolved to the same auth user id (%) - refusing to proceed', v_old;
  end if;
  if v_old <> '4905e522-57bd-4142-8fa3-85eaf232dd50'::uuid then
    raise exception 'Old admin id resolved to % but expected 4905e522-57bd-4142-8fa3-85eaf232dd50 - double-check the email', v_old;
  end if;

  raise notice 'Old admin id: %, New admin id: %', v_old, v_new;
end $$;

-- ---------------------------------------------------------------------
-- STEP 1. Create/activate the new admin profile.
-- Inserts the row if it doesn't exist yet; if it already exists
-- (as here - it's currently role=admin but pending/inactive) it's
-- promoted/activated instead. Idempotent either way.
-- ---------------------------------------------------------------------
insert into public.profiles (id, name, email, role, registration_status, active)
select
  m.new_id,
  coalesce(nullif(u.raw_user_meta_data->>'name', ''), u.email),
  u.email,
  'admin',
  'approved',
  true
from _admin_migration_ids m
join auth.users u on u.id = m.new_id
on conflict (id) do update
  set role = 'admin',
      registration_status = 'approved',
      active = true;

-- ---------------------------------------------------------------------
-- STEP 2. Reassign every FK reference from the old admin id to the
-- new admin id. Each UPDATE is a plain by-value swap, so re-running
-- this script simply affects 0 rows the second time.
-- ---------------------------------------------------------------------

-- Events the old admin created
update public.events e
set created_by = m.new_id
from _admin_migration_ids m
where e.created_by = m.old_id;

-- Announcements the old admin posted
update public.announcements a
set created_by = m.new_id
from _admin_migration_ids m
where a.created_by = m.old_id;

-- Job postings the old admin approved/posted
update public.job_postings j
set posted_by = m.new_id
from _admin_migration_ids m
where j.posted_by = m.old_id;

-- Tracer surveys the old admin authored
update public.tracer_surveys t
set created_by = m.new_id
from _admin_migration_ids m
where t.created_by = m.old_id;

-- Tracer survey responses submitted under the old admin id
update public.tracer_survey_responses r
set respondent_id = m.new_id
from _admin_migration_ids m
where r.respondent_id = m.old_id;

-- Event registrations under the old admin id
update public.event_registrations er
set alumni_id = m.new_id
from _admin_migration_ids m
where er.alumni_id = m.old_id;

-- Donations under the old admin id
update public.donations d
set donor_id = m.new_id
from _admin_migration_ids m
where d.donor_id = m.old_id;

-- Notifications addressed to the old admin id
update public.notifications n
set user_id = m.new_id
from _admin_migration_ids m
where n.user_id = m.old_id;

-- Batch-verification credit (profiles.batch_verified_by is
-- self-referencing profiles.id)
update public.profiles p
set batch_verified_by = m.new_id
from _admin_migration_ids m
where p.batch_verified_by = m.old_id;

-- Audit log actor attribution.
-- NOTE: audit_logs is meant to be an immutable trail of who actually
-- performed each historical action. Rewriting actor_id here means
-- past entries will read as if the NEW admin performed them, which
-- may not be what you want for compliance/record-keeping. Comment
-- this UPDATE out if you'd rather leave historical audit_logs rows
-- pointing at the old id (they won't block the delete below only if
-- their count is 0, which it currently is - see verification step).
update public.audit_logs al
set actor_id = m.new_id
from _admin_migration_ids m
where al.actor_id = m.old_id;

-- ---------------------------------------------------------------------
-- STEP 3. Sanity checks on the new admin profile.
-- ---------------------------------------------------------------------
select p.*
from public.profiles p
join _admin_migration_ids m on m.new_id = p.id;

-- ---------------------------------------------------------------------
-- STEP 4. VERIFY - every count below must be 0 before you run STEP 5.
-- ---------------------------------------------------------------------
select
  (select count(*) from public.events              where created_by     = m.old_id) as events_remaining,
  (select count(*) from public.announcements       where created_by     = m.old_id) as announcements_remaining,
  (select count(*) from public.job_postings        where posted_by      = m.old_id) as job_postings_remaining,
  (select count(*) from public.tracer_surveys       where created_by     = m.old_id) as tracer_surveys_remaining,
  (select count(*) from public.tracer_survey_responses where respondent_id = m.old_id) as tracer_responses_remaining,
  (select count(*) from public.event_registrations  where alumni_id      = m.old_id) as event_registrations_remaining,
  (select count(*) from public.donations            where donor_id       = m.old_id) as donations_remaining,
  (select count(*) from public.notifications         where user_id        = m.old_id) as notifications_remaining,
  (select count(*) from public.profiles              where batch_verified_by = m.old_id) as batch_verified_by_remaining,
  (select count(*) from public.audit_logs            where actor_id       = m.old_id) as audit_logs_remaining
from _admin_migration_ids m;

-- ---------------------------------------------------------------------
-- STEP 5. Guarded delete of the old admin profile.
-- Re-checks all nine referencing tables itself; aborts with a clear
-- error instead of a raw FK-violation if anything still points at
-- the old id. No-ops cleanly if the row is already gone (re-run safe).
-- ---------------------------------------------------------------------
do $$
declare
  v_old uuid;
  v_remaining bigint;
begin
  select old_id into v_old from _admin_migration_ids;

  select
    (select count(*) from public.events               where created_by        = v_old) +
    (select count(*) from public.announcements        where created_by        = v_old) +
    (select count(*) from public.job_postings         where posted_by         = v_old) +
    (select count(*) from public.tracer_surveys        where created_by        = v_old) +
    (select count(*) from public.tracer_survey_responses where respondent_id    = v_old) +
    (select count(*) from public.event_registrations   where alumni_id         = v_old) +
    (select count(*) from public.donations             where donor_id          = v_old) +
    (select count(*) from public.notifications          where user_id           = v_old) +
    (select count(*) from public.profiles               where batch_verified_by = v_old) +
    (select count(*) from public.audit_logs             where actor_id          = v_old)
  into v_remaining;

  if v_remaining > 0 then
    raise exception 'Refusing to delete profile %: % row(s) still reference it. Re-run STEP 2 or inspect STEP 4''s output.', v_old, v_remaining;
  end if;

  delete from public.profiles where id = v_old;
  raise notice 'Deleted old admin profile % (or it was already gone).', v_old;
end $$;

-- ---------------------------------------------------------------------
-- STEP 6. Final confirmation - should return 0 rows.
-- ---------------------------------------------------------------------
select * from public.profiles where id = '4905e522-57bd-4142-8fa3-85eaf232dd50'::uuid;

-- Reminder: the old auth.users row (same id) still exists at this
-- point. Delete it via Dashboard -> Authentication -> Users, or via
-- the Admin API, whenever you're ready - not with raw SQL.
