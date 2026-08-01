create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;

select plan(52);

select ok(to_regprocedure('public.staff_create_approval_request(uuid,uuid,uuid,uuid,text,text,timestamp with time zone)') is not null, 'versioned approval request RPC exists');
select ok(to_regprocedure('public.respond_order_approval(uuid,text,text)') is not null, 'company approval response RPC exists');
select ok(to_regprocedure('public.external_respond_order_approval(text,text,text,text,text)') is not null, 'external approval response RPC exists');
select ok(to_regprocedure('public.staff_create_shipment(uuid,text,text,text,integer,timestamp with time zone,text)') is not null, 'shipment creation RPC exists');
select ok(to_regprocedure('public.staff_update_shipment(uuid,text,text,text,text,integer,timestamp with time zone,text,text,text)') is not null, 'shipment event RPC exists');
select ok(to_regprocedure('public.customer_shipment_events(uuid)') is not null, 'customer-safe shipment timeline RPC exists');
select ok(to_regprocedure('public.staff_order_approvals(uuid)') is not null, 'staff approval workspace projection exists');
select ok(to_regprocedure('public.staff_approval_queue(integer)') is not null, 'staff approval queue projection exists');
select ok(to_regprocedure('public.submit_reorder_order(text,text,uuid,uuid,uuid,bigint,bigint,bigint,bigint,text,integer,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,uuid,uuid,text,text,date,timestamp with time zone)') is not null, 'durable reorder RPC exists');
select ok(has_function_privilege('authenticated','public.respond_order_approval(uuid,text,text)','EXECUTE'), 'authenticated company approvers can respond');
select ok(not has_function_privilege('authenticated','public.external_respond_order_approval(text,text,text,text,text)','EXECUTE'), 'browser sessions cannot forge external responses');
select ok(has_function_privilege('service_role','public.external_respond_order_approval(text,text,text,text,text)','EXECUTE'), 'trusted server can process external responses');
select ok(not has_column_privilege('authenticated','public.approvals','secure_token_hash','SELECT'), 'approval bearer-token hashes are not exposed to browsers');
select ok(not has_column_privilege('authenticated','public.approvals','ip_hash','SELECT'), 'approval network evidence is not exposed to browsers');
select ok(not has_column_privilege('authenticated','public.approvals','requested_from_email','SELECT'), 'external approver email is not exposed through customer table access');
select ok(has_function_privilege('authenticated','public.staff_order_approvals(uuid)','EXECUTE'), 'MFA staff projection is callable by authenticated sessions');
select ok(has_function_privilege('authenticated','public.staff_approval_queue(integer)','EXECUTE'), 'MFA staff queue projection is callable by authenticated sessions');

insert into public.design_projects(id,organization_id,created_by,title,status,schema_version,current_version,source,submitted_at)
values ('b1000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Phase 11 source design','submitted',1,2,'configurator',now());
insert into public.design_project_versions(id,design_project_id,version_number,configuration_snapshot,pricing_input_snapshot,created_by)
values
('b1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000001',1,'{"schemaVersion":1,"kind":"configurator_build","configId":"regular-fit-tee-200gsm","savedAt":"2026-07-31T00:00:00.000Z","configuration":{"quantity":50}}','{"quantity":50}','11111111-1111-4111-8111-111111111111'),
('b1000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000001',2,'{"schemaVersion":1,"kind":"configurator_build","configId":"regular-fit-tee-200gsm","savedAt":"2026-07-31T01:00:00.000Z","configuration":{"quantity":50}}','{"quantity":50}','11111111-1111-4111-8111-111111111111');

insert into public.orders(
 id,order_number,order_type,organization_id,customer_user_id,design_project_id,design_version_id,
 status,public_status,subtotal_paise,estimated_total_paise,reservation_amount_paise,amount_paid_paise,
 pricing_version,configuration_schema_version,billing_snapshot,shipping_snapshot,customer_snapshot,company_snapshot,terms_snapshot,reservation_paid_at
) values (
 'b1000000-0000-4000-8000-000000000010','GAR-2026-001110','custom_bulk','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',
 'b1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','artwork_review','under_review',100000,100000,49900,49900,
 'phase11-test-v1',1,'{}','{}','{"name":"Asha Mehta","email":"asha@example.com"}','{"displayName":"Alpha Events"}','{"accepted":true,"version":"phase11-test"}',now()
);
insert into public.order_items(id,order_id,line_number,product_name,product_snapshot,size_breakdown,quantity,unit_price_paise,line_total_paise)
values ('b1000000-0000-4000-8000-000000000011','b1000000-0000-4000-8000-000000000010',1,'Regular Fit T-Shirt','{"pricingVersion":"phase11-test-v1"}','{"S":10,"M":20,"L":20}',50,2000,100000);
insert into public.payment_attempts(
 id,payment_number,order_id,provider_merchant_txn_id,attempt_number,purpose,amount_paise,status,
 expected_product_info,customer_email,customer_name,initiated_at,paid_at,last_verified_at
) values (
 'b1000000-0000-4000-8000-000000000014','PAY-GAR-2026-001110-01','b1000000-0000-4000-8000-000000000010','PHASE11TXN1110',1,'reservation',49900,'paid',
 'Order GAR-2026-001110 reservation','asha@example.com','Asha Mehta',now(),now(),now()
);
insert into public.order_files(
 id,order_id,uploaded_by,kind,visibility,bucket_name,object_key,original_filename,safe_filename,content_type,byte_size,sha256,scan_status,upload_status,finalized_at
) values (
 'b1000000-0000-4000-8000-000000000012','b1000000-0000-4000-8000-000000000010','44444444-4444-4444-8444-444444444444','approval_pdf','customer','garmops-private-orders',
 'orders/b100/approvals/final.pdf','approval-v1.pdf','approval-v1.pdf','application/pdf',2048,repeat('a',64),'clean','finalized',now()
),(
 'b1000000-0000-4000-8000-000000000013','b1000000-0000-4000-8000-000000000010','44444444-4444-4444-8444-444444444444','approval_pdf','customer','garmops-private-orders',
 'orders/b100/approvals/final-v2.pdf','approval-v2.pdf','approval-v2.pdf','application/pdf',2048,repeat('b',64),'clean','finalized',now()
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal2"}',true);
create temporary table phase11_approval_one as
select public.staff_create_approval_request(
 'b1000000-0000-4000-8000-000000000010','b1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000012',
 '11111111-1111-4111-8111-111111111111',null,null,now()+interval '7 days'
) as id;
select is((select snapshot_sha256 from public.approvals where id=(select id from phase11_approval_one)),repeat('a',64),'approval stores the real immutable PDF SHA-256');
reset role;
select is((select count(*) from public.notifications where type='approval_requested' and order_id='b1000000-0000-4000-8000-000000000010'),1::bigint,'company approver receives one notification');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.staff_transition_order('b1000000-0000-4000-8000-000000000010','awaiting_artwork_approval',null,null,null)$$,'active request allows awaiting-approval transition');

select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$select public.respond_order_approval((select id from phase11_approval_one),'approved','Approved by procurement')$$,'eligible company owner approves exact version');
select is((select status from public.approvals where id=(select id from phase11_approval_one)),'approved','approval decision is durable');

select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal2"}',true);
create temporary table phase11_approval_two as
select public.staff_create_approval_request(
 'b1000000-0000-4000-8000-000000000010','b1000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000013',
 '11111111-1111-4111-8111-111111111111',null,null,now()+interval '7 days'
) as id;
select is((select status from public.approvals where id=(select id from phase11_approval_one)),'revoked','new version revokes the previous approval evidence');
select ok((select artwork_approved_at is null from public.orders where id='b1000000-0000-4000-8000-000000000010'),'new version clears the old approval timestamp');
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$select public.respond_order_approval((select id from phase11_approval_two),'changes_requested','Move the logo 1 cm higher')$$,'later design version can request changes without mutating submitted order snapshot');
select is((select status::text from public.orders where id='b1000000-0000-4000-8000-000000000010'),'artwork_review','changes requested returns the order to artwork review');
select throws_ok($$select public.respond_order_approval((select id from phase11_approval_one),'approved',null)$$,'P0001','APPROVAL_NOT_ACTIVE','superseded approval cannot be reused');

select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal2"}',true);
create temporary table phase11_approval_three as
select public.staff_create_approval_request(
 'b1000000-0000-4000-8000-000000000010','b1000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000013',
 '11111111-1111-4111-8111-111111111111',null,null,now()+interval '7 days'
) as id;
select lives_ok($$select public.staff_transition_order('b1000000-0000-4000-8000-000000000010','awaiting_artwork_approval',null,null,null)$$,'replacement request returns the order to awaiting approval');
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$select public.respond_order_approval((select id from phase11_approval_three),'approved','Revised placement approved')$$,'replacement approval can approve the later exact version');
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.staff_transition_order('b1000000-0000-4000-8000-000000000010','approved_for_production',null,null,null)$$,'latest approved evidence permits production approval');
select throws_ok($$select public.staff_create_approval_request('b1000000-0000-4000-8000-000000000010','b1000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000013','11111111-1111-4111-8111-111111111111',null,null,now()+interval '7 days')$$,'P0001','APPROVAL_STAGE_CLOSED','replacement approvals cannot silently reopen production-approved orders');

-- A separate ready-to-dispatch order exercises multiple packages and state guards.
reset role;
insert into public.orders(id,order_number,order_type,organization_id,customer_user_id,design_project_id,design_version_id,status,public_status,subtotal_paise,estimated_total_paise,reservation_amount_paise,amount_paid_paise,pricing_version,configuration_schema_version,billing_snapshot,shipping_snapshot,customer_snapshot,company_snapshot,terms_snapshot,reservation_paid_at,artwork_approved_at)
values ('b1000000-0000-4000-8000-000000000020','GAR-2026-001120','custom_bulk','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','b1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000003','ready_to_dispatch','ready_to_dispatch',100000,100000,49900,49900,'phase11-test-v1',1,'{}','{}','{"name":"Asha Mehta"}','{"displayName":"Alpha Events"}','{"accepted":true}',now(),now());

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal2"}',true);
create temporary table phase11_shipment_one as select public.staff_create_shipment('b1000000-0000-4000-8000-000000000020','BlueDart','BD-111','https://example.com/BD-111',1,now()+interval '3 days','Shipment prepared') as id;
create temporary table phase11_shipment_two as select public.staff_create_shipment('b1000000-0000-4000-8000-000000000020','BlueDart','BD-112','https://example.com/BD-112',1,now()+interval '4 days','Second package prepared') as id;
select isnt((select shipment_number from public.shipments where id=(select id from phase11_shipment_one)),(select shipment_number from public.shipments where id=(select id from phase11_shipment_two)),'split shipments receive distinct durable numbers');
reset role;
select ok((select count(*) >= 2 from public.notifications where type='shipment_update' and order_id='b1000000-0000-4000-8000-000000000020'),'shipment creation queues customer notifications');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.staff_transition_order('b1000000-0000-4000-8000-000000000020','dispatched',null,null,null)$$,'23514','DISPATCHED_SHIPMENT_REQUIRED','order cannot dispatch before a shipment dispatch event');
select lives_ok($$select public.staff_update_shipment((select id from phase11_shipment_one),'dispatched','BlueDart','BD-111','https://example.com/BD-111',1,now()+interval '3 days','Package has left our facility','Noida','Handover verified')$$,'shipment can move from preparing to dispatched');
select lives_ok($$select public.staff_transition_order('b1000000-0000-4000-8000-000000000020','dispatched','Your first package has shipped.',null,null)$$,'dispatched shipment permits order dispatch');
select throws_ok($$select public.staff_update_shipment((select id from phase11_shipment_one),'preparing','BlueDart','BD-111','https://example.com/BD-111',1,null,null,null,null)$$,'P0001','INVALID_SHIPMENT_TRANSITION','shipment state cannot move backwards');
select lives_ok($$select public.staff_update_shipment((select id from phase11_shipment_one),'delivered','BlueDart','BD-111','https://example.com/BD-111',1,now(),'Delivered to reception','Delhi',null)$$,'shipment can be marked delivered');
select throws_ok($$select public.staff_transition_order('b1000000-0000-4000-8000-000000000020','delivered','Order delivered.',null,null)$$,'23514','ALL_SHIPMENTS_DELIVERED_REQUIRED','split order cannot complete while another package is active');
select lives_ok($$select public.staff_update_shipment((select id from phase11_shipment_two),'dispatched','BlueDart','BD-112','https://example.com/BD-112',1,now()+interval '2 days','Second package dispatched','Noida',null)$$,'second package can dispatch independently');
select lives_ok($$select public.staff_update_shipment((select id from phase11_shipment_two),'out_for_delivery','BlueDart','BD-112','https://example.com/BD-112',1,now()+interval '1 day','Second package is out for delivery','Delhi',null)$$,'shipment supports an out-for-delivery event');
select lives_ok($$select public.staff_update_shipment((select id from phase11_shipment_two),'delivered','BlueDart','BD-112','https://example.com/BD-112',1,now(),'Second package delivered','Delhi',null)$$,'second split package can complete');
select lives_ok($$select public.staff_transition_order('b1000000-0000-4000-8000-000000000020','delivered','Order delivered.',null,null)$$,'all delivered packages permit order completion');
select is((select count(*) from public.shipment_events where shipment_id=(select id from phase11_shipment_one)),3::bigint,'shipment timeline is append-only across preparation, dispatch, and delivery');

select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
select is((select count(*) from public.shipment_events),0::bigint,'customer cannot query staff-only shipment event rows directly');
select is((select count(*) from public.customer_shipment_events('b1000000-0000-4000-8000-000000000020')),7::bigint,'customer-safe RPC returns events for all split shipments');
select ok((select bool_and(customer_message is not null or status='preparing') from public.customer_shipment_events('b1000000-0000-4000-8000-000000000020')),'customer shipment projection contains only customer-safe event fields');

-- Reorder creates a fresh order while preserving the delivered source.
reset role;
insert into public.design_projects(id,organization_id,created_by,title,status,schema_version,current_version,source)
values ('b1000000-0000-4000-8000-000000000030','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Reorder draft','draft',1,1,'reorder');
insert into public.design_project_versions(id,design_project_id,version_number,configuration_snapshot,pricing_input_snapshot,created_by)
values ('b1000000-0000-4000-8000-000000000031','b1000000-0000-4000-8000-000000000030',1,'{"schemaVersion":1,"kind":"configurator_build","configId":"regular-fit-tee-200gsm","savedAt":"2026-07-31T02:00:00.000Z","configuration":{"quantity":50}}','{"quantity":50}','11111111-1111-4111-8111-111111111111');
set local role service_role;
create temporary table phase11_reorder as select * from public.submit_reorder_order(
 'b1000000-0000-4000-8000-000000000040',repeat('c',64),'b1000000-0000-4000-8000-000000000020','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',
 110000,0,0,49900,'phase11-current-v1',1,'{}','{}','{"name":"Asha Mehta","email":"asha@example.com"}','{"displayName":"Alpha Events"}','{"accepted":true,"version":"reservation-v1-2026-07-29"}',
 '[{"line_number":1,"product_id":"regular-fit-tee-200gsm","product_slug":"regular-fit-tee-200gsm","product_name":"Regular Fit T-Shirt","product_snapshot":{"pricingVersion":"phase11-current-v1"},"colour_snapshot":{"name":"Bright White"},"decoration_snapshot":{},"artwork_snapshot":{},"size_breakdown":{"S":10,"M":20,"L":20},"quantity":50,"unit_price_paise":2200,"line_total_paise":110000}]',
 'b1000000-0000-4000-8000-000000000030','b1000000-0000-4000-8000-000000000031','Reorder of GAR-2026-001120',null,current_date+30,now()+interval '24 hours'
);
select matches((select order_number from phase11_reorder),'^GAR-[0-9]{4}-[0-9]{6}$','reorder receives a fresh server order number');
select isnt((select order_id from phase11_reorder),'b1000000-0000-4000-8000-000000000020'::uuid,'reorder creates a new order record');
select is((select source_order_id from public.orders where id=(select order_id from phase11_reorder)),'b1000000-0000-4000-8000-000000000020'::uuid,'new order retains its immutable source relationship');
select is((select status::text from public.orders where id='b1000000-0000-4000-8000-000000000020'),'delivered','source order remains unchanged');
select throws_ok(format('update public.orders set source_order_id=%L where id=%L','b1000000-0000-4000-8000-000000000010',(select order_id from phase11_reorder)),'23514','SOURCE_ORDER_IMMUTABLE','reorder source link cannot be rewritten');

reset role;
select * from finish();
rollback;
