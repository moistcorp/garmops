-- Garmops production-v1 baseline for a new, empty application schema.
-- Existing deployments already record this version as applied. On a fresh setup
-- the historical version markers before this file create no objects, so this
-- baseline can build the current schema without deleting anything. If any public
-- relations already exist, fail closed and require an explicit reviewed upgrade.

begin;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
  ) then
    raise exception 'PRODUCTION_BASELINE_REQUIRES_EMPTY_PUBLIC_SCHEMA';
  end if;
end;
$$;

create schema if not exists public;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
alter default privileges in schema public grant all on tables to postgres, service_role;
alter default privileges in schema public grant all on sequences to postgres, service_role;
alter default privileges in schema public grant execute on functions to postgres, service_role;

create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.account_type as enum ('customer', 'staff');
create type public.staff_role as enum ('founder', 'operations');
create type public.order_type as enum ('custom_bulk', 'sample_purchase', 'reorder');
create type public.order_source as enum ('customer_checkout', 'staff_payment_link', 'reorder');
create type public.order_status as enum (
  'payment_confirmed',
  'order_review',
  'artwork_pending',
  'artwork_approved',
  'production_approved',
  'material_preparation',
  'printing_embroidery',
  'stitching',
  'quality_check',
  'packing',
  'ready_to_dispatch',
  'dispatched',
  'delivered',
  'on_hold',
  'cancelled',
  'refund_pending',
  'refunded'
);
create type public.public_order_status as enum (
  'order_received',
  'artwork_under_review',
  'approved_for_production',
  'in_production',
  'quality_check_and_packing',
  'preparing_dispatch',
  'shipped',
  'delivered',
  'action_required',
  'cancelled'
);
create type public.payment_status as enum (
  'created', 'initiated', 'pending', 'paid', 'failed', 'cancelled',
  'duplicate_success', 'refunded', 'partially_refunded', 'disputed'
);
create type public.payment_purpose as enum ('order_full', 'shipping', 'refund');
create type public.invoice_kind as enum ('tax_invoice', 'credit_note');
create type public.invoice_sync_status as enum (
  'queued', 'processing', 'completed', 'retryable_failure',
  'permanent_failure', 'voided'
);
create type public.file_visibility as enum ('customer', 'staff_only');
create type public.file_kind as enum (
  'customer_artwork', 'approval_pdf', 'proof', 'invoice_pdf', 'qc_photo',
  'packing_list', 'shipping_label', 'shipment_document', 'other'
);
create type public.file_scan_status as enum (
  'pending', 'manual_review', 'clean', 'rejected', 'not_required'
);
create type public.artwork_review_status as enum (
  'pending_review', 'approved', 'changes_requested', 'rejected'
);
create type public.discount_kind as enum ('percentage', 'fixed');
create type public.shipping_payment_status as enum (
  'not_required', 'awaiting_quote', 'link_created', 'paid', 'waived'
);
create type public.quote_status as enum ('draft', 'sent', 'expired', 'paid', 'cancelled');

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null check (first_name = btrim(first_name) and char_length(first_name) between 1 and 80),
  last_name text not null check (last_name = btrim(last_name) and char_length(last_name) between 1 and 80),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  job_title text check (job_title is null or char_length(btrim(job_title)) between 1 and 120),
  department text check (department is null or char_length(btrim(department)) between 1 and 120),
  locale text not null default 'en-IN',
  timezone text not null default 'Asia/Kolkata',
  onboarding_completed_at timestamptz,
  terms_accepted_at timestamptz,
  terms_version text,
  privacy_accepted_at timestamptz,
  privacy_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create table public.account_principals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  normalized_email extensions.citext not null unique,
  account_type public.account_type not null,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (normalized_email::text = lower(btrim(normalized_email::text)))
);
create trigger account_principals_set_updated_at before update on public.account_principals
for each row execute function public.set_updated_at();

create table public.staff_members (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email extensions.citext not null unique,
  role public.staff_role not null,
  active boolean not null default true,
  must_use_mfa boolean not null default true,
  mfa_enrolled_at timestamptz,
  invited_by uuid references public.profiles(id),
  invited_at timestamptz,
  activated_at timestamptz,
  deactivated_at timestamptz,
  last_staff_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email::text = lower(btrim(email::text))),
  check (deactivated_at is null or active = false)
);
create trigger staff_members_set_updated_at before update on public.staff_members
for each row execute function public.set_updated_at();

create table public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null,
  role public.staff_role not null,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  invited_by uuid not null references public.staff_members(user_id),
  auth_user_id uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (email, status)
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text check (label is null or char_length(btrim(label)) between 1 and 80),
  contact_name text check (contact_name is null or char_length(btrim(contact_name)) between 1 and 160),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  line1 text not null check (char_length(btrim(line1)) between 1 and 200),
  line2 text check (line2 is null or char_length(btrim(line2)) between 1 and 200),
  landmark text check (landmark is null or char_length(btrim(landmark)) between 1 and 160),
  city text not null check (char_length(btrim(city)) between 1 and 100),
  state text not null check (char_length(btrim(state)) between 1 and 100),
  postal_code text not null check (postal_code ~ '^[1-9][0-9]{5}$'),
  country_code text not null default 'IN' check (country_code = 'IN'),
  is_default_billing boolean not null default false,
  is_default_shipping boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger addresses_set_updated_at before update on public.addresses
for each row execute function public.set_updated_at();
create unique index addresses_default_billing_user_idx on public.addresses(user_id) where is_default_billing;
create unique index addresses_default_shipping_user_idx on public.addresses(user_id) where is_default_shipping;

create table public.customer_billing_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  profile_type text not null default 'personal' check (profile_type in ('personal','business')),
  legal_business_name text check (legal_business_name is null or char_length(btrim(legal_business_name)) between 1 and 200),
  gstin text check (gstin is null or upper(btrim(gstin)) ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  billing_email extensions.citext,
  billing_address jsonb check (billing_address is null or jsonb_typeof(billing_address) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index customer_billing_profiles_gstin_idx on public.customer_billing_profiles(upper(gstin)) where gstin is not null;
create trigger customer_billing_profiles_set_updated_at before update on public.customer_billing_profiles
for each row execute function public.set_updated_at();

create table public.design_projects (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  status text not null default 'draft' check (status in ('draft','submitted','archived')),
  schema_version integer not null check (schema_version > 0),
  current_version integer not null default 1 check (current_version > 0),
  draft_revision integer not null default 1 check (draft_revision > 0),
  draft_snapshot jsonb not null check (jsonb_typeof(draft_snapshot) = 'object'),
  pricing_input_snapshot jsonb check (pricing_input_snapshot is null or jsonb_typeof(pricing_input_snapshot) = 'object'),
  source text not null default 'configurator',
  client_import_id text,
  last_saved_at timestamptz not null default now(),
  submitted_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (created_by, client_import_id)
);
create trigger design_projects_set_updated_at before update on public.design_projects
for each row execute function public.set_updated_at();
create index design_projects_owner_updated_idx on public.design_projects(created_by, updated_at desc);

create table public.design_project_versions (
  id uuid primary key default gen_random_uuid(),
  design_project_id uuid not null references public.design_projects(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  configuration_snapshot jsonb not null check (jsonb_typeof(configuration_snapshot) = 'object'),
  pricing_input_snapshot jsonb check (pricing_input_snapshot is null or jsonb_typeof(pricing_input_snapshot) = 'object'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (design_project_id, version_number)
);

create table public.number_counters (
  namespace text not null check (namespace in ('custom_order','sample_order','quote','invoice')),
  calendar_year integer not null check (calendar_year between 2020 and 9999),
  next_value bigint not null default 1 check (next_value > 0),
  primary key (namespace, calendar_year)
);

create table public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code extensions.citext not null unique,
  description text,
  kind public.discount_kind not null,
  percentage_basis_points integer check (percentage_basis_points is null or percentage_basis_points between 1 and 10000),
  fixed_amount_paise bigint check (fixed_amount_paise is null or fixed_amount_paise > 0),
  maximum_discount_paise bigint check (maximum_discount_paise is null or maximum_discount_paise > 0),
  minimum_subtotal_paise bigint not null default 0 check (minimum_subtotal_paise >= 0),
  maximum_redemptions integer check (maximum_redemptions is null or maximum_redemptions > 0),
  maximum_redemptions_per_customer integer not null default 1 check (maximum_redemptions_per_customer > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_by uuid not null references public.staff_members(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (code::text = upper(btrim(code::text)) and code::text ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'),
  check (
    (kind = 'percentage' and percentage_basis_points is not null and fixed_amount_paise is null)
    or (kind = 'fixed' and fixed_amount_paise is not null and percentage_basis_points is null)
  ),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create trigger discount_codes_set_updated_at before update on public.discount_codes
for each row execute function public.set_updated_at();

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique check (order_number ~ '^(GAR|SAM)-[0-9]{4}-[0-9]{6}$'),
  order_type public.order_type not null,
  order_source public.order_source not null,
  customer_user_id uuid not null references public.profiles(id),
  created_by_staff_user_id uuid references public.staff_members(user_id),
  design_project_id uuid references public.design_projects(id),
  design_version_id uuid references public.design_project_versions(id),
  status public.order_status not null,
  public_status public.public_order_status not null,
  currency char(3) not null default 'INR' check (currency = 'INR'),
  subtotal_paise bigint not null check (subtotal_paise >= 0),
  discount_paise bigint not null default 0 check (discount_paise >= 0),
  taxable_value_paise bigint not null check (taxable_value_paise >= 0),
  tax_paise bigint not null check (tax_paise >= 0),
  total_paise bigint not null check (total_paise >= 0),
  amount_paid_paise bigint not null default 0 check (amount_paid_paise >= 0),
  discount_code_id uuid references public.discount_codes(id),
  discount_code_snapshot text,
  pricing_version text not null,
  configuration_schema_version integer not null check (configuration_schema_version > 0),
  customer_reference text,
  requested_delivery_date date,
  estimated_dispatch_at timestamptz,
  internal_priority text not null default 'normal' check (internal_priority in ('low','normal','high','urgent')),
  assigned_staff_user_id uuid references public.staff_members(user_id),
  billing_snapshot jsonb not null check (jsonb_typeof(billing_snapshot) = 'object'),
  shipping_snapshot jsonb not null check (jsonb_typeof(shipping_snapshot) = 'object'),
  customer_snapshot jsonb not null check (jsonb_typeof(customer_snapshot) = 'object'),
  business_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(business_snapshot) = 'object'),
  terms_snapshot jsonb not null check (jsonb_typeof(terms_snapshot) = 'object'),
  configuration_snapshot jsonb not null check (jsonb_typeof(configuration_snapshot) = 'object'),
  configuration_revision integer not null default 1 check (configuration_revision > 0),
  shipping_charge_paise bigint check (shipping_charge_paise is null or shipping_charge_paise >= 0),
  shipping_payment_status public.shipping_payment_status not null default 'awaiting_quote',
  shipping_payment_link_url text,
  shipping_payment_reference text,
  shipping_paid_at timestamptz,
  confirmed_at timestamptz not null default now(),
  artwork_approved_at timestamptz,
  production_started_at timestamptz,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_paise <= subtotal_paise),
  check (taxable_value_paise = subtotal_paise - discount_paise),
  check (total_paise = taxable_value_paise + tax_paise),
  check (amount_paid_paise <= total_paise),
  check ((shipping_payment_status <> 'link_created') or shipping_payment_link_url is not null)
);
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();
create index orders_customer_created_idx on public.orders(customer_user_id, created_at desc);
create index orders_staff_queue_idx on public.orders(status, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  line_number integer not null check (line_number > 0),
  product_id text not null,
  product_slug text not null,
  product_name text not null,
  product_snapshot jsonb not null check (jsonb_typeof(product_snapshot) = 'object'),
  colour_snapshot jsonb not null check (jsonb_typeof(colour_snapshot) = 'object'),
  decoration_snapshot jsonb not null check (jsonb_typeof(decoration_snapshot) = 'object'),
  artwork_snapshot jsonb not null check (jsonb_typeof(artwork_snapshot) = 'object'),
  neck_label_snapshot jsonb,
  size_breakdown jsonb not null check (jsonb_typeof(size_breakdown) = 'object'),
  quantity integer not null check (quantity > 0),
  unit_price_paise bigint not null check (unit_price_paise >= 0),
  line_total_paise bigint not null check (line_total_paise = unit_price_paise * quantity),
  created_at timestamptz not null default now(),
  unique (order_id, line_number)
);

create table public.order_configuration_revisions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  revision_number integer not null,
  previous_snapshot jsonb not null,
  next_snapshot jsonb not null,
  changed_by uuid not null references public.staff_members(user_id),
  reason text not null check (char_length(btrim(reason)) between 3 and 1000),
  changed_paths text[] not null,
  created_at timestamptz not null default now(),
  unique(order_id, revision_number)
);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  public_status public.public_order_status not null,
  actor_type text not null check (actor_type in ('system','customer','staff')),
  actor_user_id uuid references auth.users(id),
  customer_visible boolean not null default true,
  customer_message text,
  internal_note text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history(order_id, created_at);

create table public.cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  requested_by uuid not null references public.staff_members(user_id),
  reason text not null check (char_length(btrim(reason)) between 3 and 1000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by uuid references public.staff_members(user_id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index cancellation_requests_one_pending_idx on public.cancellation_requests(order_id) where status = 'pending';

create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  attempt_number integer not null check (attempt_number between 1 and 99),
  provider text not null default 'payu' check (provider = 'payu'),
  provider_merchant_txn_id text not null unique,
  provider_payment_id text,
  purpose public.payment_purpose not null,
  amount_paise bigint not null check (amount_paise > 0),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  status public.payment_status not null default 'created',
  expected_product_info text not null,
  customer_email extensions.citext not null,
  customer_name text not null,
  failure_code text,
  failure_message text,
  raw_verified_snapshot jsonb,
  initiated_at timestamptz,
  paid_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id, purpose, attempt_number)
);
create trigger payment_attempts_set_updated_at before update on public.payment_attempts
for each row execute function public.set_updated_at();
create unique index payment_attempts_one_paid_purpose_idx on public.payment_attempts(order_id, purpose) where status = 'paid';

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_attempt_id uuid not null references public.payment_attempts(id) on delete cascade,
  provider text not null default 'payu',
  event_source text not null check (event_source in ('callback','webhook','verify_api','reconciliation','manual')),
  provider_event_id text,
  event_fingerprint text not null,
  event_type text not null,
  authentic boolean not null default false,
  processed boolean not null default false,
  processed_at timestamptz,
  processing_error text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique(provider, event_fingerprint)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  kind public.invoice_kind not null,
  invoice_number text unique,
  status public.invoice_sync_status not null default 'queued',
  currency char(3) not null default 'INR' check (currency = 'INR'),
  subtotal_paise bigint not null,
  discount_paise bigint not null default 0,
  taxable_value_paise bigint not null,
  tax_paise bigint not null,
  total_paise bigint not null,
  paid_paise bigint not null default 0,
  line_items jsonb not null check (jsonb_typeof(line_items) = 'array'),
  seller_snapshot jsonb not null,
  buyer_snapshot jsonb not null,
  place_of_supply text,
  pdf_file_id uuid,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (taxable_value_paise = subtotal_paise - discount_paise),
  check (total_paise = taxable_value_paise + tax_paise),
  check (paid_paise <= total_paise),
  unique(order_id, kind)
);
create trigger invoices_set_updated_at before update on public.invoices
for each row execute function public.set_updated_at();

create table public.order_files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  design_project_id uuid references public.design_projects(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  kind public.file_kind not null,
  visibility public.file_visibility not null,
  bucket_name text not null default 'garmops-private-orders' check (bucket_name = 'garmops-private-orders'),
  object_key text not null unique,
  original_filename text not null,
  safe_filename text not null,
  extension text not null,
  content_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 52428800),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  object_etag text,
  upload_status text not null default 'pending' check (upload_status in ('pending','finalized','failed')),
  upload_expires_at timestamptz,
  finalized_at timestamptz,
  scan_status public.file_scan_status not null default 'pending',
  review_status public.artwork_review_status not null default 'pending_review',
  reviewed_by uuid references public.staff_members(user_id),
  reviewed_at timestamptz,
  review_reason text,
  replacement_for_file_id uuid references public.order_files(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (order_id is not null or design_project_id is not null)
);
create trigger order_files_set_updated_at before update on public.order_files
for each row execute function public.set_updated_at();
create index order_files_design_idx on public.order_files(design_project_id, created_at desc) where deleted_at is null;
create index order_files_order_idx on public.order_files(order_id, created_at desc) where deleted_at is null;
alter table public.invoices add constraint invoices_pdf_file_fk foreign key (pdf_file_id) references public.order_files(id) on delete set null;

create table public.discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_code_id uuid not null references public.discount_codes(id),
  customer_user_id uuid not null references public.profiles(id),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  discount_paise bigint not null check (discount_paise > 0),
  redeemed_at timestamptz not null default now()
);

create table public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  checkout_session_id uuid,
  order_id uuid references public.orders(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  terms_content_hash text not null check (terms_content_hash ~ '^[0-9a-f]{64}$'),
  source_flow text not null,
  request_metadata jsonb not null default '{}'::jsonb,
  accepted_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  actor_type text not null check (actor_type in ('system','customer','staff')),
  action text not null,
  target_type text not null,
  target_id uuid,
  order_id uuid references public.orders(id) on delete set null,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_order_idx on public.audit_logs(order_id, created_at desc);

create table public.integration_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  deduplication_key text not null unique,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status text not null default 'queued' check (status in ('queued','processing','completed','retryable_failure','permanent_failure')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger integration_jobs_set_updated_at before update on public.integration_jobs
for each row execute function public.set_updated_at();
create index integration_jobs_claim_idx on public.integration_jobs(status, available_at, created_at);

create table public.auth_rate_limits (
  scope text not null,
  subject_hash text not null,
  window_started_at timestamptz not null,
  attempts integer not null default 0,
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key(scope, subject_hash)
);

create table public.custom_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references public.profiles(id) on delete cascade,
  cart_id text not null check (char_length(btrim(cart_id)) between 1 and 160),
  idempotency_key uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'prepared' check (status in ('prepared','payment_initiated','payment_pending','payment_verified','finalized','failed','expired')),
  rpc_payload jsonb not null check (jsonb_typeof(rpc_payload) = 'object'),
  subtotal_paise bigint not null check (subtotal_paise >= 0),
  discount_paise bigint not null default 0 check (discount_paise >= 0),
  tax_paise bigint not null check (tax_paise >= 0),
  total_paise bigint not null check (total_paise > 0),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  discount_code_id uuid references public.discount_codes(id),
  return_path text not null check (return_path like '/%'),
  final_order_id uuid references public.orders(id),
  final_payment_attempt_id uuid references public.payment_attempts(id),
  final_order_number text,
  provider_payment_id text,
  verified_snapshot jsonb,
  expires_at timestamptz not null,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(customer_user_id, idempotency_key),
  check (total_paise = subtotal_paise - discount_paise + tax_paise),
  check (expires_at > created_at),
  check (status <> 'finalized' or (final_order_id is not null and final_payment_attempt_id is not null and final_order_number is not null))
);
create trigger custom_checkout_sessions_set_updated_at before update on public.custom_checkout_sessions
for each row execute function public.set_updated_at();

create table public.custom_checkout_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  checkout_session_id uuid not null references public.custom_checkout_sessions(id) on delete cascade,
  attempt_number integer not null check (attempt_number between 1 and 99),
  provider text not null default 'payu' check (provider = 'payu'),
  provider_merchant_txn_id text not null unique,
  provider_payment_id text,
  amount_paise bigint not null check (amount_paise > 0),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  status public.payment_status not null default 'created',
  expected_product_info text not null,
  customer_email extensions.citext not null,
  customer_name text not null,
  customer_phone text not null check (customer_phone ~ '^\+[1-9][0-9]{7,14}$'),
  failure_code text,
  failure_message text,
  raw_verified_snapshot jsonb,
  initiated_at timestamptz,
  paid_at timestamptz,
  failed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(checkout_session_id, attempt_number)
);
create trigger custom_checkout_payment_attempts_set_updated_at before update on public.custom_checkout_payment_attempts
for each row execute function public.set_updated_at();
create unique index custom_checkout_one_paid_attempt_idx on public.custom_checkout_payment_attempts(checkout_session_id) where status = 'paid';

create table public.custom_checkout_payment_events (
  id uuid primary key default gen_random_uuid(),
  checkout_payment_attempt_id uuid not null references public.custom_checkout_payment_attempts(id) on delete cascade,
  provider text not null default 'payu',
  event_source text not null check (event_source in ('callback','webhook','verify_api','reconciliation')),
  provider_event_id text,
  event_fingerprint text not null,
  event_type text not null,
  authentic boolean not null default false,
  processed boolean not null default false,
  processed_at timestamptz,
  processing_error text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique(provider, event_fingerprint)
);

create table public.staff_quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique check (quote_number ~ '^EST-[0-9]{4}-[0-9]{6}$'),
  created_by uuid not null references public.staff_members(user_id),
  customer_email extensions.citext not null,
  customer_name text not null,
  customer_phone text not null,
  configuration_snapshot jsonb not null,
  pricing_snapshot jsonb not null,
  billing_snapshot jsonb not null,
  shipping_snapshot jsonb not null,
  subtotal_paise bigint not null,
  discount_paise bigint not null default 0,
  tax_paise bigint not null,
  total_paise bigint not null,
  discount_code_id uuid references public.discount_codes(id),
  status public.quote_status not null default 'draft',
  payment_token_hash text unique,
  expires_at timestamptz not null,
  sent_at timestamptz,
  final_order_id uuid references public.orders(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_paise = subtotal_paise - discount_paise + tax_paise)
);
create trigger staff_quotes_set_updated_at before update on public.staff_quotes
for each row execute function public.set_updated_at();

-- Account and authorization helpers.
create function public.current_account_type()
returns public.account_type
language sql
stable
security definer
set search_path = ''
as $$
  select p.account_type
  from public.account_principals p
  where p.user_id = auth.uid() and p.active
  limit 1
$$;

create function public.current_staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select s.role
  from public.staff_members s
  join public.account_principals p on p.user_id = s.user_id
  where s.user_id = auth.uid()
    and s.active
    and s.deactivated_at is null
    and p.account_type = 'staff'
    and p.active
  limit 1
$$;

create function public.staff_mfa_satisfied()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;

create function public.is_active_staff(p_require_mfa boolean default true)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_staff_role() is not null
    and (not p_require_mfa or public.staff_mfa_satisfied())
$$;

create function public.staff_has_permission(p_permission text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_role public.staff_role := public.current_staff_role();
begin
  if v_role is null then return false; end if;
  if not public.staff_mfa_satisfied() then return false; end if;
  return case p_permission
    when 'view_all_orders' then true
    when 'change_order_status' then true
    when 'review_artwork' then true
    when 'edit_order_configuration' then true
    when 'create_staff_quote' then true
    when 'manage_staff' then v_role = 'founder'
    when 'manage_discounts' then v_role = 'founder'
    when 'manage_refunds' then v_role = 'founder'
    when 'view_raw_payments' then v_role = 'founder'
    when 'override_order_workflow' then v_role = 'founder'
    else false
  end;
end;
$$;

create function public.ensure_customer_account(p_terms_version text, p_privacy_version text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_meta jsonb;
  v_first text;
  v_last text;
  v_existing public.account_principals%rowtype;
begin
  if v_user_id is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  select lower(email::text), raw_user_meta_data into v_email, v_meta
  from auth.users where id = v_user_id and email_confirmed_at is not null;
  if v_email is null then raise exception 'VERIFIED_EMAIL_REQUIRED'; end if;

  select * into v_existing from public.account_principals
  where normalized_email = v_email or user_id = v_user_id
  order by created_at limit 1;
  if found and (v_existing.account_type <> 'customer' or (v_existing.user_id is not null and v_existing.user_id <> v_user_id)) then
    raise exception 'ACCOUNT_TYPE_CONFLICT';
  end if;

  v_first := left(coalesce(nullif(v_meta ->> 'given_name',''), nullif(split_part(coalesce(v_meta ->> 'full_name', split_part(v_email,'@',1)), ' ', 1),''), 'Customer'), 80);
  v_last := left(coalesce(nullif(v_meta ->> 'family_name',''), 'Account'), 80);

  insert into public.profiles(id, first_name, last_name, onboarding_completed_at, terms_accepted_at, terms_version, privacy_accepted_at, privacy_version)
  values(v_user_id, v_first, v_last, now(), now(), p_terms_version, now(), p_privacy_version)
  on conflict(id) do update set
    terms_accepted_at = coalesce(public.profiles.terms_accepted_at, excluded.terms_accepted_at),
    terms_version = coalesce(public.profiles.terms_version, excluded.terms_version),
    privacy_accepted_at = coalesce(public.profiles.privacy_accepted_at, excluded.privacy_accepted_at),
    privacy_version = coalesce(public.profiles.privacy_version, excluded.privacy_version);

  insert into public.account_principals(user_id, normalized_email, account_type, active, created_by)
  values(v_user_id, v_email, 'customer', true, v_user_id)
  on conflict(normalized_email) do update set user_id = excluded.user_id, active = true
  where public.account_principals.account_type = 'customer'
    and (public.account_principals.user_id is null or public.account_principals.user_id = excluded.user_id);

  if not exists(select 1 from public.account_principals where user_id = v_user_id and account_type = 'customer' and active) then
    raise exception 'ACCOUNT_TYPE_CONFLICT';
  end if;
  return v_user_id;
end;
$$;

create function public.complete_customer_onboarding(
  p_first_name text, p_last_name text, p_phone text, p_department text,
  p_terms_version text, p_privacy_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.ensure_customer_account(p_terms_version, p_privacy_version);
  update public.profiles set
    first_name = btrim(p_first_name), last_name = btrim(p_last_name),
    phone = nullif(btrim(p_phone),''), department = nullif(btrim(p_department),''),
    onboarding_completed_at = now()
  where id = auth.uid();
end;
$$;

create function public.record_staff_login()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_staff_role() is null then raise exception 'STAFF_ACCESS_DENIED'; end if;
  update public.staff_members set last_staff_login_at = now(), activated_at = coalesce(activated_at, now()) where user_id = auth.uid();
end;
$$;

create function public.get_staff_access_context()
returns table(role public.staff_role, active boolean, must_use_mfa boolean, mfa_satisfied boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select s.role, s.active and s.deactivated_at is null and p.active,
         s.must_use_mfa, public.staff_mfa_satisfied()
  from public.staff_members s
  join public.account_principals p on p.user_id = s.user_id and p.account_type = 'staff'
  where s.user_id = auth.uid()
$$;

create function public.record_staff_mfa_enrollment()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_staff_role() is null or not public.staff_mfa_satisfied() then
    raise exception 'STAFF_MFA_REQUIRED';
  end if;
  update public.staff_members set mfa_enrolled_at=coalesce(mfa_enrolled_at,now()) where user_id=auth.uid();
end;
$$;

-- Cloud design RPCs. Ownership is always the authenticated customer; there is
-- no organization-based sharing.
create function public.create_cloud_design(
  p_title text, p_schema_version integer, p_configuration_snapshot jsonb,
  p_pricing_input_snapshot jsonb default null, p_source text default 'configurator',
  p_client_import_id text default null
)
returns table(design_project_id uuid, design_version_id uuid, draft_revision integer, version_number integer, last_saved_at timestamptz, created_new boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_project public.design_projects%rowtype; v_version uuid;
begin
  if public.current_account_type() <> 'customer' then raise exception 'CUSTOMER_ACCESS_REQUIRED'; end if;
  if p_client_import_id is not null then
    select * into v_project from public.design_projects where created_by = v_user and client_import_id = p_client_import_id;
    if found then
      select id into v_version from public.design_project_versions where design_project_id=v_project.id and version_number=v_project.current_version;
      return query select v_project.id, v_version, v_project.draft_revision, v_project.current_version, v_project.last_saved_at, false;
      return;
    end if;
  end if;
  insert into public.design_projects(created_by,title,schema_version,draft_snapshot,pricing_input_snapshot,source,client_import_id)
  values(v_user,btrim(p_title),p_schema_version,p_configuration_snapshot,p_pricing_input_snapshot,btrim(p_source),p_client_import_id)
  returning * into v_project;
  insert into public.design_project_versions(design_project_id,version_number,configuration_snapshot,pricing_input_snapshot,created_by)
  values(v_project.id,1,p_configuration_snapshot,p_pricing_input_snapshot,v_user) returning id into v_version;
  return query select v_project.id,v_version,1,1,v_project.last_saved_at,true;
end;
$$;

create function public.save_cloud_design_draft(
  p_design_project_id uuid, p_expected_revision integer, p_schema_version integer,
  p_configuration_snapshot jsonb, p_pricing_input_snapshot jsonb default null,
  p_title text default null
)
returns table(conflict boolean, draft_revision integer, last_saved_at timestamptz, configuration_snapshot jsonb, pricing_input_snapshot jsonb, title text, status text, current_version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare v_project public.design_projects%rowtype;
begin
  select * into v_project from public.design_projects where id=p_design_project_id and created_by=auth.uid() for update;
  if not found or v_project.status='archived' then raise exception 'DESIGN_NOT_FOUND'; end if;
  if v_project.draft_revision <> p_expected_revision then
    return query select true,v_project.draft_revision,v_project.last_saved_at,v_project.draft_snapshot,v_project.pricing_input_snapshot,v_project.title,v_project.status,v_project.current_version;
    return;
  end if;
  update public.design_projects set
    schema_version=p_schema_version, draft_snapshot=p_configuration_snapshot,
    pricing_input_snapshot=p_pricing_input_snapshot,
    title=coalesce(nullif(btrim(p_title),''),title), draft_revision=draft_revision+1,
    last_saved_at=now()
  where id=p_design_project_id returning * into v_project;
  return query select false,v_project.draft_revision,v_project.last_saved_at,v_project.draft_snapshot,v_project.pricing_input_snapshot,v_project.title,v_project.status,v_project.current_version;
end;
$$;

create function public.create_cloud_design_version(p_design_project_id uuid, p_expected_revision integer)
returns table(conflict boolean, design_version_id uuid, version_number integer, draft_revision integer, last_saved_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare v_project public.design_projects%rowtype; v_id uuid;
begin
  select * into v_project from public.design_projects where id=p_design_project_id and created_by=auth.uid() for update;
  if not found or v_project.status='archived' then raise exception 'DESIGN_NOT_FOUND'; end if;
  if v_project.draft_revision <> p_expected_revision then
    return query select true,null::uuid,v_project.current_version,v_project.draft_revision,v_project.last_saved_at; return;
  end if;
  update public.design_projects set current_version=current_version+1,last_saved_at=now() where id=p_design_project_id returning * into v_project;
  insert into public.design_project_versions(design_project_id,version_number,configuration_snapshot,pricing_input_snapshot,created_by)
  values(v_project.id,v_project.current_version,v_project.draft_snapshot,v_project.pricing_input_snapshot,auth.uid()) returning id into v_id;
  return query select false,v_id,v_project.current_version,v_project.draft_revision,v_project.last_saved_at;
end;
$$;

create function public.duplicate_cloud_design(p_design_project_id uuid,p_title text,p_client_operation_id text)
returns table(design_project_id uuid, design_version_id uuid, draft_revision integer, version_number integer, last_saved_at timestamptz, created_new boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare v_source public.design_projects%rowtype;
begin
  select * into v_source from public.design_projects where id=p_design_project_id and created_by=auth.uid();
  if not found then raise exception 'DESIGN_NOT_FOUND'; end if;
  return query select * from public.create_cloud_design(p_title,v_source.schema_version,v_source.draft_snapshot,v_source.pricing_input_snapshot,'duplicate',p_client_operation_id);
end;
$$;

create function public.archive_cloud_design(p_design_project_id uuid,p_expected_revision integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.design_projects set status='archived',archived_at=now(),draft_revision=draft_revision+1
  where id=p_design_project_id and created_by=auth.uid() and draft_revision=p_expected_revision and status<>'archived';
  return found;
end;
$$;

-- Upload functions.
create function public.create_private_upload_slot(
  p_order_id uuid, p_design_project_id uuid, p_kind public.file_kind,
  p_visibility public.file_visibility, p_original_filename text,
  p_safe_filename text, p_content_type text, p_byte_size bigint,
  p_extension text, p_sha256 text, p_expires_at timestamptz
)
returns table(file_id uuid, object_key text)
language plpgsql
security definer
set search_path = ''
as $$
declare v_file uuid := gen_random_uuid(); v_owner uuid := auth.uid(); v_key text; v_total bigint; v_count bigint;
begin
  if v_owner is null or public.current_account_type() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if (p_order_id is null) = (p_design_project_id is null) then raise exception 'UPLOAD_TARGET_REQUIRED'; end if;
  if p_byte_size <= 0 or p_byte_size > 52428800 then raise exception 'FILE_SIZE_INVALID'; end if;
  if public.current_account_type()='customer' then
    if p_kind <> 'customer_artwork' or p_visibility <> 'customer' then raise exception 'CUSTOMER_UPLOAD_KIND_DENIED'; end if;
    if p_order_id is not null and not exists(select 1 from public.orders where id=p_order_id and customer_user_id=v_owner) then raise exception 'UPLOAD_TARGET_DENIED'; end if;
    if p_design_project_id is not null and not exists(select 1 from public.design_projects where id=p_design_project_id and created_by=v_owner) then raise exception 'UPLOAD_TARGET_DENIED'; end if;
  elsif not public.is_active_staff(true) then raise exception 'STAFF_MFA_REQUIRED'; end if;

  select count(*),coalesce(sum(byte_size),0) into v_count,v_total from public.order_files
  where deleted_at is null and upload_status in ('pending','finalized')
    and ((p_order_id is not null and order_id=p_order_id) or (p_design_project_id is not null and design_project_id=p_design_project_id));
  if p_kind='customer_artwork' and v_count >= 10 then raise exception 'FILE_COUNT_LIMIT'; end if;
  if v_total + p_byte_size > 262144000 then raise exception 'FILE_TOTAL_LIMIT'; end if;

  v_key := 'private/' || to_char(now(),'YYYY/MM') || '/' || v_file::text || '/' || regexp_replace(p_safe_filename,'[^A-Za-z0-9._-]','_','g');
  insert into public.order_files(id,order_id,design_project_id,uploaded_by,kind,visibility,object_key,original_filename,safe_filename,extension,content_type,byte_size,sha256,upload_expires_at)
  values(v_file,p_order_id,p_design_project_id,v_owner,p_kind,p_visibility,v_key,p_original_filename,p_safe_filename,lower(p_extension),lower(p_content_type),p_byte_size,p_sha256,p_expires_at);
  return query select v_file,v_key;
end;
$$;

create function public.finalize_private_upload(p_file_id uuid,p_actual_byte_size bigint,p_actual_content_type text,p_object_etag text,p_actual_sha256 text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_file public.order_files%rowtype;
begin
  select * into v_file from public.order_files where id=p_file_id for update;
  if not found or v_file.deleted_at is not null or v_file.upload_status <> 'pending' or v_file.upload_expires_at <= now() then return false; end if;
  if auth.role() <> 'service_role' and v_file.uploaded_by <> auth.uid() then return false; end if;
  if v_file.byte_size <> p_actual_byte_size or lower(v_file.content_type) <> lower(p_actual_content_type) then return false; end if;
  if v_file.sha256 is not null and v_file.sha256 <> p_actual_sha256 then return false; end if;
  update public.order_files set upload_status='finalized',object_etag=p_object_etag,
    scan_status=case when kind='customer_artwork' then 'manual_review'::public.file_scan_status else 'not_required'::public.file_scan_status end,
    review_status=case when kind='customer_artwork' then 'pending_review'::public.artwork_review_status else 'approved'::public.artwork_review_status end
  where id=p_file_id;
  return true;
end;
$$;

create function public.soft_delete_file(p_file_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.order_files set deleted_at=now()
  where id=p_file_id and deleted_at is null and (
    uploaded_by=auth.uid() or public.is_active_staff(true)
  );
  return found;
end;
$$;

create function public.review_artwork_file(p_file_id uuid,p_decision public.artwork_review_status,p_reason text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_file public.order_files%rowtype;
begin
  if not public.staff_has_permission('review_artwork') then raise exception 'STAFF_PERMISSION_DENIED'; end if;
  if p_decision not in ('approved','changes_requested','rejected') then raise exception 'INVALID_ARTWORK_DECISION'; end if;
  select * into v_file from public.order_files where id=p_file_id and kind='customer_artwork' and deleted_at is null and upload_status='finalized' for update;
  if not found then raise exception 'FILE_NOT_FOUND'; end if;
  if p_decision <> 'approved' and nullif(btrim(p_reason),'') is null then raise exception 'REASON_REQUIRED'; end if;
  update public.order_files set review_status=p_decision,review_reason=nullif(btrim(p_reason),''),reviewed_by=auth.uid(),reviewed_at=now(),
    scan_status=case when p_decision='approved' then 'clean'::public.file_scan_status when p_decision='rejected' then 'rejected'::public.file_scan_status else 'manual_review'::public.file_scan_status end
  where id=p_file_id;
  insert into public.audit_logs(actor_user_id,actor_type,action,target_type,target_id,order_id,after_state)
  values(auth.uid(),'staff','artwork.reviewed','order_file',p_file_id,v_file.order_id,jsonb_build_object('decision',p_decision,'reason',p_reason));
  return true;
end;
$$;

-- Numbering and status helpers.
create function public.next_number(p_namespace text,p_prefix text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_year integer := extract(year from timezone('Asia/Kolkata',now())); v_value bigint;
begin
  insert into public.number_counters(namespace,calendar_year,next_value) values(p_namespace,v_year,2)
  on conflict(namespace,calendar_year) do update set next_value=public.number_counters.next_value+1
  returning next_value-1 into v_value;
  return p_prefix || '-' || v_year::text || '-' || lpad(v_value::text,6,'0');
end;
$$;

create function public.order_public_status_for_internal(p_status public.order_status)
returns public.public_order_status
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'payment_confirmed' then 'order_received'::public.public_order_status
    when 'order_review' then 'order_received'::public.public_order_status
    when 'artwork_pending' then 'artwork_under_review'::public.public_order_status
    when 'artwork_approved' then 'approved_for_production'::public.public_order_status
    when 'production_approved' then 'approved_for_production'::public.public_order_status
    when 'material_preparation' then 'in_production'::public.public_order_status
    when 'printing_embroidery' then 'in_production'::public.public_order_status
    when 'stitching' then 'in_production'::public.public_order_status
    when 'quality_check' then 'quality_check_and_packing'::public.public_order_status
    when 'packing' then 'quality_check_and_packing'::public.public_order_status
    when 'ready_to_dispatch' then 'preparing_dispatch'::public.public_order_status
    when 'dispatched' then 'shipped'::public.public_order_status
    when 'delivered' then 'delivered'::public.public_order_status
    when 'on_hold' then 'action_required'::public.public_order_status
    else 'cancelled'::public.public_order_status
  end
$$;

create function public.is_order_transition_allowed(p_from public.order_status,p_to public.order_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_from
    when 'payment_confirmed' then p_to in ('order_review','on_hold','cancelled')
    when 'order_review' then p_to in ('artwork_pending','artwork_approved','on_hold','cancelled')
    when 'artwork_pending' then p_to in ('artwork_approved','on_hold','cancelled')
    when 'artwork_approved' then p_to in ('production_approved','on_hold','cancelled')
    when 'production_approved' then p_to in ('material_preparation','on_hold','cancelled')
    when 'material_preparation' then p_to in ('printing_embroidery','on_hold','cancelled')
    when 'printing_embroidery' then p_to in ('stitching','on_hold','cancelled')
    when 'stitching' then p_to in ('quality_check','on_hold','cancelled')
    when 'quality_check' then p_to in ('packing','printing_embroidery','on_hold','cancelled')
    when 'packing' then p_to in ('ready_to_dispatch','quality_check','on_hold','cancelled')
    when 'ready_to_dispatch' then p_to in ('dispatched','packing','on_hold','cancelled')
    when 'dispatched' then p_to in ('delivered','on_hold')
    when 'on_hold' then p_to in ('order_review','artwork_pending','artwork_approved','production_approved','material_preparation','printing_embroidery','stitching','quality_check','packing','ready_to_dispatch','cancelled')
    when 'cancelled' then p_to='refund_pending'
    when 'refund_pending' then p_to='refunded'
    else false
  end
$$;

create function public.staff_transition_order(
  p_order_id uuid,p_to_status public.order_status,p_customer_message text default null,
  p_internal_note text default null,p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_order public.orders%rowtype; v_role public.staff_role := public.current_staff_role(); v_public public.public_order_status;
begin
  if not public.staff_has_permission('change_order_status') then raise exception 'STAFF_PERMISSION_DENIED'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if not public.is_order_transition_allowed(v_order.status,p_to_status) then raise exception 'INVALID_STATUS_TRANSITION'; end if;
  if v_role='operations' and p_to_status in ('cancelled','refund_pending','refunded') then raise exception 'FOUNDER_APPROVAL_REQUIRED'; end if;
  if p_to_status in ('cancelled','refund_pending','refunded','on_hold') and nullif(btrim(p_reason),'') is null then raise exception 'REASON_REQUIRED'; end if;
  if p_to_status='production_approved' then
    if v_order.amount_paid_paise <> v_order.total_paise then raise exception 'VERIFIED_PAYMENT_REQUIRED'; end if;
    if exists(select 1 from public.order_files where (order_id=v_order.id or design_project_id=v_order.design_project_id) and kind='customer_artwork' and deleted_at is null and review_status <> 'approved') then raise exception 'ARTWORK_APPROVAL_REQUIRED'; end if;
  end if;
  if p_to_status='dispatched' and v_order.shipping_payment_status not in ('paid','waived','not_required') then raise exception 'SHIPPING_PAYMENT_REQUIRED'; end if;
  v_public := public.order_public_status_for_internal(p_to_status);
  update public.orders set status=p_to_status,public_status=v_public,
    artwork_approved_at=case when p_to_status='artwork_approved' then now() else artwork_approved_at end,
    production_started_at=case when p_to_status='material_preparation' then now() else production_started_at end,
    dispatched_at=case when p_to_status='dispatched' then now() else dispatched_at end,
    delivered_at=case when p_to_status='delivered' then now() else delivered_at end,
    cancelled_at=case when p_to_status='cancelled' then now() else cancelled_at end
  where id=p_order_id;
  insert into public.order_status_history(order_id,from_status,to_status,public_status,actor_type,actor_user_id,customer_visible,customer_message,internal_note,reason)
  values(v_order.id,v_order.status,p_to_status,v_public,'staff',auth.uid(),true,coalesce(nullif(btrim(p_customer_message),''),'Order status updated.'),nullif(btrim(p_internal_note),''),nullif(btrim(p_reason),''));
  insert into public.audit_logs(actor_user_id,actor_type,action,target_type,target_id,order_id,before_state,after_state,metadata)
  values(auth.uid(),'staff','order.status_changed','order',v_order.id,v_order.id,jsonb_build_object('status',v_order.status),jsonb_build_object('status',p_to_status),jsonb_build_object('reason',p_reason));
  return true;
end;
$$;

create function public.request_order_cancellation(p_order_id uuid,p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if not public.staff_has_permission('change_order_status') then raise exception 'STAFF_PERMISSION_DENIED'; end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'REASON_REQUIRED'; end if;
  insert into public.cancellation_requests(order_id,requested_by,reason) values(p_order_id,auth.uid(),btrim(p_reason)) returning id into v_id;
  return v_id;
end;
$$;

create function public.update_order_configuration(p_order_id uuid,p_next_snapshot jsonb,p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_order public.orders%rowtype; v_item public.order_items%rowtype; v_revision integer; v_paths text[] := array[]::text[];
begin
  if not public.staff_has_permission('edit_order_configuration') then raise exception 'STAFF_PERMISSION_DENIED'; end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'REASON_REQUIRED'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status in ('dispatched','delivered','cancelled','refund_pending','refunded') then raise exception 'ORDER_CONFIGURATION_LOCKED'; end if;
  select * into v_item from public.order_items where order_id=p_order_id and line_number=1;
  if coalesce(p_next_snapshot #>> '{product,id}',p_next_snapshot->>'productId','') <> v_item.product_id then raise exception 'GARMENT_TYPE_IMMUTABLE'; end if;
  if coalesce((p_next_snapshot->>'quantity')::integer,0) <> v_item.quantity then raise exception 'ORDER_QUANTITY_IMMUTABLE'; end if;
  if coalesce(p_next_snapshot #>> '{artwork,front,technique}','') <> coalesce(v_order.configuration_snapshot #>> '{artwork,front,technique}','')
     or coalesce(p_next_snapshot #>> '{artwork,back,technique}','') <> coalesce(v_order.configuration_snapshot #>> '{artwork,back,technique}','') then
    raise exception 'PRINTING_TECHNIQUE_IMMUTABLE';
  end if;
  v_revision := v_order.configuration_revision + 1;
  if p_next_snapshot <> v_order.configuration_snapshot then v_paths := array['configuration']; end if;
  insert into public.order_configuration_revisions(order_id,revision_number,previous_snapshot,next_snapshot,changed_by,reason,changed_paths)
  values(p_order_id,v_revision,v_order.configuration_snapshot,p_next_snapshot,auth.uid(),btrim(p_reason),v_paths);
  update public.orders set configuration_snapshot=p_next_snapshot,configuration_revision=v_revision where id=p_order_id;
  update public.order_items set colour_snapshot=coalesce(p_next_snapshot->'colour',colour_snapshot),
    artwork_snapshot=coalesce(p_next_snapshot->'artwork',artwork_snapshot),
    neck_label_snapshot=coalesce(p_next_snapshot->'neckLabel',neck_label_snapshot)
  where order_id=p_order_id and line_number=1;
  return v_revision;
end;
$$;

create function public.set_shipping_payment_link(p_order_id uuid,p_amount_paise bigint,p_url text,p_reference text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.staff_has_permission('change_order_status') then raise exception 'STAFF_PERMISSION_DENIED'; end if;
  if p_amount_paise <= 0 or p_url !~ '^https://' then raise exception 'INVALID_SHIPPING_PAYMENT_LINK'; end if;
  update public.orders set shipping_charge_paise=p_amount_paise,shipping_payment_status='link_created',shipping_payment_link_url=p_url,shipping_payment_reference=nullif(btrim(p_reference),'') where id=p_order_id;
  return found;
end;
$$;

create function public.mark_shipping_payment_received(p_order_id uuid,p_reference text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_staff_role() <> 'founder' or not public.staff_mfa_satisfied() then raise exception 'FOUNDER_PERMISSION_REQUIRED'; end if;
  if nullif(btrim(p_reference),'') is null then raise exception 'REFERENCE_REQUIRED'; end if;
  update public.orders set shipping_payment_status='paid',shipping_payment_reference=btrim(p_reference),shipping_paid_at=now() where id=p_order_id;
  return found;
end;
$$;

-- Discount validation is server authoritative.
create function public.validate_discount_code(p_code text,p_customer_user_id uuid,p_subtotal_paise bigint)
returns table(discount_code_id uuid, normalized_code text, discount_paise bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_code public.discount_codes%rowtype; v_used bigint; v_customer_used bigint; v_discount bigint;
begin
  if nullif(btrim(p_code),'') is null then return; end if;
  select * into v_code from public.discount_codes where code=upper(btrim(p_code)) and active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now());
  if not found or p_subtotal_paise < v_code.minimum_subtotal_paise then raise exception 'DISCOUNT_CODE_INVALID'; end if;
  select count(*) into v_used from public.discount_redemptions where discount_code_id=v_code.id;
  select count(*) into v_customer_used from public.discount_redemptions where discount_code_id=v_code.id and customer_user_id=p_customer_user_id;
  if (v_code.maximum_redemptions is not null and v_used>=v_code.maximum_redemptions) or v_customer_used>=v_code.maximum_redemptions_per_customer then raise exception 'DISCOUNT_CODE_LIMIT_REACHED'; end if;
  v_discount := case when v_code.kind='percentage' then round(p_subtotal_paise * v_code.percentage_basis_points / 10000.0)::bigint else v_code.fixed_amount_paise end;
  v_discount := least(v_discount,p_subtotal_paise,coalesce(v_code.maximum_discount_paise,v_discount));
  return query select v_code.id,upper(v_code.code::text),v_discount;
end;
$$;

-- Atomic full-payment finalisation. The authoritative pricing and immutable
-- snapshots are prepared server-side and stored in custom_checkout_sessions.
create function public.finalize_custom_checkout_full_payment(
  p_checkout_payment_attempt_id uuid,p_provider_payment_id text,
  p_verified_amount_paise bigint,p_verified_snapshot jsonb,
  p_seller_snapshot jsonb
)
returns table(order_id uuid,order_number text,payment_attempt_id uuid,already_finalized boolean,duplicate_success boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.custom_checkout_payment_attempts%rowtype;
  v_session public.custom_checkout_sessions%rowtype;
  v_payload jsonb; v_order_id uuid; v_order_number text; v_payment_id uuid;
  v_item jsonb; v_invoice_lines jsonb; v_other_paid uuid;
begin
  select * into v_attempt from public.custom_checkout_payment_attempts where id=p_checkout_payment_attempt_id for update;
  if not found then raise exception 'CHECKOUT_PAYMENT_ATTEMPT_NOT_FOUND'; end if;
  select * into v_session from public.custom_checkout_sessions where id=v_attempt.checkout_session_id for update;
  if v_session.status='finalized' then
    return query select v_session.final_order_id,v_session.final_order_number,v_session.final_payment_attempt_id,true,false; return;
  end if;
  if v_attempt.amount_paise<>p_verified_amount_paise or v_session.total_paise<>p_verified_amount_paise then raise exception 'PAYMENT_AMOUNT_MISMATCH'; end if;
  select id into v_other_paid from public.custom_checkout_payment_attempts where checkout_session_id=v_session.id and status='paid' and id<>v_attempt.id limit 1;
  if v_other_paid is not null then
    update public.custom_checkout_payment_attempts set status='duplicate_success',provider_payment_id=p_provider_payment_id,raw_verified_snapshot=p_verified_snapshot,paid_at=now(),failure_code='DUPLICATE_VERIFIED_SUCCESS',failure_message='Another verified attempt already paid this checkout' where id=v_attempt.id;
    insert into public.integration_jobs(job_type,deduplication_key,payload) values('finance_duplicate_payment','duplicate-payment:'||v_attempt.id,jsonb_build_object('checkoutAttemptId',v_attempt.id,'providerPaymentId',p_provider_payment_id)) on conflict do nothing;
    return query select v_session.final_order_id,v_session.final_order_number,v_session.final_payment_attempt_id,false,true; return;
  end if;
  if v_session.expires_at<=now() then raise exception 'CHECKOUT_EXPIRED'; end if;
  v_payload:=v_session.rpc_payload;
  v_order_id:=gen_random_uuid();
  v_order_number:=public.next_number(case when v_payload->>'orderType'='sample_purchase' then 'sample_order' else 'custom_order' end,case when v_payload->>'orderType'='sample_purchase' then 'SAM' else 'GAR' end);
  insert into public.orders(
    id,order_number,order_type,order_source,customer_user_id,design_project_id,design_version_id,
    status,public_status,subtotal_paise,discount_paise,taxable_value_paise,tax_paise,total_paise,amount_paid_paise,
    discount_code_id,discount_code_snapshot,pricing_version,configuration_schema_version,customer_reference,
    requested_delivery_date,billing_snapshot,shipping_snapshot,customer_snapshot,business_snapshot,terms_snapshot,configuration_snapshot
  ) values(
    v_order_id,v_order_number,coalesce((v_payload->>'orderType')::public.order_type,'custom_bulk'),'customer_checkout',v_session.customer_user_id,
    nullif(v_payload->>'designProjectId','')::uuid,nullif(v_payload->>'designVersionId','')::uuid,
    'payment_confirmed','order_received',v_session.subtotal_paise,v_session.discount_paise,v_session.subtotal_paise-v_session.discount_paise,v_session.tax_paise,v_session.total_paise,v_session.total_paise,
    v_session.discount_code_id,v_payload->>'discountCode',v_payload->>'pricingVersion',coalesce((v_payload->>'configurationSchemaVersion')::integer,1),
    v_payload->>'customerReference',nullif(v_payload->>'requestedDeliveryDate','')::date,
    v_payload->'billingSnapshot',v_payload->'shippingSnapshot',v_payload->'customerSnapshot',coalesce(v_payload->'businessSnapshot','{}'::jsonb),v_payload->'termsSnapshot',v_payload->'configurationSnapshot'
  );
  for v_item in select * from jsonb_array_elements(v_payload->'items') loop
    insert into public.order_items(order_id,line_number,product_id,product_slug,product_name,product_snapshot,colour_snapshot,decoration_snapshot,artwork_snapshot,neck_label_snapshot,size_breakdown,quantity,unit_price_paise,line_total_paise)
    values(v_order_id,(v_item->>'line_number')::integer,v_item->>'product_id',v_item->>'product_slug',v_item->>'product_name',v_item->'product_snapshot',v_item->'colour_snapshot',v_item->'decoration_snapshot',v_item->'artwork_snapshot',v_item->'neck_label_snapshot',v_item->'size_breakdown',(v_item->>'quantity')::integer,(v_item->>'unit_price_paise')::bigint,(v_item->>'line_total_paise')::bigint);
  end loop;
  update public.order_files set order_id=v_order_id where id = any(array(select jsonb_array_elements_text(coalesce(v_payload->'fileIds','[]'::jsonb))::uuid)) and design_project_id=nullif(v_payload->>'designProjectId','')::uuid;
  insert into public.payment_attempts(order_id,attempt_number,provider_merchant_txn_id,provider_payment_id,purpose,amount_paise,status,expected_product_info,customer_email,customer_name,raw_verified_snapshot,initiated_at,paid_at)
  values(v_order_id,1,v_attempt.provider_merchant_txn_id,p_provider_payment_id,'order_full',p_verified_amount_paise,'paid',v_attempt.expected_product_info,v_attempt.customer_email,v_attempt.customer_name,p_verified_snapshot,v_attempt.initiated_at,now()) returning id into v_payment_id;
  update public.custom_checkout_payment_attempts set status='paid',provider_payment_id=p_provider_payment_id,raw_verified_snapshot=p_verified_snapshot,paid_at=now(),completed_at=now(),failure_code=null,failure_message=null where id=v_attempt.id;
  update public.custom_checkout_sessions set status='finalized',final_order_id=v_order_id,final_payment_attempt_id=v_payment_id,final_order_number=v_order_number,provider_payment_id=p_provider_payment_id,verified_snapshot=p_verified_snapshot,finalized_at=now() where id=v_session.id;
  insert into public.order_status_history(order_id,from_status,to_status,public_status,actor_type,actor_user_id,customer_message,metadata)
  values(v_order_id,null,'payment_confirmed','order_received','system',v_session.customer_user_id,'Payment confirmed. Your order has been received.',jsonb_build_object('checkoutSessionId',v_session.id));
  insert into public.terms_acceptances(user_id,checkout_session_id,order_id,terms_version,privacy_version,terms_content_hash,source_flow,request_metadata)
  values(v_session.customer_user_id,v_session.id,v_order_id,v_payload->'termsSnapshot'->>'version',coalesce(v_payload->'termsSnapshot'->>'privacyVersion','2026-07-29'),v_payload->'termsSnapshot'->>'contentHash','custom_checkout',coalesce(v_payload->'termsSnapshot'->'requestMetadata','{}'::jsonb));
  if v_session.discount_code_id is not null and v_session.discount_paise>0 then
    insert into public.discount_redemptions(discount_code_id,customer_user_id,order_id,discount_paise) values(v_session.discount_code_id,v_session.customer_user_id,v_order_id,v_session.discount_paise);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'description',coalesce(item->>'product_name','Garmops garment order'),
    'hsnCode',coalesce(item->'product_snapshot'->>'hsnCode','610910'),
    'quantity',(item->>'quantity')::integer,
    'unitPricePaise',(item->>'unit_price_paise')::bigint,
    'lineTotalPaise',(item->>'line_total_paise')::bigint,
    'gstRateBasisPoints',500
  ) order by (item->>'line_number')::integer),'[]'::jsonb)
  into v_invoice_lines
  from jsonb_array_elements(v_payload->'items') as item;
  insert into public.invoices(order_id,kind,status,subtotal_paise,discount_paise,taxable_value_paise,tax_paise,total_paise,paid_paise,line_items,seller_snapshot,buyer_snapshot,place_of_supply)
  values(v_order_id,'tax_invoice','queued',v_session.subtotal_paise,v_session.discount_paise,v_session.subtotal_paise-v_session.discount_paise,v_session.tax_paise,v_session.total_paise,v_session.total_paise,v_invoice_lines,p_seller_snapshot,v_payload->'billingSnapshot',v_payload->'billingSnapshot'->'address'->>'state');
  insert into public.integration_jobs(job_type,deduplication_key,payload) values('generate_tax_invoice','invoice:'||v_order_id,jsonb_build_object('orderId',v_order_id,'orderNumber',v_order_number)) on conflict do nothing;
  insert into public.integration_jobs(job_type,deduplication_key,payload) values('send_order_confirmation','order-confirmation:'||v_order_id,jsonb_build_object('orderId',v_order_id,'orderNumber',v_order_number)) on conflict do nothing;
  return query select v_order_id,v_order_number,v_payment_id,false,false;
end;
$$;

create function public.record_payu_payment_state(
  p_payment_attempt_id uuid,p_state public.payment_status,p_provider_payment_id text default null,
  p_failure_code text default null,p_failure_message text default null,p_verified_snapshot jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payment_attempts set status=p_state,provider_payment_id=coalesce(p_provider_payment_id,provider_payment_id),failure_code=p_failure_code,failure_message=p_failure_message,raw_verified_snapshot=coalesce(p_verified_snapshot,raw_verified_snapshot),paid_at=case when p_state='paid' then now() else paid_at end,failed_at=case when p_state='failed' then now() else failed_at end where id=p_payment_attempt_id;
  return found;
end;
$$;

create function public.finalize_verified_payment(
  p_payment_attempt_id uuid,p_provider_payment_id text,p_verified_amount_paise bigint,p_currency text,p_verified_snapshot jsonb,p_invoice_kind public.invoice_kind default 'tax_invoice'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_attempt public.payment_attempts%rowtype; v_order public.orders%rowtype;
begin
  select * into v_attempt from public.payment_attempts where id=p_payment_attempt_id for update;
  if not found then raise exception 'PAYMENT_ATTEMPT_NOT_FOUND'; end if;
  select * into v_order from public.orders where id=v_attempt.order_id for update;
  if v_attempt.amount_paise<>p_verified_amount_paise or p_currency<>'INR' then raise exception 'PAYMENT_AMOUNT_MISMATCH'; end if;
  if exists(select 1 from public.payment_attempts where order_id=v_attempt.order_id and purpose=v_attempt.purpose and status='paid' and id<>v_attempt.id) then raise exception 'ANOTHER_PAYMENT_ATTEMPT_ALREADY_PAID'; end if;
  update public.payment_attempts set status='paid',provider_payment_id=p_provider_payment_id,raw_verified_snapshot=p_verified_snapshot,paid_at=now() where id=v_attempt.id;
  if v_attempt.purpose='order_full' then update public.orders set amount_paid_paise=least(total_paise,amount_paid_paise+p_verified_amount_paise) where id=v_order.id;
  elsif v_attempt.purpose='shipping' then update public.orders set shipping_payment_status='paid',shipping_paid_at=now(),shipping_payment_reference=p_provider_payment_id where id=v_order.id;
  end if;
  return true;
end;
$$;

-- Integration queue RPCs retained for the existing worker.
create function public.claim_integration_jobs(p_worker_id text,p_limit integer)
returns setof public.integration_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with picked as (
    select id from public.integration_jobs
    where status in ('queued','retryable_failure') and available_at<=now()
    order by created_at for update skip locked limit greatest(1,least(p_limit,100))
  )
  update public.integration_jobs j set status='processing',attempts=j.attempts+1,locked_at=now(),locked_by=p_worker_id
  from picked where j.id=picked.id returning j.*;
end;
$$;

create function public.complete_integration_job(p_job_id uuid,p_worker_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
 update public.integration_jobs set status='completed',completed_at=now(),locked_at=null,locked_by=null,last_error=null where id=p_job_id and locked_by=p_worker_id; return found;
end;
$$;

create function public.fail_integration_job(p_job_id uuid,p_worker_id text,p_error text,p_retry_at timestamptz,p_permanent boolean default false)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
 update public.integration_jobs set status=case when p_permanent then 'permanent_failure' else 'retryable_failure' end,available_at=coalesce(p_retry_at,now()+interval '5 minutes'),last_error=left(p_error,4000),locked_at=null,locked_by=null where id=p_job_id and locked_by=p_worker_id; return found;
end;
$$;

create function public.consume_auth_rate_limit(p_scope text,p_subject_hash text,p_max_attempts integer,p_window_seconds integer)
returns table(allowed boolean,retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare v_now timestamptz:=now(); v_row public.auth_rate_limits%rowtype;
begin
  insert into public.auth_rate_limits(scope,subject_hash,window_started_at,attempts,updated_at)
  values(p_scope,p_subject_hash,v_now,1,v_now)
  on conflict(scope,subject_hash) do update set
    window_started_at=case when public.auth_rate_limits.window_started_at + make_interval(secs=>p_window_seconds)<=v_now then v_now else public.auth_rate_limits.window_started_at end,
    attempts=case when public.auth_rate_limits.window_started_at + make_interval(secs=>p_window_seconds)<=v_now then 1 else public.auth_rate_limits.attempts+1 end,
    updated_at=v_now
  returning * into v_row;
  allowed := v_row.attempts<=p_max_attempts;
  retry_after_seconds := case when allowed then 0 else greatest(1,extract(epoch from (v_row.window_started_at+make_interval(secs=>p_window_seconds)-v_now))::integer) end;
  return next;
end;
$$;

-- Safe operational payment summary. Raw provider payloads remain founder-only.
create function public.staff_payment_summaries(p_order_id uuid default null)
returns table(payment_attempt_id uuid,order_id uuid,order_number text,purpose public.payment_purpose,status public.payment_status,amount_paise bigint,provider_payment_id text,created_at timestamptz,paid_at timestamptz,failure_message text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id,p.order_id,o.order_number,p.purpose,p.status,p.amount_paise,p.provider_payment_id,p.created_at,p.paid_at,
    case when p.status='failed' then coalesce(p.failure_message,'Payment failed') else null end
  from public.payment_attempts p join public.orders o on o.id=p.order_id
  where public.is_active_staff(true) and (p_order_id is null or p.order_id=p_order_id)
  order by p.created_at desc
$$;

-- RLS: customer ownership is direct user ownership. No organization membership
-- can grant access. Operational data requires an active AAL2 staff session.
alter table public.profiles enable row level security;
alter table public.account_principals enable row level security;
alter table public.staff_members enable row level security;
alter table public.staff_invitations enable row level security;
alter table public.addresses enable row level security;
alter table public.customer_billing_profiles enable row level security;
alter table public.design_projects enable row level security;
alter table public.design_project_versions enable row level security;
alter table public.discount_codes enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_configuration_revisions enable row level security;
alter table public.order_status_history enable row level security;
alter table public.cancellation_requests enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.payment_events enable row level security;
alter table public.invoices enable row level security;
alter table public.order_files enable row level security;
alter table public.discount_redemptions enable row level security;
alter table public.terms_acceptances enable row level security;
alter table public.audit_logs enable row level security;
alter table public.integration_jobs enable row level security;
alter table public.custom_checkout_sessions enable row level security;
alter table public.custom_checkout_payment_attempts enable row level security;
alter table public.custom_checkout_payment_events enable row level security;
alter table public.staff_quotes enable row level security;

create policy profiles_own_select on public.profiles for select to authenticated using (id=auth.uid() or public.is_active_staff(true));
create policy profiles_own_update on public.profiles for update to authenticated using (id=auth.uid() and public.current_account_type()='customer') with check (id=auth.uid());
create policy principals_own_select on public.account_principals for select to authenticated using (user_id=auth.uid() or public.current_staff_role()='founder');
create policy staff_members_own_or_founder on public.staff_members for select to authenticated using (user_id=auth.uid() or (public.current_staff_role()='founder' and public.staff_mfa_satisfied()));
create policy staff_invitations_founder on public.staff_invitations for all to authenticated using (public.current_staff_role()='founder' and public.staff_mfa_satisfied()) with check (public.current_staff_role()='founder' and public.staff_mfa_satisfied());
create policy addresses_owner_staff_select on public.addresses for select to authenticated using (user_id=auth.uid() or public.is_active_staff(true));
create policy addresses_owner_write on public.addresses for all to authenticated using (user_id=auth.uid() and public.current_account_type()='customer') with check (user_id=auth.uid() and public.current_account_type()='customer');
create policy billing_owner_staff_select on public.customer_billing_profiles for select to authenticated using (user_id=auth.uid() or public.is_active_staff(true));
create policy billing_owner_write on public.customer_billing_profiles for all to authenticated using (user_id=auth.uid() and public.current_account_type()='customer') with check (user_id=auth.uid() and public.current_account_type()='customer');
create policy designs_owner_staff_select on public.design_projects for select to authenticated using (created_by=auth.uid() or public.is_active_staff(true));
create policy design_versions_owner_staff_select on public.design_project_versions for select to authenticated using (exists(select 1 from public.design_projects d where d.id=design_project_id and (d.created_by=auth.uid() or public.is_active_staff(true))));
create policy orders_owner_staff_select on public.orders for select to authenticated using (customer_user_id=auth.uid() or public.is_active_staff(true));
create policy order_items_owner_staff_select on public.order_items for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id and (o.customer_user_id=auth.uid() or public.is_active_staff(true))));
create policy order_revisions_staff_select on public.order_configuration_revisions for select to authenticated using (public.is_active_staff(true));
create policy order_history_owner_staff_select on public.order_status_history for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id and (o.customer_user_id=auth.uid() or public.is_active_staff(true))));
create policy cancellation_staff_select on public.cancellation_requests for select to authenticated using (public.is_active_staff(true));
create policy payment_customer_founder_select on public.payment_attempts for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id and o.customer_user_id=auth.uid()) or (public.current_staff_role()='founder' and public.staff_mfa_satisfied()));
create policy invoice_owner_staff_select on public.invoices for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id and (o.customer_user_id=auth.uid() or public.is_active_staff(true))));
create policy files_owner_staff_select on public.order_files for select to authenticated using (
  uploaded_by=auth.uid() or public.is_active_staff(true)
  or exists(select 1 from public.orders o where o.id=order_id and o.customer_user_id=auth.uid())
  or exists(select 1 from public.design_projects d where d.id=design_project_id and d.created_by=auth.uid())
);
create policy terms_owner_founder_select on public.terms_acceptances for select to authenticated using (user_id=auth.uid() or (public.current_staff_role()='founder' and public.staff_mfa_satisfied()));
create policy audit_founder_select on public.audit_logs for select to authenticated using (public.current_staff_role()='founder' and public.staff_mfa_satisfied());
create policy quotes_staff_select on public.staff_quotes for select to authenticated using (public.is_active_staff(true));

revoke all on all tables in schema public from anon, authenticated;
grant select,update on public.profiles to authenticated;
grant select on public.account_principals,public.staff_members,public.staff_invitations to authenticated;
grant select,insert,update,delete on public.addresses,public.customer_billing_profiles to authenticated;
grant select on public.design_projects,public.design_project_versions,public.orders,public.order_items,public.order_configuration_revisions,public.order_status_history,public.cancellation_requests,public.payment_attempts,public.invoices,public.order_files,public.terms_acceptances,public.audit_logs,public.staff_quotes to authenticated;
grant all on all tables in schema public to service_role;

revoke all on all functions in schema public from public,anon,authenticated;
grant execute on function public.current_account_type(),public.current_staff_role(),public.staff_mfa_satisfied(),public.is_active_staff(boolean),public.staff_has_permission(text),public.ensure_customer_account(text,text),public.complete_customer_onboarding(text,text,text,text,text,text),public.record_staff_login(),public.get_staff_access_context(),public.record_staff_mfa_enrollment(),public.create_cloud_design(text,integer,jsonb,jsonb,text,text),public.save_cloud_design_draft(uuid,integer,integer,jsonb,jsonb,text),public.create_cloud_design_version(uuid,integer),public.duplicate_cloud_design(uuid,text,text),public.archive_cloud_design(uuid,integer),public.create_private_upload_slot(uuid,uuid,public.file_kind,public.file_visibility,text,text,text,bigint,text,text,timestamptz),public.soft_delete_file(uuid),public.review_artwork_file(uuid,public.artwork_review_status,text),public.order_public_status_for_internal(public.order_status),public.staff_transition_order(uuid,public.order_status,text,text,text),public.request_order_cancellation(uuid,text),public.update_order_configuration(uuid,jsonb,text),public.set_shipping_payment_link(uuid,bigint,text,text),public.mark_shipping_payment_received(uuid,text),public.validate_discount_code(text,uuid,bigint),public.staff_payment_summaries(uuid) to authenticated;
grant execute on all functions in schema public to service_role;

-- Explicitly keep raw payment/event and checkout staging tables service-only.
revoke all on public.payment_events,public.integration_jobs,public.custom_checkout_sessions,public.custom_checkout_payment_attempts,public.custom_checkout_payment_events from anon,authenticated;

commit;
