-- =====================================================================
-- EXPENSE RECEIPTS — adds a `receipt_url` column to `campaign_expenses`
-- so that when an admin logs what a campaign's funds were spent on
-- (Donation Management -> Log Expense), they can optionally attach a
-- receipt/invoice image as evidence. Alumni then see a "View Receipt"
-- link next to that line item on their Fund Transparency page.
--
-- Run this once in Supabase -> SQL Editor -> New query -> Run.
-- (The `donations`, `donation_campaigns`, and `campaign_expenses`
-- tables themselves, and the `donation-proofs` Storage bucket, were
-- created directly in the Supabase dashboard for this project and
-- aren't tracked in this repo's schema.sql — this file only adds the
-- one new column needed for receipts.)
-- =====================================================================

alter table public.campaign_expenses
  add column if not exists receipt_url text;

-- Receipts are stored in the SAME private `donation-proofs` Storage
-- bucket already used for donors' proof-of-payment uploads, under the
-- uploading admin's own folder (e.g. "<admin-user-id>/169...-ab12cd.jpg"),
-- and read back via short-lived signed URLs — no new bucket or storage
-- policy needed as long as the existing bucket already allows any
-- signed-in user to upload into a folder matching their own auth.uid().
-- If your `donation-proofs` bucket's insert policy is scoped to a
-- specific role (e.g. only 'alumni'), update it to also allow 'admin'
-- so this upload doesn't get rejected:
--
--   create policy "Admins can upload expense receipts"
--     on storage.objects for insert
--     with check (
--       bucket_id = 'donation-proofs'
--       and auth.uid()::text = (storage.foldername(name))[1]
--     );
