-- =====================================================================
-- ALUMNI TRACER INTAKE — replaces self-service registration with a
-- public Alumni Tracer Survey that doubles as the account-creation
-- form. No login is required to submit it.
--
-- Flow:
--   1. A visitor fills out the tracer survey at /tracer-survey
--      (alumni/PublicTracerSurveyPage.tsx) — the same field set as the
--      existing mandatory post-login survey (graduate_tracer_survey.sql)
--      plus Student/Alumni ID, Birthdate, Email, and Job Title.
--   2. The `tracer-intake` Edge Function (service_role only — this is
--      never reachable with the anon key) checks the submitted
--      Student/Alumni ID + Last Name against `alumni_roster`, the
--      admin-imported list of known graduates, then creates the login
--      itself (generated password, shown once) and writes a normal
--      `graduate_tracer_responses` row EITHER WAY — every submission
--      gets a real account immediately, matched or not:
--        MATCH    -> registration_status = 'approved'. Signing in goes
--                    straight to the dashboard.
--        NO MATCH -> registration_status = 'pending'. Signing in shows
--                    the existing pending-approval status page instead
--                    (same one any other pending account gets) until an
--                    admin reviews it in Pending Registrations
--                    (admin/PendingRegistrations.tsx) — Approve just
--                    flips the flag (there's no password left to relay,
--                    the alumnus already has their own); Reject blocks
--                    sign-in entirely. This row (`alumni_tracer_intake`)
--                    is what that review screen queries, and doubles as
--                    an audit trail (matched_student_id, reviewed_by,
--                    reviewed_at, rejection_reason) once resolved.
--
-- This is a deliberate, scoped reversal of registration_simplification.sql's
-- "every alumni signup needs manual review regardless of roster match"
-- policy — that policy applied to *self-chosen-password* signups, which
-- no longer exist after this change; every account from here on is
-- either roster-matched automatically or hand-approved by an admin, so
-- the self-service loophole that policy guarded against is gone.
--
-- Run once via Supabase SQL Editor (or MCP apply_migration). Safe to
-- re-run: every create is guarded / CREATE OR REPLACE.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ALUMNI ROSTER — the "existing alumni records" match source.
-- Admin-imported (CSV or manual entry) via admin/AlumniRoster.tsx.
-- Match key used by the Edge Function: student_id + lower(trim(last_name)).
-- ---------------------------------------------------------------------
create table if not exists public.alumni_roster (
  student_id text primary key,
  first_name text not null,
  last_name text not null,
  department text,
  program text,
  batch_year integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.alumni_roster enable row level security;

drop policy if exists "alumni_roster_select_admin" on public.alumni_roster;
create policy "alumni_roster_select_admin"
  on public.alumni_roster for select
  using (is_admin());

drop policy if exists "alumni_roster_write_admin" on public.alumni_roster;
create policy "alumni_roster_write_admin"
  on public.alumni_roster for all
  using (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------
-- 2. ALUMNI TRACER INTAKE — one row per public survey submission,
-- regardless of outcome. Mirrors every graduate_tracer_responses answer
-- column (kept in sync by hand, same as JobInfoCard.tsx/tracerFieldControls.tsx
-- already do) plus the identity fields this flow needs to match/create
-- a login, plus review bookkeeping.
--
-- RLS deliberately has NO anon/authenticated policy at all — the only
-- writer is the tracer-intake Edge Function's service_role client,
-- which bypasses RLS entirely. There is no direct public write surface
-- on this table.
--
-- number_of_employers / reasons_for_leaving_job(+_other) were left off
-- this table at creation time (that question wasn't being asked by
-- either survey form then) and were added later by
-- alumni_tracer_intake_job_history.sql once it was reinstated — see
-- that file for why, and lib/graduateTracerSurveyOptions.ts's header
-- comment for the question's history.
-- ---------------------------------------------------------------------
create table if not exists public.alumni_tracer_intake (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending'
    check (status in ('matched', 'pending', 'approved', 'rejected')),

  -- Identity / matching / login fields
  student_id text,
  date_of_birth date,
  email text,
  job_title text,

  -- Graduate Profile
  first_name text, last_name text,
  mobile_number text, social_network_id text,
  current_address text, permanent_address text,
  sex text, civil_status text,
  year_graduated integer, college_department text, program_graduated text,

  -- Employment Status
  employment_status text, employment_classification text,

  -- Employment Information
  company_organization text,
  job_classification text, job_classification_other text,
  industry_sector text, industry_sector_other text,
  job_related_to_degree text,
  time_to_first_job text,
  monthly_salary_range text,
  first_job_source text, first_job_source_other text,
  current_work_location text,
  job_satisfaction_rating integer check (job_satisfaction_rating >= 1 and job_satisfaction_rating <= 5),
  job_securing_factors jsonb, job_securing_factors_other text,

  -- Curriculum & Outcomes
  education_quality_rating integer check (education_quality_rating >= 1 and education_quality_rating <= 5),
  program_relevance text,
  competency_ratings jsonb,
  employability_experiences jsonb, employability_experiences_other text,
  areas_to_strengthen jsonb, areas_to_strengthen_other text,
  training_satisfaction_rating integer check (training_satisfaction_rating >= 1 and training_satisfaction_rating <= 5),

  -- Licensure & Development
  licensure_exam_status text,
  has_certifications text, certifications_detail text,
  has_professional_training text, professional_training_detail text,
  interested_in_alumni_activities text,
  preferred_alumni_activities jsonb, preferred_alumni_activities_other text,

  -- Feedback
  program_improvements jsonb, program_improvements_other text,
  additional_services_needed jsonb, additional_services_needed_other text,
  would_recommend_college text, additional_comments text,

  -- Review / provisioning bookkeeping
  matched_student_id text references public.alumni_roster(student_id) on delete set null,
  linked_profile_id uuid references public.profiles(id) on delete set null,
  linked_response_id uuid references public.graduate_tracer_responses(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  notes text,

  created_at timestamptz not null default now()
);

alter table public.alumni_tracer_intake enable row level security;

drop policy if exists "alumni_tracer_intake_select_admin" on public.alumni_tracer_intake;
create policy "alumni_tracer_intake_select_admin"
  on public.alumni_tracer_intake for select
  using (is_admin());

drop policy if exists "alumni_tracer_intake_update_admin" on public.alumni_tracer_intake;
create policy "alumni_tracer_intake_update_admin"
  on public.alumni_tracer_intake for update
  using (is_admin())
  with check (is_admin());

create index if not exists alumni_tracer_intake_status_idx on public.alumni_tracer_intake (status);

-- ---------------------------------------------------------------------
-- 3. New columns on graduate_tracer_responses — additive, nullable, so
-- every existing row/query is unaffected. These carry the same
-- identity fields collected at intake time onto the permanent record.
-- ---------------------------------------------------------------------
alter table public.graduate_tracer_responses
  add column if not exists student_id text,
  add column if not exists date_of_birth date,
  add column if not exists email text,
  add column if not exists job_title text;

-- ---------------------------------------------------------------------
-- 4. profiles.must_change_password — set true whenever the system (not
-- the alumnus) generates a password, cleared once they set their own.
-- Enforced by a dashboard-wide gate in App.tsx's ProtectedRoute, same
-- pattern as the existing mandatory-tracer-survey gate.
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

-- ---------------------------------------------------------------------
-- 5. Extend graduate_tracer_job_info_edit.sql's edit-lock trigger:
-- student_id / date_of_birth / email join the other Graduate Profile
-- fields as permanent-once-submitted. job_title is deliberately NOT
-- added here — it's an Employment Information field and stays editable
-- via shared/JobInfoCard.tsx after submission, same as company_organization.
-- ---------------------------------------------------------------------
create or replace function public.enforce_graduate_tracer_edit_lock()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if OLD.status = 'submitted' then
    if NEW.status is distinct from OLD.status
      or NEW.submitted_at is distinct from OLD.submitted_at
      or NEW.respondent_id is distinct from OLD.respondent_id
      -- Graduate Profile — permanent
      or NEW.first_name is distinct from OLD.first_name
      or NEW.last_name is distinct from OLD.last_name
      or NEW.mobile_number is distinct from OLD.mobile_number
      or NEW.social_network_id is distinct from OLD.social_network_id
      or NEW.current_address is distinct from OLD.current_address
      or NEW.permanent_address is distinct from OLD.permanent_address
      or NEW.sex is distinct from OLD.sex
      or NEW.civil_status is distinct from OLD.civil_status
      or NEW.year_graduated is distinct from OLD.year_graduated
      or NEW.college_department is distinct from OLD.college_department
      or NEW.program_graduated is distinct from OLD.program_graduated
      or NEW.student_id is distinct from OLD.student_id
      or NEW.date_of_birth is distinct from OLD.date_of_birth
      or NEW.email is distinct from OLD.email
      -- Curriculum & Graduate Outcomes Assessment — permanent
      or NEW.education_quality_rating is distinct from OLD.education_quality_rating
      or NEW.program_relevance is distinct from OLD.program_relevance
      or NEW.competency_ratings is distinct from OLD.competency_ratings
      or NEW.employability_experiences is distinct from OLD.employability_experiences
      or NEW.employability_experiences_other is distinct from OLD.employability_experiences_other
      or NEW.areas_to_strengthen is distinct from OLD.areas_to_strengthen
      or NEW.areas_to_strengthen_other is distinct from OLD.areas_to_strengthen_other
      or NEW.training_satisfaction_rating is distinct from OLD.training_satisfaction_rating
      -- Licensure & Professional Development — permanent
      or NEW.licensure_exam_status is distinct from OLD.licensure_exam_status
      or NEW.has_certifications is distinct from OLD.has_certifications
      or NEW.certifications_detail is distinct from OLD.certifications_detail
      or NEW.has_professional_training is distinct from OLD.has_professional_training
      or NEW.professional_training_detail is distinct from OLD.professional_training_detail
      or NEW.interested_in_alumni_activities is distinct from OLD.interested_in_alumni_activities
      or NEW.preferred_alumni_activities is distinct from OLD.preferred_alumni_activities
      or NEW.preferred_alumni_activities_other is distinct from OLD.preferred_alumni_activities_other
      -- Feedback & Recommendations — permanent
      or NEW.program_improvements is distinct from OLD.program_improvements
      or NEW.program_improvements_other is distinct from OLD.program_improvements_other
      or NEW.additional_services_needed is distinct from OLD.additional_services_needed
      or NEW.additional_services_needed_other is distinct from OLD.additional_services_needed_other
      or NEW.would_recommend_college is distinct from OLD.would_recommend_college
      or NEW.additional_comments is distinct from OLD.additional_comments
    then
      raise exception 'Only Employment Status and Employment Information fields may be edited after a Graduate Tracer Survey response has been submitted.';
    end if;
    -- Everything NOT listed above — employment_status, employment_classification,
    -- company_organization, job_title, job_classification(+_other), industry_sector(+_other),
    -- job_related_to_degree, time_to_first_job, number_of_employers,
    -- reasons_for_leaving_job(+_other), monthly_salary_range, first_job_source(+_other),
    -- current_work_location, job_satisfaction_rating, job_securing_factors(+_other)
    -- — is free to change.
  end if;
  NEW.updated_at = now();
  return NEW;
end;
$$;
