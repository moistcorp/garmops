create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;

select plan(47);

select has_column('public', 'design_projects', 'draft_snapshot', 'cloud draft snapshot exists');
select has_column('public', 'design_projects', 'pricing_input_snapshot', 'cloud pricing input exists');
select has_column('public', 'design_projects', 'draft_revision', 'optimistic revision exists');
select has_column('public', 'design_projects', 'client_import_id', 'replay-safe import ID exists');
select has_column('public', 'design_projects', 'archived_at', 'soft archive timestamp exists');

select ok(
  to_regprocedure(
    'public.create_cloud_design(uuid,text,integer,jsonb,jsonb,text,uuid)'
  ) is not null,
  'cloud design creation function exists'
);
select ok(
  to_regprocedure(
    'public.save_cloud_design_draft(uuid,bigint,integer,jsonb,jsonb,text)'
  ) is not null,
  'revisioned draft save function exists'
);
select ok(
  to_regprocedure(
    'public.create_cloud_design_version(uuid,bigint)'
  ) is not null,
  'immutable version creation function exists'
);
select ok(
  to_regprocedure(
    'public.duplicate_cloud_design(uuid,text,uuid)'
  ) is not null,
  'replay-safe duplicate function exists'
);
select ok(
  to_regprocedure(
    'public.archive_cloud_design(uuid,bigint)'
  ) is not null,
  'soft archive function exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.create_cloud_design(uuid,text,integer,jsonb,jsonb,text,uuid)',
    'EXECUTE'
  ),
  'authenticated users can invoke reviewed design creation'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.save_cloud_design_draft(uuid,bigint,integer,jsonb,jsonb,text)',
    'EXECUTE'
  ),
  'authenticated users can invoke reviewed draft save'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.create_cloud_design_version(uuid,bigint)',
    'EXECUTE'
  ),
  'authenticated users can freeze a version'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.duplicate_cloud_design(uuid,text,uuid)',
    'EXECUTE'
  ),
  'authenticated users can duplicate a design'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.archive_cloud_design(uuid,bigint)',
    'EXECUTE'
  ),
  'authenticated users can archive a design'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.create_cloud_design(uuid,text,integer,jsonb,jsonb,text,uuid)',
    'EXECUTE'
  ),
  'anonymous users cannot create cloud designs'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.save_cloud_design_draft(uuid,bigint,integer,jsonb,jsonb,text)',
    'EXECUTE'
  ),
  'anonymous users cannot save cloud drafts'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.create_cloud_design_version(uuid,bigint)',
    'EXECUTE'
  ),
  'anonymous users cannot freeze versions'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.duplicate_cloud_design(uuid,text,uuid)',
    'EXECUTE'
  ),
  'anonymous users cannot duplicate designs'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.archive_cloud_design(uuid,bigint)',
    'EXECUTE'
  ),
  'anonymous users cannot archive designs'
);

select ok(
  not has_table_privilege('authenticated', 'public.design_projects', 'INSERT'),
  'browser sessions cannot insert design projects directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.design_projects', 'UPDATE'),
  'browser sessions cannot bypass optimistic draft saves'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.design_project_versions',
    'INSERT'
  ),
  'browser sessions cannot choose immutable version numbers directly'
);

select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;

select is(
  (
    select created_new
    from public.create_cloud_design(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Phase 6 imported design',
      1,
      jsonb_build_object(
        'schemaVersion', 1,
        'kind', 'configurator_build',
        'configId', 'regular-fit-tee-200gsm',
        'savedAt', '2026-07-29T12:00:00.000Z',
        'configuration', jsonb_build_object('quantity', 50)
      ),
      jsonb_build_object('quantity', 50),
      'browser_import',
      '60000000-0000-4000-8000-000000000001'
    )
  ),
  true,
  'owner imports a cloud design'
);

reset role;
select ok(
  exists (
    select 1
    from public.design_projects
    where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and client_import_id = '60000000-0000-4000-8000-000000000001'
      and draft_revision = 1
      and current_version = 1
      and status = 'draft'
  ),
  'import creates a revisioned draft project'
);
select ok(
  exists (
    select 1
    from public.design_project_versions as version
    join public.design_projects as project
      on project.id = version.design_project_id
    where project.client_import_id = '60000000-0000-4000-8000-000000000001'
      and version.version_number = 1
  ),
  'import freezes initial immutable version one'
);
select ok(
  exists (
    select 1
    from public.audit_logs
    where action = 'design.imported'
      and target_id = (
        select id
        from public.design_projects
        where client_import_id = '60000000-0000-4000-8000-000000000001'
      )
  ),
  'browser import is audited'
);

set local role authenticated;
select is(
  (
    select created_new
    from public.create_cloud_design(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Phase 6 imported design',
      1,
      jsonb_build_object(
        'schemaVersion', 1,
        'kind', 'configurator_build',
        'configId', 'regular-fit-tee-200gsm',
        'savedAt', '2026-07-29T12:00:00.000Z',
        'configuration', jsonb_build_object('quantity', 50)
      ),
      jsonb_build_object('quantity', 50),
      'browser_import',
      '60000000-0000-4000-8000-000000000001'
    )
  ),
  false,
  'replayed browser import returns the existing project'
);
reset role;
select is(
  (
    select count(*)
    from public.design_projects
    where client_import_id = '60000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'replayed import cannot create a duplicate row'
);

set local role authenticated;
select is(
  (
    select saved
    from public.save_cloud_design_draft(
      (
        select id
        from public.design_projects
        where client_import_id = '60000000-0000-4000-8000-000000000001'
      ),
      1,
      1,
      jsonb_build_object(
        'schemaVersion', 1,
        'kind', 'configurator_build',
        'configId', 'regular-fit-tee-200gsm',
        'savedAt', '2026-07-29T12:05:00.000Z',
        'configuration', jsonb_build_object('quantity', 75)
      ),
      jsonb_build_object('quantity', 75),
      null
    )
  ),
  true,
  'matching revision saves the mutable draft'
);
reset role;
select ok(
  exists (
    select 1
    from public.design_projects
    where client_import_id = '60000000-0000-4000-8000-000000000001'
      and draft_revision = 2
      and draft_snapshot #>> '{configuration,quantity}' = '75'
  ),
  'successful autosave increments revision and stores the new draft'
);

set local role authenticated;
select is(
  (
    select conflict
    from public.save_cloud_design_draft(
      (
        select id
        from public.design_projects
        where client_import_id = '60000000-0000-4000-8000-000000000001'
      ),
      1,
      1,
      jsonb_build_object(
        'schemaVersion', 1,
        'kind', 'configurator_build',
        'configId', 'regular-fit-tee-200gsm',
        'savedAt', '2026-07-29T12:03:00.000Z',
        'configuration', jsonb_build_object('quantity', 60)
      ),
      jsonb_build_object('quantity', 60),
      null
    )
  ),
  true,
  'stale autosave returns an explicit conflict'
);
reset role;
select is(
  (
    select draft_snapshot #>> '{configuration,quantity}'
    from public.design_projects
    where client_import_id = '60000000-0000-4000-8000-000000000001'
  ),
  '75',
  'stale autosave cannot overwrite the newer cloud draft'
);

set local role authenticated;
select is(
  (
    select created
    from public.create_cloud_design_version(
      (
        select id
        from public.design_projects
        where client_import_id = '60000000-0000-4000-8000-000000000001'
      ),
      2
    )
  ),
  true,
  'matching revision freezes the next design version'
);
reset role;
select ok(
  exists (
    select 1
    from public.design_project_versions as version
    join public.design_projects as project
      on project.id = version.design_project_id
    where project.client_import_id = '60000000-0000-4000-8000-000000000001'
      and version.version_number = 2
      and version.configuration_snapshot
        #>> '{configuration,quantity}' = '75'
      and project.draft_revision = 3
  ),
  'version creation freezes the exact current draft and advances revision'
);
select throws_ok(
  $$
    update public.design_project_versions
    set configuration_snapshot = '{}'::jsonb
    where design_project_id = (
      select id
      from public.design_projects
      where client_import_id = '60000000-0000-4000-8000-000000000001'
    )
      and version_number = 2
  $$,
  '55000',
  'design_project_versions is append-only',
  'frozen design versions cannot be updated'
);

select set_config(
  'request.jwt.claim.sub',
  '33333333-3333-4333-8333-333333333333',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select throws_ok(
  $$
    select *
    from public.save_cloud_design_draft(
      (
        select id
        from public.design_projects
        where client_import_id = '60000000-0000-4000-8000-000000000001'
      ),
      3,
      1,
      '{"schemaVersion":1}'::jsonb,
      null,
      null
    )
  $$,
  'P0001',
  'design not found',
  'another organization cannot save the design'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select is(
  (
    select created_new
    from public.duplicate_cloud_design(
      (
        select id
        from public.design_projects
        where client_import_id = '60000000-0000-4000-8000-000000000001'
      ),
      'Phase 6 imported design copy',
      '60000000-0000-4000-8000-000000000002'
    )
  ),
  true,
  'owner duplicates a design as an independent project'
);
select is(
  (
    select created_new
    from public.duplicate_cloud_design(
      (
        select id
        from public.design_projects
        where client_import_id = '60000000-0000-4000-8000-000000000001'
      ),
      'Phase 6 imported design copy',
      '60000000-0000-4000-8000-000000000002'
    )
  ),
  false,
  'replayed duplicate operation returns the existing copy'
);
reset role;
select is(
  (
    select count(*)
    from public.design_projects
    where client_import_id = '60000000-0000-4000-8000-000000000002'
  ),
  1::bigint,
  'replayed duplicate operation remains single-row'
);

set local role authenticated;
select is(
  (
    select conflict
    from public.archive_cloud_design(
      (
        select id
        from public.design_projects
        where client_import_id = '60000000-0000-4000-8000-000000000001'
      ),
      2
    )
  ),
  true,
  'stale revision cannot archive a design'
);
select is(
  (
    select archived
    from public.archive_cloud_design(
      (
        select id
        from public.design_projects
        where client_import_id = '60000000-0000-4000-8000-000000000001'
      ),
      3
    )
  ),
  true,
  'matching revision archives the design'
);
reset role;
select ok(
  exists (
    select 1
    from public.design_projects
    where client_import_id = '60000000-0000-4000-8000-000000000001'
      and status = 'archived'
      and archived_at is not null
      and draft_revision = 4
  ),
  'archive is soft, timestamped, and revisioned'
);

set local role authenticated;
select throws_ok(
  $$
    select *
    from public.save_cloud_design_draft(
      (
        select id
        from public.design_projects
        where client_import_id = '60000000-0000-4000-8000-000000000001'
      ),
      4,
      1,
      '{"schemaVersion":1}'::jsonb,
      null,
      null
    )
  $$,
  'P0001',
  'design is not editable',
  'archived design cannot be edited'
);
reset role;

select ok(
  (
    select count(*) >= 3
    from public.audit_logs
    where target_id = (
      select id
      from public.design_projects
      where client_import_id = '60000000-0000-4000-8000-000000000001'
    )
      and action in (
        'design.imported',
        'design.version_created',
        'design.archived'
      )
  ),
  'sensitive design lifecycle operations are audited'
);
select ok(
  exists (
    select 1
    from public.orders as customer_order
    join public.design_project_versions as version
      on version.id = customer_order.design_version_id
    where customer_order.design_project_id =
      'd1111111-1111-4111-8111-111111111111'
      and version.version_number = 1
      and version.configuration_snapshot
        #>> '{product_slug}' = 'regular-fit-tee-200gsm'
  ),
  'existing orders still reference their exact immutable design version'
);
select throws_ok(
  $$
    update public.design_project_versions
    set pricing_input_snapshot = '{"quantity":999}'::jsonb
    where id = 'd2111111-1111-4211-8211-111111111111'
  $$,
  '55000',
  'design_project_versions is append-only',
  'later design work cannot mutate the version used by a submitted order'
);

select * from finish();
rollback;
