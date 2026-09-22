begin;
select plan(69);
select has_table('public','subscriptions','canonical subscription table');
select has_table('public','stripe_events','event ledger');
select has_table('public','usage_counters','usage aggregate');
select has_table('public','usage_ledger','usage idempotency ledger');
select has_pk('public','stripe_events','event IDs are unique');
select has_index('public','subscriptions','subscriptions_stripe_customer_id_key','customer IDs are unique');
select has_index('public','subscriptions','subscriptions_stripe_subscription_id_key','subscription IDs are unique');
select is((select relrowsecurity from pg_class where oid='public.subscriptions'::regclass),true,'subscription RLS enabled');
select is((select relrowsecurity from pg_class where oid='public.stripe_events'::regclass),true,'event RLS enabled');
select is((select relrowsecurity from pg_class where oid='public.usage_counters'::regclass),true,'counter RLS enabled');
select is((select relrowsecurity from pg_class where oid='public.usage_ledger'::regclass),true,'ledger RLS enabled');
select function_returns('public','consume_usage',array['text','text'],'jsonb','usage RPC returns JSON');
select function_returns('public','process_stripe_event',array['text','text','bigint','uuid','text','text','text','timestamp with time zone','boolean','jsonb'],'jsonb','webhook RPC returns JSON');
select is(has_function_privilege('authenticated','public.set_billing_override(uuid,boolean,text,text)','EXECUTE'),false,'users cannot invoke administrative override');
select is(has_function_privilege('authenticated','public.process_stripe_event(text,text,bigint,uuid,text,text,text,timestamptz,boolean,jsonb)','EXECUTE'),false,'users cannot forge Stripe events');
select is(has_function_privilege('authenticated','public.consume_usage(text,text)','EXECUTE'),true,'signed-in users can reserve usage');
select is(has_function_privilege('anon','public.consume_usage(text,text)','EXECUTE'),false,'anonymous users cannot reserve usage');

insert into auth.users(id,email) values
 ('a0000000-0000-4000-8000-000000000001','billing-a@example.test'),
 ('a0000000-0000-4000-8000-000000000002','billing-b@example.test');
select is(public.billing_entitlement('a0000000-0000-4000-8000-000000000001')->>'source','default','default entitlement');
select is(public.billing_entitlement('a0000000-0000-4000-8000-000000000001')->>'plan','free','default plan');

set local role authenticated;
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select is((public.consume_usage('receipt_ocr','ocr-1')->>'used')::integer,1,'first OCR consumes once');
select is((public.consume_usage('receipt_ocr','ocr-1')->>'duplicate')::boolean,true,'replay is marked duplicate');
select is((select used from public.usage_counters where feature='receipt_ocr'),1,'replay did not increment');
select is((select consumed from public.ocr_monthly_usage),1,'legacy OCR projection is mirrored');
select is((public.consume_usage('receipt_ocr','ocr-2')->>'allowed')::boolean,true,'second OCR allowed');
select is((public.consume_usage('receipt_ocr','ocr-3')->>'allowed')::boolean,true,'third OCR allowed');
select is((public.consume_usage('receipt_ocr','ocr-4')->>'allowed')::boolean,true,'fourth OCR allowed');
select is((public.consume_usage('receipt_ocr','ocr-5')->>'allowed')::boolean,true,'fifth OCR allowed');
select is((public.consume_usage('receipt_ocr','ocr-6')->>'code'),'QUOTA_EXCEEDED','sixth OCR denied');
select is((public.consume_usage('receipt_ocr','ocr-6')->>'code'),'QUOTA_EXCEEDED','denial replay is stable');
select is((select used from public.usage_counters where feature='receipt_ocr'),5,'denials never increment');
select is((select count(*) from public.stripe_events),0::bigint,'event ledger is private');

reset role;
select is((public.process_stripe_event('evt-1','customer.subscription.updated',100,'a0000000-0000-4000-8000-000000000001','cus-1','sub-1','active',null,false,'{"outcome":"applied"}'::jsonb)->>'outcome'),'applied','first event applies');
select is(public.billing_entitlement('a0000000-0000-4000-8000-000000000001')->>'plan','pro','active grants Pro');
select is((public.process_stripe_event('evt-0','customer.subscription.updated',99,'a0000000-0000-4000-8000-000000000001','cus-1','sub-1','canceled',null,false,'{"outcome":"stale"}'::jsonb)->>'outcome'),'stale','older event recorded');
select is(public.billing_entitlement('a0000000-0000-4000-8000-000000000001')->>'plan','pro','stale event cannot downgrade');
select is((public.process_stripe_event('evt_z','customer.subscription.updated',100,'a0000000-0000-4000-8000-000000000001','cus-1','sub-1','trialing',null,false,'{"outcome":"applied"}'::jsonb)->>'outcome'),'applied','higher event ID wins at equal timestamp');
select is(public.billing_entitlement('a0000000-0000-4000-8000-000000000001')->>'status','trialing','trialing status is canonical');
select is((public.process_stripe_event('evt_a','customer.subscription.updated',100,'a0000000-0000-4000-8000-000000000001','cus-1','sub-1','canceled',null,false,'{"outcome":"applied"}'::jsonb)->>'outcome'),'stale','lower event ID loses at equal timestamp');
select is((public.process_stripe_event('evt_z','customer.subscription.updated',100,'a0000000-0000-4000-8000-000000000001','cus-1','sub-1','canceled',null,false,'{"outcome":"different"}'::jsonb)->>'outcome'),'applied','event replay returns its first result');
select is((select version from public.subscriptions where user_id='a0000000-0000-4000-8000-000000000001'),2::bigint,'stale and replay events do not increment version');
select is((public.reconcile_subscription('a0000000-0000-4000-8000-000000000001','cus-1','sub-1','canceled',null,false,99,'reconcile:old')->>'applied')::boolean,false,'older reconcile snapshot cannot downgrade');
select is((public.reconcile_subscription('a0000000-0000-4000-8000-000000000001','cus-1','sub-1','trialing',null,false,200,'reconcile:same')->>'applied')::boolean,false,'unchanged reconciliation is idempotent');
select is((public.reconcile_subscription('a0000000-0000-4000-8000-000000000001','cus-1','sub-1','past_due',null,false,200,'!reconcile:changed')->>'applied')::boolean,true,'changed reconciliation applies');
select is(public.billing_entitlement('a0000000-0000-4000-8000-000000000001')->>'plan','free','past_due downgrades to Free');
select is((public.reconcile_subscription('a0000000-0000-4000-8000-000000000001','cus-1','sub-1','past_due',null,false,201,'!reconcile:again')->>'applied')::boolean,false,'repeat reconcile does not advance cursor');
select is((public.process_stripe_event('evt_after_reconcile','customer.subscription.updated',200,'a0000000-0000-4000-8000-000000000001','cus-1','sub-1','active',null,false,'{"outcome":"applied"}'::jsonb)->>'outcome'),'applied','real webhook wins a same-second synthetic reconcile cursor');
select is(public.billing_entitlement('a0000000-0000-4000-8000-000000000001')->>'plan','pro','new webhook restores Pro');
insert into auth.users(id,email) values
 ('b0000000-0000-4000-8000-000000000001','usage-a@example.test'),
 ('b0000000-0000-4000-8000-000000000002','usage-b@example.test');

set local role authenticated;
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000001';
select is((select bool_and((public.consume_usage('recipe_suggestions','suggest-'||n)->>'allowed')::boolean) from generate_series(1,5) n),true,'five suggestions allowed');
select is((public.consume_usage('recipe_suggestions','suggest-6')->>'allowed')::boolean,false,'sixth suggestion denied');
select is((select bool_and((public.consume_usage('recipe_import','import-'||n)->>'allowed')::boolean) from generate_series(1,10) n),true,'ten imports allowed');
select is((public.consume_usage('recipe_import','import-11')->>'allowed')::boolean,false,'eleventh import denied');
reset role;
select is((select count(*) from public.usage_ledger where feature='recipe_import'),11::bigint,'denial is persisted for replay');
set local role authenticated;
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000001';
select is((public.consume_usage('receipt_ocr','import-11')->>'allowed')::boolean,true,'idempotency key is scoped by feature');
select is((public.consume_usage('receipt_ocr','import-11')->>'period'),to_char(clock_timestamp() at time zone 'UTC','YYYY-MM'),'period comes from UTC database clock');
select is((select consumed from public.recipe_import_usage),10,'legacy import projection mirrors usage');
select is((select consumed from public.recipe_monthly_usage),5,'legacy suggestion projection mirrors usage');
select is((select count(*) from public.billing_override_audit),0::bigint,'authenticated cannot read override audit');
select is((select count(*) from public.stripe_events),0::bigint,'authenticated cannot read event ledger');

reset role;
select is((public.set_billing_override('b0000000-0000-4000-8000-000000000001',true,'support grant')->'after'->>'plan'),'pro','override grants Pro');
select is((select count(*) from public.billing_override_audit),1::bigint,'override is audited');
set local role authenticated;
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000001';
select is((public.consume_usage('recipe_import','pro-import')->>'allowed')::boolean,true,'Pro bypasses exhausted limit');
select is((select used from public.usage_counters where feature='recipe_import'),10,'Pro does not increment Free usage');
reset role;
select is((public.set_billing_override('b0000000-0000-4000-8000-000000000001',null,'support removal')->'after'->>'plan'),'free','removing override restores Free');
select is((select count(*) from public.billing_override_audit),2::bigint,'removal is audited');
set local role authenticated;
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000001';
select is((public.consume_usage('recipe_import','after-downgrade')->>'code'),'QUOTA_EXCEEDED','downgrade retains prior Free count');
select is((select used from public.usage_counters where feature='recipe_import'),10,'Pro operation is never retroactively charged');
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000002';
select is((select count(*) from public.usage_counters),0::bigint,'other user cannot read counters');
select is((select count(*) from public.subscriptions),0::bigint,'other user cannot read subscriptions');
select is((select count(*) from public.billing_overrides),0::bigint,'authenticated cannot read overrides');
select * from finish();
rollback;
