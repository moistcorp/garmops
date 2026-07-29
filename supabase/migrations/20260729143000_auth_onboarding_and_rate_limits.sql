-- Garmops Phase 4: verified customer onboarding, invite-only staff activation,
-- audited staff lifecycle operations, and durable server-side rate limits.

alter table public.profiles
  add column terms_accepted_at timestamptz,
  add column terms_version text
    check (
      terms_version is null
      or (terms_version = btrim(terms_version) and char_length(terms_version) between 1 and 40)
    ),
  add column privacy_accepted_at timestamptz,
  add column privacy_version text
    check (
      privacy_version is null
      or (privacy_version = btrim(privacy_version) and char_length(privacy_version) between 1 and 40)
    ),
  add constraint profiles_terms_acceptance_complete
    check ((terms_accepted_at is null) = (terms_version is null)),
  add constraint profiles_privacy_acceptance_complete
    check ((privacy_accepted_at is null) = (privacy_version is null));

create table public.auth_rate_limits (
  scope text not null
    check (
      scope in (
        'register',
        'login',
        'forgot_password',
        'resend_verification',
        'contact',
        'mfa',
        'staff_invite'
      )
    ),
  subject_hash text not null
    check (subject_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0
    check (attempts between 0 and 10000),
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (scope, subject_hash)
);

alter table public.auth_rate_limits enable row level security;
alter table public.auth_rate_limits force row level security;

revoke all privileges on table public.auth_rate_limits
  from public, anon, authenticated;

create function public.consume_auth_rate_limit(
  p_scope text,
  p_subject_hash text,
  p_max_attempts integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.auth_rate_limits%rowtype;
  v_now timestamptz := clock_timestamp();
  v_window interval;
begin
  if p_scope not in (
    'register',
    'login',
    'forgot_password',
    'resend_verification',
    'contact',
    'mfa',
    'staff_invite'
  ) then
    raise exception 'unsupported rate-limit scope';
  end if;
  if p_subject_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid rate-limit subject';
  end if;
  if p_max_attempts < 1 or p_max_attempts > 1000 then
    raise exception 'invalid rate-limit maximum';
  end if;
  if p_window_seconds < 10 or p_window_seconds > 86400 then
    raise exception 'invalid rate-limit window';
  end if;

  v_window := make_interval(secs => p_window_seconds);

  insert into public.auth_rate_limits (
    scope,
    subject_hash,
    window_started_at,
    attempts,
    updated_at
  )
  values (p_scope, p_subject_hash, v_now, 0, v_now)
  on conflict (scope, subject_hash) do nothing;

  select *
  into v_row
  from public.auth_rate_limits
  where scope = p_scope
    and subject_hash = p_subject_hash
  for update;

  if v_row.blocked_until is not null and v_row.blocked_until > v_now then
    return query
      select
        false,
        0,
        greatest(1, ceil(extract(epoch from (v_row.blocked_until - v_now)))::integer);
    return;
  end if;

  if v_row.window_started_at + v_window <= v_now then
    v_row.window_started_at := v_now;
    v_row.attempts := 1;
    v_row.blocked_until := null;
  else
    v_row.attempts := v_row.attempts + 1;
  end if;

  if v_row.attempts > p_max_attempts then
    v_row.blocked_until := v_row.window_started_at + v_window;
  end if;

  update public.auth_rate_limits
  set
    window_started_at = v_row.window_started_at,
    attempts = v_row.attempts,
    blocked_until = v_row.blocked_until,
    updated_at = v_now
  where scope = p_scope
    and subject_hash = p_subject_hash;

  return query
    select
      v_row.attempts <= p_max_attempts,
      greatest(0, p_max_attempts - v_row.attempts),
      case
        when v_row.attempts <= p_max_attempts then 0
        else greatest(
          1,
          ceil(extract(epoch from (v_row.blocked_until - v_now)))::integer
        )
      end;
end;
$$;

create function public.complete_customer_onboarding(
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_job_title text,
  p_department text,
  p_company_name text,
  p_website text,
  p_gstin text,
  p_industry text,
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
  v_organization_id uuid;
  v_slug text;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  select email::text
  into v_email
  from auth.users
  where id = v_user_id
    and email_confirmed_at is not null;

  if v_email is null then
    raise exception 'verified email required';
  end if;
  if p_terms_version <> '2026-07-29'
    or p_privacy_version <> '2026-07-29' then
    raise exception 'current legal terms must be accepted';
  end if;

  select membership.organization_id
  into v_organization_id
  from public.organization_members as membership
  where membership.user_id = v_user_id
    and membership.status = 'active'
  order by membership.created_at
  limit 1;

  if v_organization_id is not null then
    return v_organization_id;
  end if;

  insert into public.profiles (
    id,
    first_name,
    last_name,
    phone,
    job_title,
    department,
    onboarding_completed_at,
    terms_accepted_at,
    terms_version,
    privacy_accepted_at,
    privacy_version
  )
  values (
    v_user_id,
    p_first_name,
    p_last_name,
    nullif(p_phone, ''),
    nullif(p_job_title, ''),
    nullif(p_department, ''),
    now(),
    now(),
    p_terms_version,
    now(),
    p_privacy_version
  )
  on conflict (id) do update
  set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    phone = excluded.phone,
    job_title = excluded.job_title,
    department = excluded.department,
    onboarding_completed_at = excluded.onboarding_completed_at,
    terms_accepted_at = excluded.terms_accepted_at,
    terms_version = excluded.terms_version,
    privacy_accepted_at = excluded.privacy_accepted_at,
    privacy_version = excluded.privacy_version;

  v_slug := trim(both '-' from regexp_replace(
    lower(p_company_name),
    '[^a-z0-9]+',
    '-',
    'g'
  ));
  if char_length(v_slug) < 2 then
    v_slug := 'organization';
  end if;
  v_slug := left(v_slug, 67) || '-' || left(replace(gen_random_uuid()::text, '-', ''), 12);

  insert into public.organizations (
    legal_name,
    display_name,
    slug,
    industry,
    website,
    gstin,
    billing_email,
    phone,
    created_by
  )
  values (
    p_company_name,
    p_company_name,
    v_slug,
    nullif(p_industry, ''),
    nullif(p_website, ''),
    nullif(upper(p_gstin), ''),
    v_email,
    nullif(p_phone, ''),
    v_user_id
  )
  returning id into v_organization_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    status,
    accepted_at
  )
  values (
    v_organization_id,
    v_user_id,
    'owner',
    'active',
    now()
  );

  insert into public.audit_logs (
    actor_user_id,
    actor_type,
    action,
    target_type,
    target_id,
    organization_id,
    after_state
  )
  values (
    v_user_id,
    'customer',
    'organization.created_during_onboarding',
    'organization',
    v_organization_id,
    v_organization_id,
    jsonb_build_object('role', 'owner')
  );

  return v_organization_id;
end;
$$;

create function public.provision_staff_invitation(
  p_user_id uuid,
  p_first_name text,
  p_last_name text,
  p_role public.staff_role,
  p_team text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.staff_has_permission('manage_staff') then
    raise exception 'staff management permission required';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'self role changes are not allowed';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'invited auth user does not exist';
  end if;
  if exists (select 1 from public.staff_members where user_id = p_user_id) then
    raise exception 'staff member already exists';
  end if;

  insert into public.profiles (id, first_name, last_name)
  values (p_user_id, p_first_name, p_last_name)
  on conflict (id) do nothing;

  insert into public.staff_members (
    user_id,
    role,
    team,
    active,
    must_use_mfa,
    invited_by,
    invited_at
  )
  values (
    p_user_id,
    p_role,
    nullif(p_team, ''),
    false,
    true,
    auth.uid(),
    now()
  );

  insert into public.audit_logs (
    actor_user_id,
    actor_type,
    action,
    target_type,
    target_id,
    after_state
  )
  values (
    auth.uid(),
    'staff',
    'staff.invited',
    'staff_member',
    p_user_id,
    jsonb_build_object('role', p_role, 'team', nullif(p_team, ''))
  );
end;
$$;

create function public.activate_invited_staff()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'authenticator MFA required';
  end if;

  update public.staff_members
  set
    active = true,
    activated_at = now(),
    updated_at = now()
  where user_id = v_user_id
    and not active
    and invited_at is not null
    and activated_at is null
    and deactivated_at is null;

  if not found then
    if exists (
      select 1
      from public.staff_members
      where user_id = v_user_id
        and active
        and deactivated_at is null
    ) then
      return;
    end if;
    raise exception 'active staff invitation required';
  end if;

  insert into public.audit_logs (
    actor_user_id,
    actor_type,
    action,
    target_type,
    target_id,
    after_state
  )
  values (
    v_user_id,
    'staff',
    'staff.invitation_activated',
    'staff_member',
    v_user_id,
    jsonb_build_object('mfa', 'totp', 'aal', 'aal2')
  );
end;
$$;

create function public.deactivate_staff_member(p_user_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
begin
  if not public.staff_has_permission('manage_staff') then
    raise exception 'staff management permission required';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'self deactivation is not allowed';
  end if;

  select jsonb_build_object(
    'role', role,
    'team', team,
    'active', active
  )
  into v_before
  from public.staff_members
  where user_id = p_user_id
  for update;

  if v_before is null then
    raise exception 'staff member not found';
  end if;

  update public.staff_members
  set
    active = false,
    deactivated_at = coalesce(deactivated_at, now()),
    updated_at = now()
  where user_id = p_user_id;

  insert into public.audit_logs (
    actor_user_id,
    actor_type,
    action,
    target_type,
    target_id,
    before_state,
    after_state
  )
  values (
    auth.uid(),
    'staff',
    'staff.deactivated',
    'staff_member',
    p_user_id,
    v_before,
    jsonb_build_object('active', false)
  );
end;
$$;

create function public.record_staff_login()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'active MFA staff session required';
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

revoke all on function public.consume_auth_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.complete_customer_onboarding(
  text, text, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.provision_staff_invitation(
  uuid, text, text, public.staff_role, text
) from public, anon, authenticated;
revoke all on function public.activate_invited_staff()
  from public, anon, authenticated;
revoke all on function public.deactivate_staff_member(uuid)
  from public, anon, authenticated;
revoke all on function public.record_staff_login()
  from public, anon, authenticated;

grant execute on function public.consume_auth_rate_limit(
  text, text, integer, integer
) to service_role;
grant execute on function public.complete_customer_onboarding(
  text, text, text, text, text, text, text, text, text, text, text
) to authenticated, service_role;
grant execute on function public.provision_staff_invitation(
  uuid, text, text, public.staff_role, text
) to authenticated, service_role;
grant execute on function public.activate_invited_staff()
  to authenticated, service_role;
grant execute on function public.deactivate_staff_member(uuid)
  to authenticated, service_role;
grant execute on function public.record_staff_login()
  to authenticated, service_role;

comment on table public.auth_rate_limits is
  'Service-only durable fixed-window limits keyed by salted one-way subject hashes.';
comment on function public.complete_customer_onboarding(
  text, text, text, text, text, text, text, text, text, text, text
) is
  'Atomically creates the verified customer profile, organization, and owner membership.';
comment on function public.activate_invited_staff() is
  'Activates an invite-only staff record only after authenticator MFA reaches AAL2.';
