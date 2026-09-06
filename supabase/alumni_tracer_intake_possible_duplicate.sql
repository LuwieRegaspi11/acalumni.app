-- =====================================================================
-- ALUMNI TRACER INTAKE — POSSIBLE DUPLICATE (unverified identity match)
--
-- tracer-intake/index.ts's handleSubmit already resets an existing
-- account's password automatically when a resubmission's Name +
-- Birthdate + Department + Program all match what's on file (see
-- alumni_tracer_intake_job_history.sql-era comments and that function's
-- own header). But it can't safely do that when the identity DOESN'T
-- fully match — resetting a real alumnus's password from an unverified
-- claim would let a wrong or malicious submission lock out the actual
-- owner. That case now queues into Pending Registrations instead of a
-- flat error: `possible_duplicate_profile_id` records which existing
-- profile this submission's email collided with, distinct from
-- `linked_profile_id` (which means "this really is confirmed to be
-- their own account"). An admin reviews it, and only if they manually
-- confirm it's really the same person does approving reset the
-- password (see handleReview's new "possible duplicate" branch) —
-- rejecting just discards the request, untouched.
-- =====================================================================

alter table public.alumni_tracer_intake
  add column if not exists possible_duplicate_profile_id uuid references public.profiles(id) on delete set null;
