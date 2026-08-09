-- Create custom orders only after PayU verifies the reservation payment.
-- The temporary checkout rows are service-only and are not customer orders.

create table public.custom_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_user_id uuid not null references public.profiles(id) on delete cascade,
  cart_id text not null check (cart_id = btrim(cart_id) and char_length(cart_id) between 1 and 160),
  idempotency_key uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'prepared'
    check (status in ('prepared', 'payment_initiated', 'payment_pending', 'payment_verified', 'finalized', 'failed', 'expired')),
  rpc_payload jsonb not null check (jsonb_typeof(rpc_payload) = 'object'),
  estimated_total_paise bigint not null check (estimated_total_paise >= 0),
  reservation_amount_paise bigint not null check (reservation_amount_paise > 0),
  currency char(3) not null default 'INR' check (currency::text ~ '^[A-Z]{3}$'),
  return_path text not null check (return_path like '/%'),
  final_order_id uuid references public.orders(id),
  final_payment_attempt_id uuid references public.payment_attempts(id),
  final_order_number text,
  provider_payment_id text,
  verified_snapshot jsonb check (verified_snapshot is null or jsonb_typeof(verified_snapshot) = 'object'),
  expires_at timestamptz not null,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_user_id, idempotency_key),
  check (expires_at > created_at),
  check (
    status <> 'finalized'
    or (final_order_id is not null and final_payment_attempt_id is not null and final_order_number is not null)
  )
);

create table public.custom_checkout_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  checkout_session_id uuid not null references public.custom_checkout_sessions(id) on delete cascade,
  attempt_number integer not null check (attempt_number between 1 and 99),
  provider text not null default 'payu' check (provider = 'payu'),
  provider_merchant_txn_id text not null unique
    check (provider_merchant_txn_id = btrim(provider_merchant_txn_id) and char_length(provider_merchant_txn_id) between 8 and 40),
  provider_payment_id text,
  amount_paise bigint not null check (amount_paise > 0),
  currency char(3) not null default 'INR' check (currency::text ~ '^[A-Z]{3}$'),
  status text not null default 'created'
    check (status in ('created', 'initiated', 'pending', 'failed', 'paid', 'completed')),
  expected_product_info text not null check (char_length(expected_product_info) between 1 and 200),
  customer_email extensions.citext not null,
  customer_name text not null check (char_length(customer_name) between 1 and 160),
  customer_phone text not null check (customer_phone ~ '^\+[1-9][0-9]{7,14}$'),
  failure_code text,
  failure_message text,
  raw_verified_snapshot jsonb check (raw_verified_snapshot is null or jsonb_typeof(raw_verified_snapshot) = 'object'),
  initiated_at timestamptz,
  paid_at timestamptz,
  failed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (checkout_session_id, attempt_number)
);

create table public.custom_checkout_payment_events (
  id uuid primary key default gen_random_uuid(),
  checkout_payment_attempt_id uuid not null references public.custom_checkout_payment_attempts(id) on delete cascade,
  provider text not null default 'payu' check (provider = 'payu'),
  event_source text not null check (event_source in ('callback', 'webhook', 'verify_api', 'reconciliation')),
  provider_event_id text,
  event_fingerprint text not null,
  event_type text not null,
  authentic boolean not null default false,
  processed boolean not null default false,
  processed_at timestamptz,
  processing_error text,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  unique (provider, event_fingerprint)
);

create index custom_checkout_sessions_user_status_idx
  on public.custom_checkout_sessions (customer_user_id, status, created_at desc);
create index custom_checkout_sessions_expiry_idx
  on public.custom_checkout_sessions (expires_at)
  where status not in ('finalized', 'expired');
create index custom_checkout_attempts_session_idx
  on public.custom_checkout_payment_attempts (checkout_session_id, attempt_number desc);
create index custom_checkout_attempts_reconciliation_idx
  on public.custom_checkout_payment_attempts (status, updated_at)
  where status in ('initiated', 'pending', 'paid');

create trigger custom_checkout_sessions_set_updated_at
before update on public.custom_checkout_sessions
for each row execute function public.set_updated_at();

create trigger custom_checkout_payment_attempts_set_updated_at
before update on public.custom_checkout_payment_attempts
for each row execute function public.set_updated_at();

alter table public.custom_checkout_sessions enable row level security;
alter table public.custom_checkout_sessions force row level security;
alter table public.custom_checkout_payment_attempts enable row level security;
alter table public.custom_checkout_payment_attempts force row level security;
alter table public.custom_checkout_payment_events enable row level security;
alter table public.custom_checkout_payment_events force row level security;

revoke all on table public.custom_checkout_sessions from public, anon, authenticated;
revoke all on table public.custom_checkout_payment_attempts from public, anon, authenticated;
revoke all on table public.custom_checkout_payment_events from public, anon, authenticated;
grant all on table public.custom_checkout_sessions to service_role;
grant all on table public.custom_checkout_payment_attempts to service_role;
grant all on table public.custom_checkout_payment_events to service_role;

-- Creates the personal workspace needed by the configurator without forcing a
-- separate profile form. The Delivery step subsequently replaces fallback names
-- and saves the customer's phone, GSTIN, shipping and billing addresses.
create function public.ensure_personal_customer_account(
  p_terms_version text,
  p_privacy_version text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_metadata jsonb;
  v_full_name text;
  v_first_name text;
  v_last_name text;
  v_organization_id uuid;
  v_display_name text;
  v_slug text;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  select email::text, raw_user_meta_data
  into v_email, v_metadata
  from auth.users
  where id = v_user_id
    and email_confirmed_at is not null;

  if v_email is null then
    raise exception 'verified email required';
  end if;
  if p_terms_version <> '2026-07-29' or p_privacy_version <> '2026-07-29' then
    raise exception 'current legal terms must be accepted';
  end if;

  select membership.organization_id
  into v_organization_id
  from public.organization_members as membership
  where membership.user_id = v_user_id
    and membership.status = 'active'
  order by membership.created_at
  limit 1;

  if v_organization_id is not null then
    return v_organization_id;
  end if;

  v_full_name := btrim(coalesce(
    nullif(v_metadata ->> 'full_name', ''),
    nullif(v_metadata ->> 'name', ''),
    split_part(v_email, '@', 1)
  ));
  v_first_name := left(coalesce(
    nullif(v_metadata ->> 'given_name', ''),
    nullif(split_part(v_full_name, ' ', 1), ''),
    'Customer'
  ), 80);
  v_last_name := left(coalesce(
    nullif(v_metadata ->> 'family_name', ''),
    nullif(btrim(substr(v_full_name, char_length(split_part(v_full_name, ' ', 1)) + 1)), '')
  ), 80);
  if v_last_name is null then
    v_last_name := 'Account';
  end if;
  v_display_name := left(btrim(v_first_name || ' ' || v_last_name), 120);

  insert into public.profiles (
    id,
    first_name,
    last_name,
    onboarding_completed_at,
    terms_accepted_at,
    terms_version,
    privacy_accepted_at,
    privacy_version
  )
  values (
    v_user_id,
    v_first_name,
    v_last_name,
    now(),
    now(),
    p_terms_version,
    now(),
    p_privacy_version
  )
  on conflict (id) do update
  set
    terms_accepted_at = coalesce(public.profiles.terms_accepted_at, excluded.terms_accepted_at),
    terms_version = coalesce(public.profiles.terms_version, excluded.terms_version),
    privacy_accepted_at = coalesce(public.profiles.privacy_accepted_at, excluded.privacy_accepted_at),
    privacy_version = coalesce(public.profiles.privacy_version, excluded.privacy_version);

  v_slug := trim(both '-' from regexp_replace(lower(v_display_name), '[^a-z0-9]+', '-', 'g'));
  if char_length(v_slug) < 2 then v_slug := 'customer'; end if;
  v_slug := left(v_slug, 67) || '-' || left(replace(gen_random_uuid()::text, '-', ''), 12);

  insert into public.organizations (
    legal_name,
    display_name,
    slug,
    billing_email,
    created_by
  )
  values (
    v_display_name,
    v_display_name,
    v_slug,
    v_email,
    v_user_id
  )
  returning id into v_organization_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    status,
    accepted_at
  )
  values (v_organization_id, v_user_id, 'owner', 'active', now());

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
    'organization.personal_workspace_created',
    'organization',
    v_organization_id,
    v_organization_id,
    jsonb_build_object('role', 'owner', 'source', 'automatic_customer_login')
  );

  return v_organization_id;
end;
$$;

revoke all on function public.ensure_personal_customer_account(text, text)
  from public, anon, authenticated;
grant execute on function public.ensure_personal_customer_account(text, text)
  to authenticated, service_role;

comment on table public.custom_checkout_sessions is
  'Temporary, service-only custom checkout payloads. A durable order is created only after PayU verification succeeds.';
comment on function public.ensure_personal_customer_account(text, text) is
  'Creates a fallback personal customer workspace after verified login so missing profile data can be completed in the Delivery step.';
