create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;

select plan(100);

-- Phase 2 enum and table surface.

select has_type('public', 'order_type', 'order_type enum exists');
select has_type('public', 'order_status', 'order_status enum exists');
select has_type('public', 'public_order_status', 'public_order_status enum exists');
select has_type('public', 'payment_status', 'payment_status enum exists');
select has_type('public', 'invoice_kind', 'invoice_kind enum exists');
select has_type('public', 'invoice_sync_status', 'invoice_sync_status enum exists');
select has_type('public', 'file_visibility', 'file_visibility enum exists');
select has_type('public', 'file_kind', 'file_kind enum exists');
select has_type('public', 'file_scan_status', 'file_scan_status enum exists');

select has_table('public', 'design_projects', 'design_projects table exists');
select has_table('public', 'design_project_versions', 'design_project_versions table exists');
select has_table('public', 'number_counters', 'number_counters table exists');
select has_table('public', 'orders', 'orders table exists');
select has_table('public', 'order_items', 'order_items table exists');
select has_table('public', 'order_item_sizes', 'order_item_sizes table exists');
select has_table('public', 'idempotency_keys', 'idempotency_keys table exists');
select has_table('public', 'payment_attempts', 'payment_attempts table exists');
select has_table('public', 'payment_events', 'payment_events table exists');
select has_table('public', 'order_status_history', 'order_status_history table exists');
select hasnt_table('public', 'order_comments', 'retired order comments table is absent');
select has_table('public', 'order_files', 'order_files table exists');
select hasnt_table('public', 'approvals', 'retired approvals table is absent');
select has_table('public', 'invoices', 'invoices table exists');
select has_table('public', 'integration_jobs', 'integration_jobs table exists');
select hasnt_table('public', 'shipments', 'retired shipments table is absent');
select hasnt_table('public', 'notifications', 'retired notifications table is absent');
select has_table('public', 'audit_logs', 'audit_logs table exists');

select is(
  (
    select count(*)
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any(array[
        'audit_logs',
        'design_project_versions',
        'design_projects',
        'idempotency_keys',
        'integration_jobs',
        'invoices',
        'number_counters',
        'order_files',
        'order_item_sizes',
        'order_items',
        'order_status_history',
        'orders',
        'payment_attempts',
        'payment_events'
      ])
      and c.relrowsecurity
  ),
  14::bigint,
  'every retained durable-order table has RLS enabled'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = any(array[
        'audit_logs',
        'idempotency_keys',
        'integration_jobs',
        'invoices',
        'number_counters',
        'payment_events'
      ])
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  ),
  0::bigint,
  'sensitive Phase 2 tables expose no browser mutation policies'
);

select ok(
  to_regprocedure('public.allocate_order_number(public.order_type)') is not null,
  'atomic order-number function exists'
);
select ok(
  to_regprocedure(
    'public.submit_order(text,text,public.order_type,uuid,uuid,bigint,bigint,bigint,bigint,text,integer,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,uuid,uuid,text,text,date,timestamp with time zone)'
  ) is not null,
  'idempotent order-submission function exists'
);
select ok(
  to_regprocedure(
    'public.finalize_verified_payment(uuid,text,bigint,character,jsonb,public.invoice_kind)'
  ) is not null,
  'verified-payment finalisation function exists'
);
select ok(
  to_regprocedure('public.claim_integration_jobs(text,integer,interval)') is not null,
  'bounded job-claiming function exists'
);
select ok(
  to_regprocedure('public.complete_integration_job(uuid,text)') is not null,
  'job completion function exists'
);
select ok(
  to_regprocedure('public.fail_integration_job(uuid,text,text,boolean)') is not null,
  'job failure/backoff function exists'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.allocate_order_number(public.order_type)',
    'EXECUTE'
  ),
  'authenticated users cannot allocate order numbers directly'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.submit_order(text,text,public.order_type,uuid,uuid,bigint,bigint,bigint,bigint,text,integer,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,uuid,uuid,text,text,date,timestamp with time zone)',
    'EXECUTE'
  ),
  'authenticated users cannot call the service-only order transaction'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.finalize_verified_payment(uuid,text,bigint,character,jsonb,public.invoice_kind)',
    'EXECUTE'
  ),
  'authenticated users cannot finalise payments'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_integration_jobs(text,integer,interval)',
    'EXECUTE'
  ),
  'authenticated users cannot claim provider jobs'
);

-- Deterministic local seed state.

select is((select count(*) from public.design_projects), 1::bigint, 'one local design project is seeded');
select is(
  (select count(*) from public.design_project_versions),
  1::bigint,
  'one immutable local design version is seeded'
);
select is((select count(*) from public.orders), 2::bigint, 'custom and sample orders are seeded');
select is(
  (select status::text from public.orders where order_type = 'custom_bulk'),
  'reservation_paid',
  'custom fixture has a verified reservation'
);
select is(
  (select public_status::text from public.orders where order_type = 'custom_bulk'),
  'order_submitted',
  'paid custom fixture has a stable customer status'
);
select is(
  (select status::text from public.orders where order_type = 'sample_purchase'),
  'awaiting_payment',
  'sample fixture remains pending'
);
select is(
  (select public_status::text from public.orders where order_type = 'sample_purchase'),
  'payment_incomplete',
  'pending sample fixture exposes payment incomplete'
);
select is((select count(*) from public.payment_attempts), 2::bigint, 'each seeded order has one payment attempt');
select is((select count(*) from public.order_items), 2::bigint, 'each seeded order has an immutable item');
select is((select count(*) from public.order_item_sizes), 5::bigint, 'local item sizes are relationally seeded');
select is((select count(*) from public.order_status_history), 3::bigint, 'submission and payment histories are seeded');
select is((select count(*) from public.invoices), 1::bigint, 'one reservation invoice record is queued');
select is((select count(*) from public.integration_jobs), 2::bigint, 'invoice and confirmation jobs are queued');
select is(
  (select count(*) from public.integration_jobs where job_type = 'create_reservation_invoice'),
  1::bigint,
  'one reservation invoice job is queued'
);
select is(
  (select count(*) from public.integration_jobs where job_type = 'send_payment_confirmation'),
  1::bigint,
  'one payment confirmation job is queued'
);
select is((select count(*) from public.audit_logs), 1::bigint, 'verified payment has an audit record');
select is((select count(*) from public.idempotency_keys), 2::bigint, 'both submitted orders retain idempotency records');
select matches(
  (select order_number from public.orders where order_type = 'custom_bulk'),
  '^GAR-[0-9]{4}-[0-9]{6}$',
  'custom order uses the GAR business format'
);
select matches(
  (select order_number from public.orders where order_type = 'sample_purchase'),
  '^SAM-[0-9]{4}-[0-9]{6}$',
  'sample order uses the SAM business format'
);
select is(
  (
    select count(*)
    from public.payment_attempts
    where provider_merchant_txn_id ~ '^[A-Za-z0-9]+$'
  ),
  (select count(*) from public.payment_attempts),
  'all PayU merchant transaction IDs are alphanumeric'
);

-- Idempotent submission and atomic number allocation.

select is(
  (
    select repeated.order_id
    from public.submit_order(
      p_idempotency_key => 'seed-alpha-custom-order-v1',
      p_request_hash => repeat('a', 64),
      p_order_type => 'custom_bulk',
      p_organization_id => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      p_customer_user_id => '11111111-1111-4111-8111-111111111111',
      p_subtotal_paise => 0,
      p_shipping_paise => 0,
      p_tax_estimate_paise => 0,
      p_reservation_amount_paise => 1,
      p_pricing_version => 'idempotent-replay',
      p_configuration_schema_version => 1,
      p_billing_snapshot => '{}'::jsonb,
      p_shipping_snapshot => '{}'::jsonb,
      p_customer_snapshot => '{}'::jsonb,
      p_company_snapshot => '{}'::jsonb,
      p_terms_snapshot => '{}'::jsonb,
      p_items => '[]'::jsonb,
      p_expires_at => now() + interval '1 hour'
    ) as repeated
  ),
  (
    select resource_id
    from public.idempotency_keys
    where scope = 'submit_order'
      and key = 'seed-alpha-custom-order-v1'
  ),
  'same idempotency key and request hash return the original order'
);
select is((select count(*) from public.orders), 2::bigint, 'idempotent replay creates no second order');
select throws_ok(
  $$
    select *
    from public.submit_order(
      p_idempotency_key => 'seed-alpha-custom-order-v1',
      p_request_hash => repeat('f', 64),
      p_order_type => 'custom_bulk',
      p_organization_id => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      p_customer_user_id => '11111111-1111-4111-8111-111111111111',
      p_subtotal_paise => 0,
      p_shipping_paise => 0,
      p_tax_estimate_paise => 0,
      p_reservation_amount_paise => 1,
      p_pricing_version => 'mismatch',
      p_configuration_schema_version => 1,
      p_billing_snapshot => '{}'::jsonb,
      p_shipping_snapshot => '{}'::jsonb,
      p_customer_snapshot => '{}'::jsonb,
      p_company_snapshot => '{}'::jsonb,
      p_terms_snapshot => '{}'::jsonb,
      p_items => '[]'::jsonb,
      p_expires_at => now() + interval '1 hour'
    )
  $$,
  '22023',
  'idempotency key request hash mismatch',
  'reusing an idempotency key for a different request is rejected'
);
select throws_ok(
  $$
    select *
    from public.submit_order(
      p_idempotency_key => 'pgtap-cross-tenant-order',
      p_request_hash => repeat('c', 64),
      p_order_type => 'custom_bulk',
      p_organization_id => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      p_customer_user_id => '11111111-1111-4111-8111-111111111111',
      p_subtotal_paise => 0,
      p_shipping_paise => 0,
      p_tax_estimate_paise => 0,
      p_reservation_amount_paise => 1,
      p_pricing_version => 'pgtap',
      p_configuration_schema_version => 1,
      p_billing_snapshot => '{}'::jsonb,
      p_shipping_snapshot => '{}'::jsonb,
      p_customer_snapshot => '{}'::jsonb,
      p_company_snapshot => '{}'::jsonb,
      p_terms_snapshot => '{}'::jsonb,
      p_items => '[]'::jsonb,
      p_expires_at => now() + interval '1 hour'
    )
  $$,
  '42501',
  'active organization membership required',
  'order transaction rejects cross-tenant customer input'
);
select is(
  (
    select count(distinct allocated.order_number)
    from (
      select public.allocate_order_number('custom_bulk') as order_number
      from generate_series(1, 100)
    ) as allocated
  ),
  100::bigint,
  'repeated atomic allocation produces 100 unique custom order numbers'
);
select matches(
  public.allocate_order_number('custom_bulk'),
  '^GAR-[0-9]{4}-[0-9]{6}$',
  'custom allocator emits the GAR format'
);
select matches(
  public.allocate_order_number('sample_purchase'),
  '^SAM-[0-9]{4}-[0-9]{6}$',
  'sample allocator emits the SAM format'
);
select matches(
  public.allocate_order_number('reorder'),
  '^GAR-[0-9]{4}-[0-9]{6}$',
  'reorders share the custom GAR namespace'
);
select ok(
  (
    select bool_and(next_value > 1)
    from public.number_counters
  ),
  'number counters retain only the next unallocated positive value'
);

-- Verified payment finalisation is idempotent.

select is(
  (
    select duplicate.already_finalized
    from public.finalize_verified_payment(
      p_payment_attempt_id => (
        select id
        from public.payment_attempts
        where purpose = 'reservation'
      ),
      p_provider_payment_id => 'LOCALPAYUALPHA001',
      p_verified_amount_paise => 49900,
      p_currency => 'INR',
      p_verified_snapshot => '{"source":"duplicate_test"}'::jsonb
    ) as duplicate
  ),
  true,
  'duplicate verified-payment finalisation returns safely'
);
select is(
  (select amount_paid_paise from public.orders where order_type = 'custom_bulk'),
  49900::bigint,
  'duplicate finalisation does not double the paid amount'
);
select is((select count(*) from public.invoices), 1::bigint, 'duplicate finalisation creates no invoice duplicate');
select is(
  (select count(*) from public.integration_jobs where job_type = 'create_reservation_invoice'),
  1::bigint,
  'duplicate finalisation creates no invoice job duplicate'
);
select is(
  (
    select completed.already_finalized
    from public.finalize_verified_payment(
      p_payment_attempt_id => (
        select id
        from public.payment_attempts
        where purpose = 'sample_full'
      ),
      p_provider_payment_id => 'LOCALPAYUBETA001',
      p_verified_amount_paise => 128000,
      p_currency => 'INR',
      p_verified_snapshot => '{"source":"pgtap","verified":true}'::jsonb
    ) as completed
  ),
  false,
  'first verified sample payment performs finalisation'
);
select is(
  (select status::text from public.orders where order_type = 'sample_purchase'),
  'submitted_for_review',
  'verified sample payment advances the internal state'
);
select is(
  (select public_status::text from public.orders where order_type = 'sample_purchase'),
  'order_submitted',
  'verified sample payment advances the public state'
);
select is(
  (select amount_paid_paise from public.orders where order_type = 'sample_purchase'),
  128000::bigint,
  'verified sample amount is stored exactly in paise'
);
select is((select count(*) from public.invoices where kind in ('reservation_retainer', 'reservation_invoice')), 1::bigint, 'sample finalisation creates no reservation invoice');
select is(
  (
    select count(*)
    from public.integration_jobs
    where job_type = 'send_payment_confirmation'
      and aggregate_id = (select id from public.orders where order_type = 'sample_purchase')
  ),
  1::bigint,
  'sample finalisation queues one confirmation job'
);

-- Immutable evidence and controlled payment-event processing fields.

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
values (
  'e1111111-1111-4111-8111-111111111111',
  (select id from public.payment_attempts where purpose = 'sample_full'),
  'payu',
  'webhook',
  'pgtap-event-1',
  repeat('d', 64),
  'payment_success',
  false,
  false,
  '{"status":"success"}'::jsonb
);

select throws_ok(
  $$update public.order_items set quantity = quantity + 1$$,
  '55000',
  'order_items is append-only',
  'submitted order items cannot be updated'
);
select throws_ok(
  $$delete from public.design_project_versions$$,
  '55000',
  'design_project_versions is append-only',
  'design versions cannot be deleted'
);
select throws_ok(
  $$update public.orders set shipping_paise = shipping_paise + 1 where order_type = 'custom_bulk'$$,
  '55000',
  'submitted order snapshots and commercial fields are immutable',
  'submitted commercial fields cannot be changed'
);
select throws_ok(
  $$delete from public.order_status_history where actor_type = 'provider'$$,
  '55000',
  'order_status_history is append-only',
  'order status history cannot be deleted'
);
select throws_ok(
  $$update public.audit_logs set action = 'payment.changed'$$,
  '55000',
  'audit_logs is append-only',
  'audit logs cannot be updated'
);
select throws_ok(
  $$
    update public.payment_events
    set payload = '{"status":"tampered"}'::jsonb
    where id = 'e1111111-1111-4111-8111-111111111111'
  $$,
  '55000',
  'payment event identity and payload are immutable',
  'provider event payload cannot be changed'
);
select lives_ok(
  $$
    update public.payment_events
    set
      authentic = true,
      processed = true,
      processed_at = now()
    where id = 'e1111111-1111-4111-8111-111111111111'
  $$,
  'payment event processing metadata may advance'
);
select throws_ok(
  $$delete from public.payment_events where id = 'e1111111-1111-4111-8111-111111111111'$$,
  '55000',
  'payment events cannot be deleted',
  'provider event evidence cannot be deleted'
);

-- Bounded PostgreSQL jobs, locking, retry, and dedupe.

update public.integration_jobs
set available_at = now() + interval '1 day';

insert into public.integration_jobs (
  id,
  job_type,
  dedupe_key,
  aggregate_type,
  aggregate_id,
  priority,
  available_at
)
values
  (
    'f1111111-1111-4111-8111-111111111111',
    'pgtap_retry',
    'pgtap_retry:1',
    'test',
    '11111111-1111-4111-8111-111111111111',
    1,
    now() - interval '1 minute'
  ),
  (
    'f2222222-2222-4222-8222-222222222222',
    'pgtap_complete',
    'pgtap_complete:1',
    'test',
    '22222222-2222-4222-8222-222222222222',
    2,
    now() - interval '1 minute'
  );

select is(
  (select count(*) from public.claim_integration_jobs('pgtap-worker', 2)),
  2::bigint,
  'job claim is bounded by batch size'
);
select is(
  (
    select count(*)
    from public.integration_jobs
    where status = 'processing'
      and locked_by = 'pgtap-worker'
      and attempt_count = 1
  ),
  2::bigint,
  'claimed jobs record lock owner and attempt count'
);
select is(
  (
    select (public.fail_integration_job(
      'f1111111-1111-4111-8111-111111111111',
      'pgtap-worker',
      'temporary provider timeout',
      true
    )).status
  ),
  'retry',
  'retryable job failure returns the job to retry'
);
select ok(
  (
    select available_at > now()
    from public.integration_jobs
    where id = 'f1111111-1111-4111-8111-111111111111'
  ),
  'retryable job receives future exponential backoff'
);
select is(
  (
    select (public.complete_integration_job(
      'f2222222-2222-4222-8222-222222222222',
      'pgtap-worker'
    )).status
  ),
  'completed',
  'locked job can be completed exactly by its worker'
);
select throws_ok(
  $$select * from public.claim_integration_jobs('pgtap-worker', 101)$$,
  '22023',
  'job batch size must be between 1 and 100',
  'oversized job batches are rejected'
);
select throws_ok(
  $$
    insert into public.integration_jobs (
      job_type,
      dedupe_key,
      aggregate_type,
      aggregate_id
    )
    values (
      'duplicate',
      'pgtap_retry:1',
      'test',
      '33333333-3333-4333-8333-333333333333'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "integration_jobs_dedupe_key_key"',
  'job dedupe keys prevent duplicate side effects'
);
select throws_ok(
  $$select * from public.claim_integration_jobs(' ', 1)$$,
  '22023',
  'invalid worker id',
  'blank job worker IDs are rejected'
);
select throws_ok(
  $$
    select public.complete_integration_job(
      'f2222222-2222-4222-8222-222222222222',
      'another-worker'
    )
  $$,
  'P0002',
  'locked integration job not found',
  'a different worker cannot complete an unlocked/completed job'
);

-- Submission validation and required indexes.

select throws_ok(
  $$
    select *
    from public.submit_order(
      p_idempotency_key => 'pgtap-invalid-line-total',
      p_request_hash => repeat('1', 64),
      p_order_type => 'custom_bulk',
      p_organization_id => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      p_customer_user_id => '11111111-1111-4111-8111-111111111111',
      p_subtotal_paise => 1000,
      p_shipping_paise => 0,
      p_tax_estimate_paise => 0,
      p_reservation_amount_paise => 500,
      p_pricing_version => 'pgtap',
      p_configuration_schema_version => 1,
      p_billing_snapshot => '{}'::jsonb,
      p_shipping_snapshot => '{}'::jsonb,
      p_customer_snapshot => '{"email":"owner.alpha@garmops.local","name":"Asha Mehta"}'::jsonb,
      p_company_snapshot => '{}'::jsonb,
      p_terms_snapshot => '{}'::jsonb,
      p_items => '[{"line_number":1,"product_name":"Test Tee","product_snapshot":{},"size_breakdown":{"M":1},"quantity":1,"unit_price_paise":900,"line_total_paise":900}]'::jsonb,
      p_expires_at => now() + interval '1 hour'
    )
  $$,
  '22023',
  'order item totals must equal the order subtotal',
  'submission rejects line totals that do not match the subtotal'
);
select throws_ok(
  $$
    select *
    from public.submit_order(
      p_idempotency_key => 'pgtap-invalid-size-total',
      p_request_hash => repeat('2', 64),
      p_order_type => 'custom_bulk',
      p_organization_id => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      p_customer_user_id => '11111111-1111-4111-8111-111111111111',
      p_subtotal_paise => 1000,
      p_shipping_paise => 0,
      p_tax_estimate_paise => 0,
      p_reservation_amount_paise => 500,
      p_pricing_version => 'pgtap',
      p_configuration_schema_version => 1,
      p_billing_snapshot => '{}'::jsonb,
      p_shipping_snapshot => '{}'::jsonb,
      p_customer_snapshot => '{"email":"owner.alpha@garmops.local","name":"Asha Mehta"}'::jsonb,
      p_company_snapshot => '{}'::jsonb,
      p_terms_snapshot => '{}'::jsonb,
      p_items => '[{"line_number":1,"product_name":"Test Tee","product_snapshot":{},"size_breakdown":{"M":2},"quantity":1,"unit_price_paise":1000,"line_total_paise":1000}]'::jsonb,
      p_expires_at => now() + interval '1 hour'
    )
  $$,
  '22023',
  'size quantities must add up to the order item quantity',
  'submission rejects size totals that do not match quantity'
);
select throws_ok(
  $$
    select *
    from public.submit_order(
      p_idempotency_key => 'pgtap-invalid-sample-reservation',
      p_request_hash => repeat('3', 64),
      p_order_type => 'sample_purchase',
      p_organization_id => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      p_customer_user_id => '11111111-1111-4111-8111-111111111111',
      p_subtotal_paise => 1000,
      p_shipping_paise => 0,
      p_tax_estimate_paise => 0,
      p_reservation_amount_paise => 1,
      p_pricing_version => 'pgtap',
      p_configuration_schema_version => 1,
      p_billing_snapshot => '{}'::jsonb,
      p_shipping_snapshot => '{}'::jsonb,
      p_customer_snapshot => '{}'::jsonb,
      p_company_snapshot => '{}'::jsonb,
      p_terms_snapshot => '{}'::jsonb,
      p_items => '[]'::jsonb,
      p_expires_at => now() + interval '1 hour'
    )
  $$,
  '22023',
  'sample orders require a positive full amount and no reservation amount',
  'sample submission rejects a reservation amount'
);
select has_index(
  'public',
  'payment_attempts',
  'payment_attempts_one_paid_purpose_idx',
  'one paid attempt per order purpose is enforced'
);
select has_index(
  'public',
  'integration_jobs',
  'integration_jobs_ready_idx',
  'due-job claim path has a partial work-queue index'
);

select * from finish();
rollback;
