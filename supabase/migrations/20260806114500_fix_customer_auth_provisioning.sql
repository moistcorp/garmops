-- Make customer provisioning reliable for OTP and OAuth sign-ins.
-- Authentication creates the auth.users row first; this RPC then creates the
-- matching application profile and reserves the email as a customer account.

begin;

create or replace function public.ensure_customer_account(
  p_terms_version text,
  p_privacy_version text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_meta jsonb;
  v_first text;
  v_last text;
  v_email_principal public.account_principals%rowtype;
  v_user_principal public.account_principals%rowtype;
  v_email_principal_found boolean := false;
  v_user_principal_found boolean := false;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  -- An authenticated OTP/OAuth session is authoritative here. Requiring a
  -- particular auth.users confirmation timestamp made provisioning dependent
  -- on provider-specific metadata even after a valid session existed.
  select lower(btrim(email::text)), coalesce(raw_user_meta_data, '{}'::jsonb)
  into v_email, v_meta
  from auth.users
  where id = v_user_id
    and email is not null;

  if v_email is null or v_email = '' then
    raise exception 'VERIFIED_EMAIL_REQUIRED';
  end if;

  select *
  into v_email_principal
  from public.account_principals
  where normalized_email = v_email
  for update;
  v_email_principal_found := found;

  select *
  into v_user_principal
  from public.account_principals
  where user_id = v_user_id
  for update;
  v_user_principal_found := found;

  if v_email_principal_found then
    if v_email_principal.account_type <> 'customer' then
      raise exception 'ACCOUNT_TYPE_CONFLICT';
    end if;
    if not v_email_principal.active then
      raise exception 'ACCOUNT_DISABLED';
    end if;
    if v_email_principal.user_id is not null
       and v_email_principal.user_id <> v_user_id then
      raise exception 'ACCOUNT_TYPE_CONFLICT';
    end if;
  end if;

  if v_user_principal_found then
    if v_user_principal.account_type <> 'customer' then
      raise exception 'ACCOUNT_TYPE_CONFLICT';
    end if;
    if not v_user_principal.active then
      raise exception 'ACCOUNT_DISABLED';
    end if;
  end if;

  if v_email_principal_found
     and v_user_principal_found
     and v_email_principal.id <> v_user_principal.id then
    raise exception 'ACCOUNT_TYPE_CONFLICT';
  end if;

  v_first := left(
    btrim(coalesce(
      nullif(btrim(v_meta ->> 'given_name'), ''),
      nullif(btrim(split_part(
        coalesce(nullif(btrim(v_meta ->> 'full_name'), ''), split_part(v_email, '@', 1)),
        ' ',
        1
      )), ''),
      'Customer'
    )),
    80
  );
  if v_first = '' then v_first := 'Customer'; end if;

  v_last := left(
    btrim(coalesce(nullif(btrim(v_meta ->> 'family_name'), ''), 'Account')),
    80
  );
  if v_last = '' then v_last := 'Account'; end if;

  insert into public.profiles(
    id,
    first_name,
    last_name,
    onboarding_completed_at,
    terms_accepted_at,
    terms_version,
    privacy_accepted_at,
    privacy_version
  )
  values(
    v_user_id,
    v_first,
    v_last,
    now(),
    now(),
    p_terms_version,
    now(),
    p_privacy_version
  )
  on conflict(id) do update set
    terms_accepted_at = coalesce(public.profiles.terms_accepted_at, excluded.terms_accepted_at),
    terms_version = coalesce(public.profiles.terms_version, excluded.terms_version),
    privacy_accepted_at = coalesce(public.profiles.privacy_accepted_at, excluded.privacy_accepted_at),
    privacy_version = coalesce(public.profiles.privacy_version, excluded.privacy_version);

  if v_user_principal_found then
    update public.account_principals
    set normalized_email = v_email
    where id = v_user_principal.id;
  elsif v_email_principal_found then
    update public.account_principals
    set user_id = v_user_id
    where id = v_email_principal.id;
  else
    insert into public.account_principals(
      user_id,
      normalized_email,
      account_type,
      active,
      created_by
    )
    values(v_user_id, v_email, 'customer', true, v_user_id);
  end if;

  if not exists(
    select 1
    from public.account_principals
    where user_id = v_user_id
      and normalized_email = v_email
      and account_type = 'customer'
      and active
  ) then
    raise exception 'ACCOUNT_TYPE_CONFLICT';
  end if;

  return v_user_id;
end;
$$;

revoke all on function public.ensure_customer_account(text, text)
from public, anon;
grant execute on function public.ensure_customer_account(text, text)
to authenticated, service_role;

-- Ensure PostgREST immediately sees the replaced RPC signature/permissions.
notify pgrst, 'reload schema';

commit;
