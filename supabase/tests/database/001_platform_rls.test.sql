begin;
select plan(24);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'one@example.test', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'two@example.test', '', now(), '{}', '{}', now(), now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok($$update public.profiles set display_name = 'One' where user_id = '00000000-0000-0000-0000-000000000001'$$, 'user can update own generated profile');
select throws_ok($$insert into public.profiles(user_id, display_name) values ('00000000-0000-0000-0000-000000000002', 'Forbidden') on conflict (user_id) do update set display_name = excluded.display_name$$, '42501', null, 'user cannot upsert another profile');
select lives_ok($$insert into public.legacy_id_map(user_id, entity_type, legacy_id, target_id) values ('00000000-0000-0000-0000-000000000001', 'inventory', 'legacy-one', '10000000-0000-0000-0000-000000000001')$$, 'user can insert own legacy mapping');
select throws_ok($$insert into public.legacy_id_map(user_id, entity_type, legacy_id, target_id) values ('00000000-0000-0000-0000-000000000002', 'inventory', 'forbidden', '10000000-0000-0000-0000-000000000002')$$, '42501', null, 'user cannot insert another legacy mapping');
select lives_ok($$insert into public.migration_runs(created_by, source_commit) values ('00000000-0000-0000-0000-000000000001', '6a50475006c692538e6e51d30a7063f956ad054c')$$, 'user can insert own migration run');
select throws_ok($$insert into public.migration_runs(created_by, source_commit) values ('00000000-0000-0000-0000-000000000002', '6a50475006c692538e6e51d30a7063f956ad054c')$$, '42501', null, 'user cannot insert another migration run');
select lives_ok($$insert into storage.objects(bucket_id, name, owner_id, metadata) values ('receipts-temp', '00000000-0000-0000-0000-000000000001/ticket.jpg', '00000000-0000-0000-0000-000000000001', '{"mimetype":"image/jpeg"}')$$, 'user can create object in own folder');
select throws_ok($$insert into storage.objects(bucket_id, name, owner_id, metadata) values ('receipts-temp', '00000000-0000-0000-0000-000000000002/forbidden.jpg', '00000000-0000-0000-0000-000000000001', '{"mimetype":"image/jpeg"}')$$, '42501', null, 'user cannot create object in another folder');

reset role;
update public.profiles set display_name = 'Two' where user_id = '00000000-0000-0000-0000-000000000002';
insert into public.legacy_id_map(user_id, entity_type, legacy_id, target_id) values ('00000000-0000-0000-0000-000000000002', 'inventory', 'legacy-two', '10000000-0000-0000-0000-000000000002');
insert into public.migration_runs(created_by, source_commit) values ('00000000-0000-0000-0000-000000000002', '6a50475006c692538e6e51d30a7063f956ad054c');
insert into storage.objects(bucket_id, name, owner_id, metadata) values ('receipts-temp', '00000000-0000-0000-0000-000000000002/ticket.jpg', '00000000-0000-0000-0000-000000000002', '{"mimetype":"image/jpeg"}');
set local role authenticated;

select is((select count(*) from public.profiles), 1::bigint, 'profile select only sees own row');
with changed as (update public.profiles set display_name = 'Hacked' where user_id = '00000000-0000-0000-0000-000000000002' returning 1) select is(count(*), 0::bigint, 'profile update cannot touch another row') from changed;
with removed as (delete from public.profiles where user_id = '00000000-0000-0000-0000-000000000002' returning 1) select is(count(*), 0::bigint, 'profile delete cannot touch another row') from removed;
select is((select count(*) from public.legacy_id_map), 1::bigint, 'legacy map select only sees own row');
with changed as (update public.legacy_id_map set target_id = '20000000-0000-0000-0000-000000000002' where user_id = '00000000-0000-0000-0000-000000000002' returning 1) select is(count(*), 0::bigint, 'legacy map update cannot touch another row') from changed;
with removed as (delete from public.legacy_id_map where user_id = '00000000-0000-0000-0000-000000000002' returning 1) select is(count(*), 0::bigint, 'legacy map delete cannot touch another row') from removed;
select is((select count(*) from public.migration_runs), 1::bigint, 'migration run select only sees own row');
with changed as (update public.migration_runs set status = 'failed', finished_at = now() where created_by = '00000000-0000-0000-0000-000000000002' returning 1) select is(count(*), 0::bigint, 'migration run update cannot touch another row') from changed;
with removed as (delete from public.migration_runs where created_by = '00000000-0000-0000-0000-000000000002' returning 1) select is(count(*), 0::bigint, 'migration run delete cannot touch another row') from removed;
select is((select count(*) from storage.objects where bucket_id = 'receipts-temp'), 1::bigint, 'storage listing only exposes own path');
with changed as (update storage.objects set metadata = '{"hacked":true}' where name = '00000000-0000-0000-0000-000000000002/ticket.jpg' returning 1) select is(count(*), 0::bigint, 'storage update cannot overwrite another path') from changed;
select throws_ok($$delete from storage.objects where name = '00000000-0000-0000-0000-000000000002/ticket.jpg'$$, null, null, 'Storage rejects direct SQL deletion; objects must use the Storage API');
select lives_ok($$update public.profiles set display_name = 'Updated' where user_id = '00000000-0000-0000-0000-000000000001'$$, 'user can update own profile');
select lives_ok($$delete from public.legacy_id_map where user_id = '00000000-0000-0000-0000-000000000001'$$, 'user can delete own mapping');
select is((select count(*) from public.legacy_id_map), 0::bigint, 'own mapping was deleted');

reset role;
select is((select count(*) from storage.buckets where id in ('receipts-temp','user-assets') and public = false), 2::bigint, 'both buckets are private');

select * from finish();
rollback;
