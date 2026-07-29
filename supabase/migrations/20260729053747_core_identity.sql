-- Garmops Phase 1: identity, organisations, staff, and reusable addresses.
-- Order/payment/file/invoice schemas are intentionally deferred to Phase 2.

create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.organization_role as enum (
  'owner',
  'buyer',
  'approver',
  'finance',
  'viewer'
);

create type public.staff_role as enum (
  'super_admin',
  'operations_admin',
  'sales',
  'production',
  'artwork',
  'finance',
  'qc',
  'dispatch',
  'support',
  'read_only'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null
    check (first_name = btrim(first_name) and char_length(first_name) between 1 and 80),
  last_name text not null
    check (last_name = btrim(last_name) and char_length(last_name) between 1 and 80),
  phone text
    check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  job_title text
    check (job_title is null or (job_title = btrim(job_title) and char_length(job_title) between 1 and 120)),
  department text
    check (department is null or (department = btrim(department) and char_length(department) between 1 and 120)),
  avatar_r2_key text
    check (avatar_r2_key is null or (avatar_r2_key = btrim(avatar_r2_key) and char_length(avatar_r2_key) between 1 and 1024)),
  locale text not null default 'en-IN'
    check (locale = btrim(locale) and char_length(locale) between 2 and 35),
  timezone text not null default 'Asia/Kolkata'
    check (timezone = btrim(timezone) and char_length(timezone) between 1 and 64),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null
    check (legal_name = btrim(legal_name) and char_length(legal_name) between 1 and 200),
  display_name text not null
    check (display_name = btrim(display_name) and char_length(display_name) between 1 and 120),
  slug text unique
    check (slug is null or (slug = lower(btrim(slug)) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) between 2 and 80)),
  industry text
    check (industry is null or (industry = btrim(industry) and char_length(industry) between 1 and 120)),
  website text
    check (website is null or (website = btrim(website) and char_length(website) between 1 and 500)),
  gstin text unique
    check (
      gstin is null
      or (
        gstin = upper(btrim(gstin))
        and gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
      )
    ),
  pan text
    check (
      pan is null
      or (
        pan = upper(btrim(pan))
        and pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'
      )
    ),
  billing_email extensions.citext
    check (
      billing_email is null
      or (
        billing_email::text = btrim(billing_email::text)
        and char_length(billing_email::text) between 3 and 254
        and billing_email::text ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      )
    ),
  phone text
    check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  status text not null default 'active'
    check (status in ('active', 'inactive', 'blocked')),
  zoho_contact_id text unique
    check (zoho_contact_id is null or (zoho_contact_id = btrim(zoho_contact_id) and char_length(zoho_contact_id) between 1 and 100)),
  zoho_contact_synced_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.organization_role not null,
  status text not null default 'active'
    check (status in ('invited', 'active', 'suspended')),
  invited_by uuid references public.profiles(id),
  invited_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id),
  check (
    (status = 'invited' and accepted_at is null)
    or (status in ('active', 'suspended') and accepted_at is not null)
  )
);

create table public.staff_members (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role public.staff_role not null,
  team text
    check (team is null or (team = btrim(team) and char_length(team) between 1 and 80)),
  active boolean not null default true,
  must_use_mfa boolean not null default true,
  invited_by uuid references public.profiles(id),
  invited_at timestamptz,
  activated_at timestamptz,
  deactivated_at timestamptz,
  last_staff_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (deactivated_at is null or not active)
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  label text
    check (label is null or (label = btrim(label) and char_length(label) between 1 and 80)),
  contact_name text
    check (contact_name is null or (contact_name = btrim(contact_name) and char_length(contact_name) between 1 and 160)),
  phone text
    check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  line1 text not null
    check (line1 = btrim(line1) and char_length(line1) between 1 and 200),
  line2 text
    check (line2 is null or (line2 = btrim(line2) and char_length(line2) between 1 and 200)),
  landmark text
    check (landmark is null or (landmark = btrim(landmark) and char_length(landmark) between 1 and 160)),
  city text not null
    check (city = btrim(city) and char_length(city) between 1 and 100),
  state text not null
    check (state = btrim(state) and char_length(state) between 1 and 100),
  postal_code text not null
    check (postal_code = btrim(postal_code) and char_length(postal_code) between 2 and 20),
  country_code text not null default 'IN'
    check (country_code = upper(country_code) and country_code ~ '^[A-Z]{2}$'),
  gstin text
    check (
      gstin is null
      or (
        gstin = upper(btrim(gstin))
        and gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
      )
    ),
  is_default_billing boolean not null default false,
  is_default_shipping boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (country_code <> 'IN' or postal_code ~ '^[1-9][0-9]{5}$')
);

create index organization_members_user_status_idx
  on public.organization_members (user_id, status, organization_id);

create index organization_members_organization_status_idx
  on public.organization_members (organization_id, status, role);

create index organizations_status_created_at_idx
  on public.organizations (status, created_at desc);

create index addresses_organization_idx
  on public.addresses (organization_id, created_at desc);

create unique index addresses_one_default_billing_per_organization_idx
  on public.addresses (organization_id)
  where is_default_billing;

create unique index addresses_one_default_shipping_per_organization_idx
  on public.addresses (organization_id)
  where is_default_shipping;

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

revoke execute on function public.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger staff_members_set_updated_at
before update on public.staff_members
for each row execute function public.set_updated_at();

create trigger addresses_set_updated_at
before update on public.addresses
for each row execute function public.set_updated_at();

-- Fail closed until the reviewed customer/staff policies are added in Phase 3.
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.staff_members enable row level security;
alter table public.addresses enable row level security;

comment on table public.profiles is
  'Application profile keyed by the authoritative Supabase Auth user ID.';
comment on table public.organizations is
  'Customer company and current accounting/contact metadata.';
comment on table public.organization_members is
  'Tenant membership and customer role; never derived from editable Auth metadata.';
comment on table public.staff_members is
  'Invite-only staff access; normal customer registration never writes this table.';
comment on table public.addresses is
  'Reusable current addresses; submitted orders copy immutable address snapshots.';
