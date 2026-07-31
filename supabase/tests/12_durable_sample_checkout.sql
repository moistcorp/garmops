create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;

select plan(43);

select ok(
  to_regprocedure('public.retry_order_payment(uuid,uuid,text,text)') is not null,
  'generic durable payment retry function exists'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.retry_order_payment(uuid,uuid,text,text)',
    'EXECUTE'
  ),
  'browser sessions cannot create payment retries directly'
);
select has_trigger(
  'public',
  'payment_attempts',
  'payment_attempts_create_sample_invoice_placeholder',
  'verified sample-payment accounting placeholder trigger exists'
);
select has_trigger(
  'public',
  'payment_attempts',
  'payment_attempts_normalize_sample_fields',
  'initial sample PayU fields are normalized in the database'
);

select lives_ok(
  $$
    select *
    from public.submit_order(
      p_idempotency_key => 'phase12-durable-sample-order-1',
      p_request_hash => repeat('1', 64),
      p_order_type => 'sample_purchase',
      p_organization_id => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      p_customer_user_id => '11111111-1111-4111-8111-111111111111',
      p_subtotal_paise => 142000,
      p_shipping_paise => 9900,
      p_tax_estimate_paise => 0,
      p_reservation_amount_paise => 0,
      p_pricing_version => 'catalogue-samples-2026-01',
      p_configuration_schema_version => 1,
      p_billing_snapshot => '{"entity":"Alpha Events","address":{"countryCode":"IN"}}'::jsonb,
      p_shipping_snapshot => '{"recipientName":"Asha Mehta","address":{"line1":"12 Factory Road","city":"Delhi","state":"Delhi","postalCode":"110001","countryCode":"IN"}}'::jsonb,
      p_customer_snapshot => '{"name":"Asha Mehta","email":"asha@example.com","phone":"+919876543210"}'::jsonb,
      p_company_snapshot => '{"displayName":"Alpha Events"}'::jsonb,
      p_terms_snapshot => '{"accepted":true,"version":"catalogue-sample-v1-2026-07-31","documentHash":"d782e4f1705ac3e9d9203fc5292898ba92805952bc92017f48548544b76e078c"}'::jsonb,
      p_items => '[
        {"line_number":1,"product_id":"1","product_slug":"regular-fit-tee-200gsm","product_name":"Regular Fit T-Shirt","product_snapshot":{"samplePricePaise":53500,"pricingVersion":"catalogue-samples-2026-01"},"colour_snapshot":{},"decoration_snapshot":{},"artwork_snapshot":{},"neck_label_snapshot":null,"size_breakdown":{"M":2},"quantity":2,"unit_price_paise":53500,"line_total_paise":107000},
        {"line_number":2,"product_id":"7","product_slug":"canvas-tote-bag","product_name":"Canvas Tote Bag","product_snapshot":{"samplePricePaise":35000,"pricingVersion":"catalogue-samples-2026-01"},"colour_snapshot":{},"decoration_snapshot":{},"artwork_snapshot":{},"neck_label_snapshot":null,"size_breakdown":{"One Size":1},"quantity":1,"unit_price_paise":35000,"line_total_paise":35000}
      ]'::jsonb,
      p_customer_reference => 'Catalogue sample order',
      p_expires_at => now() + interval '24 hours'
    )
  $$,
  'sample order is created atomically before PayU'
);
select matches(
  (select order_number from public.orders where id = (
    select resource_id from public.idempotency_keys
    where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
  )),
  '^SAM-[0-9]{4}-[0-9]{6}$',
  'sample order receives a server-generated SAM number'
);
select is(
  (select order_type::text from public.orders where id = (
    select resource_id from public.idempotency_keys
    where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
  )),
  'sample_purchase',
  'submitted record is a sample purchase'
);
select is(
  (select estimated_total_paise from public.orders where id = (
    select resource_id from public.idempotency_keys
    where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
  )),
  151900::bigint,
  'canonical subtotal and shipping are stored in integer paise'
);
select is(
  (select reservation_amount_paise from public.orders where id = (
    select resource_id from public.idempotency_keys
    where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
  )),
  0::bigint,
  'sample order has no reservation fee'
);
select is(
  (select count(*) from public.order_items where order_id = (
    select resource_id from public.idempotency_keys
    where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
  )),
  2::bigint,
  'catalogue lines are immutable relational order items'
);
select is(
  (select count(*) from public.order_item_sizes where order_item_id in (
    select id from public.order_items where order_id = (
      select resource_id from public.idempotency_keys
      where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
    )
  )),
  2::bigint,
  'sample size selections are stored relationally'
);
select is(
  (select purpose from public.payment_attempts where order_id = (
    select resource_id from public.idempotency_keys
    where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
  )),
  'sample_full',
  'initial PayU attempt is for the full sample amount'
);
select is(
  (select amount_paise from public.payment_attempts where order_id = (
    select resource_id from public.idempotency_keys
    where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
  )),
  151900::bigint,
  'initial PayU amount equals the durable order total'
);
select is(
  (select expected_product_info from public.payment_attempts where order_id = (
    select resource_id from public.idempotency_keys
    where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
  )),
  'Garmops sample order ' || (select order_number from public.orders where id = (
    select resource_id from public.idempotency_keys
    where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
  )),
  'PayU product information identifies the durable sample order'
);
select is(
  (
    select replay.order_id
    from public.submit_order(
      p_idempotency_key => 'phase12-durable-sample-order-1',
      p_request_hash => repeat('1', 64),
      p_order_type => 'sample_purchase',
      p_organization_id => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      p_customer_user_id => '11111111-1111-4111-8111-111111111111',
      p_subtotal_paise => 0,
      p_shipping_paise => 0,
      p_tax_estimate_paise => 0,
      p_reservation_amount_paise => 0,
      p_pricing_version => 'idempotent-replay',
      p_configuration_schema_version => 1,
      p_billing_snapshot => '{}'::jsonb,
      p_shipping_snapshot => '{}'::jsonb,
      p_customer_snapshot => '{}'::jsonb,
      p_company_snapshot => '{}'::jsonb,
      p_terms_snapshot => '{}'::jsonb,
      p_items => '[]'::jsonb,
      p_expires_at => now() + interval '1 hour'
    ) as replay
  ),
  (select resource_id from public.idempotency_keys where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'),
  'duplicate submit returns the original durable sample order'
);
select is(
  (select count(*) from public.orders where customer_reference = 'Catalogue sample order'),
  1::bigint,
  'duplicate sample submission creates no second order'
);

select lives_ok(
  $$select public.record_payu_payment_state(
    (select id from public.payment_attempts where order_id = (
      select resource_id from public.idempotency_keys
      where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
    )),
    'failed', 'PHASE12FAILED01', 'E_FAILED', 'Sandbox failure', '{"verified":true}'::jsonb
  )$$,
  'failed PayU sample attempt is retained safely'
);
select is(
  (select status::text from public.orders where id = (
    select resource_id from public.idempotency_keys
    where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
  )),
  'payment_failed',
  'failed sample payment updates the durable order'
);
select lives_ok(
  $$select * from public.retry_order_payment(
    (select resource_id from public.idempotency_keys where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'),
    '11111111-1111-4111-8111-111111111111',
    'phase12-sample-retry-1',
    repeat('2', 64)
  )$$,
  'customer retry creates a new attempt under the same sample order'
);
select is(
  (select count(*) from public.payment_attempts where order_id = (
    select resource_id from public.idempotency_keys where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
  )),
  2::bigint,
  'failed sample attempt remains in payment history'
);
select is(
  (select purpose from public.payment_attempts where order_id = (
    select resource_id from public.idempotency_keys where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
  ) order by attempt_number desc limit 1),
  'sample_full',
  'retry preserves the full-sample payment purpose'
);
select is(
  (select amount_paise from public.payment_attempts where order_id = (
    select resource_id from public.idempotency_keys where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
  ) order by attempt_number desc limit 1),
  151900::bigint,
  'retry amount is loaded from the database order total'
);
select is(
  (
    select payment_attempt_id
    from public.retry_order_payment(
      (select resource_id from public.idempotency_keys where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'),
      '11111111-1111-4111-8111-111111111111',
      'phase12-sample-retry-1',
      repeat('2', 64)
    )
  ),
  (select id from public.payment_attempts where order_id = (
    select resource_id from public.idempotency_keys where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
  ) order by attempt_number desc limit 1),
  'duplicate retry returns the existing retry attempt'
);
select is(
  (select count(*) from public.payment_attempts where order_id = (
    select resource_id from public.idempotency_keys where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
  )),
  2::bigint,
  'duplicate retry creates no third attempt'
);

select lives_ok(
  $$select * from public.finalize_verified_payment(
    p_payment_attempt_id => (select id from public.payment_attempts where order_id = (
      select resource_id from public.idempotency_keys where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
    ) order by attempt_number desc limit 1),
    p_provider_payment_id => 'PHASE12PAID01',
    p_verified_amount_paise => 151900,
    p_currency => 'INR',
    p_verified_snapshot => '{"source":"phase12-pgtap","verified":true}'::jsonb
  )$$,
  'verified retry finalises the durable sample order'
);
select is(
  (select status::text from public.orders where id = (
    select resource_id from public.idempotency_keys where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
  )),
  'submitted_for_review',
  'paid sample order enters the staff review queue'
);
select is(
  (select amount_paid_paise from public.orders where id = (
    select resource_id from public.idempotency_keys where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
  )),
  151900::bigint,
  'verified full amount is stored exactly once'
);
select is(
  (select count(*) from public.invoices where order_id = (
    select resource_id from public.idempotency_keys where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
  ) and kind = 'sample_tax_invoice'),
  1::bigint,
  'verified sample payment creates one accounting placeholder'
);
select is(
  (select sync_status::text from public.invoices where order_id = (
    select resource_id from public.idempotency_keys where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
  ) and kind = 'sample_tax_invoice'),
  'not_required',
  'sample Zoho automation remains explicitly disabled pending finance configuration'
);
select is(
  (select count(*) from public.integration_jobs where aggregate_id = (
    select resource_id from public.idempotency_keys where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
  ) and job_type = 'create_reservation_invoice'),
  0::bigint,
  'sample payment never queues the reservation-invoice adapter'
);
select is(
  (select count(*) from public.integration_jobs where aggregate_id = (
    select resource_id from public.idempotency_keys where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
  ) and job_type = 'send_payment_confirmation'),
  1::bigint,
  'sample payment queues one database-backed confirmation'
);
select is(
  (
    select duplicate.already_finalized
    from public.finalize_verified_payment(
      p_payment_attempt_id => (select id from public.payment_attempts where order_id = (
        select resource_id from public.idempotency_keys where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
      ) order by attempt_number desc limit 1),
      p_provider_payment_id => 'PHASE12PAID01',
      p_verified_amount_paise => 151900,
      p_currency => 'INR',
      p_verified_snapshot => '{"source":"phase12-duplicate"}'::jsonb
    ) as duplicate
  ),
  true,
  'duplicate verified event returns idempotently'
);
select is(
  (select count(*) from public.invoices where order_id = (
    select resource_id from public.idempotency_keys where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
  ) and kind = 'sample_tax_invoice'),
  1::bigint,
  'duplicate verification creates no second sample document placeholder'
);
select is(
  (select count(*) from public.integration_jobs where aggregate_id = (
    select resource_id from public.idempotency_keys where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
  ) and job_type = 'send_payment_confirmation'),
  1::bigint,
  'duplicate verification creates no second confirmation job'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal2"}',
  true
);
select is(
  (public.staff_dashboard_metrics()->>'newPaidSampleOrders')::integer,
  1,
  'staff dashboard surfaces a newly paid sample order'
);
reset role;

-- A second unpaid order proves staff cannot bypass verified full payment.
select lives_ok(
  $$
    select * from public.submit_order(
      p_idempotency_key => 'phase12-unpaid-sample-order-2',
      p_request_hash => repeat('3', 64),
      p_order_type => 'sample_purchase',
      p_organization_id => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      p_customer_user_id => '11111111-1111-4111-8111-111111111111',
      p_subtotal_paise => 53500,
      p_shipping_paise => 9900,
      p_tax_estimate_paise => 0,
      p_reservation_amount_paise => 0,
      p_pricing_version => 'catalogue-samples-2026-01',
      p_configuration_schema_version => 1,
      p_billing_snapshot => '{}'::jsonb,
      p_shipping_snapshot => '{}'::jsonb,
      p_customer_snapshot => '{"name":"Asha Mehta","email":"asha@example.com"}'::jsonb,
      p_company_snapshot => '{}'::jsonb,
      p_terms_snapshot => '{"accepted":true,"version":"catalogue-sample-v1-2026-07-31"}'::jsonb,
      p_items => '[{"line_number":1,"product_id":"1","product_name":"Regular Fit T-Shirt","product_snapshot":{},"colour_snapshot":{},"decoration_snapshot":{},"artwork_snapshot":{},"neck_label_snapshot":null,"size_breakdown":{"M":1},"quantity":1,"unit_price_paise":53500,"line_total_paise":53500}]'::jsonb,
      p_expires_at => now() + interval '24 hours'
    )
  $$,
  'second unpaid sample fixture is created'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal2"}',
  true
);
select throws_ok(
  $$select public.staff_transition_order(
    (select resource_id from public.idempotency_keys where scope = 'submit_order' and key = 'phase12-unpaid-sample-order-2'),
    'packing', null, null, null
  )$$,
  'P0001',
  'INVALID_STATUS_TRANSITION',
  'unpaid sample cannot jump from awaiting payment into fulfilment'
);
select lives_ok(
  $$select public.staff_transition_order(
    (select resource_id from public.idempotency_keys where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'),
    'packing',
    'Your samples are being packed.',
    'Stock confirmed for sample fulfilment.',
    null
  )$$,
  'paid sample order can enter packing without artwork approval'
);
select is(
  (select status::text from public.orders where id = (
    select resource_id from public.idempotency_keys where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
  )),
  'packing',
  'sample fulfilment status is persisted'
);
select is(
  (select public_status::text from public.orders where id = (
    select resource_id from public.idempotency_keys where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
  )),
  'quality_check',
  'sample fulfilment maps to a safe customer-visible status'
);
select throws_ok(
  $$select public.staff_transition_order(
    (select resource_id from public.idempotency_keys where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'),
    'artwork_review', null, null, null
  )$$,
  'P0001',
  'INVALID_STATUS_TRANSITION',
  'sample order cannot enter custom artwork workflow'
);
select is(
  (select count(*) from public.approvals where order_id = (
    select resource_id from public.idempotency_keys where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
  )),
  0::bigint,
  'sample fulfilment requires no artwork approval record'
);
select is(
  (select count(*) from public.order_status_history where order_id = (
    select resource_id from public.idempotency_keys where scope = 'submit_order' and key = 'phase12-durable-sample-order-1'
  ) and to_status = 'packing'),
  1::bigint,
  'sample fulfilment transition is recorded in history'
);

select * from finish();
rollback;
