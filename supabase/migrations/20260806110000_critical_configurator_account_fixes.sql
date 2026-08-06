-- Critical configurator, customer-account, and Foundry security fixes.
-- Safe to apply after the production-v1 migrations on existing deployments.

begin;

-- ---------------------------------------------------------------------------
-- 1. Paid-order files are immutable and required artwork is tracked explicitly.
-- ---------------------------------------------------------------------------

create table if not exists public.order_artwork_requirements (
  order_id uuid not null references public.orders(id) on delete cascade,
  file_id uuid not null references public.order_files(id) on delete restrict,
  captured_at timestamptz not null default now(),
  primary key (order_id, file_id)
);

alter table public.order_artwork_requirements enable row level security;
alter table public.order_artwork_requirements force row level security;
revoke all on table public.order_artwork_requirements from public, anon, authenticated;
grant all on table public.order_artwork_requirements to service_role;

create or replace function public.capture_order_artwork_requirement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'customer_artwork' and new.order_id is not null then
    insert into public.order_artwork_requirements(order_id, file_id)
    values(new.order_id, new.id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists order_files_capture_artwork_requirement on public.order_files;
create trigger order_files_capture_artwork_requirement
after insert or update of order_id, kind on public.order_files
for each row execute function public.capture_order_artwork_requirement();

-- Repair files from secondary cart configurations created by the previous
-- finalizer. Their IDs remain in immutable order-item snapshots even when the
-- file row was not attached to the order.
with snapshot_file_ids as (
  select oi.order_id, candidate.file_id_text::uuid as file_id
  from public.order_items oi
  cross join lateral (
    values
      (oi.artwork_snapshot #>> '{front,fileId}'),
      (oi.artwork_snapshot #>> '{back,fileId}'),
      (oi.neck_label_snapshot ->> 'fileId')
  ) as candidate(file_id_text)
  where candidate.file_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
)
update public.order_files f
set order_id = expected.order_id,
    design_project_id = null
from snapshot_file_ids expected
where f.id = expected.file_id
  and (f.order_id is null or f.order_id = expected.order_id);

insert into public.order_artwork_requirements(order_id, file_id)
select f.order_id, f.id
from public.order_files f
where f.kind = 'customer_artwork' and f.order_id is not null
on conflict do nothing;

create or replace function public.link_finalized_checkout_files()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_file_ids uuid[];
  v_expected integer;
  v_linked integer;
begin
  if new.status <> 'finalized'
     or old.status = 'finalized'
     or new.final_order_id is null then
    return new;
  end if;

  select coalesce(array_agg(value::uuid), array[]::uuid[])
  into v_file_ids
  from jsonb_array_elements_text(coalesce(new.rpc_payload->'fileIds','[]'::jsonb));

  v_expected := cardinality(v_file_ids);
  if v_expected = 0 then
    return new;
  end if;

  update public.order_files
  set order_id = new.final_order_id,
      design_project_id = null
  where id = any(v_file_ids)
    and deleted_at is null
    and upload_status = 'finalized'
    and (order_id is null or order_id = new.final_order_id);

  select count(*)
  into v_linked
  from public.order_files f
  where f.id = any(v_file_ids)
    and f.order_id = new.final_order_id
    and f.deleted_at is null
    and f.upload_status = 'finalized';

  if v_linked <> v_expected then
    raise exception 'CHECKOUT_FILE_LINK_FAILED';
  end if;

  return new;
end;
$$;

drop trigger if exists custom_checkout_sessions_link_finalized_files
on public.custom_checkout_sessions;
create trigger custom_checkout_sessions_link_finalized_files
after update of status, final_order_id on public.custom_checkout_sessions
for each row execute function public.link_finalized_checkout_files();

create or replace function public.soft_delete_file(p_file_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_file public.order_files%rowtype;
  v_actor_type text;
begin
  select * into v_file
  from public.order_files
  where id = p_file_id
  for update;

  if not found or v_file.deleted_at is not null then
    return false;
  end if;

  if public.current_account_type() = 'customer' then
    if v_file.uploaded_by <> auth.uid() then
      return false;
    end if;
    if v_file.order_id is not null
       or exists(
         select 1 from public.order_artwork_requirements r
         where r.file_id = v_file.id
       )
       or exists(
         select 1
         from public.custom_checkout_sessions s
         where s.customer_user_id = auth.uid()
           and s.status not in ('failed','expired','finalized')
           and coalesce(s.rpc_payload->'fileIds','[]'::jsonb) ? v_file.id::text
       ) then
      raise exception 'FILE_LOCKED_TO_ORDER';
    end if;
    v_actor_type := 'customer';
  elsif public.current_staff_role() = 'founder' and public.staff_mfa_satisfied() then
    if v_file.order_id is not null
       or exists(select 1 from public.order_artwork_requirements r where r.file_id = v_file.id)
       or exists(
         select 1
         from public.custom_checkout_sessions s
         where s.status not in ('failed','expired','finalized')
           and coalesce(s.rpc_payload->'fileIds','[]'::jsonb) ? v_file.id::text
       ) then
      raise exception 'FILE_LOCKED_TO_ORDER';
    end if;
    v_actor_type := 'staff';
  else
    raise exception 'FILE_DELETE_PERMISSION_DENIED';
  end if;

  update public.order_files
  set deleted_at = now()
  where id = v_file.id;

  insert into public.audit_logs(
    actor_user_id, actor_type, action, target_type, target_id, order_id,
    before_state, after_state
  ) values(
    auth.uid(), v_actor_type, 'file.deleted', 'order_file', v_file.id, v_file.order_id,
    jsonb_build_object('deletedAt', v_file.deleted_at, 'kind', v_file.kind),
    jsonb_build_object('deletedAt', now(), 'kind', v_file.kind)
  );

  return true;
end;
$$;

create or replace function public.staff_transition_order(
  p_order_id uuid,p_to_status public.order_status,p_customer_message text default null,
  p_internal_note text default null,p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_order public.orders%rowtype; v_public public.public_order_status;
begin
  if not public.staff_has_permission('change_order_status') then raise exception 'STAFF_PERMISSION_DENIED'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if p_to_status='cancelled' then raise exception 'CANCELLATION_REQUEST_REQUIRED'; end if;
  if p_to_status in ('refund_pending','refunded') then raise exception 'REFUND_ACTION_REQUIRED'; end if;
  if not public.is_order_transition_allowed(v_order.status,p_to_status) then raise exception 'INVALID_STATUS_TRANSITION'; end if;
  if p_to_status='on_hold' and nullif(btrim(p_reason),'') is null then raise exception 'REASON_REQUIRED'; end if;
  if p_to_status='production_approved' then
    if v_order.amount_paid_paise<>v_order.total_paise then raise exception 'VERIFIED_PAYMENT_REQUIRED'; end if;

    -- Immutable line snapshots are the source of truth. This catches a file row
    -- that was detached or physically removed before the requirement ledger was
    -- introduced, as well as files that are not production-ready.
    if exists(
      select 1
      from public.order_items oi
      cross join lateral (
        values
          (oi.artwork_snapshot #>> '{front,fileId}'),
          (oi.artwork_snapshot #>> '{back,fileId}'),
          (oi.neck_label_snapshot ->> 'fileId')
      ) as expected(file_id_text)
      left join public.order_files f on lower(f.id::text) = lower(expected.file_id_text)
      where oi.order_id = v_order.id
        and nullif(btrim(expected.file_id_text),'') is not null
        and (
          f.id is null
          or f.order_id is distinct from v_order.id
          or f.deleted_at is not null
          or f.upload_status <> 'finalized'
          or f.review_status <> 'approved'
          or f.scan_status <> 'clean'
        )
    ) then
      raise exception 'ARTWORK_APPROVAL_REQUIRED';
    end if;

    if exists(
      select 1
      from public.order_artwork_requirements r
      left join public.order_files f on f.id = r.file_id
      where r.order_id = v_order.id
        and (
          f.id is null
          or f.order_id is distinct from v_order.id
          or f.deleted_at is not null
          or f.upload_status <> 'finalized'
          or f.review_status <> 'approved'
          or f.scan_status <> 'clean'
        )
    ) then
      raise exception 'ARTWORK_APPROVAL_REQUIRED';
    end if;

    if exists(
      select 1
      from public.order_files f
      where f.order_id = v_order.id
        and f.kind = 'customer_artwork'
        and (
          f.deleted_at is not null
          or f.upload_status <> 'finalized'
          or f.review_status <> 'approved'
          or f.scan_status <> 'clean'
        )
    ) then
      raise exception 'ARTWORK_APPROVAL_REQUIRED';
    end if;
  end if;
  if p_to_status='dispatched' and v_order.shipping_payment_status not in ('paid','waived','not_required') then raise exception 'SHIPPING_PAYMENT_REQUIRED'; end if;
  v_public:=public.order_public_status_for_internal(p_to_status);
  update public.orders set status=p_to_status,public_status=v_public,
    artwork_approved_at=case when p_to_status='artwork_approved' then now() else artwork_approved_at end,
    production_started_at=case when p_to_status='material_preparation' then now() else production_started_at end,
    dispatched_at=case when p_to_status='dispatched' then now() else dispatched_at end,
    delivered_at=case when p_to_status='delivered' then now() else delivered_at end,
    configuration_reopened_at=case when p_to_status in ('dispatched','delivered') then null else configuration_reopened_at end,
    configuration_reopened_by=case when p_to_status in ('dispatched','delivered') then null else configuration_reopened_by end,
    configuration_reopen_reason=case when p_to_status in ('dispatched','delivered') then null else configuration_reopen_reason end
  where id=p_order_id;
  insert into public.order_status_history(order_id,from_status,to_status,public_status,actor_type,actor_user_id,customer_visible,customer_message,internal_note,reason)
  values(v_order.id,v_order.status,p_to_status,v_public,'staff',auth.uid(),true,coalesce(nullif(btrim(p_customer_message),''),'Order status updated.'),nullif(btrim(p_internal_note),''),nullif(btrim(p_reason),''));
  insert into public.audit_logs(actor_user_id,actor_type,action,target_type,target_id,order_id,before_state,after_state,metadata)
  values(auth.uid(),'staff','order.status_changed','order',v_order.id,v_order.id,jsonb_build_object('status',v_order.status),jsonb_build_object('status',p_to_status),jsonb_build_object('reason',p_reason));
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Replace arbitrary shipping URLs with server-created PayU attempts.
-- ---------------------------------------------------------------------------

create or replace function public.staff_has_permission(p_permission text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_role public.staff_role := public.current_staff_role();
begin
  if v_role is null then return false; end if;
  if not public.staff_mfa_satisfied() then return false; end if;
  return case p_permission
    when 'view_all_orders' then true
    when 'change_order_status' then true
    when 'review_artwork' then true
    when 'edit_order_configuration' then true
    when 'create_staff_quote' then true
    when 'manage_shipping_payments' then true
    when 'manage_staff' then v_role = 'founder'
    when 'manage_discounts' then v_role = 'founder'
    when 'manage_refunds' then v_role = 'founder'
    when 'view_raw_payments' then v_role = 'founder'
    when 'override_order_workflow' then v_role = 'founder'
    else false
  end;
end;
$$;

-- Remove any previously saved external URL immediately.
update public.orders set shipping_payment_link_url = null
where shipping_payment_link_url is not null;

do $$
declare v_constraint record;
begin
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%shipping_payment_status%'
      and pg_get_constraintdef(oid) ilike '%shipping_payment_link_url%'
  loop
    execute format('alter table public.orders drop constraint %I', v_constraint.conname);
  end loop;
end;
$$;

alter table public.orders
  drop constraint if exists orders_shipping_payment_state_check;
alter table public.orders
  add constraint orders_shipping_payment_state_check
  check (shipping_payment_status <> 'link_created' or shipping_charge_paise is not null);

create or replace function public.set_shipping_payment_link(
  p_order_id uuid,p_amount_paise bigint,p_url text,p_reference text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'ARBITRARY_SHIPPING_LINKS_DISABLED';
end;
$$;

revoke all on function public.set_shipping_payment_link(uuid,bigint,text,text)
from public, anon, authenticated;

create or replace function public.create_shipping_payment_attempt(
  p_order_id uuid,
  p_amount_paise bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_latest public.payment_attempts%rowtype;
  v_attempt_id uuid := gen_random_uuid();
  v_attempt_number integer;
  v_email text;
  v_name text;
  v_txn text;
begin
  if not public.staff_has_permission('manage_shipping_payments') then
    raise exception 'STAFF_PERMISSION_DENIED';
  end if;
  if p_amount_paise <= 0 or p_amount_paise > 1000000000 then
    raise exception 'SHIPPING_AMOUNT_INVALID';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status in ('cancelled','refund_pending','refunded','delivered') then
    raise exception 'ORDER_NOT_PAYABLE';
  end if;
  if v_order.shipping_payment_status = 'paid' then
    raise exception 'SHIPPING_ALREADY_PAID';
  end if;
  if v_order.shipping_payment_status in ('waived','not_required') then
    raise exception 'SHIPPING_ALREADY_SETTLED';
  end if;

  select * into v_latest
  from public.payment_attempts
  where order_id = v_order.id and purpose = 'shipping'
  order by attempt_number desc
  limit 1
  for update;

  if found then
    if v_latest.status = 'paid' then raise exception 'SHIPPING_ALREADY_PAID'; end if;
    if v_latest.status in ('initiated','pending','disputed','duplicate_success') then
      raise exception 'SHIPPING_PAYMENT_IN_PROGRESS';
    end if;
    if v_latest.status = 'created' and v_latest.amount_paise = p_amount_paise then
      update public.orders
      set shipping_payment_status = 'link_created',
          shipping_payment_link_url = null,
          shipping_payment_reference = v_latest.id::text
      where id = v_order.id;
      return v_latest.id;
    end if;
    if v_latest.status = 'created' then
      update public.payment_attempts
      set status = 'cancelled', failure_code = 'QUOTE_REPLACED',
          failure_message = 'Shipping quote was replaced before payment started'
      where id = v_latest.id;
    end if;
    v_attempt_number := v_latest.attempt_number + 1;
  else
    v_attempt_number := 1;
  end if;

  if v_attempt_number > 99 then raise exception 'PAYMENT_ATTEMPT_LIMIT_REACHED'; end if;

  v_email := lower(coalesce(
    nullif(v_order.customer_snapshot->>'email',''),
    nullif(v_order.billing_snapshot->>'email','')
  ));
  v_name := coalesce(
    nullif(v_order.customer_snapshot->>'name',''),
    nullif(v_order.customer_snapshot->>'fullName',''),
    nullif(v_order.billing_snapshot->>'contactName',''),
    'Customer'
  );
  if v_email is null then raise exception 'CUSTOMER_PAYMENT_IDENTITY_MISSING'; end if;

  v_txn := 'H' || substring(replace(v_attempt_id::text,'-','') from 1 for 22);
  insert into public.payment_attempts(
    id,order_id,attempt_number,provider,provider_merchant_txn_id,purpose,
    amount_paise,currency,status,expected_product_info,customer_email,customer_name
  ) values(
    v_attempt_id,v_order.id,v_attempt_number,'payu',v_txn,'shipping',
    p_amount_paise,'INR','created',
    left('Garmops shipping for ' || v_order.order_number,200),v_email,v_name
  );

  update public.orders
  set shipping_charge_paise = p_amount_paise,
      shipping_payment_status = 'link_created',
      shipping_payment_link_url = null,
      shipping_payment_reference = v_attempt_id::text
  where id = v_order.id;

  insert into public.audit_logs(
    actor_user_id,actor_type,action,target_type,target_id,order_id,before_state,after_state
  ) values(
    auth.uid(),'staff','shipping.payment_attempt_created','order',v_order.id,v_order.id,
    jsonb_build_object('amountPaise',v_order.shipping_charge_paise,'status',v_order.shipping_payment_status),
    jsonb_build_object('amountPaise',p_amount_paise,'status','link_created','paymentAttemptId',v_attempt_id)
  );

  return v_attempt_id;
end;
$$;

revoke all on function public.create_shipping_payment_attempt(uuid,bigint)
from public, anon, authenticated;
grant execute on function public.create_shipping_payment_attempt(uuid,bigint)
to authenticated;

create or replace function public.mark_shipping_payment_received(
  p_order_id uuid,
  p_reference text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_attempt public.payment_attempts%rowtype;
begin
  if public.current_staff_role() <> 'founder' or not public.staff_mfa_satisfied() then
    raise exception 'FOUNDER_PERMISSION_REQUIRED';
  end if;
  if nullif(btrim(p_reference),'') is null then
    raise exception 'REFERENCE_REQUIRED';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.shipping_payment_status = 'paid' then
    raise exception 'SHIPPING_ALREADY_PAID';
  end if;
  select * into v_attempt
  from public.payment_attempts
  where order_id = v_order.id and purpose = 'shipping'
  order by attempt_number desc
  limit 1
  for update;

  if found and v_attempt.status in ('initiated','pending','disputed','duplicate_success') then
    raise exception 'SHIPPING_PAYMENT_IN_PROGRESS';
  end if;
  if found and v_attempt.status = 'paid' then
    raise exception 'SHIPPING_ALREADY_PAID';
  end if;
  if found and v_attempt.status = 'created' then
    update public.payment_attempts
    set status = 'cancelled',
        failure_code = 'MANUAL_PAYMENT_RECORDED',
        failure_message = 'Founder recorded a verified shipping payment outside hosted checkout'
    where id = v_attempt.id;
  end if;

  update public.orders
  set shipping_payment_status = 'paid',
      shipping_payment_reference = btrim(p_reference),
      shipping_payment_link_url = null,
      shipping_paid_at = now()
  where id = v_order.id;

  insert into public.audit_logs(
    actor_user_id,actor_type,action,target_type,target_id,order_id,before_state,after_state
  ) values(
    auth.uid(),'staff','shipping.payment_recorded_manually','order',v_order.id,v_order.id,
    jsonb_build_object('status',v_order.shipping_payment_status,'reference',v_order.shipping_payment_reference),
    jsonb_build_object('status','paid','reference',btrim(p_reference))
  );

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Reserve discount capacity atomically for every active checkout.
-- ---------------------------------------------------------------------------

create table if not exists public.discount_reservations (
  id uuid primary key default gen_random_uuid(),
  discount_code_id uuid not null references public.discount_codes(id) on delete cascade,
  customer_user_id uuid not null references public.profiles(id) on delete cascade,
  checkout_session_id uuid not null unique references public.custom_checkout_sessions(id) on delete cascade,
  status text not null default 'active' check (status in ('active','redeemed','released')),
  expires_at timestamptz not null,
  redeemed_order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger discount_reservations_set_updated_at
before update on public.discount_reservations
for each row execute function public.set_updated_at();

create index if not exists discount_reservations_capacity_idx
on public.discount_reservations(discount_code_id, status, expires_at);
create index if not exists discount_reservations_customer_idx
on public.discount_reservations(discount_code_id, customer_user_id, status, expires_at);

alter table public.discount_reservations enable row level security;
alter table public.discount_reservations force row level security;
revoke all on table public.discount_reservations from public, anon, authenticated;
grant all on table public.discount_reservations to service_role;

create or replace function public.sync_checkout_discount_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code public.discount_codes%rowtype;
  v_used bigint;
  v_reserved bigint;
  v_customer_used bigint;
  v_customer_reserved bigint;
begin
  if new.discount_code_id is null or new.discount_paise <= 0 then
    update public.discount_reservations
    set status = 'released'
    where checkout_session_id = new.id and status = 'active';
    return new;
  end if;

  if new.status = 'finalized' then
    update public.discount_reservations
    set status = 'redeemed', redeemed_order_id = new.final_order_id
    where checkout_session_id = new.id;
    return new;
  end if;

  if new.status in ('failed','expired') then
    update public.discount_reservations
    set status = 'released'
    where checkout_session_id = new.id and status = 'active';
    return new;
  end if;

  select * into v_code
  from public.discount_codes
  where id = new.discount_code_id
  for update;

  if not found
     or not v_code.active
     or (v_code.starts_at is not null and v_code.starts_at > now())
     or (v_code.ends_at is not null and v_code.ends_at <= now())
     or new.subtotal_paise < v_code.minimum_subtotal_paise then
    raise exception 'DISCOUNT_CODE_INVALID';
  end if;

  select count(*) into v_used
  from public.discount_redemptions
  where discount_code_id = v_code.id;

  select count(*) into v_reserved
  from public.discount_reservations r
  join public.custom_checkout_sessions s on s.id = r.checkout_session_id
  where r.discount_code_id = v_code.id
    and r.status = 'active'
    and r.checkout_session_id <> new.id
    and (
      r.expires_at > now()
      or s.status in ('payment_initiated','payment_pending','payment_verified')
    );

  select count(*) into v_customer_used
  from public.discount_redemptions
  where discount_code_id = v_code.id
    and customer_user_id = new.customer_user_id;

  select count(*) into v_customer_reserved
  from public.discount_reservations r
  join public.custom_checkout_sessions s on s.id = r.checkout_session_id
  where r.discount_code_id = v_code.id
    and r.customer_user_id = new.customer_user_id
    and r.status = 'active'
    and r.checkout_session_id <> new.id
    and (
      r.expires_at > now()
      or s.status in ('payment_initiated','payment_pending','payment_verified')
    );

  if v_code.maximum_redemptions is not null
     and v_used + v_reserved >= v_code.maximum_redemptions then
    raise exception 'DISCOUNT_CODE_LIMIT_REACHED';
  end if;
  if v_customer_used + v_customer_reserved >= v_code.maximum_redemptions_per_customer then
    raise exception 'DISCOUNT_CODE_LIMIT_REACHED';
  end if;

  insert into public.discount_reservations(
    discount_code_id,customer_user_id,checkout_session_id,status,expires_at,redeemed_order_id
  ) values(
    v_code.id,new.customer_user_id,new.id,'active',new.expires_at,null
  )
  on conflict(checkout_session_id) do update set
    discount_code_id = excluded.discount_code_id,
    customer_user_id = excluded.customer_user_id,
    status = 'active',
    expires_at = excluded.expires_at,
    redeemed_order_id = null;

  return new;
end;
$$;

drop trigger if exists custom_checkout_sync_discount_reservation on public.custom_checkout_sessions;
create trigger custom_checkout_sync_discount_reservation
after insert or update of discount_code_id, discount_paise, expires_at, status
on public.custom_checkout_sessions
for each row execute function public.sync_checkout_discount_reservation();

create or replace function public.enforce_discount_redemption_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code public.discount_codes%rowtype;
  v_used bigint;
  v_customer_used bigint;
begin
  select * into v_code
  from public.discount_codes
  where id = new.discount_code_id
  for update;
  if not found then raise exception 'DISCOUNT_CODE_INVALID'; end if;

  select count(*) into v_used
  from public.discount_redemptions
  where discount_code_id = new.discount_code_id;
  select count(*) into v_customer_used
  from public.discount_redemptions
  where discount_code_id = new.discount_code_id
    and customer_user_id = new.customer_user_id;

  if v_code.maximum_redemptions is not null and v_used >= v_code.maximum_redemptions then
    raise exception 'DISCOUNT_CODE_LIMIT_REACHED';
  end if;
  if v_customer_used >= v_code.maximum_redemptions_per_customer then
    raise exception 'DISCOUNT_CODE_LIMIT_REACHED';
  end if;
  return new;
end;
$$;

drop trigger if exists discount_redemptions_enforce_limits on public.discount_redemptions;
create trigger discount_redemptions_enforce_limits
before insert on public.discount_redemptions
for each row execute function public.enforce_discount_redemption_limits();

create or replace function public.validate_discount_code(
  p_code text,p_customer_user_id uuid,p_subtotal_paise bigint
)
returns table(discount_code_id uuid, normalized_code text, discount_paise bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code public.discount_codes%rowtype;
  v_used bigint;
  v_reserved bigint;
  v_customer_used bigint;
  v_customer_reserved bigint;
  v_discount bigint;
begin
  if nullif(btrim(p_code),'') is null then return; end if;
  select * into v_code
  from public.discount_codes
  where code=upper(btrim(p_code))
    and active
    and (starts_at is null or starts_at<=now())
    and (ends_at is null or ends_at>now());
  if not found or p_subtotal_paise < v_code.minimum_subtotal_paise then
    raise exception 'DISCOUNT_CODE_INVALID';
  end if;

  select count(*) into v_used
  from public.discount_redemptions
  where discount_code_id=v_code.id;
  select count(*) into v_reserved
  from public.discount_reservations r
  join public.custom_checkout_sessions s on s.id = r.checkout_session_id
  where r.discount_code_id=v_code.id
    and r.status='active'
    and (r.expires_at>now() or s.status in ('payment_initiated','payment_pending','payment_verified'));
  select count(*) into v_customer_used
  from public.discount_redemptions
  where discount_code_id=v_code.id and customer_user_id=p_customer_user_id;
  select count(*) into v_customer_reserved
  from public.discount_reservations r
  join public.custom_checkout_sessions s on s.id = r.checkout_session_id
  where r.discount_code_id=v_code.id
    and r.customer_user_id=p_customer_user_id
    and r.status='active'
    and (r.expires_at>now() or s.status in ('payment_initiated','payment_pending','payment_verified'));

  if (v_code.maximum_redemptions is not null and v_used+v_reserved>=v_code.maximum_redemptions)
     or v_customer_used+v_customer_reserved>=v_code.maximum_redemptions_per_customer then
    raise exception 'DISCOUNT_CODE_LIMIT_REACHED';
  end if;

  v_discount := case when v_code.kind='percentage'
    then round(p_subtotal_paise * v_code.percentage_basis_points / 10000.0)::bigint
    else v_code.fixed_amount_paise
  end;
  v_discount := least(v_discount,p_subtotal_paise,coalesce(v_code.maximum_discount_paise,v_discount));
  return query select v_code.id,upper(v_code.code::text),v_discount;
end;
$$;

-- Backfill active reservations deterministically. Any already-overbooked prepared
-- checkout is failed rather than being allowed to exceed the configured limit.
do $$
declare v_session record;
begin
  for v_session in
    select id
    from public.custom_checkout_sessions
    where discount_code_id is not null
      and discount_paise > 0
      and status not in ('finalized','failed','expired')
    order by created_at, id
  loop
    begin
      update public.custom_checkout_sessions
      set expires_at = expires_at
      where id = v_session.id;
    exception when others then
      update public.custom_checkout_sessions
      set status = 'failed'
      where id = v_session.id;
    end;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Disabled customers stay disabled.
-- ---------------------------------------------------------------------------

create or replace function public.ensure_customer_account(p_terms_version text, p_privacy_version text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_meta jsonb;
  v_first text;
  v_last text;
  v_existing public.account_principals%rowtype;
begin
  if v_user_id is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  select lower(email::text), raw_user_meta_data into v_email, v_meta
  from auth.users where id = v_user_id and email_confirmed_at is not null;
  if v_email is null then raise exception 'VERIFIED_EMAIL_REQUIRED'; end if;

  select * into v_existing from public.account_principals
  where normalized_email = v_email or user_id = v_user_id
  order by created_at limit 1;

  if found then
    if v_existing.account_type <> 'customer'
       or (v_existing.user_id is not null and v_existing.user_id <> v_user_id) then
      raise exception 'ACCOUNT_TYPE_CONFLICT';
    end if;
    if not v_existing.active then
      raise exception 'ACCOUNT_DISABLED';
    end if;
  end if;

  v_first := left(coalesce(nullif(v_meta ->> 'given_name',''), nullif(split_part(coalesce(v_meta ->> 'full_name', split_part(v_email,'@',1)), ' ', 1),''), 'Customer'), 80);
  v_last := left(coalesce(nullif(v_meta ->> 'family_name',''), 'Account'), 80);

  insert into public.profiles(id, first_name, last_name, onboarding_completed_at, terms_accepted_at, terms_version, privacy_accepted_at, privacy_version)
  values(v_user_id, v_first, v_last, now(), now(), p_terms_version, now(), p_privacy_version)
  on conflict(id) do update set
    terms_accepted_at = coalesce(public.profiles.terms_accepted_at, excluded.terms_accepted_at),
    terms_version = coalesce(public.profiles.terms_version, excluded.terms_version),
    privacy_accepted_at = coalesce(public.profiles.privacy_accepted_at, excluded.privacy_accepted_at),
    privacy_version = coalesce(public.profiles.privacy_version, excluded.privacy_version);

  insert into public.account_principals(user_id, normalized_email, account_type, active, created_by)
  values(v_user_id, v_email, 'customer', true, v_user_id)
  on conflict(normalized_email) do update set user_id = excluded.user_id
  where public.account_principals.account_type = 'customer'
    and public.account_principals.active
    and (public.account_principals.user_id is null or public.account_principals.user_id = excluded.user_id);

  if not exists(
    select 1 from public.account_principals
    where user_id = v_user_id and account_type = 'customer' and active
  ) then
    raise exception 'ACCOUNT_TYPE_CONFLICT';
  end if;
  return v_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Operations receive masked payment references.
-- ---------------------------------------------------------------------------

create or replace function public.staff_payment_summaries(p_order_id uuid default null)
returns table(
  payment_attempt_id uuid,
  order_id uuid,
  order_number text,
  purpose public.payment_purpose,
  status public.payment_status,
  amount_paise bigint,
  provider_merchant_txn_id text,
  provider_payment_id text,
  created_at timestamptz,
  paid_at timestamptz,
  failure_message text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id,p.order_id,o.order_number,p.purpose,p.status,p.amount_paise,
    case when public.staff_has_permission('view_raw_payments') then p.provider_merchant_txn_id else null end,
    case when public.staff_has_permission('view_raw_payments') then p.provider_payment_id else null end,
    p.created_at,p.paid_at,
    case when p.status='failed' then coalesce(p.failure_message,'Payment failed') else null end
  from public.payment_attempts p
  join public.orders o on o.id=p.order_id
  where public.is_active_staff(true) and (p_order_id is null or p.order_id=p_order_id)
  order by p.created_at desc
$$;

-- ---------------------------------------------------------------------------
-- 6. Staff activation/deactivation is atomic and audited.
-- ---------------------------------------------------------------------------

create or replace function public.set_staff_active(p_user_id uuid,p_active boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.staff_members%rowtype;
  v_principal public.account_principals%rowtype;
  v_founder_count bigint;
begin
  if not public.staff_has_permission('manage_staff') then
    raise exception 'STAFF_PERMISSION_DENIED';
  end if;
  if p_user_id = auth.uid() and not p_active then
    raise exception 'CANNOT_DISABLE_SELF';
  end if;

  select * into v_target
  from public.staff_members
  where user_id = p_user_id
  for update;
  if not found then raise exception 'STAFF_MEMBER_NOT_FOUND'; end if;

  select * into v_principal
  from public.account_principals
  where user_id = p_user_id and account_type = 'staff'
  for update;
  if not found then raise exception 'STAFF_PRINCIPAL_NOT_FOUND'; end if;

  if not p_active and v_target.role = 'founder' then
    select count(*) into v_founder_count
    from public.staff_members s
    join public.account_principals p on p.user_id = s.user_id
    where s.role = 'founder'
      and s.active and s.deactivated_at is null
      and p.account_type = 'staff' and p.active;
    if v_founder_count <= 1 then raise exception 'LAST_FOUNDER_REQUIRED'; end if;
  end if;

  update public.staff_members
  set active = p_active,
      deactivated_at = case when p_active then null else now() end,
      activated_at = case when p_active then coalesce(activated_at,now()) else activated_at end
  where user_id = p_user_id;

  update public.account_principals
  set active = p_active
  where id = v_principal.id;

  insert into public.audit_logs(
    actor_user_id,actor_type,action,target_type,target_id,before_state,after_state
  ) values(
    auth.uid(),'staff',case when p_active then 'staff.activated' else 'staff.deactivated' end,
    'staff_member',p_user_id,
    jsonb_build_object('active',v_target.active,'principalActive',v_principal.active),
    jsonb_build_object('active',p_active,'principalActive',p_active)
  );

  return true;
end;
$$;

revoke all on function public.set_staff_active(uuid,boolean)
from public, anon, authenticated;
grant execute on function public.set_staff_active(uuid,boolean)
to authenticated;

commit;
