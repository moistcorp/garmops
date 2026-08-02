-- Remove backend subsystems that have no application callers and no retained
-- rows in the reviewed hosted project. This migration deliberately fails
-- instead of discarding data if any of those assumptions changes before deploy.

do $verify_dormant_backend_is_empty$
begin
  if exists (select 1 from public.approvals limit 1)
    or exists (select 1 from public.design_estimates limit 1)
    or exists (select 1 from public.notifications limit 1)
    or exists (select 1 from public.order_comments limit 1)
    or exists (select 1 from public.shipments limit 1)
    or exists (select 1 from public.shipment_events limit 1)
    or exists (
      select 1
      from public.orders
      where estimate_id is not null
        or assigned_staff_user_id is not null
        or assigned_team is not null
        or internal_priority <> 'normal'
        or expected_approval_at is not null
        or expected_production_at is not null
        or expected_qc_at is not null
        or estimated_dispatch_at is not null
      limit 1
    )
    or exists (
      select 1
      from public.organizations
      where zoho_contact_id is not null
        or zoho_contact_synced_at is not null
      limit 1
    )
    or exists (
      select 1
      from public.invoices
      where zoho_contact_id is not null
        or zoho_document_id is not null
        or zoho_payment_id is not null
      limit 1
    ) then
    raise exception using
      errcode = '55000',
      message = 'DORMANT_BACKEND_DATA_PRESENT',
      hint = 'Export and review the retained rows before applying this cleanup migration.';
  end if;
end;
$verify_dormant_backend_is_empty$;

-- Reorder provenance remains useful, so retain its immutability guard while
-- removing approval and shipment transition dependencies.
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

  return new;
end;
$$;

-- Customer-owned artwork and purchase orders can still be removed. The old
-- staff branches were unreachable after operations permissions were retired.
create or replace function public.soft_delete_file(p_file_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_file public.order_files%rowtype;
  v_customer_allowed boolean := false;
  v_organization_id uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  select *
  into v_file
  from public.order_files
  where id = p_file_id
  for update;

  if not found or v_file.deleted_at is not null then
    return false;
  end if;
  if exists (
    select 1
    from public.invoices
    where pdf_file_id = p_file_id
  ) then
    return false;
  end if;

  v_customer_allowed :=
    v_file.uploaded_by = auth.uid()
    and v_file.kind in ('customer_artwork', 'purchase_order')
    and (
      (v_file.order_id is not null and public.is_order_organization_member(v_file.order_id))
      or (
        v_file.design_project_id is not null
        and public.is_design_organization_member(v_file.design_project_id)
      )
    );

  if not v_customer_allowed then
    return false;
  end if;

  update public.order_files
  set deleted_at = now()
  where id = p_file_id;

  if v_file.order_id is not null then
    select customer_order.organization_id
    into v_organization_id
    from public.orders as customer_order
    where customer_order.id = v_file.order_id;
  else
    select design.organization_id
    into v_organization_id
    from public.design_projects as design
    where design.id = v_file.design_project_id;
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
  )
  values (
    auth.uid(),
    'customer',
    'file.soft_deleted',
    'order_file',
    p_file_id,
    v_organization_id,
    v_file.order_id,
    jsonb_build_object(
      'upload_status', v_file.upload_status,
      'scan_status', v_file.scan_status
    ),
    jsonb_build_object('deleted_at', now())
  );

  return true;
end;
$$;

-- Replace the last live provider labels left by the retired Zoho adapter. The
-- function signatures and behaviour otherwise remain unchanged.
do $replace_retired_provider_labels$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    to_regprocedure(
      'public.finalize_verified_payment(uuid,text,bigint,character,jsonb,public.invoice_kind)'
    )
  ) into v_definition;
  if v_definition is null or position('''zoho_invoice''' in v_definition) = 0 then
    raise exception 'Expected retired provider label was not found in finalize_verified_payment';
  end if;
  execute replace(v_definition, '''zoho_invoice''', '''garmops''');

  select pg_get_functiondef(
    to_regprocedure('public.create_sample_invoice_placeholder()')
  ) into v_definition;
  if v_definition is null or position('''zoho_invoice''' in v_definition) = 0 then
    raise exception 'Expected retired provider label was not found in create_sample_invoice_placeholder';
  end if;
  execute replace(v_definition, '''zoho_invoice''', '''garmops''');

  select pg_get_functiondef(
    to_regprocedure('public.finalize_private_upload(uuid,bigint,text,text,text)')
  ) into v_definition;
  if v_definition is null
    or position('provider_source in (''zoho'', ''system'')' in v_definition) = 0 then
    raise exception 'Expected retired provider branch was not found in finalize_private_upload';
  end if;
  execute replace(
    v_definition,
    'provider_source in (''zoho'', ''system'')',
    'provider_source = ''system'''
  );
end;
$replace_retired_provider_labels$;

update public.invoices
set provider = 'garmops'
where provider = 'zoho_invoice';

update public.order_files
set provider_source = 'garmops'
where provider_source = 'zoho';

drop function if exists public.create_design_estimate_from_server(
  uuid, uuid, uuid, bigint, uuid, text, jsonb, bigint, bigint, bigint,
  integer, bigint, bigint, bigint, bigint, bigint, timestamptz
);
drop function if exists public.link_order_to_estimate(uuid, uuid, uuid);

drop function if exists public.mark_all_notifications_read();
drop function if exists public.mark_notification_read(uuid);

drop function if exists public.external_respond_order_approval(text, text, text, text, text);
drop function if exists public.respond_order_approval(uuid, text, text);
drop function if exists public.staff_approval_queue(integer);
drop function if exists public.staff_create_approval_request(
  uuid, uuid, uuid, uuid, text, text, timestamptz
);
drop function if exists public.staff_order_approvals(uuid);
drop function if exists public.staff_revoke_approval(uuid, text);

drop function if exists public.customer_shipment_events(uuid);
drop function if exists public.staff_create_shipment(
  uuid, text, text, text, integer, timestamptz, text
);
drop function if exists public.staff_update_shipment(
  uuid, text, text, text, text, integer, timestamptz, text, text, text
);

drop function if exists public.staff_add_order_comment(uuid, text, text, boolean, text);
drop function if exists public.staff_resolve_order_action(uuid, text);

drop function if exists public.staff_assign_order(uuid, uuid, text, text);
drop function if exists public.staff_change_order_file_visibility(uuid, public.file_visibility, text);
drop function if exists public.staff_dashboard_metrics();
drop function if exists public.staff_list_assignable_members();
drop function if exists public.staff_safe_payment_summary(uuid);
drop function if exists public.staff_search_orders(
  text, public.order_status, public.public_order_status, public.order_type,
  text, text, text, uuid, text, text, text, date, date, boolean, boolean,
  boolean, integer, integer
);
drop function if exists public.staff_set_order_dates(
  uuid, timestamptz, timestamptz, timestamptz, timestamptz
);
drop function if exists public.staff_set_order_priority(uuid, text, text);

drop function if exists public.review_file_scan(uuid, public.file_scan_status, text);
drop function if exists public.defer_integration_job(uuid, text, timestamptz, text);
drop function if exists public.retry_invoice_integration_job(uuid);

alter table public.orders
  drop column estimate_id,
  drop column assigned_staff_user_id,
  drop column assigned_team,
  drop column internal_priority,
  drop column expected_approval_at,
  drop column expected_production_at,
  drop column expected_qc_at,
  drop column estimated_dispatch_at;

alter table public.organizations
  drop column zoho_contact_id,
  drop column zoho_contact_synced_at;

alter table public.invoices
  drop column zoho_contact_id,
  drop column zoho_document_id,
  drop column zoho_payment_id;

drop table public.shipment_events;
drop table public.shipments;
drop table public.approvals;
drop table public.notifications;
drop table public.order_comments;
drop table public.design_estimates;
