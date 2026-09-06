-- =====================================================================
-- GRADUATE TRACER EDIT LOCK — SERVICE ROLE BYPASS
--
-- enforce_graduate_tracer_edit_lock() (graduate_tracer_job_info_edit.sql,
-- restated in alumni_tracer_intake.sql) permanently locks a submitted
-- Graduate Tracer response's identity/curriculum/licensure/feedback
-- fields — the right rule for an alumnus editing their own row via
-- shared/JobInfoCard.tsx. But it has no bypass for anything else, which
-- turned out to block even a deliberate admin data fix from the
-- Supabase SQL Editor (had to manually disable/re-enable the trigger by
-- hand to correct two historical rows where a name fragment had landed
-- in mobile_number instead of a phone number).
--
-- This adds the same bypass guard_registration_status() already uses
-- (registration_status_guard.sql) for exactly this class of problem:
-- trust direct DB connections and the service_role key, keep the lock
-- fully in place for ordinary signed-in users going through PostgREST
-- (auth.role() = 'authenticated'). In practice this is what lets the
-- `tracer-intake` Edge Function's admin-only "bulk_import" action
-- overwrite an existing alumnus's record when an admin picks "Update
-- existing record" for a detected duplicate (see
-- admin/BulkImportResponses.tsx) — service_role, not the admin's own
-- authenticated session, does that write.
--
-- Run once via Supabase SQL Editor (or MCP apply_migration). Safe to
-- re-run: function is CREATE OR REPLACE, behavior identical for every
-- caller this didn't change.
-- =====================================================================

create or replace function public.enforce_graduate_tracer_edit_lock()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() is null or auth.role() = 'service_role' then
    NEW.updated_at = now();
    return NEW;
  end if;

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
    -- job_related_to_degree, time_to_first_job, monthly_salary_range,
    -- first_job_source(+_other), current_work_location, job_satisfaction_rating,
    -- job_securing_factors(+_other) — is free to change.
  end if;
  NEW.updated_at = now();
  return NEW;
end;
$$;
