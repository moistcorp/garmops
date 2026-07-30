create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;

select plan(18);

select ok(
  to_regprocedure(
    'public.record_payu_payment_state(uuid,text,text,text,text,jsonb)'
  ) is not null,
  'Phase 8 non-success payment-state function exists'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.record_payu_payment_state(uuid,text,text,text,text,jsonb)',
    'EXECUTE'
  ),
  'service role can record verified PayU state'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.record_payu_payment_state(uuid,text,text,text,text,jsonb)',
    'EXECUTE'
  ),
  'browser sessions cannot record provider payment state'
);
select ok(
  to_regclass('public.payment_attempts_reconciliation_idx') is not null,
  'stale PayU attempts have a bounded reconciliation index'
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
  pricing_version,
  configuration_schema_version,
  billing_snapshot,
  shipping_snapshot,
  customer_snapshot,
  company_snapshot,
  terms_snapshot,
  expires_at
)
values
(
  '80000000-0000-4000-8000-000000000001',
  'GAR-2026-000801',
  'custom_bulk',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'awaiting_payment',
  'payment_incomplete',
  100000,
  100000,
  49900,
  'phase8-test-v1',
  1,
  '{}'::jsonb,
  '{}'::jsonb,
  '{"name":"Asha Mehta","email":"asha@example.com","phone":"+919810000001"}'::jsonb,
  '{}'::jsonb,
  '{"accepted":true,"version":"phase8-test"}'::jsonb,
  now() + interval '1 day'
),
(
  '80000000-0000-4000-8000-000000000002',
  'GAR-2026-000802',
  'custom_bulk',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'awaiting_payment',
  'payment_incomplete',
  100000,
  100000,
  49900,
  'phase8-test-v1',
  1,
  '{}'::jsonb,
  '{}'::jsonb,
  '{"name":"Asha Mehta","email":"asha@example.com","phone":"+919810000001"}'::jsonb,
  '{}'::jsonb,
  '{"accepted":true,"version":"phase8-test"}'::jsonb,
  now() + interval '1 day'
);

insert into public.payment_attempts (
  id,
  payment_number,
  order_id,
  provider_merchant_txn_id,
  attempt_number,
  purpose,
  amount_paise,
  status,
  expected_product_info,
  customer_email,
  customer_name,
  initiated_at
)
values
(
  '80000000-0000-4000-8000-000000000011',
  'PAY-GAR-2026-000801-01',
  '80000000-0000-4000-8000-000000000001',
  'PHASE8TXN80101',
  1,
  'reservation',
  49900,
  'initiated',
  'Order GAR-2026-000801 reservation',
  'asha@example.com',
  'Asha Mehta',
  now()
),
(
  '80000000-0000-4000-8000-000000000021',
  'PAY-GAR-2026-000802-01',
  '80000000-0000-4000-8000-000000000002',
  'PHASE8TXN80201',
  1,
  'reservation',
  49900,
  'initiated',
  'Order GAR-2026-000802 reservation',
  'asha@example.com',
  'Asha Mehta',
  now()
),
(
  '80000000-0000-4000-8000-000000000022',
  'PAY-GAR-2026-000802-02',
  '80000000-0000-4000-8000-000000000002',
  'PHASE8TXN80202',
  2,
  'reservation',
  49900,
  'initiated',
  'Order GAR-2026-000802 reservation',
  'asha@example.com',
  'Asha Mehta',
  now()
);

select lives_ok(
  $$select public.record_payu_payment_state(
    '80000000-0000-4000-8000-000000000011',
    'pending',
    null,
    null,
    null,
    '{"status":"pending"}'::jsonb
  )$$,
  'pending verification can be recorded'
);
select is(
  (select status::text from public.payment_attempts where id = '80000000-0000-4000-8000-000000000011'),
  'pending',
  'attempt moves to pending'
);
select is(
  (select count(*) from public.audit_logs where target_id = '80000000-0000-4000-8000-000000000011' and action = 'payment.pending'),
  1::bigint,
  'first pending transition is audited once'
);

select public.record_payu_payment_state(
  '80000000-0000-4000-8000-000000000011',
  'pending',
  null,
  null,
  null,
  '{"status":"pending-again"}'::jsonb
);
select is(
  (select count(*) from public.audit_logs where target_id = '80000000-0000-4000-8000-000000000011' and action = 'payment.pending'),
  1::bigint,
  'duplicate pending verification does not duplicate the transition audit'
);

select public.record_payu_payment_state(
  '80000000-0000-4000-8000-000000000011',
  'failed',
  '403993715530000001',
  'E_PAYMENT_FAILED',
  'Payment failed in sandbox',
  '{"status":"failure"}'::jsonb
);
select is(
  (select status::text from public.payment_attempts where id = '80000000-0000-4000-8000-000000000011'),
  'failed',
  'attempt moves to failed'
);
select is(
  (select status::text from public.orders where id = '80000000-0000-4000-8000-000000000001'),
  'payment_failed',
  'latest failed attempt updates the durable order'
);
select ok(
  exists (
    select 1
    from public.order_status_history
    where order_id = '80000000-0000-4000-8000-000000000001'
      and to_status = 'payment_failed'
      and actor_type = 'provider'
  ),
  'provider failure appends customer-visible order history'
);

select public.record_payu_payment_state(
  '80000000-0000-4000-8000-000000000011',
  'pending',
  '403993715530000001',
  null,
  null,
  '{"status":"pending"}'::jsonb
);
select ok(
  (select status = 'pending' and failed_at is null from public.payment_attempts where id = '80000000-0000-4000-8000-000000000011'),
  'pending reconciliation clears stale failure evidence'
);
select is(
  (select status::text from public.orders where id = '80000000-0000-4000-8000-000000000001'),
  'awaiting_payment',
  'pending reconciliation restores the unpaid order state'
);

update public.payment_attempts
set status = 'paid', paid_at = now()
where id = '80000000-0000-4000-8000-000000000011';
select public.record_payu_payment_state(
  '80000000-0000-4000-8000-000000000011',
  'failed',
  null,
  'LATE_FAILURE',
  'Delayed provider failure',
  '{"status":"failure"}'::jsonb
);
select is(
  (select status::text from public.payment_attempts where id = '80000000-0000-4000-8000-000000000011'),
  'paid',
  'delayed failure cannot downgrade a paid attempt'
);

select public.record_payu_payment_state(
  '80000000-0000-4000-8000-000000000021',
  'failed',
  null,
  'OLD_ATTEMPT_FAILED',
  'Older attempt failed',
  '{"status":"failure"}'::jsonb
);
select is(
  (select status::text from public.orders where id = '80000000-0000-4000-8000-000000000002'),
  'awaiting_payment',
  'late failure from an older attempt does not overwrite a newer retry'
);
select is(
  (select status::text from public.payment_attempts where id = '80000000-0000-4000-8000-000000000021'),
  'failed',
  'older attempt still keeps its own verified failure state'
);


select public.record_payu_payment_state(
  '80000000-0000-4000-8000-000000000022',
  'disputed',
  '403993715530000099',
  'DUPLICATE_VERIFIED_SUCCESS',
  'A second provider success requires finance review',
  '{"status":"success","classification":"duplicate"}'::jsonb
);
select is(
  (select status::text from public.payment_attempts where id = '80000000-0000-4000-8000-000000000022'),
  'disputed',
  'a second verified success is retained as a finance exception'
);
select is(
  (select status::text from public.orders where id = '80000000-0000-4000-8000-000000000002'),
  'awaiting_payment',
  'recording the exception does not corrupt the durable order state'
);

select * from finish();
rollback;
