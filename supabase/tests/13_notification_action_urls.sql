create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;

select plan(5);

select lives_ok(
  $$insert into public.notifications(user_id,type,title,body,action_url)
    values('11111111-1111-4111-8111-111111111111','security_test','Safe','Safe internal action','/account/orders/GAR-2026-000001?tab=files#latest')$$,
  'notification action accepts a normal internal path'
);

select throws_like(
  $$insert into public.notifications(user_id,type,title,body,action_url)
    values('11111111-1111-4111-8111-111111111111','security_test','Unsafe','Protocol-relative action','//evil.example/phish')$$,
  '%notifications_action_url_check%',
  'notification action rejects protocol-relative URLs'
);

select throws_like(
  $$insert into public.notifications(user_id,type,title,body,action_url)
    values('11111111-1111-4111-8111-111111111111','security_test','Unsafe','Backslash action',E'/account\\evil.example')$$,
  '%notifications_action_url_check%',
  'notification action rejects backslashes'
);

select throws_like(
  $$insert into public.notifications(user_id,type,title,body,action_url)
    values('11111111-1111-4111-8111-111111111111','security_test','Unsafe','Control action',E'/account\n/orders')$$,
  '%notifications_action_url_check%',
  'notification action rejects control characters'
);

select lives_ok(
  $$insert into public.notifications(user_id,type,title,body,action_url)
    values('11111111-1111-4111-8111-111111111111','security_test','No action','No action needed',null)$$,
  'notification action remains nullable'
);

select * from finish();
rollback;
