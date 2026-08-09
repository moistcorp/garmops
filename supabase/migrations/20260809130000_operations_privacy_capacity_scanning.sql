begin;

alter type public.file_scan_status add value if not exists 'pending_scan';
alter type public.file_scan_status add value if not exists 'infected';
alter type public.file_scan_status add value if not exists 'scan_failed';
alter type public.file_scan_status add value if not exists 'scanner_unavailable';

create table public.customer_privacy_preferences (
  customer_user_id uuid primary key references auth.users(id) on delete cascade,
  analytics_enabled boolean not null default false,
  recovery_messages_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger customer_privacy_preferences_set_updated_at before update on public.customer_privacy_preferences
for each row execute function public.set_updated_at();
alter table public.customer_privacy_preferences enable row level security;
create policy customer_privacy_preferences_own on public.customer_privacy_preferences
for all to authenticated using (customer_user_id=auth.uid()) with check (customer_user_id=auth.uid());

create type public.privacy_request_type as enum ('export','delete','correction');
create type public.privacy_request_status as enum ('submitted','in_review','completed','rejected');
create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references auth.users(id),
  request_type public.privacy_request_type not null,
  status public.privacy_request_status not null default 'submitted',
  customer_note text check (char_length(customer_note)<=2000),
  resolution_notes text check (char_length(resolution_notes)<=4000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger privacy_requests_set_updated_at before update on public.privacy_requests
for each row execute function public.set_updated_at();
alter table public.privacy_requests enable row level security;
create policy privacy_requests_customer_select on public.privacy_requests for select to authenticated using (customer_user_id=auth.uid());
create policy privacy_requests_customer_insert on public.privacy_requests for insert to authenticated with check (customer_user_id=auth.uid() and status='submitted');
create policy privacy_requests_staff on public.privacy_requests for all to authenticated using (public.staff_has_permission('manage_staff')) with check (public.staff_has_permission('manage_staff'));

create table public.production_working_days (
  weekday smallint primary key check (weekday between 0 and 6),
  is_working boolean not null default false, updated_at timestamptz not null default now()
);
create table public.production_blackout_dates (
  date date primary key, note text, active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.production_capacity_rules (
  id uuid primary key default gen_random_uuid(), effective_from date not null,
  daily_unit_capacity integer not null check (daily_unit_capacity>0),
  product_category text, technique text check (technique is null or technique in ('screen_print','dtf','reflective_print')),
  active boolean not null default true, created_at timestamptz not null default now()
);
create table public.production_lead_time_rules (
  id uuid primary key default gen_random_uuid(), product_category text, technique text check (technique is null or technique in ('screen_print','dtf','reflective_print')),
  custom_dye_extra_days integer not null default 0 check (custom_dye_extra_days>=0),
  setup_buffer_days integer not null default 0 check (setup_buffer_days>=0),
  qc_dispatch_buffer_days integer not null default 0 check (qc_dispatch_buffer_days>=0),
  rush_eligible boolean not null default false, active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.production_working_days enable row level security;
alter table public.production_blackout_dates enable row level security;
alter table public.production_capacity_rules enable row level security;
alter table public.production_lead_time_rules enable row level security;
create policy production_working_days_staff_read on public.production_working_days for select to authenticated using (public.is_active_staff(false));
create policy production_blackout_staff_read on public.production_blackout_dates for select to authenticated using (public.is_active_staff(false));
create policy production_capacity_staff_read on public.production_capacity_rules for select to authenticated using (public.is_active_staff(false));
create policy production_lead_staff_read on public.production_lead_time_rules for select to authenticated using (public.is_active_staff(false));
create policy production_working_days_founder_write on public.production_working_days for all to authenticated using (public.current_staff_role()='founder') with check (public.current_staff_role()='founder');
create policy production_blackout_founder_write on public.production_blackout_dates for all to authenticated using (public.current_staff_role()='founder') with check (public.current_staff_role()='founder');
create policy production_capacity_founder_write on public.production_capacity_rules for all to authenticated using (public.current_staff_role()='founder') with check (public.current_staff_role()='founder');
create policy production_lead_founder_write on public.production_lead_time_rules for all to authenticated using (public.current_staff_role()='founder') with check (public.current_staff_role()='founder');

create or replace function public.foundry_business_metrics(p_from date, p_to date)
returns jsonb language sql stable security definer set search_path='' as $$
  with paid as (
    select * from public.orders where amount_paid_paise=total_paise and confirmed_at::date between p_from and p_to
  ), totals as (
    select count(*) paid_orders,coalesce(sum(amount_paid_paise),0) gross,
      coalesce(sum(taxable_value_paise),0) taxable,coalesce(sum(tax_paise),0) gst,
      coalesce(avg(amount_paid_paise),0) aov from paid
  ), lines as (
    select coalesce(sum(oi.quantity),0) units,
      coalesce(jsonb_agg(distinct jsonb_build_object('productId',oi.product_id,'productName',oi.product_name)), '[]'::jsonb) products
    from public.order_items oi join paid on paid.id=oi.order_id
  )
  select case when public.current_staff_role()<>'founder' then null else jsonb_build_object(
    'paidOrders',totals.paid_orders,'grossPaidPaise',totals.gross,
    'taxableValuePaise',totals.taxable,'gstPaise',totals.gst,
    'averageOrderValuePaise',totals.aov,'unitsOrdered',lines.units,'byProduct',lines.products,
    'statusCounts',(select coalesce(jsonb_object_agg(status,qty),'{}'::jsonb) from (select status,count(*) qty from public.orders where created_at::date between p_from and p_to group by status) s)
  ) end from totals cross join lines
$$;
revoke all on function public.foundry_business_metrics(date,date) from public,anon;
grant execute on function public.foundry_business_metrics(date,date) to authenticated;

create index design_projects_recovery_candidates_idx on public.design_projects(updated_at)
where status='draft' and archived_at is null;
alter table public.design_projects add column recovery_last_sent_at timestamptz;

create function public.enqueue_abandoned_design_recovery(p_inactive_interval interval default interval '72 hours')
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  insert into public.integration_jobs(job_type,deduplication_key,payload)
  select 'send_saved_design_recovery',
    'saved-design-recovery:'||d.id::text||':'||to_char(now() at time zone 'UTC','YYYY-MM-DD'),
    jsonb_build_object('designId',d.id,'customerUserId',d.created_by)
  from public.design_projects d join public.customer_privacy_preferences p on p.customer_user_id=d.created_by
  where d.status='draft' and d.archived_at is null and d.updated_at<now()-p_inactive_interval
    and p.recovery_messages_enabled and (d.recovery_last_sent_at is null or d.recovery_last_sent_at<now()-interval '30 days')
    and not exists(select 1 from public.orders o where o.customer_user_id=d.created_by and o.configuration_snapshot->>'designProjectId'=d.id::text)
  on conflict(deduplication_key) do nothing;
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;
revoke all on function public.enqueue_abandoned_design_recovery(interval) from public,anon,authenticated;
grant execute on function public.enqueue_abandoned_design_recovery(interval) to service_role;
create index orders_confirmed_status_idx on public.orders(confirmed_at,status);

commit;
