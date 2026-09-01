-- =====================================================================
-- GRADUATE TRACER RESPONSE LOCK — additive follow-up to
-- graduate_tracer_survey.sql. Touches no existing table, column,
-- function, or trigger other than the one policy named below.
--
-- Context: graduate_tracer_survey.sql's original update policy let an
-- alumnus update their tracer response row at any time, including after
-- status was already 'submitted' — its own comment even noted this
-- ("covers draft saves, final submit, AND later edits after
-- submission") and how to close it off (`and status = 'draft'`) if
-- post-submission edits were ever unwanted.
--
-- Product decision: once submitted, a response is permanent — it's
-- reported to the admin Tracer Responses page as-is and must not change
-- afterward. This migration replaces that one policy so an UPDATE is
-- only allowed while the row's *current* status is still 'draft'.
-- USING is evaluated against the row as it exists before the write, so
-- this still permits the draft -> submitted transition (old status is
-- 'draft' at that moment) while blocking every write once status is
-- already 'submitted' — including a second "submit" upsert, so this is
-- enforced at the database layer even if a request bypasses the UI.
-- The companion GraduateTracerForm.tsx change hides the edit UI itself
-- once a response is submitted, so a real user never hits this.
--
-- WITH CHECK deliberately does NOT also require status = 'draft' on the
-- new row — that would block the legitimate draft -> submitted write
-- itself. It keeps the original respondent_id ownership check only.
--
-- Safe to re-run: DROP POLICY IF EXISTS + CREATE POLICY. No data is
-- changed, no other policy or table is touched.
-- =====================================================================

drop policy if exists "Alumni can update their own tracer response" on public.graduate_tracer_responses;

create policy "Alumni can update their own tracer response"
  on public.graduate_tracer_responses for update
  using (auth.uid() = respondent_id and status = 'draft')
  with check (auth.uid() = respondent_id);
