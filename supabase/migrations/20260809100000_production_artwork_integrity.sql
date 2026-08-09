-- Production configuration integrity, artwork revisions, and expiring private uploads.
-- All workflow mutations remain database-authoritative and transactional.

begin;

alter table public.order_files
  drop constraint if exists order_files_upload_status_check;
alter table public.order_files
  add constraint order_files_upload_status_check
  check (upload_status in ('pending','finalized','failed','expired'));
alter table public.order_files
  add column if not exists object_cleanup_attempted_at timestamptz,
  add column if not exists object_cleanup_completed_at timestamptz;

create index if not exists order_files_expired_cleanup_idx
on public.order_files(upload_expires_at, created_at)
where upload_status in ('pending','expired') and object_cleanup_completed_at is null;

alter table public.order_artwork_requirements
  add column if not exists id uuid not null default gen_random_uuid(),
  add column if not exists order_item_id uuid references public.order_items(id) on delete restrict,
  add column if not exists requirement_key text,
  add column if not exists revision integer,
  add column if not exists is_active boolean,
  add column if not exists superseded_at timestamptz,
  add column if not exists superseded_by_requirement_id uuid,
  add column if not exists created_by uuid references public.profiles(id);

alter table public.order_artwork_requirements
  drop constraint if exists order_artwork_requirements_pkey;
alter table public.order_artwork_requirements
  add constraint order_artwork_requirements_pkey primary key (id);

-- The immutable paid order-item snapshots identify the real artwork slots.
-- Flat ledger rows that cannot be tied to a paid slot remain as inactive audit
-- history and therefore cannot become arbitrary production requirements.
delete from public.order_artwork_requirements;

with expected as (
  select distinct
    oi.order_id,
    oi.id as order_item_id,
    'item:' || oi.id::text || ':' || candidate.slot as requirement_key,
    candidate.file_id_text::uuid as file_id
  from public.order_items oi
  cross join lateral (
    values
      ('front', oi.artwork_snapshot #>> '{front,fileId}'),
      ('back', oi.artwork_snapshot #>> '{back,fileId}'),
      ('neck_label', oi.neck_label_snapshot ->> 'fileId')
  ) as candidate(slot, file_id_text)
  where candidate.file_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
)
insert into public.order_artwork_requirements(
  order_id, order_item_id, requirement_key, file_id, revision, is_active,
  captured_at, created_by
)
select e.order_id, e.order_item_id, e.requirement_key, e.file_id, 1, true,
       coalesce(f.finalized_at, f.created_at), f.uploaded_by
from expected e
join public.order_files f on f.id = e.file_id and f.order_id = e.order_id;

insert into public.order_artwork_requirements(
  order_id, order_item_id, requirement_key, file_id, revision, is_active,
  captured_at, created_by, superseded_at
)
select f.order_id, null, 'legacy:' || f.id::text, f.id, 1, false,
       coalesce(f.finalized_at, f.created_at), f.uploaded_by, now()
from public.order_files f
where f.kind = 'customer_artwork'
  and f.order_id is not null
  and not exists (
    select 1 from public.order_artwork_requirements r where r.file_id = f.id
  );

alter table public.order_artwork_requirements
  alter column requirement_key set not null,
  alter column revision set not null,
  alter column is_active set not null,
  alter column is_active set default true,
  alter column created_by set not null;
alter table public.order_artwork_requirements
  add constraint order_artwork_requirements_revision_positive check (revision > 0),
  add constraint order_artwork_requirements_key_not_blank check (btrim(requirement_key) <> ''),
  add constraint order_artwork_requirements_superseded_state check (
    (is_active and superseded_at is null and superseded_by_requirement_id is null)
    or (not is_active and superseded_at is not null)
  ),
  add constraint order_artwork_requirements_superseded_by_fkey
    foreign key (superseded_by_requirement_id)
    references public.order_artwork_requirements(id) on delete restrict;

create unique index order_artwork_requirement_revision_uidx
on public.order_artwork_requirements(order_id, requirement_key, revision);
create unique index order_artwork_requirement_one_active_uidx
on public.order_artwork_requirements(order_id, requirement_key)
where is_active;
create index order_artwork_requirement_active_lookup_idx
on public.order_artwork_requirements(order_id, order_item_id, requirement_key)
where is_active;
create index order_artwork_requirement_file_idx
on public.order_artwork_requirements(file_id);

drop policy if exists order_artwork_requirements_staff_select
on public.order_artwork_requirements;
create policy order_artwork_requirements_staff_select
on public.order_artwork_requirements
for select to authenticated
using (public.is_active_staff(true));
grant select on public.order_artwork_requirements to authenticated;

create or replace function public.customer_artwork_requirements(p_order_id uuid)
returns table(
  requirement_key text,
  revision integer,
  file_id uuid,
  safe_filename text,
  review_status public.artwork_review_status,
  review_reason text,
  upload_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.requirement_key,r.revision,f.id,f.safe_filename,f.review_status,
         f.review_reason,f.upload_status
  from public.order_artwork_requirements r
  join public.order_files f on f.id = r.file_id
  join public.orders o on o.id = r.order_id
  where r.order_id = p_order_id
    and r.is_active
    and o.customer_user_id = auth.uid()
    and public.current_account_type() = 'customer'
  order by r.requirement_key
$$;

alter table public.order_configuration_revisions
  drop constraint if exists order_configuration_revisions_changed_by_fkey;
alter table public.order_configuration_revisions
  add constraint order_configuration_revisions_changed_by_fkey
    foreign key (changed_by) references public.profiles(id) on delete restrict;
alter table public.order_configuration_revisions
  add column if not exists previous_order_status public.order_status,
  add column if not exists production_revision boolean not null default false;
alter table public.orders
  add column if not exists production_approved_configuration_revision integer,
  add column if not exists configuration_reopen_previous_status public.order_status;

create or replace function public.replace_configuration_artwork_file(
  p_snapshot jsonb,
  p_line_number integer,
  p_slot text,
  p_file_id uuid
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_result jsonb := p_snapshot;
  v_items jsonb;
  v_relative_path text[];
begin
  v_relative_path := case p_slot
    when 'front' then array['design','configuration','artwork','front','fileId']
    when 'back' then array['design','configuration','artwork','back','fileId']
    when 'neck_label' then array['design','configuration','neckLabel','fileId']
    else null
  end;
  if v_relative_path is null then raise exception 'ARTWORK_REQUIREMENT_INVALID'; end if;

  if jsonb_typeof(p_snapshot -> 'items') = 'array' then
    select jsonb_agg(
      case when nullif(item.value ->> 'lineNumber','')::integer = p_line_number
        then jsonb_set(item.value, v_relative_path, to_jsonb(p_file_id::text), false)
        else item.value
      end order by item.ordinality
    ) into v_items
    from jsonb_array_elements(p_snapshot -> 'items') with ordinality as item(value, ordinality);
    v_result := jsonb_set(p_snapshot, '{items}', coalesce(v_items,'[]'::jsonb), false);
  elsif p_snapshot ? 'design' then
    v_result := jsonb_set(p_snapshot, v_relative_path, to_jsonb(p_file_id::text), false);
  else
    v_result := jsonb_set(
      p_snapshot,
      v_relative_path[2:array_length(v_relative_path,1)],
      to_jsonb(p_file_id::text),
      false
    );
  end if;
  return v_result;
end;
$$;

create or replace function public.configuration_artwork_file_ids(p_snapshot jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  with lines as (
    select
      coalesce(nullif(line.value ->> 'lineNumber','')::integer, line.ordinality::integer) as line_number,
      line.value -> 'design' as design
    from jsonb_array_elements(
      case when jsonb_typeof(p_snapshot -> 'items') = 'array'
        then p_snapshot -> 'items' else '[]'::jsonb end
    ) with ordinality as line(value, ordinality)
    union all
    select 1, case when p_snapshot ? 'design' then p_snapshot -> 'design' else p_snapshot end
    where jsonb_typeof(p_snapshot -> 'items') is distinct from 'array'
  ), files as (
    select line_number, candidate.slot, nullif(btrim(candidate.file_id),'') as file_id
    from lines
    cross join lateral (
      values
        ('front', design #>> '{configuration,artwork,front,fileId}'),
        ('back', design #>> '{configuration,artwork,back,fileId}'),
        ('neck_label', design #>> '{configuration,neckLabel,fileId}')
    ) as candidate(slot, file_id)
  )
  select coalesce(array_agg(file_id order by line_number, slot), array[]::text[])
  from files where file_id is not null
$$;

create or replace function public.capture_order_artwork_requirement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous public.order_artwork_requirements%rowtype;
  v_new_requirement_id uuid;
  v_match_count integer := 0;
  v_order public.orders%rowtype;
  v_match record;
  v_slot text;
  v_line_number integer;
  v_next_snapshot jsonb;
  v_config_revision integer;
begin
  if new.kind <> 'customer_artwork' or new.order_id is null then
    return new;
  end if;

  select * into v_order
  from public.orders
  where id = new.order_id
  for update;

  if new.replacement_for_file_id is not null then
    select * into v_previous
    from public.order_artwork_requirements
    where order_id = new.order_id
      and file_id = new.replacement_for_file_id
      and is_active
    for update;

    if not found then
      raise exception 'ARTWORK_REVISION_CONFLICT';
    end if;
    if v_order.status in (
      'material_preparation','printing_embroidery','stitching','quality_check',
      'packing','ready_to_dispatch','dispatched','delivered'
    ) then
      raise exception 'ORDER_PRODUCTION_LOCKED';
    end if;

    update public.order_artwork_requirements
    set is_active = false,
        superseded_at = now()
    where id = v_previous.id;

    insert into public.order_artwork_requirements(
      order_id, order_item_id, requirement_key, file_id, revision, is_active,
      captured_at, created_by
    ) values (
      new.order_id, v_previous.order_item_id, v_previous.requirement_key,
      new.id, v_previous.revision + 1, true, now(), new.uploaded_by
    ) returning id into v_new_requirement_id;

    update public.order_artwork_requirements
    set superseded_by_requirement_id = v_new_requirement_id
    where id = v_previous.id;

    v_slot := split_part(v_previous.requirement_key, ':', 3);
    select line_number into v_line_number
    from public.order_items where id = v_previous.order_item_id;
    if v_line_number is null then raise exception 'ARTWORK_REQUIREMENT_INVALID'; end if;

    update public.order_items
    set artwork_snapshot = case v_slot
          when 'front' then jsonb_set(artwork_snapshot,'{front,fileId}',to_jsonb(new.id::text),false)
          when 'back' then jsonb_set(artwork_snapshot,'{back,fileId}',to_jsonb(new.id::text),false)
          else artwork_snapshot
        end,
        neck_label_snapshot = case when v_slot = 'neck_label'
          then jsonb_set(neck_label_snapshot,'{fileId}',to_jsonb(new.id::text),false)
          else neck_label_snapshot end
    where id = v_previous.order_item_id;

    v_next_snapshot := public.replace_configuration_artwork_file(
      v_order.configuration_snapshot, v_line_number, v_slot, new.id
    );
    v_config_revision := v_order.configuration_revision + 1;
    insert into public.order_configuration_revisions(
      order_id,revision_number,previous_snapshot,next_snapshot,changed_by,
      reason,changed_paths,previous_order_status,production_revision
    ) values (
      new.order_id,v_config_revision,v_order.configuration_snapshot,v_next_snapshot,
      new.uploaded_by,'Artwork replacement uploaded',
      array['artwork.' || v_previous.requirement_key],v_order.status,
      v_order.status = 'production_approved'
    );
    update public.orders
    set configuration_snapshot = v_next_snapshot,
        configuration_revision = v_config_revision
    where id = new.order_id;

    insert into public.audit_logs(
      actor_user_id, actor_type, action, target_type, target_id, order_id,
      before_state, after_state, metadata
    ) values (
      new.uploaded_by,
      case when public.current_account_type() = 'staff' then 'staff' else 'customer' end,
      'artwork.superseded', 'order_artwork_requirement', v_previous.id,
      new.order_id,
      jsonb_build_object('fileId', v_previous.file_id, 'revision', v_previous.revision),
      jsonb_build_object('fileId', new.id, 'revision', v_previous.revision + 1),
      jsonb_build_object('requirementKey', v_previous.requirement_key)
    );

    if v_order.status in ('artwork_approved','production_approved') then
      update public.orders
      set status = 'artwork_pending',
          public_status = 'artwork_under_review',
          artwork_approved_at = null,
          production_approved_configuration_revision = null
      where id = new.order_id;

      insert into public.order_status_history(
        order_id, from_status, to_status, public_status, actor_type,
        actor_user_id, customer_visible, customer_message, internal_note,
        reason, metadata
      ) values (
        new.order_id, v_order.status, 'artwork_pending', 'artwork_under_review',
        case when public.current_account_type() = 'staff' then 'staff' else 'customer' end,
        new.uploaded_by, true,
        'Updated artwork is awaiting review.',
        'Production approval invalidated by an artwork revision.',
        'Artwork revision created',
        jsonb_build_object('requirementKey', v_previous.requirement_key,
                           'previousFileId', v_previous.file_id,
                           'nextFileId', new.id)
      );
    end if;

    return new;
  end if;

  for v_match in
    select distinct
      oi.id as order_item_id,
      'item:' || oi.id::text || ':' || candidate.slot as requirement_key
    from public.order_items oi
    cross join lateral (
      values
        ('front', oi.artwork_snapshot #>> '{front,fileId}'),
        ('back', oi.artwork_snapshot #>> '{back,fileId}'),
        ('neck_label', oi.neck_label_snapshot ->> 'fileId')
    ) as candidate(slot, file_id_text)
    where oi.order_id = new.order_id
      and lower(candidate.file_id_text) = lower(new.id::text)
  loop
    v_match_count := v_match_count + 1;
    insert into public.order_artwork_requirements(
      order_id, order_item_id, requirement_key, file_id, revision, is_active,
      captured_at, created_by
    ) values (
      new.order_id, v_match.order_item_id, v_match.requirement_key, new.id, 1,
      true, now(), new.uploaded_by
    ) on conflict (order_id, requirement_key, revision) do nothing;
  end loop;

  if v_match_count = 0 and not exists (
    select 1 from public.order_artwork_requirements where file_id = new.id
  ) then
    insert into public.order_artwork_requirements(
      order_id, requirement_key, file_id, revision, is_active, captured_at,
      created_by, superseded_at
    ) values (
      new.order_id, 'legacy:' || new.id::text, new.id, 1, false, now(),
      new.uploaded_by, now()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists order_files_capture_artwork_requirement on public.order_files;
create trigger order_files_capture_artwork_requirement
after insert or update of order_id, kind on public.order_files
for each row execute function public.capture_order_artwork_requirement();

create or replace function public.expire_private_upload_slots()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare v_count bigint;
begin
  update public.order_files
  set upload_status = 'expired'
  where upload_status = 'pending'
    and upload_expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.claim_expired_private_uploads(p_limit integer default 100)
returns table(file_id uuid, object_key text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;
  perform public.expire_private_upload_slots();
  return query
  with selected as (
    select f.id
    from public.order_files f
    where f.upload_status = 'expired'
      and f.object_cleanup_completed_at is null
      and (f.object_cleanup_attempted_at is null
           or f.object_cleanup_attempted_at < now() - interval '5 minutes')
    order by f.upload_expires_at, f.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  ), claimed as (
    update public.order_files f
    set object_cleanup_attempted_at = now()
    from selected s
    where f.id = s.id
    returning f.id, f.object_key
  )
  select c.id, c.object_key from claimed c;
end;
$$;

create or replace function public.complete_expired_private_upload_cleanup(p_file_ids uuid[])
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare v_count bigint;
begin
  if auth.role() <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;
  update public.order_files
  set object_cleanup_completed_at = now()
  where id = any(coalesce(p_file_ids, array[]::uuid[]))
    and upload_status = 'expired';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

drop function if exists public.create_private_upload_slot(
  uuid,uuid,uuid,public.file_kind,public.file_visibility,text,text,text,bigint,
  text,text,timestamptz
);

create function public.create_private_upload_slot(
  p_order_id uuid,
  p_design_project_id uuid,
  p_staff_quote_id uuid,
  p_replacement_for_file_id uuid,
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
returns table(file_id uuid, object_key text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_file uuid := gen_random_uuid();
  v_owner uuid := auth.uid();
  v_key text;
  v_total bigint;
  v_count bigint;
  v_extension text := lower(btrim(p_extension));
  v_content_type text := lower(btrim(p_content_type));
  v_account public.account_type := public.current_account_type();
  v_order public.orders%rowtype;
  v_active_requirement public.order_artwork_requirements%rowtype;
  v_active_file public.order_files%rowtype;
begin
  if v_owner is null or v_account is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if num_nonnulls(p_order_id, p_design_project_id, p_staff_quote_id) <> 1 then raise exception 'UPLOAD_TARGET_REQUIRED'; end if;
  if p_byte_size <= 0 or p_byte_size > 52428800 then raise exception 'FILE_SIZE_INVALID'; end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '15 minutes' then raise exception 'UPLOAD_EXPIRY_INVALID'; end if;
  if p_sha256 is not null and p_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'SHA256_INVALID'; end if;

  perform public.expire_private_upload_slots();

  if p_kind = 'customer_artwork' then
    if not (
      (v_extension = 'png' and v_content_type = 'image/png')
      or (v_extension in ('jpg','jpeg') and v_content_type = 'image/jpeg')
      or (v_extension = 'pdf' and v_content_type = 'application/pdf')
      or (v_extension = 'svg' and v_content_type = 'image/svg+xml')
      or (v_extension = 'ai' and v_content_type in (
        'application/postscript','application/illustrator',
        'application/vnd.adobe.illustrator','application/octet-stream'
      ))
    ) then raise exception 'FILE_TYPE_DENIED'; end if;
  elsif p_kind = 'proof' then
    if not (
      (v_extension = 'png' and v_content_type = 'image/png')
      or (v_extension in ('jpg','jpeg') and v_content_type = 'image/jpeg')
      or (v_extension = 'pdf' and v_content_type = 'application/pdf')
    ) then raise exception 'FILE_TYPE_DENIED'; end if;
  elsif p_kind in ('approval_pdf','packing_list','shipping_label','shipment_document') then
    if not (
      (v_extension = 'pdf' and v_content_type = 'application/pdf')
      or (p_kind <> 'approval_pdf' and v_extension = 'png' and v_content_type = 'image/png')
      or (p_kind <> 'approval_pdf' and v_extension in ('jpg','jpeg') and v_content_type = 'image/jpeg')
    ) then raise exception 'FILE_TYPE_DENIED'; end if;
  elsif p_kind = 'qc_photo' then
    if not (
      (v_extension = 'png' and v_content_type = 'image/png')
      or (v_extension in ('jpg','jpeg') and v_content_type = 'image/jpeg')
      or (v_extension = 'webp' and v_content_type = 'image/webp')
    ) then raise exception 'FILE_TYPE_DENIED'; end if;
  else
    raise exception 'BROWSER_UPLOAD_KIND_DENIED';
  end if;

  if v_account = 'customer' then
    if p_staff_quote_id is not null or p_kind <> 'customer_artwork' or p_visibility <> 'customer' then
      raise exception 'CUSTOMER_UPLOAD_KIND_DENIED';
    end if;
    if p_order_id is not null then
      select * into v_order from public.orders
      where id = p_order_id and customer_user_id = v_owner
      for update;
      if not found then raise exception 'UPLOAD_TARGET_DENIED'; end if;
      if v_order.status not in ('order_review','artwork_pending') then
        raise exception 'ARTWORK_UPLOAD_LOCKED';
      end if;
      if p_replacement_for_file_id is null then
        raise exception 'ARTWORK_REVISION_REQUIRED';
      end if;
    elsif not exists(
      select 1 from public.design_projects where id = p_design_project_id and created_by = v_owner
    ) then
      raise exception 'UPLOAD_TARGET_DENIED';
    end if;
  else
    if not public.is_active_staff(true) then raise exception 'STAFF_MFA_REQUIRED'; end if;
    if p_order_id is not null then
      select * into v_order from public.orders where id = p_order_id for update;
      if not found then raise exception 'UPLOAD_TARGET_DENIED'; end if;
      if p_kind = 'customer_artwork' and p_replacement_for_file_id is null then
        raise exception 'ARTWORK_REVISION_REQUIRED';
      end if;
      if p_kind = 'customer_artwork' and v_order.status in (
        'material_preparation','printing_embroidery','stitching','quality_check',
        'packing','ready_to_dispatch','dispatched','delivered'
      ) then
        raise exception 'ORDER_PRODUCTION_LOCKED';
      end if;
    end if;
    if p_design_project_id is not null and not exists(
      select 1 from public.design_projects where id = p_design_project_id
    ) then raise exception 'UPLOAD_TARGET_DENIED'; end if;
    if p_staff_quote_id is not null then
      if p_kind <> 'proof' or p_visibility <> 'staff_only' then raise exception 'QUOTE_UPLOAD_KIND_DENIED'; end if;
      if not exists(
        select 1 from public.staff_quotes where id = p_staff_quote_id and status in ('draft','sent')
      ) then raise exception 'UPLOAD_TARGET_DENIED'; end if;
    end if;
  end if;

  if p_order_id is not null and p_kind = 'customer_artwork' then
    select active.* into v_active_requirement
    from public.order_artwork_requirements supplied
    join public.order_artwork_requirements active
      on active.order_id = supplied.order_id
     and active.requirement_key = supplied.requirement_key
     and active.is_active
    where supplied.order_id = p_order_id
      and supplied.file_id = p_replacement_for_file_id
    for update of active;
    if not found then raise exception 'ARTWORK_REVISION_NOT_FOUND'; end if;

    select * into v_active_file
    from public.order_files
    where id = v_active_requirement.file_id
    for update;
    if v_account = 'customer'
       and v_active_file.review_status not in ('changes_requested','rejected')
       and v_active_file.upload_status not in ('failed','expired') then
      raise exception 'ARTWORK_REPLACEMENT_NOT_OPEN';
    end if;
    p_replacement_for_file_id := v_active_requirement.file_id;
  elsif p_replacement_for_file_id is not null then
    raise exception 'ARTWORK_REVISION_TARGET_INVALID';
  end if;

  select count(*), coalesce(sum(byte_size),0)
  into v_count, v_total
  from public.order_files
  where deleted_at is null
    and upload_status in ('pending','finalized')
    and (
      (p_order_id is not null and order_id = p_order_id)
      or (p_design_project_id is not null and design_project_id = p_design_project_id)
      or (p_staff_quote_id is not null and staff_quote_id = p_staff_quote_id)
    );

  if p_kind = 'customer_artwork' then
    select count(*) into v_count
    from public.order_files
    where deleted_at is null
      and upload_status in ('pending','finalized')
      and kind = 'customer_artwork'
      and (
        (p_order_id is not null and order_id = p_order_id)
        or (p_design_project_id is not null and design_project_id = p_design_project_id)
      );
    if v_count >= 10 then raise exception 'FILE_COUNT_LIMIT'; end if;
  end if;
  if v_total + p_byte_size > 262144000 then raise exception 'FILE_TOTAL_LIMIT'; end if;

  v_key := 'private/' || to_char(now(),'YYYY/MM') || '/' || v_file::text || '/' ||
    regexp_replace(p_safe_filename,'[^A-Za-z0-9._-]','_','g');
  insert into public.order_files(
    id, order_id, design_project_id, staff_quote_id, replacement_for_file_id,
    uploaded_by, kind, visibility, object_key, original_filename, safe_filename,
    extension, content_type, byte_size, sha256, upload_expires_at
  ) values (
    v_file, p_order_id, p_design_project_id, p_staff_quote_id,
    p_replacement_for_file_id, v_owner, p_kind, p_visibility, v_key,
    p_original_filename, p_safe_filename, v_extension, v_content_type,
    p_byte_size, p_sha256, p_expires_at
  );
  return query select v_file, v_key;
end;
$$;

create or replace function public.finalize_private_upload(
  p_file_id uuid,
  p_actual_byte_size bigint,
  p_actual_content_type text,
  p_object_etag text,
  p_actual_sha256 text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_file public.order_files%rowtype;
begin
  select * into v_file from public.order_files where id = p_file_id for update;
  if not found or v_file.deleted_at is not null or v_file.upload_status <> 'pending' then return false; end if;
  if v_file.upload_expires_at <= now() then
    update public.order_files set upload_status = 'expired' where id = p_file_id;
    return false;
  end if;
  if auth.role() <> 'service_role' and v_file.uploaded_by <> auth.uid() then return false; end if;
  if v_file.byte_size <> p_actual_byte_size or lower(v_file.content_type) <> lower(p_actual_content_type) then return false; end if;
  if v_file.sha256 is not null and v_file.sha256 <> p_actual_sha256 then return false; end if;
  update public.order_files set
    upload_status = 'finalized',
    finalized_at = now(),
    object_etag = p_object_etag,
    scan_status = case when kind = 'customer_artwork' then 'manual_review'::public.file_scan_status else 'not_required'::public.file_scan_status end,
    review_status = case when kind = 'customer_artwork' then 'pending_review'::public.artwork_review_status else 'approved'::public.artwork_review_status end
  where id = p_file_id;
  return true;
end;
$$;

create or replace function public.review_artwork_file(
  p_file_id uuid,
  p_decision public.artwork_review_status,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_file public.order_files%rowtype;
  v_order public.orders%rowtype;
  v_requirement public.order_artwork_requirements%rowtype;
begin
  if not public.staff_has_permission('review_artwork') then raise exception 'STAFF_PERMISSION_DENIED'; end if;
  if p_decision not in ('approved','changes_requested','rejected') then raise exception 'INVALID_ARTWORK_DECISION'; end if;
  select * into v_file from public.order_files
  where id = p_file_id and kind = 'customer_artwork' and deleted_at is null
    and upload_status = 'finalized'
  for update;
  if not found then raise exception 'FILE_NOT_FOUND'; end if;
  if p_decision <> 'approved' and nullif(btrim(p_reason),'') is null then raise exception 'REASON_REQUIRED'; end if;

  if v_file.order_id is not null then
    select * into v_requirement
    from public.order_artwork_requirements
    where order_id = v_file.order_id and file_id = v_file.id and is_active
    for update;
    if not found then raise exception 'ARTWORK_REVISION_SUPERSEDED'; end if;
    select * into v_order from public.orders where id = v_file.order_id for update;
    if v_order.status in (
      'material_preparation','printing_embroidery','stitching','quality_check',
      'packing','ready_to_dispatch','dispatched','delivered'
    ) and p_decision is distinct from v_file.review_status then
      raise exception 'ORDER_PRODUCTION_LOCKED';
    end if;
  end if;

  update public.order_files set
    review_status = p_decision,
    review_reason = nullif(btrim(p_reason),''),
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    scan_status = case
      when p_decision = 'approved' then 'clean'::public.file_scan_status
      when p_decision = 'rejected' then 'rejected'::public.file_scan_status
      else 'manual_review'::public.file_scan_status
    end
  where id = p_file_id;

  if v_file.order_id is not null
     and p_decision in ('changes_requested','rejected')
     and v_order.status in ('artwork_approved','production_approved') then
    update public.orders
    set status = 'artwork_pending',
        public_status = 'artwork_under_review',
        artwork_approved_at = null,
        production_approved_configuration_revision = null
    where id = v_file.order_id;
    insert into public.order_status_history(
      order_id, from_status, to_status, public_status, actor_type, actor_user_id,
      customer_visible, customer_message, internal_note, reason, metadata
    ) values (
      v_file.order_id, v_order.status, 'artwork_pending', 'artwork_under_review',
      'staff', auth.uid(), true,
      'Artwork changes are required before production can continue.',
      'Production approval invalidated by artwork review.', btrim(p_reason),
      jsonb_build_object('fileId', p_file_id,
                         'requirementKey', v_requirement.requirement_key)
    );
  end if;

  insert into public.audit_logs(
    actor_user_id, actor_type, action, target_type, target_id, order_id,
    before_state, after_state
  ) values (
    auth.uid(),'staff','artwork.reviewed','order_file',p_file_id,v_file.order_id,
    jsonb_build_object('decision',v_file.review_status,
                       'reviewedBy',v_file.reviewed_by,
                       'reviewedAt',v_file.reviewed_at),
    jsonb_build_object('decision',p_decision,'reason',p_reason,
                       'requirementKey',v_requirement.requirement_key)
  );
  return true;
end;
$$;

-- Retain the existing multi-line validation logic as a non-executable helper;
-- the public wrapper below adds production-state classification and resets.
alter function public.update_order_configuration(uuid,jsonb,text)
  rename to update_order_configuration_validated;
revoke all on function public.update_order_configuration_validated(uuid,jsonb,text)
from public,anon,authenticated;

create function public.update_order_configuration(
  p_order_id uuid,
  p_next_snapshot jsonb,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_revision integer;
  v_sensitive boolean;
  v_previous_status public.order_status;
begin
  if not public.staff_has_permission('edit_order_configuration') then raise exception 'STAFF_PERMISSION_DENIED'; end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'REASON_REQUIRED'; end if;
  if p_next_snapshot is null or jsonb_typeof(p_next_snapshot) <> 'object' then raise exception 'INVALID_CONFIGURATION'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status in ('cancelled','refund_pending','refunded') then raise exception 'ORDER_CONFIGURATION_LOCKED'; end if;
  if p_next_snapshot = v_order.configuration_snapshot then return v_order.configuration_revision; end if;

  v_sensitive := (p_next_snapshot - 'orderNotes') is distinct from
                 (v_order.configuration_snapshot - 'orderNotes');
  v_previous_status := coalesce(v_order.configuration_reopen_previous_status, v_order.status);

  if public.configuration_artwork_file_ids(p_next_snapshot) is distinct from
     public.configuration_artwork_file_ids(v_order.configuration_snapshot) then
    raise exception 'ARTWORK_REVISION_REQUIRED';
  end if;

  if not v_sensitive then
    v_revision := v_order.configuration_revision + 1;
    insert into public.order_configuration_revisions(
      order_id, revision_number, previous_snapshot, next_snapshot, changed_by,
      reason, changed_paths, previous_order_status, production_revision
    ) values (
      p_order_id, v_revision, v_order.configuration_snapshot, p_next_snapshot,
      auth.uid(), btrim(p_reason), array['orderNotes'], v_order.status, false
    );
    update public.orders
    set configuration_snapshot = p_next_snapshot,
        configuration_revision = v_revision
    where id = p_order_id;
    insert into public.audit_logs(
      actor_user_id,actor_type,action,target_type,target_id,order_id,
      before_state,after_state,metadata
    ) values (
      auth.uid(),'staff','order.administrative_configuration_revised','order',
      p_order_id,p_order_id,v_order.configuration_snapshot,p_next_snapshot,
      jsonb_build_object('revision',v_revision,'reason',btrim(p_reason))
    );
    return v_revision;
  end if;

  if v_order.status in (
    'material_preparation','printing_embroidery','stitching','quality_check',
    'packing','ready_to_dispatch','dispatched','delivered'
  ) then
    raise exception 'ORDER_PRODUCTION_LOCKED';
  end if;

  v_revision := public.update_order_configuration_validated(
    p_order_id, p_next_snapshot, p_reason
  );

  update public.order_configuration_revisions
  set previous_order_status = v_previous_status,
      production_revision = v_previous_status in (
        'production_approved','material_preparation','printing_embroidery',
        'stitching','quality_check','packing','ready_to_dispatch','dispatched',
        'delivered'
      )
  where order_id = p_order_id and revision_number = v_revision;

  if v_order.status in ('artwork_approved','production_approved')
     or v_order.configuration_reopen_previous_status is not null then
    update public.order_files f
    set review_status = 'pending_review',
        scan_status = 'manual_review',
        reviewed_by = null,
        reviewed_at = null,
        review_reason = null
    where f.id in (
      select r.file_id
      from public.order_artwork_requirements r
      where r.order_id = p_order_id and r.is_active
    ) and f.upload_status = 'finalized';

    update public.orders
    set status = 'artwork_pending',
        public_status = 'artwork_under_review',
        artwork_approved_at = null,
        production_approved_configuration_revision = null,
        configuration_reopen_previous_status = null
    where id = p_order_id;

    insert into public.order_status_history(
      order_id,from_status,to_status,public_status,actor_type,actor_user_id,
      customer_visible,customer_message,internal_note,reason,metadata
    ) values (
      p_order_id,v_previous_status,'artwork_pending','artwork_under_review',
      'staff',auth.uid(),true,
      'The updated production specification is awaiting artwork review.',
      'Production approval invalidated by configuration revision.',btrim(p_reason),
      jsonb_build_object('configurationRevision',v_revision,
                         'previousProductionStatus',v_previous_status)
    );
  end if;

  return v_revision;
end;
$$;

create or replace function public.reopen_order_configuration(
  p_order_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_order public.orders%rowtype;
begin
  if public.current_staff_role() <> 'founder' or not public.staff_mfa_satisfied() then
    raise exception 'FOUNDER_PERMISSION_REQUIRED';
  end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'REASON_REQUIRED'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status not in (
    'material_preparation','printing_embroidery','stitching','quality_check',
    'packing','ready_to_dispatch','dispatched','delivered'
  ) then raise exception 'REOPEN_NOT_REQUIRED'; end if;

  update public.orders
  set status = 'artwork_pending',
      public_status = 'artwork_under_review',
      artwork_approved_at = null,
      production_approved_configuration_revision = null,
      configuration_reopened_at = now(),
      configuration_reopened_by = auth.uid(),
      configuration_reopen_reason = btrim(p_reason),
      configuration_reopen_previous_status = v_order.status
  where id = p_order_id;

  insert into public.order_status_history(
    order_id,from_status,to_status,public_status,actor_type,actor_user_id,
    customer_visible,customer_message,internal_note,reason,metadata
  ) values (
    p_order_id,v_order.status,'artwork_pending','artwork_under_review','staff',
    auth.uid(),true,
    'A controlled production revision has paused this order for review.',
    'Founder opened a production revision. Production must not continue.',
    btrim(p_reason),
    jsonb_build_object('previousProductionStatus',v_order.status,
                       'configurationRevision',v_order.configuration_revision,
                       'previousConfiguration',v_order.configuration_snapshot)
  );
  insert into public.audit_logs(
    actor_user_id,actor_type,action,target_type,target_id,order_id,
    before_state,after_state,metadata
  ) values (
    auth.uid(),'staff','order.production_revision_opened','order',p_order_id,
    p_order_id,
    jsonb_build_object('status',v_order.status,
                       'configuration',v_order.configuration_snapshot,
                       'configurationRevision',v_order.configuration_revision),
    jsonb_build_object('status','artwork_pending'),
    jsonb_build_object('reason',btrim(p_reason))
  );
  return true;
end;
$$;

create or replace function public.staff_transition_order(
  p_order_id uuid,p_to_status public.order_status,p_customer_message text default null,
  p_internal_note text default null,p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_order public.orders%rowtype; v_public public.public_order_status;
begin
  if not public.staff_has_permission('change_order_status') then raise exception 'STAFF_PERMISSION_DENIED'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if p_to_status='cancelled' then raise exception 'CANCELLATION_REQUEST_REQUIRED'; end if;
  if p_to_status in ('refund_pending','refunded') then raise exception 'REFUND_ACTION_REQUIRED'; end if;
  if not public.is_order_transition_allowed(v_order.status,p_to_status) then raise exception 'INVALID_STATUS_TRANSITION'; end if;
  if p_to_status='on_hold' and nullif(btrim(p_reason),'') is null then raise exception 'REASON_REQUIRED'; end if;
  if p_to_status='production_approved' then
    if v_order.amount_paid_paise<>v_order.total_paise then raise exception 'VERIFIED_PAYMENT_REQUIRED'; end if;

    if exists(
      select 1
      from public.order_items oi
      cross join lateral (
        values
          ('item:' || oi.id::text || ':front', oi.artwork_snapshot #>> '{front,fileId}'),
          ('item:' || oi.id::text || ':back', oi.artwork_snapshot #>> '{back,fileId}'),
          ('item:' || oi.id::text || ':neck_label', oi.neck_label_snapshot ->> 'fileId')
      ) as expected(requirement_key, file_id_text)
      left join public.order_artwork_requirements r
        on r.order_id = oi.order_id
       and r.requirement_key = expected.requirement_key
       and r.is_active
      left join public.order_files f on f.id = r.file_id
      where oi.order_id = v_order.id
        and nullif(btrim(expected.file_id_text),'') is not null
        and (
          r.id is null or f.id is null
          or lower(f.id::text) <> lower(expected.file_id_text)
          or f.order_id is distinct from v_order.id
          or f.deleted_at is not null or f.upload_status <> 'finalized'
          or f.review_status <> 'approved' or f.scan_status <> 'clean'
        )
    ) then raise exception 'ARTWORK_APPROVAL_REQUIRED'; end if;

    if exists(
      select 1
      from public.order_artwork_requirements r
      left join public.order_files f on f.id = r.file_id
      where r.order_id = v_order.id and r.is_active
        and (
          f.id is null or f.order_id is distinct from v_order.id
          or f.deleted_at is not null or f.upload_status <> 'finalized'
          or f.review_status <> 'approved' or f.scan_status <> 'clean'
        )
    ) then raise exception 'ARTWORK_APPROVAL_REQUIRED'; end if;
  end if;
  if p_to_status='dispatched' and v_order.shipping_payment_status not in ('paid','waived','not_required') then raise exception 'SHIPPING_PAYMENT_REQUIRED'; end if;
  v_public:=public.order_public_status_for_internal(p_to_status);
  update public.orders set status=p_to_status,public_status=v_public,
    artwork_approved_at=case when p_to_status='artwork_approved' then now() else artwork_approved_at end,
    production_approved_configuration_revision=case when p_to_status='production_approved' then configuration_revision else production_approved_configuration_revision end,
    production_started_at=case when p_to_status='material_preparation' then now() else production_started_at end,
    dispatched_at=case when p_to_status='dispatched' then now() else dispatched_at end,
    delivered_at=case when p_to_status='delivered' then now() else delivered_at end,
    configuration_reopened_at=case when p_to_status='production_approved' then null else configuration_reopened_at end,
    configuration_reopened_by=case when p_to_status='production_approved' then null else configuration_reopened_by end,
    configuration_reopen_reason=case when p_to_status='production_approved' then null else configuration_reopen_reason end,
    configuration_reopen_previous_status=case when p_to_status='production_approved' then null else configuration_reopen_previous_status end
  where id=p_order_id;
  insert into public.order_status_history(order_id,from_status,to_status,public_status,actor_type,actor_user_id,customer_visible,customer_message,internal_note,reason)
  values(v_order.id,v_order.status,p_to_status,v_public,'staff',auth.uid(),true,coalesce(nullif(btrim(p_customer_message),''),'Order status updated.'),nullif(btrim(p_internal_note),''),nullif(btrim(p_reason),''));
  insert into public.audit_logs(actor_user_id,actor_type,action,target_type,target_id,order_id,before_state,after_state,metadata)
  values(auth.uid(),'staff','order.status_changed','order',v_order.id,v_order.id,jsonb_build_object('status',v_order.status),jsonb_build_object('status',p_to_status),jsonb_build_object('reason',p_reason,'configurationRevision',v_order.configuration_revision));
  return true;
end;
$$;

revoke all on function public.expire_private_upload_slots(),
  public.claim_expired_private_uploads(integer),
  public.complete_expired_private_upload_cleanup(uuid[]),
  public.create_private_upload_slot(uuid,uuid,uuid,uuid,public.file_kind,public.file_visibility,text,text,text,bigint,text,text,timestamptz),
  public.customer_artwork_requirements(uuid),
  public.update_order_configuration(uuid,jsonb,text)
from public,anon,authenticated;
grant execute on function
  public.create_private_upload_slot(uuid,uuid,uuid,uuid,public.file_kind,public.file_visibility,text,text,text,bigint,text,text,timestamptz),
  public.customer_artwork_requirements(uuid),
  public.update_order_configuration(uuid,jsonb,text)
to authenticated;
grant execute on function public.expire_private_upload_slots(),
  public.claim_expired_private_uploads(integer),
  public.complete_expired_private_upload_cleanup(uuid[])
to service_role;

notify pgrst, 'reload schema';
commit;
