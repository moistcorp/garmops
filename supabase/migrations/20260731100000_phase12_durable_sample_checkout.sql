-- Phase 12: durable catalogue sample checkout.
-- Sample carts remain a temporary browser convenience; submitted orders and
-- payment attempts are authoritative PostgreSQL records.

create or replace function public.retry_order_payment(
  p_order_id uuid,
  p_customer_user_id uuid,
  p_idempotency_key text,
  p_request_hash text
)
returns table (
  order_id uuid,
  order_number text,
  payment_attempt_id uuid,
  attempt_number integer,
  payment_status public.payment_status,
  created_new boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_idempotency public.idempotency_keys%rowtype;
  v_order public.orders%rowtype;
  v_previous_attempt public.payment_attempts%rowtype;
  v_attempt_id uuid;
  v_attempt_number integer;
  v_payment_status public.payment_status;
  v_created_new boolean := false;
  v_payment_purpose text;
  v_payment_amount_paise bigint;
  v_transaction_prefix text;
  v_payment_label text;
begin
  if p_idempotency_key is null
    or p_idempotency_key <> btrim(p_idempotency_key)
    or char_length(p_idempotency_key) not between 8 and 200 then
    raise exception using errcode = '22023', message = 'invalid idempotency key';
  end if;
  if p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid request hash';
  end if;

  insert into public.idempotency_keys (scope, actor_id, key, request_hash, expires_at)
  values (
    'retry_order_payment',
    p_customer_user_id,
    p_idempotency_key,
    p_request_hash,
    now() + interval '24 hours'
  )
  on conflict (scope, actor_id, key) do nothing;

  select * into v_idempotency
  from public.idempotency_keys
  where scope = 'retry_order_payment'
    and actor_id = p_customer_user_id
    and key = p_idempotency_key
  for update;

  if v_idempotency.request_hash <> p_request_hash then
    raise exception using
      errcode = '22023',
      message = 'idempotency key request hash mismatch';
  end if;

  if v_idempotency.resource_id is not null then
    select
      attempt.order_id,
      customer_order.order_number,
      attempt.id,
      attempt.attempt_number,
      attempt.status
    into
      v_order.id,
      v_order.order_number,
      v_attempt_id,
      v_attempt_number,
      v_payment_status
    from public.payment_attempts as attempt
    join public.orders as customer_order on customer_order.id = attempt.order_id
    where attempt.id = v_idempotency.resource_id
      and attempt.order_id = p_order_id;

    if v_attempt_id is null then
      raise exception using
        errcode = 'P0001',
        message = 'idempotent payment retry response is incomplete';
    end if;

    return query
    select v_order.id, v_order.order_number, v_attempt_id,
      v_attempt_number, v_payment_status, false;
    return;
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found
    or not exists (
      select 1
      from public.organization_members as member
      where member.organization_id = v_order.organization_id
        and member.user_id = p_customer_user_id
        and member.status = 'active'
        and member.role in ('owner', 'buyer')
    ) then
    raise exception using
      errcode = '42501',
      message = 'order payment retry access denied';
  end if;

  if v_order.order_type = 'sample_purchase' then
    v_payment_purpose := 'sample_full';
    v_payment_amount_paise := v_order.estimated_total_paise;
    v_transaction_prefix := 'S';
    v_payment_label := 'sample';
  else
    v_payment_purpose := 'reservation';
    v_payment_amount_paise := v_order.reservation_amount_paise;
    v_transaction_prefix := 'G';
    v_payment_label := 'reservation';
  end if;

  if v_payment_amount_paise <= 0 then
    raise exception using
      errcode = '22023',
      message = 'order payment amount is invalid';
  end if;
  if v_order.status not in ('awaiting_payment', 'payment_failed') then
    raise exception using
      errcode = '22023',
      message = 'order is not awaiting payment';
  end if;
  if v_order.expires_at is not null and v_order.expires_at <= now() then
    raise exception using
      errcode = '22023',
      message = 'order payment window has expired';
  end if;
  if exists (
    select 1
    from public.payment_attempts as paid_attempt
    where paid_attempt.order_id = p_order_id
      and paid_attempt.purpose = v_payment_purpose
      and paid_attempt.status = 'paid'
  ) then
    raise exception using
      errcode = '22023',
      message = v_payment_label || ' payment is already complete';
  end if;

  select * into v_previous_attempt
  from public.payment_attempts as previous_attempt
  where previous_attempt.order_id = p_order_id
    and previous_attempt.purpose = v_payment_purpose
  order by previous_attempt.attempt_number desc
  limit 1
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'order has no initial payment attempt';
  end if;

  if v_previous_attempt.status in ('created', 'initiated', 'pending') then
    v_attempt_id := v_previous_attempt.id;
    v_attempt_number := v_previous_attempt.attempt_number;
    v_payment_status := v_previous_attempt.status;
  else
    v_attempt_number := v_previous_attempt.attempt_number + 1;
    if v_attempt_number > 99 then
      raise exception using
        errcode = '22023',
        message = 'maximum payment attempts reached';
    end if;

    v_attempt_id := gen_random_uuid();
    v_payment_status := 'created';
    v_created_new := true;

    insert into public.payment_attempts (
      id,
      payment_number,
      order_id,
      provider,
      provider_merchant_txn_id,
      attempt_number,
      purpose,
      amount_paise,
      currency,
      status,
      expected_product_info,
      customer_email,
      customer_name
    )
    values (
      v_attempt_id,
      format('PAY-%s-%s', v_order.order_number, lpad(v_attempt_number::text, 2, '0')),
      v_order.id,
      'payu',
      v_transaction_prefix
        || regexp_replace(v_order.order_number, '[^0-9]', '', 'g')
        || 'P'
        || lpad(v_attempt_number::text, 2, '0'),
      v_attempt_number,
      v_payment_purpose,
      v_payment_amount_paise,
      v_order.currency,
      v_payment_status,
      case
        when v_order.order_type = 'sample_purchase'
          then format('Garmops sample order %s', v_order.order_number)
        else format('Garmops order %s', v_order.order_number)
      end,
      v_previous_attempt.customer_email,
      v_previous_attempt.customer_name
    );

    if v_order.status = 'payment_failed' then
      update public.orders
      set status = 'awaiting_payment', public_status = 'payment_incomplete'
      where id = v_order.id;

      insert into public.order_status_history (
        order_id, from_status, to_status, public_status, actor_type,
        actor_user_id, customer_visible, customer_message, metadata
      )
      values (
        v_order.id,
        'payment_failed',
        'awaiting_payment',
        'payment_incomplete',
        'customer',
        p_customer_user_id,
        true,
        format('A new %s payment attempt is ready.', v_payment_label),
        jsonb_build_object(
          'payment_attempt_id', v_attempt_id,
          'purpose', v_payment_purpose
        )
      );
    end if;

    insert into public.audit_logs (
      actor_user_id, actor_type, action, target_type, target_id,
      organization_id, order_id, after_state
    )
    values (
      p_customer_user_id,
      'customer',
      'payment.retry_created',
      'payment_attempt',
      v_attempt_id,
      v_order.organization_id,
      v_order.id,
      jsonb_build_object(
        'attempt_number', v_attempt_number,
        'amount_paise', v_payment_amount_paise,
        'purpose', v_payment_purpose
      )
    );
  end if;

  update public.idempotency_keys
  set
    resource_type = 'payment_attempt',
    resource_id = v_attempt_id,
    response_status = case when v_created_new then 201 else 200 end,
    response_body = jsonb_build_object(
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'payment_attempt_id', v_attempt_id,
      'attempt_number', v_attempt_number,
      'payment_status', v_payment_status,
      'created_new', v_created_new
    )
  where id = v_idempotency.id;

  return query
  select v_order.id, v_order.order_number, v_attempt_id,
    v_attempt_number, v_payment_status, v_created_new;
end;
$$;

revoke all on function public.retry_order_payment(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.retry_order_payment(uuid, uuid, text, text)
  to service_role;

comment on function public.retry_order_payment(uuid, uuid, text, text) is
  'Returns or creates an idempotent payment retry for reservation and full sample payments without overwriting provider history.';

-- Normalize provider-facing fields for the initial full sample attempt created
-- by the generic order transaction. The retry path already writes the same copy.
create or replace function public.normalize_sample_payment_attempt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_number text;
begin
  if new.purpose <> 'sample_full' then
    return new;
  end if;

  select customer_order.order_number
  into v_order_number
  from public.orders as customer_order
  where customer_order.id = new.order_id
    and customer_order.order_type = 'sample_purchase';

  if v_order_number is null then
    raise exception using
      errcode = '22023',
      message = 'sample payment attempt requires a sample order';
  end if;

  new.expected_product_info := format('Garmops sample order %s', v_order_number);
  return new;
end;
$$;

revoke all on function public.normalize_sample_payment_attempt()
  from public, anon, authenticated;

create trigger payment_attempts_normalize_sample_fields
before insert on public.payment_attempts
for each row
when (new.purpose = 'sample_full')
execute function public.normalize_sample_payment_attempt();

comment on function public.normalize_sample_payment_attempt() is
  'Normalizes provider-facing copy for initial and retried full sample payment attempts.';

-- Phase 12 sample fulfilment transitions. Artwork/commercial approval stages
-- remain exclusive to custom/reorder orders; sample purchases move through
-- review, fulfilment, QC, packing, dispatch, and delivery.
create or replace function public.staff_transition_order(
  p_order_id uuid,
  p_to_status public.order_status,
  p_customer_message text default null,
  p_internal_note text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.staff_role;
  v_order public.orders%rowtype;
  v_public_status public.public_order_status;
  v_allowed boolean := false;
  v_role_allowed boolean := false;
  v_now timestamptz := now();
  v_customer_message text := nullif(btrim(p_customer_message), '');
  v_internal_note text := nullif(btrim(p_internal_note), '');
  v_reason text := nullif(btrim(p_reason), '');
begin
  if v_actor is null or not public.staff_has_permission('change_order_status') then
    raise exception 'STAFF_PERMISSION_DENIED';
  end if;

  if v_customer_message is not null and char_length(v_customer_message) > 1000 then
    raise exception 'CUSTOMER_MESSAGE_TOO_LONG';
  end if;
  if v_internal_note is not null and char_length(v_internal_note) > 4000 then
    raise exception 'INTERNAL_NOTE_TOO_LONG';
  end if;
  if v_reason is not null and char_length(v_reason) > 1000 then
    raise exception 'REASON_TOO_LONG';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_order.status = p_to_status then
    return jsonb_build_object(
      'orderId', v_order.id,
      'orderNumber', v_order.order_number,
      'status', v_order.status,
      'publicStatus', v_order.public_status,
      'changed', false
    );
  end if;

  v_role := public.current_staff_role();
  v_role_allowed := case
    when v_role in ('super_admin', 'operations_admin') then true
    when v_role = 'sales' then p_to_status in (
      'submitted_for_review', 'needs_customer_action', 'commercial_review',
      'quote_ready', 'awaiting_quote_approval', 'awaiting_balance_payment',
      'artwork_review', 'on_hold', 'cancelled'
    )
    when v_role = 'artwork' then p_to_status in (
      'artwork_review', 'awaiting_artwork_approval', 'needs_customer_action',
      'approved_for_production', 'on_hold'
    )
    when v_role = 'production' then p_to_status in (
      'production_queued', 'in_production', 'quality_control', 'packing', 'on_hold'
    )
    when v_role = 'qc' then p_to_status in ('quality_control', 'packing', 'in_production', 'on_hold')
    when v_role = 'dispatch' then p_to_status in ('ready_to_dispatch', 'dispatched', 'delivered', 'on_hold')
    else false
  end;

  if not v_role_allowed then
    raise exception 'STATUS_ROLE_DENIED';
  end if;

  if v_order.order_type = 'sample_purchase' then
    v_allowed := case v_order.status
      when 'awaiting_payment' then p_to_status in ('expired', 'cancelled')
      when 'payment_failed' then p_to_status in ('expired', 'cancelled')
      when 'submitted_for_review' then p_to_status in (
        'needs_customer_action', 'production_queued', 'packing', 'on_hold', 'cancelled'
      )
      when 'needs_customer_action' then p_to_status in (
        'submitted_for_review', 'production_queued', 'packing', 'on_hold', 'cancelled'
      )
      when 'production_queued' then p_to_status in ('in_production', 'packing', 'on_hold', 'cancelled')
      when 'in_production' then p_to_status in ('quality_control', 'packing', 'on_hold', 'cancelled')
      when 'quality_control' then p_to_status in ('packing', 'in_production', 'on_hold', 'cancelled')
      when 'packing' then p_to_status in ('ready_to_dispatch', 'quality_control', 'on_hold', 'cancelled')
      when 'ready_to_dispatch' then p_to_status in ('dispatched', 'packing', 'on_hold', 'cancelled')
      when 'dispatched' then p_to_status in ('delivered', 'on_hold')
      when 'on_hold' then p_to_status in (
        'submitted_for_review', 'production_queued', 'in_production',
        'quality_control', 'packing', 'ready_to_dispatch', 'cancelled'
      )
      else false
    end;
  else
    v_allowed := case v_order.status
      when 'awaiting_payment' then p_to_status in ('expired', 'cancelled')
      when 'payment_failed' then p_to_status in ('expired', 'cancelled')
      when 'reservation_paid' then p_to_status in ('submitted_for_review', 'cancelled', 'on_hold')
      when 'submitted_for_review' then p_to_status in ('needs_customer_action', 'commercial_review', 'artwork_review', 'on_hold', 'cancelled')
      when 'needs_customer_action' then p_to_status in ('submitted_for_review', 'commercial_review', 'artwork_review', 'on_hold', 'cancelled')
      when 'commercial_review' then p_to_status in ('quote_ready', 'needs_customer_action', 'artwork_review', 'on_hold', 'cancelled')
      when 'quote_ready' then p_to_status in ('awaiting_quote_approval', 'commercial_review', 'cancelled')
      when 'awaiting_quote_approval' then p_to_status in ('awaiting_balance_payment', 'artwork_review', 'needs_customer_action', 'cancelled')
      when 'awaiting_balance_payment' then p_to_status in ('artwork_review', 'approved_for_production', 'needs_customer_action', 'cancelled')
      when 'artwork_review' then p_to_status in ('awaiting_artwork_approval', 'needs_customer_action', 'on_hold', 'cancelled')
      when 'awaiting_artwork_approval' then p_to_status in ('approved_for_production', 'artwork_review', 'needs_customer_action', 'cancelled')
      when 'approved_for_production' then p_to_status in ('production_queued', 'on_hold', 'cancelled')
      when 'production_queued' then p_to_status in ('in_production', 'on_hold', 'cancelled')
      when 'in_production' then p_to_status in ('quality_control', 'on_hold', 'cancelled')
      when 'quality_control' then p_to_status in ('packing', 'in_production', 'on_hold', 'cancelled')
      when 'packing' then p_to_status in ('ready_to_dispatch', 'quality_control', 'on_hold', 'cancelled')
      when 'ready_to_dispatch' then p_to_status in ('dispatched', 'packing', 'on_hold', 'cancelled')
      when 'dispatched' then p_to_status in ('delivered', 'on_hold')
      when 'on_hold' then p_to_status in (
        'submitted_for_review', 'commercial_review', 'artwork_review',
        'production_queued', 'in_production', 'quality_control', 'packing',
        'ready_to_dispatch', 'cancelled'
      )
      else false
    end;
  end if;

  if not v_allowed then
    raise exception 'INVALID_STATUS_TRANSITION';
  end if;

  if v_order.order_type = 'sample_purchase'
    and p_to_status in ('production_queued', 'in_production', 'quality_control', 'packing', 'ready_to_dispatch', 'dispatched', 'delivered')
    and not exists (
      select 1 from public.payment_attempts as payment
      where payment.order_id = v_order.id
        and payment.purpose = 'sample_full'
        and payment.status = 'paid'
    ) then
    raise exception 'VERIFIED_SAMPLE_PAYMENT_REQUIRED';
  end if;

  if p_to_status = 'submitted_for_review' and v_order.order_type in ('custom_bulk', 'reorder') and not exists (
    select 1 from public.payment_attempts as payment
    where payment.order_id = v_order.id
      and payment.purpose = 'reservation'
      and payment.status = 'paid'
  ) then
    raise exception 'VERIFIED_PAYMENT_REQUIRED';
  end if;

  if p_to_status = 'awaiting_artwork_approval' and not exists (
    select 1 from public.approvals as approval
    where approval.order_id = v_order.id
      and approval.approval_pdf_file_id is not null
      and approval.status in ('requested', 'viewed', 'changes_requested')
  ) then
    raise exception 'APPROVAL_DOCUMENT_REQUIRED';
  end if;

  if p_to_status = 'approved_for_production' then
    if not exists (
      select 1 from public.approvals as approval
      where approval.order_id = v_order.id
        and approval.status = 'approved'
    ) then
      raise exception 'APPROVED_ARTWORK_REQUIRED';
    end if;
    if v_order.order_type in ('custom_bulk', 'reorder') and not exists (
      select 1 from public.payment_attempts as payment
      where payment.order_id = v_order.id
        and payment.purpose = 'reservation'
        and payment.status = 'paid'
    ) then
      raise exception 'VERIFIED_PAYMENT_REQUIRED';
    end if;
  end if;

  if p_to_status = 'dispatched' and not exists (
    select 1 from public.shipments as shipment
    where shipment.order_id = v_order.id
      and shipment.status <> 'cancelled'
      and (shipment.tracking_number is not null or shipment.carrier is not null)
  ) then
    raise exception 'SHIPMENT_REQUIRED';
  end if;

  if p_to_status = 'delivered' and v_order.status <> 'dispatched' then
    raise exception 'DISPATCH_REQUIRED';
  end if;

  if p_to_status = 'cancelled' and v_reason is null then
    raise exception 'CANCELLATION_REASON_REQUIRED';
  end if;

  if p_to_status = 'cancelled' and v_order.status in (
    'in_production', 'quality_control', 'packing', 'ready_to_dispatch', 'dispatched'
  ) and not public.staff_has_permission('change_high_impact_status') then
    raise exception 'HIGH_IMPACT_PERMISSION_REQUIRED';
  end if;

  v_public_status := public.order_public_status_for_internal(p_to_status);

  update public.orders
  set
    status = p_to_status,
    public_status = v_public_status,
    confirmed_at = case
      when p_to_status in ('submitted_for_review', 'commercial_review') and confirmed_at is null then v_now
      else confirmed_at
    end,
    artwork_approved_at = case
      when p_to_status = 'approved_for_production' and artwork_approved_at is null then v_now
      else artwork_approved_at
    end,
    production_started_at = case
      when p_to_status = 'in_production' and production_started_at is null then v_now
      else production_started_at
    end,
    dispatched_at = case
      when p_to_status = 'dispatched' and dispatched_at is null then v_now
      else dispatched_at
    end,
    delivered_at = case
      when p_to_status = 'delivered' and delivered_at is null then v_now
      else delivered_at
    end,
    cancelled_at = case
      when p_to_status = 'cancelled' and cancelled_at is null then v_now
      else cancelled_at
    end,
    updated_at = v_now
  where id = v_order.id;

  insert into public.order_status_history (
    order_id,
    from_status,
    to_status,
    public_status,
    actor_type,
    actor_user_id,
    customer_visible,
    customer_message,
    internal_note,
    metadata
  ) values (
    v_order.id,
    v_order.status,
    p_to_status,
    v_public_status,
    'staff',
    v_actor,
    true,
    v_customer_message,
    v_internal_note,
    jsonb_strip_nulls(jsonb_build_object('reason', v_reason, 'staffRole', v_role))
  );

  if v_customer_message is not null then
    insert into public.notifications (
      user_id, organization_id, order_id, type, title, body, action_url
    )
    select
      membership.user_id,
      v_order.organization_id,
      v_order.id,
      'order_status_update',
      'Order ' || v_order.order_number || ' updated',
      v_customer_message,
      '/account/orders/' || v_order.order_number
    from public.organization_members as membership
    where membership.organization_id = v_order.organization_id
      and membership.status = 'active';
  end if;

  insert into public.audit_logs (
    actor_user_id,
    actor_type,
    action,
    target_type,
    target_id,
    organization_id,
    order_id,
    before_state,
    after_state
  ) values (
    v_actor,
    'staff',
    'order.status_changed',
    'order',
    v_order.id,
    v_order.organization_id,
    v_order.id,
    jsonb_build_object('status', v_order.status, 'publicStatus', v_order.public_status),
    jsonb_strip_nulls(jsonb_build_object(
      'status', p_to_status,
      'publicStatus', v_public_status,
      'reason', v_reason
    ))
  );

  return jsonb_build_object(
    'orderId', v_order.id,
    'orderNumber', v_order.order_number,
    'status', p_to_status,
    'publicStatus', v_public_status,
    'changed', true
  );
end;
$$;

-- Create a durable accounting placeholder after a verified sample payment.
-- It is deliberately not queued to Zoho until finance supplies sample-specific
-- item/tax configuration and explicitly enables the adapter in a future rollout.
create or replace function public.create_sample_invoice_placeholder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  if new.status <> 'paid'
    or new.purpose <> 'sample_full'
    or old.status = 'paid' then
    return new;
  end if;

  select * into v_order
  from public.orders
  where id = new.order_id;

  if not found or v_order.order_type <> 'sample_purchase' then
    raise exception using
      errcode = '22023',
      message = 'sample invoice placeholder requires a sample order';
  end if;

  insert into public.invoices (
    order_id,
    payment_attempt_id,
    kind,
    provider,
    sync_status,
    reference_number,
    currency,
    subtotal_paise,
    tax_paise,
    total_paise,
    paid_paise,
    balance_paise,
    tax_configuration_snapshot
  )
  values (
    v_order.id,
    new.id,
    'sample_tax_invoice',
    'zoho_invoice',
    'not_required',
    format('GARMOPS-SAMPLE-%s', new.id),
    new.currency,
    v_order.subtotal_paise + v_order.shipping_paise,
    v_order.tax_estimate_paise,
    new.amount_paise,
    new.amount_paise,
    0,
    jsonb_build_object(
      'automation_enabled', false,
      'reason', 'sample tax invoice adapter requires finance configuration',
      'pricing_version', v_order.pricing_version
    )
  )
  on conflict on constraint invoices_payment_attempt_id_kind_key do nothing;

  return new;
end;
$$;

revoke all on function public.create_sample_invoice_placeholder()
  from public, anon, authenticated;

create trigger payment_attempts_create_sample_invoice_placeholder
after update of status on public.payment_attempts
for each row
when (new.status = 'paid' and old.status is distinct from new.status)
execute function public.create_sample_invoice_placeholder();

comment on function public.create_sample_invoice_placeholder() is
  'Creates a non-queued sample_tax_invoice accounting placeholder after verified full sample payment; no Zoho call is made.';

-- Extend Phase 10 operational metrics so paid samples are visible immediately.
create or replace function public.staff_dashboard_metrics()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not public.staff_has_permission('view_all_orders') then
      jsonb_build_object('denied', true)
    else jsonb_build_object(
      'newPaidReservations', (
        select count(*) from public.orders
        where order_type in ('custom_bulk', 'reorder')
          and status = 'reservation_paid'
      ),
      'newPaidSampleOrders', (
        select count(*) from public.orders
        where order_type = 'sample_purchase'
          and status = 'submitted_for_review'
          and amount_paid_paise >= estimated_total_paise
      ),
      'actionRequired', (
        select count(distinct customer_order.id)
        from public.orders as customer_order
        left join public.order_comments as comment
          on comment.order_id = customer_order.id
          and comment.action_required
          and comment.resolved_at is null
        where customer_order.status = 'needs_customer_action'
          or comment.id is not null
      ),
      'artworkOverdue', (
        select count(*) from public.orders
        where order_type in ('custom_bulk', 'reorder')
          and status in ('artwork_review', 'awaiting_artwork_approval')
          and expected_approval_at < now()
      ),
      'productionAtRisk', (
        select count(*) from public.orders
        where status in ('approved_for_production', 'production_queued', 'in_production', 'quality_control', 'packing')
          and (
            expected_production_at <= now() + interval '3 days'
            or expected_qc_at <= now() + interval '3 days'
            or estimated_dispatch_at <= now() + interval '3 days'
          )
      ),
      'readyForQcDispatch', (
        select count(*) from public.orders
        where status in ('quality_control', 'ready_to_dispatch')
      ),
      'invoiceExceptions', (
        select count(*) from public.invoices
        where sync_status in ('retryable_failure', 'permanent_failure')
      ),
      'pendingPayu', (
        select count(*) from public.payment_attempts
        where status in ('initiated', 'pending')
          and created_at < now() - interval '30 minutes'
      ),
      'unassignedPriority', (
        select count(*) from public.orders
        where assigned_staff_user_id is null
          and internal_priority in ('high', 'urgent')
          and status not in ('delivered', 'cancelled', 'refunded', 'expired')
      )
    )
  end;
$$;

revoke all on function public.staff_dashboard_metrics() from public;
grant execute on function public.staff_dashboard_metrics() to authenticated;

comment on function public.staff_dashboard_metrics() is
  'Returns MFA-protected Phase 10/12 operational counters including fully paid sample orders.';
