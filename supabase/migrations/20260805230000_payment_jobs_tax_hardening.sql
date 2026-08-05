-- Payment, integration-job and GST hardening.
-- Apply after 20260805215000_multi_item_custom_checkout.sql.

begin;

alter table public.payment_attempts
  add column if not exists reconciliation_attempts integer not null default 0,
  add column if not exists last_reconciled_at timestamptz,
  add column if not exists last_reconciliation_error text;

alter table public.custom_checkout_payment_attempts
  add column if not exists reconciliation_attempts integer not null default 0,
  add column if not exists last_reconciled_at timestamptz,
  add column if not exists last_reconciliation_error text;

create index if not exists payment_attempts_reconciliation_idx
  on public.payment_attempts(status, updated_at)
  where status in ('initiated','pending');

create index if not exists custom_checkout_payment_attempts_reconciliation_idx
  on public.custom_checkout_payment_attempts(status, updated_at)
  where status in ('initiated','pending');

create table if not exists public.system_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null check (job_name in ('integration_jobs','payu_reconciliation')),
  trigger_source text not null default 'cron' check (trigger_source in ('cron','staff','customer','system')),
  trigger_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'running' check (status in ('running','completed','failed')),
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists system_job_runs_latest_idx
  on public.system_job_runs(job_name, started_at desc);

alter table public.system_job_runs enable row level security;
alter table public.system_job_runs force row level security;

drop policy if exists system_job_runs_select_staff on public.system_job_runs;
create policy system_job_runs_select_staff
  on public.system_job_runs
  for select
  to authenticated
  using (public.staff_has_permission('view_all_orders'));

revoke all on public.system_job_runs from anon, authenticated;
grant select on public.system_job_runs to authenticated;
grant all on public.system_job_runs to service_role;

create or replace function public.record_payment_reconciliation_attempt(
  p_attempt_id uuid,
  p_custom_checkout boolean,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_custom_checkout then
    update public.custom_checkout_payment_attempts
    set reconciliation_attempts = reconciliation_attempts + 1,
        last_reconciled_at = now(),
        last_reconciliation_error = nullif(left(coalesce(p_error,''),4000),'')
    where id = p_attempt_id;
  else
    update public.payment_attempts
    set reconciliation_attempts = reconciliation_attempts + 1,
        last_reconciled_at = now(),
        last_reconciliation_error = nullif(left(coalesce(p_error,''),4000),'')
    where id = p_attempt_id;
  end if;
  return found;
end;
$$;

revoke all on function public.record_payment_reconciliation_attempt(uuid,boolean,text) from public, anon, authenticated;
grant execute on function public.record_payment_reconciliation_attempt(uuid,boolean,text) to service_role;

create or replace function public.retry_integration_job(p_job_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.staff_has_permission('change_order_status') then
    raise exception 'STAFF_PERMISSION_DENIED';
  end if;
  update public.integration_jobs
  set status='queued',
      available_at=now(),
      locked_at=null,
      locked_by=null,
      last_error=null,
      completed_at=null
  where id=p_job_id
    and status in ('retryable_failure','permanent_failure');
  return found;
end;
$$;

revoke all on function public.retry_integration_job(uuid) from public, anon;
grant execute on function public.retry_integration_job(uuid) to authenticated, service_role;

create or replace function public.finalize_custom_checkout_full_payment(
  p_checkout_payment_attempt_id uuid,
  p_provider_payment_id text,
  p_verified_amount_paise bigint,
  p_verified_snapshot jsonb,
  p_seller_snapshot jsonb
)
returns table(order_id uuid,order_number text,payment_attempt_id uuid,already_finalized boolean,duplicate_success boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.custom_checkout_payment_attempts%rowtype;
  v_session public.custom_checkout_sessions%rowtype;
  v_payload jsonb;
  v_order_id uuid;
  v_order_number text;
  v_payment_id uuid;
  v_item jsonb;
  v_invoice_lines jsonb;
  v_other_paid uuid;
  v_source public.order_source;
  v_created_by_staff uuid;
begin
  select * into v_attempt
  from public.custom_checkout_payment_attempts
  where id = p_checkout_payment_attempt_id
  for update;
  if not found then raise exception 'CHECKOUT_PAYMENT_ATTEMPT_NOT_FOUND'; end if;

  select * into v_session
  from public.custom_checkout_sessions
  where id = v_attempt.checkout_session_id
  for update;
  if not found then raise exception 'CHECKOUT_SESSION_NOT_FOUND'; end if;

  if v_attempt.amount_paise <> p_verified_amount_paise or v_session.total_paise <> p_verified_amount_paise then
    raise exception 'PAYMENT_AMOUNT_MISMATCH';
  end if;

  if v_session.status = 'finalized' then
    if v_attempt.status in ('paid','duplicate_success') then
      return query select v_session.final_order_id,v_session.final_order_number,v_session.final_payment_attempt_id,true,(v_attempt.status='duplicate_success');
      return;
    end if;
    update public.custom_checkout_payment_attempts set
      status = 'duplicate_success',
      provider_payment_id = p_provider_payment_id,
      raw_verified_snapshot = p_verified_snapshot,
      paid_at = now(),
      completed_at = now(),
      failure_code = 'DUPLICATE_VERIFIED_SUCCESS',
      failure_message = 'This verified success arrived after another attempt finalized the checkout'
    where id = v_attempt.id;
    insert into public.integration_jobs(job_type,deduplication_key,payload)
    values(
      'finance_duplicate_payment',
      'duplicate-payment:' || v_attempt.id,
      jsonb_build_object('checkoutAttemptId',v_attempt.id,'providerPaymentId',p_provider_payment_id,'orderId',v_session.final_order_id)
    ) on conflict do nothing;
    return query select v_session.final_order_id,v_session.final_order_number,v_session.final_payment_attempt_id,false,true;
    return;
  end if;

  select id into v_other_paid
  from public.custom_checkout_payment_attempts
  where checkout_session_id = v_session.id and status = 'paid' and id <> v_attempt.id
  limit 1;
  if v_other_paid is not null then
    update public.custom_checkout_payment_attempts set
      status = 'duplicate_success', provider_payment_id = p_provider_payment_id,
      raw_verified_snapshot = p_verified_snapshot, paid_at = now(), completed_at = now(),
      failure_code = 'DUPLICATE_VERIFIED_SUCCESS',
      failure_message = 'Another verified attempt already paid this checkout'
    where id = v_attempt.id;
    insert into public.integration_jobs(job_type,deduplication_key,payload)
    values('finance_duplicate_payment','duplicate-payment:'||v_attempt.id,jsonb_build_object('checkoutAttemptId',v_attempt.id,'providerPaymentId',p_provider_payment_id))
    on conflict do nothing;
    return query select v_session.final_order_id,v_session.final_order_number,v_session.final_payment_attempt_id,false,true;
    return;
  end if;

  -- Session expiry blocks creation of a new payment attempt, not completion of a
  -- payment that PayU accepted while the checkout was still valid. Callbacks and
  -- verify-API responses can legitimately arrive after the 30-minute deadline.
  if v_attempt.provider = 'payu' and (
    v_attempt.initiated_at is null
    or v_attempt.initiated_at > v_session.expires_at
  ) then
    raise exception 'PAYMENT_NOT_INITIATED_BEFORE_CHECKOUT_EXPIRY';
  end if;

  v_payload := v_session.rpc_payload;
  v_order_id := gen_random_uuid();
  v_order_number := public.next_number(
    case when v_payload->>'orderType' = 'sample_purchase' then 'sample_order' else 'custom_order' end,
    case when v_payload->>'orderType' = 'sample_purchase' then 'SAM' else 'GAR' end
  );
  v_source := coalesce(nullif(v_payload->>'orderSource','')::public.order_source,'customer_checkout'::public.order_source);
  v_created_by_staff := nullif(v_payload->>'createdByStaffUserId','')::uuid;

  insert into public.orders(
    id,order_number,order_type,order_source,customer_user_id,created_by_staff_user_id,
    design_project_id,design_version_id,status,public_status,subtotal_paise,
    discount_paise,taxable_value_paise,tax_paise,total_paise,amount_paid_paise,
    discount_code_id,discount_code_snapshot,pricing_version,
    configuration_schema_version,customer_reference,requested_delivery_date,
    billing_snapshot,shipping_snapshot,customer_snapshot,business_snapshot,
    terms_snapshot,configuration_snapshot
  ) values(
    v_order_id,v_order_number,coalesce((v_payload->>'orderType')::public.order_type,'custom_bulk'),
    v_source,v_session.customer_user_id,v_created_by_staff,
    nullif(v_payload->>'designProjectId','')::uuid,nullif(v_payload->>'designVersionId','')::uuid,
    'payment_confirmed','order_received',v_session.subtotal_paise,v_session.discount_paise,
    v_session.subtotal_paise-v_session.discount_paise,v_session.tax_paise,
    v_session.total_paise,v_session.total_paise,v_session.discount_code_id,
    v_payload->>'discountCode',v_payload->>'pricingVersion',
    coalesce((v_payload->>'configurationSchemaVersion')::integer,1),
    v_payload->>'customerReference',nullif(v_payload->>'requestedDeliveryDate','')::date,
    v_payload->'billingSnapshot',v_payload->'shippingSnapshot',v_payload->'customerSnapshot',
    coalesce(v_payload->'businessSnapshot','{}'::jsonb),v_payload->'termsSnapshot',
    v_payload->'configurationSnapshot'
  );

  for v_item in select * from jsonb_array_elements(v_payload->'items') loop
    insert into public.order_items(
      order_id,line_number,product_id,product_slug,product_name,product_snapshot,
      colour_snapshot,decoration_snapshot,artwork_snapshot,neck_label_snapshot,
      size_breakdown,quantity,unit_price_paise,line_total_paise
    ) values(
      v_order_id,(v_item->>'line_number')::integer,v_item->>'product_id',
      v_item->>'product_slug',v_item->>'product_name',v_item->'product_snapshot',
      v_item->'colour_snapshot',v_item->'decoration_snapshot',v_item->'artwork_snapshot',
      v_item->'neck_label_snapshot',v_item->'size_breakdown',(v_item->>'quantity')::integer,
      (v_item->>'unit_price_paise')::bigint,(v_item->>'line_total_paise')::bigint
    );
  end loop;

  update public.order_files set order_id = v_order_id, design_project_id = null
  where id = any(array(select jsonb_array_elements_text(coalesce(v_payload->'fileIds','[]'::jsonb))::uuid))
    and design_project_id = nullif(v_payload->>'designProjectId','')::uuid;

  update public.order_files set order_id = v_order_id, staff_quote_id = null
  where staff_quote_id = v_session.staff_quote_id and kind = 'proof';

  insert into public.payment_attempts(
    order_id,attempt_number,provider,provider_merchant_txn_id,provider_payment_id,
    purpose,amount_paise,status,expected_product_info,customer_email,customer_name,
    raw_verified_snapshot,initiated_at,paid_at
  ) values(
    v_order_id,1,v_attempt.provider,v_attempt.provider_merchant_txn_id,p_provider_payment_id,
    'order_full',p_verified_amount_paise,'paid',v_attempt.expected_product_info,
    v_attempt.customer_email,v_attempt.customer_name,p_verified_snapshot,
    v_attempt.initiated_at,now()
  ) returning id into v_payment_id;

  update public.custom_checkout_payment_attempts set
    status='paid',provider_payment_id=p_provider_payment_id,
    raw_verified_snapshot=p_verified_snapshot,paid_at=now(),completed_at=now(),
    failure_code=null,failure_message=null
  where id=v_attempt.id;

  update public.custom_checkout_sessions set
    status='finalized',final_order_id=v_order_id,final_payment_attempt_id=v_payment_id,
    final_order_number=v_order_number,provider_payment_id=p_provider_payment_id,
    verified_snapshot=p_verified_snapshot,finalized_at=now()
  where id=v_session.id;

  if v_session.staff_quote_id is not null then
    update public.staff_quotes set
      status='paid',customer_user_id=v_session.customer_user_id,
      accepted_at=coalesce(accepted_at,now()),final_order_id=v_order_id,
      offline_payment_reference=case when v_attempt.provider='bank_transfer' then p_provider_payment_id else offline_payment_reference end
    where id=v_session.staff_quote_id;
  end if;

  insert into public.order_status_history(
    order_id,from_status,to_status,public_status,actor_type,actor_user_id,
    customer_message,metadata
  ) values(
    v_order_id,null,'payment_confirmed','order_received','system',
    v_session.customer_user_id,'Payment confirmed. Your order has been received.',
    jsonb_build_object('checkoutSessionId',v_session.id,'staffQuoteId',v_session.staff_quote_id)
  );

  if not coalesce((v_payload->>'skipTermsAcceptance')::boolean,false) then
    insert into public.terms_acceptances(
      user_id,checkout_session_id,order_id,terms_version,privacy_version,
      terms_content_hash,source_flow,request_metadata
    ) values(
      v_session.customer_user_id,v_session.id,v_order_id,
      v_payload->'termsSnapshot'->>'version',
      coalesce(v_payload->'termsSnapshot'->>'privacyVersion','2026-07-29'),
      v_payload->'termsSnapshot'->>'contentHash',
      case when v_session.staff_quote_id is null then 'custom_checkout' else 'staff_quote_checkout' end,
      coalesce(v_payload->'termsSnapshot'->'requestMetadata','{}'::jsonb)
    );
  end if;

  if v_session.discount_code_id is not null and v_session.discount_paise > 0 then
    insert into public.discount_redemptions(discount_code_id,customer_user_id,order_id,discount_paise)
    values(v_session.discount_code_id,v_session.customer_user_id,v_order_id,v_session.discount_paise);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'description','Line ' || coalesce(item->>'line_number','1') || ': ' || coalesce(item->>'product_name','Garmops garment order'),
    'hsnCode',coalesce(item->'product_snapshot'->>'hsnCode','610910'),
    'quantity',(item->>'quantity')::integer,
    'unitPricePaise',(item->>'unit_price_paise')::bigint,
    'lineTotalPaise',(item->>'line_total_paise')::bigint,
    'gstRateBasisPoints',coalesce(
      nullif(item->'product_snapshot'->>'gstRateBasisPoints','')::integer,
      nullif(v_payload->>'gstRateBasisPoints','')::integer
    )
  ) order by (item->>'line_number')::integer),'[]'::jsonb)
  into v_invoice_lines
  from jsonb_array_elements(v_payload->'items') as item;

  insert into public.invoices(
    order_id,kind,status,subtotal_paise,discount_paise,taxable_value_paise,
    tax_paise,total_paise,paid_paise,line_items,seller_snapshot,buyer_snapshot,
    place_of_supply
  ) values(
    v_order_id,'tax_invoice','queued',v_session.subtotal_paise,v_session.discount_paise,
    v_session.subtotal_paise-v_session.discount_paise,v_session.tax_paise,
    v_session.total_paise,v_session.total_paise,v_invoice_lines,p_seller_snapshot,
    v_payload->'billingSnapshot',v_payload->'billingSnapshot'->'address'->>'state'
  );

  insert into public.integration_jobs(job_type,deduplication_key,payload)
  values('generate_tax_invoice','invoice:'||v_order_id,jsonb_build_object('orderId',v_order_id,'orderNumber',v_order_number))
  on conflict do nothing;
  insert into public.integration_jobs(job_type,deduplication_key,payload)
  values('send_order_confirmation','order-confirmation:'||v_order_id,jsonb_build_object('orderId',v_order_id,'orderNumber',v_order_number))
  on conflict do nothing;

  return query select v_order_id,v_order_number,v_payment_id,false,false;
end;
$$;


commit;
