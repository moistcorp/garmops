-- Saved designs: dated, server-issued estimates tied to immutable design versions.

create sequence public.design_estimate_number_seq;

create table public.design_estimates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  created_by uuid not null references public.profiles(id),
  design_project_id uuid not null references public.design_projects(id),
  design_version_id uuid not null references public.design_project_versions(id),
  design_revision bigint not null check (design_revision > 0),
  estimate_number text not null unique
    check (estimate_number ~ '^EST-[0-9]{4}-[0-9]{6}$'),
  status text not null default 'active'
    check (status in ('active', 'expired', 'superseded', 'converted', 'cancelled')),
  currency text not null default 'INR' check (currency = 'INR'),
  pricing_engine_version text not null
    check (pricing_engine_version = btrim(pricing_engine_version) and char_length(pricing_engine_version) between 1 and 80),
  pricing_snapshot jsonb not null
    check (jsonb_typeof(pricing_snapshot) = 'object' and pg_column_size(pricing_snapshot) <= 524288),
  subtotal_paise bigint not null check (subtotal_paise >= 0),
  discount_paise bigint not null check (discount_paise >= 0),
  taxable_subtotal_paise bigint not null check (taxable_subtotal_paise >= 0 and taxable_subtotal_paise = subtotal_paise - discount_paise),
  gst_rate_basis_points integer not null check (gst_rate_basis_points between 0 and 100000),
  gst_paise bigint not null check (gst_paise >= 0),
  shipping_paise bigint check (shipping_paise is null or shipping_paise >= 0),
  total_paise bigint not null check (total_paise >= 0 and total_paise = taxable_subtotal_paise + gst_paise + coalesce(shipping_paise, 0)),
  reservation_fee_paise bigint not null check (reservation_fee_paise >= 0),
  balance_due_paise bigint not null check (balance_due_paise >= 0 and balance_due_paise = greatest(total_paise - reservation_fee_paise, 0)),
  generated_at timestamptz not null default now(),
  valid_until timestamptz not null,
  converted_order_id uuid references public.orders(id),
  client_operation_id uuid not null,
  created_at timestamptz not null default now(),
  check (valid_until > generated_at)
);

create unique index design_estimates_org_operation_uidx
  on public.design_estimates (organization_id, client_operation_id);
create index design_estimates_created_by_generated_idx
  on public.design_estimates (created_by, generated_at desc);
create index design_estimates_project_generated_idx
  on public.design_estimates (design_project_id, generated_at desc);
create index design_estimates_version_idx
  on public.design_estimates (design_version_id);
create index design_estimates_org_number_idx
  on public.design_estimates (organization_id, estimate_number);
create index design_estimates_active_idx
  on public.design_estimates (design_project_id, generated_at desc)
  where status = 'active';

alter table public.orders
  add column estimate_id uuid references public.design_estimates(id);
create index orders_estimate_id_idx on public.orders (estimate_id) where estimate_id is not null;

alter table public.design_projects force row level security;
alter table public.design_project_versions force row level security;
drop policy if exists design_projects_select_member_or_staff on public.design_projects;
drop policy if exists design_projects_update_owner_or_buyer on public.design_projects;
drop policy if exists design_versions_select_member_or_staff on public.design_project_versions;
drop policy if exists design_versions_insert_owner_or_buyer on public.design_project_versions;

create policy design_projects_select_owner_or_staff
on public.design_projects for select to authenticated
using (created_by = auth.uid() or public.staff_has_permission('view_all_orders'));

create policy design_projects_update_owner_or_buyer
on public.design_projects for update to authenticated
using (created_by = auth.uid() or public.staff_has_permission('view_all_orders'))
with check (created_by = auth.uid() or public.staff_has_permission('view_all_orders'));

create policy design_versions_select_owner_or_staff
on public.design_project_versions for select to authenticated
using (
  exists (
    select 1 from public.design_projects project
    where project.id = design_project_id
      and (project.created_by = auth.uid() or public.staff_has_permission('view_all_orders'))
  )
);

create policy design_versions_insert_owner_or_buyer
on public.design_project_versions for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.design_projects project
    where project.id = design_project_id
      and project.created_by = auth.uid()
      and public.has_organization_role(project.organization_id, array['owner', 'buyer']::public.organization_role[])
  )
);

alter table public.design_estimates enable row level security;
alter table public.design_estimates force row level security;
create policy design_estimates_select_owner_or_staff
on public.design_estimates for select to authenticated
using (created_by = auth.uid() or public.staff_has_permission('view_all_orders'));

revoke insert, update, delete on public.design_estimates from authenticated;
revoke all on sequence public.design_estimate_number_seq from public, anon, authenticated;

create or replace function public.create_design_estimate_from_server(
  p_organization_id uuid,
  p_created_by uuid,
  p_design_project_id uuid,
  p_expected_revision bigint,
  p_client_operation_id uuid,
  p_pricing_engine_version text,
  p_pricing_snapshot jsonb,
  p_subtotal_paise bigint,
  p_discount_paise bigint,
  p_taxable_subtotal_paise bigint,
  p_gst_rate_basis_points integer,
  p_gst_paise bigint,
  p_shipping_paise bigint,
  p_total_paise bigint,
  p_reservation_fee_paise bigint,
  p_balance_due_paise bigint,
  p_valid_until timestamptz
)
returns table (
  estimate_id uuid,
  created boolean,
  estimate_number text,
  design_version_id uuid,
  design_revision bigint,
  status text,
  valid_until timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_project public.design_projects%rowtype;
  v_existing public.design_estimates%rowtype;
  v_version_id uuid;
  v_number text;
  v_generated_at timestamptz := transaction_timestamp();
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'server estimate function only';
  end if;
  select * into v_existing
  from public.design_estimates
  where organization_id = p_organization_id and client_operation_id = p_client_operation_id;
  if found then
    return query select v_existing.id, false, v_existing.estimate_number, v_existing.design_version_id,
      v_existing.design_revision, v_existing.status, v_existing.valid_until;
    return;
  end if;
  if p_expected_revision is null or p_expected_revision <= 0 then
    raise exception using errcode = '22023', message = 'invalid design revision';
  end if;
  select * into v_project from public.design_projects
  where id = p_design_project_id and organization_id = p_organization_id and created_by = p_created_by
  for update;
  if not found then raise exception using errcode = '42501', message = 'design access denied'; end if;
  if v_project.status <> 'draft' then raise exception using errcode = '22023', message = 'design is not active'; end if;
  if v_project.draft_revision <> p_expected_revision then
    raise exception using errcode = '40001', message = 'design has newer changes';
  end if;
  if p_valid_until <= v_generated_at then raise exception using errcode = '22023', message = 'invalid estimate validity'; end if;
  if p_subtotal_paise < 0 or p_discount_paise < 0 or p_taxable_subtotal_paise < 0 or p_gst_paise < 0 or p_total_paise < 0 or p_reservation_fee_paise < 0 or p_balance_due_paise < 0 then
    raise exception using errcode = '22023', message = 'invalid estimate amounts';
  end if;
  if p_taxable_subtotal_paise <> p_subtotal_paise - p_discount_paise
    or p_total_paise <> p_taxable_subtotal_paise + p_gst_paise + coalesce(p_shipping_paise, 0)
    or p_balance_due_paise <> greatest(p_total_paise - p_reservation_fee_paise, 0) then
    raise exception using errcode = '22023', message = 'estimate amount check failed';
  end if;
  if jsonb_typeof(p_pricing_snapshot) <> 'object' or pg_column_size(p_pricing_snapshot) > 524288 then
    raise exception using errcode = '22023', message = 'invalid estimate snapshot';
  end if;

  v_number := format('EST-%s-%s', extract(year from timezone('Asia/Kolkata', v_generated_at))::int,
    lpad(nextval('public.design_estimate_number_seq')::text, 6, '0'));
  insert into public.design_project_versions (design_project_id, version_number, configuration_snapshot, pricing_input_snapshot, created_by)
  values (v_project.id, v_project.current_version + 1, p_pricing_snapshot -> 'designSnapshot', p_pricing_snapshot, p_created_by)
  returning id into v_version_id;
  update public.design_projects set current_version = current_version + 1 where id = v_project.id;
  update public.design_estimates set status = 'superseded'
  where design_project_id = v_project.id and status = 'active';
  insert into public.design_estimates (
    organization_id, created_by, design_project_id, design_version_id, design_revision,
    estimate_number, pricing_engine_version, pricing_snapshot, subtotal_paise,
    discount_paise, taxable_subtotal_paise, gst_rate_basis_points, gst_paise,
    shipping_paise, total_paise, reservation_fee_paise, balance_due_paise,
    generated_at, valid_until, client_operation_id
  ) values (
    p_organization_id, p_created_by, v_project.id, v_version_id, p_expected_revision,
    v_number, p_pricing_engine_version, p_pricing_snapshot - 'designSnapshot', p_subtotal_paise,
    p_discount_paise, p_taxable_subtotal_paise, p_gst_rate_basis_points, p_gst_paise,
    p_shipping_paise, p_total_paise, p_reservation_fee_paise, p_balance_due_paise,
    v_generated_at, p_valid_until, p_client_operation_id
  ) returning id into v_existing.id;
  insert into public.audit_logs (actor_user_id, actor_type, action, target_type, target_id, organization_id, after_state)
  values (p_created_by, 'customer', 'design.estimate_created', 'design_estimate', v_existing.id, p_organization_id,
    jsonb_build_object('estimate_number', v_number, 'design_project_id', v_project.id, 'design_version_id', v_version_id));
  return query select v_existing.id, true, v_number, v_version_id, p_expected_revision, 'active'::text, p_valid_until;
end;
$$;

revoke all on function public.create_design_estimate_from_server(
  uuid, uuid, uuid, bigint, uuid, text, jsonb, bigint, bigint, bigint, integer,
  bigint, bigint, bigint, bigint, bigint, timestamptz
) from public, anon, authenticated;
grant execute on function public.create_design_estimate_from_server(
  uuid, uuid, uuid, bigint, uuid, text, jsonb, bigint, bigint, bigint, integer,
  bigint, bigint, bigint, bigint, bigint, timestamptz
) to service_role;

create or replace function public.link_order_to_estimate(
  p_order_id uuid,
  p_estimate_id uuid,
  p_customer_user_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_updated integer;
begin
  if current_user <> 'service_role' then raise exception using errcode = '42501', message = 'server conversion function only'; end if;
  update public.orders set estimate_id = p_estimate_id
  where id = p_order_id and customer_user_id = p_customer_user_id;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then return false; end if;
  update public.design_estimates set status = 'converted', converted_order_id = p_order_id
  where id = p_estimate_id and created_by = p_customer_user_id and status in ('active', 'expired');
  return true;
end;
$$;
revoke all on function public.link_order_to_estimate(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.link_order_to_estimate(uuid, uuid, uuid) to service_role;

-- Existing SECURITY DEFINER cloud-design functions predate creator-only access.
-- Keep their replay/concurrency behavior, but stop a member of the same
-- organisation from mutating or duplicating another customer's design.
create or replace function public.design_creator_mutation_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and current_user <> 'service_role'
    and not public.staff_has_permission('view_all_orders') then
    if tg_table_name = 'design_projects' and tg_op = 'UPDATE' and old.created_by <> auth.uid() then
      raise exception using errcode = '42501', message = 'design access denied';
    end if;
    if tg_table_name = 'design_project_versions' and not exists (
      select 1 from public.design_projects project
      where project.id = new.design_project_id and project.created_by = auth.uid()
    ) then
      raise exception using errcode = '42501', message = 'design access denied';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists design_projects_creator_mutation_guard on public.design_projects;
create trigger design_projects_creator_mutation_guard
before update on public.design_projects
for each row execute function public.design_creator_mutation_guard();
drop trigger if exists design_versions_creator_mutation_guard on public.design_project_versions;
create trigger design_versions_creator_mutation_guard
before insert on public.design_project_versions
for each row execute function public.design_creator_mutation_guard();

create or replace function public.duplicate_cloud_design(
  p_design_project_id uuid,
  p_title text,
  p_client_operation_id uuid
)
returns table (
  design_project_id uuid,
  design_version_id uuid,
  draft_revision bigint,
  version_number integer,
  last_saved_at timestamptz,
  created_new boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_source public.design_projects%rowtype;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if p_client_operation_id is null then raise exception 'client operation id is required'; end if;
  select * into v_source from public.design_projects where id = p_design_project_id;
  if not found or v_source.created_by <> v_user_id then raise exception 'design not found'; end if;
  return query select * from public.create_cloud_design(
    v_source.organization_id, p_title, v_source.schema_version,
    v_source.draft_snapshot, v_source.pricing_input_snapshot, 'duplicate',
    p_client_operation_id
  );
end;
$$;
revoke all on function public.duplicate_cloud_design(uuid, text, uuid) from public, anon;
grant execute on function public.duplicate_cloud_design(uuid, text, uuid) to authenticated;
