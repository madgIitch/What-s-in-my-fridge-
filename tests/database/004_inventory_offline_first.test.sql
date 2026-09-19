begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inventory-one@example.test', '', now(), now(), now()),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inventory-two@example.test', '', now(), now(), now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (public.apply_inventory_mutation('41000000-0000-0000-0000-000000000001','create','42000000-0000-0000-0000-000000000001',null,
    '{"name":"Leche","expiry_date":"2026-09-21","quantity":1,"unit":"litro","added_at":"2026-09-19T10:00:00Z"}'))->>'status',
  'applied', 'create is applied');
select is((select id::text from public.inventory_items where id='42000000-0000-0000-0000-000000000001'), '42000000-0000-0000-0000-000000000001', 'client item UUID is preserved');
select is((select expiry_date::text from public.inventory_items where id='42000000-0000-0000-0000-000000000001'), '2026-09-21', 'expiry is a civil date');
select is(
  (public.apply_inventory_mutation('41000000-0000-0000-0000-000000000001','create','42000000-0000-0000-0000-000000000009',null,'{}'))->>'status',
  'duplicate', 'same mutation is deduplicated regardless of a colliding payload');
select is((select count(*) from public.inventory_items where user_id='40000000-0000-0000-0000-000000000001'), 1::bigint, 'duplicate creates no second row');
select is((select count(*) from public.client_mutations where client_mutation_id='41000000-0000-0000-0000-000000000001'), 1::bigint, 'deduplication record is unique');

select is(
  (public.apply_inventory_mutation('41000000-0000-0000-0000-000000000002','update','42000000-0000-0000-0000-000000000001',1,'{"name":"Leche entera"}'))->>'code',
  'OK', 'matching update succeeds');
select is((select version from public.inventory_items where id='42000000-0000-0000-0000-000000000001'), 2::bigint, 'update increments version exactly once');
select ok((select updated_at > created_at from public.inventory_items where id='42000000-0000-0000-0000-000000000001'), 'update advances UTC technical timestamp');
select is(
  (public.apply_inventory_mutation('41000000-0000-0000-0000-000000000003','update','42000000-0000-0000-0000-000000000001',1,'{"name":"Stale"}'))->>'code',
  'SYNC_CONFLICT', 'stale update returns stable conflict code');
select is((select name from public.inventory_items where id='42000000-0000-0000-0000-000000000001'), 'Leche entera', 'conflict does not alter row');
select is(
  (public.apply_inventory_mutation('41000000-0000-0000-0000-000000000004','delete','42000000-0000-0000-0000-000000000001',2,'{}'))->>'code',
  'OK', 'matching delete succeeds');
select ok((select deleted_at is not null from public.inventory_items where id='42000000-0000-0000-0000-000000000001'), 'delete leaves tombstone');

reset role;
insert into public.inventory_items (id,user_id,name,expiry_date,quantity,unit,added_at)
values ('42000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','Ajeno','2026-09-22',1,'unidad',now());
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*) from public.inventory_items where id='42000000-0000-0000-0000-000000000002'), 0::bigint, 'cannot read another user inventory');
select throws_ok($$insert into public.inventory_items(id,user_id,name,expiry_date,quantity,unit,added_at) values ('42000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000002','No','2026-09-22',1,'u',now())$$, '42501', null, 'cannot insert another user inventory');
with changed as (update public.inventory_items set name='No' where id='42000000-0000-0000-0000-000000000002' returning 1) select is(count(*),0::bigint,'cannot update another user inventory') from changed;
with removed as (delete from public.inventory_items where id='42000000-0000-0000-0000-000000000002' returning 1) select is(count(*),0::bigint,'cannot delete another user inventory') from removed;
select throws_ok($$insert into public.client_mutations(user_id,client_mutation_id,operation,item_id,status,code) values ('40000000-0000-0000-0000-000000000002','41000000-0000-0000-0000-000000000009','delete','42000000-0000-0000-0000-000000000002','applied','OK')$$, '42501', null, 'cannot insert another user mutation');

select * from finish();
rollback;
