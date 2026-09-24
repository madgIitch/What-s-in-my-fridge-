begin;
select plan(15);
select has_table('public','push_subscriptions','push subscriptions exists');
select has_table('public','push_deliveries','push delivery ledger exists');
select col_is_pk('public','push_subscriptions','id','subscription id is primary key');
select col_is_pk('public','push_deliveries','id','delivery id is primary key');
select has_index('public','push_subscriptions','push_subscriptions_endpoint_hash_key','endpoint hash is globally unique');
select has_index('public','push_deliveries','push_deliveries_subscription_id_event_key_key','event is idempotent per subscription');
select is((select relrowsecurity from pg_class where oid='public.push_subscriptions'::regclass),true,'subscriptions use RLS');
select is((select relrowsecurity from pg_class where oid='public.push_deliveries'::regclass),true,'deliveries use RLS');
insert into auth.users(id,email) values
  ('11000000-0000-4000-8000-000000000001','push-a@example.test'),
  ('11000000-0000-4000-8000-000000000002','push-b@example.test');
insert into public.recipe_import_jobs(id,user_id,idempotency_key,source_type,manual_text,provenance)
values('11000000-0000-4000-8000-000000000011','11000000-0000-4000-8000-000000000001','push-job-test-0001','manual','Sopa','{"sourceType":"manual"}');
set local role authenticated;
set local request.jwt.claim.sub='11000000-0000-4000-8000-000000000001';
select isnt(public.register_push_subscription(repeat('a',64),'https://push.example/device','abc_DEF','abc-123',null),null::uuid,'authenticated user can register a subscription');
reset role;
select is((select user_id from public.push_subscriptions where endpoint_hash=repeat('a',64)),'11000000-0000-4000-8000-000000000001'::uuid,'ownership comes from session');
update public.recipe_import_jobs set state='completed',result='{"schemaVersion":"recipe-v1","title":"Sopa","ingredients":[{"name":"Agua"}],"steps":["Hervir"],"source":{"type":"manual"},"provenance":{"sourceType":"manual"}}' where id='11000000-0000-4000-8000-000000000011';
select is((select completed_version from public.recipe_import_jobs where id='11000000-0000-4000-8000-000000000011'),1::bigint,'completion increments version');
select is((select count(*)::integer from public.push_deliveries where job_id='11000000-0000-4000-8000-000000000011'),1,'committed completion enqueues once');
update public.recipe_import_jobs set updated_at=now() where id='11000000-0000-4000-8000-000000000011';
select is((select count(*)::integer from public.push_deliveries where job_id='11000000-0000-4000-8000-000000000011'),1,'ordinary update does not duplicate completion');
set local role authenticated;
set local request.jwt.claim.sub='11000000-0000-4000-8000-000000000002';
select isnt(public.register_push_subscription(repeat('a',64),'https://push.example/device','abc_DEF','abc-123',null),null::uuid,'new account can reclaim its browser endpoint');
reset role;
select is((select status from public.push_deliveries where job_id='11000000-0000-4000-8000-000000000011'),'terminal','ownership change terminalizes old account delivery');
select * from finish();
rollback;
