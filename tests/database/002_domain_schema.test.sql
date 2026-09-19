begin;

create extension if not exists pgtap with schema extensions;
select plan(31);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'domain-one@example.test', '', now(), now(), now()),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'domain-two@example.test', '', now(), now(), now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok($$insert into public.inventory_items (user_id, name, expiry_date, quantity, unit, added_at) values ('10000000-0000-0000-0000-000000000001', 'Milk', current_date, 1, 'l', now())$$, 'owner inserts inventory');
select lives_ok($$insert into public.receipt_drafts (user_id, raw_text, captured_at) values ('10000000-0000-0000-0000-000000000001', 'Milk 1.00', now())$$, 'owner inserts receipt draft');
select lives_ok($$insert into public.favorite_recipes (user_id, recipe_id, name, match_percentage, instructions, saved_at) values ('10000000-0000-0000-0000-000000000001', 'recipe-1', 'Soup', 90, 'Cook', now())$$, 'owner inserts favorite');
select lives_ok($$insert into public.meal_entries (user_id, meal_type, meal_date, custom_name, consumed_at) values ('10000000-0000-0000-0000-000000000001', 'lunch', current_date, 'Soup', now())$$, 'owner inserts meal');
select lives_ok($$insert into public.ingredient_mappings (user_id, scanned_name, normalized_name, confidence, method, verified_by_user) values ('10000000-0000-0000-0000-000000000001', 'Tomate', 'tomato', 1, 'user', true)$$, 'owner inserts verified mapping');

select throws_ok($$insert into public.inventory_items (user_id, name, expiry_date, quantity, unit, added_at) values ('10000000-0000-0000-0000-000000000002', 'Milk', current_date, 1, 'l', now())$$, '42501', null, 'cannot insert inventory for another user');
select throws_ok($$insert into public.receipt_drafts (user_id, raw_text, captured_at) values ('10000000-0000-0000-0000-000000000002', 'Milk', now())$$, '42501', null, 'cannot insert draft for another user');
select throws_ok($$insert into public.favorite_recipes (user_id, recipe_id, name, match_percentage, instructions, saved_at) values ('10000000-0000-0000-0000-000000000002', 'recipe-2', 'Pie', 80, 'Bake', now())$$, '42501', null, 'cannot insert favorite for another user');
select throws_ok($$insert into public.meal_entries (user_id, meal_type, meal_date, custom_name, consumed_at) values ('10000000-0000-0000-0000-000000000002', 'dinner', current_date, 'Pie', now())$$, '42501', null, 'cannot insert meal for another user');
select throws_ok($$insert into public.ingredient_mappings (user_id, scanned_name, normalized_name, confidence, method, verified_by_user) values ('10000000-0000-0000-0000-000000000002', 'Sal', 'salt', 1, 'user', true)$$, '42501', null, 'cannot insert mapping for another user');

reset role;
insert into public.inventory_items (user_id, name, expiry_date, quantity, unit, added_at) values ('10000000-0000-0000-0000-000000000002', 'Eggs', current_date, 6, 'unit', now());
insert into public.receipt_drafts (user_id, raw_text, captured_at) values ('10000000-0000-0000-0000-000000000002', 'Eggs', now());
insert into public.favorite_recipes (user_id, recipe_id, name, match_percentage, instructions, saved_at) values ('10000000-0000-0000-0000-000000000002', 'recipe-2', 'Pie', 80, 'Bake', now());
insert into public.meal_entries (user_id, meal_type, meal_date, custom_name, consumed_at) values ('10000000-0000-0000-0000-000000000002', 'dinner', current_date, 'Pie', now());
insert into public.ingredient_mappings (user_id, scanned_name, normalized_name, confidence, method, verified_by_user) values ('10000000-0000-0000-0000-000000000002', 'Sal', 'salt', 1, 'user', true);
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*) from public.inventory_items), 1::bigint, 'inventory select isolated');
select is((select count(*) from public.receipt_drafts), 1::bigint, 'draft select isolated');
select is((select count(*) from public.favorite_recipes), 1::bigint, 'favorite select isolated');
select is((select count(*) from public.meal_entries), 1::bigint, 'meal select isolated');
select is((select count(*) from public.ingredient_mappings), 1::bigint, 'mapping select isolated');

with changed as (update public.inventory_items set notes = 'hidden' where user_id = '10000000-0000-0000-0000-000000000002' returning 1) select is(count(*), 0::bigint, 'inventory update isolated') from changed;
with changed as (update public.receipt_drafts set merchant = 'hidden' where user_id = '10000000-0000-0000-0000-000000000002' returning 1) select is(count(*), 0::bigint, 'draft update isolated') from changed;
with changed as (update public.favorite_recipes set name = 'hidden' where user_id = '10000000-0000-0000-0000-000000000002' returning 1) select is(count(*), 0::bigint, 'favorite update isolated') from changed;
with changed as (update public.meal_entries set notes = 'hidden' where user_id = '10000000-0000-0000-0000-000000000002' returning 1) select is(count(*), 0::bigint, 'meal update isolated') from changed;
with changed as (update public.ingredient_mappings set confidence = .5 where user_id = '10000000-0000-0000-0000-000000000002' returning 1) select is(count(*), 0::bigint, 'mapping update isolated') from changed;

with removed as (delete from public.inventory_items where user_id = '10000000-0000-0000-0000-000000000002' returning 1) select is(count(*), 0::bigint, 'inventory delete isolated') from removed;
with removed as (delete from public.receipt_drafts where user_id = '10000000-0000-0000-0000-000000000002' returning 1) select is(count(*), 0::bigint, 'draft delete isolated') from removed;
with removed as (delete from public.favorite_recipes where user_id = '10000000-0000-0000-0000-000000000002' returning 1) select is(count(*), 0::bigint, 'favorite delete isolated') from removed;
with removed as (delete from public.meal_entries where user_id = '10000000-0000-0000-0000-000000000002' returning 1) select is(count(*), 0::bigint, 'meal delete isolated') from removed;
with removed as (delete from public.ingredient_mappings where user_id = '10000000-0000-0000-0000-000000000002' returning 1) select is(count(*), 0::bigint, 'mapping delete isolated') from removed;

select throws_ok($$insert into public.meal_entries (user_id, meal_type, meal_date, consumed_at) values ('10000000-0000-0000-0000-000000000001', 'lunch', current_date, now())$$, '23514', null, 'meal requires recipe or custom name');
select throws_ok($$insert into public.ingredient_mappings (user_id, scanned_name, normalized_name, confidence, method) values ('10000000-0000-0000-0000-000000000001', 'Milk', 'milk', .5, 'fuzzy')$$, '23514', null, 'unverified noncanonical mapping rejected');
select throws_ok($$insert into public.inventory_items (user_id, source, legacy_id, name, expiry_date, quantity, unit, added_at) values ('10000000-0000-0000-0000-000000000001', 'FIREBASE', 'items/1', 'A', current_date, 1, 'unit', now()), ('10000000-0000-0000-0000-000000000001', 'FIREBASE', 'items/1', 'B', current_date, 1, 'unit', now())$$, '23505', null, 'legacy identity is unique');
select hasnt_table('public', 'recipe_cache', 'recipe cache is not authoritative');
select is((select count(*) from public.ingredients where seed_version = 'catalog-v1'), 5::bigint, 'seed cardinality is stable');
select is((select md5(string_agg(slug || ':' || name || ':' || category || ':' || synonyms::text, '|' order by slug)) from public.ingredients where seed_version = 'catalog-v1'), '17c09ec4416555986ff0537703576daa', 'seed checksum is stable');

select * from finish();
rollback;
