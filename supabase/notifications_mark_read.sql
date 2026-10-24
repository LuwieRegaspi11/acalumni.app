-- =====================================================================
-- NOTIFICATIONS — let each account mark its OWN notifications as read.
-- The app now saves "read" to the database (it never did before). If the
-- notifications table has no UPDATE policy, that save is silently refused
-- and notifications reappear as unread after a refresh. This adds one,
-- limited to the signed-in user's own rows. Safe to re-run.
-- =====================================================================
alter table public.notifications enable row level security;

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
