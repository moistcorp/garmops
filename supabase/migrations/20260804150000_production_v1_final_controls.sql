-- Final production controls: payment privacy, immutable commercial fields,
-- controlled post-dispatch edits, and explicit refund evidence.
begin;

-- Moving a design file onto a paid order must preserve the exact-one-target rule.
-- The preceding migration defines the finalizer; replace the affected statement
-- in-place for fresh installs and keep this defensive cleanup for partial staging runs.
update public.order_files
set design_project_id = null
where order_id is not null and design_project_id is not null;

-- Never expose raw provider payload columns through direct PostgREST reads.
revoke select on public.payment_attempts from authenticated;
drop policy if exists payment_customer_founder_select on public.payment_attempts;

create or replace function public.customer_payment_summaries(p_order_id uuid)
returns table(
  payment_attempt_id uuid,
  purpose public.payment_purpose,
  status public.payment_status,
  amount_paise bigint,
  paid_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id,p.purpose,p.status,p.amount_paise,p.paid_at,p.created_at
  from public.payment_attempts p
  join public.orders o on o.id=p.order_id
  where p.order_id=p_order_id and o.customer_user_id=auth.uid()
  order by p.created_at desc
$$;

drop function if exists public.staff_payment_summaries(uuid);
create function public.staff_payment_summaries(p_order_id uuid default null)
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
    p.provider_merchant_txn_id,p.provider_payment_id,p.created_at,p.paid_at,
    case when p.status='failed' then coalesce(p.failure_message,'Payment failed') else null end
  from public.payment_attempts p
  join public.orders o on o.id=p.order_id
  where public.is_active_staff(true) and (p_order_id is null or p.order_id=p_order_id)
  order by p.created_at desc
$$;

-- Founder must explicitly reopen a dispatched/delivered configuration. The
-- authorization is consumed by the next successful revision and then relocks.
alter table public.orders
  add column if not exists configuration_reopened_at timestamptz,
  add column if not exists configuration_reopened_by uuid references public.staff_members(user_id),
  add column if not exists configuration_reopen_reason text,
  add column if not exists refund_reference text,
  add column if not exists refund_requested_at timestamptz,
  add column if not exists refunded_at timestamptz;

create or replace function public.reopen_order_configuration(p_order_id uuid,p_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_order public.orders%rowtype;
begin
  if public.current_staff_role()<>'founder' or not public.staff_mfa_satisfied() then raise exception 'FOUNDER_PERMISSION_REQUIRED'; end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'REASON_REQUIRED'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status not in ('dispatched','delivered') then raise exception 'REOPEN_NOT_REQUIRED'; end if;
  update public.orders set configuration_reopened_at=now(),configuration_reopened_by=auth.uid(),configuration_reopen_reason=btrim(p_reason) where id=p_order_id;
  insert into public.audit_logs(actor_user_id,actor_type,action,target_type,target_id,order_id,after_state,metadata)
  values(auth.uid(),'staff','order.configuration_reopened','order',p_order_id,p_order_id,jsonb_build_object('reopened',true),jsonb_build_object('reason',btrim(p_reason)));
  return true;
end;
$$;

create or replace function public.update_order_configuration(p_order_id uuid,p_next_snapshot jsonb,p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
  v_revision integer;
  v_paths text[] := array[]::text[];
  v_current_design jsonb;
  v_next_design jsonb;
  v_current_product text;
  v_next_product text;
  v_current_quantity integer;
  v_next_quantity integer;
  v_current_front text;
  v_next_front text;
  v_current_back text;
  v_next_back text;
begin
  if not public.staff_has_permission('edit_order_configuration') then raise exception 'STAFF_PERMISSION_DENIED'; end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'REASON_REQUIRED'; end if;
  if p_next_snapshot is null or jsonb_typeof(p_next_snapshot)<>'object' then raise exception 'INVALID_CONFIGURATION'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status in ('cancelled','refund_pending','refunded') then raise exception 'ORDER_CONFIGURATION_LOCKED'; end if;
  if v_order.status in ('dispatched','delivered') and v_order.configuration_reopened_at is null then raise exception 'ORDER_CONFIGURATION_LOCKED'; end if;

  select * into v_item from public.order_items where order_id=p_order_id and line_number=1;
  if not found then raise exception 'ORDER_ITEM_NOT_FOUND'; end if;

  v_current_design := coalesce(v_order.configuration_snapshot->'design',v_order.configuration_snapshot);
  v_next_design := coalesce(p_next_snapshot->'design',p_next_snapshot);
  v_current_product := coalesce(v_current_design->>'configId',v_item.product_id);
  v_next_product := coalesce(v_next_design->>'configId','');
  if v_next_product<>v_current_product then raise exception 'GARMENT_TYPE_IMMUTABLE'; end if;

  v_current_quantity := v_item.quantity;
  select coalesce(sum(value::integer),0) into v_next_quantity
  from jsonb_each_text(coalesce(p_next_snapshot->'sizeQuantities','{}'::jsonb));
  if v_next_quantity=0 then v_next_quantity:=coalesce((v_next_design#>>'{configuration,quantity}')::integer,0); end if;
  if v_next_quantity<>v_current_quantity then raise exception 'ORDER_QUANTITY_IMMUTABLE'; end if;

  v_current_front := coalesce(v_current_design#>>'{configuration,artwork,front,technique}','');
  v_next_front := coalesce(v_next_design#>>'{configuration,artwork,front,technique}','');
  v_current_back := coalesce(v_current_design#>>'{configuration,artwork,back,technique}','');
  v_next_back := coalesce(v_next_design#>>'{configuration,artwork,back,technique}','');
  if v_current_front<>v_next_front or v_current_back<>v_next_back then raise exception 'PRINTING_TECHNIQUE_IMMUTABLE'; end if;

  if p_next_snapshot=v_order.configuration_snapshot then return v_order.configuration_revision; end if;
  v_revision:=v_order.configuration_revision+1;
  v_paths:=array['configuration'];
  insert into public.order_configuration_revisions(order_id,revision_number,previous_snapshot,next_snapshot,changed_by,reason,changed_paths)
  values(p_order_id,v_revision,v_order.configuration_snapshot,p_next_snapshot,auth.uid(),btrim(p_reason),v_paths);
  update public.orders set
    configuration_snapshot=p_next_snapshot,configuration_revision=v_revision,
    configuration_reopened_at=null,configuration_reopened_by=null,configuration_reopen_reason=null
  where id=p_order_id;
  update public.order_items set
    colour_snapshot=coalesce(v_next_design#>'{configuration,colour}',colour_snapshot),
    artwork_snapshot=coalesce(v_next_design#>'{configuration,artwork}',artwork_snapshot),
    neck_label_snapshot=coalesce(v_next_design#>'{configuration,neckLabel}',neck_label_snapshot)
  where order_id=p_order_id and line_number=1;
  insert into public.audit_logs(actor_user_id,actor_type,action,target_type,target_id,order_id,before_state,after_state,metadata)
  values(auth.uid(),'staff','order.configuration_revised','order',p_order_id,p_order_id,v_order.configuration_snapshot,p_next_snapshot,jsonb_build_object('revision',v_revision,'reason',btrim(p_reason)));
  return v_revision;
end;
$$;

-- Refunds are explicit Founder actions, not generic status changes.
create or replace function public.record_order_refund(p_order_id uuid,p_complete boolean,p_reference text,p_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_order public.orders%rowtype; v_target public.order_status;
begin
  if public.current_staff_role()<>'founder' or not public.staff_mfa_satisfied() then raise exception 'FOUNDER_PERMISSION_REQUIRED'; end if;
  if nullif(btrim(p_reference),'') is null then raise exception 'REFERENCE_REQUIRED'; end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'REASON_REQUIRED'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if p_complete then
    if v_order.status<>'refund_pending' then raise exception 'REFUND_NOT_PENDING'; end if;
    v_target:='refunded';
    update public.orders set status=v_target,public_status='cancelled',refund_reference=btrim(p_reference),refunded_at=now() where id=p_order_id;
  else
    if v_order.status<>'cancelled' then raise exception 'ORDER_NOT_CANCELLED'; end if;
    v_target:='refund_pending';
    update public.orders set status=v_target,public_status='cancelled',refund_reference=btrim(p_reference),refund_requested_at=now() where id=p_order_id;
  end if;
  insert into public.order_status_history(order_id,from_status,to_status,public_status,actor_type,actor_user_id,customer_visible,customer_message,internal_note,reason,metadata)
  values(p_order_id,v_order.status,v_target,'cancelled','staff',auth.uid(),true,
    case when p_complete then 'Your refund has been completed.' else 'Your refund is being processed.' end,
    null,btrim(p_reason),jsonb_build_object('refundReference',btrim(p_reference)));
  insert into public.audit_logs(actor_user_id,actor_type,action,target_type,target_id,order_id,before_state,after_state,metadata)
  values(auth.uid(),'staff',case when p_complete then 'order.refund_completed' else 'order.refund_initiated' end,'order',p_order_id,p_order_id,jsonb_build_object('status',v_order.status),jsonb_build_object('status',v_target),jsonb_build_object('reference',btrim(p_reference),'reason',btrim(p_reason)));
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
    if exists(select 1 from public.order_files where (order_id=v_order.id or design_project_id=v_order.design_project_id) and kind='customer_artwork' and deleted_at is null and review_status<>'approved') then raise exception 'ARTWORK_APPROVAL_REQUIRED'; end if;
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

revoke all on function public.customer_payment_summaries(uuid),public.staff_payment_summaries(uuid),public.reopen_order_configuration(uuid,text),public.record_order_refund(uuid,boolean,text,text) from public,anon,authenticated;
grant execute on function public.customer_payment_summaries(uuid),public.staff_payment_summaries(uuid),public.reopen_order_configuration(uuid,text),public.record_order_refund(uuid,boolean,text,text) to authenticated;

commit;
