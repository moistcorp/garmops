create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;

select plan(41);

select ok(
  to_regprocedure('public.staff_transition_order(uuid,public.order_status,text,text,text)') is not null,
  'central staff transition RPC exists'
);
select ok(
  to_regprocedure('public.staff_assign_order(uuid,uuid,text,text)') is not null,
  'assignment RPC exists'
);
select ok(
  to_regprocedure('public.staff_set_order_priority(uuid,text,text)') is not null,
  'priority RPC exists'
);
select ok(
  to_regprocedure('public.staff_set_order_dates(uuid,timestamp with time zone,timestamp with time zone,timestamp with time zone,timestamp with time zone)') is not null,
  'expected dates RPC exists'
);
select ok(
  to_regprocedure('public.staff_add_order_comment(uuid,text,text,boolean,text)') is not null,
  'staff comment RPC exists'
);
select ok(
  to_regprocedure('public.staff_resolve_order_action(uuid,text)') is not null,
  'action-resolution RPC exists'
);
select ok(
  to_regprocedure('public.staff_change_order_file_visibility(uuid,public.file_visibility,text)') is not null,
  'file visibility RPC exists'
);
select ok(
  to_regprocedure('public.staff_search_orders(text,public.order_status,public.public_order_status,public.order_type,text,text,text,uuid,text,text,text,date,date,boolean,boolean,boolean,integer,integer)') is not null,
  'bounded staff queue search exists'
);
select ok(
  has_function_privilege('authenticated', 'public.staff_transition_order(uuid,public.order_status,text,text,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.staff_transition_order(uuid,public.order_status,text,text,text)', 'EXECUTE'),
  'transition is authenticated-only'
);
select ok(
  not has_table_privilege('authenticated', 'public.orders', 'UPDATE'),
  'browser sessions still cannot update orders directly'
);

insert into public.orders (
  id, order_number, order_type, organization_id, customer_user_id,
  status, public_status, subtotal_paise, estimated_total_paise,
  reservation_amount_paise, amount_paid_paise, pricing_version,
  configuration_schema_version, billing_snapshot, shipping_snapshot,
  customer_snapshot, company_snapshot, terms_snapshot, reservation_paid_at
) values (
  'a0000000-0000-4000-8000-000000000010',
  'GAR-2026-001010',
  'custom_bulk',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'reservation_paid',
  'order_submitted',
  250000,
  250000,
  49900,
  49900,
  'phase10-test-v1',
  1,
  '{}'::jsonb,
  '{}'::jsonb,
  '{"name":"Asha Mehta","email":"asha@example.com"}'::jsonb,
  '{"displayName":"Alpha Events","gstin":"09ABCDE1234F1Z5"}'::jsonb,
  '{"accepted":true,"version":"phase10-test"}'::jsonb,
  now()
);

insert into public.orders (
  id, order_number, order_type, organization_id, customer_user_id,
  status, public_status, subtotal_paise, estimated_total_paise,
  reservation_amount_paise, amount_paid_paise, pricing_version,
  configuration_schema_version, billing_snapshot, shipping_snapshot,
  customer_snapshot, company_snapshot, terms_snapshot
) values (
  'a0000000-0000-4000-8000-000000000020',
  'GAR-2026-001020',
  'custom_bulk',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'awaiting_payment',
  'payment_incomplete',
  250000,
  250000,
  49900,
  0,
  'phase10-test-v1',
  1,
  '{}'::jsonb,
  '{}'::jsonb,
  '{"name":"Asha Mehta","email":"asha@example.com"}'::jsonb,
  '{"displayName":"Alpha Events"}'::jsonb,
  '{"accepted":true,"version":"phase10-test"}'::jsonb
);

insert into public.order_items (
  id, order_id, line_number, product_name, product_snapshot,
  size_breakdown, quantity, unit_price_paise, line_total_paise
) values (
  'a0000000-0000-4000-8000-000000000011',
  'a0000000-0000-4000-8000-000000000010',
  1,
  'Regular T-shirt',
  '{"fit":"regular","gsm":240}'::jsonb,
  '{"S":10,"M":20,"L":20}'::jsonb,
  50,
  5000,
  250000
);

insert into public.payment_attempts (
  id, payment_number, order_id, provider_merchant_txn_id,
  attempt_number, purpose, amount_paise, status,
  expected_product_info, customer_email, customer_name,
  initiated_at, paid_at, verified_at
) values (
  'a0000000-0000-4000-8000-000000000012',
  'PAY-GAR-2026-001010-01',
  'a0000000-0000-4000-8000-000000000010',
  'PHASE10TXN1010',
  1,
  'reservation',
  49900,
  'paid',
  'Order GAR-2026-001010 reservation',
  'asha@example.com',
  'Asha Mehta',
  now(), now(), now()
);

insert into public.order_files (
  id, order_id, uploaded_by, kind, visibility, bucket_name,
  object_key, original_filename, safe_filename, content_type,
  byte_size, scan_status
) values (
  'a0000000-0000-4000-8000-000000000013',
  'a0000000-0000-4000-8000-000000000010',
  '44444444-4444-4444-8444-444444444444',
  'proof',
  'staff_only',
  'garmops-private-test',
  'orders/phase10/proof.pdf',
  'proof.pdf',
  'proof.pdf',
  'application/pdf',
  1024,
  'clean'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","aal":"aal2"}',
  true
);
select throws_ok(
  $$ select public.staff_transition_order(
    'a0000000-0000-4000-8000-000000000010',
    'submitted_for_review', null, null, null
  ) $$,
  'P0001',
  'STAFF_PERMISSION_DENIED',
  'read-only staff cannot change order status'
);
select throws_ok(
  $$ select public.staff_assign_order(
    'a0000000-0000-4000-8000-000000000010',
    '44444444-4444-4444-8444-444444444444',
    'Operations', null
  ) $$,
  'P0001',
  'STAFF_PERMISSION_DENIED',
  'read-only staff cannot assign orders'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal1"}',
  true
);
select throws_ok(
  $$ select public.staff_set_order_priority(
    'a0000000-0000-4000-8000-000000000010', 'high', 'Important client'
  ) $$,
  'P0001',
  'STAFF_PERMISSION_DENIED',
  'staff operational mutations require AAL2'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal2"}',
  true
);

select throws_ok(
  $$ select public.staff_transition_order(
    'a0000000-0000-4000-8000-000000000020',
    'reservation_paid', null, null, null
  ) $$,
  'P0001',
  'INVALID_STATUS_TRANSITION',
  'staff cannot manufacture a PayU-paid order state'
);

select lives_ok(
  $$ select public.staff_assign_order(
    'a0000000-0000-4000-8000-000000000010',
    '44444444-4444-4444-8444-444444444444',
    'Operations', null
  ) $$,
  'MFA super admin can assign the order'
);
select is(
  (select assigned_staff_user_id from public.orders where id = 'a0000000-0000-4000-8000-000000000010'),
  '44444444-4444-4444-8444-444444444444'::uuid,
  'assignment is stored'
);
select is(
  (select assigned_team from public.orders where id = 'a0000000-0000-4000-8000-000000000010'),
  'Operations',
  'assignment team is stored'
);
select is(
  (select count(*) from public.audit_logs where order_id = 'a0000000-0000-4000-8000-000000000010' and action = 'order.assignment_changed'),
  1::bigint,
  'assignment is audited'
);

select lives_ok(
  $$ select public.staff_set_order_priority(
    'a0000000-0000-4000-8000-000000000010', 'high', 'Delivery date is important'
  ) $$,
  'priority can be raised with a reason'
);
select is(
  (select internal_priority from public.orders where id = 'a0000000-0000-4000-8000-000000000010'),
  'high',
  'priority is stored'
);

select lives_ok(
  $$ select public.staff_set_order_dates(
    'a0000000-0000-4000-8000-000000000010',
    now() + interval '1 day',
    now() + interval '3 days',
    now() + interval '7 days',
    now() + interval '9 days'
  ) $$,
  'ordered operational dates are accepted'
);
select ok(
  (select expected_approval_at < expected_production_at
    and expected_production_at < expected_qc_at
    and expected_qc_at < estimated_dispatch_at
   from public.orders where id = 'a0000000-0000-4000-8000-000000000010'),
  'operational date sequence is persisted'
);
select throws_ok(
  $$ select public.staff_set_order_dates(
    'a0000000-0000-4000-8000-000000000010',
    now() + interval '8 days',
    now() + interval '2 days',
    null,
    null
  ) $$,
  'P0001',
  'EXPECTED_DATE_SEQUENCE_INVALID',
  'invalid expected-date order fails closed'
);

select lives_ok(
  $$ select public.staff_transition_order(
    'a0000000-0000-4000-8000-000000000010',
    'submitted_for_review',
    'Your order is now under review.',
    'Reservation confirmed by PayU.',
    null
  ) $$,
  'valid paid-order transition succeeds'
);
select is(
  (select status::text from public.orders where id = 'a0000000-0000-4000-8000-000000000010'),
  'submitted_for_review',
  'internal state is updated'
);
select is(
  (select public_status::text from public.orders where id = 'a0000000-0000-4000-8000-000000000010'),
  'order_submitted',
  'customer state is mapped centrally'
);
select is(
  (select count(*) from public.order_status_history where order_id = 'a0000000-0000-4000-8000-000000000010' and to_status = 'submitted_for_review'),
  1::bigint,
  'status history is inserted once'
);
select is(
  (select count(*) from public.notifications where order_id = 'a0000000-0000-4000-8000-000000000010' and type = 'order_status_update'),
  2::bigint,
  'active organisation members receive portal notifications'
);
select throws_ok(
  $$ select public.staff_transition_order(
    'a0000000-0000-4000-8000-000000000010',
    'delivered', null, null, null
  ) $$,
  'P0001',
  'INVALID_STATUS_TRANSITION',
  'free selection of arbitrary statuses is blocked'
);

select lives_ok(
  $$ select public.staff_add_order_comment(
    'a0000000-0000-4000-8000-000000000010',
    'staff_only',
    'Internal production note',
    false,
    null
  ) $$,
  'internal note can be created'
);
select is(
  (select count(*) from public.order_comments where order_id = 'a0000000-0000-4000-8000-000000000010' and visibility = 'staff_only'),
  1::bigint,
  'internal note defaults to staff-only visibility'
);

select lives_ok(
  $$ select public.staff_add_order_comment(
    'a0000000-0000-4000-8000-000000000010',
    'customer',
    'Please upload the signed purchase order.',
    true,
    'purchase_order'
  ) $$,
  'customer action request can be created intentionally'
);
select is(
  (select count(*) from public.order_comments where order_id = 'a0000000-0000-4000-8000-000000000010' and action_required and resolved_at is null),
  1::bigint,
  'action request remains open'
);
select lives_ok(
  $$ select public.staff_resolve_order_action(
    (select id from public.order_comments where order_id = 'a0000000-0000-4000-8000-000000000010' and action_required limit 1),
    'PO received and checked'
  ) $$,
  'action request can be resolved'
);
select is(
  (select count(*) from public.order_comments where order_id = 'a0000000-0000-4000-8000-000000000010' and action_required and resolved_at is null),
  0::bigint,
  'resolved request leaves the open-action queue'
);

select lives_ok(
  $$ select public.staff_change_order_file_visibility(
    'a0000000-0000-4000-8000-000000000013',
    'customer',
    'Clean proof approved for customer review'
  ) $$,
  'clean file can be intentionally shared'
);
select is(
  (select visibility::text from public.order_files where id = 'a0000000-0000-4000-8000-000000000013'),
  'customer',
  'file visibility is changed'
);
select is(
  (select count(*) from public.audit_logs where target_id = 'a0000000-0000-4000-8000-000000000013' and action = 'order_file.visibility_changed'),
  1::bigint,
  'file visibility change is audited'
);

select is(
  (select count(*) from public.staff_search_orders(
    'GAR-2026-001010', null, null, null, null, null, null,
    null, null, null, null, null, null, false, false, false, 50, 0
  )),
  1::bigint,
  'staff queue finds an order by order number'
);
select is(
  (select quantity_total from public.staff_search_orders(
    'Alpha Events', null, null, null, null, null, null,
    null, null, null, null, null, null, false, false, false, 50, 0
  ) where order_id = 'a0000000-0000-4000-8000-000000000010'),
  50::bigint,
  'staff queue returns the immutable quantity summary'
);
select ok(
  ((select public.staff_dashboard_metrics()) ->> 'newPaidReservations')::integer >= 0,
  'dashboard metrics are available to MFA staff'
);

reset role;
select * from finish();
rollback;
