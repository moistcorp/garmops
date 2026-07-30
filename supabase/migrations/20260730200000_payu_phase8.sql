-- Phase 8: safe non-success PayU transitions used by callbacks and reconciliation.
create function public.record_payu_payment_state(
  p_payment_attempt_id uuid,
  p_state text,
  p_provider_payment_id text default null,
  p_failure_code text default null,
  p_failure_message text default null,
  p_verified_snapshot jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.payment_attempts%rowtype;
  v_order public.orders%rowtype;
  v_previous_payment_status public.payment_status;
  v_has_newer_live_attempt boolean;
  v_order_from_status public.order_status;
begin
  if p_state not in ('pending', 'failed', 'disputed') then
    raise exception using
      errcode = '22023',
      message = 'invalid payment state';
  end if;

  if jsonb_typeof(p_verified_snapshot) <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'verified snapshot must be an object';
  end if;

  if p_provider_payment_id is not null and (
    p_provider_payment_id <> btrim(p_provider_payment_id)
    or char_length(p_provider_payment_id) not between 1 and 120
  ) then
    raise exception using
      errcode = '22023',
      message = 'invalid provider payment id';
  end if;

  select *
  into v_attempt
  from public.payment_attempts
  where id = p_payment_attempt_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'payment attempt not found';
  end if;

  -- A delayed pending/failure response may never downgrade a terminal attempt.
  if v_attempt.status in (
    'paid',
    'cancelled',
    'refunded',
    'partially_refunded',
    'disputed'
  ) then
    return;
  end if;

  select *
  into v_order
  from public.orders
  where id = v_attempt.order_id
  for update;

  v_previous_payment_status := v_attempt.status;

  select exists (
    select 1
    from public.payment_attempts as newer_attempt
    where newer_attempt.order_id = v_attempt.order_id
      and newer_attempt.purpose = v_attempt.purpose
      and newer_attempt.attempt_number > v_attempt.attempt_number
      and newer_attempt.status in ('created', 'initiated', 'pending', 'paid')
  )
  into v_has_newer_live_attempt;

  update public.payment_attempts
  set
    status = p_state::public.payment_status,
    provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
    last_verified_at = transaction_timestamp(),
    failed_at = case
      when p_state = 'failed' then transaction_timestamp()
      else null
    end,
    failure_code = case
      when p_state in ('failed', 'disputed') then nullif(left(p_failure_code, 200), '')
      else null
    end,
    failure_message = case
      when p_state in ('failed', 'disputed') then nullif(left(p_failure_message, 1000), '')
      else null
    end,
    raw_verified_snapshot = p_verified_snapshot
  where id = v_attempt.id;

  -- Only the newest active reservation attempt controls the customer-facing
  -- unpaid order state. A late failure from an older attempt cannot overwrite
  -- a newer in-progress retry.
  if not v_has_newer_live_attempt then
    if p_state = 'failed' and v_order.status = 'awaiting_payment' then
      v_order_from_status := v_order.status;
      update public.orders
      set
        status = 'payment_failed',
        public_status = 'payment_incomplete'
      where id = v_order.id;

      insert into public.order_status_history (
        order_id,
        from_status,
        to_status,
        public_status,
        actor_type,
        customer_visible,
        customer_message
      )
      values (
        v_order.id,
        v_order_from_status,
        'payment_failed',
        'payment_incomplete',
        'provider',
        true,
        'The payment was not completed. The saved order can be retried safely.'
      );
    elsif p_state = 'pending' and v_order.status = 'payment_failed' then
      v_order_from_status := v_order.status;
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
        customer_visible,
        customer_message
      )
      values (
        v_order.id,
        v_order_from_status,
        'awaiting_payment',
        'payment_incomplete',
        'provider',
        true,
        'Payment verification is pending. Do not make another payment yet.'
      );
    end if;
  end if;

  if v_previous_payment_status is distinct from p_state::public.payment_status then
    insert into public.audit_logs (
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
      'provider',
      'payment.' || p_state,
      'payment_attempt',
      v_attempt.id,
      v_order.organization_id,
      v_order.id,
      jsonb_build_object('status', v_previous_payment_status),
      jsonb_build_object(
        'status', p_state,
        'provider_payment_id', p_provider_payment_id
      )
    );
  end if;
end;
$$;

revoke all on function public.record_payu_payment_state(
  uuid,
  text,
  text,
  text,
  text,
  jsonb
) from public, anon, authenticated;

grant execute on function public.record_payu_payment_state(
  uuid,
  text,
  text,
  text,
  text,
  jsonb
) to service_role;

create index if not exists payment_attempts_reconciliation_idx
  on public.payment_attempts (status, updated_at)
  where status in ('initiated', 'pending');

comment on function public.record_payu_payment_state(
  uuid,
  text,
  text,
  text,
  text,
  jsonb
) is
  'Records PayU pending/failure/exception verification state without allowing delayed events to downgrade paid/terminal attempts or newer retries.';
