-- Fix cloud-design RPCs used by configurator checkout.
-- The production schema introduced PL/pgSQL output-column names that collided
-- with unqualified table columns (notably title and draft_revision). The RPC
-- therefore failed while saving a design, before PayU initiation could run.

begin;

create or replace function public.create_cloud_design(
  p_title text,
  p_schema_version integer,
  p_configuration_snapshot jsonb,
  p_pricing_input_snapshot jsonb default null,
  p_source text default 'configurator',
  p_client_import_id text default null
)
returns table(
  design_project_id uuid,
  design_version_id uuid,
  draft_revision integer,
  version_number integer,
  last_saved_at timestamptz,
  created_new boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_project public.design_projects%rowtype;
  v_version uuid;
begin
  if public.current_account_type() <> 'customer' then
    raise exception 'CUSTOMER_ACCESS_REQUIRED';
  end if;

  if p_client_import_id is not null then
    select dp.*
    into v_project
    from public.design_projects as dp
    where dp.created_by = v_user
      and dp.client_import_id = p_client_import_id;

    if found then
      select dpv.id
      into v_version
      from public.design_project_versions as dpv
      where dpv.design_project_id = v_project.id
        and dpv.version_number = v_project.current_version;

      return query
      select
        v_project.id,
        v_version,
        v_project.draft_revision,
        v_project.current_version,
        v_project.last_saved_at,
        false;
      return;
    end if;
  end if;

  insert into public.design_projects as dp(
    created_by,
    title,
    schema_version,
    draft_snapshot,
    pricing_input_snapshot,
    source,
    client_import_id
  )
  values(
    v_user,
    btrim(p_title),
    p_schema_version,
    p_configuration_snapshot,
    p_pricing_input_snapshot,
    btrim(p_source),
    p_client_import_id
  )
  returning dp.* into v_project;

  insert into public.design_project_versions as dpv(
    design_project_id,
    version_number,
    configuration_snapshot,
    pricing_input_snapshot,
    created_by
  )
  values(
    v_project.id,
    1,
    p_configuration_snapshot,
    p_pricing_input_snapshot,
    v_user
  )
  returning dpv.id into v_version;

  return query
  select
    v_project.id,
    v_version,
    v_project.draft_revision,
    v_project.current_version,
    v_project.last_saved_at,
    true;
end;
$$;

create or replace function public.save_cloud_design_draft(
  p_design_project_id uuid,
  p_expected_revision integer,
  p_schema_version integer,
  p_configuration_snapshot jsonb,
  p_pricing_input_snapshot jsonb default null,
  p_title text default null
)
returns table(
  conflict boolean,
  draft_revision integer,
  last_saved_at timestamptz,
  configuration_snapshot jsonb,
  pricing_input_snapshot jsonb,
  title text,
  status text,
  current_version integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.design_projects%rowtype;
begin
  select dp.*
  into v_project
  from public.design_projects as dp
  where dp.id = p_design_project_id
    and dp.created_by = auth.uid()
  for update;

  if not found or v_project.status = 'archived' then
    raise exception 'DESIGN_NOT_FOUND';
  end if;

  if v_project.draft_revision <> p_expected_revision then
    return query
    select
      true,
      v_project.draft_revision,
      v_project.last_saved_at,
      v_project.draft_snapshot,
      v_project.pricing_input_snapshot,
      v_project.title,
      v_project.status,
      v_project.current_version;
    return;
  end if;

  update public.design_projects as dp
  set
    schema_version = p_schema_version,
    draft_snapshot = p_configuration_snapshot,
    pricing_input_snapshot = p_pricing_input_snapshot,
    title = coalesce(nullif(btrim(p_title), ''), v_project.title),
    draft_revision = v_project.draft_revision + 1,
    last_saved_at = now()
  where dp.id = p_design_project_id
  returning dp.* into v_project;

  return query
  select
    false,
    v_project.draft_revision,
    v_project.last_saved_at,
    v_project.draft_snapshot,
    v_project.pricing_input_snapshot,
    v_project.title,
    v_project.status,
    v_project.current_version;
end;
$$;

create or replace function public.create_cloud_design_version(
  p_design_project_id uuid,
  p_expected_revision integer
)
returns table(
  conflict boolean,
  design_version_id uuid,
  version_number integer,
  draft_revision integer,
  last_saved_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.design_projects%rowtype;
  v_id uuid;
begin
  select dp.*
  into v_project
  from public.design_projects as dp
  where dp.id = p_design_project_id
    and dp.created_by = auth.uid()
  for update;

  if not found or v_project.status = 'archived' then
    raise exception 'DESIGN_NOT_FOUND';
  end if;

  if v_project.draft_revision <> p_expected_revision then
    return query
    select
      true,
      null::uuid,
      v_project.current_version,
      v_project.draft_revision,
      v_project.last_saved_at;
    return;
  end if;

  update public.design_projects as dp
  set
    current_version = v_project.current_version + 1,
    last_saved_at = now()
  where dp.id = p_design_project_id
  returning dp.* into v_project;

  insert into public.design_project_versions as dpv(
    design_project_id,
    version_number,
    configuration_snapshot,
    pricing_input_snapshot,
    created_by
  )
  values(
    v_project.id,
    v_project.current_version,
    v_project.draft_snapshot,
    v_project.pricing_input_snapshot,
    auth.uid()
  )
  returning dpv.id into v_id;

  return query
  select
    false,
    v_id,
    v_project.current_version,
    v_project.draft_revision,
    v_project.last_saved_at;
end;
$$;

create or replace function public.duplicate_cloud_design(
  p_design_project_id uuid,
  p_title text,
  p_client_operation_id text
)
returns table(
  design_project_id uuid,
  design_version_id uuid,
  draft_revision integer,
  version_number integer,
  last_saved_at timestamptz,
  created_new boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.design_projects%rowtype;
begin
  select dp.*
  into v_source
  from public.design_projects as dp
  where dp.id = p_design_project_id
    and dp.created_by = auth.uid();

  if not found then
    raise exception 'DESIGN_NOT_FOUND';
  end if;

  return query
  select result.*
  from public.create_cloud_design(
    p_title,
    v_source.schema_version,
    v_source.draft_snapshot,
    v_source.pricing_input_snapshot,
    'duplicate',
    p_client_operation_id
  ) as result;
end;
$$;

create or replace function public.archive_cloud_design(
  p_design_project_id uuid,
  p_expected_revision integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.design_projects as dp
  set
    status = 'archived',
    archived_at = now(),
    draft_revision = dp.draft_revision + 1
  where dp.id = p_design_project_id
    and dp.created_by = auth.uid()
    and dp.draft_revision = p_expected_revision
    and dp.status <> 'archived';

  return found;
end;
$$;

revoke all on function public.create_cloud_design(text, integer, jsonb, jsonb, text, text)
from public, anon;
revoke all on function public.save_cloud_design_draft(uuid, integer, integer, jsonb, jsonb, text)
from public, anon;
revoke all on function public.create_cloud_design_version(uuid, integer)
from public, anon;
revoke all on function public.duplicate_cloud_design(uuid, text, text)
from public, anon;
revoke all on function public.archive_cloud_design(uuid, integer)
from public, anon;

grant execute on function public.create_cloud_design(text, integer, jsonb, jsonb, text, text)
to authenticated, service_role;
grant execute on function public.save_cloud_design_draft(uuid, integer, integer, jsonb, jsonb, text)
to authenticated, service_role;
grant execute on function public.create_cloud_design_version(uuid, integer)
to authenticated, service_role;
grant execute on function public.duplicate_cloud_design(uuid, text, text)
to authenticated, service_role;
grant execute on function public.archive_cloud_design(uuid, integer)
to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
