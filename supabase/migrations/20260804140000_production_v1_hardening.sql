-- Production-v1 hardening and staff-created checkout support.
-- Runs after 20260804123000_production_v1_clean_schema.sql.

begin;

-- Quote-backed checkouts and offline payment evidence.
alter table public.custom_checkout_sessions
  add column if not exists staff_quote_id uuid;
create unique index if not exists custom_checkout_sessions_staff_quote_idx
  on public.custom_checkout_sessions(staff_quote_id);

alter table public.staff_quotes
  add column if not exists customer_user_id uuid references public.profiles(id),
  add column if not exists accepted_at timestamptz,
  add column if not exists offline_payment_reference text,
  add column if not exists offline_payment_proof_file_id uuid;

alter table public.order_files
  add column if not exists staff_quote_id uuid;

alter table public.custom_checkout_sessions
  add constraint custom_checkout_sessions_staff_quote_fk
  foreign key (staff_quote_id) references public.staff_quotes(id) on delete set null;

alter table public.order_files
  add constraint order_files_staff_quote_fk
  foreign key (staff_quote_id) references public.staff_quotes(id) on delete cascade;

alter table public.staff_quotes
  add constraint staff_quotes_offline_payment_proof_fk
  foreign key (offline_payment_proof_file_id) references public.order_files(id) on delete set null;

-- Replace the old two-target file check with an exact one-target rule that also
-- supports Founder-only offline-payment evidence attached to a staff quote.
do $$
declare v_constraint text;
begin
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.order_files'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%order_id is not null or design_project_id is not null%'
  loop
    execute format('alter table public.order_files drop constraint %I', v_constraint);
  end loop;
end;
$$;

alter table public.order_files
  add constraint order_files_exactly_one_target_check
  check (num_nonnulls(order_id, design_project_id, staff_quote_id) = 1);

-- Permit audited bank-transfer records in addition to PayU.
alter table public.payment_attempts drop constraint if exists payment_attempts_provider_check;
alter table public.payment_attempts
  add constraint payment_attempts_provider_check
  check (provider in ('payu', 'bank_transfer', 'manual'));

alter table public.custom_checkout_payment_attempts drop constraint if exists custom_checkout_payment_attempts_provider_check;
alter table public.custom_checkout_payment_attempts
  add constraint custom_checkout_payment_attempts_provider_check
  check (provider in ('payu', 'bank_transfer'));

-- Customer-safe and staff-complete history are exposed through separate RPCs.
-- Direct table access is removed so internal notes cannot leak through PostgREST.
revoke select on public.order_status_history from authenticated;

create or replace function public.customer_order_history(p_order_id uuid)
returns table(
  id uuid,
  to_status public.order_status,
  public_status public.public_order_status,
  customer_message text,
  actor_type text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select h.id, h.to_status, h.public_status, h.customer_message, h.actor_type, h.created_at
  from public.order_status_history h
  join public.orders o on o.id = h.order_id
  where h.order_id = p_order_id
    and o.customer_user_id = auth.uid()
    and h.customer_visible
  order by h.created_at
$$;

create or replace function public.staff_order_history(p_order_id uuid)
returns table(
  id uuid,
  to_status public.order_status,
  public_status public.public_order_status,
  customer_message text,
  internal_note text,
  reason text,
  actor_type text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select h.id, h.to_status, h.public_status, h.customer_message,
         h.internal_note, h.reason, h.actor_type, h.created_at
  from public.order_status_history h
  where h.order_id = p_order_id
    and public.is_active_staff(true)
  order by h.created_at desc
$$;

-- Customer-visible file metadata must itself be customer-visible. Staff-only
-- evidence, labels, QC photos, and internal documents remain staff-only.
drop policy if exists files_owner_staff_select on public.order_files;
create policy files_owner_staff_select on public.order_files
for select to authenticated
using (
  public.is_active_staff(true)
  or uploaded_by = auth.uid()
  or (
    visibility = 'customer'
    and (
      exists(select 1 from public.orders o where o.id = order_id and o.customer_user_id = auth.uid())
      or exists(select 1 from public.design_projects d where d.id = design_project_id and d.created_by = auth.uid())
    )
  )
);

-- Browser upload slots are database-authoritative about target ownership, file
-- count/size, and the exact extension/MIME combinations allowed at launch.
drop function if exists public.create_private_upload_slot(
  uuid, uuid, public.file_kind, public.file_visibility, text, text, text,
  bigint, text, text, timestamptz
);

create function public.create_private_upload_slot(
  p_order_id uuid,
  p_design_project_id uuid,
  p_staff_quote_id uuid,
  p_kind public.file_kind,
  p_visibility public.file_visibility,
  p_original_filename text,
  p_safe_filename text,
  p_content_type text,
  p_byte_size bigint,
  p_extension text,
  p_sha256 text,
  p_expires_at timestamptz
)
returns table(file_id uuid, object_key text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_file uuid := gen_random_uuid();
  v_owner uuid := auth.uid();
  v_key text;
  v_total bigint;
  v_count bigint;
  v_extension text := lower(btrim(p_extension));
  v_content_type text := lower(btrim(p_content_type));
  v_account public.account_type := public.current_account_type();
begin
  if v_owner is null or v_account is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if num_nonnulls(p_order_id, p_design_project_id, p_staff_quote_id) <> 1 then raise exception 'UPLOAD_TARGET_REQUIRED'; end if;
  if p_byte_size <= 0 or p_byte_size > 52428800 then raise exception 'FILE_SIZE_INVALID'; end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '15 minutes' then raise exception 'UPLOAD_EXPIRY_INVALID'; end if;
  if p_sha256 is not null and p_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'SHA256_INVALID'; end if;

  if p_kind = 'customer_artwork' then
    if not (
      (v_extension = 'png' and v_content_type = 'image/png')
      or (v_extension in ('jpg','jpeg') and v_content_type = 'image/jpeg')
      or (v_extension = 'pdf' and v_content_type = 'application/pdf')
      or (v_extension = 'svg' and v_content_type = 'image/svg+xml')
      or (v_extension = 'ai' and v_content_type in ('application/postscript','application/illustrator','application/vnd.adobe.illustrator','application/octet-stream'))
    ) then raise exception 'FILE_TYPE_DENIED'; end if;
  elsif p_kind = 'proof' then
    if not (
      (v_extension = 'png' and v_content_type = 'image/png')
      or (v_extension in ('jpg','jpeg') and v_content_type = 'image/jpeg')
      or (v_extension = 'pdf' and v_content_type = 'application/pdf')
    ) then raise exception 'FILE_TYPE_DENIED'; end if;
  elsif p_kind in ('approval_pdf','packing_list','shipping_label','shipment_document') then
    if not (
      (v_extension = 'pdf' and v_content_type = 'application/pdf')
      or (p_kind <> 'approval_pdf' and v_extension = 'png' and v_content_type = 'image/png')
      or (p_kind <> 'approval_pdf' and v_extension in ('jpg','jpeg') and v_content_type = 'image/jpeg')
    ) then raise exception 'FILE_TYPE_DENIED'; end if;
  elsif p_kind = 'qc_photo' then
    if not (
      (v_extension = 'png' and v_content_type = 'image/png')
      or (v_extension in ('jpg','jpeg') and v_content_type = 'image/jpeg')
      or (v_extension = 'webp' and v_content_type = 'image/webp')
    ) then raise exception 'FILE_TYPE_DENIED'; end if;
  else
    raise exception 'BROWSER_UPLOAD_KIND_DENIED';
  end if;

  if v_account = 'customer' then
    if p_staff_quote_id is not null or p_kind <> 'customer_artwork' or p_visibility <> 'customer' then
      raise exception 'CUSTOMER_UPLOAD_KIND_DENIED';
    end if;
    if p_order_id is not null and not exists(
      select 1 from public.orders where id = p_order_id and customer_user_id = v_owner
    ) then raise exception 'UPLOAD_TARGET_DENIED'; end if;
    if p_design_project_id is not null and not exists(
      select 1 from public.design_projects where id = p_design_project_id and created_by = v_owner
    ) then raise exception 'UPLOAD_TARGET_DENIED'; end if;
  else
    if not public.is_active_staff(true) then raise exception 'STAFF_MFA_REQUIRED'; end if;
    if p_order_id is not null and not exists(select 1 from public.orders where id = p_order_id) then raise exception 'UPLOAD_TARGET_DENIED'; end if;
    if p_design_project_id is not null and not exists(select 1 from public.design_projects where id = p_design_project_id) then raise exception 'UPLOAD_TARGET_DENIED'; end if;
    if p_staff_quote_id is not null then
      if p_kind <> 'proof' or p_visibility <> 'staff_only' then raise exception 'QUOTE_UPLOAD_KIND_DENIED'; end if;
      if not exists(select 1 from public.staff_quotes where id = p_staff_quote_id and status in ('draft','sent')) then raise exception 'UPLOAD_TARGET_DENIED'; end if;
    end if;
  end if;

  select count(*), coalesce(sum(byte_size),0)
  into v_count, v_total
  from public.order_files
  where deleted_at is null
    and upload_status in ('pending','finalized')
    and (
      (p_order_id is not null and order_id = p_order_id)
      or (p_design_project_id is not null and design_project_id = p_design_project_id)
      or (p_staff_quote_id is not null and staff_quote_id = p_staff_quote_id)
    );

  if p_kind = 'customer_artwork' then
    select count(*) into v_count
    from public.order_files
    where deleted_at is null
      and upload_status in ('pending','finalized')
      and kind = 'customer_artwork'
      and (
        (p_order_id is not null and order_id = p_order_id)
        or (p_design_project_id is not null and design_project_id = p_design_project_id)
      );
    if v_count >= 10 then raise exception 'FILE_COUNT_LIMIT'; end if;
  end if;
  if v_total + p_byte_size > 262144000 then raise exception 'FILE_TOTAL_LIMIT'; end if;

  v_key := 'private/' || to_char(now(),'YYYY/MM') || '/' || v_file::text || '/' ||
    regexp_replace(p_safe_filename,'[^A-Za-z0-9._-]','_','g');
  insert into public.order_files(
    id, order_id, design_project_id, staff_quote_id, uploaded_by, kind, visibility,
    object_key, original_filename, safe_filename, extension, content_type,
    byte_size, sha256, upload_expires_at
  ) values(
    v_file, p_order_id, p_design_project_id, p_staff_quote_id, v_owner, p_kind,
    p_visibility, v_key, p_original_filename, p_safe_filename, v_extension,
    v_content_type, p_byte_size, p_sha256, p_expires_at
  );
  return query select v_file, v_key;
end;
$$;

create or replace function public.finalize_private_upload(
  p_file_id uuid,
  p_actual_byte_size bigint,
  p_actual_content_type text,
  p_object_etag text,
  p_actual_sha256 text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_file public.order_files%rowtype;
begin
  select * into v_file from public.order_files where id = p_file_id for update;
  if not found or v_file.deleted_at is not null or v_file.upload_status <> 'pending' or v_file.upload_expires_at <= now() then return false; end if;
  if auth.role() <> 'service_role' and v_file.uploaded_by <> auth.uid() then return false; end if;
  if v_file.byte_size <> p_actual_byte_size or lower(v_file.content_type) <> lower(p_actual_content_type) then return false; end if;
  if v_file.sha256 is not null and v_file.sha256 <> p_actual_sha256 then return false; end if;
  update public.order_files set
    upload_status = 'finalized',
    finalized_at = now(),
    object_etag = p_object_etag,
    scan_status = case when kind = 'customer_artwork' then 'manual_review'::public.file_scan_status else 'not_required'::public.file_scan_status end,
    review_status = case when kind = 'customer_artwork' then 'pending_review'::public.artwork_review_status else 'approved'::public.artwork_review_status end
  where id = p_file_id;
  return true;
end;
$$;

-- Full-payment finalisation now handles staff-issued quotations and correctly
-- records a delayed second PayU success even after the first attempt finalized.
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

  if v_session.expires_at <= now() and v_attempt.provider = 'payu' then raise exception 'CHECKOUT_EXPIRED'; end if;

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
    'description',coalesce(item->>'product_name','Garmops garment order'),
    'hsnCode',coalesce(item->'product_snapshot'->>'hsnCode','610910'),
    'quantity',(item->>'quantity')::integer,
    'unitPricePaise',(item->>'unit_price_paise')::bigint,
    'lineTotalPaise',(item->>'line_total_paise')::bigint,
    'gstRateBasisPoints',500
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

-- Founder-only offline payment finalisation. A finalized private proof file and
-- a pre-existing verified customer account are mandatory.
create or replace function public.finalize_staff_quote_offline_payment(
  p_quote_id uuid,
  p_reference text,
  p_proof_file_id uuid,
  p_seller_snapshot jsonb
)
returns table(order_id uuid,order_number text,payment_attempt_id uuid,already_finalized boolean,duplicate_success boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.staff_quotes%rowtype;
  v_customer uuid;
  v_session uuid;
  v_attempt uuid;
  v_payload jsonb;
begin
  if public.current_staff_role() <> 'founder' or not public.staff_mfa_satisfied() then
    raise exception 'FOUNDER_PERMISSION_REQUIRED';
  end if;
  if nullif(btrim(p_reference),'') is null then raise exception 'REFERENCE_REQUIRED'; end if;

  select * into v_quote from public.staff_quotes where id=p_quote_id for update;
  if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
  if v_quote.status='paid' and v_quote.final_order_id is not null then
    return query
    select o.id,o.order_number,p.id,true,false
    from public.orders o
    left join public.payment_attempts p
      on p.order_id=o.id and p.purpose='order_full' and p.status='paid'
    where o.id=v_quote.final_order_id
    order by p.paid_at desc nulls last
    limit 1;
    return;
  end if;
  if v_quote.status not in ('draft','sent') then raise exception 'QUOTE_NOT_PAYABLE'; end if;

  select p.user_id into v_customer
  from public.account_principals p
  where p.normalized_email=v_quote.customer_email and p.account_type='customer' and p.active and p.user_id is not null;
  if v_customer is null then raise exception 'CUSTOMER_ACCOUNT_REQUIRED'; end if;

  if not exists(
    select 1 from public.order_files f
    where f.id=p_proof_file_id and f.staff_quote_id=p_quote_id and f.kind='proof'
      and f.visibility='staff_only' and f.upload_status='finalized' and f.deleted_at is null
  ) then raise exception 'PAYMENT_PROOF_REQUIRED'; end if;

  v_payload := jsonb_build_object(
    'orderType','custom_bulk',
    'orderSource','staff_payment_link',
    'createdByStaffUserId',v_quote.created_by,
    'staffQuoteId',v_quote.id,
    'pricingVersion',coalesce(v_quote.pricing_snapshot->>'pricingVersion','staff-quote-v1'),
    'configurationSchemaVersion',coalesce((v_quote.configuration_snapshot->>'schemaVersion')::integer,1),
    'customerReference',v_quote.quote_number,
    'billingSnapshot',v_quote.billing_snapshot,
    'shippingSnapshot',v_quote.shipping_snapshot,
    'customerSnapshot',jsonb_build_object('userId',v_customer,'name',v_quote.customer_name,'email',v_quote.customer_email,'phone',v_quote.customer_phone),
    'businessSnapshot',coalesce(v_quote.billing_snapshot->'business','{}'::jsonb),
    'termsSnapshot',jsonb_build_object(
      'version','staff-quote-offline-v1','privacyVersion','2026-07-29',
      'contentHash',encode(extensions.digest('staff-quote-offline-v1','sha256'),'hex'),
      'requestMetadata',jsonb_build_object('paymentMethod','bank_transfer','recordedBy',auth.uid())
    ),
    'skipTermsAcceptance',true,
    'configurationSnapshot',v_quote.configuration_snapshot,
    'items',coalesce(v_quote.pricing_snapshot->'items','[]'::jsonb),
    'fileIds','[]'::jsonb
  );

  insert into public.custom_checkout_sessions(
    customer_user_id,cart_id,idempotency_key,request_hash,status,rpc_payload,
    subtotal_paise,discount_paise,tax_paise,total_paise,currency,return_path,
    expires_at,staff_quote_id
  ) values(
    v_customer,'staff-quote:'||v_quote.id,v_quote.id,
    encode(extensions.digest(v_quote.id::text||':'||btrim(p_reference),'sha256'),'hex'),
    'payment_verified',v_payload,v_quote.subtotal_paise,v_quote.discount_paise,
    v_quote.tax_paise,v_quote.total_paise,'INR','/account/orders',now()+interval '5 minutes',v_quote.id
  )
  on conflict(staff_quote_id) do update set updated_at=now()
  returning id into v_session;

  insert into public.custom_checkout_payment_attempts(
    checkout_session_id,attempt_number,provider,provider_merchant_txn_id,
    provider_payment_id,amount_paise,currency,status,expected_product_info,
    customer_email,customer_name,customer_phone,initiated_at
  ) values(
    v_session,1,'bank_transfer','BANK-'||replace(v_quote.id::text,'-',''),btrim(p_reference),
    v_quote.total_paise,'INR','created','Garmops staff quotation '||v_quote.quote_number,
    v_quote.customer_email,v_quote.customer_name,v_quote.customer_phone,now()
  )
  on conflict(checkout_session_id,attempt_number) do update set provider_payment_id=excluded.provider_payment_id
  returning id into v_attempt;

  update public.staff_quotes set offline_payment_reference=btrim(p_reference),offline_payment_proof_file_id=p_proof_file_id where id=p_quote_id;

  return query
  select * from public.finalize_custom_checkout_full_payment(
    v_attempt,btrim(p_reference),v_quote.total_paise,
    jsonb_build_object('source','manual_bank_transfer','reference',btrim(p_reference),'proofFileId',p_proof_file_id,'recordedBy',auth.uid(),'recordedAt',now()),
    p_seller_snapshot
  );
end;
$$;

-- Cancellation approval is separate from normal status advancement.
create or replace function public.decide_order_cancellation(p_request_id uuid,p_approve boolean,p_note text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_request public.cancellation_requests%rowtype; v_order public.orders%rowtype;
begin
  if public.current_staff_role() <> 'founder' or not public.staff_mfa_satisfied() then raise exception 'FOUNDER_PERMISSION_REQUIRED'; end if;
  select * into v_request from public.cancellation_requests where id=p_request_id and status='pending' for update;
  if not found then raise exception 'CANCELLATION_REQUEST_NOT_FOUND'; end if;
  select * into v_order from public.orders where id=v_request.order_id for update;
  update public.cancellation_requests set status=case when p_approve then 'approved' else 'rejected' end,decided_by=auth.uid(),decided_at=now() where id=p_request_id;
  if p_approve then
    update public.orders set status='cancelled',public_status='cancelled',cancelled_at=now() where id=v_order.id;
    insert into public.order_status_history(order_id,from_status,to_status,public_status,actor_type,actor_user_id,customer_message,internal_note,reason)
    values(v_order.id,v_order.status,'cancelled','cancelled','staff',auth.uid(),'Your order has been cancelled.',nullif(btrim(p_note),''),v_request.reason);
  end if;
  insert into public.audit_logs(actor_user_id,actor_type,action,target_type,target_id,order_id,before_state,after_state,metadata)
  values(auth.uid(),'staff','order.cancellation_decided','cancellation_request',v_request.id,v_order.id,jsonb_build_object('status','pending'),jsonb_build_object('status',case when p_approve then 'approved' else 'rejected' end),jsonb_build_object('reason',v_request.reason,'note',p_note));
  return true;
end;
$$;

-- Operations cannot directly cancel; both roles submit a request and Founder
-- decides it. Refund status transitions remain Founder-only.
create or replace function public.staff_transition_order(
  p_order_id uuid,p_to_status public.order_status,p_customer_message text default null,
  p_internal_note text default null,p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_order public.orders%rowtype; v_role public.staff_role := public.current_staff_role(); v_public public.public_order_status;
begin
  if not public.staff_has_permission('change_order_status') then raise exception 'STAFF_PERMISSION_DENIED'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if p_to_status='cancelled' then raise exception 'CANCELLATION_REQUEST_REQUIRED'; end if;
  if not public.is_order_transition_allowed(v_order.status,p_to_status) then raise exception 'INVALID_STATUS_TRANSITION'; end if;
  if v_role='operations' and p_to_status in ('refund_pending','refunded') then raise exception 'FOUNDER_APPROVAL_REQUIRED'; end if;
  if p_to_status in ('refund_pending','refunded','on_hold') and nullif(btrim(p_reason),'') is null then raise exception 'REASON_REQUIRED'; end if;
  if p_to_status='production_approved' then
    if v_order.amount_paid_paise <> v_order.total_paise then raise exception 'VERIFIED_PAYMENT_REQUIRED'; end if;
    if exists(select 1 from public.order_files where (order_id=v_order.id or design_project_id=v_order.design_project_id) and kind='customer_artwork' and deleted_at is null and review_status <> 'approved') then raise exception 'ARTWORK_APPROVAL_REQUIRED'; end if;
  end if;
  if p_to_status='dispatched' and v_order.shipping_payment_status not in ('paid','waived','not_required') then raise exception 'SHIPPING_PAYMENT_REQUIRED'; end if;
  v_public := public.order_public_status_for_internal(p_to_status);
  update public.orders set status=p_to_status,public_status=v_public,
    artwork_approved_at=case when p_to_status='artwork_approved' then now() else artwork_approved_at end,
    production_started_at=case when p_to_status='material_preparation' then now() else production_started_at end,
    dispatched_at=case when p_to_status='dispatched' then now() else dispatched_at end,
    delivered_at=case when p_to_status='delivered' then now() else delivered_at end
  where id=p_order_id;
  insert into public.order_status_history(order_id,from_status,to_status,public_status,actor_type,actor_user_id,customer_visible,customer_message,internal_note,reason)
  values(v_order.id,v_order.status,p_to_status,v_public,'staff',auth.uid(),true,coalesce(nullif(btrim(p_customer_message),''),'Order status updated.'),nullif(btrim(p_internal_note),''),nullif(btrim(p_reason),''));
  insert into public.audit_logs(actor_user_id,actor_type,action,target_type,target_id,order_id,before_state,after_state,metadata)
  values(auth.uid(),'staff','order.status_changed','order',v_order.id,v_order.id,jsonb_build_object('status',v_order.status),jsonb_build_object('status',p_to_status),jsonb_build_object('reason',p_reason));
  return true;
end;
$$;

revoke all on function public.create_private_upload_slot(uuid,uuid,uuid,public.file_kind,public.file_visibility,text,text,text,bigint,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.create_private_upload_slot(uuid,uuid,uuid,public.file_kind,public.file_visibility,text,text,text,bigint,text,text,timestamptz) to authenticated;
revoke all on function public.customer_order_history(uuid),public.staff_order_history(uuid),public.finalize_staff_quote_offline_payment(uuid,text,uuid,jsonb),public.decide_order_cancellation(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.customer_order_history(uuid),public.staff_order_history(uuid),public.finalize_staff_quote_offline_payment(uuid,text,uuid,jsonb),public.decide_order_cancellation(uuid,boolean,text) to authenticated;

commit;
