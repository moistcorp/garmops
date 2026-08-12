begin;

-- Paid-order configuration is immutable after checkout. Historical revision rows
-- remain available for audit, but there is no longer a public mutation RPC.
drop function if exists public.update_order_configuration(uuid, jsonb, text);
drop function if exists public.update_order_configuration_validated(uuid, jsonb, text);
drop function if exists public.reopen_order_configuration(uuid, text);

-- Staff accounts are provisioned out of band. Keep the staff directory and its
-- access controls, but remove the retired invitation record and its RLS surface.
drop table if exists public.staff_invitations;

alter table public.orders
  add column if not exists hold_from_status public.order_status;
alter table public.cancellation_requests
  add column if not exists requested_from_status public.order_status;

create or replace function public.staff_has_permission(p_permission text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_role public.staff_role := public.current_staff_role();
begin
  if v_role is null or not public.staff_mfa_satisfied() then return false; end if;
  return case p_permission
    when 'view_all_orders' then true
    when 'change_order_status' then true
    when 'review_artwork' then true
    when 'manage_staff' then v_role = 'founder'
    when 'manage_discounts' then v_role = 'founder'
    when 'manage_refunds' then v_role = 'founder'
    when 'view_raw_payments' then v_role = 'founder'
    else false
  end;
end;
$$;

create or replace function public.is_order_transition_allowed(p_from public.order_status, p_to public.order_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_from
    when 'payment_confirmed' then p_to in ('order_review', 'on_hold', 'cancelled')
    when 'order_review' then p_to in ('artwork_pending', 'artwork_approved', 'on_hold', 'cancelled')
    when 'artwork_pending' then p_to in ('artwork_approved', 'on_hold', 'cancelled')
    when 'artwork_approved' then p_to in ('production_approved', 'on_hold', 'cancelled')
    when 'production_approved' then p_to in ('material_preparation', 'on_hold', 'cancelled')
    when 'material_preparation' then p_to in ('printing', 'on_hold', 'cancelled')
    when 'printing' then p_to in ('stitching', 'on_hold', 'cancelled')
    when 'stitching' then p_to in ('quality_check', 'on_hold', 'cancelled')
    when 'quality_check' then p_to in ('packing', 'printing', 'on_hold', 'cancelled')
    when 'packing' then p_to in ('ready_to_dispatch', 'quality_check', 'on_hold', 'cancelled')
    when 'ready_to_dispatch' then p_to in ('dispatched', 'packing', 'on_hold', 'cancelled')
    when 'dispatched' then p_to in ('delivered', 'on_hold')
    when 'on_hold' then false
    when 'cancelled' then p_to = 'refund_pending'
    when 'refund_pending' then p_to = 'refunded'
    else false
  end
$$;

create or replace function public.request_order_cancellation(p_order_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_id uuid;
begin
  if not public.staff_has_permission('change_order_status') then
    raise exception 'STAFF_PERMISSION_DENIED';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'REASON_REQUIRED';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if exists(select 1 from public.cancellation_requests where order_id = p_order_id and status = 'pending') then
    raise exception 'CANCELLATION_ALREADY_PENDING';
  end if;
  if v_order.status in ('on_hold', 'delivered', 'cancelled', 'refund_pending', 'refunded') then
    raise exception 'CANCELLATION_NOT_AVAILABLE';
  end if;

  update public.orders
  set status = 'on_hold',
      public_status = 'action_required',
      hold_from_status = v_order.status
  where id = v_order.id;

  insert into public.cancellation_requests(order_id, requested_by, reason, requested_from_status)
  values (v_order.id, auth.uid(), btrim(p_reason), v_order.status)
  returning id into v_id;

  insert into public.order_status_history(
    order_id, from_status, to_status, public_status, actor_type, actor_user_id,
    customer_visible, customer_message, internal_note, reason
  ) values (
    v_order.id, v_order.status, 'on_hold', 'action_required', 'staff', auth.uid(), true,
    'Your order is temporarily on hold while a cancellation request is reviewed.',
    null, btrim(p_reason)
  );
  insert into public.audit_logs(
    actor_user_id, actor_type, action, target_type, target_id, order_id,
    before_state, after_state, metadata
  ) values (
    auth.uid(), 'staff', 'order.cancellation_requested', 'cancellation_request', v_id, v_order.id,
    jsonb_build_object('status', v_order.status),
    jsonb_build_object('status', 'pending', 'requestedFromStatus', v_order.status),
    jsonb_build_object('reason', btrim(p_reason))
  );
  return v_id;
end;
$$;

create or replace function public.decide_order_cancellation(p_request_id uuid, p_approve boolean, p_note text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.cancellation_requests%rowtype;
  v_order public.orders%rowtype;
  v_public public.public_order_status;
begin
  if public.current_staff_role() <> 'founder' or not public.staff_mfa_satisfied() then
    raise exception 'FOUNDER_PERMISSION_REQUIRED';
  end if;

  select * into v_request
  from public.cancellation_requests
  where id = p_request_id and status = 'pending'
  for update;
  if not found then raise exception 'CANCELLATION_REQUEST_NOT_FOUND'; end if;

  select * into v_order from public.orders where id = v_request.order_id for update;
  if not found
     or v_order.status <> 'on_hold'
     or v_order.hold_from_status is distinct from v_request.requested_from_status
     or v_request.requested_from_status is null
     or v_request.requested_from_status in ('delivered', 'cancelled', 'refund_pending', 'refunded') then
    raise exception 'STALE_CANCELLATION_REQUEST';
  end if;

  update public.cancellation_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      decided_by = auth.uid(), decided_at = now()
  where id = v_request.id;

  if p_approve then
    update public.orders
    set status = 'cancelled', public_status = 'cancelled', cancelled_at = now(), hold_from_status = null
    where id = v_order.id;
    insert into public.order_status_history(
      order_id, from_status, to_status, public_status, actor_type, actor_user_id,
      customer_visible, customer_message, internal_note, reason
    ) values (
      v_order.id, v_order.status, 'cancelled', 'cancelled', 'staff', auth.uid(), true,
      'Your order has been cancelled.', nullif(btrim(p_note), ''), v_request.reason
    );
  else
    v_public := public.order_public_status_for_internal(v_request.requested_from_status);
    update public.orders
    set status = v_request.requested_from_status, public_status = v_public, hold_from_status = null
    where id = v_order.id;
    insert into public.order_status_history(
      order_id, from_status, to_status, public_status, actor_type, actor_user_id,
      customer_visible, customer_message, internal_note, reason
    ) values (
      v_order.id, v_order.status, v_request.requested_from_status, v_public, 'staff', auth.uid(), true,
      'The cancellation request was rejected and order processing has resumed.',
      nullif(btrim(p_note), ''), v_request.reason
    );
  end if;

  insert into public.audit_logs(
    actor_user_id, actor_type, action, target_type, target_id, order_id,
    before_state, after_state, metadata
  ) values (
    auth.uid(), 'staff', 'order.cancellation_decided', 'cancellation_request', v_request.id, v_order.id,
    jsonb_build_object('status', 'pending', 'orderStatus', v_order.status),
    jsonb_build_object('status', case when p_approve then 'approved' else 'rejected' end,
                       'orderStatus', case when p_approve then 'cancelled' else v_request.requested_from_status end),
    jsonb_build_object('reason', v_request.reason, 'note', p_note)
  );
  return true;
end;
$$;

create or replace function public.staff_transition_order(
  p_order_id uuid, p_to_status public.order_status, p_customer_message text default null,
  p_internal_note text default null, p_reason text default null
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_public public.public_order_status;
begin
  if not public.staff_has_permission('change_order_status') then raise exception 'STAFF_PERMISSION_DENIED'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  if exists(select 1 from public.cancellation_requests where order_id = v_order.id and status = 'pending') then
    raise exception 'CANCELLATION_PENDING';
  end if;
  if p_to_status = 'cancelled' then raise exception 'CANCELLATION_REQUEST_REQUIRED'; end if;
  if p_to_status in ('refund_pending', 'refunded') then raise exception 'REFUND_ACTION_REQUIRED'; end if;

  if v_order.status = 'on_hold' then
    if v_order.hold_from_status is null or p_to_status <> v_order.hold_from_status then
      raise exception 'INVALID_HOLD_RESUME';
    end if;
  elsif not public.is_order_transition_allowed(v_order.status, p_to_status) then
    raise exception 'INVALID_STATUS_TRANSITION';
  end if;
  if p_to_status = 'on_hold' and nullif(btrim(p_reason), '') is null then raise exception 'REASON_REQUIRED'; end if;

  if p_to_status in ('artwork_approved', 'production_approved') then
    if p_to_status = 'production_approved' and v_order.amount_paid_paise <> v_order.total_paise then
      raise exception 'VERIFIED_PAYMENT_REQUIRED';
    end if;
    if exists(
      select 1
      from public.order_items oi
      cross join lateral (
        values
          ('item:' || oi.id::text || ':front', oi.artwork_snapshot #>> '{front,fileId}'),
          ('item:' || oi.id::text || ':back', oi.artwork_snapshot #>> '{back,fileId}'),
          ('item:' || oi.id::text || ':neck_label', oi.neck_label_snapshot ->> 'fileId')
      ) as expected(requirement_key, file_id_text)
      left join public.order_artwork_requirements r
        on r.order_id = oi.order_id and r.requirement_key = expected.requirement_key and r.is_active
      left join public.order_files f on f.id = r.file_id
      where oi.order_id = v_order.id and nullif(btrim(expected.file_id_text), '') is not null
        and (r.id is null or f.id is null or lower(f.id::text) <> lower(expected.file_id_text)
          or f.order_id is distinct from v_order.id or f.deleted_at is not null
          or f.upload_status <> 'finalized' or f.review_status <> 'approved'
          or f.scan_status not in ('clean', 'not_required'))
    ) then raise exception 'ARTWORK_APPROVAL_REQUIRED'; end if;
    if exists(
      select 1
      from public.order_artwork_requirements r
      left join public.order_files f on f.id = r.file_id
      where r.order_id = v_order.id and r.is_active
        and (f.id is null or f.order_id is distinct from v_order.id or f.deleted_at is not null
          or f.upload_status <> 'finalized' or f.review_status <> 'approved'
          or f.scan_status not in ('clean', 'not_required'))
    ) then raise exception 'ARTWORK_APPROVAL_REQUIRED'; end if;
  end if;

  v_public := public.order_public_status_for_internal(p_to_status);
  update public.orders set
    status = p_to_status,
    public_status = v_public,
    hold_from_status = case
      when p_to_status = 'on_hold' then v_order.status
      when v_order.status = 'on_hold' then null
      else hold_from_status
    end,
    artwork_approved_at = case when p_to_status = 'artwork_approved' then now() else artwork_approved_at end,
    production_approved_configuration_revision = case when p_to_status = 'production_approved' then configuration_revision else production_approved_configuration_revision end,
    production_started_at = case when p_to_status = 'material_preparation' then now() else production_started_at end,
    dispatched_at = case when p_to_status = 'dispatched' then now() else dispatched_at end,
    delivered_at = case when p_to_status = 'delivered' then now() else delivered_at end,
    configuration_reopened_at = case when p_to_status = 'production_approved' then null else configuration_reopened_at end,
    configuration_reopened_by = case when p_to_status = 'production_approved' then null else configuration_reopened_by end,
    configuration_reopen_reason = case when p_to_status = 'production_approved' then null else configuration_reopen_reason end,
    configuration_reopen_previous_status = case when p_to_status = 'production_approved' then null else configuration_reopen_previous_status end
  where id = p_order_id;

  insert into public.order_status_history(
    order_id, from_status, to_status, public_status, actor_type, actor_user_id,
    customer_visible, customer_message, internal_note, reason
  ) values (
    v_order.id, v_order.status, p_to_status, v_public, 'staff', auth.uid(), true,
    coalesce(nullif(btrim(p_customer_message), ''), 'Order status updated.'),
    nullif(btrim(p_internal_note), ''), nullif(btrim(p_reason), '')
  );
  insert into public.audit_logs(
    actor_user_id, actor_type, action, target_type, target_id, order_id,
    before_state, after_state, metadata
  ) values (
    auth.uid(), 'staff', 'order.status_changed', 'order', v_order.id, v_order.id,
    jsonb_build_object('status', v_order.status), jsonb_build_object('status', p_to_status),
    jsonb_build_object('reason', p_reason, 'configurationRevision', v_order.configuration_revision)
  );
  return true;
end;
$$;

notify pgrst, 'reload schema';
commit;
