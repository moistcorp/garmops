create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;

select plan(37);

select ok(
  to_regprocedure(
    'public.submit_custom_order(text,text,uuid,uuid,bigint,bigint,bigint,bigint,text,integer,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,uuid,uuid,uuid[],text,text,date,timestamp with time zone)'
  ) is not null,
  'Phase 7 custom-order transaction exists'
);
select ok(
  to_regprocedure(
    'public.retry_order_payment(uuid,uuid,text,text)'
  ) is not null,
  'Phase 7 payment-retry transaction exists'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.submit_custom_order(text,text,uuid,uuid,bigint,bigint,bigint,bigint,text,integer,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,uuid,uuid,uuid[],text,text,date,timestamp with time zone)',
    'EXECUTE'
  ),
  'service role can submit validated custom orders'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.submit_custom_order(text,text,uuid,uuid,bigint,bigint,bigint,bigint,text,integer,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,uuid,uuid,uuid[],text,text,date,timestamp with time zone)',
    'EXECUTE'
  ),
  'browser sessions cannot call the trusted custom-order transaction'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.retry_order_payment(uuid,uuid,text,text)',
    'EXECUTE'
  ),
  'service role can prepare a validated payment retry'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.retry_order_payment(uuid,uuid,text,text)',
    'EXECUTE'
  ),
  'browser sessions cannot append payment attempts directly'
);

insert into public.design_projects (
  id,
  organization_id,
  created_by,
  title,
  status,
  schema_version,
  current_version,
  source,
  draft_snapshot,
  pricing_input_snapshot,
  draft_revision
)
values (
  '70000000-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'Phase 7 order design',
  'draft',
  1,
  1,
  'configurator',
  '{"schemaVersion":1,"kind":"configurator_build","configId":"regular-fit-tee-200gsm","savedAt":"2026-07-29T12:00:00.000Z","configuration":{"quantity":50}}'::jsonb,
  '{"quantity":50}'::jsonb,
  1
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
  '70000000-0000-4000-8000-000000000002',
  '70000000-0000-4000-8000-000000000001',
  1,
  '{"schemaVersion":1,"kind":"configurator_build","configId":"regular-fit-tee-200gsm","savedAt":"2026-07-29T12:00:00.000Z","configuration":{"quantity":50}}'::jsonb,
  '{"quantity":50}'::jsonb,
  '11111111-1111-4111-8111-111111111111'
);

insert into public.order_files (
  id,
  design_project_id,
  uploaded_by,
  kind,
  visibility,
  bucket_name,
  object_key,
  original_filename,
  safe_filename,
  content_type,
  byte_size,
  scan_status,
  upload_status,
  finalized_at
)
values (
  '70000000-0000-4000-8000-000000000003',
  '70000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'customer_artwork',
  'customer',
  'garmops-private-orders',
  'organizations/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/designs/phase7/artwork.png',
  'artwork.png',
  'artwork.png',
  'image/png',
  1024,
  'manual_review',
  'finalized',
  now()
);

create temporary table phase7_submission as
select *
from public.submit_custom_order(
  p_idempotency_key => '70000000-0000-4000-8000-000000000010',
  p_request_hash => repeat('a', 64),
  p_organization_id => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  p_customer_user_id => '11111111-1111-4111-8111-111111111111',
  p_subtotal_paise => 100000,
  p_shipping_paise => 0,
  p_tax_estimate_paise => 5000,
  p_reservation_amount_paise => 49900,
  p_pricing_version => 'custom-configurator-v1-2026-07-29',
  p_configuration_schema_version => 1,
  p_billing_snapshot => '{"entity":"Alpha Events","address":{"line1":"14 Knowledge Park"}}'::jsonb,
  p_shipping_snapshot => '{"recipientName":"Asha Mehta","address":{"line1":"14 Knowledge Park"}}'::jsonb,
  p_customer_snapshot => '{"email":"asha@example.com","name":"Asha Mehta"}'::jsonb,
  p_company_snapshot => '{"legalName":"Alpha Events Private Limited"}'::jsonb,
  p_terms_snapshot => '{"accepted":true,"version":"reservation-v1"}'::jsonb,
  p_items => '[
    {
      "line_number": 1,
      "product_id": "regular-fit-tee-200gsm",
      "product_slug": "regular-fit-tee-200gsm",
      "product_name": "Regular Fit T-Shirt",
      "product_snapshot": {"pricingVersion":"custom-configurator-v1-2026-07-29"},
      "colour_snapshot": {"name":"Bright White"},
      "decoration_snapshot": {},
      "artwork_snapshot": {"front":{"fileId":"70000000-0000-4000-8000-000000000003"}},
      "size_breakdown": {"XS":5,"S":10,"M":15,"L":10,"XL":5,"XXL":5},
      "quantity": 50,
      "unit_price_paise": 2000,
      "line_total_paise": 100000
    }
  ]'::jsonb,
  p_design_project_id => '70000000-0000-4000-8000-000000000001',
  p_design_version_id => '70000000-0000-4000-8000-000000000002',
  p_file_ids => array['70000000-0000-4000-8000-000000000003'::uuid],
  p_customer_reference => 'Phase 7 order',
  p_requested_delivery_date => '2026-09-15',
  p_expires_at => now() + interval '24 hours'
);

select matches(
  (select order_number from phase7_submission),
  '^GAR-[0-9]{4}-[0-9]{6}$',
  'submission allocates a durable GAR order number'
);
select is(
  (
    select status::text
    from public.orders
    where id = (select order_id from phase7_submission)
  ),
  'awaiting_payment',
  'custom order exists before payment begins'
);
select ok(
  exists (
    select 1
    from public.payment_attempts
    where id = (select payment_attempt_id from phase7_submission)
      and attempt_number = 1
      and purpose = 'reservation'
      and amount_paise = 49900
      and status = 'created'
  ),
  'first reservation payment attempt is created atomically'
);
select is(
  (
    select count(*)
    from public.order_items
    where order_id = (select order_id from phase7_submission)
  ),
  1::bigint,
  'immutable order item is present at commit'
);
select is(
  (
    select sum(size.quantity)
    from public.order_item_sizes as size
    join public.order_items as item on item.id = size.order_item_id
    where item.order_id = (select order_id from phase7_submission)
  ),
  50::bigint,
  'relational size quantities equal the submitted item quantity'
);
select is(
  (
    select status
    from public.design_projects
    where id = '70000000-0000-4000-8000-000000000001'
  ),
  'submitted',
  'submitted design is frozen against later draft edits'
);
select ok(
  exists (
    select 1
    from public.order_files
    where id = '70000000-0000-4000-8000-000000000003'
      and design_project_id = '70000000-0000-4000-8000-000000000001'
      and order_id = (select order_id from phase7_submission)
  ),
  'finalized artwork remains on the design and is linked to the order'
);
select ok(
  exists (
    select 1
    from public.order_status_history
    where order_id = (select order_id from phase7_submission)
      and to_status = 'awaiting_payment'
      and public_status = 'payment_incomplete'
  ),
  'initial customer-visible status history is atomic'
);
select ok(
  exists (
    select 1
    from public.audit_logs
    where order_id = (select order_id from phase7_submission)
      and action = 'order.submitted'
  ),
  'new durable submission is audited'
);

create temporary table phase7_replay as
select *
from public.submit_custom_order(
  p_idempotency_key => '70000000-0000-4000-8000-000000000010',
  p_request_hash => repeat('a', 64),
  p_organization_id => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  p_customer_user_id => '11111111-1111-4111-8111-111111111111',
  p_subtotal_paise => 100000,
  p_shipping_paise => 0,
  p_tax_estimate_paise => 5000,
  p_reservation_amount_paise => 49900,
  p_pricing_version => 'custom-configurator-v1-2026-07-29',
  p_configuration_schema_version => 1,
  p_billing_snapshot => '{"entity":"Alpha Events","address":{"line1":"14 Knowledge Park"}}'::jsonb,
  p_shipping_snapshot => '{"recipientName":"Asha Mehta","address":{"line1":"14 Knowledge Park"}}'::jsonb,
  p_customer_snapshot => '{"email":"asha@example.com","name":"Asha Mehta"}'::jsonb,
  p_company_snapshot => '{"legalName":"Alpha Events Private Limited"}'::jsonb,
  p_terms_snapshot => '{"accepted":true,"version":"reservation-v1"}'::jsonb,
  p_items => '[{"line_number":1,"product_id":"regular-fit-tee-200gsm","product_slug":"regular-fit-tee-200gsm","product_name":"Regular Fit T-Shirt","product_snapshot":{"pricingVersion":"custom-configurator-v1-2026-07-29"},"colour_snapshot":{"name":"Bright White"},"decoration_snapshot":{},"artwork_snapshot":{"front":{"fileId":"70000000-0000-4000-8000-000000000003"}},"size_breakdown":{"XS":5,"S":10,"M":15,"L":10,"XL":5,"XXL":5},"quantity":50,"unit_price_paise":2000,"line_total_paise":100000}]'::jsonb,
  p_design_project_id => '70000000-0000-4000-8000-000000000001',
  p_design_version_id => '70000000-0000-4000-8000-000000000002',
  p_file_ids => array['70000000-0000-4000-8000-000000000003'::uuid],
  p_customer_reference => 'Phase 7 order',
  p_requested_delivery_date => '2026-09-15',
  p_expires_at => now() + interval '24 hours'
);

select is(
  (select order_id from phase7_replay),
  (select order_id from phase7_submission),
  'duplicate submission returns the original order'
);
select is(
  (
    select count(*)
    from public.orders
    where design_project_id = '70000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'duplicate submission creates no second order'
);
select throws_ok(
  $$
    select *
    from public.submit_custom_order(
      '70000000-0000-4000-8000-000000000010',
      repeat('b', 64),
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111',
      100000, 0, 5000, 49900,
      'custom-configurator-v1-2026-07-29', 1,
      '{}'::jsonb, '{}'::jsonb,
      '{"email":"asha@example.com","name":"Asha Mehta"}'::jsonb,
      '{}'::jsonb,
      '{"accepted":true,"version":"reservation-v1"}'::jsonb,
      '[{"line_number":1,"product_name":"Regular Fit T-Shirt","product_snapshot":{},"size_breakdown":{"M":50},"quantity":50,"line_total_paise":100000}]'::jsonb,
      '70000000-0000-4000-8000-000000000001',
      '70000000-0000-4000-8000-000000000002',
      array['70000000-0000-4000-8000-000000000003'::uuid],
      'Phase 7 order', null, '2026-09-15', now() + interval '24 hours'
    )
  $$,
  '22023',
  'idempotency key request hash mismatch',
  'same submission key cannot be reused with different content'
);
select throws_ok(
  format(
    'update public.orders set subtotal_paise = 1 where id = %L',
    (select order_id from phase7_submission)
  ),
  '55000',
  'submitted order snapshots and commercial fields are immutable',
  'submitted commercial totals cannot be changed'
);

create temporary table phase7_active_attempt as
select *
from public.retry_order_payment(
  (select order_id from phase7_submission),
  '11111111-1111-4111-8111-111111111111',
  '70000000-0000-4000-8000-000000000020',
  repeat('c', 64)
);

select is(
  (select created_new from phase7_active_attempt),
  false,
  'retry reuses an existing active payment attempt'
);
select is(
  (select payment_attempt_id from phase7_active_attempt),
  (select payment_attempt_id from phase7_submission),
  'active payment retry returns the original attempt ID'
);
select is(
  (
    select count(*)
    from public.payment_attempts
    where order_id = (select order_id from phase7_submission)
  ),
  1::bigint,
  'active-attempt retry does not append redundant attempts'
);

update public.payment_attempts
set status = 'failed', failed_at = now()
where id = (select payment_attempt_id from phase7_submission);
update public.orders
set status = 'payment_failed'
where id = (select order_id from phase7_submission);

create temporary table phase7_retry as
select *
from public.retry_order_payment(
  (select order_id from phase7_submission),
  '11111111-1111-4111-8111-111111111111',
  '70000000-0000-4000-8000-000000000021',
  repeat('d', 64)
);

select is(
  (select created_new from phase7_retry),
  true,
  'failed payment appends a new retry attempt'
);
select ok(
  exists (
    select 1
    from public.payment_attempts
    where id = (select payment_attempt_id from phase7_retry)
      and attempt_number = 2
      and amount_paise = 49900
      and status = 'created'
  ),
  'second attempt copies the authoritative reservation amount'
);
select is(
  (
    select status::text
    from public.payment_attempts
    where id = (select payment_attempt_id from phase7_submission)
  ),
  'failed',
  'failed first attempt remains in history'
);
select is(
  (
    select status::text
    from public.orders
    where id = (select order_id from phase7_submission)
  ),
  'awaiting_payment',
  'retry restores the order to awaiting payment'
);
select ok(
  exists (
    select 1
    from public.order_status_history
    where order_id = (select order_id from phase7_submission)
      and from_status = 'payment_failed'
      and to_status = 'awaiting_payment'
  ),
  'retry appends customer-visible status history'
);
select ok(
  exists (
    select 1
    from public.audit_logs
    where order_id = (select order_id from phase7_submission)
      and action = 'payment.retry_created'
      and target_id = (select payment_attempt_id from phase7_retry)
  ),
  'new retry attempt is audited'
);

create temporary table phase7_retry_replay as
select *
from public.retry_order_payment(
  (select order_id from phase7_submission),
  '11111111-1111-4111-8111-111111111111',
  '70000000-0000-4000-8000-000000000021',
  repeat('d', 64)
);

select is(
  (select payment_attempt_id from phase7_retry_replay),
  (select payment_attempt_id from phase7_retry),
  'duplicate retry returns the same payment attempt'
);
select is(
  (
    select count(*)
    from public.payment_attempts
    where order_id = (select order_id from phase7_submission)
  ),
  2::bigint,
  'duplicate retry creates no third payment attempt'
);
select throws_ok(
  format(
    $sql$
      select *
      from public.retry_order_payment(
        %L,
        '11111111-1111-4111-8111-111111111111',
        '70000000-0000-4000-8000-000000000021',
        repeat('e', 64)
      )
    $sql$,
    (select order_id from phase7_submission)
  ),
  '22023',
  'idempotency key request hash mismatch',
  'retry idempotency key cannot be reused for different content'
);
select throws_ok(
  format(
    $sql$
      select *
      from public.retry_order_payment(
        %L,
        '33333333-3333-4333-8333-333333333333',
        '70000000-0000-4000-8000-000000000022',
        repeat('f', 64)
      )
    $sql$,
    (select order_id from phase7_submission)
  ),
  '42501',
  'order payment retry access denied',
  'another organization cannot retry the order payment'
);
select throws_ok(
  $$
    select *
    from public.submit_custom_order(
      '70000000-0000-4000-8000-000000000011',
      repeat('1', 64),
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111',
      100000, 0, 5000, 49900,
      'custom-configurator-v1-2026-07-29', 1,
      '{}'::jsonb, '{}'::jsonb,
      '{"email":"asha@example.com","name":"Asha Mehta"}'::jsonb,
      '{}'::jsonb,
      '{"accepted":true,"version":"reservation-v1"}'::jsonb,
      '[{"line_number":1,"product_name":"Regular Fit T-Shirt","product_snapshot":{},"size_breakdown":{"M":50},"quantity":50,"line_total_paise":100000}]'::jsonb,
      '70000000-0000-4000-8000-000000000001',
      '70000000-0000-4000-8000-000000000002',
      array['70000000-0000-4000-8000-000000000003'::uuid],
      'Second order', null, '2026-09-15', now() + interval '24 hours'
    )
  $$,
  '22023',
  'submitted designs must be duplicated before ordering again',
  'a submitted design cannot create another order'
);
select is(
  (
    select terms_snapshot ->> 'version'
    from public.orders
    where id = (select order_id from phase7_submission)
  ),
  'reservation-v1',
  'accepted terms version is retained in the immutable snapshot'
);
select ok(
  (
    select expires_at > submitted_at
      and expires_at <= submitted_at + interval '25 hours'
    from public.orders
    where id = (select order_id from phase7_submission)
  ),
  'unpaid custom order receives a bounded retry window'
);
select matches(
  (
    select payment_number
    from public.payment_attempts
    where id = (select payment_attempt_id from phase7_retry)
  ),
  '^PAY-GAR-[0-9]{4}-[0-9]{6}-02$',
  'retry payment number remains provider-compatible and sequential'
);
select throws_ok(
  $$
    insert into public.orders (
      order_number,
      order_type,
      organization_id,
      customer_user_id,
      status,
      public_status,
      subtotal_paise,
      estimated_total_paise,
      reservation_amount_paise,
      pricing_version,
      configuration_schema_version,
      billing_snapshot,
      shipping_snapshot,
      customer_snapshot,
      company_snapshot,
      terms_snapshot,
      expires_at
    )
    values (
      'GAR-2099-999999',
      'custom_bulk',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111',
      'awaiting_payment',
      'payment_incomplete',
      100000,
      100000,
      49900,
      'custom-configurator-v1-2026-07-29',
      1,
      '{}'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      '{"version":"reservation-v1"}'::jsonb,
      now() + interval '24 hours'
    )
  $$,
  '22023',
  'accepted order terms and version are required',
  'Phase 7 orders cannot bypass explicit terms acceptance'
);

select * from finish();
rollback;
