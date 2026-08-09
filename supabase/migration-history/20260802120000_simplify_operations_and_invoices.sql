-- Simplified operations: direct in-house invoices and credential-only staff access.
-- Historic approval, shipment, audit and Zoho tables are intentionally retained for
-- now; this migration removes runtime dependencies before a separately reviewed
-- data-retention decision drops historical records.

alter table public.staff_members drop column if exists must_use_mfa;

do $drop_zoho_invoice_constraints$
declare item record;
begin
  for item in
    select conname from pg_constraint
    where conrelid = 'public.invoices'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%zoho_%'
  loop
    execute format('alter table public.invoices drop constraint %I', item.conname);
  end loop;
end;
$drop_zoho_invoice_constraints$;

alter table public.invoices alter column provider set default 'garmops';
update public.invoices set provider = 'garmops' where provider = 'zoho_invoice' and sync_status <> 'completed';
create unique index if not exists invoices_document_number_unique_idx on public.invoices (document_number) where document_number is not null;

create table if not exists public.invoice_number_counters (
  financial_year integer primary key check (financial_year between 2020 and 9999),
  next_value bigint not null default 1 check (next_value > 0)
);

create or replace function public.assign_invoice_number(p_invoice_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_invoice public.invoices%rowtype; v_year integer; v_value bigint; v_number text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required'; end if;
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'invoice not found'; end if;
  if v_invoice.document_number is not null then return v_invoice.document_number; end if;
  v_year := extract(year from timezone('Asia/Kolkata', coalesce(v_invoice.issue_date::timestamptz, transaction_timestamp())))::integer
    - case when extract(month from timezone('Asia/Kolkata', coalesce(v_invoice.issue_date::timestamptz, transaction_timestamp()))) < 4 then 1 else 0 end;
  insert into public.invoice_number_counters(financial_year, next_value) values (v_year, 1) on conflict (financial_year) do nothing;
  update public.invoice_number_counters set next_value = next_value + 1 where financial_year = v_year returning next_value - 1 into v_value;
  v_number := format('GARMOPS/FY%s-%s/%s', v_year, right((v_year + 1)::text, 2), lpad(v_value::text, 6, '0'));
  update public.invoices set document_number = v_number, issue_date = coalesce(issue_date, timezone('Asia/Kolkata', transaction_timestamp())::date) where id = p_invoice_id;
  return v_number;
end;
$$;
revoke all on function public.assign_invoice_number(uuid) from public, anon, authenticated;
grant execute on function public.assign_invoice_number(uuid) to service_role;

create or replace function public.staff_has_permission(p_permission_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_role public.staff_role;
begin
  v_role := public.current_staff_role();
  if v_role is null then return false; end if;
  return case p_permission_name
    when 'view_profiles' then true
    when 'view_organizations' then true
    when 'view_all_orders' then true
    when 'view_internal_notes' then true
    when 'change_order_status' then v_role <> 'read_only'
    when 'view_payment_payload' then true
    else false
  end;
end;
$$;

create or replace function public.staff_transition_order(
  p_order_id uuid, p_to_status public.order_status, p_customer_message text default null,
  p_internal_note text default null, p_reason text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_public public.public_order_status; v_message text := nullif(btrim(p_customer_message), '');
begin
  if auth.uid() is null or not public.staff_has_permission('change_order_status') then raise exception 'STAFF_PERMISSION_DENIED'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status = p_to_status then return jsonb_build_object('changed', false); end if;
  if v_order.status in ('awaiting_payment', 'payment_failed') and p_to_status not in ('cancelled', 'expired') then raise exception 'INVALID_STATUS_TRANSITION'; end if;
  if v_order.order_type = 'sample_purchase' and p_to_status in ('commercial_review', 'quote_ready', 'awaiting_quote_approval', 'awaiting_balance_payment', 'artwork_review', 'awaiting_artwork_approval', 'approved_for_production') then raise exception 'INVALID_STATUS_TRANSITION'; end if;
  if p_to_status = 'cancelled' and nullif(btrim(p_reason), '') is null then raise exception 'CANCELLATION_REASON_REQUIRED'; end if;
  v_public := public.order_public_status_for_internal(p_to_status);
  update public.orders set status = p_to_status, public_status = v_public, updated_at = transaction_timestamp(), dispatched_at = case when p_to_status = 'dispatched' then transaction_timestamp() else dispatched_at end, delivered_at = case when p_to_status = 'delivered' then transaction_timestamp() else delivered_at end where id = v_order.id;
  insert into public.order_status_history(order_id, from_status, to_status, public_status, actor_type, actor_user_id, customer_visible, customer_message, internal_note, metadata) values (v_order.id, v_order.status, p_to_status, v_public, 'staff', auth.uid(), true, coalesce(v_message, 'Order status updated.'), null, jsonb_build_object('simplified_operations', true));
  return jsonb_build_object('changed', true, 'status', p_to_status, 'publicStatus', v_public);
end;
$$;

create or replace function public.queue_inhouse_invoice()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.payment_attempt_id is not null then
    insert into public.integration_jobs(job_type, dedupe_key, aggregate_type, aggregate_id, payload, priority)
    values ('create_reservation_invoice', format('create_reservation_invoice:%s', new.payment_attempt_id), 'invoice', new.id, jsonb_build_object('invoice_id', new.id, 'payment_attempt_id', new.payment_attempt_id, 'order_id', new.order_id), 20)
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists invoices_queue_inhouse_invoice on public.invoices;
create trigger invoices_queue_inhouse_invoice after insert on public.invoices for each row execute function public.queue_inhouse_invoice();
