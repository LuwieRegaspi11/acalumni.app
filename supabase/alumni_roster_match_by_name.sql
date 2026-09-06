-- =====================================================================
-- ALUMNI ROSTER MATCH BY NAME — removes Student/Alumni ID Number from
-- the Alumni Tracer Survey and everywhere it fed into: the roster match
-- that decides a public tracer submission's registration_status now
-- runs on First Name + Last Name + Department + Program instead of
-- Student/Alumni ID + Last Name (see supabase/functions/tracer-intake/
-- index.ts's handleSubmit for the new matching query).
--
-- Run once via Supabase SQL Editor (or MCP apply_migration). Safe to
-- re-run: every drop is guarded with IF EXISTS and every function is
-- CREATE OR REPLACE.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. alumni_roster — student_id was its primary key; replace it with a
-- surrogate id now that matching is by name/department/program instead.
-- ---------------------------------------------------------------------
alter table public.alumni_tracer_intake
  drop constraint if exists alumni_tracer_intake_matched_student_id_fkey;

alter table public.alumni_roster
  add column if not exists id uuid not null default gen_random_uuid();

alter table public.alumni_roster drop constraint if exists alumni_roster_pkey;
alter table public.alumni_roster add primary key (id);
alter table public.alumni_roster drop column if exists student_id;

-- Speeds up the exact-match lookup handleSubmit runs on every
-- submission; not unique, since more than one roster row can share a
-- name/department/program combination.
create index if not exists alumni_roster_match_idx
  on public.alumni_roster (lower(first_name), lower(last_name), lower(department), lower(program));

-- ---------------------------------------------------------------------
-- 2. alumni_tracer_intake — drop the ID-based identity/match columns,
-- add a proper FK to the roster row a submission matched (if any).
-- ---------------------------------------------------------------------
alter table public.alumni_tracer_intake
  add column if not exists matched_roster_id uuid references public.alumni_roster(id) on delete set null;

alter table public.alumni_tracer_intake
  drop column if exists student_id,
  drop column if exists matched_student_id;

-- ---------------------------------------------------------------------
-- 3. graduate_tracer_responses / profiles — drop the same identity
-- column added by alumni_tracer_intake.sql / student_roster_verification.sql.
-- ---------------------------------------------------------------------
alter table public.graduate_tracer_responses drop column if exists student_id;
alter table public.profiles drop column if exists student_id;

-- ---------------------------------------------------------------------
-- 4. handle_new_user() — stop inserting a student_id (column is gone).
-- Everything else matches the live function unchanged.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (
    id, name, email, role, department, batch_year, program, profile_image,
    phone, address, id_type, id_document_url, registration_status
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    new.email,
    'alumni',
    new.raw_user_meta_data->>'department',
    nullif(new.raw_user_meta_data->>'batch_year', '')::int,
    new.raw_user_meta_data->>'program',
    new.raw_user_meta_data->>'profile_image',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'address',
    new.raw_user_meta_data->>'id_type',
    new.raw_user_meta_data->>'id_document',
    'pending'
  )
  on conflict (id) do nothing;
  return new;
exception
  when others then
    raise warning 'handle_new_user() failed to create a profiles row for user % (%): % (SQLSTATE %)',
      new.id, new.email, sqlerrm, sqlstate;
    raise;
end;
$function$;

-- ---------------------------------------------------------------------
-- 5. enforce_graduate_tracer_edit_lock() — drop the NEW.student_id
-- check (column is gone from graduate_tracer_responses); everything
-- else, including the service_role bypass, matches the live function
-- unchanged.
-- ---------------------------------------------------------------------
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
  end if;
  NEW.updated_at = now();
  return NEW;
end;
$$;
