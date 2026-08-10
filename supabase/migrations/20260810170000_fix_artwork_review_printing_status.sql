-- Repair the artwork-review status reference and scanner-role guard introduced
-- by the previous hardening migration. Keep this as a forward migration because
-- deployed migration history is immutable.

begin;

-- auth.role() can retain the preceding request claim in pooled/test sessions.
-- The PostgreSQL role is the authoritative signal for service-role scanner
-- writes and cannot be selected by authenticated clients.
create or replace function public.protect_artwork_scan_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'customer_artwork'
     and new.scan_status is distinct from old.scan_status
     and coalesce(current_setting('role', true), '') <> 'service_role' then
    new.scan_status := old.scan_status;
  end if;
  return new;
end;
$$;

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

commit;
