-- Garmops Phase 11: versioned approvals, secure external approval, shipment
-- tracking, QC/document history, notifications, and safe reorder duplication.

alter table public.orders
  add column if not exists source_order_id uuid references public.orders(id);

alter table public.approvals
  add column if not exists snapshot_sha256 text,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references public.profiles(id),
  add column if not exists decision_metadata jsonb;

alter table public.approvals
  drop constraint if exists approvals_snapshot_sha256_check,
  add constraint approvals_snapshot_sha256_check
    check (snapshot_sha256 is null or snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  drop constraint if exists approvals_decision_metadata_object,
  add constraint approvals_decision_metadata_object
    check (decision_metadata is null or jsonb_typeof(decision_metadata) = 'object'),
  drop constraint if exists approvals_revocation_consistent,
  add constraint approvals_revocation_consistent
    check ((revoked_at is null and revoked_by is null) or (revoked_at is not null and revoked_by is not null));

create index if not exists approvals_order_version_created_idx
  on public.approvals(order_id, design_version_id, created_at desc);
create unique index if not exists approvals_one_active_recipient_idx
  on public.approvals(
    order_id, design_version_id,
    coalesce(requested_from_user_id::text, lower(requested_from_email::text))
  )
  where status in ('requested', 'viewed');
create index if not exists orders_source_order_idx
  on public.orders(source_order_id) where source_order_id is not null;

alter table public.shipments
  drop constraint if exists shipments_status_check,
  add constraint shipments_status_check
    check (status in ('preparing','dispatched','in_transit','out_for_delivery','exception','delivered','cancelled'));

create table if not exists public.shipment_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  status text not null check (status in ('preparing','dispatched','in_transit','out_for_delivery','delivered','exception','cancelled')),
  occurred_at timestamptz not null,
  location text check (location is null or char_length(btrim(location)) between 1 and 200),
  customer_message text check (customer_message is null or char_length(btrim(customer_message)) between 1 and 1000),
  internal_note text check (internal_note is null or char_length(btrim(internal_note)) between 1 and 4000),
  source text not null default 'staff' check (source in ('staff','carrier','system')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists shipment_events_shipment_time_idx
  on public.shipment_events(shipment_id, occurred_at desc);

alter table public.shipment_events enable row level security;
alter table public.shipment_events force row level security;

create policy shipment_events_select_staff
on public.shipment_events for select to authenticated
using (public.staff_has_permission('view_all_orders'));

revoke insert, update, delete on public.shipment_events from authenticated;
grant select on public.shipment_events to authenticated;

-- The underlying table contains staff-only internal_note. Customers receive a
-- deliberately reduced projection through this function instead of table SELECT.
create or replace function public.customer_shipment_events(p_order_id uuid)
returns table (
  id uuid,
  shipment_id uuid,
  status text,
  occurred_at timestamptz,
  location text,
  customer_message text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_order_organization_member(p_order_id) then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  return query
  select e.id, e.shipment_id, e.status, e.occurred_at, e.location, e.customer_message
  from public.shipment_events e
  join public.shipments s on s.id=e.shipment_id
  where s.order_id=p_order_id
  order by e.occurred_at asc;
end;
$$;

-- The bearer-token hash and network evidence never need to be exposed through
-- authenticated PostgREST clients, including staff browsers.
revoke select on public.approvals from authenticated;
grant select (
  id, order_id, design_version_id, approval_pdf_file_id, status,
  expires_at, viewed_at, responded_at, response_note, created_at,
  snapshot_sha256, revoked_at
) on public.approvals to authenticated;

create or replace function public.staff_order_approvals(p_order_id uuid)
returns table (
  id uuid,
  design_version_id uuid,
  approval_pdf_file_id uuid,
  status text,
  requested_from_user_id uuid,
  requested_from_email text,
  expires_at timestamptz,
  viewed_at timestamptz,
  responded_at timestamptz,
  response_note text,
  snapshot_sha256 text,
  revoked_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if not public.staff_has_permission('view_all_orders') then
    raise exception 'STAFF_PERMISSION_DENIED';
  end if;
  return query
  select a.id,a.design_version_id,a.approval_pdf_file_id,a.status,
    a.requested_from_user_id,a.requested_from_email::text,a.expires_at,a.viewed_at,
    a.responded_at,a.response_note,a.snapshot_sha256,a.revoked_at,a.created_at
  from public.approvals a
  where a.order_id=p_order_id
  order by a.created_at desc;
end;
$$;

create or replace function public.staff_approval_queue(p_limit integer default 200)
returns table (
  id uuid,
  status text,
  requested_from_email text,
  expires_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz,
  order_number text,
  organization_name text
)
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if not public.staff_has_permission('view_all_orders') then
    raise exception 'STAFF_PERMISSION_DENIED';
  end if;
  return query
  select a.id,case when a.status in ('requested','viewed') and a.expires_at <= now() then 'expired' else a.status end,a.requested_from_email::text,a.expires_at,a.responded_at,
    a.created_at,o.order_number,org.display_name
  from public.approvals a
  join public.orders o on o.id=a.order_id
  join public.organizations org on org.id=o.organization_id
  order by a.created_at desc
  limit least(greatest(coalesce(p_limit,200),1),500);
end;
$$;

create or replace function public.create_private_upload_slot(
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
    when 'approval_pdf' then
      v_max_bytes := 20 * 1024 * 1024;
      v_allowed_pair := (p_extension = 'pdf' and p_content_type = 'application/pdf');
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
      when 'approval_pdf' then public.staff_has_permission('manage_approvals')
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
      when 'approval_pdf' then 'approvals'
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

create or replace function public.staff_create_approval_request(
  p_order_id uuid,
  p_design_version_id uuid,
  p_approval_pdf_file_id uuid,
  p_requested_from_user_id uuid default null,
  p_requested_from_email text default null,
  p_secure_token_hash text default null,
  p_expires_at timestamptz default (now() + interval '7 days')
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_order public.orders%rowtype;
  v_file public.order_files%rowtype;
  v_id uuid;
  v_email extensions.citext := nullif(lower(btrim(p_requested_from_email)), '')::extensions.citext;
  v_snapshot_hash text;
  v_design_version_id uuid;
begin
  if v_actor is null or not public.staff_has_permission('manage_approvals') then
    raise exception 'STAFF_PERMISSION_DENIED';
  end if;
  if (p_requested_from_user_id is null) = (v_email is null) then
    raise exception 'APPROVAL_RECIPIENT_REQUIRED';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '30 days' then
    raise exception 'INVALID_APPROVAL_EXPIRY';
  end if;
  if v_email is not null and (p_secure_token_hash is null or p_secure_token_hash !~ '^[0-9a-f]{64}$') then
    raise exception 'APPROVAL_TOKEN_REQUIRED';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.design_project_id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status not in (
    'commercial_review', 'awaiting_balance_payment', 'artwork_review',
    'awaiting_artwork_approval', 'needs_customer_action'
  ) then
    raise exception 'APPROVAL_STAGE_CLOSED';
  end if;
  v_design_version_id := coalesce(p_design_version_id, v_order.design_version_id);
  if v_design_version_id is null or not exists (
    select 1 from public.design_project_versions v
    where v.id=v_design_version_id and v.design_project_id=v_order.design_project_id
  ) then raise exception 'DESIGN_VERSION_NOT_FOUND'; end if;

  select * into v_file from public.order_files
  where id = p_approval_pdf_file_id and order_id = p_order_id and deleted_at is null;
  if not found or v_file.kind <> 'approval_pdf' or v_file.content_type <> 'application/pdf'
    or v_file.upload_status <> 'finalized' or v_file.scan_status not in ('clean','not_required') or v_file.visibility <> 'customer' then
    raise exception 'APPROVAL_DOCUMENT_NOT_READY';
  end if;
  if p_requested_from_user_id is not null and not exists (
    select 1 from public.organization_members m
    where m.organization_id = v_order.organization_id and m.user_id = p_requested_from_user_id
      and m.status = 'active' and m.role in ('owner','approver')
  ) then raise exception 'APPROVER_NOT_ELIGIBLE'; end if;

  if v_file.sha256 is null or v_file.sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'APPROVAL_DOCUMENT_HASH_REQUIRED';
  end if;
  v_snapshot_hash := v_file.sha256;

  update public.approvals set status='revoked', revoked_at=now(), revoked_by=v_actor
  where order_id=p_order_id and status in ('requested','viewed','approved');
  update public.orders set artwork_approved_at=null, updated_at=now() where id=p_order_id;

  insert into public.approvals(
    order_id, design_version_id, approval_pdf_file_id, status, requested_by,
    requested_from_user_id, requested_from_email, secure_token_hash, expires_at, snapshot_sha256
  ) values (
    p_order_id, v_design_version_id, p_approval_pdf_file_id, 'requested', v_actor,
    p_requested_from_user_id, v_email, p_secure_token_hash, p_expires_at, v_snapshot_hash
  ) returning id into v_id;

  if p_requested_from_user_id is not null then
    insert into public.notifications(user_id, organization_id, order_id, type, title, body, action_url)
    values (p_requested_from_user_id, v_order.organization_id, p_order_id, 'approval_requested',
      'Approval requested for ' || v_order.order_number,
      'Review the immutable artwork approval document and approve it or request changes.',
      '/account/orders/' || v_order.order_number);
  end if;

  insert into public.audit_logs(actor_user_id, actor_type, action, target_type, target_id, organization_id, order_id, after_state)
  values(v_actor,'staff','approval.requested','approval',v_id,v_order.organization_id,p_order_id,
    jsonb_build_object('designVersionId',v_design_version_id,'fileId',p_approval_pdf_file_id,
      'recipientUserId',p_requested_from_user_id,'recipientEmail',v_email,'expiresAt',p_expires_at,
      'snapshotSha256',v_snapshot_hash));
  return v_id;
end;
$$;

create or replace function public.respond_order_approval(
  p_approval_id uuid,
  p_decision text,
  p_response_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_approval public.approvals%rowtype;
  v_order public.orders%rowtype;
  v_status text;
begin
  if v_actor is null or p_decision not in ('approved','changes_requested') then raise exception 'INVALID_APPROVAL_DECISION'; end if;
  select * into v_approval from public.approvals where id=p_approval_id for update;
  if not found then raise exception 'APPROVAL_NOT_FOUND'; end if;
  select * into v_order from public.orders where id=v_approval.order_id;
  if v_approval.status not in ('requested','viewed') or v_approval.expires_at <= now()
    or exists (
      select 1 from public.approvals newer
      where newer.order_id = v_approval.order_id
        and newer.created_at > v_approval.created_at
        and newer.revoked_at is null
    ) then
    raise exception 'APPROVAL_NOT_ACTIVE';
  end if;
  if not (
    v_approval.requested_from_user_id = v_actor
    or exists(select 1 from public.organization_members m where m.organization_id=v_order.organization_id and m.user_id=v_actor and m.status='active' and m.role in ('owner','approver'))
  ) then raise exception 'APPROVAL_ACCESS_DENIED'; end if;

  v_status := p_decision;
  update public.approvals set status=v_status, responded_at=now(), viewed_at=coalesce(viewed_at,now()),
    response_note=nullif(btrim(p_response_note),''), decision_metadata=jsonb_build_object('channel','account','actorUserId',v_actor)
  where id=v_approval.id;
  if v_status='approved' then
    update public.orders set artwork_approved_at=now(), updated_at=now() where id=v_order.id;
  else
    update public.orders
    set artwork_approved_at=null,
        status=case when status='awaiting_artwork_approval' then 'artwork_review'::public.order_status else status end,
        public_status=case when status='awaiting_artwork_approval' then public.order_public_status_for_internal('artwork_review'::public.order_status) else public_status end,
        updated_at=now()
    where id=v_order.id;
    if v_order.status='awaiting_artwork_approval' then
      insert into public.order_status_history(
        order_id,from_status,to_status,public_status,actor_type,actor_user_id,
        customer_visible,customer_message,metadata
      ) values (
        v_order.id,v_order.status,'artwork_review',public.order_public_status_for_internal('artwork_review'::public.order_status),
        'customer',v_actor,true,'Artwork changes were requested.',
        jsonb_build_object('approvalId',v_approval.id,'designVersionId',v_approval.design_version_id)
      );
    end if;
  end if;

  if v_approval.requested_by is not null then
    insert into public.notifications(user_id,organization_id,order_id,type,title,body,action_url)
    values(
      v_approval.requested_by,v_order.organization_id,v_order.id,'approval_recorded',
      'Artwork approval response for '||v_order.order_number,
      case when v_status='approved' then 'The requested artwork version was approved.' else 'Changes were requested for the artwork version.' end,
      '/staff/orders/'||v_order.order_number
    );
  end if;

  insert into public.audit_logs(actor_user_id,actor_type,action,target_type,target_id,organization_id,order_id,before_state,after_state)
  values(v_actor,'customer','approval.'||v_status,'approval',v_approval.id,v_order.organization_id,v_order.id,
    jsonb_build_object('status',v_approval.status),jsonb_build_object('status',v_status,'note',nullif(btrim(p_response_note),''),'snapshotSha256',v_approval.snapshot_sha256));
  return jsonb_build_object('approvalId',v_approval.id,'status',v_status,'orderNumber',v_order.order_number);
end;
$$;

create or replace function public.external_respond_order_approval(
  p_secure_token_hash text,
  p_decision text,
  p_response_note text default null,
  p_ip_hash text default null,
  p_user_agent_summary text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_approval public.approvals%rowtype;
  v_order public.orders%rowtype;
begin
  if p_secure_token_hash !~ '^[0-9a-f]{64}$' or p_decision not in ('approved','changes_requested') then raise exception 'INVALID_APPROVAL_REQUEST'; end if;
  select * into v_approval from public.approvals where secure_token_hash=p_secure_token_hash for update;
  if not found then raise exception 'APPROVAL_NOT_FOUND'; end if;
  select * into v_order from public.orders where id=v_approval.order_id;
  if v_approval.status not in ('requested','viewed') or v_approval.expires_at <= now()
    or exists (
      select 1 from public.approvals newer
      where newer.order_id = v_approval.order_id
        and newer.created_at > v_approval.created_at
        and newer.revoked_at is null
    ) then
    raise exception 'APPROVAL_NOT_ACTIVE';
  end if;
  update public.approvals set status=p_decision, responded_at=now(), viewed_at=coalesce(viewed_at,now()),
    response_note=nullif(btrim(p_response_note),''), ip_hash=p_ip_hash, user_agent_summary=left(nullif(btrim(p_user_agent_summary),''),500),
    decision_metadata=jsonb_build_object('channel','external_link') where id=v_approval.id;
  if p_decision='approved' then
    update public.orders set artwork_approved_at=now(), updated_at=now() where id=v_order.id;
  else
    update public.orders
    set artwork_approved_at=null,
        status=case when status='awaiting_artwork_approval' then 'artwork_review'::public.order_status else status end,
        public_status=case when status='awaiting_artwork_approval' then public.order_public_status_for_internal('artwork_review'::public.order_status) else public_status end,
        updated_at=now()
    where id=v_order.id;
    if v_order.status='awaiting_artwork_approval' then
      insert into public.order_status_history(
        order_id,from_status,to_status,public_status,actor_type,
        customer_visible,customer_message,metadata
      ) values (
        v_order.id,v_order.status,'artwork_review',public.order_public_status_for_internal('artwork_review'::public.order_status),
        'customer',true,'Artwork changes were requested.',
        jsonb_build_object('approvalId',v_approval.id,'designVersionId',v_approval.design_version_id,'channel','external_link')
      );
    end if;
  end if;
  if v_approval.requested_by is not null then
    insert into public.notifications(user_id,organization_id,order_id,type,title,body,action_url)
    values(
      v_approval.requested_by,v_order.organization_id,v_order.id,'approval_recorded',
      'Artwork approval response for '||v_order.order_number,
      case when p_decision='approved' then 'The requested artwork version was approved.' else 'Changes were requested for the artwork version.' end,
      '/staff/orders/'||v_order.order_number
    );
  end if;
  insert into public.audit_logs(actor_type,action,target_type,target_id,organization_id,order_id,before_state,after_state,ip_hash,user_agent_summary)
  values('customer','approval.'||p_decision,'approval',v_approval.id,v_order.organization_id,v_order.id,
    jsonb_build_object('status',v_approval.status),jsonb_build_object('status',p_decision,'snapshotSha256',v_approval.snapshot_sha256),p_ip_hash,left(p_user_agent_summary,500));
  return jsonb_build_object('approvalId',v_approval.id,'status',p_decision,'orderNumber',v_order.order_number,'fileId',v_approval.approval_pdf_file_id);
end;
$$;

create or replace function public.staff_revoke_approval(p_approval_id uuid, p_reason text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_a public.approvals%rowtype; v_org uuid;
begin
 if v_actor is null or not public.staff_has_permission('manage_approvals') then raise exception 'STAFF_PERMISSION_DENIED'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'REASON_REQUIRED'; end if;
 select * into v_a from public.approvals where id=p_approval_id for update;
 if not found or v_a.status not in ('requested','viewed') then return false; end if;
 select organization_id into v_org from public.orders where id=v_a.order_id;
 update public.approvals set status='revoked',revoked_at=now(),revoked_by=v_actor,response_note=btrim(p_reason) where id=v_a.id;
 insert into public.audit_logs(actor_user_id,actor_type,action,target_type,target_id,organization_id,order_id,before_state,after_state)
 values(v_actor,'staff','approval.revoked','approval',v_a.id,v_org,v_a.order_id,jsonb_build_object('status',v_a.status),jsonb_build_object('status','revoked','reason',btrim(p_reason)));
 return true;
end; $$;

create or replace function public.staff_create_shipment(
 p_order_id uuid,p_carrier text,p_tracking_number text,p_tracking_url text,p_package_count integer,
 p_estimated_delivery_at timestamptz,p_customer_visible_note text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_order public.orders%rowtype; v_id uuid; v_num text;
begin
 if v_actor is null or not public.staff_has_permission('manage_shipments') then raise exception 'STAFF_PERMISSION_DENIED'; end if;
 select * into v_order from public.orders where id=p_order_id for update;
 if not found then raise exception 'ORDER_NOT_FOUND'; end if;
 if nullif(btrim(p_carrier),'') is null and nullif(btrim(p_tracking_number),'') is null then raise exception 'CARRIER_OR_TRACKING_REQUIRED'; end if;
 if p_tracking_url is not null and p_tracking_url !~ '^https://' then raise exception 'INVALID_TRACKING_URL'; end if;
 if p_package_count is not null and p_package_count<1 then raise exception 'INVALID_PACKAGE_COUNT'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));
 select format('SHP-%s-%s',replace(v_order.order_number,'GAR-',''),lpad((count(*)+1)::text,2,'0')) into v_num from public.shipments where order_id=p_order_id;
 insert into public.shipments(order_id,shipment_number,carrier,tracking_number,tracking_url,status,package_count,estimated_delivery_at,customer_visible_note,created_by)
 values(p_order_id,v_num,nullif(btrim(p_carrier),''),nullif(btrim(p_tracking_number),''),nullif(btrim(p_tracking_url),''),'preparing',p_package_count,p_estimated_delivery_at,nullif(btrim(p_customer_visible_note),''),v_actor)
 returning id into v_id;
 insert into public.shipment_events(shipment_id,status,occurred_at,customer_message,source,created_by)
 values(v_id,'preparing',now(),nullif(btrim(p_customer_visible_note),''),'staff',v_actor);
 if nullif(btrim(p_customer_visible_note),'') is not null then
  insert into public.notifications(user_id,organization_id,order_id,type,title,body,action_url)
  select m.user_id,v_order.organization_id,v_order.id,'shipment_update','Shipment created for '||v_order.order_number,btrim(p_customer_visible_note),'/account/orders/'||v_order.order_number
  from public.organization_members m where m.organization_id=v_order.organization_id and m.status='active';
 end if;
 insert into public.audit_logs(actor_user_id,actor_type,action,target_type,target_id,organization_id,order_id,after_state)
 values(v_actor,'staff','shipment.created','shipment',v_id,v_order.organization_id,p_order_id,jsonb_build_object('shipmentNumber',v_num,'carrier',p_carrier,'trackingNumber',p_tracking_number));
 return v_id;
end; $$;

create or replace function public.staff_update_shipment(
 p_shipment_id uuid,p_status text,p_carrier text,p_tracking_number text,p_tracking_url text,p_package_count integer,
 p_estimated_delivery_at timestamptz,p_customer_visible_note text,p_event_location text default null,p_internal_note text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_s public.shipments%rowtype; v_order public.orders%rowtype; v_now timestamptz:=now();
begin
 if v_actor is null or not public.staff_has_permission('manage_shipments') then raise exception 'STAFF_PERMISSION_DENIED'; end if;
 if p_status not in ('preparing','dispatched','in_transit','out_for_delivery','exception','delivered','cancelled') then raise exception 'INVALID_SHIPMENT_STATUS'; end if;
 select * into v_s from public.shipments where id=p_shipment_id for update;
 if not found then raise exception 'SHIPMENT_NOT_FOUND'; end if;
 select * into v_order from public.orders where id=v_s.order_id;
 if p_status <> v_s.status and not (
   (v_s.status='preparing' and p_status in ('dispatched','cancelled'))
   or (v_s.status='dispatched' and p_status in ('in_transit','out_for_delivery','exception','delivered','cancelled'))
   or (v_s.status='in_transit' and p_status in ('out_for_delivery','exception','delivered','cancelled'))
   or (v_s.status='out_for_delivery' and p_status in ('exception','delivered','cancelled'))
   or (v_s.status='exception' and p_status in ('in_transit','out_for_delivery','delivered','cancelled'))
 ) then raise exception 'INVALID_SHIPMENT_TRANSITION'; end if;
 if p_tracking_url is not null and p_tracking_url !~ '^https://' then raise exception 'INVALID_TRACKING_URL'; end if;
 if p_status in ('dispatched','in_transit','out_for_delivery','exception','delivered') and nullif(btrim(coalesce(p_tracking_number,v_s.tracking_number)), '') is null and nullif(btrim(coalesce(p_carrier,v_s.carrier)), '') is null then raise exception 'CARRIER_OR_TRACKING_REQUIRED'; end if;
 update public.shipments set status=p_status,carrier=nullif(btrim(p_carrier),''),tracking_number=nullif(btrim(p_tracking_number),''),tracking_url=nullif(btrim(p_tracking_url),''),
  package_count=p_package_count,estimated_delivery_at=p_estimated_delivery_at,customer_visible_note=nullif(btrim(p_customer_visible_note),''),
  dispatched_at=case when p_status in ('dispatched','in_transit','out_for_delivery','exception','delivered') then coalesce(dispatched_at,v_now) else dispatched_at end,
  delivered_at=case when p_status='delivered' then coalesce(delivered_at,v_now) else delivered_at end,updated_at=v_now where id=v_s.id;
 insert into public.shipment_events(shipment_id,status,occurred_at,location,customer_message,internal_note,source,created_by)
 values(v_s.id,p_status,v_now,nullif(btrim(p_event_location),''),nullif(btrim(p_customer_visible_note),''),nullif(btrim(p_internal_note),''),'staff',v_actor);
 if nullif(btrim(p_customer_visible_note),'') is not null then
  insert into public.notifications(user_id,organization_id,order_id,type,title,body,action_url)
  select m.user_id,v_order.organization_id,v_order.id,'shipment_update','Shipment update for '||v_order.order_number,btrim(p_customer_visible_note),'/account/orders/'||v_order.order_number
  from public.organization_members m where m.organization_id=v_order.organization_id and m.status='active';
 end if;
 insert into public.audit_logs(actor_user_id,actor_type,action,target_type,target_id,organization_id,order_id,before_state,after_state)
 values(v_actor,'staff','shipment.updated','shipment',v_s.id,v_order.organization_id,v_order.id,
  jsonb_build_object('status',v_s.status,'carrier',v_s.carrier,'trackingNumber',v_s.tracking_number),
  jsonb_build_object('status',p_status,'carrier',p_carrier,'trackingNumber',p_tracking_number,'location',p_event_location));
 return jsonb_build_object('shipmentId',v_s.id,'status',p_status,'orderNumber',v_order.order_number);
end; $$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns boolean language sql security definer set search_path='' as $$
 update public.notifications set read_at=coalesce(read_at,now()) where id=p_notification_id and user_id=auth.uid() returning true;
$$;
create or replace function public.mark_all_notifications_read()
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer; begin
 update public.notifications set read_at=coalesce(read_at,now()) where user_id=auth.uid() and read_at is null;
 get diagnostics v_count=row_count; return v_count; end; $$;

create or replace function public.submit_reorder_order(
  p_idempotency_key text,p_request_hash text,p_source_order_id uuid,p_organization_id uuid,p_customer_user_id uuid,
  p_subtotal_paise bigint,p_shipping_paise bigint,p_tax_estimate_paise bigint,p_reservation_amount_paise bigint,
  p_pricing_version text,p_configuration_schema_version integer,p_billing_snapshot jsonb,p_shipping_snapshot jsonb,
  p_customer_snapshot jsonb,p_company_snapshot jsonb,p_terms_snapshot jsonb,p_items jsonb,p_design_project_id uuid,
  p_design_version_id uuid,p_customer_reference text default null,p_po_number text default null,p_requested_delivery_date date default null,
  p_expires_at timestamptz default (now()+interval '24 hours')
) returns table(order_id uuid,order_number text,payment_attempt_id uuid,submitted_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_source public.orders%rowtype; v_submission record;
begin
 select * into v_source from public.orders where id=p_source_order_id and organization_id=p_organization_id;
 if not found or v_source.customer_user_id is null then raise exception 'SOURCE_ORDER_NOT_FOUND'; end if;
 if v_source.status <> 'delivered' or v_source.order_type not in ('custom_bulk','reorder') then raise exception 'SOURCE_ORDER_NOT_REORDERABLE'; end if;
 if not exists (
   select 1 from public.design_projects dp
   join public.design_project_versions dv on dv.design_project_id=dp.id
   where dp.id=p_design_project_id and dp.organization_id=p_organization_id
     and dp.created_by=p_customer_user_id and dv.id=p_design_version_id
 ) then raise exception 'REORDER_DESIGN_INVALID'; end if;
 if not exists(select 1 from public.organization_members m where m.organization_id=p_organization_id and m.user_id=p_customer_user_id and m.status='active' and m.role in ('owner','buyer')) then raise exception 'ACTIVE_BUYER_REQUIRED'; end if;
 if p_terms_snapshot->'accepted' <> 'true'::jsonb then raise exception 'TERMS_REQUIRED'; end if;
 select * into v_submission from public.submit_order(
   p_idempotency_key=>p_idempotency_key,p_request_hash=>p_request_hash,p_order_type=>'reorder'::public.order_type,
   p_organization_id=>p_organization_id,p_customer_user_id=>p_customer_user_id,p_subtotal_paise=>p_subtotal_paise,
   p_shipping_paise=>p_shipping_paise,p_tax_estimate_paise=>p_tax_estimate_paise,p_reservation_amount_paise=>p_reservation_amount_paise,
   p_pricing_version=>p_pricing_version,p_configuration_schema_version=>p_configuration_schema_version,p_billing_snapshot=>p_billing_snapshot,
   p_shipping_snapshot=>p_shipping_snapshot,p_customer_snapshot=>p_customer_snapshot,p_company_snapshot=>p_company_snapshot,p_terms_snapshot=>p_terms_snapshot,
   p_items=>p_items,p_design_project_id=>p_design_project_id,p_design_version_id=>p_design_version_id,p_customer_reference=>p_customer_reference,
   p_po_number=>p_po_number,p_requested_delivery_date=>p_requested_delivery_date,p_expires_at=>p_expires_at
 );
 update public.orders set source_order_id=p_source_order_id where id=v_submission.order_id;
 update public.design_projects set status='submitted',submitted_at=v_submission.submitted_at where id=p_design_project_id;
 insert into public.audit_logs(actor_user_id,actor_type,action,target_type,target_id,organization_id,order_id,after_state)
 values(p_customer_user_id,'customer','order.reordered','order',v_submission.order_id,p_organization_id,v_submission.order_id,
 jsonb_build_object('sourceOrderId',p_source_order_id,'sourceOrderNumber',v_source.order_number,'newOrderNumber',v_submission.order_number,'designProjectId',p_design_project_id));
 return query select v_submission.order_id::uuid,v_submission.order_number::text,v_submission.payment_attempt_id::uuid,v_submission.submitted_at::timestamptz;
end; $$;


create or replace function public.phase11_order_transition_guards()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.source_order_id is distinct from old.source_order_id and old.source_order_id is not null then
    raise exception using errcode='23514', message='SOURCE_ORDER_IMMUTABLE';
  end if;

  if new.status is distinct from old.status then
    if new.status='awaiting_artwork_approval' and not exists (
      select 1
      from public.approvals approval
      where approval.order_id=new.id
        and approval.revoked_at is null
        and approval.status in ('requested','viewed')
        and approval.expires_at > now()
    ) then
      raise exception using errcode='23514', message='ACTIVE_APPROVAL_REQUIRED';
    end if;

    if new.status='approved_for_production' and not exists (
      select 1
      from public.approvals approval
      where approval.order_id=new.id
        and approval.revoked_at is null
        and approval.status='approved'
        and approval.responded_at is not null
    ) then
      raise exception using errcode='23514', message='LATEST_APPROVAL_REQUIRED';
    end if;

    if new.status='dispatched' and not exists(
      select 1 from public.shipments s
      where s.order_id=new.id
        and s.status in ('dispatched','in_transit','out_for_delivery','exception','delivered')
        and (s.tracking_number is not null or s.carrier is not null)
    ) then
      raise exception using errcode='23514', message='DISPATCHED_SHIPMENT_REQUIRED';
    end if;

    if new.status='delivered' and (
      not exists(
        select 1 from public.shipments s
        where s.order_id=new.id and s.status <> 'cancelled'
      )
      or exists(
        select 1 from public.shipments s
        where s.order_id=new.id and s.status <> 'cancelled'
          and (s.status <> 'delivered' or s.delivered_at is null)
      )
    ) then
      raise exception using errcode='23514', message='ALL_SHIPMENTS_DELIVERED_REQUIRED';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists phase11_order_transition_guards on public.orders;
create trigger phase11_order_transition_guards before update of status, source_order_id on public.orders
for each row execute function public.phase11_order_transition_guards();

revoke all on function public.customer_shipment_events(uuid) from public;
revoke all on function public.staff_order_approvals(uuid) from public;
revoke all on function public.staff_approval_queue(integer) from public;
revoke all on function public.staff_create_approval_request(uuid,uuid,uuid,uuid,text,text,timestamptz) from public;
revoke all on function public.respond_order_approval(uuid,text,text) from public;
revoke all on function public.external_respond_order_approval(text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.staff_revoke_approval(uuid,text) from public;
revoke all on function public.staff_create_shipment(uuid,text,text,text,integer,timestamptz,text) from public;
revoke all on function public.staff_update_shipment(uuid,text,text,text,text,integer,timestamptz,text,text,text) from public;
revoke all on function public.mark_notification_read(uuid) from public;
revoke all on function public.mark_all_notifications_read() from public;
revoke all on function public.submit_reorder_order(text,text,uuid,uuid,uuid,bigint,bigint,bigint,bigint,text,integer,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,uuid,uuid,text,text,date,timestamptz) from public;

grant execute on function public.customer_shipment_events(uuid) to authenticated;
grant execute on function public.staff_order_approvals(uuid) to authenticated;
grant execute on function public.staff_approval_queue(integer) to authenticated;
grant execute on function public.staff_create_approval_request(uuid,uuid,uuid,uuid,text,text,timestamptz) to authenticated;
grant execute on function public.respond_order_approval(uuid,text,text) to authenticated;
grant execute on function public.external_respond_order_approval(text,text,text,text,text) to service_role;
grant execute on function public.staff_revoke_approval(uuid,text) to authenticated;
grant execute on function public.staff_create_shipment(uuid,text,text,text,integer,timestamptz,text) to authenticated;
grant execute on function public.staff_update_shipment(uuid,text,text,text,text,integer,timestamptz,text,text,text) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.submit_reorder_order(text,text,uuid,uuid,uuid,bigint,bigint,bigint,bigint,text,integer,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,uuid,uuid,text,text,date,timestamptz) to service_role;
