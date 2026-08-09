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
returns table (estimate_id uuid, created boolean, estimate_number text, design_version_id uuid, design_revision bigint, status text, valid_until timestamptz)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_project public.design_projects%rowtype;
  v_existing public.design_estimates%rowtype;
  v_version_id uuid;
  v_number text;
  v_generated_at timestamptz := transaction_timestamp();
begin
  if current_user <> 'service_role' then raise exception using errcode = '42501', message = 'server estimate function only'; end if;
  select * into v_existing from public.design_estimates where organization_id = p_organization_id and client_operation_id = p_client_operation_id;
  if found then
    return query select v_existing.id, false, v_existing.estimate_number, v_existing.design_version_id, v_existing.design_revision, v_existing.status, v_existing.valid_until;
    return;
  end if;
  if p_expected_revision is null or p_expected_revision <= 0 then raise exception using errcode = '22023', message = 'invalid design revision'; end if;
  select * into v_project from public.design_projects where id = p_design_project_id and organization_id = p_organization_id and created_by = p_created_by for update;
  if not found then raise exception using errcode = '42501', message = 'design access denied'; end if;
  if v_project.status <> 'draft' then raise exception using errcode = '22023', message = 'design is not active'; end if;
  if v_project.draft_revision <> p_expected_revision then raise exception using errcode = '40001', message = 'design has newer changes'; end if;
  if p_valid_until <= v_generated_at then raise exception using errcode = '22023', message = 'invalid estimate validity'; end if;
  if p_subtotal_paise < 0 or p_discount_paise < 0 or p_taxable_subtotal_paise < 0 or p_gst_paise < 0 or p_total_paise < 0 or p_reservation_fee_paise < 0 or p_balance_due_paise < 0 then raise exception using errcode = '22023', message = 'invalid estimate amounts'; end if;
  if p_taxable_subtotal_paise <> p_subtotal_paise - p_discount_paise or p_total_paise <> p_taxable_subtotal_paise + p_gst_paise + coalesce(p_shipping_paise, 0) or p_balance_due_paise <> greatest(p_total_paise - p_reservation_fee_paise, 0) then raise exception using errcode = '22023', message = 'estimate amount check failed'; end if;
  if jsonb_typeof(p_pricing_snapshot) <> 'object' or pg_column_size(p_pricing_snapshot) > 524288 then raise exception using errcode = '22023', message = 'invalid estimate snapshot'; end if;
  v_number := format('EST-%s-%s', extract(year from timezone('Asia/Kolkata', v_generated_at))::int, lpad(nextval('public.design_estimate_number_seq')::text, 6, '0'));
  insert into public.design_project_versions (design_project_id, version_number, configuration_snapshot, pricing_input_snapshot, created_by)
  values (v_project.id, v_project.current_version + 1, p_pricing_snapshot -> 'designSnapshot', p_pricing_snapshot, p_created_by)
  returning id into v_version_id;
  update public.design_projects set current_version = current_version + 1 where id = v_project.id;
  update public.design_estimates as estimate set status = 'superseded' where estimate.design_project_id = v_project.id and estimate.status = 'active';
  insert into public.design_estimates (organization_id, created_by, design_project_id, design_version_id, design_revision, estimate_number, pricing_engine_version, pricing_snapshot, subtotal_paise, discount_paise, taxable_subtotal_paise, gst_rate_basis_points, gst_paise, shipping_paise, total_paise, reservation_fee_paise, balance_due_paise, generated_at, valid_until, client_operation_id)
  values (p_organization_id, p_created_by, v_project.id, v_version_id, p_expected_revision, v_number, p_pricing_engine_version, p_pricing_snapshot - 'designSnapshot', p_subtotal_paise, p_discount_paise, p_taxable_subtotal_paise, p_gst_rate_basis_points, p_gst_paise, p_shipping_paise, p_total_paise, p_reservation_fee_paise, p_balance_due_paise, v_generated_at, p_valid_until, p_client_operation_id)
  returning id into v_existing.id;
  insert into public.audit_logs (actor_user_id, actor_type, action, target_type, target_id, organization_id, after_state)
  values (p_created_by, 'customer', 'design.estimate_created', 'design_estimate', v_existing.id, p_organization_id, jsonb_build_object('estimate_number', v_number, 'design_project_id', v_project.id, 'design_version_id', v_version_id));
  return query select v_existing.id, true, v_number, v_version_id, p_expected_revision, 'active'::text, p_valid_until;
end;
$$;
