begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'auth-one@example.test', '', now(), '{"display_name":"Neverita"}', now(), now()),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'auth-two@example.test', '', now(), '{}', now(), now());

select is((select count(*) from public.profiles where user_id in ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002')), 2::bigint, 'auth trigger creates profiles');
select is((select display_name from public.profiles where user_id = '30000000-0000-0000-0000-000000000001'), 'Neverita', 'profile preserves display name metadata');

set local role service_role;
select lives_ok($$select public.link_firebase_auth_identity('30000000-0000-0000-0000-000000000001', 'firebase-user-one')$$, 'service role links Firebase UID');
select lives_ok($$select public.link_firebase_auth_identity('30000000-0000-0000-0000-000000000001', 'firebase-user-one')$$, 'same mapping is idempotent');
select is((select count(*) from public.legacy_id_map where entity_type = 'auth_user' and legacy_id = 'firebase-user-one'), 1::bigint, 'rerun does not duplicate mapping');
select throws_ok($$select public.link_firebase_auth_identity('30000000-0000-0000-0000-000000000002', 'firebase-user-one')$$, '23505', 'firebase_uid_already_linked', 'UID cannot move to a different account');
select throws_ok($$select public.link_firebase_auth_identity('30000000-0000-0000-0000-000000000002', '')$$, '22023', 'firebase_uid_required', 'empty UID rejected');

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is((select count(*) from public.profiles), 1::bigint, 'profiles remain isolated after import');

select * from finish();
rollback;
