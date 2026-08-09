-- Narrow fixes for schema-lint findings in reachable production functions.

begin;

alter function public.replace_configuration_artwork_file(jsonb,integer,text,uuid)
stable;

revoke all on function public.capture_order_artwork_requirement(),
  public.replace_configuration_artwork_file(jsonb,integer,text,uuid),
  public.configuration_artwork_file_ids(jsonb)
from public,anon,authenticated;

create or replace function public.validate_discount_code(
  p_code text,p_customer_user_id uuid,p_subtotal_paise bigint
)
returns table(discount_code_id uuid, normalized_code text, discount_paise bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code public.discount_codes%rowtype;
  v_used bigint;
  v_reserved bigint;
  v_customer_used bigint;
  v_customer_reserved bigint;
  v_discount bigint;
begin
  if nullif(btrim(p_code),'') is null then return; end if;
  select * into v_code
  from public.discount_codes d
  where d.code=upper(btrim(p_code))
    and d.active
    and (d.starts_at is null or d.starts_at<=now())
    and (d.ends_at is null or d.ends_at>now());
  if not found or p_subtotal_paise < v_code.minimum_subtotal_paise then
    raise exception 'DISCOUNT_CODE_INVALID';
  end if;

  select count(*) into v_used
  from public.discount_redemptions d
  where d.discount_code_id=v_code.id;
  select count(*) into v_reserved
  from public.discount_reservations r
  join public.custom_checkout_sessions s on s.id = r.checkout_session_id
  where r.discount_code_id=v_code.id
    and r.status='active'
    and (r.expires_at>now() or s.status in ('payment_initiated','payment_pending','payment_verified'));
  select count(*) into v_customer_used
  from public.discount_redemptions d
  where d.discount_code_id=v_code.id and d.customer_user_id=p_customer_user_id;
  select count(*) into v_customer_reserved
  from public.discount_reservations r
  join public.custom_checkout_sessions s on s.id = r.checkout_session_id
  where r.discount_code_id=v_code.id
    and r.customer_user_id=p_customer_user_id
    and r.status='active'
    and (r.expires_at>now() or s.status in ('payment_initiated','payment_pending','payment_verified'));

  if (v_code.maximum_redemptions is not null and v_used+v_reserved>=v_code.maximum_redemptions)
     or v_customer_used+v_customer_reserved>=v_code.maximum_redemptions_per_customer then
    raise exception 'DISCOUNT_CODE_LIMIT_REACHED';
  end if;

  v_discount := case when v_code.kind='percentage'
    then round(p_subtotal_paise * v_code.percentage_basis_points / 10000.0)::bigint
    else v_code.fixed_amount_paise
  end;
  v_discount := least(v_discount,p_subtotal_paise,coalesce(v_code.maximum_discount_paise,v_discount));
  return query select v_code.id,upper(v_code.code::text),v_discount;
end;
$$;

revoke all on function public.validate_discount_code(text,uuid,bigint)
from public,anon;
grant execute on function public.validate_discount_code(text,uuid,bigint)
to authenticated,service_role;

commit;
