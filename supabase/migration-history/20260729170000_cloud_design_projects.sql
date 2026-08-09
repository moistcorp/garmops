-- Phase 6: revisioned cloud drafts, immutable design versions, and audited
-- customer design lifecycle operations.

alter table public.design_projects
  add column draft_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(draft_snapshot) = 'object'),
  add column pricing_input_snapshot jsonb
    check (
      pricing_input_snapshot is null
      or jsonb_typeof(pricing_input_snapshot) = 'object'
    ),
  add column draft_revision bigint not null default 1
    check (draft_revision > 0),
  add column client_import_id uuid,
  add column archived_at timestamptz;

update public.design_projects as project
set
  draft_snapshot = version.configuration_snapshot,
  pricing_input_snapshot = version.pricing_input_snapshot
from public.design_project_versions as version
where version.design_project_id = project.id
  and version.version_number = project.current_version;

alter table public.design_projects
  add constraint design_projects_archived_at_check
  check (
    (status = 'archived' and archived_at is not null)
    or (status <> 'archived' and archived_at is null)
  );

create unique index design_projects_org_client_import_uidx
  on public.design_projects (organization_id, client_import_id)
  where client_import_id is not null;

create index design_projects_owner_updated_idx
  on public.design_projects (created_by, updated_at desc);

comment on column public.design_projects.draft_snapshot is
  'Mutable current configurator state. Immutable milestones live in design_project_versions.';
comment on column public.design_projects.draft_revision is
  'Optimistic concurrency token incremented by every successful cloud mutation.';
comment on column public.design_projects.client_import_id is
  'Client-generated UUID that makes browser imports and duplicates replay-safe.';

create function public.create_cloud_design(
  p_organization_id uuid,
  p_title text,
  p_schema_version integer,
  p_configuration_snapshot jsonb,
  p_pricing_input_snapshot jsonb default null,
  p_source text default 'browser_import',
  p_client_import_id uuid default null
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
  v_project public.design_projects%rowtype;
  v_version_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;
  if not public.has_organization_role(
    p_organization_id,
    array['owner', 'buyer']::public.organization_role[]
  ) then
    raise exception 'design write access denied';
  end if;
  if p_title is null
    or p_title <> btrim(p_title)
    or char_length(p_title) not between 1 and 160 then
    raise exception 'invalid design title';
  end if;
  if p_schema_version <> 1 then
    raise exception 'unsupported design schema version';
  end if;
  if p_configuration_snapshot is null
    or jsonb_typeof(p_configuration_snapshot) <> 'object'
    or pg_column_size(p_configuration_snapshot) > 2097152 then
    raise exception 'invalid design snapshot';
  end if;
  if p_pricing_input_snapshot is not null
    and (
      jsonb_typeof(p_pricing_input_snapshot) <> 'object'
      or pg_column_size(p_pricing_input_snapshot) > 262144
    ) then
    raise exception 'invalid pricing snapshot';
  end if;
  if p_source is null
    or p_source <> btrim(p_source)
    or char_length(p_source) not between 1 and 80 then
    raise exception 'invalid design source';
  end if;

  if p_client_import_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(
        p_organization_id::text || ':' || p_client_import_id::text,
        0
      )
    );

    select *
    into v_project
    from public.design_projects
    where organization_id = p_organization_id
      and client_import_id = p_client_import_id;

    if found then
      select version.id
      into v_version_id
      from public.design_project_versions as version
      where version.design_project_id = v_project.id
        and version.version_number = v_project.current_version;

      return query
      select
        v_project.id,
        v_version_id,
        v_project.draft_revision,
        v_project.current_version,
        v_project.last_saved_at,
        false;
      return;
    end if;
  end if;

  insert into public.design_projects (
    organization_id,
    created_by,
    title,
    status,
    schema_version,
    current_version,
    source,
    last_saved_at,
    draft_snapshot,
    pricing_input_snapshot,
    draft_revision,
    client_import_id
  )
  values (
    p_organization_id,
    v_user_id,
    p_title,
    'draft',
    p_schema_version,
    1,
    p_source,
    now(),
    p_configuration_snapshot,
    p_pricing_input_snapshot,
    1,
    p_client_import_id
  )
  returning * into v_project;

  insert into public.design_project_versions (
    design_project_id,
    version_number,
    configuration_snapshot,
    pricing_input_snapshot,
    created_by
  )
  values (
    v_project.id,
    1,
    p_configuration_snapshot,
    p_pricing_input_snapshot,
    v_user_id
  )
  returning id into v_version_id;

  insert into public.audit_logs (
    actor_user_id,
    actor_type,
    action,
    target_type,
    target_id,
    organization_id,
    after_state
  )
  values (
    v_user_id,
    'customer',
    case
      when p_source = 'browser_import' then 'design.imported'
      else 'design.created'
    end,
    'design_project',
    v_project.id,
    p_organization_id,
    jsonb_build_object(
      'schema_version', p_schema_version,
      'version_number', 1,
      'source', p_source
    )
  );

  return query
  select
    v_project.id,
    v_version_id,
    v_project.draft_revision,
    v_project.current_version,
    v_project.last_saved_at,
    true;
end;
$$;

create function public.save_cloud_design_draft(
  p_design_project_id uuid,
  p_expected_revision bigint,
  p_schema_version integer,
  p_configuration_snapshot jsonb,
  p_pricing_input_snapshot jsonb default null,
  p_title text default null
)
returns table (
  saved boolean,
  conflict boolean,
  draft_revision bigint,
  last_saved_at timestamptz,
  configuration_snapshot jsonb,
  pricing_input_snapshot jsonb,
  title text,
  status text,
  current_version integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.design_projects%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;
  if p_expected_revision is null or p_expected_revision <= 0 then
    raise exception 'invalid design revision';
  end if;
  if p_configuration_snapshot is null
    or jsonb_typeof(p_configuration_snapshot) <> 'object'
    or pg_column_size(p_configuration_snapshot) > 2097152 then
    raise exception 'invalid design snapshot';
  end if;
  if p_pricing_input_snapshot is not null
    and (
      jsonb_typeof(p_pricing_input_snapshot) <> 'object'
      or pg_column_size(p_pricing_input_snapshot) > 262144
    ) then
    raise exception 'invalid pricing snapshot';
  end if;
  if p_title is not null
    and (
      p_title <> btrim(p_title)
      or char_length(p_title) not between 1 and 160
    ) then
    raise exception 'invalid design title';
  end if;

  select *
  into v_project
  from public.design_projects
  where id = p_design_project_id
  for update;

  if not found or not public.has_organization_role(
    v_project.organization_id,
    array['owner', 'buyer']::public.organization_role[]
  ) then
    raise exception 'design not found';
  end if;
  if v_project.status <> 'draft' then
    raise exception 'design is not editable';
  end if;
  if p_schema_version <> v_project.schema_version then
    raise exception 'unsupported design schema version';
  end if;

  if v_project.draft_revision <> p_expected_revision then
    return query
    select
      false,
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

  update public.design_projects
  set
    title = coalesce(p_title, v_project.title),
    draft_snapshot = p_configuration_snapshot,
    pricing_input_snapshot = p_pricing_input_snapshot,
    draft_revision = v_project.draft_revision + 1,
    last_saved_at = now()
  where id = v_project.id
  returning * into v_project;

  return query
  select
    true,
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

create function public.create_cloud_design_version(
  p_design_project_id uuid,
  p_expected_revision bigint
)
returns table (
  created boolean,
  conflict boolean,
  design_version_id uuid,
  draft_revision bigint,
  version_number integer,
  last_saved_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.design_projects%rowtype;
  v_version_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;
  if p_expected_revision is null or p_expected_revision <= 0 then
    raise exception 'invalid design revision';
  end if;

  select *
  into v_project
  from public.design_projects
  where id = p_design_project_id
  for update;

  if not found or not public.has_organization_role(
    v_project.organization_id,
    array['owner', 'buyer']::public.organization_role[]
  ) then
    raise exception 'design not found';
  end if;
  if v_project.status <> 'draft' then
    raise exception 'design is not editable';
  end if;

  if v_project.draft_revision <> p_expected_revision then
    return query
    select
      false,
      true,
      null::uuid,
      v_project.draft_revision,
      v_project.current_version,
      v_project.last_saved_at;
    return;
  end if;

  update public.design_projects
  set
    current_version = v_project.current_version + 1,
    draft_revision = v_project.draft_revision + 1,
    last_saved_at = now()
  where id = v_project.id
  returning * into v_project;

  insert into public.design_project_versions (
    design_project_id,
    version_number,
    configuration_snapshot,
    pricing_input_snapshot,
    created_by
  )
  values (
    v_project.id,
    v_project.current_version,
    v_project.draft_snapshot,
    v_project.pricing_input_snapshot,
    v_user_id
  )
  returning id into v_version_id;

  insert into public.audit_logs (
    actor_user_id,
    actor_type,
    action,
    target_type,
    target_id,
    organization_id,
    after_state
  )
  values (
    v_user_id,
    'customer',
    'design.version_created',
    'design_project',
    v_project.id,
    v_project.organization_id,
    jsonb_build_object(
      'design_version_id', v_version_id,
      'version_number', v_project.current_version
    )
  );

  return query
  select
    true,
    false,
    v_version_id,
    v_project.draft_revision,
    v_project.current_version,
    v_project.last_saved_at;
end;
$$;

create function public.duplicate_cloud_design(
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
  if v_user_id is null then
    raise exception 'authentication required';
  end if;
  if p_client_operation_id is null then
    raise exception 'client operation id is required';
  end if;

  select *
  into v_source
  from public.design_projects
  where id = p_design_project_id;

  if not found or not public.has_organization_role(
    v_source.organization_id,
    array['owner', 'buyer']::public.organization_role[]
  ) then
    raise exception 'design not found';
  end if;

  return query
  select *
  from public.create_cloud_design(
    v_source.organization_id,
    p_title,
    v_source.schema_version,
    v_source.draft_snapshot,
    v_source.pricing_input_snapshot,
    'duplicate',
    p_client_operation_id
  );
end;
$$;

create function public.archive_cloud_design(
  p_design_project_id uuid,
  p_expected_revision bigint
)
returns table (
  archived boolean,
  conflict boolean,
  draft_revision bigint,
  archived_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.design_projects%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  select *
  into v_project
  from public.design_projects
  where id = p_design_project_id
  for update;

  if not found or not public.has_organization_role(
    v_project.organization_id,
    array['owner', 'buyer']::public.organization_role[]
  ) then
    raise exception 'design not found';
  end if;
  if v_project.status = 'submitted' then
    raise exception 'submitted design cannot be archived';
  end if;
  if v_project.status = 'archived' then
    return query
    select true, false, v_project.draft_revision, v_project.archived_at;
    return;
  end if;
  if v_project.draft_revision <> p_expected_revision then
    return query
    select false, true, v_project.draft_revision, null::timestamptz;
    return;
  end if;

  update public.design_projects
  set
    status = 'archived',
    archived_at = now(),
    draft_revision = v_project.draft_revision + 1,
    last_saved_at = now()
  where id = v_project.id
  returning * into v_project;

  insert into public.audit_logs (
    actor_user_id,
    actor_type,
    action,
    target_type,
    target_id,
    organization_id,
    after_state
  )
  values (
    v_user_id,
    'customer',
    'design.archived',
    'design_project',
    v_project.id,
    v_project.organization_id,
    jsonb_build_object('draft_revision', v_project.draft_revision)
  );

  return query
  select true, false, v_project.draft_revision, v_project.archived_at;
end;
$$;

revoke insert (
  organization_id,
  created_by,
  title,
  status,
  schema_version,
  current_version,
  source,
  last_saved_at,
  submitted_at,
  draft_snapshot,
  pricing_input_snapshot,
  draft_revision,
  client_import_id,
  archived_at
) on public.design_projects from authenticated;

revoke update (
  title,
  status,
  current_version,
  last_saved_at,
  submitted_at,
  draft_snapshot,
  pricing_input_snapshot,
  draft_revision,
  client_import_id,
  archived_at
) on public.design_projects from authenticated;

revoke insert (
  design_project_id,
  version_number,
  configuration_snapshot,
  pricing_input_snapshot,
  created_by
) on public.design_project_versions from authenticated;

revoke all on function public.create_cloud_design(
  uuid, text, integer, jsonb, jsonb, text, uuid
) from public, anon;
revoke all on function public.save_cloud_design_draft(
  uuid, bigint, integer, jsonb, jsonb, text
) from public, anon;
revoke all on function public.create_cloud_design_version(
  uuid, bigint
) from public, anon;
revoke all on function public.duplicate_cloud_design(
  uuid, text, uuid
) from public, anon;
revoke all on function public.archive_cloud_design(
  uuid, bigint
) from public, anon;

grant execute on function public.create_cloud_design(
  uuid, text, integer, jsonb, jsonb, text, uuid
) to authenticated;
grant execute on function public.save_cloud_design_draft(
  uuid, bigint, integer, jsonb, jsonb, text
) to authenticated;
grant execute on function public.create_cloud_design_version(
  uuid, bigint
) to authenticated;
grant execute on function public.duplicate_cloud_design(
  uuid, text, uuid
) to authenticated;
grant execute on function public.archive_cloud_design(
  uuid, bigint
) to authenticated;

comment on function public.save_cloud_design_draft(
  uuid, bigint, integer, jsonb, jsonb, text
) is 'Optimistic-concurrency draft autosave. A stale revision returns the current cloud draft without overwriting it.';
comment on function public.create_cloud_design_version(
  uuid, bigint
) is 'Atomically freezes the current draft as the next immutable design version.';
