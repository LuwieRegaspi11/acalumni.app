-- Security hardening found during the full-system audit. Safe to re-run.

-- 1) notify_role could be called by ANY signed-in account to push (and e-mail)
--    a notification to every alumni. Alumni still need it to alert the Alumni Head /
--    batch reps about their own donation, so: admins and representatives may notify
--    any role; alumni may only notify admin / representative accounts.
create or replace function public.notify_role(
  p_role text, p_title text, p_message text,
  p_type text default 'info', p_department text default null
) returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_caller text := public.current_user_role();
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;
  if p_role not in ('admin', 'alumni', 'representative') then
    raise exception 'invalid role';
  end if;
  if coalesce(v_caller, '') not in ('admin', 'representative') and p_role = 'alumni' then
    raise exception 'not authorized to notify alumni';
  end if;

  insert into public.notifications (user_id, title, message, type)
  select p.id, left(p_title, 200), left(p_message, 1000), coalesce(p_type, 'info')
  from public.profiles p
  where p.role = p_role
    and (
      p_department is null
      or p.department = p_department
      or p.assigned_department = p_department
    );
end;
$$;

-- 2) Functions that only make sense for a signed-in user should not be callable
--    by the anonymous (logged-out) role.
revoke execute on function public.admin_list_accounts() from anon;
revoke execute on function public.log_audit(text, text, text, text) from anon;
revoke execute on function public.notify_my_batch(text, text, text) from anon;
revoke execute on function public.notify_role(text, text, text, text, text) from anon;
revoke execute on function public.trust_device(text, text) from anon;
revoke execute on function public.check_device(text) from anon;
