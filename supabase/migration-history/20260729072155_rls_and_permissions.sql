-- Garmops Phase 3: fail-closed tenant isolation, MFA-aware staff permissions,
-- column-level browser grants, and service-only provider boundaries.

create function public.is_organization_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.organization_members as membership
      where membership.organization_id = p_organization_id
        and membership.user_id = auth.uid()
        and membership.status = 'active'
    );
$$;

create function public.has_organization_role(
  p_organization_id uuid,
  p_allowed_roles public.organization_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and coalesce(cardinality(p_allowed_roles), 0) > 0
    and exists (
      select 1
      from public.organization_members as membership
      where membership.organization_id = p_organization_id
        and membership.user_id = auth.uid()
        and membership.status = 'active'
        and membership.role = any(p_allowed_roles)
    );
$$;

create function public.current_staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select staff.role
  from public.staff_members as staff
  where staff.user_id = auth.uid()
    and staff.active
    and staff.deactivated_at is null;
$$;

create function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_staff_role() is not null;
$$;

create function public.staff_has_permission(p_permission_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.staff_role;
  v_aal text;
begin
  v_role := public.current_staff_role();
  v_aal := coalesce(auth.jwt() ->> 'aal', '');

  if v_role is null or v_aal <> 'aal2' then
    return false;
  end if;

  return case p_permission_name
    when 'view_profiles' then true
    when 'view_organizations' then true
    when 'view_all_orders' then true
    when 'view_internal_notes' then true
    when 'add_internal_note' then v_role <> 'read_only'
    when 'send_customer_update' then v_role <> 'read_only'
    when 'assign_order' then
      v_role in ('super_admin', 'operations_admin', 'sales')
    when 'edit_commercial' then
      v_role in ('super_admin', 'operations_admin', 'sales', 'finance')
    when 'change_production_status' then
      v_role in (
        'super_admin',
        'operations_admin',
        'production',
        'artwork',
        'qc',
        'dispatch'
      )
    when 'upload_artwork_proof' then
      v_role in ('super_admin', 'operations_admin', 'artwork')
    when 'view_payment_payload' then
      v_role in ('super_admin', 'operations_admin', 'finance')
    when 'retry_invoice_job' then
      v_role in ('super_admin', 'finance')
    when 'refund_workflow' then
      v_role in ('super_admin', 'finance')
    when 'upload_qc_evidence' then
      v_role in ('super_admin', 'operations_admin', 'production', 'qc')
    when 'manage_approvals' then
      v_role in ('super_admin', 'operations_admin', 'artwork')
    when 'manage_shipments' then
      v_role in ('super_admin', 'operations_admin', 'dispatch')
    when 'view_jobs' then
      v_role in ('super_admin', 'operations_admin', 'finance')
    when 'view_audit' then
      v_role in ('super_admin', 'operations_admin')
    when 'manage_staff' then
      v_role = 'super_admin'
    else false
  end;
end;
$$;

create function public.is_order_organization_member(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.orders as customer_order
      join public.organization_members as membership
        on membership.organization_id = customer_order.organization_id
      where customer_order.id = p_order_id
        and membership.user_id = auth.uid()
        and membership.status = 'active'
    );
$$;

create function public.user_can_access_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_order_organization_member(p_order_id)
    or public.staff_has_permission('view_all_orders');
$$;

create function public.is_design_organization_member(p_design_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.design_projects as design
      join public.organization_members as membership
        on membership.organization_id = design.organization_id
      where design.id = p_design_project_id
        and membership.user_id = auth.uid()
        and membership.status = 'active'
    );
$$;

create function public.user_can_access_design(p_design_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_design_organization_member(p_design_project_id)
    or public.staff_has_permission('view_all_orders');
$$;

create function public.user_can_access_order_item(p_order_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.order_items as item
    where item.id = p_order_item_id
      and public.user_can_access_order(item.order_id)
  );
$$;

revoke all on function public.is_organization_member(uuid)
  from public, anon, authenticated;
revoke all on function public.has_organization_role(uuid, public.organization_role[])
  from public, anon, authenticated;
revoke all on function public.current_staff_role()
  from public, anon, authenticated;
revoke all on function public.is_active_staff()
  from public, anon, authenticated;
revoke all on function public.staff_has_permission(text)
  from public, anon, authenticated;
revoke all on function public.is_order_organization_member(uuid)
  from public, anon, authenticated;
revoke all on function public.user_can_access_order(uuid)
  from public, anon, authenticated;
revoke all on function public.is_design_organization_member(uuid)
  from public, anon, authenticated;
revoke all on function public.user_can_access_design(uuid)
  from public, anon, authenticated;
revoke all on function public.user_can_access_order_item(uuid)
  from public, anon, authenticated;

grant execute on function public.is_organization_member(uuid)
  to authenticated, service_role;
grant execute on function public.has_organization_role(uuid, public.organization_role[])
  to authenticated, service_role;
grant execute on function public.current_staff_role()
  to authenticated, service_role;
grant execute on function public.is_active_staff()
  to authenticated, service_role;
grant execute on function public.staff_has_permission(text)
  to authenticated, service_role;
grant execute on function public.is_order_organization_member(uuid)
  to authenticated, service_role;
grant execute on function public.user_can_access_order(uuid)
  to authenticated, service_role;
grant execute on function public.is_design_organization_member(uuid)
  to authenticated, service_role;
grant execute on function public.user_can_access_design(uuid)
  to authenticated, service_role;
grant execute on function public.user_can_access_order_item(uuid)
  to authenticated, service_role;

-- Enforce RLS even for non-BYPASSRLS table owners. Supabase service_role and
-- PostgreSQL superusers retain their explicit BYPASSRLS behaviour.

alter table public.profiles force row level security;
alter table public.organizations force row level security;
alter table public.organization_members force row level security;
alter table public.staff_members force row level security;
alter table public.addresses force row level security;
alter table public.design_projects force row level security;
alter table public.design_project_versions force row level security;
alter table public.number_counters force row level security;
alter table public.orders force row level security;
alter table public.order_items force row level security;
alter table public.order_item_sizes force row level security;
alter table public.idempotency_keys force row level security;
alter table public.payment_attempts force row level security;
alter table public.payment_events force row level security;
alter table public.order_status_history force row level security;
alter table public.order_comments force row level security;
alter table public.order_files force row level security;
alter table public.approvals force row level security;
alter table public.invoices force row level security;
alter table public.integration_jobs force row level security;
alter table public.shipments force row level security;
alter table public.notifications force row level security;
alter table public.audit_logs force row level security;

-- Remove Supabase's broad schema defaults and grant only the operations and
-- columns required by reviewed browser workflows.

revoke all privileges on table
  public.profiles,
  public.organizations,
  public.organization_members,
  public.staff_members,
  public.addresses,
  public.design_projects,
  public.design_project_versions,
  public.number_counters,
  public.orders,
  public.order_items,
  public.order_item_sizes,
  public.idempotency_keys,
  public.payment_attempts,
  public.payment_events,
  public.order_status_history,
  public.order_comments,
  public.order_files,
  public.approvals,
  public.invoices,
  public.integration_jobs,
  public.shipments,
  public.notifications,
  public.audit_logs
from anon, authenticated;

grant select on table
  public.profiles,
  public.organizations,
  public.organization_members,
  public.staff_members,
  public.addresses,
  public.design_projects,
  public.design_project_versions,
  public.orders,
  public.order_items,
  public.order_item_sizes,
  public.payment_attempts,
  public.payment_events,
  public.order_status_history,
  public.order_comments,
  public.order_files,
  public.invoices,
  public.integration_jobs,
  public.shipments,
  public.notifications,
  public.audit_logs
to authenticated;

grant select (
  id,
  order_id,
  design_version_id,
  approval_pdf_file_id,
  status,
  requested_by,
  requested_from_user_id,
  requested_from_email,
  expires_at,
  viewed_at,
  responded_at,
  response_note,
  user_agent_summary,
  created_at
) on public.approvals to authenticated;

grant update (
  first_name,
  last_name,
  phone,
  job_title,
  department,
  avatar_r2_key,
  locale,
  timezone,
  onboarding_completed_at
) on public.profiles to authenticated;

grant update (
  legal_name,
  display_name,
  slug,
  industry,
  website,
  gstin,
  pan,
  billing_email,
  phone
) on public.organizations to authenticated;

grant insert (
  organization_id,
  label,
  contact_name,
  phone,
  line1,
  line2,
  landmark,
  city,
  state,
  postal_code,
  country_code,
  gstin,
  is_default_billing,
  is_default_shipping
) on public.addresses to authenticated;
grant update (
  label,
  contact_name,
  phone,
  line1,
  line2,
  landmark,
  city,
  state,
  postal_code,
  country_code,
  gstin,
  is_default_billing,
  is_default_shipping
) on public.addresses to authenticated;
grant delete on public.addresses to authenticated;

grant insert (
  organization_id,
  created_by,
  title,
  status,
  schema_version,
  current_version,
  source,
  last_saved_at,
  submitted_at
) on public.design_projects to authenticated;
grant update (
  title,
  status,
  current_version,
  last_saved_at,
  submitted_at
) on public.design_projects to authenticated;

grant insert (
  design_project_id,
  version_number,
  configuration_snapshot,
  pricing_input_snapshot,
  created_by
) on public.design_project_versions to authenticated;

grant insert (
  order_id,
  author_user_id,
  visibility,
  body,
  action_required,
  action_type
) on public.order_comments to authenticated;

grant insert (
  order_id,
  design_version_id,
  approval_pdf_file_id,
  status,
  requested_by,
  requested_from_user_id,
  requested_from_email,
  expires_at
) on public.approvals to authenticated;
grant update (
  status,
  viewed_at,
  responded_at,
  response_note,
  user_agent_summary
) on public.approvals to authenticated;

grant insert (
  order_id,
  shipment_number,
  carrier,
  tracking_number,
  tracking_url,
  status,
  package_count,
  dispatched_at,
  estimated_delivery_at,
  delivered_at,
  customer_visible_note,
  created_by
) on public.shipments to authenticated;
grant update (
  carrier,
  tracking_number,
  tracking_url,
  status,
  package_count,
  dispatched_at,
  estimated_delivery_at,
  delivered_at,
  customer_visible_note
) on public.shipments to authenticated;

grant update (read_at) on public.notifications to authenticated;

-- Identity and organization policies.

create policy profiles_select_self_or_staff
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.staff_has_permission('view_profiles')
);

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy organizations_select_member_or_staff
on public.organizations
for select
to authenticated
using (
  public.is_organization_member(id)
  or public.staff_has_permission('view_organizations')
);

create policy organizations_update_owner
on public.organizations
for update
to authenticated
using (
  public.has_organization_role(
    id,
    array['owner']::public.organization_role[]
  )
)
with check (
  public.has_organization_role(
    id,
    array['owner']::public.organization_role[]
  )
);

create policy organization_members_select_self_owner_or_staff
on public.organization_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_organization_role(
    organization_id,
    array['owner']::public.organization_role[]
  )
  or public.staff_has_permission('view_organizations')
);

create policy staff_members_select_self_or_admin
on public.staff_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.staff_has_permission('manage_staff')
);

create policy addresses_select_member_or_staff
on public.addresses
for select
to authenticated
using (
  public.is_organization_member(organization_id)
  or public.staff_has_permission('view_organizations')
);

create policy addresses_insert_authorized_customer
on public.addresses
for insert
to authenticated
with check (
  public.has_organization_role(
    organization_id,
    array['owner', 'buyer', 'finance']::public.organization_role[]
  )
);

create policy addresses_update_authorized_customer
on public.addresses
for update
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['owner', 'buyer', 'finance']::public.organization_role[]
  )
)
with check (
  public.has_organization_role(
    organization_id,
    array['owner', 'buyer', 'finance']::public.organization_role[]
  )
);

create policy addresses_delete_owner
on public.addresses
for delete
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['owner']::public.organization_role[]
  )
);

-- Design policies.

create policy design_projects_select_member_or_staff
on public.design_projects
for select
to authenticated
using (
  public.is_organization_member(organization_id)
  or public.staff_has_permission('view_all_orders')
);

create policy design_projects_insert_owner_or_buyer
on public.design_projects
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.has_organization_role(
    organization_id,
    array['owner', 'buyer']::public.organization_role[]
  )
);

create policy design_projects_update_owner_or_buyer
on public.design_projects
for update
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['owner', 'buyer']::public.organization_role[]
  )
)
with check (
  public.has_organization_role(
    organization_id,
    array['owner', 'buyer']::public.organization_role[]
  )
);

create policy design_versions_select_member_or_staff
on public.design_project_versions
for select
to authenticated
using (
  public.user_can_access_design(design_project_id)
);

create policy design_versions_insert_owner_or_buyer
on public.design_project_versions
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.design_projects as design
    where design.id = design_project_id
      and public.has_organization_role(
        design.organization_id,
        array['owner', 'buyer']::public.organization_role[]
      )
  )
);

-- Durable order and customer-visible record policies.

create policy orders_select_member_or_staff
on public.orders
for select
to authenticated
using (public.user_can_access_order(id));

create policy order_items_select_with_order
on public.order_items
for select
to authenticated
using (public.user_can_access_order(order_id));

create policy order_item_sizes_select_with_order
on public.order_item_sizes
for select
to authenticated
using (public.user_can_access_order_item(order_item_id));

create policy payment_attempts_select_authorized_staff
on public.payment_attempts
for select
to authenticated
using (public.staff_has_permission('view_payment_payload'));

create policy payment_events_select_authorized_staff
on public.payment_events
for select
to authenticated
using (public.staff_has_permission('view_payment_payload'));

create policy order_history_select_visible_customer_or_staff
on public.order_status_history
for select
to authenticated
using (
  public.staff_has_permission('view_all_orders')
  or (
    customer_visible
    and public.is_order_organization_member(order_id)
  )
);

create policy order_comments_select_visible_customer_or_staff
on public.order_comments
for select
to authenticated
using (
  public.staff_has_permission('view_internal_notes')
  or (
    visibility = 'customer'
    and public.is_order_organization_member(order_id)
  )
);

create policy order_comments_insert_customer_or_staff
on public.order_comments
for insert
to authenticated
with check (
  author_user_id = auth.uid()
  and (
    (
      visibility = 'customer'
      and public.is_order_organization_member(order_id)
    )
    or (
      visibility = 'customer'
      and public.staff_has_permission('send_customer_update')
    )
    or (
      visibility = 'staff_only'
      and public.staff_has_permission('add_internal_note')
    )
  )
);

create policy order_files_select_visible_customer_or_staff
on public.order_files
for select
to authenticated
using (
  public.staff_has_permission('view_all_orders')
  or (
    visibility in ('customer', 'public')
    and (
      (order_id is not null and public.is_order_organization_member(order_id))
      or (
        design_project_id is not null
        and public.is_design_organization_member(design_project_id)
      )
    )
  )
);

create policy approvals_select_order_member_or_staff
on public.approvals
for select
to authenticated
using (
  public.staff_has_permission('view_all_orders')
  or public.is_order_organization_member(order_id)
);

create policy approvals_insert_authorized_staff
on public.approvals
for insert
to authenticated
with check (
  requested_by = auth.uid()
  and public.staff_has_permission('manage_approvals')
);

create policy approvals_update_responder_or_staff
on public.approvals
for update
to authenticated
using (
  public.staff_has_permission('manage_approvals')
  or (
    public.is_order_organization_member(order_id)
    and (
      requested_from_user_id = auth.uid()
      or exists (
        select 1
        from public.orders as approval_order
        where approval_order.id = order_id
          and public.has_organization_role(
            approval_order.organization_id,
            array['owner', 'approver']::public.organization_role[]
          )
      )
    )
  )
)
with check (
  public.staff_has_permission('manage_approvals')
  or (
    status in ('viewed', 'approved', 'changes_requested')
    and public.is_order_organization_member(order_id)
    and (
      requested_from_user_id = auth.uid()
      or exists (
        select 1
        from public.orders as approval_order
        where approval_order.id = order_id
          and public.has_organization_role(
            approval_order.organization_id,
            array['owner', 'approver']::public.organization_role[]
          )
      )
    )
  )
);

create policy invoices_select_order_member_or_staff
on public.invoices
for select
to authenticated
using (
  public.staff_has_permission('view_all_orders')
  or public.is_order_organization_member(order_id)
);

create policy integration_jobs_select_authorized_staff
on public.integration_jobs
for select
to authenticated
using (public.staff_has_permission('view_jobs'));

create policy shipments_select_order_member_or_staff
on public.shipments
for select
to authenticated
using (public.user_can_access_order(order_id));

create policy shipments_insert_authorized_staff
on public.shipments
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.staff_has_permission('manage_shipments')
);

create policy shipments_update_authorized_staff
on public.shipments
for update
to authenticated
using (public.staff_has_permission('manage_shipments'))
with check (public.staff_has_permission('manage_shipments'));

create policy notifications_select_self
on public.notifications
for select
to authenticated
using (user_id = auth.uid());

create policy notifications_update_read_state_self
on public.notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy audit_logs_select_authorized_staff
on public.audit_logs
for select
to authenticated
using (public.staff_has_permission('view_audit'));

comment on function public.is_organization_member(uuid) is
  'Returns active membership for auth.uid() without exposing membership rows.';
comment on function public.has_organization_role(uuid, public.organization_role[]) is
  'Checks an active auth.uid() membership against a constrained organization-role array.';
comment on function public.current_staff_role() is
  'Returns auth.uid() staff role only when the protected staff row is active.';
comment on function public.staff_has_permission(text) is
  'Central MFA-aware staff permission matrix; unknown permissions fail closed.';
comment on function public.user_can_access_order(uuid) is
  'Combines active tenant membership with MFA-authorized staff order access.';
comment on function public.user_can_access_design(uuid) is
  'Combines active tenant membership with MFA-authorized staff design access.';
