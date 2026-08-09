-- Garmops Phase 7: durable custom-order submission and retryable unpaid
-- payment attempts. Canonical product pricing remains in the trusted
-- application service; PostgreSQL owns atomic numbering, immutable snapshots,
-- idempotency, file linkage, and payment-attempt history.

alter table public.order_files
  drop constraint order_files_exactly_one_target,
  add constraint order_files_has_target
    check (order_id is not null or design_project_id is not null);

comment on constraint order_files_has_target on public.order_files is
  'A finalized design file may also be linked to the immutable submitted order that uses it.';

create function public.submit_custom_order(
  p_idempotency_key text,
  p_request_hash text,
  p_organization_id uuid,
  p_customer_user_id uuid,
  p_subtotal_paise bigint,
  p_shipping_paise bigint,
  p_tax_estimate_paise bigint,
  p_reservation_amount_paise bigint,
  p_pricing_version text,
  p_configuration_schema_version integer,
  p_billing_snapshot jsonb,
  p_shipping_snapshot jsonb,
  p_customer_snapshot jsonb,
  p_company_snapshot jsonb,
  p_terms_snapshot jsonb,
  p_items jsonb,
  p_design_project_id uuid,
  p_design_version_id uuid,
  p_file_ids uuid[] default '{}'::uuid[],
  p_customer_reference text default null,
  p_po_number text default null,
  p_requested_delivery_date date default null,
  p_expires_at timestamptz default (now() + interval '24 hours')
)
returns table (
  order_id uuid,
  order_number text,
  payment_attempt_id uuid,
  submitted_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_project public.design_projects%rowtype;
  v_file_count integer;
  v_unique_file_count integer;
  v_valid_file_count integer;
  v_existing_order_id uuid;
  v_existing_request_hash text;
  v_submission record;
begin
  if p_design_project_id is null or p_design_version_id is null then
    raise exception using
      errcode = '22023',
      message = 'custom orders require an immutable design version';
  end if;
  if not exists (
    select 1
    from public.organization_members as member
    where member.organization_id = p_organization_id
      and member.user_id = p_customer_user_id
      and member.status = 'active'
      and member.role in ('owner', 'buyer')
  ) then
    raise exception using
      errcode = '42501',
      message = 'active owner or buyer membership required';
  end if;

  select *
  into v_project
  from public.design_projects
  where id = p_design_project_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'design project does not belong to organization';
  end if;
  if v_project.status = 'archived' then
    raise exception using
      errcode = '22023',
      message = 'archived designs cannot be submitted';
  end if;
  if not exists (
    select 1
    from public.design_project_versions as version
    where version.id = p_design_version_id
      and version.design_project_id = p_design_project_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'design version does not belong to design project';
  end if;

  select resource_id, request_hash
  into v_existing_order_id, v_existing_request_hash
  from public.idempotency_keys
  where scope = 'submit_order'
    and actor_id = p_customer_user_id
    and key = p_idempotency_key;

  if v_existing_request_hash is not null
    and v_existing_request_hash <> p_request_hash then
    raise exception using
      errcode = '22023',
      message = 'idempotency key request hash mismatch';
  end if;

  if v_project.status = 'submitted' and v_existing_order_id is null then
    raise exception using
      errcode = '22023',
      message = 'submitted designs must be duplicated before ordering again';
  end if;

  if p_terms_snapshot -> 'accepted' <> 'true'::jsonb
    or nullif(btrim(p_terms_snapshot ->> 'version'), '') is null then
    raise exception using
      errcode = '22023',
      message = 'accepted order terms and version are required';
  end if;

  select
    count(*)::integer,
    count(distinct file_id)::integer
  into v_file_count, v_unique_file_count
  from unnest(coalesce(p_file_ids, '{}'::uuid[])) as submitted(file_id);

  if v_file_count <> v_unique_file_count then
    raise exception using
      errcode = '22023',
      message = 'submitted file references must be unique';
  end if;

  select count(*)::integer
  into v_valid_file_count
  from public.order_files as order_file
  where order_file.id = any(coalesce(p_file_ids, '{}'::uuid[]))
    and order_file.design_project_id = p_design_project_id
    and order_file.uploaded_by = p_customer_user_id
    and order_file.kind in ('customer_artwork', 'purchase_order')
    and order_file.visibility = 'customer'
    and order_file.upload_status = 'finalized'
    and order_file.scan_status in ('manual_review', 'clean', 'not_required')
    and order_file.deleted_at is null
    and (
      order_file.order_id is null
      or order_file.order_id = v_existing_order_id
    );

  if v_valid_file_count <> v_file_count then
    raise exception using
      errcode = '22023',
      message = 'order files must be finalized and belong to the submitted design';
  end if;

  select *
  into v_submission
  from public.submit_order(
    p_idempotency_key => p_idempotency_key,
    p_request_hash => p_request_hash,
    p_order_type => 'custom_bulk'::public.order_type,
    p_organization_id => p_organization_id,
    p_customer_user_id => p_customer_user_id,
    p_subtotal_paise => p_subtotal_paise,
    p_shipping_paise => p_shipping_paise,
    p_tax_estimate_paise => p_tax_estimate_paise,
    p_reservation_amount_paise => p_reservation_amount_paise,
    p_pricing_version => p_pricing_version,
    p_configuration_schema_version => p_configuration_schema_version,
    p_billing_snapshot => p_billing_snapshot,
    p_shipping_snapshot => p_shipping_snapshot,
    p_customer_snapshot => p_customer_snapshot,
    p_company_snapshot => p_company_snapshot,
    p_terms_snapshot => p_terms_snapshot,
    p_items => p_items,
    p_design_project_id => p_design_project_id,
    p_design_version_id => p_design_version_id,
    p_customer_reference => p_customer_reference,
    p_po_number => p_po_number,
    p_requested_delivery_date => p_requested_delivery_date,
    p_expires_at => p_expires_at
  );

  update public.order_files as linked_file
  set order_id = v_submission.order_id
  where linked_file.id = any(coalesce(p_file_ids, '{}'::uuid[]))
    and linked_file.order_id is distinct from v_submission.order_id;

  if v_project.status = 'draft' then
    update public.design_projects
    set
      status = 'submitted',
      submitted_at = v_submission.submitted_at
    where id = p_design_project_id;
  end if;

  if v_existing_order_id is null then
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
      p_customer_user_id,
      'customer',
      'order.submitted',
      'order',
      v_submission.order_id,
      p_organization_id,
      v_submission.order_id,
      jsonb_build_object(
        'order_number', v_submission.order_number,
        'design_project_id', p_design_project_id,
        'design_version_id', p_design_version_id,
        'payment_attempt_id', v_submission.payment_attempt_id
      )
    );
  end if;

  return query
  select
    v_submission.order_id::uuid,
    v_submission.order_number::text,
    v_submission.payment_attempt_id::uuid,
    v_submission.submitted_at::timestamptz;
end;
$$;

revoke all on function public.submit_custom_order(
  text, text, uuid, uuid, bigint, bigint, bigint, bigint, text, integer,
  jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, uuid, uuid, uuid[], text, text,
  date, timestamptz
) from public, anon, authenticated;
grant execute on function public.submit_custom_order(
  text, text, uuid, uuid, bigint, bigint, bigint, bigint, text, integer,
  jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, uuid, uuid, uuid[], text, text,
  date, timestamptz
) to service_role;

comment on function public.submit_custom_order(
  text, text, uuid, uuid, bigint, bigint, bigint, bigint, text, integer,
  jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, uuid, uuid, uuid[], text, text,
  date, timestamptz
) is
  'Atomically submits one immutable custom design, links finalized files, and creates its first payment attempt.';

create function public.retry_order_payment(
  p_order_id uuid,
  p_customer_user_id uuid,
  p_idempotency_key text,
  p_request_hash text
)
returns table (
  order_id uuid,
  order_number text,
  payment_attempt_id uuid,
  attempt_number integer,
  payment_status public.payment_status,
  created_new boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_idempotency public.idempotency_keys%rowtype;
  v_order public.orders%rowtype;
  v_previous_attempt public.payment_attempts%rowtype;
  v_attempt_id uuid;
  v_attempt_number integer;
  v_payment_status public.payment_status;
  v_created_new boolean := false;
begin
  if p_idempotency_key is null
    or p_idempotency_key <> btrim(p_idempotency_key)
    or char_length(p_idempotency_key) not between 8 and 200 then
    raise exception using
      errcode = '22023',
      message = 'invalid idempotency key';
  end if;
  if p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception using
      errcode = '22023',
      message = 'invalid request hash';
  end if;

  insert into public.idempotency_keys (
    scope,
    actor_id,
    key,
    request_hash,
    expires_at
  )
  values (
    'retry_order_payment',
    p_customer_user_id,
    p_idempotency_key,
    p_request_hash,
    now() + interval '24 hours'
  )
  on conflict (scope, actor_id, key) do nothing;

  select *
  into v_idempotency
  from public.idempotency_keys
  where scope = 'retry_order_payment'
    and actor_id = p_customer_user_id
    and key = p_idempotency_key
  for update;

  if v_idempotency.request_hash <> p_request_hash then
    raise exception using
      errcode = '22023',
      message = 'idempotency key request hash mismatch';
  end if;

  if v_idempotency.resource_id is not null then
    select
      attempt.order_id,
      customer_order.order_number,
      attempt.id,
      attempt.attempt_number,
      attempt.status
    into
      v_order.id,
      v_order.order_number,
      v_attempt_id,
      v_attempt_number,
      v_payment_status
    from public.payment_attempts as attempt
    join public.orders as customer_order on customer_order.id = attempt.order_id
    where attempt.id = v_idempotency.resource_id
      and attempt.order_id = p_order_id;

    if v_attempt_id is null then
      raise exception using
        errcode = 'P0001',
        message = 'idempotent payment retry response is incomplete';
    end if;

    return query
    select
      v_order.id,
      v_order.order_number,
      v_attempt_id,
      v_attempt_number,
      v_payment_status,
      false;
    return;
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found
    or not exists (
      select 1
      from public.organization_members as member
      where member.organization_id = v_order.organization_id
        and member.user_id = p_customer_user_id
        and member.status = 'active'
        and member.role in ('owner', 'buyer')
    ) then
    raise exception using
      errcode = '42501',
      message = 'order payment retry access denied';
  end if;
  if v_order.status not in ('awaiting_payment', 'payment_failed') then
    raise exception using
      errcode = '22023',
      message = 'order is not awaiting payment';
  end if;
  if v_order.expires_at is not null and v_order.expires_at <= now() then
    raise exception using
      errcode = '22023',
      message = 'order payment window has expired';
  end if;
  if exists (
    select 1
    from public.payment_attempts as paid_attempt
    where paid_attempt.order_id = p_order_id
      and paid_attempt.purpose = 'reservation'
      and paid_attempt.status = 'paid'
  ) then
    raise exception using
      errcode = '22023',
      message = 'reservation payment is already complete';
  end if;

  select *
  into v_previous_attempt
  from public.payment_attempts as previous_attempt
  where previous_attempt.order_id = p_order_id
    and previous_attempt.purpose = 'reservation'
  order by previous_attempt.attempt_number desc
  limit 1
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'order has no reservation payment attempt';
  end if;

  if v_previous_attempt.status in ('created', 'initiated', 'pending') then
    v_attempt_id := v_previous_attempt.id;
    v_attempt_number := v_previous_attempt.attempt_number;
    v_payment_status := v_previous_attempt.status;
  else
    v_attempt_number := v_previous_attempt.attempt_number + 1;
    if v_attempt_number > 99 then
      raise exception using
        errcode = '22023',
        message = 'maximum payment attempts reached';
    end if;

    v_attempt_id := gen_random_uuid();
    v_payment_status := 'created';
    v_created_new := true;

    insert into public.payment_attempts (
      id,
      payment_number,
      order_id,
      provider,
      provider_merchant_txn_id,
      attempt_number,
      purpose,
      amount_paise,
      currency,
      status,
      expected_product_info,
      customer_email,
      customer_name
    )
    values (
      v_attempt_id,
      format(
        'PAY-%s-%s',
        v_order.order_number,
        lpad(v_attempt_number::text, 2, '0')
      ),
      v_order.id,
      'payu',
      'G'
        || regexp_replace(v_order.order_number, '[^0-9]', '', 'g')
        || 'P'
        || lpad(v_attempt_number::text, 2, '0'),
      v_attempt_number,
      'reservation',
      v_order.reservation_amount_paise,
      v_order.currency,
      v_payment_status,
      format('Garmops order %s', v_order.order_number),
      v_previous_attempt.customer_email,
      v_previous_attempt.customer_name
    );

    if v_order.status = 'payment_failed' then
      update public.orders
      set
        status = 'awaiting_payment',
        public_status = 'payment_incomplete'
      where id = v_order.id;

      insert into public.order_status_history (
        order_id,
        from_status,
        to_status,
        public_status,
        actor_type,
        actor_user_id,
        customer_visible,
        customer_message,
        metadata
      )
      values (
        v_order.id,
        'payment_failed',
        'awaiting_payment',
        'payment_incomplete',
        'customer',
        p_customer_user_id,
        true,
        'A new reservation payment attempt is ready.',
        jsonb_build_object('payment_attempt_id', v_attempt_id)
      );
    end if;

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
      p_customer_user_id,
      'customer',
      'payment.retry_created',
      'payment_attempt',
      v_attempt_id,
      v_order.organization_id,
      v_order.id,
      jsonb_build_object(
        'attempt_number', v_attempt_number,
        'amount_paise', v_order.reservation_amount_paise
      )
    );
  end if;

  update public.idempotency_keys
  set
    resource_type = 'payment_attempt',
    resource_id = v_attempt_id,
    response_status = case when v_created_new then 201 else 200 end,
    response_body = jsonb_build_object(
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'payment_attempt_id', v_attempt_id,
      'attempt_number', v_attempt_number,
      'payment_status', v_payment_status,
      'created_new', v_created_new
    )
  where id = v_idempotency.id;

  return query
  select
    v_order.id,
    v_order.order_number,
    v_attempt_id,
    v_attempt_number,
    v_payment_status,
    v_created_new;
end;
$$;

revoke all on function public.retry_order_payment(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.retry_order_payment(uuid, uuid, text, text)
  to service_role;

comment on function public.retry_order_payment(uuid, uuid, text, text) is
  'Returns an active unpaid attempt or appends a retry attempt without overwriting provider history.';
