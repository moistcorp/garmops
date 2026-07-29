create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;

select plan(19);

select has_type('public', 'organization_role', 'organization_role enum exists');
select has_type('public', 'staff_role', 'staff_role enum exists');
select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'organizations', 'organizations table exists');
select has_table('public', 'organization_members', 'organization_members table exists');
select has_table('public', 'staff_members', 'staff_members table exists');
select has_table('public', 'addresses', 'addresses table exists');
select col_is_pk('public', 'profiles', 'id', 'profiles.id is the primary key');
select col_is_pk(
  'public',
  'organization_members',
  array['organization_id', 'user_id'],
  'organization membership has a composite primary key'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.organizations'::regclass),
  'organizations has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.organization_members'::regclass),
  'organization_members has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.staff_members'::regclass),
  'staff_members has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.addresses'::regclass),
  'addresses has RLS enabled'
);

select is((select count(*) from public.profiles), 5::bigint, 'five local profiles are seeded');
select is((select count(*) from public.organizations), 2::bigint, 'two isolated local organizations are seeded');
select is((select count(*) from public.organization_members), 3::bigint, 'three organization memberships are seeded');
select is((select count(*) from public.staff_members), 2::bigint, 'admin and read-only staff fixtures are seeded');
select is((select count(*) from public.addresses), 2::bigint, 'one default address per organization is seeded');

select * from finish();
rollback;
