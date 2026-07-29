-- Garmops Phase 2: durable designs, orders, payments, invoices, files,
-- notifications, audit records, and a PostgreSQL integration job queue.
-- Browser-facing RLS policies remain intentionally absent until Phase 3.

create type public.order_type as enum (
  'custom_bulk',
  'sample_purchase',
  'reorder'
);

create type public.order_status as enum (
  'awaiting_payment',
  'payment_failed',
  'reservation_paid',
  'submitted_for_review',
  'needs_customer_action',
  'commercial_review',
  'quote_ready',
  'awaiting_quote_approval',
  'awaiting_balance_payment',
  'artwork_review',
  'awaiting_artwork_approval',
  'approved_for_production',
  'production_queued',
  'in_production',
  'quality_control',
  'packing',
  'ready_to_dispatch',
  'dispatched',
  'delivered',
  'on_hold',
  'cancelled',
  'refunded',
  'expired'
);

create type public.public_order_status as enum (
  'payment_incomplete',
  'order_submitted',
  'action_required',
  'under_review',
  'awaiting_approval',
  'payment_due',
  'approved',
  'in_production',
  'quality_check',
  'ready_to_dispatch',
  'dispatched',
  'delivered',
  'on_hold',
  'cancelled'
);

create type public.payment_status as enum (
  'created',
  'initiated',
  'pending',
  'paid',
  'failed',
  'cancelled',
  'refunded',
  'partially_refunded',
  'disputed'
);

create type public.invoice_kind as enum (
  'reservation_retainer',
  'reservation_invoice',
  'sample_tax_invoice',
  'final_tax_invoice',
  'credit_note'
);

create type public.invoice_sync_status as enum (
  'not_required',
  'queued',
  'processing',
  'completed',
  'retryable_failure',
  'permanent_failure',
  'voided'
);

create type public.file_visibility as enum (
  'customer',
  'staff_only',
  'public'
);

create type public.file_kind as enum (
  'customer_artwork',
  'purchase_order',
  'approval_pdf',
  'proof',
  'invoice_pdf',
  'qc_photo',
  'packing_list',
  'shipping_label',
  'shipment_document',
  'other'
);

create type public.file_scan_status as enum (
  'pending',
  'clean',
  'rejected',
  'manual_review',
  'not_required'
);

create table public.design_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  created_by uuid not null references public.profiles(id),
  title text not null
    check (title = btrim(title) and char_length(title) between 1 and 160),
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'archived')),
  schema_version integer not null
    check (schema_version > 0),
  current_version integer not null default 1
    check (current_version > 0),
  source text not null default 'configurator'
    check (source = btrim(source) and char_length(source) between 1 and 80),
  last_saved_at timestamptz not null default now(),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'submitted' or submitted_at is not null)
);

create table public.design_project_versions (
  id uuid primary key default gen_random_uuid(),
  design_project_id uuid not null references public.design_projects(id) on delete cascade,
  version_number integer not null
    check (version_number > 0),
  configuration_snapshot jsonb not null
    check (jsonb_typeof(configuration_snapshot) = 'object'),
  pricing_input_snapshot jsonb
    check (pricing_input_snapshot is null or jsonb_typeof(pricing_input_snapshot) = 'object'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (design_project_id, version_number)
);

create table public.number_counters (
  namespace text not null
    check (namespace in ('custom_order', 'sample_order')),
  calendar_year integer not null
    check (calendar_year between 2020 and 9999),
  next_value bigint not null default 1
    check (next_value > 0),
  primary key (namespace, calendar_year)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique
    check (order_number ~ '^(GAR|SAM)-[0-9]{4}-[0-9]{6}$'),
  order_type public.order_type not null,
  organization_id uuid not null references public.organizations(id),
  customer_user_id uuid not null references public.profiles(id),
  design_project_id uuid references public.design_projects(id),
  design_version_id uuid references public.design_project_versions(id),
  status public.order_status not null,
  public_status public.public_order_status not null,
  currency char(3) not null default 'INR'
    check (currency::text ~ '^[A-Z]{3}$'),
  subtotal_paise bigint not null default 0
    check (subtotal_paise >= 0),
  shipping_paise bigint not null default 0
    check (shipping_paise >= 0),
  tax_estimate_paise bigint not null default 0
    check (tax_estimate_paise >= 0),
  estimated_total_paise bigint not null default 0
    check (
      estimated_total_paise >= 0
      and estimated_total_paise = subtotal_paise + shipping_paise + tax_estimate_paise
    ),
  reservation_amount_paise bigint not null default 0
    check (reservation_amount_paise >= 0),
  amount_paid_paise bigint not null default 0
    check (amount_paid_paise >= 0),
  pricing_version text not null
    check (pricing_version = btrim(pricing_version) and char_length(pricing_version) between 1 and 80),
  configuration_schema_version integer not null
    check (configuration_schema_version > 0),
  customer_reference text
    check (
      customer_reference is null
      or (
        customer_reference = btrim(customer_reference)
        and char_length(customer_reference) between 1 and 120
      )
    ),
  po_number text
    check (po_number is null or (po_number = btrim(po_number) and char_length(po_number) between 1 and 120)),
  requested_delivery_date date,
  estimated_dispatch_at timestamptz,
  internal_priority text not null default 'normal'
    check (internal_priority in ('low', 'normal', 'high', 'urgent')),
  assigned_staff_user_id uuid references public.staff_members(user_id),
  billing_snapshot jsonb not null
    check (jsonb_typeof(billing_snapshot) = 'object'),
  shipping_snapshot jsonb not null
    check (jsonb_typeof(shipping_snapshot) = 'object'),
  customer_snapshot jsonb not null
    check (jsonb_typeof(customer_snapshot) = 'object'),
  company_snapshot jsonb not null
    check (jsonb_typeof(company_snapshot) = 'object'),
  terms_snapshot jsonb not null
    check (jsonb_typeof(terms_snapshot) = 'object'),
  submitted_at timestamptz not null default now(),
  reservation_paid_at timestamptz,
  confirmed_at timestamptz,
  artwork_approved_at timestamptz,
  production_started_at timestamptz,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (order_type = 'sample_purchase' and reservation_amount_paise = 0)
    or (order_type in ('custom_bulk', 'reorder') and reservation_amount_paise > 0)
  ),
  check (expires_at is null or expires_at > submitted_at),
  check (
    requested_delivery_date is null
    or requested_delivery_date >= timezone('Asia/Kolkata', submitted_at)::date
  )
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  line_number integer not null
    check (line_number > 0),
  product_id text
    check (product_id is null or (product_id = btrim(product_id) and char_length(product_id) between 1 and 120)),
  product_slug text
    check (product_slug is null or (product_slug = btrim(product_slug) and char_length(product_slug) between 1 and 160)),
  product_name text not null
    check (product_name = btrim(product_name) and char_length(product_name) between 1 and 200),
  product_snapshot jsonb not null
    check (jsonb_typeof(product_snapshot) = 'object'),
  colour_snapshot jsonb
    check (colour_snapshot is null or jsonb_typeof(colour_snapshot) = 'object'),
  decoration_snapshot jsonb
    check (decoration_snapshot is null or jsonb_typeof(decoration_snapshot) = 'object'),
  artwork_snapshot jsonb
    check (artwork_snapshot is null or jsonb_typeof(artwork_snapshot) = 'object'),
  neck_label_snapshot jsonb
    check (neck_label_snapshot is null or jsonb_typeof(neck_label_snapshot) = 'object'),
  size_breakdown jsonb not null
    check (jsonb_typeof(size_breakdown) = 'object'),
  quantity integer not null
    check (quantity > 0),
  unit_price_paise bigint
    check (unit_price_paise is null or unit_price_paise >= 0),
  line_total_paise bigint
    check (line_total_paise is null or line_total_paise >= 0),
  created_at timestamptz not null default now(),
  unique (order_id, line_number)
);

create table public.order_item_sizes (
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  size_code text not null
    check (size_code = btrim(size_code) and char_length(size_code) between 1 and 20),
  quantity integer not null
    check (quantity >= 0),
  primary key (order_item_id, size_code)
);

create table public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  scope text not null
    check (scope = btrim(scope) and char_length(scope) between 1 and 80),
  actor_id uuid,
  key text not null
    check (key = btrim(key) and char_length(key) between 8 and 200),
  request_hash text not null
    check (request_hash ~ '^[0-9a-f]{64}$'),
  resource_type text
    check (
      resource_type is null
      or (resource_type = btrim(resource_type) and char_length(resource_type) between 1 and 80)
    ),
  resource_id uuid,
  response_status integer
    check (response_status is null or response_status between 100 and 599),
  response_body jsonb
    check (response_body is null or jsonb_typeof(response_body) = 'object'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique nulls not distinct (scope, actor_id, key),
  check (expires_at > created_at),
  check (
    (resource_type is null and resource_id is null and response_status is null and response_body is null)
    or (
      resource_type is not null
      and resource_id is not null
      and response_status is not null
      and response_body is not null
    )
  )
);

create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  payment_number text not null unique
    check (payment_number ~ '^PAY-(GAR|SAM)-[0-9]{4}-[0-9]{6}-[0-9]{2}$'),
  order_id uuid not null references public.orders(id),
  provider text not null default 'payu'
    check (provider = btrim(provider) and char_length(provider) between 1 and 40),
  provider_merchant_txn_id text not null unique
    check (provider_merchant_txn_id ~ '^[A-Za-z0-9]{8,64}$'),
  provider_payment_id text
    check (
      provider_payment_id is null
      or (
        provider_payment_id = btrim(provider_payment_id)
        and char_length(provider_payment_id) between 1 and 120
      )
    ),
  attempt_number integer not null
    check (attempt_number > 0),
  purpose text not null
    check (purpose in ('reservation', 'sample_full', 'balance', 'other')),
  amount_paise bigint not null
    check (amount_paise > 0),
  currency char(3) not null default 'INR'
    check (currency::text ~ '^[A-Z]{3}$'),
  status public.payment_status not null default 'created',
  expected_product_info text not null
    check (
      expected_product_info = btrim(expected_product_info)
      and char_length(expected_product_info) between 1 and 200
    ),
  customer_email extensions.citext not null
    check (
      customer_email::text = btrim(customer_email::text)
      and char_length(customer_email::text) between 3 and 254
      and customer_email::text ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ),
  customer_name text not null
    check (customer_name = btrim(customer_name) and char_length(customer_name) between 1 and 160),
  initiated_at timestamptz,
  paid_at timestamptz,
  failed_at timestamptz,
  refunded_at timestamptz,
  last_verified_at timestamptz,
  failure_code text,
  failure_message text,
  raw_verified_snapshot jsonb
    check (raw_verified_snapshot is null or jsonb_typeof(raw_verified_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, attempt_number),
  check (status <> 'paid' or paid_at is not null),
  check (status not in ('refunded', 'partially_refunded') or refunded_at is not null)
);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_attempt_id uuid references public.payment_attempts(id),
  provider text not null
    check (provider = btrim(provider) and char_length(provider) between 1 and 40),
  event_source text not null
    check (event_source in ('callback', 'webhook', 'verify_api', 'reconciliation', 'manual')),
  provider_event_id text
    check (
      provider_event_id is null
      or (
        provider_event_id = btrim(provider_event_id)
        and char_length(provider_event_id) between 1 and 200
      )
    ),
  event_fingerprint text not null
    check (event_fingerprint ~ '^[0-9a-f]{64}$'),
  event_type text not null
    check (event_type = btrim(event_type) and char_length(event_type) between 1 and 100),
  authentic boolean not null default false,
  processed boolean not null default false,
  processing_error text,
  payload jsonb not null
    check (jsonb_typeof(payload) = 'object'),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_fingerprint),
  check (
    (processed and processed_at is not null)
    or (not processed and processed_at is null)
  )
);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  public_status public.public_order_status not null,
  actor_type text not null
    check (actor_type in ('system', 'customer', 'staff', 'provider')),
  actor_user_id uuid references public.profiles(id),
  customer_visible boolean not null default true,
  customer_message text
    check (
      customer_message is null
      or (
        customer_message = btrim(customer_message)
        and char_length(customer_message) between 1 and 1000
      )
    ),
  internal_note text
    check (
      internal_note is null
      or (internal_note = btrim(internal_note) and char_length(internal_note) between 1 and 4000)
    ),
  metadata jsonb
    check (metadata is null or jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  check (
    (actor_type in ('customer', 'staff') and actor_user_id is not null)
    or (actor_type in ('system', 'provider') and actor_user_id is null)
  )
);

create table public.order_comments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id),
  visibility text not null
    check (visibility in ('customer', 'staff_only')),
  body text not null
    check (body = btrim(body) and char_length(body) between 1 and 10000),
  action_required boolean not null default false,
  action_type text
    check (action_type is null or (action_type = btrim(action_type) and char_length(action_type) between 1 and 80)),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (resolved_at is null and resolved_by is null)
    or (resolved_at is not null and resolved_by is not null)
  )
);

create table public.order_files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  design_project_id uuid references public.design_projects(id) on delete cascade,
  uploaded_by uuid references public.profiles(id),
  kind public.file_kind not null,
  visibility public.file_visibility not null,
  bucket_name text not null
    check (
      bucket_name = btrim(bucket_name)
      and bucket_name ~ '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$'
    ),
  object_key text not null
    check (
      object_key = btrim(object_key)
      and char_length(object_key) between 1 and 1024
      and object_key !~ '(^/|(^|/)\.\.?(/|$))'
    ),
  original_filename text not null
    check (
      original_filename = btrim(original_filename)
      and char_length(original_filename) between 1 and 255
      and original_filename !~ '[/\\]'
    ),
  safe_filename text not null
    check (
      safe_filename = btrim(safe_filename)
      and char_length(safe_filename) between 1 and 255
      and safe_filename !~ '[/\\]'
    ),
  content_type text not null
    check (content_type = lower(btrim(content_type)) and content_type ~ '^[a-z0-9.+-]+/[a-z0-9.+-]+$'),
  byte_size bigint not null
    check (byte_size >= 0),
  sha256 text
    check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  scan_status public.file_scan_status not null default 'pending',
  version_number integer
    check (version_number is null or version_number > 0),
  provider_source text not null default 'garmops'
    check (provider_source in ('garmops', 'zoho', 'system')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (bucket_name, object_key),
  check (order_id is not null or design_project_id is not null)
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  design_version_id uuid not null references public.design_project_versions(id),
  approval_pdf_file_id uuid references public.order_files(id),
  status text not null
    check (status in ('requested', 'viewed', 'approved', 'changes_requested', 'expired', 'revoked')),
  requested_by uuid references public.profiles(id),
  requested_from_user_id uuid references public.profiles(id),
  requested_from_email extensions.citext
    check (
      requested_from_email is null
      or (
        requested_from_email::text = btrim(requested_from_email::text)
        and char_length(requested_from_email::text) between 3 and 254
        and requested_from_email::text ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      )
    ),
  secure_token_hash text
    check (secure_token_hash is null or secure_token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz,
  viewed_at timestamptz,
  responded_at timestamptz,
  response_note text
    check (
      response_note is null
      or (response_note = btrim(response_note) and char_length(response_note) between 1 and 4000)
    ),
  ip_hash text
    check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  user_agent_summary text
    check (
      user_agent_summary is null
      or char_length(user_agent_summary) between 1 and 500
    ),
  created_at timestamptz not null default now(),
  check (requested_from_user_id is not null or requested_from_email is not null),
  check (expires_at is null or expires_at > created_at),
  check (status not in ('approved', 'changes_requested') or responded_at is not null)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  payment_attempt_id uuid references public.payment_attempts(id),
  kind public.invoice_kind not null,
  provider text not null default 'zoho_invoice'
    check (provider = btrim(provider) and char_length(provider) between 1 and 80),
  sync_status public.invoice_sync_status not null default 'queued',
  zoho_contact_id text,
  zoho_document_id text,
  zoho_payment_id text,
  document_number text,
  reference_number text not null
    check (reference_number = btrim(reference_number) and char_length(reference_number) between 1 and 200),
  issue_date date,
  currency char(3) not null default 'INR'
    check (currency::text ~ '^[A-Z]{3}$'),
  subtotal_paise bigint
    check (subtotal_paise is null or subtotal_paise >= 0),
  tax_paise bigint
    check (tax_paise is null or tax_paise >= 0),
  total_paise bigint
    check (total_paise is null or total_paise >= 0),
  paid_paise bigint
    check (paid_paise is null or paid_paise >= 0),
  balance_paise bigint
    check (balance_paise is null or balance_paise >= 0),
  tax_configuration_snapshot jsonb
    check (
      tax_configuration_snapshot is null
      or jsonb_typeof(tax_configuration_snapshot) = 'object'
    ),
  pdf_file_id uuid references public.order_files(id),
  emailed_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  last_error_message text,
  attempt_count integer not null default 0
    check (attempt_count >= 0),
  next_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payment_attempt_id, kind),
  unique (provider, reference_number),
  check (paid_paise is null or total_paise is null or paid_paise <= total_paise),
  check (balance_paise is null or total_paise is null or balance_paise <= total_paise),
  check (
    total_paise is null
    or paid_paise is null
    or balance_paise is null
    or total_paise = paid_paise + balance_paise
  ),
  check (
    sync_status <> 'completed'
    or (
      zoho_document_id is not null
      and document_number is not null
      and issue_date is not null
      and completed_at is not null
    )
  )
);

create table public.integration_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null
    check (job_type = btrim(job_type) and char_length(job_type) between 1 and 100),
  dedupe_key text not null unique
    check (dedupe_key = btrim(dedupe_key) and char_length(dedupe_key) between 1 and 300),
  aggregate_type text not null
    check (aggregate_type = btrim(aggregate_type) and char_length(aggregate_type) between 1 and 80),
  aggregate_id uuid not null,
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'retry', 'dead')),
  priority integer not null default 100
    check (priority between 0 and 1000),
  attempt_count integer not null default 0
    check (attempt_count >= 0),
  max_attempts integer not null default 10
    check (max_attempts between 1 and 100),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text
    check (locked_by is null or (locked_by = btrim(locked_by) and char_length(locked_by) between 1 and 200)),
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (attempt_count <= max_attempts),
  check (
    (status = 'processing' and locked_at is not null and locked_by is not null)
    or (status <> 'processing' and locked_at is null and locked_by is null)
  ),
  check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  shipment_number text not null
    check (shipment_number = btrim(shipment_number) and char_length(shipment_number) between 1 and 80),
  carrier text
    check (carrier is null or (carrier = btrim(carrier) and char_length(carrier) between 1 and 120)),
  tracking_number text
    check (
      tracking_number is null
      or (tracking_number = btrim(tracking_number) and char_length(tracking_number) between 1 and 160)
    ),
  tracking_url text
    check (
      tracking_url is null
      or (
        tracking_url = btrim(tracking_url)
        and char_length(tracking_url) between 1 and 1000
        and tracking_url ~ '^https://'
      )
    ),
  status text not null default 'preparing'
    check (status in ('preparing', 'dispatched', 'in_transit', 'delivered', 'cancelled')),
  package_count integer
    check (package_count is null or package_count > 0),
  dispatched_at timestamptz,
  estimated_delivery_at timestamptz,
  delivered_at timestamptz,
  customer_visible_note text
    check (
      customer_visible_note is null
      or (
        customer_visible_note = btrim(customer_visible_note)
        and char_length(customer_visible_note) between 1 and 1000
      )
    ),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, shipment_number),
  check (status <> 'dispatched' or dispatched_at is not null),
  check (status <> 'delivered' or delivered_at is not null)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id),
  order_id uuid references public.orders(id),
  type text not null
    check (type = btrim(type) and char_length(type) between 1 and 100),
  title text not null
    check (title = btrim(title) and char_length(title) between 1 and 200),
  body text not null
    check (body = btrim(body) and char_length(body) between 1 and 2000),
  action_url text
    check (
      action_url is null
      or (
        action_url = btrim(action_url)
        and char_length(action_url) between 1 and 1000
        and action_url ~ '^/'
      )
    ),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id),
  actor_type text not null
    check (actor_type in ('system', 'customer', 'staff', 'provider')),
  action text not null
    check (action = btrim(action) and char_length(action) between 1 and 160),
  target_type text not null
    check (target_type = btrim(target_type) and char_length(target_type) between 1 and 100),
  target_id uuid,
  organization_id uuid references public.organizations(id),
  order_id uuid references public.orders(id),
  before_state jsonb
    check (before_state is null or jsonb_typeof(before_state) = 'object'),
  after_state jsonb
    check (after_state is null or jsonb_typeof(after_state) = 'object'),
  request_id text
    check (request_id is null or (request_id = btrim(request_id) and char_length(request_id) between 1 and 200)),
  ip_hash text
    check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  user_agent_summary text
    check (
      user_agent_summary is null
      or char_length(user_agent_summary) between 1 and 500
    ),
  created_at timestamptz not null default now(),
  check (
    (actor_type in ('customer', 'staff') and actor_user_id is not null)
    or (actor_type in ('system', 'provider') and actor_user_id is null)
  )
);

create index design_projects_org_updated_idx
  on public.design_projects (organization_id, updated_at desc);

create index design_versions_project_created_idx
  on public.design_project_versions (design_project_id, created_at desc);

create index orders_org_submitted_idx
  on public.orders (organization_id, submitted_at desc);

create index orders_staff_queue_idx
  on public.orders (status, internal_priority, submitted_at desc);

create index orders_assignee_idx
  on public.orders (assigned_staff_user_id, status, updated_at desc);

create index payment_attempts_order_idx
  on public.payment_attempts (order_id, created_at desc);

create index payment_attempts_pending_idx
  on public.payment_attempts (status, created_at)
  where status in ('created', 'initiated', 'pending');

create unique index payment_attempts_one_paid_purpose_idx
  on public.payment_attempts (order_id, purpose)
  where status = 'paid';

create unique index payment_events_provider_event_idx
  on public.payment_events (provider, provider_event_id)
  where provider_event_id is not null;

create index payment_events_attempt_received_idx
  on public.payment_events (payment_attempt_id, received_at desc);

create index integration_jobs_ready_idx
  on public.integration_jobs (status, available_at, priority, created_at)
  where status in ('pending', 'retry');

create index integration_jobs_stale_lock_idx
  on public.integration_jobs (locked_at)
  where status = 'processing';

create index status_history_order_idx
  on public.order_status_history (order_id, created_at);

create index order_comments_order_idx
  on public.order_comments (order_id, created_at);

create index files_order_idx
  on public.order_files (order_id, kind, created_at desc)
  where deleted_at is null;

create index files_design_idx
  on public.order_files (design_project_id, kind, created_at desc)
  where deleted_at is null;

create index approvals_order_status_idx
  on public.approvals (order_id, status, created_at desc);

create index invoices_order_idx
  on public.invoices (order_id, created_at desc);

create index shipments_tracking_idx
  on public.shipments (tracking_number)
  where tracking_number is not null;

create index notifications_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create index audit_logs_order_idx
  on public.audit_logs (order_id, created_at desc);

create index audit_logs_target_idx
  on public.audit_logs (target_type, target_id, created_at desc);

create function public.allocate_order_number(p_order_type public.order_type)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_namespace text;
  v_prefix text;
  v_year integer;
  v_value bigint;
begin
  if p_order_type = 'sample_purchase' then
    v_namespace := 'sample_order';
    v_prefix := 'SAM';
  else
    v_namespace := 'custom_order';
    v_prefix := 'GAR';
  end if;

  v_year := extract(year from timezone('Asia/Kolkata', transaction_timestamp()))::integer;

  insert into public.number_counters (namespace, calendar_year, next_value)
  values (v_namespace, v_year, 2)
  on conflict (namespace, calendar_year)
  do update
    set next_value = public.number_counters.next_value + 1
  returning next_value - 1 into v_value;

  return format('%s-%s-%s', v_prefix, v_year, lpad(v_value::text, 6, '0'));
end;
$$;

revoke all on function public.allocate_order_number(public.order_type) from public, anon, authenticated;

create function public.submit_order(
  p_idempotency_key text,
  p_request_hash text,
  p_order_type public.order_type,
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
  p_design_project_id uuid default null,
  p_design_version_id uuid default null,
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
security definer
set search_path = ''
as $$
declare
  v_idempotency public.idempotency_keys%rowtype;
  v_order_id uuid;
  v_order_number text;
  v_payment_attempt_id uuid;
  v_submitted_at timestamptz;
  v_initial_status public.order_status := 'awaiting_payment'::public.order_status;
  v_initial_public_status public.public_order_status :=
    'payment_incomplete'::public.public_order_status;
  v_estimated_total_paise bigint;
  v_payment_amount_paise bigint;
  v_payment_purpose text;
  v_payment_number text;
  v_provider_merchant_txn_id text;
  v_customer_email text;
  v_customer_name text;
  v_item jsonb;
  v_order_item_id uuid;
  v_line_number integer;
  v_quantity integer;
  v_line_total_paise bigint;
  v_all_line_totals_present boolean := true;
  v_line_total_sum bigint := 0;
  v_size_breakdown jsonb;
  v_size_code text;
  v_size_value text;
  v_size_quantity integer;
  v_size_total integer;
  v_size_count integer;
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

  if p_expires_at is null or p_expires_at <= transaction_timestamp() then
    raise exception using
      errcode = '22023',
      message = 'invalid order expiry';
  end if;

  insert into public.idempotency_keys (
    scope,
    actor_id,
    key,
    request_hash,
    expires_at
  )
  values (
    'submit_order',
    p_customer_user_id,
    p_idempotency_key,
    p_request_hash,
    p_expires_at
  )
  on conflict (scope, actor_id, key) do nothing;

  select *
  into v_idempotency
  from public.idempotency_keys
  where scope = 'submit_order'
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
      existing_order.id,
      existing_order.order_number,
      existing_payment.id,
      existing_order.submitted_at
    into
      v_order_id,
      v_order_number,
      v_payment_attempt_id,
      v_submitted_at
    from public.orders as existing_order
    join public.payment_attempts as existing_payment
      on existing_payment.order_id = existing_order.id
      and existing_payment.attempt_number = 1
    where existing_order.id = v_idempotency.resource_id;

    if v_order_id is null then
      raise exception using
        errcode = 'P0001',
        message = 'idempotent order response is incomplete';
    end if;

    return query
    select v_order_id, v_order_number, v_payment_attempt_id, v_submitted_at;
    return;
  end if;

  if not exists (
    select 1
    from public.organization_members
    where organization_id = p_organization_id
      and user_id = p_customer_user_id
      and status = 'active'
  ) then
    raise exception using
      errcode = '42501',
      message = 'active organization membership required';
  end if;

  if p_design_version_id is not null and p_design_project_id is null then
    raise exception using
      errcode = '22023',
      message = 'design project is required for a design version';
  end if;

  if p_design_project_id is not null and not exists (
    select 1
    from public.design_projects
    where id = p_design_project_id
      and organization_id = p_organization_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'design project does not belong to organization';
  end if;

  if p_design_version_id is not null and not exists (
    select 1
    from public.design_project_versions
    where id = p_design_version_id
      and design_project_id = p_design_project_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'design version does not belong to design project';
  end if;

  if p_subtotal_paise < 0 or p_shipping_paise < 0 or p_tax_estimate_paise < 0 then
    raise exception using
      errcode = '22023',
      message = 'money values cannot be negative';
  end if;

  v_estimated_total_paise := p_subtotal_paise + p_shipping_paise + p_tax_estimate_paise;

  if p_order_type = 'sample_purchase' then
    if p_reservation_amount_paise <> 0 or v_estimated_total_paise <= 0 then
      raise exception using
        errcode = '22023',
        message = 'sample orders require a positive full amount and no reservation amount';
    end if;
    v_payment_amount_paise := v_estimated_total_paise;
    v_payment_purpose := 'sample_full';
  else
    if p_reservation_amount_paise <= 0 then
      raise exception using
        errcode = '22023',
        message = 'custom orders require a positive reservation amount';
    end if;
    if v_estimated_total_paise > 0 and p_reservation_amount_paise > v_estimated_total_paise then
      raise exception using
        errcode = '22023',
        message = 'reservation amount cannot exceed the estimated total';
    end if;
    v_payment_amount_paise := p_reservation_amount_paise;
    v_payment_purpose := 'reservation';
  end if;

  if p_configuration_schema_version <= 0 then
    raise exception using
      errcode = '22023',
      message = 'configuration schema version must be positive';
  end if;

  if p_pricing_version is null
    or p_pricing_version <> btrim(p_pricing_version)
    or char_length(p_pricing_version) not between 1 and 80 then
    raise exception using
      errcode = '22023',
      message = 'invalid pricing version';
  end if;

  if jsonb_typeof(p_billing_snapshot) <> 'object'
    or jsonb_typeof(p_shipping_snapshot) <> 'object'
    or jsonb_typeof(p_customer_snapshot) <> 'object'
    or jsonb_typeof(p_company_snapshot) <> 'object'
    or jsonb_typeof(p_terms_snapshot) <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'order snapshots must be JSON objects';
  end if;

  if jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1
    or jsonb_array_length(p_items) > 100 then
    raise exception using
      errcode = '22023',
      message = 'orders require between 1 and 100 items';
  end if;

  v_customer_email := lower(btrim(p_customer_snapshot ->> 'email'));
  v_customer_name := btrim(
    coalesce(
      nullif(p_customer_snapshot ->> 'name', ''),
      concat_ws(
        ' ',
        nullif(p_customer_snapshot ->> 'first_name', ''),
        nullif(p_customer_snapshot ->> 'last_name', '')
      )
    )
  );

  if v_customer_email is null
    or char_length(v_customer_email) not between 3 and 254
    or v_customer_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using
      errcode = '22023',
      message = 'customer snapshot requires a valid email';
  end if;

  if v_customer_name is null or char_length(v_customer_name) not between 1 and 160 then
    raise exception using
      errcode = '22023',
      message = 'customer snapshot requires a valid name';
  end if;

  v_order_number := public.allocate_order_number(p_order_type);
  v_order_id := gen_random_uuid();
  v_submitted_at := transaction_timestamp();

  insert into public.orders (
    id,
    order_number,
    order_type,
    organization_id,
    customer_user_id,
    design_project_id,
    design_version_id,
    status,
    public_status,
    currency,
    subtotal_paise,
    shipping_paise,
    tax_estimate_paise,
    estimated_total_paise,
    reservation_amount_paise,
    amount_paid_paise,
    pricing_version,
    configuration_schema_version,
    customer_reference,
    po_number,
    requested_delivery_date,
    billing_snapshot,
    shipping_snapshot,
    customer_snapshot,
    company_snapshot,
    terms_snapshot,
    submitted_at,
    expires_at
  )
  values (
    v_order_id,
    v_order_number,
    p_order_type,
    p_organization_id,
    p_customer_user_id,
    p_design_project_id,
    p_design_version_id,
    v_initial_status,
    v_initial_public_status,
    'INR',
    p_subtotal_paise,
    p_shipping_paise,
    p_tax_estimate_paise,
    v_estimated_total_paise,
    p_reservation_amount_paise,
    0,
    p_pricing_version,
    p_configuration_schema_version,
    nullif(p_customer_reference, ''),
    nullif(p_po_number, ''),
    p_requested_delivery_date,
    p_billing_snapshot,
    p_shipping_snapshot,
    p_customer_snapshot,
    p_company_snapshot,
    p_terms_snapshot,
    v_submitted_at,
    p_expires_at
  );

  for v_item in
    select item.value
    from jsonb_array_elements(p_items) as item(value)
  loop
    begin
      v_line_number := (v_item ->> 'line_number')::integer;
      v_quantity := (v_item ->> 'quantity')::integer;
      v_line_total_paise := nullif(v_item ->> 'line_total_paise', '')::bigint;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception using
          errcode = '22023',
          message = 'order item contains an invalid numeric value';
    end;

    v_size_breakdown := v_item -> 'size_breakdown';
    if jsonb_typeof(v_size_breakdown) <> 'object' then
      raise exception using
        errcode = '22023',
        message = 'order item size breakdown must be a JSON object';
    end if;

    insert into public.order_items (
      order_id,
      line_number,
      product_id,
      product_slug,
      product_name,
      product_snapshot,
      colour_snapshot,
      decoration_snapshot,
      artwork_snapshot,
      neck_label_snapshot,
      size_breakdown,
      quantity,
      unit_price_paise,
      line_total_paise
    )
    values (
      v_order_id,
      v_line_number,
      nullif(v_item ->> 'product_id', ''),
      nullif(v_item ->> 'product_slug', ''),
      v_item ->> 'product_name',
      v_item -> 'product_snapshot',
      v_item -> 'colour_snapshot',
      v_item -> 'decoration_snapshot',
      v_item -> 'artwork_snapshot',
      v_item -> 'neck_label_snapshot',
      v_size_breakdown,
      v_quantity,
      nullif(v_item ->> 'unit_price_paise', '')::bigint,
      v_line_total_paise
    )
    returning id into v_order_item_id;

    v_size_total := 0;
    v_size_count := 0;
    for v_size_code, v_size_value in
      select size_entry.key, size_entry.value
      from jsonb_each_text(v_size_breakdown) as size_entry(key, value)
    loop
      begin
        v_size_quantity := v_size_value::integer;
      exception
        when invalid_text_representation or numeric_value_out_of_range then
          raise exception using
            errcode = '22023',
            message = 'size quantity must be an integer';
      end;

      insert into public.order_item_sizes (order_item_id, size_code, quantity)
      values (v_order_item_id, v_size_code, v_size_quantity);

      v_size_total := v_size_total + v_size_quantity;
      v_size_count := v_size_count + 1;
    end loop;

    if v_size_count = 0 or v_size_total <> v_quantity then
      raise exception using
        errcode = '22023',
        message = 'size quantities must add up to the order item quantity';
    end if;

    if v_line_total_paise is null then
      v_all_line_totals_present := false;
    else
      v_line_total_sum := v_line_total_sum + v_line_total_paise;
    end if;
  end loop;

  if v_all_line_totals_present and v_line_total_sum <> p_subtotal_paise then
    raise exception using
      errcode = '22023',
      message = 'order item totals must equal the order subtotal';
  end if;

  insert into public.order_status_history (
    order_id,
    from_status,
    to_status,
    public_status,
    actor_type,
    actor_user_id,
    customer_visible,
    customer_message
  )
  values (
    v_order_id,
    null,
    v_initial_status,
    v_initial_public_status,
    'customer',
    p_customer_user_id,
    true,
    'Order submitted; payment is incomplete.'
  );

  v_payment_number := format('PAY-%s-01', v_order_number);
  v_provider_merchant_txn_id :=
    case when p_order_type = 'sample_purchase' then 'S' else 'G' end
    || regexp_replace(v_order_number, '[^0-9]', '', 'g')
    || 'P01';
  v_payment_attempt_id := gen_random_uuid();

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
    v_payment_attempt_id,
    v_payment_number,
    v_order_id,
    'payu',
    v_provider_merchant_txn_id,
    1,
    v_payment_purpose,
    v_payment_amount_paise,
    'INR',
    'created',
    format('Garmops order %s', v_order_number),
    v_customer_email,
    v_customer_name
  );

  update public.idempotency_keys
  set
    resource_type = 'order',
    resource_id = v_order_id,
    response_status = 201,
    response_body = jsonb_build_object(
      'order_id', v_order_id,
      'order_number', v_order_number,
      'payment_attempt_id', v_payment_attempt_id,
      'submitted_at', v_submitted_at
    )
  where id = v_idempotency.id;

  return query
  select v_order_id, v_order_number, v_payment_attempt_id, v_submitted_at;
end;
$$;

revoke all on function public.submit_order(
  text,
  text,
  public.order_type,
  uuid,
  uuid,
  bigint,
  bigint,
  bigint,
  bigint,
  text,
  integer,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  uuid,
  uuid,
  text,
  text,
  date,
  timestamptz
) from public, anon, authenticated;
grant execute on function public.submit_order(
  text,
  text,
  public.order_type,
  uuid,
  uuid,
  bigint,
  bigint,
  bigint,
  bigint,
  text,
  integer,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  uuid,
  uuid,
  text,
  text,
  date,
  timestamptz
) to service_role;

create function public.finalize_verified_payment(
  p_payment_attempt_id uuid,
  p_provider_payment_id text,
  p_verified_amount_paise bigint,
  p_currency char(3),
  p_verified_snapshot jsonb,
  p_invoice_kind public.invoice_kind default 'reservation_retainer'
)
returns table (
  order_id uuid,
  order_number text,
  payment_attempt_id uuid,
  invoice_id uuid,
  invoice_job_id uuid,
  already_finalized boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.payment_attempts%rowtype;
  v_order public.orders%rowtype;
  v_previous_status public.order_status;
  v_next_status public.order_status;
  v_next_public_status public.public_order_status;
  v_invoice_id uuid;
  v_invoice_job_id uuid;
begin
  if p_provider_payment_id is null
    or p_provider_payment_id <> btrim(p_provider_payment_id)
    or char_length(p_provider_payment_id) not between 1 and 120 then
    raise exception using
      errcode = '22023',
      message = 'invalid provider payment id';
  end if;

  if p_verified_amount_paise <= 0 then
    raise exception using
      errcode = '22023',
      message = 'verified amount must be positive';
  end if;

  if p_currency::text !~ '^[A-Z]{3}$' then
    raise exception using
      errcode = '22023',
      message = 'invalid payment currency';
  end if;

  if jsonb_typeof(p_verified_snapshot) <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'verified provider snapshot must be a JSON object';
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

  if v_attempt.amount_paise <> p_verified_amount_paise
    or v_attempt.currency <> p_currency then
    raise exception using
      errcode = '22023',
      message = 'verified payment does not match expected amount or currency';
  end if;

  select *
  into v_order
  from public.orders
  where id = v_attempt.order_id
  for update;

  if v_attempt.status = 'paid' then
    if v_attempt.provider_payment_id is distinct from p_provider_payment_id then
      raise exception using
        errcode = '22023',
        message = 'paid attempt has a different provider payment id';
    end if;

    select existing_invoice.id
    into v_invoice_id
    from public.invoices as existing_invoice
    where existing_invoice.payment_attempt_id = v_attempt.id
    order by existing_invoice.created_at
    limit 1;

    if v_invoice_id is not null then
      select existing_job.id
      into v_invoice_job_id
      from public.integration_jobs as existing_job
      where existing_job.dedupe_key = format('create_reservation_invoice:%s', v_attempt.id);
    end if;

    return query
    select
      v_order.id,
      v_order.order_number,
      v_attempt.id,
      v_invoice_id,
      v_invoice_job_id,
      true;
    return;
  end if;

  if v_attempt.status not in ('created', 'initiated', 'pending', 'failed') then
    raise exception using
      errcode = '22023',
      message = 'payment attempt cannot transition to paid';
  end if;

  if v_order.status not in ('awaiting_payment', 'payment_failed', 'expired') then
    raise exception using
      errcode = '22023',
      message = 'order state does not accept initial payment finalisation';
  end if;

  if exists (
    select 1
    from public.payment_attempts as other_attempt
    where other_attempt.order_id = v_attempt.order_id
      and other_attempt.purpose = v_attempt.purpose
      and other_attempt.status = 'paid'
      and other_attempt.id <> v_attempt.id
  ) then
    raise exception using
      errcode = '23505',
      message = 'another payment attempt already paid this order purpose';
  end if;

  if v_order.estimated_total_paise > 0
    and v_order.amount_paid_paise + v_attempt.amount_paise > v_order.estimated_total_paise then
    raise exception using
      errcode = '22023',
      message = 'verified payment would exceed the expected order total';
  end if;

  if v_attempt.purpose = 'reservation' then
    if v_order.order_type not in ('custom_bulk', 'reorder')
      or v_attempt.amount_paise <> v_order.reservation_amount_paise then
      raise exception using
        errcode = '22023',
        message = 'reservation payment does not match the order';
    end if;
    if p_invoice_kind not in ('reservation_retainer', 'reservation_invoice') then
      raise exception using
        errcode = '22023',
        message = 'invalid reservation invoice kind';
    end if;
    v_next_status := 'reservation_paid';
    v_next_public_status := 'order_submitted';
  elsif v_attempt.purpose = 'sample_full' then
    if v_order.order_type <> 'sample_purchase'
      or v_attempt.amount_paise <> v_order.estimated_total_paise then
      raise exception using
        errcode = '22023',
        message = 'sample payment does not match the order';
    end if;
    v_next_status := 'submitted_for_review';
    v_next_public_status := 'order_submitted';
  else
    v_next_status := 'submitted_for_review';
    v_next_public_status := 'order_submitted';
  end if;

  v_previous_status := v_order.status;

  update public.payment_attempts
  set
    provider_payment_id = p_provider_payment_id,
    status = 'paid',
    paid_at = transaction_timestamp(),
    last_verified_at = transaction_timestamp(),
    failure_code = null,
    failure_message = null,
    raw_verified_snapshot = p_verified_snapshot
  where id = v_attempt.id;

  update public.orders
  set
    status = v_next_status,
    public_status = v_next_public_status,
    amount_paid_paise = amount_paid_paise + v_attempt.amount_paise,
    reservation_paid_at = case
      when v_attempt.purpose = 'reservation' then transaction_timestamp()
      else reservation_paid_at
    end
  where id = v_order.id;

  insert into public.order_status_history (
    order_id,
    from_status,
    to_status,
    public_status,
    actor_type,
    customer_visible,
    customer_message,
    metadata
  )
  values (
    v_order.id,
    v_previous_status,
    v_next_status,
    v_next_public_status,
    'provider',
    true,
    'Payment verified.',
    jsonb_build_object(
      'payment_attempt_id', v_attempt.id,
      'provider', v_attempt.provider,
      'purpose', v_attempt.purpose
    )
  );

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
    'payment.verified',
    'payment_attempt',
    v_attempt.id,
    v_order.organization_id,
    v_order.id,
    jsonb_build_object('status', v_attempt.status),
    jsonb_build_object(
      'status', 'paid',
      'amount_paise', v_attempt.amount_paise,
      'currency', v_attempt.currency,
      'provider_payment_id', p_provider_payment_id
    )
  );

  if v_attempt.purpose = 'reservation' then
    insert into public.invoices (
      order_id,
      payment_attempt_id,
      kind,
      provider,
      sync_status,
      reference_number,
      currency,
      total_paise,
      paid_paise,
      balance_paise
    )
    values (
      v_order.id,
      v_attempt.id,
      p_invoice_kind,
      'zoho_invoice',
      'queued',
      format('GARMOPS-RESERVATION-%s', v_attempt.id),
      v_attempt.currency,
      v_attempt.amount_paise,
      v_attempt.amount_paise,
      0
    )
    on conflict on constraint invoices_payment_attempt_id_kind_key do nothing
    returning id into v_invoice_id;

    if v_invoice_id is null then
      select existing_invoice.id
      into v_invoice_id
      from public.invoices as existing_invoice
      where existing_invoice.payment_attempt_id = v_attempt.id
        and existing_invoice.kind = p_invoice_kind;
    end if;

    insert into public.integration_jobs (
      job_type,
      dedupe_key,
      aggregate_type,
      aggregate_id,
      payload,
      priority
    )
    values (
      'create_reservation_invoice',
      format('create_reservation_invoice:%s', v_attempt.id),
      'invoice',
      v_invoice_id,
      jsonb_build_object(
        'invoice_id', v_invoice_id,
        'payment_attempt_id', v_attempt.id,
        'order_id', v_order.id
      ),
      20
    )
    on conflict (dedupe_key) do nothing
    returning id into v_invoice_job_id;

    if v_invoice_job_id is null then
      select existing_job.id
      into v_invoice_job_id
      from public.integration_jobs as existing_job
      where existing_job.dedupe_key = format('create_reservation_invoice:%s', v_attempt.id);
    end if;
  end if;

  insert into public.integration_jobs (
    job_type,
    dedupe_key,
    aggregate_type,
    aggregate_id,
    payload,
    priority
  )
  values (
    'send_payment_confirmation',
    format('send_payment_confirmation:%s', v_attempt.id),
    'order',
    v_order.id,
    jsonb_build_object(
      'payment_attempt_id', v_attempt.id,
      'order_id', v_order.id
    ),
    50
  )
  on conflict (dedupe_key) do nothing;

  return query
  select
    v_order.id,
    v_order.order_number,
    v_attempt.id,
    v_invoice_id,
    v_invoice_job_id,
    false;
end;
$$;

revoke all on function public.finalize_verified_payment(
  uuid,
  text,
  bigint,
  char,
  jsonb,
  public.invoice_kind
) from public, anon, authenticated;
grant execute on function public.finalize_verified_payment(
  uuid,
  text,
  bigint,
  char,
  jsonb,
  public.invoice_kind
) to service_role;

create function public.claim_integration_jobs(
  p_worker_id text,
  p_batch_size integer default 20,
  p_lock_timeout interval default interval '15 minutes'
)
returns setof public.integration_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_worker_id is null
    or p_worker_id <> btrim(p_worker_id)
    or char_length(p_worker_id) not between 1 and 200 then
    raise exception using
      errcode = '22023',
      message = 'invalid worker id';
  end if;

  if p_batch_size not between 1 and 100 then
    raise exception using
      errcode = '22023',
      message = 'job batch size must be between 1 and 100';
  end if;

  if p_lock_timeout < interval '1 minute' or p_lock_timeout > interval '1 day' then
    raise exception using
      errcode = '22023',
      message = 'job lock timeout must be between 1 minute and 1 day';
  end if;

  update public.integration_jobs
  set
    status = 'dead',
    locked_at = null,
    locked_by = null,
    last_error = coalesce(last_error, 'maximum attempts reached before claim')
  where attempt_count >= max_attempts
    and status in ('pending', 'retry', 'processing')
    and (
      status <> 'processing'
      or locked_at <= transaction_timestamp() - p_lock_timeout
    );

  return query
  with claimable as (
    select candidate.id
    from public.integration_jobs as candidate
    where candidate.attempt_count < candidate.max_attempts
      and (
        (
          candidate.status in ('pending', 'retry')
          and candidate.available_at <= transaction_timestamp()
        )
        or (
          candidate.status = 'processing'
          and candidate.locked_at <= transaction_timestamp() - p_lock_timeout
        )
      )
    order by candidate.priority, candidate.available_at, candidate.created_at
    for update skip locked
    limit p_batch_size
  )
  update public.integration_jobs as job
  set
    status = 'processing',
    attempt_count = job.attempt_count + 1,
    locked_at = transaction_timestamp(),
    locked_by = p_worker_id,
    completed_at = null
  from claimable
  where job.id = claimable.id
  returning job.*;
end;
$$;

revoke all on function public.claim_integration_jobs(text, integer, interval)
  from public, anon, authenticated;
grant execute on function public.claim_integration_jobs(text, integer, interval)
  to service_role;

create function public.complete_integration_job(
  p_job_id uuid,
  p_worker_id text
)
returns public.integration_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.integration_jobs%rowtype;
begin
  update public.integration_jobs
  set
    status = 'completed',
    completed_at = transaction_timestamp(),
    locked_at = null,
    locked_by = null,
    last_error = null
  where id = p_job_id
    and status = 'processing'
    and locked_by = p_worker_id
  returning * into v_job;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'locked integration job not found';
  end if;

  return v_job;
end;
$$;

revoke all on function public.complete_integration_job(uuid, text)
  from public, anon, authenticated;
grant execute on function public.complete_integration_job(uuid, text)
  to service_role;

create function public.fail_integration_job(
  p_job_id uuid,
  p_worker_id text,
  p_error text,
  p_retryable boolean
)
returns public.integration_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.integration_jobs%rowtype;
  v_retry_delay interval;
begin
  select *
  into v_job
  from public.integration_jobs
  where id = p_job_id
    and status = 'processing'
    and locked_by = p_worker_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'locked integration job not found';
  end if;

  if p_error is null or btrim(p_error) = '' then
    raise exception using
      errcode = '22023',
      message = 'job failure requires an error summary';
  end if;

  v_retry_delay := case
    when v_job.attempt_count <= 1 then interval '2 minutes'
    when v_job.attempt_count = 2 then interval '10 minutes'
    when v_job.attempt_count = 3 then interval '30 minutes'
    when v_job.attempt_count = 4 then interval '2 hours'
    else interval '12 hours'
  end;

  update public.integration_jobs
  set
    status = case
      when not p_retryable or attempt_count >= max_attempts then 'dead'
      else 'retry'
    end,
    available_at = case
      when not p_retryable or attempt_count >= max_attempts then available_at
      else transaction_timestamp() + v_retry_delay
    end,
    locked_at = null,
    locked_by = null,
    last_error = left(btrim(p_error), 4000)
  where id = p_job_id
  returning * into v_job;

  return v_job;
end;
$$;

revoke all on function public.fail_integration_job(uuid, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.fail_integration_job(uuid, text, text, boolean)
  to service_role;

create function public.prevent_append_only_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = format('%I is append-only', tg_table_name);
end;
$$;

revoke execute on function public.prevent_append_only_mutation() from public, anon, authenticated;

create function public.protect_order_immutable_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    new.order_number,
    new.order_type,
    new.organization_id,
    new.customer_user_id,
    new.design_project_id,
    new.design_version_id,
    new.currency,
    new.subtotal_paise,
    new.shipping_paise,
    new.tax_estimate_paise,
    new.estimated_total_paise,
    new.reservation_amount_paise,
    new.pricing_version,
    new.configuration_schema_version,
    new.customer_reference,
    new.po_number,
    new.requested_delivery_date,
    new.billing_snapshot,
    new.shipping_snapshot,
    new.customer_snapshot,
    new.company_snapshot,
    new.terms_snapshot,
    new.submitted_at,
    new.created_at
  ) is distinct from row(
    old.order_number,
    old.order_type,
    old.organization_id,
    old.customer_user_id,
    old.design_project_id,
    old.design_version_id,
    old.currency,
    old.subtotal_paise,
    old.shipping_paise,
    old.tax_estimate_paise,
    old.estimated_total_paise,
    old.reservation_amount_paise,
    old.pricing_version,
    old.configuration_schema_version,
    old.customer_reference,
    old.po_number,
    old.requested_delivery_date,
    old.billing_snapshot,
    old.shipping_snapshot,
    old.customer_snapshot,
    old.company_snapshot,
    old.terms_snapshot,
    old.submitted_at,
    old.created_at
  ) then
    raise exception using
      errcode = '55000',
      message = 'submitted order snapshots and commercial fields are immutable';
  end if;

  return new;
end;
$$;

revoke execute on function public.protect_order_immutable_fields() from public, anon, authenticated;

create function public.protect_payment_event_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using
      errcode = '55000',
      message = 'payment events cannot be deleted';
  end if;

  if row(
    new.payment_attempt_id,
    new.provider,
    new.event_source,
    new.provider_event_id,
    new.event_fingerprint,
    new.event_type,
    new.payload,
    new.received_at
  ) is distinct from row(
    old.payment_attempt_id,
    old.provider,
    old.event_source,
    old.provider_event_id,
    old.event_fingerprint,
    old.event_type,
    old.payload,
    old.received_at
  ) then
    raise exception using
      errcode = '55000',
      message = 'payment event identity and payload are immutable';
  end if;

  return new;
end;
$$;

revoke execute on function public.protect_payment_event_fields() from public, anon, authenticated;

create trigger design_projects_set_updated_at
before update on public.design_projects
for each row execute function public.set_updated_at();

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create trigger payment_attempts_set_updated_at
before update on public.payment_attempts
for each row execute function public.set_updated_at();

create trigger order_comments_set_updated_at
before update on public.order_comments
for each row execute function public.set_updated_at();

create trigger invoices_set_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

create trigger integration_jobs_set_updated_at
before update on public.integration_jobs
for each row execute function public.set_updated_at();

create trigger shipments_set_updated_at
before update on public.shipments
for each row execute function public.set_updated_at();

create trigger design_project_versions_append_only
before update or delete on public.design_project_versions
for each row execute function public.prevent_append_only_mutation();

create trigger orders_prevent_delete
before delete on public.orders
for each row execute function public.prevent_append_only_mutation();

create trigger orders_protect_immutable_fields
before update on public.orders
for each row execute function public.protect_order_immutable_fields();

create trigger order_items_append_only
before update or delete on public.order_items
for each row execute function public.prevent_append_only_mutation();

create trigger order_item_sizes_append_only
before update or delete on public.order_item_sizes
for each row execute function public.prevent_append_only_mutation();

create trigger payment_events_protect_fields
before update or delete on public.payment_events
for each row execute function public.protect_payment_event_fields();

create trigger order_status_history_append_only
before update or delete on public.order_status_history
for each row execute function public.prevent_append_only_mutation();

create trigger audit_logs_append_only
before update or delete on public.audit_logs
for each row execute function public.prevent_append_only_mutation();

alter table public.design_projects enable row level security;
alter table public.design_project_versions enable row level security;
alter table public.number_counters enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_sizes enable row level security;
alter table public.idempotency_keys enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.payment_events enable row level security;
alter table public.order_status_history enable row level security;
alter table public.order_comments enable row level security;
alter table public.order_files enable row level security;
alter table public.approvals enable row level security;
alter table public.invoices enable row level security;
alter table public.integration_jobs enable row level security;
alter table public.shipments enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

comment on table public.design_project_versions is
  'Immutable configurator snapshots; updates and deletes are blocked.';
comment on table public.orders is
  'Durable submitted orders with immutable commercial, customer, company, address, and terms snapshots.';
comment on table public.payment_attempts is
  'Server-created PayU attempts; browser redirects never establish paid state.';
comment on table public.payment_events is
  'Deduplicated provider event evidence with immutable identity and payload fields.';
comment on table public.order_files is
  'R2 metadata only; file bytes never belong in PostgreSQL.';
comment on table public.invoices is
  'Operational copy of Zoho-authoritative accounting document state and identifiers.';
comment on table public.integration_jobs is
  'Durable low-cost outbox claimed in bounded batches with FOR UPDATE SKIP LOCKED.';
comment on table public.audit_logs is
  'Append-only security and operational audit evidence.';

comment on function public.allocate_order_number(public.order_type) is
  'Atomically allocates GAR/SAM order numbers using the Asia/Kolkata business year.';
comment on function public.submit_order(
  text,
  text,
  public.order_type,
  uuid,
  uuid,
  bigint,
  bigint,
  bigint,
  bigint,
  text,
  integer,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  uuid,
  uuid,
  text,
  text,
  date,
  timestamptz
) is
  'Service-only idempotent transaction for order, item, size, history, and first payment-attempt creation.';
comment on function public.finalize_verified_payment(
  uuid,
  text,
  bigint,
  char,
  jsonb,
  public.invoice_kind
) is
  'Service-only idempotent verified-payment finalisation and durable job enqueueing.';
comment on function public.claim_integration_jobs(text, integer, interval) is
  'Service-only bounded job claiming with stale-lock recovery and FOR UPDATE SKIP LOCKED.';
