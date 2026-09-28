begin;
select plan(21);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'r0-one@example.test', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'r0-two@example.test', '', now(), '{}', '{}', now(), now());

insert into public.food_concepts(id, slug, display_name)
values ('10000000-0000-0000-0000-0000000000a1', 'huevos', 'Huevos');
insert into public.commercial_products(id, retailer, retailer_product_id, display_name, food_concept_id, source)
values ('20000000-0000-0000-0000-0000000000a1', 'TEST', 'eggs-12', 'Huevos camperos docena', '10000000-0000-0000-0000-0000000000a1', 'retailer_catalog');

insert into public.inventory_items(id,user_id,name,expiry_date,quantity,unit,added_at,food_concept_id,commercial_product_id)
values
  ('30000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a1','Huevos','2026-10-10',12,'unit',now(),'10000000-0000-0000-0000-0000000000a1','20000000-0000-0000-0000-0000000000a1'),
  ('30000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a2','Huevos','2026-10-10',6,'unit',now(),'10000000-0000-0000-0000-0000000000a1',null);

select is((select count(*) from public.inventory_items where id in ('30000000-0000-0000-0000-0000000000a1','30000000-0000-0000-0000-0000000000a2') and stock_mode='presence' and quantity_precision='unknown' and stock_state is null and freshness_precision='unknown' and expiry_date_exact is null), 2::bigint, 'legacy rows receive unknown v3 knowledge');
select is((select count(*) from public.food_concepts), 1::bigint, 'concept catalog exists');
select is((select count(*) from public.commercial_products), 1::bigint, 'commercial product remains separate from concept');

select throws_ok($$update public.inventory_items set stock_mode='exact', quantity_precision='unknown', quantity_exact=2, quantity_unit='unit' where id='30000000-0000-0000-0000-0000000000a1'$$, '23514', null, 'unknown precision cannot claim exact amount');
select throws_ok($$update public.inventory_items set stock_mode='exact', quantity_precision='exact', quantity_exact=2, quantity_unit='unit', stock_state='empty' where id='30000000-0000-0000-0000-0000000000a1'$$, '23514', null, 'positive exact amount cannot be empty');
select throws_ok($$update public.inventory_items set freshness_precision='estimated', freshness_estimated_days=7 where id='30000000-0000-0000-0000-0000000000a1'$$, '23514', null, 'estimate needs source');
select throws_ok($$update public.inventory_items set freshness_precision='estimated', freshness_source='catalog', freshness_estimated_days=7, expiry_date_exact='2026-10-10' where id='30000000-0000-0000-0000-0000000000a1'$$, '23514', null, 'estimate cannot claim exact date');
select throws_ok($$update public.inventory_items set freshness_precision='exact', freshness_source='receipt', expiry_date_exact='2026-10-10' where id='30000000-0000-0000-0000-0000000000a1'$$, '23514', null, 'exact date needs reliable source');
select throws_ok($$update public.inventory_items set freshness_precision='exact', freshness_source='package', expiry_date_exact='2026-02-30' where id='30000000-0000-0000-0000-0000000000a1'$$, '22008', null, 'exact expiry must be a civil date');
select lives_ok($$update public.inventory_items set stock_mode='exact', quantity_precision='exact', quantity_exact=6, quantity_unit='unit', freshness_precision='exact', freshness_source='package', expiry_date_exact='2026-10-10' where id='30000000-0000-0000-0000-0000000000a1'$$, 'valid exact knowledge can coexist with legacy columns');
select throws_ok($$update public.inventory_items set normalization_status='confirmed' where id='30000000-0000-0000-0000-0000000000a1'$$, '23514', null, 'confirmed normalization requires source');
select lives_ok($$update public.inventory_items set normalization_status='confirmed',normalization_source='user',knowledge_provenance='user' where id='30000000-0000-0000-0000-0000000000a1'$$, 'normalization can record explicit user evidence');
select is((select knowledge_provenance from public.inventory_items where id='30000000-0000-0000-0000-0000000000a2'), 'legacy', 'legacy provenance is preserved by default');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*) from public.inventory_items where id in ('30000000-0000-0000-0000-0000000000a1','30000000-0000-0000-0000-0000000000a2')), 1::bigint, 'inventory v3 columns remain owner isolated');
select is((select count(*) from public.food_concepts), 1::bigint, 'concept catalog is readable');
select is((select count(*) from public.commercial_products), 1::bigint, 'product catalog is readable');
with changed as (update public.inventory_items set stock_state='present' where id='30000000-0000-0000-0000-0000000000a2' returning 1)
select is(count(*), 0::bigint, 'cannot update another user v3 knowledge') from changed;
select throws_ok($$insert into public.food_concepts(slug,display_name) values('forbidden','Forbidden')$$, '42501', null, 'client cannot write public concept catalog');
select throws_ok($$insert into public.commercial_products(retailer,retailer_product_id,display_name,source) values('TEST','forbidden','Forbidden','retailer_catalog')$$, '42501', null, 'client cannot write commercial product catalog');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select is((select count(*) from public.inventory_items where id in ('30000000-0000-0000-0000-0000000000a1','30000000-0000-0000-0000-0000000000a2')), 1::bigint, 'second user sees only own inventory');
select is((select quantity_exact from public.inventory_items where id='30000000-0000-0000-0000-0000000000a1'), null::numeric, 'second user cannot read first user exact knowledge');

select * from finish();
rollback;
