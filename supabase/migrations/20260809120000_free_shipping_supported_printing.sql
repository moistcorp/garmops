begin;

-- Shipping is included in every current order. Keep one immutable accounting
-- field, but make non-zero values impossible and remove the retired second
-- payment workflow.
update public.orders set shipping_charge_paise = 0;
alter table public.orders alter column shipping_charge_paise set default 0;
alter table public.orders alter column shipping_charge_paise set not null;
alter table public.orders drop constraint if exists orders_shipping_charge_paise_check;
alter table public.orders add constraint orders_shipping_charge_is_free
  check (shipping_charge_paise = 0);

drop function if exists public.set_shipping_payment_link(uuid,bigint,text,text);
drop function if exists public.create_shipping_payment_attempt(uuid,bigint);
drop function if exists public.mark_shipping_payment_received(uuid,text);
alter table public.orders
  drop column if exists shipping_payment_link_url,
  drop column if exists shipping_payment_reference,
  drop column if exists shipping_paid_at,
  drop column if exists shipping_payment_status;
drop type if exists public.shipping_payment_status;

-- There are no orders to preserve. Remove any abandoned shipping attempts
-- before narrowing the payment purpose enum.
delete from public.payment_events
where payment_attempt_id in (
  select id from public.payment_attempts where purpose::text = 'shipping'
);
delete from public.payment_attempts where purpose::text = 'shipping';

drop function if exists public.customer_payment_summaries(uuid);
drop function if exists public.staff_payment_summaries(uuid);
alter type public.payment_purpose rename to payment_purpose_retired;
create type public.payment_purpose as enum ('order_full', 'refund');
alter table public.payment_attempts alter column purpose type public.payment_purpose
  using purpose::text::public.payment_purpose;
drop type public.payment_purpose_retired;

create function public.customer_payment_summaries(p_order_id uuid)
returns table(
  payment_attempt_id uuid, purpose public.payment_purpose,
  status public.payment_status, amount_paise bigint,
  paid_at timestamptz, created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select p.id,p.purpose,p.status,p.amount_paise,p.paid_at,p.created_at
  from public.payment_attempts p join public.orders o on o.id=p.order_id
  where p.order_id=p_order_id and o.customer_user_id=auth.uid()
  order by p.created_at desc
$$;

create function public.staff_payment_summaries(p_order_id uuid default null)
returns table(
  payment_attempt_id uuid, order_id uuid, order_number text,
  purpose public.payment_purpose, status public.payment_status,
  amount_paise bigint, provider_merchant_txn_id text,
  provider_payment_id text, created_at timestamptz, paid_at timestamptz,
  failure_message text
)
language sql stable security definer set search_path = '' as $$
  select p.id,p.order_id,o.order_number,p.purpose,p.status,p.amount_paise,
    case when public.staff_has_permission('view_raw_payments') then p.provider_merchant_txn_id else null end,
    case when public.staff_has_permission('view_raw_payments') then p.provider_payment_id else null end,
    p.created_at,p.paid_at,
    case when p.status='failed' then coalesce(p.failure_message,'Payment failed') else null end
  from public.payment_attempts p join public.orders o on o.id=p.order_id
  where public.is_active_staff(true) and (p_order_id is null or p.order_id=p_order_id)
  order by p.created_at desc
$$;

revoke all on function public.customer_payment_summaries(uuid),
  public.staff_payment_summaries(uuid) from public, anon;
grant execute on function public.customer_payment_summaries(uuid),
  public.staff_payment_summaries(uuid) to authenticated;

create or replace function public.staff_has_permission(p_permission text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_role public.staff_role := public.current_staff_role();
begin
  if v_role is null or not public.staff_mfa_satisfied() then return false; end if;
  return case p_permission
    when 'view_all_orders' then true
    when 'change_order_status' then true
    when 'review_artwork' then true
    when 'edit_order_configuration' then true
    when 'create_staff_quote' then true
    when 'manage_staff' then v_role = 'founder'
    when 'manage_discounts' then v_role = 'founder'
    when 'manage_refunds' then v_role = 'founder'
    when 'view_raw_payments' then v_role = 'founder'
    when 'override_order_workflow' then v_role = 'founder'
    else false
  end;
end;
$$;

-- Clean production wording. PostgreSQL updates dependent enum values safely.
alter type public.order_status rename value 'printing_embroidery' to 'printing';

-- PL/pgSQL bodies store enum literals as source text and are parsed lazily.
-- Recompile every active function that contains the retired spelling.
do $$
declare v_function record;
begin
  for v_function in
    select pg_get_functiondef(p.oid) definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind in ('f','p')
      and pg_get_functiondef(p.oid) ilike '%printing_embroidery%'
  loop
    execute replace(v_function.definition,'printing_embroidery','printing');
  end loop;
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
  if p_to_status='production_approved' then
    if v_order.amount_paid_paise<>v_order.total_paise then raise exception 'VERIFIED_PAYMENT_REQUIRED'; end if;
    if exists(
      select 1 from public.order_artwork_requirements r
      left join public.order_files f on f.id=r.file_id
      where r.order_id=v_order.id and r.is_active and (
        f.id is null or f.order_id is distinct from v_order.id or
        f.deleted_at is not null or f.upload_status<>'finalized' or
        f.review_status<>'approved' or f.scan_status<>'clean'
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
