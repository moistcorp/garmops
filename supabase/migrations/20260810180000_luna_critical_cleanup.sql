-- Luna cleanup: remove retired staff quotations/capacity, generalise checkout,
-- and add the durable recovery primitives used by the application.
begin;

do $$
begin
  if to_regclass('public.staff_quotes') is not null
     and exists (select 1 from public.staff_quotes limit 1) then
    raise exception 'LUNA_CLEANUP_BLOCKED_STAFF_QUOTES_EXIST';
  end if;
  if to_regclass('public.orders') is not null
     and exists (select 1 from public.orders where order_source::text = 'staff_payment_link' limit 1) then
    raise exception 'LUNA_CLEANUP_BLOCKED_STAFF_PAYMENT_LINK_ORDERS_EXIST';
  end if;
  if to_regclass('public.custom_checkout_sessions') is not null
     and exists (select 1 from public.custom_checkout_sessions where staff_quote_id is not null limit 1) then
    raise exception 'LUNA_CLEANUP_BLOCKED_QUOTE_CHECKOUT_SESSIONS_EXIST';
  end if;
  if to_regclass('public.order_files') is not null
     and exists (select 1 from public.order_files where staff_quote_id is not null limit 1) then
    raise exception 'LUNA_CLEANUP_BLOCKED_QUOTE_FILES_EXIST';
  end if;
end;
$$;

-- These functions contain the retired quote branch and must disappear before
-- the quote columns/table are removed.
drop function if exists public.finalize_custom_checkout_full_payment(uuid,text,bigint,jsonb,jsonb);
drop function if exists public.finalize_staff_quote_offline_payment(uuid,text,uuid,jsonb);

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_private_upload_slot'
  loop
    execute 'drop function ' || r.signature;
  end loop;
end;
$$;

alter table if exists public.custom_checkout_sessions rename to checkout_sessions;
alter table if exists public.custom_checkout_payment_attempts rename to checkout_payment_attempts;
alter table if exists public.custom_checkout_payment_events rename to checkout_payment_events;

-- Table renames do not rename dependent database object names. Keep the
-- resulting schema free of the retired software-domain prefix as well.
do $$
declare r record; next_name text;
begin
  for r in select conrelid::regclass as table_name, conname from pg_constraint where connamespace='public'::regnamespace and conname like 'custom_checkout%' loop
    next_name:=replace(r.conname,'custom_checkout','checkout');
    execute format('alter table %s rename constraint %I to %I',r.table_name,r.conname,next_name);
  end loop;
  for r in select c.oid::regclass as index_name,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='i' and c.relname like 'custom_checkout%' loop
    next_name:=replace(r.relname,'custom_checkout','checkout');
    execute format('alter index %s rename to %I',r.index_name,next_name);
  end loop;
  for r in select t.tgrelid::regclass as table_name,t.tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal and t.tgname like 'custom_checkout%' loop
    next_name:=replace(r.tgname,'custom_checkout','checkout');
    execute format('alter trigger %I on %s rename to %I',r.tgname,r.table_name,next_name);
  end loop;
  for r in select p.polrelid::regclass as table_name,p.polname from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and p.polname like 'custom_checkout%' loop
    next_name:=replace(r.polname,'custom_checkout','checkout');
    execute format('alter policy %I on %s rename to %I',r.polname,r.table_name,next_name);
  end loop;
end;
$$;

alter table if exists public.checkout_sessions add column if not exists flow text;
update public.checkout_sessions
set flow = case
  when coalesce(rpc_payload->>'orderType','') = 'sample_purchase' or cart_id like 'sample:%' then 'sample'
  else 'configurator'
end
where flow is null;
alter table public.checkout_sessions alter column flow set not null;
alter table public.checkout_sessions drop constraint if exists checkout_sessions_flow_check;
alter table public.checkout_sessions add constraint checkout_sessions_flow_check check (flow in ('configurator','sample'));

-- Recreate stored PL/pgSQL bodies whose source text still names the renamed
-- shared checkout relations. The finalizer itself is recreated below.
do $$
declare r record; definition text;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f','p')
      and pg_get_functiondef(p.oid) ilike any(array[
        '%custom_checkout_sessions%',
        '%custom_checkout_payment_attempts%',
        '%custom_checkout_payment_events%'
      ])
  loop
    definition := pg_get_functiondef(r.oid);
    definition := replace(definition, 'custom_checkout_sessions', 'checkout_sessions');
    definition := replace(definition, 'custom_checkout_payment_attempts', 'checkout_payment_attempts');
    definition := replace(definition, 'custom_checkout_payment_events', 'checkout_payment_events');
    execute definition;
  end loop;
end;
$$;

alter table if exists public.checkout_sessions drop constraint if exists checkout_sessions_staff_quote_fk;
drop index if exists public.custom_checkout_sessions_staff_quote_idx;
alter table if exists public.checkout_sessions drop column if exists staff_quote_id;
alter table if exists public.order_files drop constraint if exists order_files_staff_quote_fk;
alter table if exists public.order_files drop column if exists staff_quote_id;
drop table if exists public.staff_quotes;
drop type if exists public.quote_status;

alter table public.order_files drop constraint if exists order_files_exactly_one_target_check;
alter table public.order_files drop constraint if exists order_files_target_check;
alter table public.order_files add constraint order_files_exactly_one_target_check
  check (num_nonnulls(order_id, design_project_id) = 1);

do $$
begin
  if exists (select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='order_type' and e.enumlabel='custom_bulk') then
    alter type public.order_type rename value 'custom_bulk' to 'configurator_order';
  end if;
end;
$$;

-- Preserve all legitimate order-source data while eliminating the retired enum
-- value. The guard above ensures no financial row is silently rewritten.
alter table public.orders alter column order_source type text using order_source::text;
alter type public.order_source rename to order_source_retired;
create type public.order_source as enum ('customer_checkout','reorder');
alter table public.orders alter column order_source type public.order_source using order_source::public.order_source;
drop type public.order_source_retired;

alter table public.number_counters drop constraint if exists number_counters_namespace_check;
update public.number_counters set namespace = 'production_order' where namespace = 'custom_order';
alter table public.number_counters add constraint number_counters_namespace_check
  check (namespace in ('production_order','sample_order','invoice'));

-- Free shipping is a hard invariant, including historical rows that were not
-- created by the current application code.
update public.orders set shipping_charge_paise = 0 where shipping_charge_paise is distinct from 0;
alter table public.orders alter column shipping_charge_paise set default 0;
alter table public.orders alter column shipping_charge_paise set not null;
alter table public.orders drop constraint if exists orders_shipping_charge_is_free;
alter table public.orders add constraint orders_shipping_charge_is_free check (shipping_charge_paise = 0);

-- The dynamic factory-load model is retired. Static delivery rules live in the
-- application and do not depend on these relations.
drop table if exists public.production_working_days;
drop table if exists public.production_blackout_dates;
drop table if exists public.production_capacity_rules;
drop table if exists public.production_lead_time_rules;

create or replace function public.staff_has_permission(p_permission text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_role public.staff_role := public.current_staff_role();
begin
  if v_role is null or not public.staff_mfa_satisfied() then return false; end if;
  return case p_permission
    when 'view_all_orders' then true
    when 'change_order_status' then true
    when 'review_artwork' then true
    when 'edit_order_configuration' then true
    when 'manage_staff' then v_role = 'founder'
    when 'manage_discounts' then v_role = 'founder'
    when 'manage_refunds' then v_role = 'founder'
    when 'view_raw_payments' then v_role = 'founder'
    when 'override_order_workflow' then v_role = 'founder'
    else false
  end;
end;
$$;

-- Active checkout finalizer: one locked session, one locked attempt, one order.
create or replace function public.finalize_checkout_full_payment(
  p_checkout_payment_attempt_id uuid,
  p_provider_payment_id text,
  p_verified_amount_paise bigint,
  p_verified_snapshot jsonb,
  p_seller_snapshot jsonb
)
returns table(order_id uuid,order_number text,payment_attempt_id uuid,already_finalized boolean,duplicate_success boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_attempt public.checkout_payment_attempts%rowtype;
  v_session public.checkout_sessions%rowtype;
  v_payload jsonb;
  v_order_id uuid;
  v_order_number text;
  v_payment_id uuid;
  v_item jsonb;
  v_invoice_lines jsonb;
  v_other_paid uuid;
  v_order_type public.order_type;
begin
  select * into v_attempt from public.checkout_payment_attempts where id=p_checkout_payment_attempt_id for update;
  if not found then raise exception 'CHECKOUT_PAYMENT_ATTEMPT_NOT_FOUND'; end if;
  select * into v_session from public.checkout_sessions where id=v_attempt.checkout_session_id for update;
  if not found then raise exception 'CHECKOUT_SESSION_NOT_FOUND'; end if;
  if v_attempt.amount_paise <> p_verified_amount_paise or v_session.total_paise <> p_verified_amount_paise then raise exception 'PAYMENT_AMOUNT_MISMATCH'; end if;

  if v_session.status='finalized' then
    if v_attempt.status in ('paid','duplicate_success') then
      return query select v_session.final_order_id,v_session.final_order_number,v_session.final_payment_attempt_id,true,(v_attempt.status='duplicate_success'); return;
    end if;
    update public.checkout_payment_attempts set status='duplicate_success',provider_payment_id=p_provider_payment_id,raw_verified_snapshot=p_verified_snapshot,paid_at=now(),completed_at=now(),failure_code='DUPLICATE_VERIFIED_SUCCESS',failure_message='This verified success arrived after another attempt finalized the checkout' where id=v_attempt.id;
    insert into public.integration_jobs(job_type,deduplication_key,payload) values('finance_duplicate_payment','duplicate-payment:'||v_attempt.id,jsonb_build_object('checkoutAttemptId',v_attempt.id,'providerPaymentId',p_provider_payment_id,'orderId',v_session.final_order_id)) on conflict do nothing;
    return query select v_session.final_order_id,v_session.final_order_number,v_session.final_payment_attempt_id,false,true; return;
  end if;

  select id into v_other_paid from public.checkout_payment_attempts where checkout_session_id=v_session.id and status='paid' and id<>v_attempt.id limit 1;
  if v_other_paid is not null then
    update public.checkout_payment_attempts set status='duplicate_success',provider_payment_id=p_provider_payment_id,raw_verified_snapshot=p_verified_snapshot,paid_at=now(),completed_at=now(),failure_code='DUPLICATE_VERIFIED_SUCCESS',failure_message='Another verified attempt already paid this checkout' where id=v_attempt.id;
    insert into public.integration_jobs(job_type,deduplication_key,payload) values('finance_duplicate_payment','duplicate-payment:'||v_attempt.id,jsonb_build_object('checkoutAttemptId',v_attempt.id,'providerPaymentId',p_provider_payment_id)) on conflict do nothing;
    return query select v_session.final_order_id,v_session.final_order_number,v_session.final_payment_attempt_id,false,true; return;
  end if;
  if v_attempt.initiated_at is null or v_attempt.initiated_at > v_session.expires_at then raise exception 'PAYMENT_NOT_INITIATED_BEFORE_CHECKOUT_EXPIRY'; end if;

  v_payload := v_session.rpc_payload;
  v_order_type := case when v_session.flow='sample' then 'sample_purchase'::public.order_type else 'configurator_order'::public.order_type end;
  v_order_id := gen_random_uuid();
  v_order_number := public.next_number(case when v_session.flow='sample' then 'sample_order' else 'production_order' end,case when v_session.flow='sample' then 'SAM' else 'GAR' end);
  insert into public.orders(id,order_number,order_type,order_source,customer_user_id,design_project_id,design_version_id,status,public_status,subtotal_paise,discount_paise,taxable_value_paise,tax_paise,total_paise,amount_paid_paise,discount_code_id,discount_code_snapshot,pricing_version,configuration_schema_version,customer_reference,requested_delivery_date,billing_snapshot,shipping_snapshot,customer_snapshot,business_snapshot,terms_snapshot,configuration_snapshot,shipping_charge_paise)
  values(v_order_id,v_order_number,v_order_type,'customer_checkout',v_session.customer_user_id,nullif(v_payload->>'designProjectId','')::uuid,nullif(v_payload->>'designVersionId','')::uuid,'payment_confirmed','order_received',v_session.subtotal_paise,v_session.discount_paise,v_session.subtotal_paise-v_session.discount_paise,v_session.tax_paise,v_session.total_paise,v_session.total_paise,v_session.discount_code_id,v_payload->>'discountCode',v_payload->>'pricingVersion',coalesce((v_payload->>'configurationSchemaVersion')::integer,1),v_payload->>'customerReference',nullif(v_payload->>'requestedDeliveryDate','')::date,v_payload->'billingSnapshot',v_payload->'shippingSnapshot',v_payload->'customerSnapshot',coalesce(v_payload->'businessSnapshot','{}'::jsonb),v_payload->'termsSnapshot',v_payload->'configurationSnapshot',0);

  for v_item in select * from jsonb_array_elements(v_payload->'items') loop
    insert into public.order_items(order_id,line_number,product_id,product_slug,product_name,product_snapshot,colour_snapshot,decoration_snapshot,artwork_snapshot,neck_label_snapshot,size_breakdown,quantity,unit_price_paise,line_total_paise)
    values(v_order_id,(v_item->>'line_number')::integer,v_item->>'product_id',v_item->>'product_slug',v_item->>'product_name',v_item->'product_snapshot',v_item->'colour_snapshot',v_item->'decoration_snapshot',v_item->'artwork_snapshot',v_item->'neck_label_snapshot',v_item->'size_breakdown',(v_item->>'quantity')::integer,(v_item->>'unit_price_paise')::bigint,(v_item->>'line_total_paise')::bigint);
  end loop;

  update public.order_files set order_id=v_order_id,design_project_id=null where id=any(array(select jsonb_array_elements_text(coalesce(v_payload->'fileIds','[]'::jsonb))::uuid)) and design_project_id=nullif(v_payload->>'designProjectId','')::uuid;
  insert into public.payment_attempts(order_id,attempt_number,provider,provider_merchant_txn_id,provider_payment_id,purpose,amount_paise,status,expected_product_info,customer_email,customer_name,raw_verified_snapshot,initiated_at,paid_at)
  values(v_order_id,1,v_attempt.provider,v_attempt.provider_merchant_txn_id,p_provider_payment_id,'order_full',p_verified_amount_paise,'paid',v_attempt.expected_product_info,v_attempt.customer_email,v_attempt.customer_name,p_verified_snapshot,v_attempt.initiated_at,now()) returning id into v_payment_id;
  update public.checkout_payment_attempts set status='paid',provider_payment_id=p_provider_payment_id,raw_verified_snapshot=p_verified_snapshot,paid_at=now(),completed_at=now(),failure_code=null,failure_message=null where id=v_attempt.id;
  update public.checkout_sessions set status='finalized',final_order_id=v_order_id,final_payment_attempt_id=v_payment_id,final_order_number=v_order_number,provider_payment_id=p_provider_payment_id,verified_snapshot=p_verified_snapshot,finalized_at=now() where id=v_session.id;

  insert into public.order_status_history(order_id,from_status,to_status,public_status,actor_type,actor_user_id,customer_message,metadata) values(v_order_id,null,'payment_confirmed','order_received','system',v_session.customer_user_id,'Payment confirmed. Your order has been received.',jsonb_build_object('checkoutSessionId',v_session.id,'flow',v_session.flow));
  insert into public.terms_acceptances(user_id,checkout_session_id,order_id,terms_version,privacy_version,terms_content_hash,source_flow,request_metadata) values(v_session.customer_user_id,v_session.id,v_order_id,v_payload->'termsSnapshot'->>'version',coalesce(v_payload->'termsSnapshot'->>'privacyVersion','privacy-v1'),v_payload->'termsSnapshot'->>'contentHash',case when v_session.flow='sample' then 'sample_checkout' else 'configurator_checkout' end,coalesce(v_payload->'termsSnapshot'->'requestMetadata','{}'::jsonb));
  if v_session.flow='configurator' and v_session.discount_code_id is not null and v_session.discount_paise>0 then
    insert into public.discount_redemptions(discount_code_id,customer_user_id,order_id,discount_paise) values(v_session.discount_code_id,v_session.customer_user_id,v_order_id,v_session.discount_paise);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('description','Line '||coalesce(item->>'line_number','1')||': '||coalesce(item->>'product_name','Garmops order'),'hsnCode',coalesce(item->'product_snapshot'->>'hsnCode','610910'),'quantity',(item->>'quantity')::integer,'unitPricePaise',(item->>'unit_price_paise')::bigint,'lineTotalPaise',(item->>'line_total_paise')::bigint,'gstRateBasisPoints',coalesce(nullif(item->'product_snapshot'->>'gstRateBasisPoints','')::integer,nullif(v_payload->>'gstRateBasisPoints','')::integer)) order by (item->>'line_number')::integer),'[]'::jsonb) into v_invoice_lines from jsonb_array_elements(v_payload->'items') as item;
  insert into public.invoices(order_id,kind,status,subtotal_paise,discount_paise,taxable_value_paise,tax_paise,total_paise,paid_paise,line_items,seller_snapshot,buyer_snapshot,place_of_supply) values(v_order_id,'tax_invoice','queued',v_session.subtotal_paise,v_session.discount_paise,v_session.subtotal_paise-v_session.discount_paise,v_session.tax_paise,v_session.total_paise,v_session.total_paise,v_invoice_lines,p_seller_snapshot,v_payload->'billingSnapshot',v_payload->'billingSnapshot'->'address'->>'state');
  insert into public.integration_jobs(job_type,deduplication_key,payload) values('generate_tax_invoice','invoice:'||v_order_id,jsonb_build_object('orderId',v_order_id,'orderNumber',v_order_number)) on conflict do nothing;
  insert into public.integration_jobs(job_type,deduplication_key,payload) values('send_order_confirmation','order-confirmation:'||v_order_id,jsonb_build_object('orderId',v_order_id,'orderNumber',v_order_number)) on conflict do nothing;
  return query select v_order_id,v_order_number,v_payment_id,false,false;
end;
$$;
revoke all on function public.finalize_checkout_full_payment(uuid,text,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.finalize_checkout_full_payment(uuid,text,bigint,jsonb,jsonb) to service_role;

-- Upload target RPC without the retired quote target.
create function public.create_private_upload_slot(
  p_order_id uuid,p_design_project_id uuid,p_replacement_for_file_id uuid,
  p_kind public.file_kind,p_visibility public.file_visibility,p_original_filename text,
  p_safe_filename text,p_content_type text,p_byte_size bigint,p_extension text,
  p_sha256 text,p_expires_at timestamptz
)
returns table(file_id uuid,object_key text) language plpgsql security definer set search_path = '' as $$
declare v_file uuid:=gen_random_uuid(); v_owner uuid:=auth.uid(); v_key text; v_total bigint; v_count bigint; v_extension text:=lower(btrim(p_extension)); v_content_type text:=lower(btrim(p_content_type)); v_account public.account_type:=public.current_account_type(); v_order public.orders%rowtype; v_active_requirement public.order_artwork_requirements%rowtype; v_active_file public.order_files%rowtype;
begin
  if v_owner is null or v_account is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if num_nonnulls(p_order_id,p_design_project_id)<>1 then raise exception 'UPLOAD_TARGET_REQUIRED'; end if;
  if p_byte_size<=0 or p_byte_size>52428800 then raise exception 'FILE_SIZE_INVALID'; end if;
  if p_expires_at<=now() or p_expires_at>now()+interval '15 minutes' then raise exception 'UPLOAD_EXPIRY_INVALID'; end if;
  if p_sha256 is not null and p_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'SHA256_INVALID'; end if;
  perform public.expire_private_upload_slots();
  if p_kind='customer_artwork' then
    if not ((v_extension='png' and v_content_type='image/png') or (v_extension in ('jpg','jpeg') and v_content_type='image/jpeg') or (v_extension='pdf' and v_content_type='application/pdf') or (v_extension='svg' and v_content_type='image/svg+xml') or (v_extension='ai' and v_content_type in ('application/postscript','application/illustrator','application/vnd.adobe.illustrator','application/octet-stream'))) then raise exception 'FILE_TYPE_DENIED'; end if;
  elsif p_kind='proof' then
    if not ((v_extension='png' and v_content_type='image/png') or (v_extension in ('jpg','jpeg') and v_content_type='image/jpeg') or (v_extension='pdf' and v_content_type='application/pdf')) then raise exception 'FILE_TYPE_DENIED'; end if;
  elsif p_kind in ('approval_pdf','packing_list','shipping_label','shipment_document') then
    if not ((v_extension='pdf' and v_content_type='application/pdf') or (p_kind<>'approval_pdf' and v_extension='png' and v_content_type='image/png') or (p_kind<>'approval_pdf' and v_extension in ('jpg','jpeg') and v_content_type='image/jpeg')) then raise exception 'FILE_TYPE_DENIED'; end if;
  elsif p_kind='qc_photo' then
    if not ((v_extension='png' and v_content_type='image/png') or (v_extension in ('jpg','jpeg') and v_content_type='image/jpeg') or (v_extension='webp' and v_content_type='image/webp')) then raise exception 'FILE_TYPE_DENIED'; end if;
  else raise exception 'BROWSER_UPLOAD_KIND_DENIED'; end if;
  if v_account='customer' then
    if p_kind<>'customer_artwork' or p_visibility<>'customer' then raise exception 'CUSTOMER_UPLOAD_KIND_DENIED'; end if;
    if p_order_id is not null then
      select * into v_order from public.orders where id=p_order_id and customer_user_id=v_owner for update;
      if not found then raise exception 'UPLOAD_TARGET_DENIED'; end if;
      if v_order.status not in ('order_review','artwork_pending') then raise exception 'ARTWORK_UPLOAD_LOCKED'; end if;
      if p_replacement_for_file_id is null then raise exception 'ARTWORK_REVISION_REQUIRED'; end if;
    elsif not exists(select 1 from public.design_projects where id=p_design_project_id and created_by=v_owner) then raise exception 'UPLOAD_TARGET_DENIED'; end if;
  else
    if not public.is_active_staff(true) then raise exception 'STAFF_MFA_REQUIRED'; end if;
    if p_order_id is not null then
      select * into v_order from public.orders where id=p_order_id for update;
      if not found then raise exception 'UPLOAD_TARGET_DENIED'; end if;
      if p_kind='customer_artwork' and p_replacement_for_file_id is null then raise exception 'ARTWORK_REVISION_REQUIRED'; end if;
      if p_kind='customer_artwork' and v_order.status in ('material_preparation','printing','stitching','quality_check','packing','ready_to_dispatch','dispatched','delivered') then raise exception 'ORDER_PRODUCTION_LOCKED'; end if;
    elsif p_design_project_id is not null and not exists(select 1 from public.design_projects where id=p_design_project_id) then raise exception 'UPLOAD_TARGET_DENIED'; end if;
  end if;
  if p_order_id is not null and p_kind='customer_artwork' then
    select active.* into v_active_requirement from public.order_artwork_requirements supplied join public.order_artwork_requirements active on active.order_id=supplied.order_id and active.requirement_key=supplied.requirement_key and active.is_active where supplied.order_id=p_order_id and supplied.file_id=p_replacement_for_file_id for update of active;
    if not found then raise exception 'ARTWORK_REVISION_NOT_FOUND'; end if;
    select * into v_active_file from public.order_files where id=v_active_requirement.file_id for update;
    if v_account='customer' and v_active_file.review_status not in ('changes_requested','rejected') and v_active_file.upload_status not in ('failed','expired') then raise exception 'ARTWORK_REPLACEMENT_NOT_OPEN'; end if;
    p_replacement_for_file_id:=v_active_requirement.file_id;
  elsif p_replacement_for_file_id is not null then raise exception 'ARTWORK_REVISION_TARGET_INVALID'; end if;
  select count(*),coalesce(sum(byte_size),0) into v_count,v_total from public.order_files where deleted_at is null and upload_status in ('pending','finalized') and ((p_order_id is not null and order_id=p_order_id) or (p_design_project_id is not null and design_project_id=p_design_project_id));
  if p_kind='customer_artwork' then
    select count(*) into v_count from public.order_files where deleted_at is null and upload_status in ('pending','finalized') and kind='customer_artwork' and ((p_order_id is not null and order_id=p_order_id) or (p_design_project_id is not null and design_project_id=p_design_project_id));
    if v_count>=10 then raise exception 'FILE_COUNT_LIMIT'; end if;
  end if;
  if v_total+p_byte_size>262144000 then raise exception 'FILE_TOTAL_LIMIT'; end if;
  v_key:='private/'||to_char(now(),'YYYY/MM')||'/'||v_file::text||'/'||regexp_replace(p_safe_filename,'[^A-Za-z0-9._-]','_','g');
  insert into public.order_files(id,order_id,design_project_id,replacement_for_file_id,uploaded_by,kind,visibility,object_key,original_filename,safe_filename,extension,content_type,byte_size,sha256,upload_expires_at) values(v_file,p_order_id,p_design_project_id,p_replacement_for_file_id,v_owner,p_kind,p_visibility,v_key,p_original_filename,p_safe_filename,v_extension,v_content_type,p_byte_size,p_sha256,p_expires_at);
  return query select v_file,v_key;
end;
$$;
grant execute on function public.create_private_upload_slot(uuid,uuid,uuid,public.file_kind,public.file_visibility,text,text,text,bigint,text,text,timestamptz) to authenticated,service_role;

-- Integration jobs use a ten-minute lease and can only be manually recovered
-- once that lease is stale.
drop function if exists public.record_payment_reconciliation_attempt(uuid,boolean,text);
create function public.record_payment_reconciliation_attempt(
  p_attempt_id uuid,p_checkout boolean,p_error text default null
)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if p_checkout then
    update public.checkout_payment_attempts set reconciliation_attempts=reconciliation_attempts+1,last_reconciled_at=now(),last_reconciliation_error=nullif(left(coalesce(p_error,''),4000),'') where id=p_attempt_id;
  else
    update public.payment_attempts set reconciliation_attempts=reconciliation_attempts+1,last_reconciled_at=now(),last_reconciliation_error=nullif(left(coalesce(p_error,''),4000),'') where id=p_attempt_id;
  end if;
  return found;
end;
$$;
revoke all on function public.record_payment_reconciliation_attempt(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.record_payment_reconciliation_attempt(uuid,boolean,text) to service_role;

create or replace function public.claim_integration_jobs(p_worker_id text,p_limit integer)
returns setof public.integration_jobs language plpgsql security definer set search_path = '' as $$
begin
  return query with picked as (
    select id from public.integration_jobs
    where (status in ('queued','retryable_failure') and available_at<=now())
       or (status='processing' and locked_at is not null and locked_at<now()-interval '10 minutes')
    order by created_at for update skip locked limit greatest(1,least(p_limit,100))
  )
  update public.integration_jobs j set status='processing',attempts=j.attempts+1,locked_at=now(),locked_by=p_worker_id,last_error=case when j.status='processing' then left(coalesce(j.last_error,'')||' [stale lease reclaimed]',4000) else j.last_error end from picked where j.id=picked.id returning j.*;
end;
$$;

create or replace function public.retry_integration_job(p_job_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.staff_has_permission('change_order_status') then raise exception 'STAFF_PERMISSION_DENIED'; end if;
  update public.integration_jobs set status='queued',available_at=now(),locked_at=null,locked_by=null,last_error=null,completed_at=null
  where id=p_job_id and status='processing' and locked_at is not null and locked_at<now()-interval '10 minutes';
  return found;
end;
$$;

create or replace function public.reserve_tax_invoice_number(p_invoice_id uuid)
returns table(invoice_id uuid,invoice_number text)
language plpgsql security definer set search_path = '' as $$
declare v_invoice public.invoices%rowtype; v_number text;
begin
  select * into v_invoice from public.invoices where id=p_invoice_id and kind='tax_invoice' for update;
  if not found then raise exception 'INVOICE_NOT_FOUND'; end if;
  v_number:=v_invoice.invoice_number;
  if v_number is null then
    v_number:=public.next_number('invoice','INV');
    update public.invoices set invoice_number=v_number,issued_at=coalesce(issued_at,now()) where id=p_invoice_id;
  end if;
  return query select p_invoice_id,v_number;
end;
$$;
grant execute on function public.reserve_tax_invoice_number(uuid) to service_role;

create or replace function public.save_customer_address(
  p_address_id uuid,p_role text,p_label text,p_contact_name text,p_phone text,
  p_line1 text,p_line2 text,p_landmark text,p_city text,p_state text,
  p_postal_code text,p_country_code text,p_use_as_shipping boolean
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_existing public.addresses%rowtype; v_id uuid; v_default_shipping boolean; v_default_billing boolean;
begin
  if v_user is null or public.current_account_type()<>'customer' then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if p_role not in ('billing','shipping') then raise exception 'ADDRESS_ROLE_INVALID'; end if;
  perform 1 from public.addresses where user_id=v_user for update;
  if p_address_id is not null then
    select * into v_existing from public.addresses where id=p_address_id and user_id=v_user for update;
    if not found then raise exception 'ADDRESS_NOT_FOUND'; end if;
  end if;
  v_default_billing:=case when p_role='billing' then true else coalesce(v_existing.is_default_billing,false) end;
  v_default_shipping:=case when p_role='billing' then p_use_as_shipping else p_use_as_shipping or coalesce(v_existing.is_default_shipping,false) or not exists(select 1 from public.addresses where user_id=v_user and is_default_shipping and id is distinct from p_address_id) end;
  if p_role='billing' then update public.addresses set is_default_billing=false where user_id=v_user and is_default_billing and id is distinct from p_address_id; end if;
  if v_default_shipping then update public.addresses set is_default_shipping=false where user_id=v_user and is_default_shipping and id is distinct from p_address_id; end if;
  if p_address_id is null then
    insert into public.addresses(user_id,label,contact_name,phone,line1,line2,landmark,city,state,postal_code,country_code,is_default_billing,is_default_shipping) values(v_user,p_label,p_contact_name,p_phone,p_line1,p_line2,p_landmark,p_city,p_state,p_postal_code,p_country_code,v_default_billing,v_default_shipping) returning id into v_id;
  else
    update public.addresses set label=p_label,contact_name=p_contact_name,phone=p_phone,line1=p_line1,line2=p_line2,landmark=p_landmark,city=p_city,state=p_state,postal_code=p_postal_code,country_code=p_country_code,is_default_billing=v_default_billing,is_default_shipping=v_default_shipping where id=p_address_id and user_id=v_user returning id into v_id;
  end if;
  return v_id;
end;
$$;
grant execute on function public.save_customer_address(uuid,text,text,text,text,text,text,text,text,text,text,text,boolean) to authenticated;

commit;
