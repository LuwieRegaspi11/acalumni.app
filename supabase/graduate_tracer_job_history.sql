-- =====================================================================
-- GRADUATE TRACER JOB HISTORY — additive migration onto
-- public.graduate_tracer_responses (see graduate_tracer_survey.sql).
-- Adds two new Employment Information questions, asked right after
-- "How long did it take you to land your first job after graduation?":
--   1. "How many companies have you worked for since graduation?"
--      -> number_of_employers (single-select)
--   2. "If you have changed employers, what were the primary reasons
--      for leaving your previous job? (select up to 3)" — only shown
--      on the form when #1 isn't "1 (Current employer is my first
--      employer)" -> reasons_for_leaving_job (multi-select, up to 3)
--      + reasons_for_leaving_job_other for its "Other" free text.
--
-- Same conventions as the original table: single-select -> text,
-- multi-select checkbox group -> jsonb, its "Other" free text -> text.
-- No RLS changes needed — the existing policies on
-- graduate_tracer_responses already cover every column on the row.
-- =====================================================================

alter table public.graduate_tracer_responses
  add column if not exists number_of_employers text,
  add column if not exists reasons_for_leaving_job jsonb,
  add column if not exists reasons_for_leaving_job_other text;
