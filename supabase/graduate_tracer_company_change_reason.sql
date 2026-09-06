-- =====================================================================
-- GRADUATE TRACER — REASON FOR CHANGING EMPLOYER
--
-- shared/JobInfoCard.tsx (the alumni Profile page's editable "Job
-- Information" section) now asks WHY, whenever an alumnus edits their
-- Company / Organization to something different from what's already on
-- file: a required single-select of 3 common reasons + "Other" free
-- text (COMPANY_CHANGE_REASON_OPTIONS in
-- lib/graduateTracerSurveyOptions.ts), gated on an actual change (both
-- the old and new company names non-empty and different) — filling the
-- field in for the first time, or clearing it out, doesn't ask.
--
-- Deliberately separate from graduate_tracer_job_history.sql's
-- reasons_for_leaving_job(+_other) (the Graduate Tracer Survey's own,
-- broader "select up to 3 of 12" question about employers since
-- graduation, asked once at survey time): this one is a lightweight,
-- single-select prompt tied to a live edit action, asked every time it
-- happens, not just once at initial submission.
--
-- JobInfoCard.tsx writes this directly under the alumnus's own
-- authenticated session (same as every other Employment Information
-- column) — no service_role/edge-function involvement, and no edit-lock
-- trigger change needed: enforce_graduate_tracer_edit_lock() only
-- blocks the columns it explicitly lists, so a brand-new column is free
-- to change by default, exactly like company_organization itself.
-- =====================================================================

alter table public.graduate_tracer_responses
  add column if not exists company_change_reason text,
  add column if not exists company_change_reason_other text;
