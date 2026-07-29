create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;

select plan(34);

select has_table('public', 'auth_rate_limits', 'durable auth rate-limit table exists');
select has_column('public', 'profiles', 'terms_accepted_at', 'profile records terms acceptance');
select has_column('public', 'profiles', 'privacy_accepted_at', 'profile records privacy acceptance');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.auth_rate_limits'::regclass),
  'rate-limit table enables RLS'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.auth_rate_limits'::regclass),
  'rate-limit table forces RLS'
);
select ok(
  not has_table_privilege('anon', 'public.auth_rate_limits', 'SELECT'),
  'anonymous users cannot read rate-limit subjects'
);
select ok(
  not has_table_privilege('authenticated', 'public.auth_rate_limits', 'SELECT'),
  'authenticated users cannot read rate-limit subjects'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.consume_auth_rate_limit(text,text,integer,integer)',
    'EXECUTE'
  ),
  'service role can consume a durable rate limit'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.consume_auth_rate_limit(text,text,integer,integer)',
    'EXECUTE'
  ),
  'browser sessions cannot consume limits directly'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.complete_customer_onboarding(text,text,text,text,text,text,text,text,text,text,text)',
    'EXECUTE'
  ),
  'authenticated users can invoke reviewed onboarding'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.complete_customer_onboarding(text,text,text,text,text,text,text,text,text,text,text)',
    'EXECUTE'
  ),
  'anonymous users cannot invoke onboarding'
);

select ok(
  (select allowed from public.consume_auth_rate_limit(
    'login',
    repeat('a', 64),
    2,
    60
  )),
  'first durable rate-limit attempt is allowed'
);
select ok(
  (select allowed from public.consume_auth_rate_limit(
    'login',
    repeat('a', 64),
    2,
    60
  )),
  'second durable rate-limit attempt is allowed'
);
select ok(
  not (select allowed from public.consume_auth_rate_limit(
    'login',
    repeat('a', 64),
    2,
    60
  )),
  'attempt above the maximum is blocked'
);
select ok(
  (select retry_after_seconds from public.consume_auth_rate_limit(
    'login',
    repeat('a', 64),
    2,
    60
  )) > 0,
  'blocked requests receive a retry interval'
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token,
  is_sso_user,
  is_anonymous
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '66666666-6666-4666-8666-666666666666',
    'authenticated',
    'authenticated',
    'new.owner@garmops.local',
    extensions.crypt('LocalNewOwner123!', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    '',
    false,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '77777777-7777-4777-8777-777777777777',
    'authenticated',
    'authenticated',
    'unverified@garmops.local',
    extensions.crypt('LocalUnverified123!', extensions.gen_salt('bf')),
    null,
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    '',
    false,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '88888888-8888-4888-8888-888888888888',
    'authenticated',
    'authenticated',
    'invited.staff@garmops.local',
    extensions.crypt('LocalInvited123!', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    '',
    false,
    false
  );

select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;

select lives_ok(
  $$
    select public.complete_customer_onboarding(
      'New',
      'Owner',
      '+919876543210',
      'Founder',
      'Leadership',
      'Phase Four Private Limited',
      'https://phase-four.example',
      '',
      'Apparel',
      '2026-07-29',
      '2026-07-29'
    )
  $$,
  'verified user onboarding succeeds atomically'
);

reset role;
select ok(
  exists (
    select 1
    from public.profiles
    where id = '66666666-6666-4666-8666-666666666666'
      and terms_version = '2026-07-29'
      and privacy_version = '2026-07-29'
      and onboarding_completed_at is not null
  ),
  'onboarding records the profile and legal versions'
);
select ok(
  exists (
    select 1
    from public.organization_members
    where user_id = '66666666-6666-4666-8666-666666666666'
      and role = 'owner'
      and status = 'active'
  ),
  'first registrant becomes active organization owner'
);
select is(
  (
    select count(*)
    from public.organizations
    where created_by = '66666666-6666-4666-8666-666666666666'
  ),
  1::bigint,
  'onboarding creates exactly one organization'
);
select ok(
  exists (
    select 1
    from public.audit_logs
    where actor_user_id = '66666666-6666-4666-8666-666666666666'
      and action = 'organization.created_during_onboarding'
  ),
  'customer onboarding is audited'
);

select set_config('request.jwt.claim.sub', '77777777-7777-4777-8777-777777777777', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select throws_ok(
  $$
    select public.complete_customer_onboarding(
      'Not',
      'Verified',
      '+919876543211',
      '',
      '',
      'Unverified Private Limited',
      '',
      '',
      '',
      '2026-07-29',
      '2026-07-29'
    )
  $$,
  'P0001',
  'verified email required',
  'unverified users cannot create an organization'
);

reset role;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select throws_ok(
  $$
    select public.provision_staff_invitation(
      '88888888-8888-4888-8888-888888888888',
      'Invited',
      'Staff',
      'support',
      'Customer Success'
    )
  $$,
  'P0001',
  'staff management permission required',
  'staff invitation is denied below AAL2'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    select public.provision_staff_invitation(
      '88888888-8888-4888-8888-888888888888',
      'Invited',
      'Staff',
      'support',
      'Customer Success'
    )
  $$,
  'MFA super admin can provision an invitation'
);

reset role;
select ok(
  exists (
    select 1
    from public.staff_members
    where user_id = '88888888-8888-4888-8888-888888888888'
      and not active
      and must_use_mfa
      and activated_at is null
  ),
  'invited staff remains inactive before MFA'
);
select ok(
  exists (
    select 1
    from public.audit_logs
    where target_id = '88888888-8888-4888-8888-888888888888'
      and action = 'staff.invited'
  ),
  'staff invitation is audited'
);

select set_config('request.jwt.claim.sub', '88888888-8888-4888-8888-888888888888', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select throws_ok(
  $$ select public.activate_invited_staff() $$,
  'P0001',
  'authenticator MFA required',
  'invited staff cannot activate at AAL1'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select lives_ok(
  $$ select public.activate_invited_staff() $$,
  'invited staff activates after TOTP AAL2'
);

reset role;
select ok(
  exists (
    select 1
    from public.staff_members
    where user_id = '88888888-8888-4888-8888-888888888888'
      and active
      and activated_at is not null
  ),
  'MFA activation makes the invited staff record active'
);
select ok(
  exists (
    select 1
    from public.audit_logs
    where target_id = '88888888-8888-4888-8888-888888888888'
      and action = 'staff.invitation_activated'
  ),
  'staff activation is audited'
);

select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select lives_ok(
  $$ select public.deactivate_staff_member('88888888-8888-4888-8888-888888888888') $$,
  'MFA super admin can deactivate another staff member'
);

reset role;
select ok(
  exists (
    select 1
    from public.staff_members
    where user_id = '88888888-8888-4888-8888-888888888888'
      and not active
      and deactivated_at is not null
  ),
  'deactivation immediately revokes active staff status'
);
select ok(
  exists (
    select 1
    from public.audit_logs
    where target_id = '88888888-8888-4888-8888-888888888888'
      and action = 'staff.deactivated'
  ),
  'staff deactivation is audited'
);

select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select throws_ok(
  $$ select public.deactivate_staff_member('44444444-4444-4444-8444-444444444444') $$,
  'P0001',
  'self deactivation is not allowed',
  'staff administrators cannot deactivate themselves'
);

reset role;
select set_config('request.jwt.claim.sub', '88888888-8888-4888-8888-888888888888', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;
select throws_ok(
  $$ select public.record_staff_login() $$,
  'P0001',
  'active staff member required',
  'deactivated staff cannot record or regain staff access'
);

select * from finish();
rollback;
