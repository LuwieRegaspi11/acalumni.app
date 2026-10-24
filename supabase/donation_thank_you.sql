-- =====================================================================
-- THANK THE DONOR THE MOMENT THEY DONATE
--
-- When a donation is submitted, the donor immediately gets a thank-you
-- notification in the portal. Because every notification is also emailed
-- (see email_notifications.sql), they receive it by email too — they don't
-- have to open their account to read it. (The pop-up thank-you in the
-- donation screen is in the app itself, and the admin's "Donation Verified"
-- notification already thanks them again once the payment is confirmed.)
--
-- Run after email_notifications.sql. Safe to re-run.
-- =====================================================================

create or replace function public.thank_donor_on_donation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name     text;
  v_campaign text;
begin
  select split_part(btrim(name), ' ', 1) into v_name from public.profiles where id = new.donor_id;
  select name into v_campaign from public.donation_campaigns where id = new.campaign_id;

  begin  -- a notification problem must never block a donation
    insert into public.notifications (user_id, title, message, type)
    values (
      new.donor_id,
      'Thank you for your donation!',
      format(
        'Thank you, %s! We received your donation of ₱%s to %s. Your generosity helps Asian College students and alumni. The Alumni Head will verify your proof of payment and you will be notified once it is confirmed.',
        coalesce(nullif(v_name, ''), 'friend'),
        to_char(new.amount, 'FM999,999,999,990.00'),
        coalesce(v_campaign, 'the General Fund')
      ),
      'success'
    );
  exception when others then
    null;
  end;

  return new;
end;
$$;

drop trigger if exists thank_donor_on_donation on public.donations;
create trigger thank_donor_on_donation
  after insert on public.donations
  for each row execute function public.thank_donor_on_donation();
