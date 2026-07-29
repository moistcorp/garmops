create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;

select plan(43);

select has_type('public', 'file_upload_status', 'file upload lifecycle enum exists');
select has_column('public', 'order_files', 'upload_status', 'files record upload state');
select has_column('public', 'order_files', 'upload_expires_at', 'upload slots expire');
select has_column('public', 'order_files', 'finalized_at', 'files record finalization');
select has_column('public', 'order_files', 'object_etag', 'files record the verified object ETag');
select has_column('public', 'order_files', 'scan_reviewed_at', 'files record scan review time');

select ok(
  to_regprocedure(
    'public.create_private_upload_slot(uuid,uuid,public.file_kind,public.file_visibility,text,text,text,bigint,text,text,timestamp with time zone)'
  ) is not null,
  'authorized upload-slot function exists'
);
select ok(
  to_regprocedure(
    'public.finalize_private_upload(uuid,bigint,text,text,text)'
  ) is not null,
  'service-only finalization function exists'
);
select ok(
  to_regprocedure(
    'public.review_file_scan(uuid,public.file_scan_status,text)'
  ) is not null,
  'staff scan-review function exists'
);
select ok(
  to_regprocedure('public.soft_delete_file(uuid)') is not null,
  'audited soft-delete function exists'
);
select ok(
  to_regprocedure('public.expire_private_upload_slots()') is not null,
  'service upload-expiry function exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.create_private_upload_slot(uuid,uuid,public.file_kind,public.file_visibility,text,text,text,bigint,text,text,timestamp with time zone)',
    'EXECUTE'
  ),
  'authenticated users can request an authorized upload slot'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.finalize_private_upload(uuid,bigint,text,text,text)',
    'EXECUTE'
  ),
  'browser sessions cannot claim an object was finalized'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.finalize_private_upload(uuid,bigint,text,text,text)',
    'EXECUTE'
  ),
  'service role can finalize a HEAD-verified object'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.create_private_upload_slot(uuid,uuid,public.file_kind,public.file_visibility,text,text,text,bigint,text,text,timestamp with time zone)',
    'EXECUTE'
  ),
  'anonymous users cannot request upload slots'
);
select ok(
  not has_table_privilege('authenticated', 'public.order_files', 'INSERT'),
  'browser sessions still cannot insert file metadata directly'
);

create temporary table phase5_targets as
select
  (array_agg(id) filter (
    where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ))[1] as alpha_order_id,
  (array_agg(id) filter (
    where organization_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  ))[1] as beta_order_id,
  (
    select id
    from public.design_projects
    where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    limit 1
  ) as alpha_design_id
from public.orders;
grant select on table phase5_targets to authenticated, service_role;

create temporary table phase5_slots (
  file_id uuid not null,
  object_key text not null
);
grant select, insert on table phase5_slots to authenticated, service_role;

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

select lives_ok(
  $$
    insert into phase5_slots
    select *
    from public.create_private_upload_slot(
      (select alpha_order_id from phase5_targets),
      null,
      'customer_artwork',
      'customer',
      'Customer Brand.svg',
      'Customer Brand.svg',
      'image/svg+xml',
      4096,
      'svg',
      repeat('a', 64),
      now() + interval '8 minutes'
    )
  $$,
  'organization customer creates an artwork upload slot'
);
select matches(
  (select object_key from phase5_slots limit 1),
  '^orders/[0-9a-f-]+/artwork/[0-9a-f-]+/original\.svg$',
  'object key is server-generated from identifiers'
);
select ok(
  position(
    'Customer Brand' in (select object_key from phase5_slots limit 1)
  ) = 0,
  'client filename cannot affect the object key'
);
select ok(
  exists (
    select 1
    from public.order_files
    where id = (select file_id from phase5_slots limit 1)
      and bucket_name = 'garmops-private-orders'
      and upload_status = 'pending'
      and finalized_at is null
      and scan_status = 'pending'
      and visibility = 'customer'
  ),
  'slot metadata is pending in the private bucket'
);

select throws_ok(
  $$
    select *
    from public.create_private_upload_slot(
      (select beta_order_id from phase5_targets),
      null,
      'customer_artwork',
      'customer',
      'Cross tenant.svg',
      'Cross tenant.svg',
      'image/svg+xml',
      100,
      'svg',
      null,
      now() + interval '8 minutes'
    )
  $$,
  'P0001',
  'file target access denied',
  'customer cannot create a slot for another organization'
);
select throws_ok(
  $$
    select *
    from public.create_private_upload_slot(
      (select alpha_order_id from phase5_targets),
      null,
      'customer_artwork',
      'customer',
      'Payload.svg',
      'Payload.svg',
      'text/html',
      100,
      'svg',
      null,
      now() + interval '8 minutes'
    )
  $$,
  'P0001',
  'file type or size is not allowed',
  'database rejects a MIME and extension mismatch'
);
select throws_ok(
  $$
    select *
    from public.create_private_upload_slot(
      (select alpha_order_id from phase5_targets),
      null,
      'customer_artwork',
      'customer',
      '../escape.svg',
      'escape.svg',
      'image/svg+xml',
      100,
      'svg',
      null,
      now() + interval '8 minutes'
    )
  $$,
  'P0001',
  'invalid original filename',
  'database rejects path-like filenames'
);
select throws_ok(
  $$
    select *
    from public.create_private_upload_slot(
      (select alpha_order_id from phase5_targets),
      null,
      'customer_artwork',
      'public',
      'Public.svg',
      'Public.svg',
      'image/svg+xml',
      100,
      'svg',
      null,
      now() + interval '8 minutes'
    )
  $$,
  'P0001',
  'private uploads cannot be public',
  'private slot function cannot publish an object'
);
select throws_ok(
  $$
    select *
    from public.create_private_upload_slot(
      (select alpha_order_id from phase5_targets),
      null,
      'customer_artwork',
      'staff_only',
      'Hidden.svg',
      'Hidden.svg',
      'image/svg+xml',
      100,
      'svg',
      null,
      now() + interval '8 minutes'
    )
  $$,
  'P0001',
  'file target access denied',
  'customer cannot create a staff-only file'
);

reset role;
set local role service_role;

select is(
  public.finalize_private_upload(
    (select file_id from phase5_slots limit 1),
    4095,
    'image/svg+xml',
    '"phase5-etag"',
    repeat('a', 64)
  ),
  false,
  'finalization rejects an actual size mismatch'
);
reset role;
select is(
  (
    select upload_status::text
    from public.order_files
    where id = (select file_id from phase5_slots limit 1)
  ),
  'pending',
  'failed verification leaves the slot pending'
);
set local role service_role;
select is(
  public.finalize_private_upload(
    (select file_id from phase5_slots limit 1),
    4096,
    'image/svg+xml',
    '"phase5-etag"',
    repeat('a', 64)
  ),
  true,
  'service finalizes exact object metadata'
);
reset role;
select ok(
  exists (
    select 1
    from public.order_files
    where id = (select file_id from phase5_slots limit 1)
      and upload_status = 'finalized'
      and finalized_at is not null
      and scan_status = 'manual_review'
      and object_etag = '"phase5-etag"'
  ),
  'browser upload enters manual review after finalization'
);
set local role service_role;
select is(
  public.finalize_private_upload(
    (select file_id from phase5_slots limit 1),
    4096,
    'image/svg+xml',
    '"phase5-etag"',
    repeat('a', 64)
  ),
  true,
  'exact finalization retry is idempotent'
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
  public.review_file_scan(
    (select file_id from phase5_slots limit 1),
    'clean',
    'customer cannot self-approve'
  ),
  false,
  'customer cannot mark their own file clean'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '44444444-4444-4444-8444-444444444444',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select is(
  public.review_file_scan(
    (select file_id from phase5_slots limit 1),
    'clean',
    'not enough assurance'
  ),
  false,
  'staff at AAL1 cannot review a file'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal2"}',
  true
);
select is(
  public.review_file_scan(
    (select file_id from phase5_slots limit 1),
    'clean',
    'manually inspected'
  ),
  true,
  'authorized staff at AAL2 can mark the file clean'
);

reset role;
select ok(
  exists (
    select 1
    from public.order_files
    where id = (select file_id from phase5_slots limit 1)
      and scan_status = 'clean'
      and scan_reviewed_by = '44444444-4444-4444-8444-444444444444'
      and scan_reviewed_at is not null
  ),
  'clean decision records its reviewer and time'
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
select is(
  (
    select count(*)
    from public.order_files
    where id = (select file_id from phase5_slots limit 1)
  ),
  0::bigint,
  'another organization cannot read private file metadata'
);
select is(
  public.soft_delete_file((select file_id from phase5_slots limit 1)),
  false,
  'another organization cannot soft-delete the file'
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
  public.soft_delete_file((select file_id from phase5_slots limit 1)),
  true,
  'original customer uploader can soft-delete unreferenced artwork'
);

reset role;
select ok(
  exists (
    select 1
    from public.audit_logs
    where target_id = (select file_id from phase5_slots limit 1)
      and action = 'file.soft_deleted'
  ),
  'soft deletion writes an audit record'
);
select ok(
  exists (
    select 1
    from public.audit_logs
    where target_id = (select file_id from phase5_slots limit 1)
      and action = 'file.scan_reviewed'
  ),
  'scan review writes an audit record'
);

insert into public.order_files (
  id,
  order_id,
  uploaded_by,
  kind,
  visibility,
  bucket_name,
  object_key,
  original_filename,
  safe_filename,
  content_type,
  byte_size,
  scan_status,
  upload_status,
  upload_expires_at,
  finalized_at
)
values (
  'f5000000-0000-4500-8500-000000000001',
  (select alpha_order_id from phase5_targets),
  '11111111-1111-4111-8111-111111111111',
  'purchase_order',
  'customer',
  'garmops-private-orders',
  'phase5/expired/original.pdf',
  'expired.pdf',
  'expired.pdf',
  'application/pdf',
  100,
  'pending',
  'pending',
  now() - interval '1 minute',
  null
);

set local role service_role;
select is(
  public.expire_private_upload_slots(),
  1,
  'service marks abandoned upload slots expired'
);
reset role;
select is(
  (
    select upload_status::text
    from public.order_files
    where id = 'f5000000-0000-4500-8500-000000000001'
  ),
  'expired',
  'expired slot keeps metadata for later cleanup'
);

insert into public.order_files (
  id,
  order_id,
  uploaded_by,
  kind,
  visibility,
  bucket_name,
  object_key,
  original_filename,
  safe_filename,
  content_type,
  byte_size,
  scan_status
)
values (
  'f5000000-0000-4500-8500-000000000002',
  (select alpha_order_id from phase5_targets),
  '11111111-1111-4111-8111-111111111111',
  'other',
  'customer',
  'legacy-files',
  'phase5/legacy.pdf',
  'legacy.pdf',
  'legacy.pdf',
  'application/pdf',
  100,
  'clean'
);
select ok(
  exists (
    select 1
    from public.order_files
    where id = 'f5000000-0000-4500-8500-000000000002'
      and upload_status = 'finalized'
      and finalized_at is not null
  ),
  'pre-Phase-5 inserts remain finalized by default'
);

select lives_ok(
  $$
    insert into public.order_files (
      order_id,
      design_project_id,
      kind,
      visibility,
      bucket_name,
      object_key,
      original_filename,
      safe_filename,
      content_type,
      byte_size
    )
    values (
      (select alpha_order_id from phase5_targets),
      (select alpha_design_id from phase5_targets),
      'other',
      'customer',
      'legacy-files',
      'phase5/two-targets.pdf',
      'two-targets.pdf',
      'two-targets.pdf',
      'application/pdf',
      1
    )
  $$,
  'a finalized design file may also point at its submitted order'
);

select * from finish();
rollback;
