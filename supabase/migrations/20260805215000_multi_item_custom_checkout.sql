-- Multi-item custom checkout keeps each configuration in its own immutable
-- design project. The existing finalizer historically linked files only from
-- the order-level (first) design project. Attach every validated file listed in
-- the trusted checkout payload after the session is finalized.

create or replace function public.attach_custom_checkout_files_to_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'finalized'
     and new.final_order_id is not null
     and (old.status is distinct from new.status or old.final_order_id is distinct from new.final_order_id)
  then
    update public.order_files
    set order_id = new.final_order_id,
        design_project_id = null
    where id = any(
      array(
        select jsonb_array_elements_text(
          coalesce(new.rpc_payload->'fileIds', '[]'::jsonb)
        )::uuid
      )
    )
      and uploaded_by = new.customer_user_id
      and deleted_at is null;
  end if;

  return new;
end;
$$;

revoke all on function public.attach_custom_checkout_files_to_order() from public;

drop trigger if exists attach_custom_checkout_files_to_order_after_finalize
  on public.custom_checkout_sessions;

create trigger attach_custom_checkout_files_to_order_after_finalize
after update of status, final_order_id
on public.custom_checkout_sessions
for each row
execute function public.attach_custom_checkout_files_to_order();

-- The original staff configuration revision function updated only line 1.
-- Make immutable-field checks and permitted snapshot updates line-aware for
-- multi-item custom orders, while retaining backward compatibility for older
-- single-design orders and sample orders.
create or replace function public.update_order_configuration(
  p_order_id uuid,
  p_next_snapshot jsonb,
  p_reason text
)
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
  v_current_line jsonb;
  v_next_line jsonb;
  v_current_design jsonb;
  v_next_design jsonb;
  v_current_product text;
  v_next_product text;
  v_next_quantity integer;
  v_current_front text;
  v_next_front text;
  v_current_back text;
  v_next_back text;
  v_is_multi boolean;
begin
  if not public.staff_has_permission('edit_order_configuration') then
    raise exception 'STAFF_PERMISSION_DENIED';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'REASON_REQUIRED';
  end if;
  if p_next_snapshot is null or jsonb_typeof(p_next_snapshot) <> 'object' then
    raise exception 'INVALID_CONFIGURATION';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status in ('cancelled', 'refund_pending', 'refunded') then
    raise exception 'ORDER_CONFIGURATION_LOCKED';
  end if;
  if v_order.status in ('dispatched', 'delivered')
     and v_order.configuration_reopened_at is null then
    raise exception 'ORDER_CONFIGURATION_LOCKED';
  end if;

  v_is_multi := jsonb_typeof(v_order.configuration_snapshot -> 'items') = 'array';

  if v_is_multi then
    if jsonb_typeof(p_next_snapshot -> 'items') <> 'array' then
      raise exception 'ORDER_LINE_STRUCTURE_IMMUTABLE';
    end if;
    if jsonb_array_length(p_next_snapshot -> 'items') <>
       (select count(*) from public.order_items where order_id = p_order_id) then
      raise exception 'ORDER_LINE_STRUCTURE_IMMUTABLE';
    end if;

    for v_item in
      select *
      from public.order_items
      where order_id = p_order_id
      order by line_number
    loop
      select line.value into v_current_line
      from jsonb_array_elements(v_order.configuration_snapshot -> 'items') as line(value)
      where nullif(line.value ->> 'lineNumber', '')::integer = v_item.line_number
      limit 1;

      select line.value into v_next_line
      from jsonb_array_elements(p_next_snapshot -> 'items') as line(value)
      where nullif(line.value ->> 'lineNumber', '')::integer = v_item.line_number
      limit 1;

      if v_current_line is null or v_next_line is null then
        raise exception 'ORDER_LINE_STRUCTURE_IMMUTABLE';
      end if;
      if (v_current_line ->> 'cartItemId') is distinct from (v_next_line ->> 'cartItemId')
         or (v_current_line ->> 'designProjectId') is distinct from (v_next_line ->> 'designProjectId')
         or (v_current_line ->> 'designVersionId') is distinct from (v_next_line ->> 'designVersionId')
         or (v_current_line ->> 'designVersion') is distinct from (v_next_line ->> 'designVersion') then
        raise exception 'ORDER_LINE_IDENTITY_IMMUTABLE';
      end if;

      v_current_design := v_current_line -> 'design';
      v_next_design := v_next_line -> 'design';
      if jsonb_typeof(v_current_design) <> 'object'
         or jsonb_typeof(v_next_design) <> 'object' then
        raise exception 'INVALID_CONFIGURATION';
      end if;

      v_current_product := coalesce(v_current_design ->> 'configId', v_item.product_id);
      v_next_product := coalesce(v_next_design ->> 'configId', '');
      if v_next_product <> v_current_product then
        raise exception 'GARMENT_TYPE_IMMUTABLE';
      end if;

      select coalesce(sum(value::integer), 0) into v_next_quantity
      from jsonb_each_text(coalesce(v_next_line -> 'sizeQuantities', '{}'::jsonb));
      if v_next_quantity = 0 then
        v_next_quantity := coalesce(
          (v_next_design #>> '{configuration,quantity}')::integer,
          0
        );
      end if;
      if v_next_quantity <> v_item.quantity then
        raise exception 'ORDER_QUANTITY_IMMUTABLE';
      end if;

      v_current_front := coalesce(v_current_design #>> '{configuration,artwork,front,technique}', '');
      v_next_front := coalesce(v_next_design #>> '{configuration,artwork,front,technique}', '');
      v_current_back := coalesce(v_current_design #>> '{configuration,artwork,back,technique}', '');
      v_next_back := coalesce(v_next_design #>> '{configuration,artwork,back,technique}', '');
      if v_current_front <> v_next_front or v_current_back <> v_next_back then
        raise exception 'PRINTING_TECHNIQUE_IMMUTABLE';
      end if;
    end loop;
  else
    select * into v_item
    from public.order_items
    where order_id = p_order_id and line_number = 1;
    if not found then raise exception 'ORDER_ITEM_NOT_FOUND'; end if;

    v_current_design := coalesce(v_order.configuration_snapshot -> 'design', v_order.configuration_snapshot);
    v_next_design := coalesce(p_next_snapshot -> 'design', p_next_snapshot);
    v_current_product := coalesce(v_current_design ->> 'configId', v_item.product_id);
    v_next_product := coalesce(v_next_design ->> 'configId', '');
    if v_next_product <> v_current_product then raise exception 'GARMENT_TYPE_IMMUTABLE'; end if;

    select coalesce(sum(value::integer), 0) into v_next_quantity
    from jsonb_each_text(coalesce(p_next_snapshot -> 'sizeQuantities', '{}'::jsonb));
    if v_next_quantity = 0 then
      v_next_quantity := coalesce((v_next_design #>> '{configuration,quantity}')::integer, 0);
    end if;
    if v_next_quantity <> v_item.quantity then raise exception 'ORDER_QUANTITY_IMMUTABLE'; end if;

    v_current_front := coalesce(v_current_design #>> '{configuration,artwork,front,technique}', '');
    v_next_front := coalesce(v_next_design #>> '{configuration,artwork,front,technique}', '');
    v_current_back := coalesce(v_current_design #>> '{configuration,artwork,back,technique}', '');
    v_next_back := coalesce(v_next_design #>> '{configuration,artwork,back,technique}', '');
    if v_current_front <> v_next_front or v_current_back <> v_next_back then
      raise exception 'PRINTING_TECHNIQUE_IMMUTABLE';
    end if;
  end if;

  if p_next_snapshot = v_order.configuration_snapshot then
    return v_order.configuration_revision;
  end if;

  v_revision := v_order.configuration_revision + 1;
  v_paths := array['configuration'];

  insert into public.order_configuration_revisions(
    order_id,
    revision_number,
    previous_snapshot,
    next_snapshot,
    changed_by,
    reason,
    changed_paths
  ) values (
    p_order_id,
    v_revision,
    v_order.configuration_snapshot,
    p_next_snapshot,
    auth.uid(),
    btrim(p_reason),
    v_paths
  );

  update public.orders
  set configuration_snapshot = p_next_snapshot,
      configuration_revision = v_revision,
      configuration_reopened_at = null,
      configuration_reopened_by = null,
      configuration_reopen_reason = null
  where id = p_order_id;

  if v_is_multi then
    for v_item in
      select *
      from public.order_items
      where order_id = p_order_id
      order by line_number
    loop
      select line.value into v_next_line
      from jsonb_array_elements(p_next_snapshot -> 'items') as line(value)
      where nullif(line.value ->> 'lineNumber', '')::integer = v_item.line_number
      limit 1;
      v_next_design := v_next_line -> 'design';

      update public.order_items
      set colour_snapshot = coalesce(
            v_next_design #> '{configuration,colour}',
            colour_snapshot
          ),
          decoration_snapshot = jsonb_build_object(
            'frontTechnique', nullif(v_next_design #>> '{configuration,artwork,front,technique}', ''),
            'backTechnique', nullif(v_next_design #>> '{configuration,artwork,back,technique}', '')
          ),
          artwork_snapshot = coalesce(
            v_next_design #> '{configuration,artwork}',
            artwork_snapshot
          ),
          neck_label_snapshot = case
            when (v_next_design #> '{configuration}') ? 'neckLabel'
              then v_next_design #> '{configuration,neckLabel}'
            else neck_label_snapshot
          end
      where id = v_item.id;
    end loop;
  else
    update public.order_items
    set colour_snapshot = coalesce(v_next_design #> '{configuration,colour}', colour_snapshot),
        decoration_snapshot = jsonb_build_object(
          'frontTechnique', nullif(v_next_design #>> '{configuration,artwork,front,technique}', ''),
          'backTechnique', nullif(v_next_design #>> '{configuration,artwork,back,technique}', '')
        ),
        artwork_snapshot = coalesce(v_next_design #> '{configuration,artwork}', artwork_snapshot),
        neck_label_snapshot = case
          when (v_next_design #> '{configuration}') ? 'neckLabel'
            then v_next_design #> '{configuration,neckLabel}'
          else neck_label_snapshot
        end
    where order_id = p_order_id and line_number = 1;
  end if;

  insert into public.audit_logs(
    actor_user_id,
    actor_type,
    action,
    target_type,
    target_id,
    order_id,
    before_state,
    after_state,
    metadata
  ) values (
    auth.uid(),
    'staff',
    'order.configuration_revised',
    'order',
    p_order_id,
    p_order_id,
    v_order.configuration_snapshot,
    p_next_snapshot,
    jsonb_build_object('revision', v_revision, 'reason', btrim(p_reason))
  );

  return v_revision;
end;
$$;

revoke all on function public.update_order_configuration(uuid, jsonb, text) from public;
grant execute on function public.update_order_configuration(uuid, jsonb, text) to authenticated;
