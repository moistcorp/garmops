-- Keep artwork malware state independent from human review while making the
-- safe disabled-scanner state usable by the artwork workflow.

begin;

create or replace function public.review_artwork_file(
  p_file_id uuid,
  p_decision public.artwork_review_status,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_file public.order_files%rowtype;
  v_order public.orders%rowtype;
  v_requirement public.order_artwork_requirements%rowtype;
begin
  if not public.staff_has_permission('review_artwork') then
    raise exception 'STAFF_PERMISSION_DENIED';
  end if;
  if p_decision not in ('approved','changes_requested','rejected') then
    raise exception 'INVALID_ARTWORK_DECISION';
  end if;

  select * into v_file
  from public.order_files
  where id = p_file_id
    and kind = 'customer_artwork'
    and deleted_at is null
    and upload_status = 'finalized'
  for update;
  if not found then raise exception 'FILE_NOT_FOUND'; end if;
  if p_decision = 'approved'
     and v_file.scan_status not in ('clean','not_required') then
    raise exception 'ARTWORK_SCAN_REQUIRED';
  end if;
  if p_decision <> 'approved' and nullif(btrim(p_reason),'') is null then
    raise exception 'REASON_REQUIRED';
  end if;

  if v_file.order_id is not null then
    select * into v_requirement
    from public.order_artwork_requirements
    where order_id = v_file.order_id and file_id = v_file.id and is_active
    for update;
    if not found then raise exception 'ARTWORK_REVISION_SUPERSEDED'; end if;

    select * into v_order from public.orders where id = v_file.order_id for update;
    if v_order.status in (
      'material_preparation','printing','stitching','quality_check',
      'packing','ready_to_dispatch','dispatched','delivered'
    ) and p_decision is distinct from v_file.review_status then
      raise exception 'ORDER_PRODUCTION_LOCKED';
    end if;
  end if;

  update public.order_files
  set review_status = p_decision,
      review_reason = nullif(btrim(p_reason),''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_file_id;

  if v_file.order_id is not null
     and p_decision in ('changes_requested','rejected')
     and v_order.status in ('artwork_approved','production_approved') then
    update public.orders
    set status = 'artwork_pending',
        public_status = 'artwork_under_review',
        artwork_approved_at = null,
        production_approved_configuration_revision = null
    where id = v_file.order_id;

    insert into public.order_status_history(
      order_id, from_status, to_status, public_status, actor_type, actor_user_id,
      customer_visible, customer_message, internal_note, reason, metadata
    ) values (
      v_file.order_id, v_order.status, 'artwork_pending', 'artwork_under_review',
      'staff', auth.uid(), true,
      'Artwork changes are required before production can continue.',
      'Production approval invalidated by artwork review.', btrim(p_reason),
      jsonb_build_object('fileId', p_file_id,
                         'requirementKey', v_requirement.requirement_key)
    );
  end if;

  insert into public.audit_logs(
    actor_user_id, actor_type, action, target_type, target_id, order_id,
    before_state, after_state
  ) values (
    auth.uid(), 'staff', 'artwork.reviewed', 'order_file', p_file_id, v_file.order_id,
    jsonb_build_object('decision', v_file.review_status,
                       'reviewedBy', v_file.reviewed_by,
                       'reviewedAt', v_file.reviewed_at,
                       'scanStatus', v_file.scan_status),
    jsonb_build_object('decision', p_decision, 'reason', p_reason,
                       'scanStatus', v_file.scan_status,
                       'requirementKey', v_requirement.requirement_key)
  );
  return true;
end;
$$;

create or replace function public.staff_transition_order(
  p_order_id uuid,p_to_status public.order_status,p_customer_message text default null,
  p_internal_note text default null,p_reason text default null
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_public public.public_order_status;
begin
  if not public.staff_has_permission('change_order_status') then raise exception 'STAFF_PERMISSION_DENIED'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if p_to_status='cancelled' then raise exception 'CANCELLATION_REQUEST_REQUIRED'; end if;
  if p_to_status in ('refund_pending','refunded') then raise exception 'REFUND_ACTION_REQUIRED'; end if;
  if not public.is_order_transition_allowed(v_order.status,p_to_status) then raise exception 'INVALID_STATUS_TRANSITION'; end if;
  if p_to_status='on_hold' and nullif(btrim(p_reason),'') is null then raise exception 'REASON_REQUIRED'; end if;
  if p_to_status in ('artwork_approved','production_approved') then
    if p_to_status='production_approved' and v_order.amount_paid_paise<>v_order.total_paise then
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
        on r.order_id = oi.order_id
       and r.requirement_key = expected.requirement_key
       and r.is_active
      left join public.order_files f on f.id = r.file_id
      where oi.order_id = v_order.id
        and nullif(btrim(expected.file_id_text),'') is not null
        and (
          r.id is null or f.id is null
          or lower(f.id::text) <> lower(expected.file_id_text)
          or f.order_id is distinct from v_order.id
          or f.deleted_at is not null or f.upload_status <> 'finalized'
          or f.review_status <> 'approved'
          or f.scan_status not in ('clean','not_required')
        )
    ) then raise exception 'ARTWORK_APPROVAL_REQUIRED'; end if;

    if exists(
      select 1
      from public.order_artwork_requirements r
      left join public.order_files f on f.id = r.file_id
      where r.order_id = v_order.id and r.is_active
        and (
          f.id is null or f.order_id is distinct from v_order.id
          or f.deleted_at is not null or f.upload_status <> 'finalized'
          or f.review_status <> 'approved'
          or f.scan_status not in ('clean','not_required')
        )
    ) then raise exception 'ARTWORK_APPROVAL_REQUIRED'; end if;
  end if;
  v_public:=public.order_public_status_for_internal(p_to_status);
  update public.orders set status=p_to_status,public_status=v_public,
    artwork_approved_at=case when p_to_status='artwork_approved' then now() else artwork_approved_at end,
    production_approved_configuration_revision=case when p_to_status='production_approved' then configuration_revision else production_approved_configuration_revision end,
    production_started_at=case when p_to_status='material_preparation' then now() else production_started_at end,
    dispatched_at=case when p_to_status='dispatched' then now() else dispatched_at end,
    delivered_at=case when p_to_status='delivered' then now() else delivered_at end,
    configuration_reopened_at=case when p_to_status='production_approved' then null else configuration_reopened_at end,
    configuration_reopened_by=case when p_to_status='production_approved' then null else configuration_reopened_by end,
    configuration_reopen_reason=case when p_to_status='production_approved' then null else configuration_reopen_reason end,
    configuration_reopen_previous_status=case when p_to_status='production_approved' then null else configuration_reopen_previous_status end
  where id=p_order_id;
  insert into public.order_status_history(order_id,from_status,to_status,public_status,actor_type,actor_user_id,customer_visible,customer_message,internal_note,reason)
  values(v_order.id,v_order.status,p_to_status,v_public,'staff',auth.uid(),true,coalesce(nullif(btrim(p_customer_message),''),'Order status updated.'),nullif(btrim(p_internal_note),''),nullif(btrim(p_reason),''));
  insert into public.audit_logs(actor_user_id,actor_type,action,target_type,target_id,order_id,before_state,after_state,metadata)
  values(auth.uid(),'staff','order.status_changed','order',v_order.id,v_order.id,jsonb_build_object('status',v_order.status),jsonb_build_object('status',p_to_status),jsonb_build_object('reason',p_reason,'configurationRevision',v_order.configuration_revision));
  return true;
end;
$$;

commit;
