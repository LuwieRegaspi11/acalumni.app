-- =====================================================================
-- EMAIL EVERY NOTIFICATION
--
-- Whenever a row is added to public.notifications, this trigger asks the
-- `email-notification` Edge Function (supabase/functions/email-notification)
-- to email it to that account, so people don't have to open the portal to
-- find out. Works for every role (admin, batch rep, alumni) and every kind
-- of notification (rep offers and answers, donation received / verified /
-- rejected, new events, and so on).
--
-- BEFORE YOU RUN THIS: change the two values marked  <<< CHANGE ME  below.
--   * v_secret  must be the SAME text you set as the WEBHOOK_SECRET secret
--               on the Edge Function (any long random string).
--   * v_url     is already your project's address; leave it unless you
--               moved projects.
--
-- It can never block a notification: if the email call fails for any
-- reason, the in-app notification is still saved.
--
-- Safe to re-run.
-- =====================================================================

create extension if not exists pg_net with schema extensions;

-- Notifications that notify-alumni already emails itself are flagged so
-- nobody receives two copies.
alter table public.notifications
  add column if not exists skip_email boolean not null default false;

create or replace function public.email_new_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url    text := 'https://amzteigyblhrbycussys.supabase.co/functions/v1/email-notification';
  v_secret text := 'CHANGE-ME-to-the-same-WEBHOOK_SECRET';   -- <<< CHANGE ME
begin
  if new.skip_email then
    return new;
  end if;

  begin
    perform net.http_post(
      url     := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
      body    := jsonb_build_object('type', 'INSERT', 'record', to_jsonb(new))
    );
  exception when others then
    -- never let an email problem stop the notification itself
    null;
  end;

  return new;
end;
$$;

drop trigger if exists email_new_notification on public.notifications;
create trigger email_new_notification
  after insert on public.notifications
  for each row execute function public.email_new_notification();
