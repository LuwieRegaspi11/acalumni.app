-- =====================================================================
-- GRADUATE TRACER CONTACT INFO EDIT — additive follow-up to
-- graduate_tracer_edit_lock_service_role_bypass.sql (the function this
-- redefines), same pattern already applied to Employment Status/
-- Information in graduate_tracer_job_info_edit.sql. Touches no existing
-- table other than the trigger function named below — the UPDATE policy
-- (owner can UPDATE at any status) and the service_role/null `auth.role()`
-- bypass already in place both still apply unchanged.
--
-- Product decision: an alumnus/rep may also keep their contact details —
-- Mobile Number, Social Network ID, Current Address, Permanent Address —
-- up to date from their own Profile page (see shared/ProfilePage.tsx)
-- even after their Graduate Tracer Survey response is submitted, the
-- same way Employment fields already work from that page's "Job
-- Information" card. This is also what replaced the admin's old "Edit
-- Contact Info" dialog on the Alumni Tracer screen (see
-- shared/AlumniManagementView.tsx) — that dialog used to be the only way
-- to fix a wrong mobile number/address once submitted; now the alumnus
-- fixes it themselves, and it shows up on that same screen automatically
-- (AlumniManagementView reads these columns live on every load).
--
-- Every other Graduate Profile field — First Name, Last Name, Sex, Civil
-- Status, Year Graduated, College Department, Program Graduated, plus
-- the identity fields Date of Birth and Email — stays exactly as
-- permanent as it already was. Curriculum, Licensure, and Feedback are
-- untouched by this migration and stay permanent too.
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
      -- Graduate Profile identity/matching fields — permanent
      or NEW.first_name is distinct from OLD.first_name
      or NEW.last_name is distinct from OLD.last_name
      or NEW.sex is distinct from OLD.sex
      or NEW.civil_status is distinct from OLD.civil_status
      or NEW.year_graduated is distinct from OLD.year_graduated
      or NEW.college_department is distinct from OLD.college_department
      or NEW.program_graduated is distinct from OLD.program_graduated
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
      raise exception 'Only Employment Status, Employment Information, and contact detail fields may be edited after a Graduate Tracer Survey response has been submitted.';
    end if;
    -- Free to change post-submission:
    --   - Employment Status / Employment Information (see
    --     graduate_tracer_job_info_edit.sql for the full column list)
    --   - Contact details: mobile_number, social_network_id,
    --     current_address, permanent_address (this migration)
  end if;
  NEW.updated_at = now();
  return NEW;
end;
$$;
