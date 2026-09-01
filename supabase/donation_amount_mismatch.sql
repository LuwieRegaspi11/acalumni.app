-- =====================================================================
-- DONATION AMOUNT MISMATCH — stores the amount the receipt-scanner (OCR)
-- detected on the uploaded proof, separately from the amount the donor
-- typed in. The app compares the two and flags a mismatch for extra
-- admin scrutiny instead of blocking submission.
--
-- Run this once in Supabase -> SQL Editor -> New query -> Run.
-- Safe to re-run: column add is guarded.
-- =====================================================================

alter table public.donations
  add column if not exists detected_amount numeric;
