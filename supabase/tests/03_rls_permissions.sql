create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;

select plan(123);

create function public.pgtap_affected_rows(p_sql text)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_affected bigint;
begin
  execute p_sql;
  get diagnostics v_affected = row_count;
  return v_affected;
end;
$$;

-- Permission surface and fail-closed grants.

select is(
  (
    select count(*)
    from pg_proc
    where oid = any(array[
      'public.is_organization_member(uuid)'::regprocedure,
      'public.has_organization_role(uuid,public.organization_role[])'::regprocedure,
      'public.current_staff_role()'::regprocedure,
      'public.is_active_staff()'::regprocedure,
      'public.staff_has_permission(text)'::regprocedure,
      'public.is_order_organization_member(uuid)'::regprocedure,
      'public.user_can_access_order(uuid)'::regprocedure,
      'public.is_design_organization_member(uuid)'::regprocedure,
      'public.user_can_access_design(uuid)'::regprocedure,
      'public.user_can_access_order_item(uuid)'::regprocedure
    ])
  ),
  10::bigint,
  'ten reviewed RLS helper functions exist'
);

select ok(
  (
    select bool_and(has_function_privilege('authenticated', oid, 'EXECUTE'))
    from pg_proc
    where oid = any(array[
      'public.is_organization_member(uuid)'::regprocedure,
      'public.has_organization_role(uuid,public.organization_role[])'::regprocedure,
      'public.current_staff_role()'::regprocedure,
      'public.is_active_staff()'::regprocedure,
      'public.staff_has_permission(text)'::regprocedure,
      'public.is_order_organization_member(uuid)'::regprocedure,
      'public.user_can_access_order(uuid)'::regprocedure,
      'public.is_design_organization_member(uuid)'::regprocedure,
      'public.user_can_access_design(uuid)'::regprocedure,
      'public.user_can_access_order_item(uuid)'::regprocedure
    ])
  ),
  'authenticated users can execute only the reviewed RLS helpers'
);

select ok(
  (
    select bool_and(not has_function_privilege('anon', oid, 'EXECUTE'))
    from pg_proc
    where oid = any(array[
      'public.is_organization_member(uuid)'::regprocedure,
      'public.has_organization_role(uuid,public.organization_role[])'::regprocedure,
      'public.current_staff_role()'::regprocedure,
      'public.is_active_staff()'::regprocedure,
      'public.staff_has_permission(text)'::regprocedure,
      'public.is_order_organization_member(uuid)'::regprocedure,
      'public.user_can_access_order(uuid)'::regprocedure,
      'public.is_design_organization_member(uuid)'::regprocedure,
      'public.user_can_access_design(uuid)'::regprocedure,
      'public.user_can_access_order_item(uuid)'::regprocedure
    ])
  ),
  'anonymous users cannot execute RLS helpers'
);

select is(
  (
    select count(*)
    from pg_class
    where oid = any(array[
      'public.profiles'::regclass,
      'public.organizations'::regclass,
      'public.organization_members'::regclass,
      'public.staff_members'::regclass,
      'public.addresses'::regclass,
      'public.design_projects'::regclass,
      'public.design_project_versions'::regclass,
      'public.number_counters'::regclass,
      'public.orders'::regclass,
      'public.order_items'::regclass,
      'public.order_item_sizes'::regclass,
      'public.idempotency_keys'::regclass,
      'public.payment_attempts'::regclass,
      'public.payment_events'::regclass,
      'public.order_status_history'::regclass,
      'public.order_comments'::regclass,
      'public.order_files'::regclass,
      'public.approvals'::regclass,
      'public.invoices'::regclass,
      'public.integration_jobs'::regclass,
      'public.shipments'::regclass,
      'public.notifications'::regclass,
      'public.audit_logs'::regclass
    ])
      and relrowsecurity
      and relforcerowsecurity
  ),
  23::bigint,
  'all domain tables enable and force RLS'
);

select ok(
  not has_schema_privilege('anon', 'public', 'CREATE')
  and not has_table_privilege('anon', 'public.orders', 'SELECT')
  and not has_table_privilege('anon', 'public.profiles', 'SELECT'),
  'anonymous access has no domain table or schema-create privilege'
);

select ok(
  not has_table_privilege('authenticated', 'public.orders', 'INSERT'),
  'browser users cannot insert durable orders directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.orders', 'UPDATE'),
  'browser users cannot update durable orders directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.payment_attempts', 'INSERT'),
  'browser users cannot insert payment attempts'
);
select ok(
  not has_table_privilege('authenticated', 'public.payment_events', 'INSERT'),
  'browser users cannot insert provider events'
);
select ok(
  not has_table_privilege('authenticated', 'public.invoices', 'UPDATE'),
  'browser users cannot update invoice truth'
);
select ok(
  not has_table_privilege('authenticated', 'public.integration_jobs', 'UPDATE'),
  'browser users cannot mutate integration jobs'
);
select ok(
  not has_table_privilege('authenticated', 'public.number_counters', 'SELECT'),
  'browser users cannot read number counters'
);
select ok(
  not has_table_privilege('authenticated', 'public.idempotency_keys', 'SELECT'),
  'browser users cannot read idempotency records'
);
select ok(
  not has_column_privilege('authenticated', 'public.approvals', 'secure_token_hash', 'SELECT'),
  'browser users cannot read approval token hashes'
);
select ok(
  not has_column_privilege('authenticated', 'public.approvals', 'ip_hash', 'SELECT'),
  'browser users cannot read approval IP hashes'
);
select ok(
  has_column_privilege('authenticated', 'public.approvals', 'status', 'SELECT'),
  'browser users can read the safe approval status column through RLS'
);

-- Additional rows make visibility boundaries explicit.

insert into public.order_comments (id, order_id, author_user_id, visibility, body)
select
  'c1111111-1111-4111-8111-111111111111',
  id,
  '11111111-1111-4111-8111-111111111111',
  'customer',
  'Alpha customer-visible fixture'
from public.orders
where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

insert into public.order_comments (id, order_id, author_user_id, visibility, body)
select
  'c2111111-1111-4211-8211-111111111111',
  id,
  '44444444-4444-4444-8444-444444444444',
  'staff_only',
  'Alpha internal fixture'
from public.orders
where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

insert into public.order_comments (id, order_id, author_user_id, visibility, body)
select
  'c3111111-1111-4311-8311-111111111111',
  id,
  '33333333-3333-4333-8333-333333333333',
  'customer',
  'Beta customer-visible fixture'
from public.orders
where organization_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

insert into public.order_files (
  id,
  order_id,
  uploaded_by,
  kind,
  visibility,
  bucket_name,
  object_key,
  original_filename,
  safe_filename,
  content_type,
  byte_size,
  scan_status
)
select
  fixture.id,
  customer_order.id,
  fixture.uploaded_by,
  'other',
  fixture.visibility::public.file_visibility,
  'order-files',
  fixture.object_key,
  fixture.filename,
  fixture.filename,
  'application/pdf',
  100,
  'clean'
from public.orders as customer_order
join (
  values
    (
      'f1111111-1111-4111-8111-111111111111'::uuid,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
      '11111111-1111-4111-8111-111111111111'::uuid,
      'customer',
      'phase3/alpha-customer.pdf',
      'alpha-customer.pdf'
    ),
    (
      'f2111111-1111-4211-8211-111111111111'::uuid,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
      '44444444-4444-4444-8444-444444444444'::uuid,
      'staff_only',
      'phase3/alpha-staff.pdf',
      'alpha-staff.pdf'
    ),
    (
      'f3111111-1111-4311-8311-111111111111'::uuid,
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
      '33333333-3333-4333-8333-333333333333'::uuid,
      'customer',
      'phase3/beta-customer.pdf',
      'beta-customer.pdf'
    )
) as fixture(id, organization_id, uploaded_by, visibility, object_key, filename)
  on fixture.organization_id = customer_order.organization_id;

insert into public.order_status_history (
  id,
  order_id,
  from_status,
  to_status,
  public_status,
  actor_type,
  customer_visible,
  internal_note
)
select
  'e1111111-1111-4111-8111-111111111111',
  id,
  status,
  status,
  public_status,
  'system',
  false,
  'Internal history fixture'
from public.orders
where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

insert into public.notifications (
  id,
  user_id,
  organization_id,
  order_id,
  type,
  title,
  body
)
select
  'a9111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  organization_id,
  id,
  'phase3_test',
  'Alpha notification',
  'Visible only to Alpha owner'
from public.orders
where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

insert into public.notifications (
  id,
  user_id,
  organization_id,
  order_id,
  type,
  title,
  body
)
select
  'b9111111-1111-4211-8211-111111111111',
  '33333333-3333-4333-8333-333333333333',
  organization_id,
  id,
  'phase3_test',
  'Beta notification',
  'Visible only to Beta owner'
from public.orders
where organization_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

insert into public.shipments (
  id,
  order_id,
  shipment_number,
  status,
  customer_visible_note,
  created_by
)
select
  '51111111-1111-4111-8111-111111111111',
  id,
  'PHASE3-ALPHA-1',
  'preparing',
  'Preparing locally',
  '44444444-4444-4444-8444-444444444444'
from public.orders
where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

insert into public.approvals (
  id,
  order_id,
  design_version_id,
  status,
  requested_by,
  requested_from_user_id,
  secure_token_hash,
  expires_at
)
select
  '61111111-1111-4111-8111-111111111111',
  customer_order.id,
  'd2111111-1111-4211-8211-111111111111',
  'requested',
  '44444444-4444-4444-8444-444444444444',
  '11111111-1111-4111-8111-111111111111',
  repeat('6', 64),
  now() + interval '1 day'
from public.orders as customer_order
where customer_order.organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

insert into public.payment_events (
  id,
  payment_attempt_id,
  provider,
  event_source,
  provider_event_id,
  event_fingerprint,
  event_type,
  authentic,
  processed,
  payload
)
select
  '71111111-1111-4111-8111-111111111111',
  payment_attempt.id,
  'payu',
  'webhook',
  'phase3-event-1',
  repeat('7', 64),
  'payment.success',
  true,
  false,
  '{"phase": 3}'::jsonb
from public.payment_attempts as payment_attempt
join public.orders as customer_order on customer_order.id = payment_attempt.order_id
where customer_order.organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- Alpha owner at normal customer assurance level.

select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;

select ok(
  public.is_organization_member('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'Alpha owner is an active Alpha member'
);
select ok(
  not public.is_organization_member('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'Alpha owner is not a Beta member'
);
select ok(
  public.has_organization_role(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    array['owner']::public.organization_role[]
  ),
  'Alpha owner has the owner role'
);
select ok(
  not public.has_organization_role(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    array['finance']::public.organization_role[]
  ),
  'Alpha owner does not gain the finance role'
);
select ok(not public.is_active_staff(), 'customer is not active staff');
select ok(
  not public.staff_has_permission('unknown_permission'),
  'unknown staff permissions fail closed'
);
select is((select count(*) from public.profiles), 1::bigint, 'customer sees only their profile');
select is((select count(*) from public.organizations), 1::bigint, 'customer sees only their organization');
select is(
  (select count(*) from public.organization_members),
  2::bigint,
  'organization owner sees their organization membership roster'
);
select is((select count(*) from public.addresses), 1::bigint, 'customer sees only Alpha addresses');
select is((select count(*) from public.design_projects), 1::bigint, 'customer sees only Alpha designs');
select is(
  (select count(*) from public.design_project_versions),
  1::bigint,
  'customer sees only Alpha immutable design versions'
);
select is((select count(*) from public.orders), 1::bigint, 'customer sees only Alpha orders');
select is((select count(*) from public.order_items), 1::bigint, 'customer sees only Alpha order items');
select is((select count(*) from public.order_item_sizes), 3::bigint, 'customer sees only Alpha size rows');
select is(
  (select count(*) from public.order_status_history where id = 'e1111111-1111-4111-8111-111111111111'),
  0::bigint,
  'customer cannot see internal order history'
);
select is(
  (select count(*) from public.order_comments where id = 'c1111111-1111-4111-8111-111111111111'),
  1::bigint,
  'customer sees customer-visible comments on their order'
);
select is(
  (select count(*) from public.order_comments where id = 'c2111111-1111-4211-8211-111111111111'),
  0::bigint,
  'customer cannot see staff-only comments'
);
select is(
  (select count(*) from public.order_comments where id = 'c3111111-1111-4311-8311-111111111111'),
  0::bigint,
  'customer cannot see another tenant comments'
);
select is(
  (select count(*) from public.order_files where id = 'f1111111-1111-4111-8111-111111111111'),
  1::bigint,
  'customer sees customer-visible files on their order'
);
select is(
  (select count(*) from public.order_files where id = 'f2111111-1111-4211-8211-111111111111'),
  0::bigint,
  'customer cannot see staff-only files'
);
select is(
  (select count(*) from public.order_files where id = 'f3111111-1111-4311-8311-111111111111'),
  0::bigint,
  'customer cannot see another tenant files'
);
select is((select count(*) from public.payment_attempts), 0::bigint, 'customer cannot read payment payloads');
select is((select count(*) from public.payment_events), 0::bigint, 'customer cannot read provider events');
select is((select count(*) from public.invoices), 1::bigint, 'customer can read their invoice status');
select is((select count(*) from public.shipments), 1::bigint, 'customer can read their shipment');
select is((select count(*) from public.notifications), 1::bigint, 'customer sees only their notification');
select is((select count(*) from public.audit_logs), 0::bigint, 'customer cannot read audit logs');
select is((select count(*) from public.integration_jobs), 0::bigint, 'customer cannot read provider jobs');

select is(
  public.pgtap_affected_rows(
    $$
      update public.profiles
      set job_title = 'Updated by Phase 3 test'
      where id = '11111111-1111-4111-8111-111111111111'
    $$
  ),
  1::bigint,
  'customer can update safe columns on their profile'
);
select is(
  public.pgtap_affected_rows(
    $$
      update public.profiles
      set job_title = 'Cross-tenant update'
      where id = '33333333-3333-4333-8333-333333333333'
    $$
  ),
  0::bigint,
  'customer cannot update another profile'
);
select is(
  public.pgtap_affected_rows(
    $$
      update public.organizations
      set industry = 'Events'
      where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    $$
  ),
  1::bigint,
  'organization owner can update safe organization fields'
);
select is(
  public.pgtap_affected_rows(
    $$
      update public.organizations
      set industry = 'Cross-tenant update'
      where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    $$
  ),
  0::bigint,
  'organization owner cannot update another tenant'
);

select lives_ok(
  $$
    insert into public.addresses (
      organization_id,
      label,
      line1,
      city,
      state,
      postal_code,
      country_code
    )
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Phase 3',
      '15 Knowledge Park',
      'Greater Noida',
      'Uttar Pradesh',
      '201311',
      'IN'
    )
  $$,
  'organization owner can create an address'
);
select is(
  (select count(*) from public.addresses where label = 'Phase 3'),
  1::bigint,
  'new customer address remains tenant-visible'
);
select is(
  public.pgtap_affected_rows(
    $$
      update public.addresses
      set label = 'Phase 3 updated'
      where label = 'Phase 3'
    $$
  ),
  1::bigint,
  'organization owner can update an address'
);
select is(
  public.pgtap_affected_rows(
    $$
      delete from public.addresses
      where label = 'Phase 3 updated'
    $$
  ),
  1::bigint,
  'organization owner can delete an address'
);
select lives_ok(
  $$
    insert into public.order_comments (
      order_id,
      author_user_id,
      visibility,
      body
    )
    select
      id,
      '11111111-1111-4111-8111-111111111111',
      'customer',
      'Customer follow-up'
    from public.orders
  $$,
  'customer can add a customer-visible comment to their order'
);
select throws_ok(
  $$
    insert into public.order_comments (
      order_id,
      author_user_id,
      visibility,
      body
    )
    select
      id,
      '11111111-1111-4111-8111-111111111111',
      'staff_only',
      'Forbidden internal note'
    from public.orders
  $$,
  '42501',
  'new row violates row-level security policy for table "order_comments"',
  'customer cannot add staff-only comments'
);
select throws_ok(
  $$
    select *
    from public.create_cloud_design(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'Cross-tenant design',
      1,
      '{"schemaVersion":1}'::jsonb,
      null,
      'configurator',
      null
    )
  $$,
  'P0001',
  'design write access denied',
  'customer cannot create a design in another tenant'
);
select throws_ok(
  $$ update public.orders set customer_reference = 'DIRECT-WRITE' $$,
  '42501',
  'permission denied for table orders',
  'customer cannot directly mutate durable order truth'
);
select throws_ok(
  $$
    insert into public.staff_members (user_id, role)
    values ('11111111-1111-4111-8111-111111111111', 'support')
  $$,
  '42501',
  'permission denied for table staff_members',
  'customer cannot create a staff record'
);
select is(
  public.pgtap_affected_rows(
    $$
      update public.notifications
      set read_at = now()
      where id = 'a9111111-1111-4111-8111-111111111111'
    $$
  ),
  1::bigint,
  'customer can mark their notification read'
);
select is(
  public.pgtap_affected_rows(
    $$
      update public.notifications
      set read_at = now()
      where id = 'b9111111-1111-4211-8211-111111111111'
    $$
  ),
  0::bigint,
  'customer cannot mark another users notification read'
);
select is(
  (select count(id) from public.approvals),
  1::bigint,
  'organization member can read safe approval fields'
);
select is(
  public.pgtap_affected_rows(
    $$
      update public.approvals
      set
        status = 'approved',
        responded_at = now(),
        response_note = 'Approved by Alpha owner'
      where id = '61111111-1111-4111-8111-111111111111'
    $$
  ),
  1::bigint,
  'requested customer can respond to an approval'
);

reset role;

-- Buyer, finance, and viewer customer roles.

select set_config(
  'request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;

select ok(
  public.has_organization_role(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    array['buyer']::public.organization_role[]
  ),
  'buyer role is resolved from active membership'
);
select lives_ok(
  $$
    select *
    from public.create_cloud_design(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Buyer draft',
      1,
      '{"schemaVersion":1}'::jsonb,
      null,
      'configurator',
      null
    )
  $$,
  'buyer can create a design draft for their tenant'
);
select is(
  (
    select saved
    from public.save_cloud_design_draft(
      (
        select id
        from public.design_projects
        where title = 'Buyer draft'
      ),
      1,
      1,
      '{"schemaVersion":1,"updated":true}'::jsonb,
      null,
      'Buyer updated draft'
    )
  ),
  true,
  'buyer can update their tenant design draft'
);
select is(
  public.pgtap_affected_rows(
    $$
      update public.organizations
      set industry = 'Buyer edit'
      where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    $$
  ),
  0::bigint,
  'buyer cannot update organization identity fields'
);

reset role;
update public.organization_members
set role = 'finance'
where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  and user_id = '22222222-2222-4222-8222-222222222222';
set local role authenticated;

select ok(
  public.has_organization_role(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    array['finance']::public.organization_role[]
  ),
  'finance role is resolved from active membership'
);
select is((select count(*) from public.invoices), 1::bigint, 'finance customer can read tenant invoices');
select throws_ok(
  $$ update public.orders set customer_reference = 'FINANCE-WRITE' $$,
  '42501',
  'permission denied for table orders',
  'finance customer cannot directly change order state'
);
select lives_ok(
  $$
    insert into public.addresses (
      organization_id,
      label,
      line1,
      city,
      state,
      postal_code,
      country_code
    )
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Finance address',
      '16 Knowledge Park',
      'Greater Noida',
      'Uttar Pradesh',
      '201312',
      'IN'
    )
  $$,
  'finance customer can create a billing address'
);
select throws_ok(
  $$
    select *
    from public.create_cloud_design(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Finance design',
      1,
      '{"schemaVersion":1}'::jsonb,
      null,
      'configurator',
      null
    )
  $$,
  'P0001',
  'design write access denied',
  'finance customer cannot create design drafts'
);
select is(
  public.pgtap_affected_rows(
    $$
      update public.organizations
      set industry = 'Finance edit'
      where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    $$
  ),
  0::bigint,
  'finance customer cannot update organization identity fields'
);

reset role;
update public.organization_members
set role = 'viewer'
where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  and user_id = '22222222-2222-4222-8222-222222222222';
set local role authenticated;

select ok(
  public.has_organization_role(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    array['viewer']::public.organization_role[]
  ),
  'viewer role is resolved from active membership'
);
select is((select count(*) from public.orders), 1::bigint, 'viewer can read their tenant order');
select is(
  public.pgtap_affected_rows(
    $$
      update public.addresses
      set label = 'Viewer edit'
      where label = 'Finance address'
    $$
  ),
  0::bigint,
  'viewer cannot update tenant addresses'
);
select throws_ok(
  $$
    select *
    from public.save_cloud_design_draft(
      (
        select id
        from public.design_projects
        where title = 'Buyer updated draft'
      ),
      2,
      1,
      '{"schemaVersion":1,"updated":true}'::jsonb,
      null,
      'Viewer edit'
    )
  $$,
  'P0001',
  'design not found',
  'viewer cannot update tenant designs'
);
select throws_ok(
  $$
    insert into public.addresses (
      organization_id,
      label,
      line1,
      city,
      state,
      postal_code,
      country_code
    )
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Viewer address',
      '17 Knowledge Park',
      'Greater Noida',
      'Uttar Pradesh',
      '201313',
      'IN'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "addresses"',
  'viewer cannot create tenant addresses'
);

reset role;

-- Cross-tenant isolation from the second organization.

select set_config(
  'request.jwt.claim.sub',
  '33333333-3333-4333-8333-333333333333',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;

select is((select count(*) from public.orders), 1::bigint, 'Beta owner sees the Beta order');
select is(
  (
    select count(*)
    from public.orders
    where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  0::bigint,
  'Beta owner cannot see Alpha orders'
);
select is(
  (
    select count(*)
    from public.organizations
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  0::bigint,
  'Beta owner cannot see the Alpha organization'
);
select is(
  (
    select count(*)
    from public.order_comments
    where id = 'c1111111-1111-4111-8111-111111111111'
  ),
  0::bigint,
  'Beta owner cannot see Alpha customer comments'
);

reset role;

-- Read-only staff must have MFA to read and can never mutate.

select set_config(
  'request.jwt.claim.sub',
  '55555555-5555-4555-8555-555555555555',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;

select is(public.current_staff_role()::text, 'read_only', 'active staff role resolves at aal1');
select ok(public.is_active_staff(), 'active staff status is independent of assurance level');
select ok(
  not public.staff_has_permission('view_all_orders'),
  'staff permission is denied without aal2'
);
select is((select count(*) from public.orders), 0::bigint, 'staff without MFA cannot read all orders');
select is((select count(*) from public.staff_members), 1::bigint, 'staff can read their own staff row');

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;

select ok(
  public.staff_has_permission('view_all_orders'),
  'read-only staff gains reviewed read access with aal2'
);
select is((select count(*) from public.orders), 2::bigint, 'MFA read-only staff sees all orders');
select is(
  (
    select count(*)
    from public.order_comments
    where id = 'c2111111-1111-4211-8211-111111111111'
  ),
  1::bigint,
  'MFA read-only staff sees internal comments'
);
select is(
  (select count(*) from public.payment_attempts),
  0::bigint,
  'read-only staff cannot view payment payloads'
);
select throws_ok(
  $$ update public.orders set customer_reference = 'READ-ONLY-WRITE' $$,
  '42501',
  'permission denied for table orders',
  'read-only staff cannot directly update orders'
);
select throws_ok(
  $$
    insert into public.order_comments (
      order_id,
      author_user_id,
      visibility,
      body
    )
    select
      id,
      '55555555-5555-4555-8555-555555555555',
      'staff_only',
      'Read-only mutation'
    from public.orders
    limit 1
  $$,
  '42501',
  'new row violates row-level security policy for table "order_comments"',
  'read-only staff cannot add internal comments'
);

reset role;

-- Super admin permission matrix remains MFA-gated.

select set_config(
  'request.jwt.claim.sub',
  '44444444-4444-4444-8444-444444444444',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;

select ok(
  not public.staff_has_permission('view_all_orders'),
  'super admin permissions are denied without aal2'
);
select is((select count(*) from public.orders), 0::bigint, 'super admin without MFA cannot read all orders');

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;

select ok(public.staff_has_permission('view_all_orders'), 'MFA super admin can view all orders');
select ok(public.staff_has_permission('manage_staff'), 'MFA super admin can manage staff');
select is((select count(*) from public.profiles), 5::bigint, 'MFA super admin sees all profiles');
select is((select count(*) from public.payment_attempts), 2::bigint, 'MFA super admin sees payment attempts');
select is((select count(*) from public.payment_events), 1::bigint, 'MFA super admin sees provider events');
select ok((select count(*) from public.audit_logs) > 0, 'MFA super admin sees audit logs');
select ok((select count(*) from public.integration_jobs) > 0, 'MFA super admin sees integration jobs');
select is(
  (
    select count(*)
    from public.order_files
    where id = 'f2111111-1111-4211-8211-111111111111'
  ),
  1::bigint,
  'MFA super admin sees staff-only files'
);
select lives_ok(
  $$
    insert into public.order_comments (
      order_id,
      author_user_id,
      visibility,
      body
    )
    select
      id,
      '44444444-4444-4444-8444-444444444444',
      'staff_only',
      'Super admin internal note'
    from public.orders
    limit 1
  $$,
  'MFA super admin can add an internal comment'
);
select lives_ok(
  $$
    insert into public.shipments (
      order_id,
      shipment_number,
      status,
      customer_visible_note,
      created_by
    )
    select
      id,
      'PHASE3-ADMIN-1',
      'preparing',
      'Staff-created shipment',
      '44444444-4444-4444-8444-444444444444'
    from public.orders
    where organization_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  $$,
  'MFA super admin can create a shipment'
);
select lives_ok(
  $$
    insert into public.approvals (
      order_id,
      design_version_id,
      status,
      requested_by,
      requested_from_user_id,
      expires_at
    )
    select
      id,
      'd2111111-1111-4211-8211-111111111111',
      'requested',
      '44444444-4444-4444-8444-444444444444',
      '11111111-1111-4111-8111-111111111111',
      now() + interval '1 day'
    from public.orders
    where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  $$,
  'MFA super admin can create an approval request'
);

reset role;

-- Finance staff sees provider workflows but not audit or dispatch mutations.

update public.staff_members
set role = 'finance'
where user_id = '44444444-4444-4444-8444-444444444444';
set local role authenticated;

select ok(
  public.staff_has_permission('view_payment_payload'),
  'finance staff can view payment payloads'
);
select ok(
  not public.staff_has_permission('view_audit'),
  'finance staff cannot view audit logs'
);
select is((select count(*) from public.payment_events), 1::bigint, 'finance staff sees provider events');
select ok((select count(*) from public.integration_jobs) > 0, 'finance staff sees integration jobs');
select is((select count(*) from public.audit_logs), 0::bigint, 'finance staff sees no audit rows');
select throws_ok(
  $$
    insert into public.shipments (
      order_id,
      shipment_number,
      status,
      created_by
    )
    select
      id,
      'PHASE3-FINANCE-1',
      'preparing',
      '44444444-4444-4444-8444-444444444444'
    from public.orders
    limit 1
  $$,
  '42501',
  'new row violates row-level security policy for table "shipments"',
  'finance staff cannot create shipments'
);

reset role;

-- Support can communicate but cannot see finance operations or dispatch.

update public.staff_members
set role = 'support'
where user_id = '44444444-4444-4444-8444-444444444444';
set local role authenticated;

select ok(public.staff_has_permission('view_all_orders'), 'support staff can view orders');
select ok(
  not public.staff_has_permission('view_payment_payload'),
  'support staff cannot view payment payloads'
);
select is((select count(*) from public.payment_attempts), 0::bigint, 'support staff sees no payment attempts');
select is((select count(*) from public.integration_jobs), 0::bigint, 'support staff sees no integration jobs');
select lives_ok(
  $$
    insert into public.order_comments (
      order_id,
      author_user_id,
      visibility,
      body
    )
    select
      id,
      '44444444-4444-4444-8444-444444444444',
      'customer',
      'Support customer update'
    from public.orders
    limit 1
  $$,
  'support staff can send a customer-visible update'
);
select lives_ok(
  $$
    insert into public.order_comments (
      order_id,
      author_user_id,
      visibility,
      body
    )
    select
      id,
      '44444444-4444-4444-8444-444444444444',
      'staff_only',
      'Support internal note'
    from public.orders
    limit 1
  $$,
  'support staff can add an internal note'
);
select throws_ok(
  $$
    insert into public.shipments (
      order_id,
      shipment_number,
      status,
      created_by
    )
    select
      id,
      'PHASE3-SUPPORT-1',
      'preparing',
      '44444444-4444-4444-8444-444444444444'
    from public.orders
    limit 1
  $$,
  '42501',
  'new row violates row-level security policy for table "shipments"',
  'support staff cannot create shipments'
);

reset role;

-- Deactivation revokes all staff privileges immediately.

update public.staff_members
set
  active = false,
  deactivated_at = now()
where user_id = '44444444-4444-4444-8444-444444444444';
set local role authenticated;

select ok(not public.is_active_staff(), 'deactivated staff is not active');
select ok(
  not public.staff_has_permission('view_all_orders'),
  'deactivated staff receives no permission'
);
select is((select count(*) from public.orders), 0::bigint, 'deactivated staff cannot read all orders');

reset role;

-- Anonymous calls are denied before RLS can disclose anything.

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon","aal":"aal1"}', true);
set local role anon;

select throws_ok(
  $$ select * from public.orders $$,
  '42501',
  'permission denied for table orders',
  'anonymous users cannot query orders'
);
select throws_ok(
  $$ select public.is_organization_member('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') $$,
  '42501',
  'permission denied for function is_organization_member',
  'anonymous users cannot execute RLS helpers'
);

reset role;

select * from finish();
rollback;
