-- Deterministic local-only identities.
-- These credentials are intentionally public development fixtures and must
-- never be copied into a hosted Supabase project.

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
    '11111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'owner.alpha@garmops.local',
    extensions.crypt('LocalOwner123!', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Asha","last_name":"Mehta"}',
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
    '22222222-2222-4222-8222-222222222222',
    'authenticated',
    'authenticated',
    'buyer.alpha@garmops.local',
    extensions.crypt('LocalBuyer123!', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Kabir","last_name":"Rao"}',
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
    '33333333-3333-4333-8333-333333333333',
    'authenticated',
    'authenticated',
    'owner.beta@garmops.local',
    extensions.crypt('LocalBeta123!', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Naina","last_name":"Singh"}',
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
    '44444444-4444-4444-8444-444444444444',
    'authenticated',
    'authenticated',
    'admin@garmops.local',
    extensions.crypt('LocalAdmin123!', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Dev","last_name":"Admin"}',
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
    '55555555-5555-4555-8555-555555555555',
    'authenticated',
    'authenticated',
    'readonly@garmops.local',
    extensions.crypt('LocalReadOnly123!', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Riya","last_name":"Observer"}',
    now(),
    now(),
    '',
    '',
    '',
    '',
    false,
    false
  );

insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  id,
  id,
  id::text,
  jsonb_build_object('sub', id::text, 'email', email),
  'email',
  now(),
  now(),
  now()
from auth.users
where id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555'
);

insert into public.profiles (
  id,
  first_name,
  last_name,
  phone,
  job_title,
  department,
  onboarding_completed_at
)
values
  ('11111111-1111-4111-8111-111111111111', 'Asha', 'Mehta', '+919810000001', 'Procurement Lead', 'Procurement', now()),
  ('22222222-2222-4222-8222-222222222222', 'Kabir', 'Rao', '+919810000002', 'Brand Manager', 'Marketing', now()),
  ('33333333-3333-4333-8333-333333333333', 'Naina', 'Singh', '+919810000003', 'Founder', 'Leadership', now()),
  ('44444444-4444-4444-8444-444444444444', 'Dev', 'Admin', '+919810000004', 'Operations Administrator', 'Operations', now()),
  ('55555555-5555-4555-8555-555555555555', 'Riya', 'Observer', '+919810000005', 'Operations Observer', 'Operations', now());

insert into public.organizations (
  id,
  legal_name,
  display_name,
  slug,
  industry,
  website,
  billing_email,
  phone,
  created_by
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Alpha Events Private Limited',
    'Alpha Events',
    'alpha-events',
    'Music & Events',
    'https://alpha.example',
    'accounts@alpha.example',
    '+919810000010',
    '11111111-1111-4111-8111-111111111111'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Beta Hospitality Private Limited',
    'Beta Hospitality',
    'beta-hospitality',
    'Hotels & Restaurants',
    'https://beta.example',
    'accounts@beta.example',
    '+919810000020',
    '33333333-3333-4333-8333-333333333333'
  );

insert into public.organization_members (
  organization_id,
  user_id,
  role,
  status,
  accepted_at
)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'owner', 'active', now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'buyer', 'active', now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333', 'owner', 'active', now());

insert into public.staff_members (
  user_id,
  role,
  team,
  active,
  must_use_mfa,
  invited_at,
  activated_at
)
values
  (
    '44444444-4444-4444-8444-444444444444',
    'super_admin',
    'Operations',
    true,
    true,
    now(),
    now()
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    'read_only',
    'Operations',
    true,
    true,
    now(),
    now()
  );

update public.staff_members
set invited_by = '44444444-4444-4444-8444-444444444444'
where user_id = '55555555-5555-4555-8555-555555555555';

insert into public.addresses (
  id,
  organization_id,
  label,
  contact_name,
  phone,
  line1,
  line2,
  city,
  state,
  postal_code,
  country_code,
  is_default_billing,
  is_default_shipping
)
values
  (
    'a1111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Head office',
    'Asha Mehta',
    '+919810000001',
    '14 Knowledge Park',
    'Sector 4',
    'Greater Noida',
    'Uttar Pradesh',
    '201310',
    'IN',
    true,
    true
  ),
  (
    'b1111111-1111-4111-8111-111111111111',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Head office',
    'Naina Singh',
    '+919810000003',
    '22 MG Road',
    null,
    'Bengaluru',
    'Karnataka',
    '560001',
    'IN',
    true,
    true
  );

-- Phase 2 local-only design and durable order fixtures.

insert into public.design_projects (
  id,
  organization_id,
  created_by,
  title,
  status,
  schema_version,
  current_version,
  source,
  submitted_at
)
values (
  'd1111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'Alpha Events crew T-shirts',
  'submitted',
  1,
  1,
  'configurator',
  now()
);

insert into public.design_project_versions (
  id,
  design_project_id,
  version_number,
  configuration_snapshot,
  pricing_input_snapshot,
  created_by
)
values (
  'd2111111-1111-4211-8211-111111111111',
  'd1111111-1111-4111-8111-111111111111',
  1,
  jsonb_build_object(
    'schema_version', 1,
    'product_slug', 'regular-fit-tee-200gsm',
    'colour', 'Black',
    'decoration', 'screen_print',
    'artwork_positions', jsonb_build_array('front_centre')
  ),
  jsonb_build_object(
    'pricing_version', 'local-fixture-v1',
    'quantity', 20
  ),
  '11111111-1111-4111-8111-111111111111'
);

select *
from public.submit_order(
  p_idempotency_key => 'seed-alpha-custom-order-v1',
  p_request_hash => repeat('a', 64),
  p_order_type => 'custom_bulk',
  p_organization_id => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  p_customer_user_id => '11111111-1111-4111-8111-111111111111',
  p_subtotal_paise => 120000,
  p_shipping_paise => 10000,
  p_tax_estimate_paise => 0,
  p_reservation_amount_paise => 49900,
  p_pricing_version => 'local-fixture-v1',
  p_configuration_schema_version => 1,
  p_billing_snapshot => jsonb_build_object(
    'contact_name', 'Asha Mehta',
    'line1', '14 Knowledge Park',
    'line2', 'Sector 4',
    'city', 'Greater Noida',
    'state', 'Uttar Pradesh',
    'postal_code', '201310',
    'country_code', 'IN'
  ),
  p_shipping_snapshot => jsonb_build_object(
    'contact_name', 'Asha Mehta',
    'line1', '14 Knowledge Park',
    'line2', 'Sector 4',
    'city', 'Greater Noida',
    'state', 'Uttar Pradesh',
    'postal_code', '201310',
    'country_code', 'IN'
  ),
  p_customer_snapshot => jsonb_build_object(
    'email', 'owner.alpha@garmops.local',
    'first_name', 'Asha',
    'last_name', 'Mehta',
    'phone', '+919810000001'
  ),
  p_company_snapshot => jsonb_build_object(
    'legal_name', 'Alpha Events Private Limited',
    'display_name', 'Alpha Events',
    'billing_email', 'accounts@alpha.example'
  ),
  p_terms_snapshot => jsonb_build_object(
    'accepted', true,
    'version', 'local-terms-v1',
    'reservation_credited_to_final_invoice', true
  ),
  p_items => jsonb_build_array(
    jsonb_build_object(
      'line_number', 1,
      'product_id', 'regular-fit-tee-200gsm',
      'product_slug', 'regular-fit-tee-200gsm',
      'product_name', 'Regular Fit Tee 200 GSM',
      'product_snapshot', jsonb_build_object(
        'fit', 'regular',
        'gsm', 200,
        'fabric', 'cotton'
      ),
      'colour_snapshot', jsonb_build_object('name', 'Black', 'hex', '#111111'),
      'decoration_snapshot', jsonb_build_object('method', 'screen_print'),
      'artwork_snapshot', jsonb_build_object('placement', 'front_centre'),
      'neck_label_snapshot', jsonb_build_object('type', 'standard'),
      'size_breakdown', jsonb_build_object('S', 5, 'M', 10, 'L', 5),
      'quantity', 20,
      'unit_price_paise', 6000,
      'line_total_paise', 120000
    )
  ),
  p_design_project_id => 'd1111111-1111-4111-8111-111111111111',
  p_design_version_id => 'd2111111-1111-4211-8211-111111111111',
  p_customer_reference => 'ALPHA-CREW-LOCAL',
  p_po_number => 'PO-LOCAL-001',
  p_requested_delivery_date => current_date + 30,
  p_expires_at => now() + interval '24 hours'
);

select *
from public.finalize_verified_payment(
  p_payment_attempt_id => (
    select (response_body ->> 'payment_attempt_id')::uuid
    from public.idempotency_keys
    where scope = 'submit_order'
      and actor_id = '11111111-1111-4111-8111-111111111111'
      and key = 'seed-alpha-custom-order-v1'
  ),
  p_provider_payment_id => 'LOCALPAYUALPHA001',
  p_verified_amount_paise => 49900,
  p_currency => 'INR',
  p_verified_snapshot => jsonb_build_object(
    'source', 'local_seed',
    'verified', true,
    'amount_paise', 49900
  )
);

select *
from public.submit_order(
  p_idempotency_key => 'seed-beta-sample-order-v1',
  p_request_hash => repeat('b', 64),
  p_order_type => 'sample_purchase',
  p_organization_id => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  p_customer_user_id => '33333333-3333-4333-8333-333333333333',
  p_subtotal_paise => 118000,
  p_shipping_paise => 10000,
  p_tax_estimate_paise => 0,
  p_reservation_amount_paise => 0,
  p_pricing_version => 'local-fixture-v1',
  p_configuration_schema_version => 1,
  p_billing_snapshot => jsonb_build_object(
    'contact_name', 'Naina Singh',
    'line1', '22 MG Road',
    'city', 'Bengaluru',
    'state', 'Karnataka',
    'postal_code', '560001',
    'country_code', 'IN'
  ),
  p_shipping_snapshot => jsonb_build_object(
    'contact_name', 'Naina Singh',
    'line1', '22 MG Road',
    'city', 'Bengaluru',
    'state', 'Karnataka',
    'postal_code', '560001',
    'country_code', 'IN'
  ),
  p_customer_snapshot => jsonb_build_object(
    'email', 'owner.beta@garmops.local',
    'first_name', 'Naina',
    'last_name', 'Singh',
    'phone', '+919810000003'
  ),
  p_company_snapshot => jsonb_build_object(
    'legal_name', 'Beta Hospitality Private Limited',
    'display_name', 'Beta Hospitality',
    'billing_email', 'accounts@beta.example'
  ),
  p_terms_snapshot => jsonb_build_object(
    'accepted', true,
    'version', 'local-terms-v1'
  ),
  p_items => jsonb_build_array(
    jsonb_build_object(
      'line_number', 1,
      'product_id', 'boxy-fit-tee-200gsm',
      'product_slug', 'boxy-fit-tee-200gsm',
      'product_name', 'Boxy Fit Tee 200 GSM',
      'product_snapshot', jsonb_build_object(
        'fit', 'boxy',
        'gsm', 200,
        'fabric', 'cotton'
      ),
      'colour_snapshot', jsonb_build_object('name', 'White', 'hex', '#ffffff'),
      'size_breakdown', jsonb_build_object('M', 1, 'L', 1),
      'quantity', 2,
      'unit_price_paise', 59000,
      'line_total_paise', 118000
    )
  ),
  p_requested_delivery_date => current_date + 14,
  p_expires_at => now() + interval '24 hours'
);
