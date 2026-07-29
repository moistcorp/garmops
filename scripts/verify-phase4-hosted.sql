\pset tuples_only on
\pset format unaligned

select 'migration=' || count(*)
from supabase_migrations.schema_migrations
where version = '20260729143000';

select 'forced_rls=' || count(*)
from pg_class
where oid = 'public.auth_rate_limits'::regclass
  and relrowsecurity
  and relforcerowsecurity;

select 'phase4_functions=' || count(*)
from pg_proc
where oid = any(array[
  'public.consume_auth_rate_limit(text,text,integer,integer)'::regprocedure,
  'public.complete_customer_onboarding(text,text,text,text,text,text,text,text,text,text,text)'::regprocedure,
  'public.provision_staff_invitation(uuid,text,text,public.staff_role,text)'::regprocedure,
  'public.activate_invited_staff()'::regprocedure,
  'public.deactivate_staff_member(uuid)'::regprocedure,
  'public.record_staff_login()'::regprocedure
]);

select 'anon_phase4_execute=' || count(*)
from pg_proc
where oid = any(array[
  'public.consume_auth_rate_limit(text,text,integer,integer)'::regprocedure,
  'public.complete_customer_onboarding(text,text,text,text,text,text,text,text,text,text,text)'::regprocedure,
  'public.provision_staff_invitation(uuid,text,text,public.staff_role,text)'::regprocedure,
  'public.activate_invited_staff()'::regprocedure,
  'public.deactivate_staff_member(uuid)'::regprocedure,
  'public.record_staff_login()'::regprocedure
])
  and has_function_privilege('anon', oid, 'EXECUTE');

select 'profiles=' || count(*) from public.profiles;
select 'organizations=' || count(*) from public.organizations;
select 'staff_members=' || count(*) from public.staff_members;
