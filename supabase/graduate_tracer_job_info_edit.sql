-- =====================================================================
-- GRADUATE TRACER JOB INFO EDIT — additive follow-up to
-- graduate_tracer_response_lock.sql. Touches no existing table other
-- than the policy + trigger named below.
--
-- Product decision (superseding graduate_tracer_response_lock.sql's
-- "once submitted, a response is permanent" rule for ONE part of the
-- row only): an alumnus/rep may keep their Employment Status +
-- Employment Information up to date from their Profile page
-- ("Job Information" card — see shared/JobInfoCard.tsx) even after
-- their Graduate Tracer Survey response is submitted, so admin/faculty's
-- Alumni Tracer / Tracer Responses screens always show current job data
-- instead of a snapshot frozen at submission time. Every other section
-- (Graduate Profile, Curriculum & Outcomes, Licensure, Feedback) stays
-- exactly as permanent as it already was.
--
-- Two parts:
--   1. The UPDATE policy reverts to graduate_tracer_survey.sql's
--      original row-ownership-only check (no `status = 'draft'`
--      requirement) — an owner can issue an UPDATE at any status.
--   2. A new BEFORE UPDATE trigger is what actually enforces the "only
--      these columns, and only once already submitted" rule: once
--      OLD.status = 'submitted', any change to a column NOT in the
--      Employment Status / Employment Information group (including
--      status, submitted_at, and respondent_id itself) is rejected.
--      This is enforced at the database layer even if a request
--      bypasses the UI (shared/JobInfoCard.tsx's own patch only ever
--      contains the allowed columns, but that's belt-and-braces, not
--      the actual boundary).
--
-- Safe to re-run: DROP POLICY/TRIGGER/FUNCTION IF EXISTS + CREATE. No
-- data is changed, no other policy/table is touched.
-- =====================================================================

drop policy if exists "Alumni can update their own tracer response" on public.graduate_tracer_responses;

create policy "Alumni can update their own tracer response"
  on public.graduate_tracer_responses for update
  using (auth.uid() = respondent_id)
  with check (auth.uid() = respondent_id);

-- No `security definer` here (unlike some other trigger functions in this
-- codebase) — this one only diffs OLD vs NEW column values, calls no
-- privileged helper, and needs no elevated privilege, so it stays a plain
-- SECURITY INVOKER function, matching batch_representative_assignment_guard.sql's
-- guard_representative_assignment() and notify_and_rep_edit_hardening.sql's
-- guard_representative_profile_edit(). A `security definer` trigger function
-- here would (and initially did) trip the Supabase security advisor's
-- "Public Can Execute SECURITY DEFINER Function" lint for no actual benefit,
-- since Postgres exposes every public-schema function as a PostgREST RPC by
-- default regardless of whether anything ever legitimately calls it that way.
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
    -- company_organization, job_classification(+_other), industry_sector(+_other),
    -- job_related_to_degree, time_to_first_job, number_of_employers,
    -- reasons_for_leaving_job(+_other), monthly_salary_range, first_job_source(+_other),
    -- current_work_location, job_satisfaction_rating, job_securing_factors(+_other)
    -- — is free to change.
  end if;
  NEW.updated_at = now();
  return NEW;
end;
$$;

drop trigger if exists graduate_tracer_edit_lock on public.graduate_tracer_responses;

create trigger graduate_tracer_edit_lock
  before update on public.graduate_tracer_responses
  for each row execute function public.enforce_graduate_tracer_edit_lock();
