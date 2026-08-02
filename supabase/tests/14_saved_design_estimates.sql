create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;

select plan(17);

select has_table('public', 'design_estimates', 'dated design estimate table exists');
select has_column('public', 'design_estimates', 'design_version_id', 'estimate is tied to a design version');
select has_column('public', 'design_estimates', 'design_revision', 'estimate stores the source design revision');
select has_column('public', 'design_estimates', 'pricing_snapshot', 'estimate stores a pricing snapshot');
select has_column('public', 'design_estimates', 'client_operation_id', 'estimate has an idempotency key');
select has_index('public', 'design_estimates', 'design_estimates_org_operation_uidx', 'estimate operations are unique per organisation');
select has_index('public', 'design_estimates', 'design_estimates_active_idx', 'active estimate lookup index exists');
select ok(to_regprocedure('public.create_design_estimate_from_server(uuid,uuid,uuid,bigint,uuid,text,jsonb,bigint,bigint,bigint,integer,bigint,bigint,bigint,bigint,bigint,timestamptz)') is not null, 'server estimate transaction exists');
select ok(to_regprocedure('public.link_order_to_estimate(uuid,uuid,uuid)') is not null, 'order conversion link function exists');
select ok(not has_function_privilege('anon', 'public.create_design_estimate_from_server(uuid,uuid,uuid,bigint,uuid,text,jsonb,bigint,bigint,bigint,integer,bigint,bigint,bigint,bigint,bigint,timestamptz)', 'EXECUTE'), 'anon cannot create estimates');
select ok(not has_function_privilege('authenticated', 'public.create_design_estimate_from_server(uuid,uuid,uuid,bigint,uuid,text,jsonb,bigint,bigint,bigint,integer,bigint,bigint,bigint,bigint,bigint,timestamptz)', 'EXECUTE'), 'customers cannot call the server estimate transaction');
select ok(has_function_privilege('service_role', 'public.create_design_estimate_from_server(uuid,uuid,uuid,bigint,uuid,text,jsonb,bigint,bigint,bigint,integer,bigint,bigint,bigint,bigint,bigint,timestamptz)', 'EXECUTE'), 'only service role can call the server estimate transaction');
select ok(not has_table_privilege('authenticated', 'public.design_estimates', 'INSERT'), 'customers cannot insert authoritative estimates');
select ok(not has_table_privilege('authenticated', 'public.design_estimates', 'UPDATE'), 'customers cannot update authoritative estimates');
select has_column('public', 'orders', 'estimate_id', 'orders can retain estimate traceability');
select ok((select relrowsecurity from pg_class where oid = 'public.design_estimates'::regclass), 'estimate table has row level security enabled');
select ok((select relforcerowsecurity from pg_class where oid = 'public.design_estimates'::regclass), 'estimate table forces row level security');

select * from finish();
rollback;
