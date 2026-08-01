create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;

select plan(17);

select ok(
  to_regprocedure('public.retry_invoice_integration_job(uuid)') is not null,
  'finance retry RPC exists'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.retry_invoice_integration_job(uuid)',
    'EXECUTE'
  ),
  'authenticated staff can invoke the guarded retry RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.retry_invoice_integration_job(uuid)',
    'EXECUTE'
  ),
  'anonymous users cannot invoke invoice retry'
);
select ok(
  to_regprocedure(
    'public.defer_integration_job(uuid,text,timestamp with time zone,text)'
  ) is not null,
  'feature-disabled jobs can be safely deferred'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.defer_integration_job(uuid,text,timestamp with time zone,text)',
    'EXECUTE'
  ),
  'only the service worker receives defer permission'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.defer_integration_job(uuid,text,timestamp with time zone,text)',
    'EXECUTE'
  ),
  'browser sessions cannot release claimed jobs'
);

insert into public.orders (
  id,
  order_number,
  order_type,
  organization_id,
  customer_user_id,
  status,
  public_status,
  subtotal_paise,
  estimated_total_paise,
  reservation_amount_paise,
  amount_paid_paise,
  pricing_version,
  configuration_schema_version,
  billing_snapshot,
  shipping_snapshot,
  customer_snapshot,
  company_snapshot,
  terms_snapshot,
  reservation_paid_at
)
values (
  '90000000-0000-4000-8000-000000000001',
  'GAR-2026-000901',
  'custom_bulk',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'reservation_paid',
  'order_submitted',
  100000,
  100000,
  49900,
  49900,
  'phase9-test-v1',
  1,
  '{"address":{"line1":"1 Test Road","city":"Delhi","state":"Delhi","postalCode":"110001","countryCode":"IN"}}'::jsonb,
  '{}'::jsonb,
  '{"firstName":"Asha","lastName":"Mehta","email":"asha@example.com"}'::jsonb,
  '{"legalName":"Alpha Events Private Limited","displayName":"Alpha Events"}'::jsonb,
  '{"accepted":true,"version":"phase9-test"}'::jsonb,
  now()
);

insert into public.payment_attempts (
  id,
  payment_number,
  order_id,
  provider_merchant_txn_id,
  provider_payment_id,
  attempt_number,
  purpose,
  amount_paise,
  status,
  expected_product_info,
  customer_email,
  customer_name,
  initiated_at,
  paid_at,
  last_verified_at
)
values (
  '90000000-0000-4000-8000-000000000011',
  'PAY-GAR-2026-000901-01',
  '90000000-0000-4000-8000-000000000001',
  'PHASE9TXN90101',
  '403993715530000901',
  1,
  'reservation',
  49900,
  'paid',
  'Order GAR-2026-000901 reservation',
  'asha@example.com',
  'Asha Mehta',
  now(),
  now(),
  now()
);

insert into public.invoices (
  id,
  order_id,
  payment_attempt_id,
  kind,
  sync_status,
  reference_number,
  total_paise,
  paid_paise,
  balance_paise,
  last_error_code,
  last_error_message,
  attempt_count
)
values (
  '90000000-0000-4000-8000-000000000021',
  '90000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000011',
  'reservation_retainer',
  'retryable_failure',
  'GARMOPS-RESERVATION-90000000-0000-4000-8000-000000000011',
  49900,
  49900,
  0,
  'ZOHO_TIMEOUT',
  'Temporary provider timeout',
  3
);

insert into public.integration_jobs (
  id,
  job_type,
  dedupe_key,
  aggregate_type,
  aggregate_id,
  payload,
  status,
  priority,
  attempt_count,
  available_at
)
values (
  '90000000-0000-4000-8000-000000000031',
  'create_reservation_invoice',
  'create_reservation_invoice:90000000-0000-4000-8000-000000000011',
  'invoice',
  '90000000-0000-4000-8000-000000000021',
  '{"invoice_id":"90000000-0000-4000-8000-000000000021"}'::jsonb,
  'dead',
  20,
  10,
  now()
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","aal":"aal2"}',
  true
);
select throws_ok(
  $$ select public.retry_invoice_integration_job('90000000-0000-4000-8000-000000000021') $$,
  '42501',
  'invoice retry permission denied',
  'read-only staff cannot retry accounting jobs'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal1"}',
  true
);
select throws_ok(
  $$ select public.retry_invoice_integration_job('90000000-0000-4000-8000-000000000021') $$,
  '42501',
  'invoice retry permission denied',
  'finance retry is denied without staff MFA'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal2"}',
  true
);
select lives_ok(
  $$ select public.retry_invoice_integration_job('90000000-0000-4000-8000-000000000021') $$,
  'MFA super admin can requeue an invoice'
);
reset role;

select ok(
  (
    select status = 'pending'
      and attempt_count = 0
      and locked_at is null
      and locked_by is null
    from public.integration_jobs
    where id = '90000000-0000-4000-8000-000000000031'
  ),
  'manual retry resets and unlocks the durable job'
);
select is(
  (
    select sync_status::text
    from public.invoices
    where id = '90000000-0000-4000-8000-000000000021'
  ),
  'queued',
  'manual retry returns the invoice to the finance queue'
);
select is(
  (
    select count(*)
    from public.audit_logs
    where target_id = '90000000-0000-4000-8000-000000000021'
      and action = 'invoice.retry_requested'
  ),
  1::bigint,
  'manual retry is audited exactly once'
);

update public.integration_jobs
set
  status = 'processing',
  attempt_count = 1,
  locked_at = now(),
  locked_by = 'phase9-worker'
where id = '90000000-0000-4000-8000-000000000031';
set local role service_role;
select set_config(
  'request.jwt.claims',
  '{"role":"service_role","aal":"aal2"}',
  true
);
select lives_ok(
  $$ select public.defer_integration_job(
    '90000000-0000-4000-8000-000000000031',
    'phase9-worker',
    now() + interval '12 hours',
    'Zoho feature disabled'
  ) $$,
  'service worker can defer a deliberately disabled integration'
);
reset role;
select ok(
  (
    select status = 'retry'
      and attempt_count = 0
      and available_at > now()
      and locked_at is null
      and locked_by is null
    from public.integration_jobs
    where id = '90000000-0000-4000-8000-000000000031'
  ),
  'deferral releases the lock without consuming a retry attempt'
);

select throws_like(
  $$ update public.invoices
     set sync_status = 'completed', completed_at = now()
     where id = '90000000-0000-4000-8000-000000000021' $$,
  '%new row for relation "invoices" violates check constraint "invoices_%',
  'an invoice cannot complete without authoritative Zoho and PDF evidence'
);

insert into public.order_files (
  id,
  order_id,
  kind,
  visibility,
  bucket_name,
  object_key,
  original_filename,
  safe_filename,
  content_type,
  byte_size,
  sha256,
  scan_status,
  provider_source
)
values (
  '90000000-0000-4000-8000-000000000041',
  '90000000-0000-4000-8000-000000000001',
  'invoice_pdf',
  'customer',
  'garmops-private-orders',
  'organizations/alpha/orders/901/invoice.pdf',
  'RET-000901.pdf',
  'RET-000901.pdf',
  'application/pdf',
  100,
  repeat('a', 64),
  'not_required',
  'zoho'
);

select lives_ok(
  $$ update public.invoices
     set
       sync_status = 'completed',
       zoho_contact_id = 'ZOHO-CONTACT-901',
       zoho_document_id = 'ZOHO-DOCUMENT-901',
       zoho_payment_id = 'ZOHO-PAYMENT-901',
       document_number = 'RET-000901',
       issue_date = current_date,
       provider_status = 'paid',
       provider_snapshot = '{"document":{"status":"paid"}}'::jsonb,
       pdf_file_id = '90000000-0000-4000-8000-000000000041',
       completed_at = now()
     where id = '90000000-0000-4000-8000-000000000021' $$,
  'a fully reconciled Zoho document can complete'
);
select ok(
  (
    select sync_status = 'completed'
      and paid_paise = total_paise
      and balance_paise = 0
      and pdf_file_id is not null
    from public.invoices
    where id = '90000000-0000-4000-8000-000000000021'
  ),
  'completed accounting evidence remains internally reconciled'
);

select * from finish();
rollback;
