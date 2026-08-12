create extension if not exists pgtap with schema extensions;
begin;
set local search_path = public, extensions;
select plan(73);

insert into public.orders(
  id,order_number,order_type,order_source,customer_user_id,status,public_status,
  subtotal_paise,discount_paise,taxable_value_paise,tax_paise,total_paise,
  amount_paid_paise,pricing_version,configuration_schema_version,
  billing_snapshot,shipping_snapshot,customer_snapshot,terms_snapshot,
  configuration_snapshot
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','GAR-2026-900001',
  'configurator_order','customer_checkout','11111111-1111-4111-8111-111111111111',
  'artwork_pending','artwork_under_review',500000,0,500000,25000,525000,
  525000,'test-v1',1,'{}','{}','{}','{}',
  jsonb_build_object(
    'design',jsonb_build_object(
      'configId','regular-tee',
      'configuration',jsonb_build_object(
        'quantity',50,
        'colour',jsonb_build_object('name','Black'),
        'artwork',jsonb_build_object('front',jsonb_build_object(
          'fileId','aaaaaaaa-0000-4000-8000-000000000001',
          'technique','screen_print'
        ))
      )
    ),
    'sizeQuantities',jsonb_build_object('M',50),
    'orderNotes',null
  )
),(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','GAR-2026-900002',
  'configurator_order','customer_checkout','44444444-4444-4444-8444-444444444444',
  'order_review','order_received',10000,0,10000,500,10500,10500,
  'test-v1',1,'{}','{}','{}','{}','{}'
);

insert into public.order_items(
  id,order_id,line_number,product_id,product_slug,product_name,
  product_snapshot,colour_snapshot,decoration_snapshot,artwork_snapshot,
  neck_label_snapshot,size_breakdown,quantity,unit_price_paise,line_total_paise
) values (
  'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'regular-tee','regular-tee',
  'Regular Tee','{}','{"name":"Black"}',
  '{"frontTechnique":"screen_print"}',
  '{"front":{"fileId":"aaaaaaaa-0000-4000-8000-000000000001","technique":"screen_print"}}',
  null,'{"M":50}',50,10000,500000
);

insert into public.order_files(
  id,order_id,uploaded_by,kind,visibility,object_key,original_filename,
  safe_filename,extension,content_type,byte_size,upload_status,
  upload_expires_at,finalized_at,scan_status,review_status
) values (
  'aaaaaaaa-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111','customer_artwork','customer',
  'private/test/v1.svg','front-v1.svg','front-v1.svg','svg','image/svg+xml',
  1000,'finalized',now()+interval '10 minutes',now(),'clean','pending_review'
);

insert into public.invoices(
  id,order_id,kind,status,subtotal_paise,discount_paise,taxable_value_paise,
  tax_paise,total_paise,paid_paise,line_items,seller_snapshot,buyer_snapshot
) values (
  'bbbbbbbb-0000-4000-8000-000000000001',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','tax_invoice','queued',10000,0,
  10000,500,10500,10500,'[]','{}','{}'
);

select is((select count(*) from public.order_artwork_requirements where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and is_active),1::bigint,'checkout artwork becomes one active requirement');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
select is((select count(*) from public.orders where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),0::bigint,'customer A cannot read customer B order');
select is((select count(*) from public.invoices where order_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),0::bigint,'customer A cannot read customer B invoice');
select is((select count(*) from public.profiles where id='44444444-4444-4444-8444-444444444444'),0::bigint,'customer A cannot read another profile');
select throws_ok(
  $$select * from public.create_private_upload_slot(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',null,
    'aaaaaaaa-0000-4000-8000-000000000001','customer_artwork','customer',
    'attack.svg','attack.svg','image/svg+xml',1000,'svg',null,
    now()+interval '8 minutes')$$,
  'P0001','UPLOAD_TARGET_DENIED','customer A cannot upload to customer B order'
);
select throws_ok(
  $$select public.ensure_customer_account('forged','forged')$$,
  'P0001','LEGAL_VERSION_INVALID','customer cannot forge legal versions through provisioning'
);
select throws_ok(
  $$update public.profiles set terms_version='forged',terms_accepted_at='2000-01-01' where id=auth.uid()$$,
  '42501','permission denied for table profiles','direct profile attack cannot rewrite legal audit fields'
);
select lives_ok(
  $$select public.update_my_profile('Asha','Mehta','+919810000001','Procurement Lead','Procurement','en-IN','Asia/Kolkata')$$,
  'controlled customer profile edit succeeds'
);
select is((select terms_version from public.profiles where id=auth.uid()),'2026-08-04','normal profile edit preserves protected terms evidence');
select lives_ok(
  $$select public.accept_legal_terms('2026-07-29','2026-07-29')$$,
  'current legal versions can be accepted through controlled RPC'
);
select is((select terms_version from public.profiles where id=auth.uid()),'2026-07-29','legal RPC records the server-approved version');

select set_config('request.jwt.claims','{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","aal":"aal2"}',true);
select lives_ok(
  $$select public.review_artwork_file('aaaaaaaa-0000-4000-8000-000000000001','rejected','Please upload corrected artwork')$$,
  'Operations can reject the active artwork revision'
);

select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
select lives_ok(
  $$select * from public.create_private_upload_slot(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,
    'aaaaaaaa-0000-4000-8000-000000000001','customer_artwork','customer',
    'front-v2.svg','front-v2.svg','image/svg+xml',1000,'svg',null,
    now()+interval '8 minutes')$$,
  'customer can replace artwork after staff rejection'
);

reset role;
set local role service_role;
update public.order_files
set upload_status='finalized',finalized_at=now(),scan_status='clean',
    review_status='pending_review'
where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  and replacement_for_file_id='aaaaaaaa-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","aal":"aal2"}',true);
select lives_ok(
  $$select public.review_artwork_file(
    (select file_id from public.order_artwork_requirements where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and is_active),
    'approved',null)$$,
  'Operations can approve the replacement revision'
);
select lives_ok(
  $$select public.staff_transition_order('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','artwork_approved',null,null,null)$$,
  'order advances to artwork approved'
);
select lives_ok(
  $$select public.staff_transition_order('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','production_approved',null,null,null)$$,
  'superseded rejected artwork does not block production approval'
);
select is((select count(*) from public.order_artwork_requirements where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and is_active),1::bigint,'exactly one artwork revision remains active');
select is((select count(*) from public.order_artwork_requirements r join public.order_files f on f.id=r.file_id where r.order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and not r.is_active and f.review_status='rejected'),1::bigint,'rejected V1 is preserved as superseded audit history');

select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
select throws_ok(
  $$select * from public.create_private_upload_slot(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,
    (select file_id from public.order_artwork_requirements where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and is_active),
    'customer_artwork','customer','late.svg','late.svg','image/svg+xml',1000,
    'svg',null,now()+interval '8 minutes')$$,
  'P0001','ARTWORK_UPLOAD_LOCKED','customer upload is blocked after production approval'
);

select ok(to_regprocedure('public.update_order_configuration(uuid,jsonb,text)') is null,'paid-order configuration mutation RPC is unavailable');
select ok(to_regprocedure('public.reopen_order_configuration(uuid,text)') is null,'Founder configuration reopen RPC is unavailable');

reset role;
update public.orders set status='artwork_pending',public_status='artwork_under_review'
where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
update public.order_files set review_status='pending_review'
where id=(select file_id from public.order_artwork_requirements where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and is_active);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","aal":"aal2"}',true);
select ok((select status::text from public.orders where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') = 'artwork_pending','configuration removal leaves operational status unchanged');

select lives_ok(
  $$select public.review_artwork_file(
    (select file_id from public.order_artwork_requirements where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and is_active),
    'rejected','Upload another corrected revision')$$,
  'active artwork can be reopened for customer replacement'
);
select set_config('test.current_file_id',(select file_id::text from public.order_artwork_requirements where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and is_active),true);
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
select lives_ok(
  $$select * from public.create_private_upload_slot(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,
    current_setting('test.current_file_id')::uuid,
    'customer_artwork','customer','front-v3.svg','front-v3.svg','image/svg+xml',
    1000,'svg',null,now()+interval '8 minutes')$$,
  'customer can create a new pending replacement slot'
);
select set_config('test.v3_file_id',(select file_id::text from public.customer_artwork_requirements('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')),true);
reset role;
update public.order_files set upload_expires_at=now()-interval '1 minute'
where id=current_setting('test.v3_file_id')::uuid;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
select lives_ok(
  $$select * from public.create_private_upload_slot(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,
    current_setting('test.v3_file_id')::uuid,
    'customer_artwork','customer','front-v4.svg','front-v4.svg','image/svg+xml',
    1000,'svg',null,now()+interval '8 minutes')$$,
  'lazy cleanup lets customer retry an expired replacement'
);
select is((select upload_status from public.order_files where id=current_setting('test.v3_file_id')::uuid),'expired','abandoned pending slot is marked expired');
select is((select count(*) from public.customer_artwork_requirements('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') where upload_status='pending'),1::bigint,'new pending revision is the sole active artwork');

reset role;
update public.orders set status='artwork_approved',public_status='approved_for_production'
where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","aal":"aal2"}',true);
select throws_ok(
  $$select public.staff_transition_order('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','production_approved',null,null,null)$$,
  'P0001','ARTWORK_APPROVAL_REQUIRED','production approval rejects a pending current artwork revision'
);
select is((select count(*) from public.order_artwork_requirements where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and is_active),1::bigint,'replacement retries never create two active revisions');

-- Human review never changes the independent malware state, and production
-- approval remains blocked until the scanner has returned clean.
reset role;
set local role service_role;
update public.order_files
set upload_status='finalized', finalized_at=now(), deleted_at=null,
    review_status='pending_review', scan_status='pending_scan'
where id=(select file_id from public.order_artwork_requirements where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and is_active);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","aal":"aal2"}',true);
select throws_ok(
  $$select public.review_artwork_file((select file_id from public.order_artwork_requirements where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and is_active),'approved',null)$$,
  'P0001','ARTWORK_SCAN_REQUIRED','staff approval cannot bypass a pending malware scan'
);
select is((select review_status::text from public.order_files where id=(select file_id from public.order_artwork_requirements where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and is_active)),'pending_review','pending malware approval leaves human review pending');
select is((select scan_status::text from public.order_files where id=(select file_id from public.order_artwork_requirements where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and is_active)),'pending_scan','pending malware state remains independent');

reset role;
set local role service_role;
update public.order_files
set upload_status='finalized', finalized_at=now(), deleted_at=null,
    review_status='pending_review', scan_status='infected'
where id=(select file_id from public.order_artwork_requirements where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and is_active);
set local role authenticated;
select throws_ok(
  $$select public.review_artwork_file((select file_id from public.order_artwork_requirements where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and is_active),'approved',null)$$,
  'P0001','ARTWORK_SCAN_REQUIRED','staff approval cannot bypass an infected malware scan'
);
select is((select review_status::text from public.order_files where id=(select file_id from public.order_artwork_requirements where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and is_active)),'pending_review','infected malware approval leaves human review pending');
select is((select scan_status::text from public.order_files where id=(select file_id from public.order_artwork_requirements where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and is_active)),'infected','infected malware state remains terminal');

reset role;
set local role service_role;
update public.orders set status='artwork_pending', public_status='artwork_under_review'
where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
update public.order_files
set upload_status='finalized', finalized_at=now(), deleted_at=null,
    review_status='pending_review', scan_status='not_required'
where id=(select file_id from public.order_artwork_requirements where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and is_active);
set local role authenticated;
select lives_ok(
  $$select public.review_artwork_file((select file_id from public.order_artwork_requirements where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and is_active),'approved',null)$$,
  'not-required artwork can be approved for human review'
);
select lives_ok(
  $$select public.staff_transition_order('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','artwork_approved',null,null,null)$$,
  'not-required artwork can pass artwork approval'
);
select lives_ok(
  $$select public.staff_transition_order('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','production_approved',null,null,null)$$,
  'not-required artwork can pass production approval'
);

reset role;
update public.orders set status='artwork_pending', public_status='artwork_under_review'
where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role service_role;
update public.order_files
set upload_status='finalized', finalized_at=now(), deleted_at=null,
    review_status='pending_review', scan_status='infected'
where id=(select file_id from public.order_artwork_requirements where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and is_active);
set local role authenticated;
select throws_ok(
  $$select public.staff_transition_order('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','artwork_approved',null,null,null)$$,
  'P0001','ARTWORK_APPROVAL_REQUIRED','unsafe artwork cannot pass artwork approval'
);
reset role;
update public.orders set status='artwork_approved', public_status='approved_for_production'
where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select throws_ok(
  $$select public.staff_transition_order('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','production_approved',null,null,null)$$,
  'P0001','ARTWORK_APPROVAL_REQUIRED','infected artwork cannot pass production approval'
);

reset role;
set local role service_role;
update public.order_files
set upload_status='finalized', finalized_at=now(), deleted_at=null,
    review_status='pending_review', scan_status='clean'
where id=(select file_id from public.order_artwork_requirements where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and is_active);
set local role authenticated;
select lives_ok(
  $$select public.review_artwork_file((select file_id from public.order_artwork_requirements where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and is_active),'approved',null)$$,
  'clean scanner result can be approved for human review'
);
select lives_ok(
  $$select public.staff_transition_order('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','production_approved',null,null,null)$$,
  'clean and approved artwork can pass production approval'
);
select is((select status::text from public.orders where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'production_approved','production approval succeeds only after clean scan');
reset role;
select is(public.is_order_transition_allowed('on_hold','quality_check'),false,'database transition graph exposes no generic on-hold resume');
select is(public.is_order_transition_allowed('on_hold','printing'),false,'database transition graph requires the persisted hold origin');
set local role authenticated;

select set_config('request.jwt.claims','{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","aal":"aal2"}',true);
select lives_ok(
  $$select public.staff_transition_order('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','on_hold',null,null,'Pause for operational review')$$,
  'normal hold transition records a resumable pause'
);
select is((select hold_from_status::text from public.orders where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'production_approved','normal hold records the prior stage');
select throws_ok(
  $$select public.staff_transition_order('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','quality_check',null,null,null)$$,
  'P0001','INVALID_HOLD_RESUME','on-hold orders cannot skip their saved prior stage'
);
select lives_ok(
  $$select public.staff_transition_order('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','production_approved',null,null,null)$$,
  'normal hold resumes only to its saved prior stage'
);
select lives_ok(
  $$select public.request_order_cancellation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Customer cancellation review')$$,
  'cancellation request immediately places the order on hold'
);
select is((select status::text from public.orders where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'on_hold','cancellation request changes operational status to on hold');
select is((select hold_from_status::text from public.orders where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'production_approved','hold stores the exact prior operational status');
select is((select requested_from_status::text from public.cancellation_requests where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and status='pending'),'production_approved','cancellation stores the exact requested-from status');
select throws_ok(
  $$select public.request_order_cancellation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Duplicate cancellation request')$$,
  'P0001','CANCELLATION_ALREADY_PENDING','only one cancellation request can be pending'
);
select throws_ok(
  $$select public.staff_transition_order('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','production_approved',null,null,null)$$,
  'P0001','CANCELLATION_PENDING','pending cancellation blocks manual resume'
);

select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal2"}',true);
select lives_ok(
  $$select public.decide_order_cancellation((select id from public.cancellation_requests where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and status='pending'),false,'Keep order in production')$$,
  'Founder rejection resumes the exact prior status'
);
select is((select status::text from public.orders where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'production_approved','rejected cancellation restores the saved status');
select is((select hold_from_status from public.orders where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') is null,true,'rejected cancellation clears the hold origin');
select is((select status from public.cancellation_requests where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' order by created_at desc limit 1),'rejected','cancellation decision is durably recorded');

select set_config('request.jwt.claims','{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","aal":"aal2"}',true);
select lives_ok(
  $$select public.request_order_cancellation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Final cancellation review')$$,
  'a new cancellation can be requested after rejection'
);
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal2"}',true);
select lives_ok(
  $$select public.decide_order_cancellation((select id from public.cancellation_requests where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and status='pending'),true,'Cancel and refund')$$,
  'Founder approval cancels the held order'
);
select is((select status::text from public.orders where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'cancelled','approved cancellation reaches cancelled');
select is((select status from public.cancellation_requests where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and status='approved' order by created_at desc limit 1),'approved','approved cancellation is durably recorded');

reset role;
update public.orders set status='production_approved', public_status='approved_for_production', hold_from_status=null
where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","aal":"aal2"}',true);
select lives_ok(
  $$select public.request_order_cancellation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Stale request test')$$,
  'test cancellation request can be created before a stale transition'
);
reset role;
update public.orders set status='printing', public_status='in_production', hold_from_status=null
where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal2"}',true);
select throws_ok(
  $$select public.decide_order_cancellation((select id from public.cancellation_requests where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and status='pending'),true,'Stale approval')$$,
  'P0001','STALE_CANCELLATION_REQUEST','stale cancellation decisions fail closed'
);
select is((select status::text from public.orders where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'printing','stale cancellation does not overwrite current order status');
select is((select status from public.cancellation_requests where order_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and status='pending' order by created_at desc limit 1),'pending','stale cancellation remains pending for explicit reconciliation');

select ok(has_table_privilege('authenticated','public.customer_privacy_preferences','SELECT'),'authenticated customers can read their privacy preference through RLS');
select ok(has_table_privilege('authenticated','public.privacy_requests','INSERT'),'authenticated customers can submit privacy requests through RLS');
select ok(to_regclass('public.production_capacity_rules') is null,'production capacity controls removed');
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal1"}',true);
select is((select count(*) from public.account_principals where user_id='11111111-1111-4111-8111-111111111111'),0::bigint,'Founder AAL1 cannot read customer principals');
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal2"}',true);
select is((select count(*) from public.account_principals where user_id='11111111-1111-4111-8111-111111111111'),1::bigint,'Founder AAL2 can read authorized principals');
select set_config('request.jwt.claims','{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","aal":"aal2"}',true);
select is((select count(*) from public.account_principals where user_id='44444444-4444-4444-8444-444444444444'),0::bigint,'Operations cannot read Founder-only principals');

select * from finish();
rollback;
