-- Garmops Phase 5: private R2 upload lifecycle, reviewed scan state, and
-- auditable soft deletion. PostgreSQL remains authoritative for access while
-- R2 stores bytes only.

create type public.file_upload_status as enum (
  'pending',
  'finalized',
  'failed',
  'expired'
);

alter table public.order_files
  add column upload_status public.file_upload_status not null default 'finalized',
  add column upload_expires_at timestamptz,
  add column finalized_at timestamptz default now(),
  add column object_etag text
    check (
      object_etag is null
      or (
        object_etag = btrim(object_etag)
        and char_length(object_etag) between 1 and 255
      )
    ),
  add column scan_reviewed_at timestamptz,
  add column scan_reviewed_by uuid references public.profiles(id),
  add column scan_review_note text
    check (
      scan_review_note is null
      or (
        scan_review_note = btrim(scan_review_note)
        and char_length(scan_review_note) between 1 and 500
      )
    );

update public.order_files
set
  upload_status = 'finalized',
  finalized_at = created_at
where upload_status = 'finalized';

alter table public.order_files
  add constraint order_files_upload_lifecycle_valid
  check (
    (
      upload_status = 'pending'
      and upload_expires_at is not null
      and finalized_at is null
    )
    or (
      upload_status = 'finalized'
      and finalized_at is not null
    )
    or upload_status in ('failed', 'expired')
  ),
  add constraint order_files_exactly_one_target
  check ((order_id is null) <> (design_project_id is null)),
  add constraint order_files_review_pair_valid
  check ((scan_reviewed_at is null) = (scan_reviewed_by is null));

create index order_files_pending_upload_expiry_idx
  on public.order_files (upload_expires_at)
  where upload_status = 'pending'
    and deleted_at is null;

create index order_files_scan_review_queue_idx
  on public.order_files (scan_status, created_at)
  where upload_status = 'finalized'
    and scan_status in ('pending', 'manual_review')
    and deleted_at is null;

create function public.create_private_upload_slot(
  p_order_id uuid,
  p_design_project_id uuid,
  p_kind public.file_kind,
  p_visibility public.file_visibility,
  p_original_filename text,
  p_safe_filename text,
  p_content_type text,
  p_byte_size bigint,
  p_extension text,
  p_sha256 text,
  p_expires_at timestamptz
)
returns table (
  file_id uuid,
  object_key text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_file_id uuid := gen_random_uuid();
  v_organization_id uuid;
  v_prefix text;
  v_object_key text;
  v_is_customer boolean := false;
  v_is_staff boolean := false;
  v_max_bytes bigint;
  v_allowed_pair boolean := false;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;
  if (p_order_id is null) = (p_design_project_id is null) then
    raise exception 'exactly one file target is required';
  end if;
  if p_visibility = 'public' then
    raise exception 'private uploads cannot be public';
  end if;
  if p_expires_at <= now() + interval '1 minute'
    or p_expires_at > now() + interval '10 minutes' then
    raise exception 'invalid upload expiry';
  end if;
  if p_sha256 is not null and p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid sha256';
  end if;
  if p_original_filename is null
    or p_original_filename <> btrim(p_original_filename)
    or char_length(p_original_filename) not between 1 and 255
    or p_original_filename ~ '[[:cntrl:]/\\]' then
    raise exception 'invalid original filename';
  end if;
  if p_safe_filename is null
    or p_safe_filename <> btrim(p_safe_filename)
    or char_length(p_safe_filename) not between 1 and 255
    or p_safe_filename ~ '[[:cntrl:]/\\]' then
    raise exception 'invalid safe filename';
  end if;
  if p_extension is null
    or p_extension <> lower(p_extension)
    or p_extension !~ '^[a-z0-9]{2,5}$' then
    raise exception 'invalid file extension';
  end if;

  case p_kind
    when 'customer_artwork' then
      v_max_bytes := 50 * 1024 * 1024;
      v_allowed_pair :=
        (p_extension = 'ai' and p_content_type = 'application/postscript')
        or (p_extension = 'eps' and p_content_type = 'application/postscript')
        or (p_extension = 'pdf' and p_content_type = 'application/pdf')
        or (p_extension = 'svg' and p_content_type = 'image/svg+xml')
        or (p_extension = 'png' and p_content_type = 'image/png')
        or (p_extension in ('jpg', 'jpeg') and p_content_type = 'image/jpeg')
        or (p_extension = 'zip' and p_content_type = 'application/zip');
    when 'purchase_order' then
      v_max_bytes := 15 * 1024 * 1024;
      v_allowed_pair :=
        (p_extension = 'pdf' and p_content_type = 'application/pdf')
        or (p_extension = 'png' and p_content_type = 'image/png')
        or (p_extension in ('jpg', 'jpeg') and p_content_type = 'image/jpeg');
    when 'proof' then
      v_max_bytes := 20 * 1024 * 1024;
      v_allowed_pair :=
        (p_extension = 'pdf' and p_content_type = 'application/pdf')
        or (p_extension = 'png' and p_content_type = 'image/png')
        or (p_extension in ('jpg', 'jpeg') and p_content_type = 'image/jpeg');
    when 'qc_photo' then
      v_max_bytes := 12 * 1024 * 1024;
      v_allowed_pair :=
        (p_extension = 'png' and p_content_type = 'image/png')
        or (p_extension in ('jpg', 'jpeg') and p_content_type = 'image/jpeg')
        or (p_extension = 'webp' and p_content_type = 'image/webp');
    when 'packing_list', 'shipping_label', 'shipment_document' then
      v_max_bytes := 15 * 1024 * 1024;
      v_allowed_pair :=
        (p_extension = 'pdf' and p_content_type = 'application/pdf')
        or (p_extension = 'png' and p_content_type = 'image/png')
        or (p_extension in ('jpg', 'jpeg') and p_content_type = 'image/jpeg');
    else
      raise exception 'file kind cannot use a browser upload slot';
  end case;

  if p_byte_size < 1 or p_byte_size > v_max_bytes or not v_allowed_pair then
    raise exception 'file type or size is not allowed';
  end if;

  if p_order_id is not null then
    select customer_order.organization_id
    into v_organization_id
    from public.orders as customer_order
    where customer_order.id = p_order_id;

    v_is_customer :=
      public.is_order_organization_member(p_order_id)
      and p_kind in ('customer_artwork', 'purchase_order')
      and p_visibility = 'customer';

    v_is_staff := case p_kind
      when 'customer_artwork' then public.staff_has_permission('upload_artwork_proof')
      when 'purchase_order' then public.staff_has_permission('edit_commercial')
      when 'proof' then public.staff_has_permission('upload_artwork_proof')
      when 'qc_photo' then public.staff_has_permission('upload_qc_evidence')
      when 'packing_list' then public.staff_has_permission('manage_shipments')
      when 'shipping_label' then public.staff_has_permission('manage_shipments')
      when 'shipment_document' then public.staff_has_permission('manage_shipments')
      else false
    end;

    v_prefix := case p_kind
      when 'customer_artwork' then 'artwork'
      when 'purchase_order' then 'purchase-orders'
      when 'proof' then 'proofs'
      when 'qc_photo' then 'qc'
      when 'packing_list' then 'shipments'
      when 'shipping_label' then 'shipments'
      when 'shipment_document' then 'shipments'
    end;
    v_object_key := format(
      'orders/%s/%s/%s/original.%s',
      p_order_id,
      v_prefix,
      v_file_id,
      p_extension
    );
  else
    select design.organization_id
    into v_organization_id
    from public.design_projects as design
    where design.id = p_design_project_id;

    v_is_customer :=
      public.is_design_organization_member(p_design_project_id)
      and p_kind = 'customer_artwork'
      and p_visibility = 'customer';
    v_is_staff :=
      p_kind in ('customer_artwork', 'proof')
      and public.staff_has_permission('upload_artwork_proof');

    v_object_key := format(
      'organizations/%s/designs/%s/%s/original.%s',
      v_organization_id,
      p_design_project_id,
      v_file_id,
      p_extension
    );
  end if;

  if v_organization_id is null or (not v_is_customer and not v_is_staff) then
    raise exception 'file target access denied';
  end if;

  insert into public.order_files (
    id,
    order_id,
    design_project_id,
    uploaded_by,
    kind,
    visibility,
    bucket_name,
    object_key,
    original_filename,
    safe_filename,
    content_type,
    byte_size,
    sha256,
    scan_status,
    provider_source,
    upload_status,
    upload_expires_at,
    finalized_at
  )
  values (
    v_file_id,
    p_order_id,
    p_design_project_id,
    v_user_id,
    p_kind,
    p_visibility,
    'garmops-private-orders',
    v_object_key,
    p_original_filename,
    p_safe_filename,
    p_content_type,
    p_byte_size,
    p_sha256,
    'pending',
    'garmops',
    'pending',
    p_expires_at,
    null
  );

  insert into public.audit_logs (
    actor_user_id,
    actor_type,
    action,
    target_type,
    target_id,
    organization_id,
    order_id,
    after_state
  )
  values (
    v_user_id,
    case when public.is_active_staff() then 'staff' else 'customer' end,
    'file.upload_slot_created',
    'order_file',
    v_file_id,
    v_organization_id,
    p_order_id,
    jsonb_build_object(
      'kind', p_kind,
      'visibility', p_visibility,
      'content_type', p_content_type,
      'byte_size', p_byte_size,
      'upload_expires_at', p_expires_at
    )
  );

  return query select v_file_id, v_object_key;
end;
$$;

create function public.finalize_private_upload(
  p_file_id uuid,
  p_actual_byte_size bigint,
  p_actual_content_type text,
  p_object_etag text,
  p_actual_sha256 text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_file public.order_files%rowtype;
  v_organization_id uuid;
begin
  select *
  into v_file
  from public.order_files
  where id = p_file_id
  for update;

  if not found then
    return false;
  end if;
  if v_file.upload_status = 'finalized' then
    return
      v_file.byte_size = p_actual_byte_size
      and v_file.content_type = p_actual_content_type
      and v_file.object_etag = p_object_etag
      and (v_file.sha256 is null or v_file.sha256 = p_actual_sha256);
  end if;
  if v_file.upload_status <> 'pending'
    or v_file.deleted_at is not null
    or v_file.upload_expires_at <= now() then
    return false;
  end if;
  if v_file.byte_size <> p_actual_byte_size
    or v_file.content_type <> p_actual_content_type
    or p_object_etag is null
    or p_object_etag <> btrim(p_object_etag)
    or char_length(p_object_etag) not between 1 and 255
    or (
      v_file.sha256 is not null
      and (p_actual_sha256 is null or v_file.sha256 <> p_actual_sha256)
    )
    or (
      p_actual_sha256 is not null
      and p_actual_sha256 !~ '^[0-9a-f]{64}$'
    ) then
    return false;
  end if;

  update public.order_files
  set
    upload_status = 'finalized',
    finalized_at = now(),
    object_etag = p_object_etag,
    sha256 = coalesce(p_actual_sha256, sha256),
    scan_status = case
      when provider_source in ('zoho', 'system')
        then 'not_required'::public.file_scan_status
      else 'manual_review'::public.file_scan_status
    end
  where id = p_file_id;

  if v_file.order_id is not null then
    select customer_order.organization_id
    into v_organization_id
    from public.orders as customer_order
    where customer_order.id = v_file.order_id;
  else
    select design.organization_id
    into v_organization_id
    from public.design_projects as design
    where design.id = v_file.design_project_id;
  end if;

  insert into public.audit_logs (
    actor_type,
    action,
    target_type,
    target_id,
    organization_id,
    order_id,
    after_state
  )
  values (
    'system',
    'file.upload_finalized',
    'order_file',
    p_file_id,
    v_organization_id,
    v_file.order_id,
    jsonb_build_object(
      'byte_size', p_actual_byte_size,
      'content_type', p_actual_content_type,
      'scan_status', 'manual_review'
    )
  );

  return true;
end;
$$;

create function public.review_file_scan(
  p_file_id uuid,
  p_scan_status public.file_scan_status,
  p_review_note text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_file public.order_files%rowtype;
  v_allowed boolean := false;
  v_organization_id uuid;
begin
  if auth.uid() is null or p_scan_status not in ('clean', 'rejected') then
    return false;
  end if;

  select *
  into v_file
  from public.order_files
  where id = p_file_id
  for update;

  if not found
    or v_file.deleted_at is not null
    or v_file.upload_status <> 'finalized'
    or v_file.scan_status not in ('pending', 'manual_review') then
    return false;
  end if;

  v_allowed := case v_file.kind
    when 'customer_artwork' then public.staff_has_permission('manage_approvals')
    when 'proof' then public.staff_has_permission('manage_approvals')
    when 'approval_pdf' then public.staff_has_permission('manage_approvals')
    when 'purchase_order' then public.staff_has_permission('edit_commercial')
    when 'invoice_pdf' then public.staff_has_permission('view_payment_payload')
    when 'qc_photo' then public.staff_has_permission('upload_qc_evidence')
    when 'packing_list' then public.staff_has_permission('manage_shipments')
    when 'shipping_label' then public.staff_has_permission('manage_shipments')
    when 'shipment_document' then public.staff_has_permission('manage_shipments')
    else false
  end;

  if not v_allowed then
    return false;
  end if;

  update public.order_files
  set
    scan_status = p_scan_status,
    scan_reviewed_at = now(),
    scan_reviewed_by = auth.uid(),
    scan_review_note = nullif(btrim(p_review_note), '')
  where id = p_file_id;

  if v_file.order_id is not null then
    select customer_order.organization_id
    into v_organization_id
    from public.orders as customer_order
    where customer_order.id = v_file.order_id;
  else
    select design.organization_id
    into v_organization_id
    from public.design_projects as design
    where design.id = v_file.design_project_id;
  end if;

  insert into public.audit_logs (
    actor_user_id,
    actor_type,
    action,
    target_type,
    target_id,
    organization_id,
    order_id,
    before_state,
    after_state
  )
  values (
    auth.uid(),
    'staff',
    'file.scan_reviewed',
    'order_file',
    p_file_id,
    v_organization_id,
    v_file.order_id,
    jsonb_build_object('scan_status', v_file.scan_status),
    jsonb_build_object(
      'scan_status', p_scan_status,
      'review_note', nullif(btrim(p_review_note), '')
    )
  );

  return true;
end;
$$;

create function public.soft_delete_file(p_file_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_file public.order_files%rowtype;
  v_customer_allowed boolean := false;
  v_staff_allowed boolean := false;
  v_organization_id uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  select *
  into v_file
  from public.order_files
  where id = p_file_id
  for update;

  if not found or v_file.deleted_at is not null then
    return false;
  end if;
  if exists (
    select 1
    from public.approvals
    where approval_pdf_file_id = p_file_id
  ) or exists (
    select 1
    from public.invoices
    where pdf_file_id = p_file_id
  ) then
    return false;
  end if;

  v_customer_allowed :=
    v_file.uploaded_by = auth.uid()
    and v_file.kind in ('customer_artwork', 'purchase_order')
    and (
      (v_file.order_id is not null and public.is_order_organization_member(v_file.order_id))
      or (
        v_file.design_project_id is not null
        and public.is_design_organization_member(v_file.design_project_id)
      )
    );
  v_staff_allowed :=
    public.staff_has_permission('manage_approvals')
    or public.staff_has_permission('manage_shipments');

  if not v_customer_allowed and not v_staff_allowed then
    return false;
  end if;

  update public.order_files
  set deleted_at = now()
  where id = p_file_id;

  if v_file.order_id is not null then
    select customer_order.organization_id
    into v_organization_id
    from public.orders as customer_order
    where customer_order.id = v_file.order_id;
  else
    select design.organization_id
    into v_organization_id
    from public.design_projects as design
    where design.id = v_file.design_project_id;
  end if;

  insert into public.audit_logs (
    actor_user_id,
    actor_type,
    action,
    target_type,
    target_id,
    organization_id,
    order_id,
    before_state,
    after_state
  )
  values (
    auth.uid(),
    case when public.is_active_staff() then 'staff' else 'customer' end,
    'file.soft_deleted',
    'order_file',
    p_file_id,
    v_organization_id,
    v_file.order_id,
    jsonb_build_object(
      'upload_status', v_file.upload_status,
      'scan_status', v_file.scan_status
    ),
    jsonb_build_object('deleted_at', now())
  );

  return true;
end;
$$;

create function public.expire_private_upload_slots()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.order_files
  set upload_status = 'expired'
  where upload_status = 'pending'
    and upload_expires_at <= now()
    and finalized_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.create_private_upload_slot(
  uuid, uuid, public.file_kind, public.file_visibility, text, text, text,
  bigint, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.finalize_private_upload(
  uuid, bigint, text, text, text
) from public, anon, authenticated;
revoke all on function public.review_file_scan(
  uuid, public.file_scan_status, text
) from public, anon, authenticated;
revoke all on function public.soft_delete_file(uuid)
  from public, anon, authenticated;
revoke all on function public.expire_private_upload_slots()
  from public, anon, authenticated;

grant execute on function public.create_private_upload_slot(
  uuid, uuid, public.file_kind, public.file_visibility, text, text, text,
  bigint, text, text, timestamptz
) to authenticated, service_role;
grant execute on function public.finalize_private_upload(
  uuid, bigint, text, text, text
) to service_role;
grant execute on function public.review_file_scan(
  uuid, public.file_scan_status, text
) to authenticated, service_role;
grant execute on function public.soft_delete_file(uuid)
  to authenticated, service_role;
grant execute on function public.expire_private_upload_slots()
  to service_role;

comment on function public.create_private_upload_slot(
  uuid, uuid, public.file_kind, public.file_visibility, text, text, text,
  bigint, text, text, timestamptz
) is
  'Creates an authorized pending private R2 metadata row and server-derived object key.';
comment on function public.finalize_private_upload(
  uuid, bigint, text, text, text
) is
  'Service-only transition after R2 HEAD verifies the exact uploaded object.';
comment on function public.review_file_scan(
  uuid, public.file_scan_status, text
) is
  'MFA-gated staff malware/manual-review decision with audit evidence.';
comment on function public.soft_delete_file(uuid) is
  'Audited metadata soft deletion; object deletion is deliberately delayed.';
