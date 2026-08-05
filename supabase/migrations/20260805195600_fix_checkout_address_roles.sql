-- Keep checkout address roles consistent when customers switch between a
-- separate billing address and "billing same as shipping".
create or replace function public.save_customer_checkout_defaults(
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_shipping_address jsonb,
  p_billing_entity text,
  p_billing_address jsonb,
  p_billing_same_as_shipping boolean,
  p_gstin text,
  p_billing_email text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_shipping_id uuid;
  v_billing_id uuid;
  v_shipping jsonb := coalesce(p_shipping_address, '{}'::jsonb);
  v_billing jsonb := case
    when p_billing_same_as_shipping then coalesce(p_shipping_address, '{}'::jsonb)
    else coalesce(p_billing_address, '{}'::jsonb)
  end;
  v_phone text := nullif(btrim(p_phone), '');
  v_gstin text := nullif(upper(btrim(p_gstin)), '');
  v_billing_email text := nullif(lower(btrim(p_billing_email)), '');
  v_is_business boolean := nullif(upper(btrim(p_gstin)), '') is not null;
begin
  if v_user_id is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if public.current_account_type() <> 'customer' then raise exception 'CUSTOMER_ACCESS_REQUIRED'; end if;
  if btrim(coalesce(p_first_name, '')) = '' or btrim(coalesce(p_last_name, '')) = '' then raise exception 'CUSTOMER_NAME_REQUIRED'; end if;
  if v_phone is null or v_phone !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'VALID_PHONE_REQUIRED'; end if;
  if v_billing_email is null then raise exception 'BILLING_EMAIL_REQUIRED'; end if;
  if v_gstin is not null and v_gstin !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' then raise exception 'INVALID_GSTIN'; end if;

  if btrim(coalesce(v_shipping ->> 'addressLine1', '')) = ''
    or btrim(coalesce(v_shipping ->> 'city', '')) = ''
    or btrim(coalesce(v_shipping ->> 'state', '')) = ''
    or coalesce(v_shipping ->> 'zip', '') !~ '^[1-9][0-9]{5}$' then
    raise exception 'INVALID_SHIPPING_ADDRESS';
  end if;
  if not p_billing_same_as_shipping and (
    btrim(coalesce(v_billing ->> 'addressLine1', '')) = ''
    or btrim(coalesce(v_billing ->> 'city', '')) = ''
    or btrim(coalesce(v_billing ->> 'state', '')) = ''
    or coalesce(v_billing ->> 'zip', '') !~ '^[1-9][0-9]{5}$'
  ) then raise exception 'INVALID_BILLING_ADDRESS'; end if;

  update public.profiles
  set first_name = left(btrim(p_first_name), 80),
      last_name = left(btrim(p_last_name), 80),
      phone = v_phone,
      onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = v_user_id;

  select id into v_shipping_id from public.addresses
  where user_id = v_user_id and is_default_shipping order by updated_at desc limit 1;
  select id into v_billing_id from public.addresses
  where user_id = v_user_id and is_default_billing order by updated_at desc limit 1;

  update public.addresses
  set is_default_shipping = false, is_default_billing = false
  where user_id = v_user_id and (is_default_shipping or is_default_billing);

  if v_shipping_id is null then
    insert into public.addresses(
      user_id, label, contact_name, phone, line1, line2, city, state,
      postal_code, country_code, is_default_shipping, is_default_billing
    ) values (
      v_user_id, 'Default delivery address',
      left(btrim(p_first_name || ' ' || p_last_name), 160), v_phone,
      btrim(v_shipping ->> 'addressLine1'), nullif(btrim(v_shipping ->> 'addressLine2'), ''),
      btrim(v_shipping ->> 'city'), btrim(v_shipping ->> 'state'),
      btrim(v_shipping ->> 'zip'), 'IN', true, p_billing_same_as_shipping
    ) returning id into v_shipping_id;
  else
    update public.addresses
    set label = 'Default delivery address',
        contact_name = left(btrim(p_first_name || ' ' || p_last_name), 160),
        phone = v_phone,
        line1 = btrim(v_shipping ->> 'addressLine1'),
        line2 = nullif(btrim(v_shipping ->> 'addressLine2'), ''),
        city = btrim(v_shipping ->> 'city'), state = btrim(v_shipping ->> 'state'),
        postal_code = btrim(v_shipping ->> 'zip'), country_code = 'IN',
        is_default_shipping = true, is_default_billing = p_billing_same_as_shipping
    where id = v_shipping_id and user_id = v_user_id;
  end if;

  if p_billing_same_as_shipping then
    -- The customer deliberately replaced the previous default billing address.
    -- Removing that former default prevents it becoming an untyped row that the
    -- account UI could later misclassify as a shipping address.
    if v_billing_id is not null and v_billing_id <> v_shipping_id then
      delete from public.addresses
      where id = v_billing_id and user_id = v_user_id;
    end if;
  else
    if v_billing_id = v_shipping_id then v_billing_id := null; end if;
    if v_billing_id is null then
      insert into public.addresses(
        user_id, label, contact_name, phone, line1, line2, city, state,
        postal_code, country_code, is_default_shipping, is_default_billing
      ) values (
        v_user_id, 'Default billing address',
        left(coalesce(nullif(btrim(p_billing_entity), ''), btrim(p_first_name || ' ' || p_last_name)), 160),
        v_phone, btrim(v_billing ->> 'addressLine1'), nullif(btrim(v_billing ->> 'addressLine2'), ''),
        btrim(v_billing ->> 'city'), btrim(v_billing ->> 'state'), btrim(v_billing ->> 'zip'),
        'IN', false, true
      ) returning id into v_billing_id;
    else
      update public.addresses
      set label = 'Default billing address',
          contact_name = left(coalesce(nullif(btrim(p_billing_entity), ''), btrim(p_first_name || ' ' || p_last_name)), 160),
          phone = v_phone, line1 = btrim(v_billing ->> 'addressLine1'),
          line2 = nullif(btrim(v_billing ->> 'addressLine2'), ''),
          city = btrim(v_billing ->> 'city'), state = btrim(v_billing ->> 'state'),
          postal_code = btrim(v_billing ->> 'zip'), country_code = 'IN',
          is_default_shipping = false, is_default_billing = true
      where id = v_billing_id and user_id = v_user_id;
    end if;
  end if;

  insert into public.customer_billing_profiles(
    user_id, profile_type, legal_business_name, gstin, billing_email, billing_address
  ) values (
    v_user_id, case when v_is_business then 'business' else 'personal' end,
    case when v_is_business then nullif(btrim(p_billing_entity), '') else null end,
    v_gstin, v_billing_email, v_billing
  )
  on conflict(user_id) do update set
    profile_type = excluded.profile_type,
    legal_business_name = excluded.legal_business_name,
    gstin = excluded.gstin,
    billing_email = excluded.billing_email,
    billing_address = excluded.billing_address;
end;
$$;

revoke all on function public.save_customer_checkout_defaults(text,text,text,jsonb,text,jsonb,boolean,text,text) from public, anon;
grant execute on function public.save_customer_checkout_defaults(text,text,text,jsonb,text,jsonb,boolean,text,text) to authenticated, service_role;
