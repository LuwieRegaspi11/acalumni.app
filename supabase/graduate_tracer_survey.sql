-- =====================================================================
-- GRADUATE TRACER SURVEY — additive migration. Touches no existing
-- table, column, policy, function, or trigger.
--
-- Backs the mandatory post-approval survey gate: App.tsx's
-- ProtectedRoute redirects an approved alumni to /alumni/tracer-form
-- (GraduateTracerForm.tsx) whenever their row here is missing or still
-- 'draft'. The completion flag lives on THIS table (status) rather than
-- as a new column on public.profiles, specifically so nothing needs to
-- be ALTERed on that existing table.
--
-- Uses the same self-contained inline-subquery admin-check style already
-- documented as the fallback pattern in schema.sql's own comments,
-- rather than the is_admin() helper other newer migrations assume —
-- that helper isn't defined in any tracked supabase/*.sql file, so this
-- keeps the new table's RLS independently correct without relying on
-- unversioned state in the live database.
-- =====================================================================

create table if not exists public.graduate_tracer_responses (
  id uuid primary key default gen_random_uuid(),
  respondent_id uuid not null unique references public.profiles(id) on delete cascade,

  -- status is the completion flag the login gate checks:
  --   'draft'     -> alumni started but used "Save and continue later"
  --   'submitted' -> complete; gate stops firing for this account
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  submitted_at timestamptz,

  -- Graduate Profile
  first_name text, last_name text, mobile_number text, social_network_id text,
  current_address text, permanent_address text, sex text, civil_status text,
  year_graduated int, college_department text, program_graduated text,

  -- Employment Status
  employment_status text, employment_classification text,

  -- Employment Information (n/a if unemployed/studying — see conditional logic)
  company_organization text, job_classification text, job_classification_other text,
  industry_sector text, industry_sector_other text, job_related_to_degree text,
  time_to_first_job text, monthly_salary_range text,
  first_job_source text, first_job_source_other text, current_work_location text,
  job_satisfaction_rating int check (job_satisfaction_rating between 1 and 5),
  job_securing_factors jsonb, job_securing_factors_other text,

  -- Curriculum & Graduate Outcomes Assessment
  education_quality_rating int check (education_quality_rating between 1 and 5),
  program_relevance text,
  competency_ratings jsonb,             -- {"Communication Skills":"Excellent",...}
  employability_experiences jsonb, employability_experiences_other text,
  areas_to_strengthen jsonb, areas_to_strengthen_other text,
  training_satisfaction_rating int check (training_satisfaction_rating between 1 and 5),

  -- Licensure & Professional Development
  licensure_exam_status text,
  has_certifications text, certifications_detail text,
  has_professional_training text, professional_training_detail text,
  interested_in_alumni_activities text,
  preferred_alumni_activities jsonb, preferred_alumni_activities_other text,

  -- Feedback & Recommendations
  program_improvements jsonb, program_improvements_other text,
  additional_services_needed jsonb, additional_services_needed_other text,
  would_recommend_college text, additional_comments text,

  updated_at timestamptz not null default now()
);

alter table public.graduate_tracer_responses enable row level security;

-- Alumni create their own row (first "Save and continue later" or first submit)
create policy "Alumni can insert their own tracer response"
  on public.graduate_tracer_responses for insert
  with check (auth.uid() = respondent_id);

-- Alumni can update their own row — covers draft saves and the final submit.
-- UPDATE NOTE: post-submission edits are intentionally blocked — a response
-- is permanent once status = 'submitted'. See graduate_tracer_response_lock.sql,
-- which replaces this policy's `using()` with `and status = 'draft'`; that file
-- is the actual policy definition applied to the live database now.
--
-- The `with check` here isn't in the original build prompt but is added the
-- same way batch_representative_assignment_guard.sql and
-- registration_status_guard.sql already closed this exact gap elsewhere in
-- this codebase: `using()` alone re-verifies row ownership on write, but
-- Postgres RLS doesn't otherwise stop that same UPDATE from also changing
-- `respondent_id` itself away from the caller's own id (e.g. onto another
-- alumnus who has no row yet) via a direct PostgREST call bypassing the
-- app UI, which never does this. `respondent_id` should never change for
-- any row, so this is a plain `with check`, not a trigger.
create policy "Alumni can update their own tracer response"
  on public.graduate_tracer_responses for update
  using (auth.uid() = respondent_id)
  with check (auth.uid() = respondent_id);

create policy "Alumni can view their own tracer response"
  on public.graduate_tracer_responses for select
  using (auth.uid() = respondent_id);

create policy "Admins can view all tracer responses"
  on public.graduate_tracer_responses for select
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- Notes:
-- - Required-field validation (`not null`) is intentionally left to the frontend, not
--   the column definitions — a `'draft'` row can be partially filled. Enforce "all
--   required fields present" only when `status` is being set to `'submitted'`.
-- - `unique` on `respondent_id` = one row per alumni, draft or submitted, ever.
-- - Every checkbox/multi-select group -> `jsonb` array. Every 1-5 rating -> `int` with
--   a check constraint.
