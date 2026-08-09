-- Approval requests created in one transaction share transaction_timestamp().
-- Guard lifecycle state from the active evidence itself rather than choosing an
-- arbitrary row among tied created_at values.
create or replace function public.phase11_order_transition_guards()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.source_order_id is distinct from old.source_order_id
    and old.source_order_id is not null then
    raise exception using errcode = '23514', message = 'SOURCE_ORDER_IMMUTABLE';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'awaiting_artwork_approval' and not exists (
      select 1
      from public.approvals approval
      where approval.order_id = new.id
        and approval.revoked_at is null
        and approval.status in ('requested', 'viewed')
        and approval.expires_at > now()
    ) then
      raise exception using errcode = '23514', message = 'ACTIVE_APPROVAL_REQUIRED';
    end if;

    if new.status = 'approved_for_production' and not exists (
      select 1
      from public.approvals approval
      where approval.order_id = new.id
        and approval.revoked_at is null
        and approval.status = 'approved'
        and approval.responded_at is not null
    ) then
      raise exception using errcode = '23514', message = 'LATEST_APPROVAL_REQUIRED';
    end if;

    if new.status = 'dispatched' and not exists (
      select 1
      from public.shipments shipment
      where shipment.order_id = new.id
        and shipment.status in (
          'dispatched',
          'in_transit',
          'out_for_delivery',
          'exception',
          'delivered'
        )
        and (shipment.tracking_number is not null or shipment.carrier is not null)
    ) then
      raise exception using errcode = '23514', message = 'DISPATCHED_SHIPMENT_REQUIRED';
    end if;

    if new.status = 'delivered' and (
      not exists (
        select 1
        from public.shipments shipment
        where shipment.order_id = new.id
          and shipment.status <> 'cancelled'
      )
      or exists (
        select 1
        from public.shipments shipment
        where shipment.order_id = new.id
          and shipment.status <> 'cancelled'
          and (shipment.status <> 'delivered' or shipment.delivered_at is null)
      )
    ) then
      raise exception using errcode = '23514', message = 'ALL_SHIPMENTS_DELIVERED_REQUIRED';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.phase11_order_transition_guards() is
  'Enforces immutable reorder ancestry and evidence-backed approval, dispatch, and delivery transitions without timestamp-order ambiguity.';
