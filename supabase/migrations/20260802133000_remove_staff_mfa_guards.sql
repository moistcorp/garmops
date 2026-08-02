-- Credential-only staff access: remove the remaining MFA-era function guards.

create or replace function public.staff_has_permission(p_permission_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.staff_role;
begin
  v_role := public.current_staff_role();

  if v_role is null then
    return false;
  end if;

  return case p_permission_name
    when 'view_profiles' then true
    when 'view_organizations' then true
    when 'view_all_orders' then true
    when 'view_internal_notes' then true
    when 'change_order_status' then v_role <> 'read_only'
    when 'view_payment_payload' then true
    else false
  end;
end;
$$;

create or replace function public.record_staff_login()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'active staff session required';
  end if;

  update public.staff_members
  set last_staff_login_at = now(), updated_at = now()
  where user_id = auth.uid()
    and active
    and deactivated_at is null;

  if not found then
    raise exception 'active staff member required';
  end if;
end;
$$;

revoke all on function public.staff_has_permission(text) from public, anon;
grant execute on function public.staff_has_permission(text) to authenticated, service_role;

revoke all on function public.record_staff_login() from public, anon;
grant execute on function public.record_staff_login() to authenticated, service_role;
