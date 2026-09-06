-- =====================================================================
-- ALUMNI TRACER INTAKE — JOB HISTORY COLUMNS
--
-- alumni_tracer_intake.sql deliberately left number_of_employers /
-- reasons_for_leaving_job(+_other) off this table when it was created,
-- because the official Graduate Tracer Survey document doesn't ask that
-- question and neither survey form was collecting it at the time (see
-- that file's header comment, and lib/graduateTracerSurveyOptions.ts's).
--
-- The college has since asked for "why did you leave your previous
-- job?" back on the survey — tracerSurveySections.tsx's Employment
-- Information section collects it again now, right after "How many
-- companies have you worked for since graduation?" (the same placement
-- graduate_tracer_job_history.sql originally gave it on
-- graduate_tracer_responses, which already carries these columns from
-- before the realignment — see that file). tracer-intake/index.ts's
-- ANSWER_COLUMNS now carries all three fields on every insert it makes
-- into THIS table too (handleSubmit, handleBulkImport, and
-- updateExistingRecord all spread pickAnswerColumns() into an
-- alumni_tracer_intake row) — without this migration those inserts
-- would fail outright with an unknown-column error the moment a
-- submission actually answers this question.
--
-- Same conventions as graduate_tracer_job_history.sql: single-select ->
-- text, multi-select checkbox group -> jsonb, its "Other" free text ->
-- text. No RLS changes needed — the existing policies on
-- alumni_tracer_intake already cover every column on the row.
-- =====================================================================

alter table public.alumni_tracer_intake
  add column if not exists number_of_employers text,
  add column if not exists reasons_for_leaving_job jsonb,
  add column if not exists reasons_for_leaving_job_other text;
