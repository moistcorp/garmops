-- Phase 9: Zoho reservation invoicing, finance retry controls, and stronger
-- accounting evidence constraints. Provider calls remain outside transactions.

alter table public.invoices
  add column if not exists provider_status text,
  add column if not exists provider_snapshot jsonb;

alter table public.invoices
  add constraint invoices_provider_status_format
  check (
    provider_status is null
    or (
      provider_status = btrim(provider_status)
      and char_length(provider_status) between 1 and 80
    )
  ),
  add constraint invoices_provider_snapshot_object
  check (
    provider_snapshot is null
    or jsonb_typeof(provider_snapshot) = 'object'
  ),
  add constraint invoices_completed_has_accounting_evidence
  check (
    sync_status <> 'completed'
    or (
      zoho_contact_id is not null
      and zoho_document_id is not null
      and zoho_payment_id is not null
      and document_number is not null
      and issue_date is not null
      and total_paise is not null
      and paid_paise = total_paise
      and balance_paise = 0
      and pdf_file_id is not null
      and completed_at is not null
    )
  );

create unique index if not exists invoices_zoho_document_unique_idx
  on public.invoices (provider, zoho_document_id)
  where zoho_document_id is not null;

create unique index if not exists invoices_zoho_payment_unique_idx
  on public.invoices (provider, zoho_payment_id)
  where zoho_payment_id is not null;

create index if not exists invoices_finance_queue_idx
  on public.invoices (sync_status, next_attempt_at, updated_at desc)
  where sync_status in ('queued', 'processing', 'retryable_failure', 'permanent_failure');


create function public.defer_integration_job(
  p_job_id uuid,
  p_worker_id text,
  p_available_at timestamptz,
  p_reason text
)
returns public.integration_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.integration_jobs%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'service role required';
  end if;

  if p_available_at <= transaction_timestamp() then
    raise exception using
      errcode = '22023',
      message = 'deferred job availability must be in the future';
  end if;

  update public.integration_jobs
  set
    status = 'retry',
    attempt_count = greatest(attempt_count - 1, 0),
    available_at = p_available_at,
    locked_at = null,
    locked_by = null,
    last_error = left(coalesce(nullif(btrim(p_reason), ''), 'job deferred'), 2000),
    completed_at = null
  where id = p_job_id
    and status = 'processing'
    and locked_by = p_worker_id
  returning * into v_job;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'claimed integration job was not found';
  end if;

  return v_job;
end;
$$;

revoke all on function public.defer_integration_job(uuid, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.defer_integration_job(uuid, text, timestamptz, text)
  to service_role;

comment on function public.defer_integration_job(uuid, text, timestamptz, text) is
  'Releases a claimed job without consuming an attempt when a feature is intentionally disabled.';

create function public.retry_invoice_integration_job(p_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices%rowtype;
  v_job public.integration_jobs%rowtype;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not public.staff_has_permission('retry_invoice_job') then
    raise exception using
      errcode = '42501',
      message = 'invoice retry permission denied';
  end if;

  select *
  into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'invoice not found';
  end if;

  if v_invoice.sync_status = 'completed' then
    return null;
  end if;

  select *
  into v_job
  from public.integration_jobs
  where aggregate_type = 'invoice'
    and aggregate_id = v_invoice.id
    and job_type = 'create_reservation_invoice'
  order by created_at
  limit 1
  for update;

  if not found then
    insert into public.integration_jobs (
      job_type,
      dedupe_key,
      aggregate_type,
      aggregate_id,
      payload,
      status,
      priority,
      available_at
    )
    values (
      'create_reservation_invoice',
      format('create_reservation_invoice:%s', v_invoice.payment_attempt_id),
      'invoice',
      v_invoice.id,
      jsonb_build_object(
        'invoice_id', v_invoice.id,
        'payment_attempt_id', v_invoice.payment_attempt_id,
        'order_id', v_invoice.order_id
      ),
      'pending',
      20,
      transaction_timestamp()
    )
    returning * into v_job;
  else
    update public.integration_jobs
    set
      status = 'pending',
      attempt_count = 0,
      available_at = transaction_timestamp(),
      locked_at = null,
      locked_by = null,
      last_error = null,
      completed_at = null
    where id = v_job.id
    returning * into v_job;
  end if;

  update public.invoices
  set
    sync_status = 'queued',
    last_error_code = null,
    last_error_message = null,
    next_attempt_at = transaction_timestamp()
  where id = v_invoice.id;

  insert into public.audit_logs (
    actor_type,
    actor_user_id,
    action,
    target_type,
    target_id,
    organization_id,
    order_id,
    before_state,
    after_state
  )
  select
    'staff',
    v_user_id,
    'invoice.retry_requested',
    'invoice',
    v_invoice.id,
    orders.organization_id,
    v_invoice.order_id,
    jsonb_build_object(
      'sync_status', v_invoice.sync_status,
      'attempt_count', v_invoice.attempt_count,
      'last_error_code', v_invoice.last_error_code
    ),
    jsonb_build_object(
      'sync_status', 'queued',
      'integration_job_id', v_job.id
    )
  from public.orders
  where orders.id = v_invoice.order_id;

  return v_job.id;
end;
$$;

revoke all on function public.retry_invoice_integration_job(uuid)
  from public, anon;
grant execute on function public.retry_invoice_integration_job(uuid)
  to authenticated;

comment on function public.retry_invoice_integration_job(uuid) is
  'Requeues a reservation invoice integration job for MFA-authenticated finance staff and records an audit event.';
