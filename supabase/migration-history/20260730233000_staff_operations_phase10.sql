-- Garmops Phase 10: MFA-authorised staff operations workflow.
-- All staff mutations remain behind security-definer functions so browser clients
-- cannot update operational order fields directly.

alter table public.orders
  add column if not exists assigned_team text,
  add column if not exists expected_approval_at timestamptz,
  add column if not exists expected_production_at timestamptz,
  add column if not exists expected_qc_at timestamptz;

alter table public.orders
  add constraint orders_assigned_team_format_check
    check (
      assigned_team is null
      or (
        assigned_team = btrim(assigned_team)
        and char_length(assigned_team) between 1 and 80
      )
    ),
  add constraint orders_expected_dates_after_submission_check
    check (
      (expected_approval_at is null or expected_approval_at >= submitted_at)
      and (expected_production_at is null or expected_production_at >= submitted_at)
      and (expected_qc_at is null or expected_qc_at >= submitted_at)
      and (estimated_dispatch_at is null or estimated_dispatch_at >= submitted_at)
    ) not valid,
  add constraint orders_expected_date_sequence_check
    check (
      (expected_approval_at is null or expected_production_at is null or expected_approval_at <= expected_production_at)
      and (expected_production_at is null or expected_qc_at is null or expected_production_at <= expected_qc_at)
      and (expected_qc_at is null or estimated_dispatch_at is null or expected_qc_at <= estimated_dispatch_at)
    ) not valid;

-- Validate immediately when existing rows already comply. A production database
-- with historical inconsistent dates remains online and is surfaced for manual repair.
do $phase10_constraints$
begin
  if not exists (
    select 1 from public.orders
    where (expected_approval_at is not null and expected_approval_at < submitted_at)
       or (expected_production_at is not null and expected_production_at < submitted_at)
       or (expected_qc_at is not null and expected_qc_at < submitted_at)
       or (estimated_dispatch_at is not null and estimated_dispatch_at < submitted_at)
  ) then
    alter table public.orders validate constraint orders_expected_dates_after_submission_check;
  end if;

  if not exists (
    select 1 from public.orders
    where (expected_approval_at is not null and expected_production_at is not null and expected_approval_at > expected_production_at)
       or (expected_production_at is not null and expected_qc_at is not null and expected_production_at > expected_qc_at)
       or (expected_qc_at is not null and estimated_dispatch_at is not null and expected_qc_at > estimated_dispatch_at)
  ) then
    alter table public.orders validate constraint orders_expected_date_sequence_check;
  end if;
end;
$phase10_constraints$;

create index if not exists orders_staff_team_queue_idx
  on public.orders (assigned_team, status, internal_priority, updated_at desc);

create index if not exists orders_expected_approval_idx
  on public.orders (expected_approval_at)
  where expected_approval_at is not null;

create index if not exists orders_expected_production_idx
  on public.orders (expected_production_at)
  where expected_production_at is not null;

create index if not exists orders_expected_qc_idx
  on public.orders (expected_qc_at)
  where expected_qc_at is not null;

create index if not exists order_comments_open_actions_idx
  on public.order_comments (order_id, created_at desc)
  where action_required and resolved_at is null;

-- Extend the central role matrix. Existing permission names retain their Phase 3
-- behaviour; Phase 10 names fail closed for roles that do not need them.
create or replace function public.staff_has_permission(p_permission_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.staff_role;
  v_aal text;
begin
  v_role := public.current_staff_role();
  v_aal := coalesce(auth.jwt() ->> 'aal', '');

  if v_role is null or v_aal <> 'aal2' then
    return false;
  end if;

  return case p_permission_name
    when 'view_profiles' then true
    when 'view_organizations' then true
    when 'view_all_orders' then true
    when 'view_internal_notes' then true
    when 'add_internal_note' then v_role <> 'read_only'
    when 'send_customer_update' then v_role <> 'read_only'
    when 'manage_action_requests' then v_role <> 'read_only'
    when 'assign_order' then
      v_role in ('super_admin', 'operations_admin', 'sales')
    when 'set_order_priority' then
      v_role in ('super_admin', 'operations_admin', 'sales')
    when 'set_expected_dates' then
      v_role in ('super_admin', 'operations_admin', 'production', 'artwork', 'qc', 'dispatch')
    when 'change_order_status' then
      v_role in ('super_admin', 'operations_admin', 'sales', 'production', 'artwork', 'qc', 'dispatch')
    when 'change_high_impact_status' then
      v_role in ('super_admin', 'operations_admin')
    when 'change_file_visibility' then
      v_role in ('super_admin', 'operations_admin', 'artwork', 'finance', 'qc', 'dispatch')
    when 'edit_commercial' then
      v_role in ('super_admin', 'operations_admin', 'sales', 'finance')
    when 'change_production_status' then
      v_role in (
        'super_admin',
        'operations_admin',
        'production',
        'artwork',
        'qc',
        'dispatch'
      )
    when 'upload_artwork_proof' then
      v_role in ('super_admin', 'operations_admin', 'artwork')
    when 'view_payment_payload' then
      v_role in ('super_admin', 'operations_admin', 'finance')
    when 'retry_invoice_job' then
      v_role in ('super_admin', 'finance')
    when 'refund_workflow' then
      v_role in ('super_admin', 'finance')
    when 'upload_qc_evidence' then
      v_role in ('super_admin', 'operations_admin', 'production', 'qc')
    when 'manage_approvals' then
      v_role in ('super_admin', 'operations_admin', 'artwork')
    when 'manage_shipments' then
      v_role in ('super_admin', 'operations_admin', 'dispatch')
    when 'view_jobs' then
      v_role in ('super_admin', 'operations_admin', 'finance')
    when 'view_audit' then
      v_role in ('super_admin', 'operations_admin')
    when 'manage_staff' then
      v_role = 'super_admin'
    else false
  end;
end;
$$;

create or replace function public.order_public_status_for_internal(
  p_status public.order_status
)
returns public.public_order_status
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'awaiting_payment' then 'payment_incomplete'::public.public_order_status
    when 'payment_failed' then 'payment_incomplete'::public.public_order_status
    when 'reservation_paid' then 'order_submitted'::public.public_order_status
    when 'submitted_for_review' then 'order_submitted'::public.public_order_status
    when 'needs_customer_action' then 'action_required'::public.public_order_status
    when 'commercial_review' then 'under_review'::public.public_order_status
    when 'artwork_review' then 'under_review'::public.public_order_status
    when 'quote_ready' then 'awaiting_approval'::public.public_order_status
    when 'awaiting_quote_approval' then 'awaiting_approval'::public.public_order_status
    when 'awaiting_artwork_approval' then 'awaiting_approval'::public.public_order_status
    when 'awaiting_balance_payment' then 'payment_due'::public.public_order_status
    when 'approved_for_production' then 'approved'::public.public_order_status
    when 'production_queued' then 'approved'::public.public_order_status
    when 'in_production' then 'in_production'::public.public_order_status
    when 'quality_control' then 'quality_check'::public.public_order_status
    when 'packing' then 'quality_check'::public.public_order_status
    when 'ready_to_dispatch' then 'ready_to_dispatch'::public.public_order_status
    when 'dispatched' then 'dispatched'::public.public_order_status
    when 'delivered' then 'delivered'::public.public_order_status
    when 'on_hold' then 'on_hold'::public.public_order_status
    when 'cancelled' then 'cancelled'::public.public_order_status
    when 'refunded' then 'cancelled'::public.public_order_status
    when 'expired' then 'payment_incomplete'::public.public_order_status
  end;
$$;

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

  if not v_allowed then
    raise exception 'INVALID_STATUS_TRANSITION';
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

create or replace function public.staff_assign_order(
  p_order_id uuid,
  p_assigned_staff_user_id uuid default null,
  p_assigned_team text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_order public.orders%rowtype;
  v_assignee public.staff_members%rowtype;
  v_team text := nullif(btrim(p_assigned_team), '');
  v_reason text := nullif(btrim(p_reason), '');
begin
  if v_actor is null or not public.staff_has_permission('assign_order') then
    raise exception 'STAFF_PERMISSION_DENIED';
  end if;
  if v_team is not null and char_length(v_team) > 80 then
    raise exception 'TEAM_TOO_LONG';
  end if;
  if v_reason is not null and char_length(v_reason) > 1000 then
    raise exception 'REASON_TOO_LONG';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  if p_assigned_staff_user_id is not null then
    select * into v_assignee
    from public.staff_members
    where user_id = p_assigned_staff_user_id
      and active
      and deactivated_at is null;
    if not found then raise exception 'ASSIGNEE_NOT_ACTIVE'; end if;
    if v_team is null then v_team := v_assignee.team; end if;
  end if;

  if v_order.internal_priority in ('high', 'urgent')
    and v_order.assigned_staff_user_id is not null
    and v_order.assigned_staff_user_id is distinct from p_assigned_staff_user_id
    and v_reason is null then
    raise exception 'REASSIGNMENT_REASON_REQUIRED';
  end if;

  update public.orders
  set assigned_staff_user_id = p_assigned_staff_user_id,
      assigned_team = v_team,
      updated_at = now()
  where id = v_order.id;

  insert into public.audit_logs (
    actor_user_id, actor_type, action, target_type, target_id,
    organization_id, order_id, before_state, after_state
  ) values (
    v_actor, 'staff', 'order.assignment_changed', 'order', v_order.id,
    v_order.organization_id, v_order.id,
    jsonb_build_object(
      'assignedStaffUserId', v_order.assigned_staff_user_id,
      'assignedTeam', v_order.assigned_team
    ),
    jsonb_strip_nulls(jsonb_build_object(
      'assignedStaffUserId', p_assigned_staff_user_id,
      'assignedTeam', v_team,
      'reason', v_reason
    ))
  );

  return jsonb_build_object(
    'orderId', v_order.id,
    'assignedStaffUserId', p_assigned_staff_user_id,
    'assignedTeam', v_team
  );
end;
$$;

create or replace function public.staff_set_order_priority(
  p_order_id uuid,
  p_priority text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_order public.orders%rowtype;
  v_priority text := lower(btrim(p_priority));
  v_reason text := nullif(btrim(p_reason), '');
begin
  if v_actor is null or not public.staff_has_permission('set_order_priority') then
    raise exception 'STAFF_PERMISSION_DENIED';
  end if;
  if v_priority not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'INVALID_PRIORITY';
  end if;
  if v_reason is not null and char_length(v_reason) > 1000 then
    raise exception 'REASON_TOO_LONG';
  end if;
  if v_priority in ('high', 'urgent') and v_reason is null then
    raise exception 'PRIORITY_REASON_REQUIRED';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  update public.orders
  set internal_priority = v_priority, updated_at = now()
  where id = v_order.id;

  insert into public.audit_logs (
    actor_user_id, actor_type, action, target_type, target_id,
    organization_id, order_id, before_state, after_state
  ) values (
    v_actor, 'staff', 'order.priority_changed', 'order', v_order.id,
    v_order.organization_id, v_order.id,
    jsonb_build_object('priority', v_order.internal_priority),
    jsonb_strip_nulls(jsonb_build_object('priority', v_priority, 'reason', v_reason))
  );

  return jsonb_build_object('orderId', v_order.id, 'priority', v_priority);
end;
$$;

create or replace function public.staff_set_order_dates(
  p_order_id uuid,
  p_expected_approval_at timestamptz default null,
  p_expected_production_at timestamptz default null,
  p_expected_qc_at timestamptz default null,
  p_estimated_dispatch_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_order public.orders%rowtype;
begin
  if v_actor is null or not public.staff_has_permission('set_expected_dates') then
    raise exception 'STAFF_PERMISSION_DENIED';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  if (p_expected_approval_at is not null and p_expected_approval_at < v_order.submitted_at)
    or (p_expected_production_at is not null and p_expected_production_at < v_order.submitted_at)
    or (p_expected_qc_at is not null and p_expected_qc_at < v_order.submitted_at)
    or (p_estimated_dispatch_at is not null and p_estimated_dispatch_at < v_order.submitted_at) then
    raise exception 'EXPECTED_DATE_BEFORE_ORDER';
  end if;

  if (p_expected_approval_at is not null and p_expected_production_at is not null and p_expected_approval_at > p_expected_production_at)
    or (p_expected_production_at is not null and p_expected_qc_at is not null and p_expected_production_at > p_expected_qc_at)
    or (p_expected_qc_at is not null and p_estimated_dispatch_at is not null and p_expected_qc_at > p_estimated_dispatch_at) then
    raise exception 'EXPECTED_DATE_SEQUENCE_INVALID';
  end if;

  update public.orders
  set expected_approval_at = p_expected_approval_at,
      expected_production_at = p_expected_production_at,
      expected_qc_at = p_expected_qc_at,
      estimated_dispatch_at = p_estimated_dispatch_at,
      updated_at = now()
  where id = v_order.id;

  insert into public.audit_logs (
    actor_user_id, actor_type, action, target_type, target_id,
    organization_id, order_id, before_state, after_state
  ) values (
    v_actor, 'staff', 'order.expected_dates_changed', 'order', v_order.id,
    v_order.organization_id, v_order.id,
    jsonb_build_object(
      'expectedApprovalAt', v_order.expected_approval_at,
      'expectedProductionAt', v_order.expected_production_at,
      'expectedQcAt', v_order.expected_qc_at,
      'estimatedDispatchAt', v_order.estimated_dispatch_at
    ),
    jsonb_build_object(
      'expectedApprovalAt', p_expected_approval_at,
      'expectedProductionAt', p_expected_production_at,
      'expectedQcAt', p_expected_qc_at,
      'estimatedDispatchAt', p_estimated_dispatch_at
    )
  );

  return jsonb_build_object('orderId', v_order.id, 'updated', true);
end;
$$;

create or replace function public.staff_add_order_comment(
  p_order_id uuid,
  p_visibility text,
  p_body text,
  p_action_required boolean default false,
  p_action_type text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_order public.orders%rowtype;
  v_comment_id uuid;
  v_visibility text := lower(btrim(p_visibility));
  v_body text := btrim(p_body);
  v_action_type text := nullif(btrim(p_action_type), '');
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_visibility not in ('customer', 'staff_only') then raise exception 'INVALID_VISIBILITY'; end if;
  if v_visibility = 'customer' and not public.staff_has_permission('send_customer_update') then
    raise exception 'STAFF_PERMISSION_DENIED';
  end if;
  if v_visibility = 'staff_only' and not public.staff_has_permission('add_internal_note') then
    raise exception 'STAFF_PERMISSION_DENIED';
  end if;
  if p_action_required and not public.staff_has_permission('manage_action_requests') then
    raise exception 'STAFF_PERMISSION_DENIED';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 10000 then
    raise exception 'INVALID_COMMENT_LENGTH';
  end if;
  if p_action_required and v_visibility <> 'customer' then
    raise exception 'ACTION_REQUEST_MUST_BE_CUSTOMER_VISIBLE';
  end if;
  if v_action_type is not null and char_length(v_action_type) > 80 then
    raise exception 'ACTION_TYPE_TOO_LONG';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  insert into public.order_comments (
    order_id, author_user_id, visibility, body, action_required, action_type
  ) values (
    v_order.id, v_actor, v_visibility, v_body, p_action_required, v_action_type
  ) returning id into v_comment_id;

  if v_visibility = 'customer' then
    insert into public.notifications (
      user_id, organization_id, order_id, type, title, body, action_url
    )
    select
      membership.user_id,
      v_order.organization_id,
      v_order.id,
      case when p_action_required then 'order_action_required' else 'order_customer_update' end,
      case when p_action_required
        then 'Action required for ' || v_order.order_number
        else 'Update for ' || v_order.order_number
      end,
      v_body,
      '/account/orders/' || v_order.order_number
    from public.organization_members as membership
    where membership.organization_id = v_order.organization_id
      and membership.status = 'active';
  end if;

  insert into public.audit_logs (
    actor_user_id, actor_type, action, target_type, target_id,
    organization_id, order_id, after_state
  ) values (
    v_actor, 'staff',
    case when p_action_required then 'order.action_requested' else 'order.comment_added' end,
    'order_comment', v_comment_id,
    v_order.organization_id, v_order.id,
    jsonb_build_object(
      'visibility', v_visibility,
      'actionRequired', p_action_required,
      'actionType', v_action_type
    )
  );

  return v_comment_id;
end;
$$;

create or replace function public.staff_resolve_order_action(
  p_comment_id uuid,
  p_resolution_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_comment public.order_comments%rowtype;
  v_order public.orders%rowtype;
  v_note text := nullif(btrim(p_resolution_note), '');
begin
  if v_actor is null or not public.staff_has_permission('manage_action_requests') then
    raise exception 'STAFF_PERMISSION_DENIED';
  end if;

  select * into v_comment
  from public.order_comments
  where id = p_comment_id
  for update;

  if not found or not v_comment.action_required then
    raise exception 'ACTION_REQUEST_NOT_FOUND';
  end if;
  if v_comment.resolved_at is not null then return true; end if;
  if v_note is not null and char_length(v_note) > 4000 then raise exception 'NOTE_TOO_LONG'; end if;

  select * into v_order from public.orders where id = v_comment.order_id;

  update public.order_comments
  set resolved_at = now(), resolved_by = v_actor, updated_at = now()
  where id = v_comment.id;

  if v_note is not null then
    insert into public.order_comments (
      order_id, author_user_id, visibility, body, action_required
    ) values (
      v_comment.order_id, v_actor, 'staff_only', v_note, false
    );
  end if;

  insert into public.audit_logs (
    actor_user_id, actor_type, action, target_type, target_id,
    organization_id, order_id, after_state
  ) values (
    v_actor, 'staff', 'order.action_resolved', 'order_comment', v_comment.id,
    v_order.organization_id, v_order.id,
    jsonb_strip_nulls(jsonb_build_object('resolutionNote', v_note))
  );

  return true;
end;
$$;

create or replace function public.staff_change_order_file_visibility(
  p_file_id uuid,
  p_visibility public.file_visibility,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_file public.order_files%rowtype;
  v_order public.orders%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
begin
  if v_actor is null or not public.staff_has_permission('change_file_visibility') then
    raise exception 'STAFF_PERMISSION_DENIED';
  end if;
  if p_visibility not in ('customer', 'staff_only') then
    raise exception 'PRIVATE_ORDER_FILE_CANNOT_BE_PUBLIC';
  end if;
  if v_reason is null or char_length(v_reason) > 1000 then
    raise exception 'VISIBILITY_REASON_REQUIRED';
  end if;

  select * into v_file from public.order_files where id = p_file_id for update;
  if not found or v_file.order_id is null or v_file.deleted_at is not null then
    raise exception 'FILE_NOT_FOUND';
  end if;
  if v_file.scan_status not in ('clean', 'not_required') and p_visibility = 'customer' then
    raise exception 'FILE_NOT_CLEARED_FOR_CUSTOMER';
  end if;

  select * into v_order from public.orders where id = v_file.order_id;

  update public.order_files
  set visibility = p_visibility
  where id = v_file.id;

  insert into public.audit_logs (
    actor_user_id, actor_type, action, target_type, target_id,
    organization_id, order_id, before_state, after_state
  ) values (
    v_actor, 'staff', 'order_file.visibility_changed', 'order_file', v_file.id,
    v_order.organization_id, v_order.id,
    jsonb_build_object('visibility', v_file.visibility),
    jsonb_build_object('visibility', p_visibility, 'reason', v_reason)
  );

  return true;
end;
$$;

create or replace function public.staff_search_orders(
  p_query text default null,
  p_status public.order_status default null,
  p_public_status public.public_order_status default null,
  p_order_type public.order_type default null,
  p_priority text default null,
  p_payment_state text default null,
  p_invoice_state text default null,
  p_assignee uuid default null,
  p_team text default null,
  p_missing text default null,
  p_shipment_state text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_overdue boolean default false,
  p_at_risk boolean default false,
  p_my_orders boolean default false,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  order_id uuid,
  order_number text,
  order_type public.order_type,
  status public.order_status,
  public_status public.public_order_status,
  internal_priority text,
  assigned_staff_user_id uuid,
  assigned_team text,
  assignee_name text,
  submitted_at timestamptz,
  updated_at timestamptz,
  requested_delivery_date date,
  expected_approval_at timestamptz,
  expected_production_at timestamptz,
  expected_qc_at timestamptz,
  estimated_dispatch_at timestamptz,
  organization_id uuid,
  organization_name text,
  customer_name text,
  customer_email text,
  po_number text,
  quantity_total bigint,
  payment_status public.payment_status,
  invoice_status public.invoice_sync_status,
  shipment_status text,
  open_action_count bigint,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with queue as (
    select
      customer_order.id as order_id,
      customer_order.order_number,
      customer_order.order_type,
      customer_order.status,
      customer_order.public_status,
      customer_order.internal_priority,
      customer_order.assigned_staff_user_id,
      customer_order.assigned_team,
      nullif(btrim(concat_ws(' ', assignee_profile.first_name, assignee_profile.last_name)), '') as assignee_name,
      customer_order.submitted_at,
      customer_order.updated_at,
      customer_order.requested_delivery_date,
      customer_order.expected_approval_at,
      customer_order.expected_production_at,
      customer_order.expected_qc_at,
      customer_order.estimated_dispatch_at,
      customer_order.organization_id,
      coalesce(
        nullif(customer_order.company_snapshot ->> 'displayName', ''),
        nullif(customer_order.company_snapshot ->> 'submittedName', ''),
        organization.display_name
      ) as organization_name,
      coalesce(customer_order.customer_snapshot ->> 'name', 'Customer') as customer_name,
      coalesce(
        customer_order.customer_snapshot ->> 'email',
        customer_order.customer_snapshot ->> 'accountEmail'
      ) as customer_email,
      customer_order.po_number,
      coalesce(item_totals.quantity_total, 0)::bigint as quantity_total,
      latest_payment.status as payment_status,
      latest_invoice.sync_status as invoice_status,
      latest_shipment.status as shipment_status,
      coalesce(action_totals.open_action_count, 0)::bigint as open_action_count
    from public.orders as customer_order
    join public.organizations as organization
      on organization.id = customer_order.organization_id
    left join public.staff_members as assignee
      on assignee.user_id = customer_order.assigned_staff_user_id
    left join public.profiles as assignee_profile
      on assignee_profile.id = assignee.user_id
    left join lateral (
      select sum(item.quantity)::bigint as quantity_total
      from public.order_items as item
      where item.order_id = customer_order.id
    ) as item_totals on true
    left join lateral (
      select payment.status
      from public.payment_attempts as payment
      where payment.order_id = customer_order.id
      order by payment.attempt_number desc, payment.created_at desc
      limit 1
    ) as latest_payment on true
    left join lateral (
      select invoice.sync_status
      from public.invoices as invoice
      where invoice.order_id = customer_order.id
      order by invoice.created_at desc
      limit 1
    ) as latest_invoice on true
    left join lateral (
      select shipment.status
      from public.shipments as shipment
      where shipment.order_id = customer_order.id
      order by shipment.shipment_number desc, shipment.created_at desc
      limit 1
    ) as latest_shipment on true
    left join lateral (
      select count(*)::bigint as open_action_count
      from public.order_comments as comment
      where comment.order_id = customer_order.id
        and comment.action_required
        and comment.resolved_at is null
    ) as action_totals on true
    where public.staff_has_permission('view_all_orders')
      and (
        nullif(btrim(p_query), '') is null
        or customer_order.order_number ilike '%' || btrim(p_query) || '%'
        or organization.display_name ilike '%' || btrim(p_query) || '%'
        or coalesce(customer_order.customer_snapshot ->> 'email', '') ilike '%' || btrim(p_query) || '%'
        or coalesce(customer_order.customer_snapshot ->> 'accountEmail', '') ilike '%' || btrim(p_query) || '%'
        or coalesce(customer_order.po_number, '') ilike '%' || btrim(p_query) || '%'
        or exists (
          select 1 from public.payment_attempts as payment_search
          where payment_search.order_id = customer_order.id
            and (
              payment_search.provider_merchant_txn_id ilike '%' || btrim(p_query) || '%'
              or coalesce(payment_search.provider_payment_id, '') ilike '%' || btrim(p_query) || '%'
            )
        )
        or exists (
          select 1 from public.invoices as invoice_search
          where invoice_search.order_id = customer_order.id
            and coalesce(invoice_search.document_number, '') ilike '%' || btrim(p_query) || '%'
        )
        or exists (
          select 1 from public.shipments as shipment_search
          where shipment_search.order_id = customer_order.id
            and coalesce(shipment_search.tracking_number, '') ilike '%' || btrim(p_query) || '%'
        )
      )
      and (p_status is null or customer_order.status = p_status)
      and (p_public_status is null or customer_order.public_status = p_public_status)
      and (p_order_type is null or customer_order.order_type = p_order_type)
      and (nullif(btrim(p_priority), '') is null or customer_order.internal_priority = lower(btrim(p_priority)))
      and (p_assignee is null or customer_order.assigned_staff_user_id = p_assignee)
      and (nullif(btrim(p_team), '') is null or customer_order.assigned_team = btrim(p_team))
      and (not p_my_orders or customer_order.assigned_staff_user_id = auth.uid())
      and (nullif(btrim(p_payment_state), '') is null or latest_payment.status::text = lower(btrim(p_payment_state)))
      and (nullif(btrim(p_invoice_state), '') is null or latest_invoice.sync_status::text = lower(btrim(p_invoice_state)))
      and (nullif(btrim(p_shipment_state), '') is null or latest_shipment.status = lower(btrim(p_shipment_state)))
      and (p_date_from is null or timezone('Asia/Kolkata', customer_order.submitted_at)::date >= p_date_from)
      and (p_date_to is null or timezone('Asia/Kolkata', customer_order.submitted_at)::date <= p_date_to)
      and (
        nullif(btrim(p_missing), '') is null
        or (lower(btrim(p_missing)) = 'po' and customer_order.po_number is null and not exists (
          select 1 from public.order_files as po_file
          where po_file.order_id = customer_order.id
            and po_file.kind = 'purchase_order'
            and po_file.deleted_at is null
        ))
        or (lower(btrim(p_missing)) = 'gstin' and coalesce(
          customer_order.company_snapshot ->> 'submittedGstin',
          customer_order.company_snapshot ->> 'gstin',
          ''
        ) = '')
        or (lower(btrim(p_missing)) = 'artwork' and not exists (
          select 1 from public.order_files as artwork_file
          where artwork_file.order_id = customer_order.id
            and artwork_file.kind in ('customer_artwork', 'proof', 'approval_pdf')
            and artwork_file.deleted_at is null
        ))
        or (lower(btrim(p_missing)) = 'approval' and not exists (
          select 1 from public.approvals as approval_search
          where approval_search.order_id = customer_order.id
            and approval_search.status = 'approved'
        ))
      )
      and (
        not p_overdue
        or (
          customer_order.status not in ('delivered', 'cancelled', 'refunded', 'expired')
          and (
            customer_order.requested_delivery_date < timezone('Asia/Kolkata', now())::date
            or customer_order.expected_approval_at < now()
            or customer_order.expected_production_at < now()
            or customer_order.expected_qc_at < now()
            or customer_order.estimated_dispatch_at < now()
          )
        )
      )
      and (
        not p_at_risk
        or (
          customer_order.status not in ('delivered', 'cancelled', 'refunded', 'expired')
          and (
            customer_order.requested_delivery_date <= timezone('Asia/Kolkata', now())::date + 7
            or customer_order.expected_approval_at <= now() + interval '3 days'
            or customer_order.expected_production_at <= now() + interval '3 days'
            or customer_order.expected_qc_at <= now() + interval '3 days'
            or customer_order.estimated_dispatch_at <= now() + interval '3 days'
          )
        )
      )
  )
  select queue.*, count(*) over()::bigint as total_count
  from queue
  order by
    case queue.internal_priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,
    queue.updated_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

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
        select count(*) from public.orders where status = 'reservation_paid'
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
        where status in ('artwork_review', 'awaiting_artwork_approval')
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

revoke all on function public.order_public_status_for_internal(public.order_status) from public;
revoke all on function public.staff_transition_order(uuid, public.order_status, text, text, text) from public;
revoke all on function public.staff_assign_order(uuid, uuid, text, text) from public;
revoke all on function public.staff_set_order_priority(uuid, text, text) from public;
revoke all on function public.staff_set_order_dates(uuid, timestamptz, timestamptz, timestamptz, timestamptz) from public;
revoke all on function public.staff_add_order_comment(uuid, text, text, boolean, text) from public;
revoke all on function public.staff_resolve_order_action(uuid, text) from public;
revoke all on function public.staff_change_order_file_visibility(uuid, public.file_visibility, text) from public;
revoke all on function public.staff_search_orders(text, public.order_status, public.public_order_status, public.order_type, text, text, text, uuid, text, text, text, date, date, boolean, boolean, boolean, integer, integer) from public;
revoke all on function public.staff_dashboard_metrics() from public;

grant execute on function public.order_public_status_for_internal(public.order_status) to authenticated, service_role;
grant execute on function public.staff_transition_order(uuid, public.order_status, text, text, text) to authenticated;
grant execute on function public.staff_assign_order(uuid, uuid, text, text) to authenticated;
grant execute on function public.staff_set_order_priority(uuid, text, text) to authenticated;
grant execute on function public.staff_set_order_dates(uuid, timestamptz, timestamptz, timestamptz, timestamptz) to authenticated;
grant execute on function public.staff_add_order_comment(uuid, text, text, boolean, text) to authenticated;
grant execute on function public.staff_resolve_order_action(uuid, text) to authenticated;
grant execute on function public.staff_change_order_file_visibility(uuid, public.file_visibility, text) to authenticated;
grant execute on function public.staff_search_orders(text, public.order_status, public.public_order_status, public.order_type, text, text, text, uuid, text, text, text, date, date, boolean, boolean, boolean, integer, integer) to authenticated;
grant execute on function public.staff_dashboard_metrics() to authenticated;

comment on function public.staff_transition_order(uuid, public.order_status, text, text, text) is
  'MFA-authorised, role-aware and audited order-state transition service.';
comment on function public.staff_search_orders(text, public.order_status, public.public_order_status, public.order_type, text, text, text, uuid, text, text, text, date, date, boolean, boolean, boolean, integer, integer) is
  'Bounded staff work-queue search across order, customer, payment, invoice and shipment references.';

create or replace function public.staff_safe_payment_summary(p_order_id uuid)
returns table (
  status public.payment_status,
  amount_paise bigint,
  paid_at timestamptz,
  attempt_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    latest.status,
    latest.amount_paise,
    latest.paid_at,
    totals.attempt_count
  from lateral (
    select payment.status, payment.amount_paise, payment.paid_at
    from public.payment_attempts as payment
    where payment.order_id = p_order_id
    order by payment.attempt_number desc, payment.created_at desc
    limit 1
  ) as latest
  cross join lateral (
    select count(*)::bigint as attempt_count
    from public.payment_attempts as payment_count
    where payment_count.order_id = p_order_id
  ) as totals
  where public.staff_has_permission('view_all_orders')
    and exists (select 1 from public.orders where id = p_order_id);
$$;

create or replace function public.staff_list_assignable_members()
returns table (
  user_id uuid,
  role public.staff_role,
  team text,
  display_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    staff.user_id,
    staff.role,
    staff.team,
    coalesce(
      nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
      staff.user_id::text
    ) as display_name
  from public.staff_members as staff
  join public.profiles as profile on profile.id = staff.user_id
  where public.staff_has_permission('view_all_orders')
    and staff.active
    and staff.deactivated_at is null
  order by profile.first_name, profile.last_name;
$$;

revoke all on function public.staff_safe_payment_summary(uuid) from public;
revoke all on function public.staff_list_assignable_members() from public;
grant execute on function public.staff_safe_payment_summary(uuid) to authenticated;
grant execute on function public.staff_list_assignable_members() to authenticated;
