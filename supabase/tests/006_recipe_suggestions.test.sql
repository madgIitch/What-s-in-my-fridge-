begin;
select plan(17);
insert into auth.users(id,email) values('60000000-0000-0000-0000-000000000001','recipes-a@example.test'),('60000000-0000-0000-0000-000000000002','recipes-b@example.test');
insert into public.catalog_versions(id,checksum,source_version,matcher_version,active,recipe_count,ingredient_count)
values('61000000-0000-4000-a000-000000000001',repeat('a',64),'fixture','matcher-v1',true,0,0);
insert into public.ingredient_mappings(user_id,scanned_name,normalized_name,confidence,method,verified_by_user)
values('60000000-0000-0000-0000-000000000001','aubergine','eggplant',1,'user',true),('60000000-0000-0000-0000-000000000002','courgette','zucchini',1,'user',true);
insert into public.user_entitlements(user_id,plan,status) values('60000000-0000-0000-0000-000000000002','pro','active');

set local role authenticated;
set local request.jwt.claim.sub='60000000-0000-0000-0000-000000000001';
select is((public.begin_recipe_suggestion(repeat('1',64),repeat('b',64))->>'action'),'process','first key is a new operation');
select is((public.begin_recipe_suggestion(repeat('1',64),repeat('b',64))->>'code'),'SUGGESTION_IN_PROGRESS','a competing key does not consume twice');
select is((select consumed from public.recipe_monthly_usage where user_id='60000000-0000-0000-0000-000000000001'),1,'competition consumes one unit');
select lives_ok($$select public.complete_recipe_suggestion(repeat('1',64),'[]'::jsonb)$$,'owner completes cache');
select is((public.begin_recipe_suggestion(repeat('1',64),repeat('b',64))->>'action'),'hit','ready cache is a hit');
select is((select consumed from public.recipe_monthly_usage where user_id='60000000-0000-0000-0000-000000000001'),1,'cache hit is free');
select is((select count(*) from public.ingredient_mappings),1::bigint,'user sees only own mapping');

select is((public.begin_recipe_suggestion(repeat('2',64),repeat('c',64))->>'action'),'process','second new operation');
select is((public.begin_recipe_suggestion(repeat('3',64),repeat('d',64))->>'action'),'process','third new operation');
select is((public.begin_recipe_suggestion(repeat('4',64),repeat('e',64))->>'action'),'process','fourth new operation');
select is((public.begin_recipe_suggestion(repeat('5',64),repeat('f',64))->>'action'),'process','fifth new operation');
select is((public.begin_recipe_suggestion(repeat('6',64),repeat('7',64))->>'code'),'SUGGESTION_QUOTA_EXHAUSTED','sixth free operation is rejected');

set local request.jwt.claim.sub='60000000-0000-0000-0000-000000000002';
select is((select count(*) from public.recipe_suggestion_cache),0::bigint,'other user cannot read cache');
select is((select count(*) from public.recipe_monthly_usage),0::bigint,'other user cannot read usage');
select throws_ok($$insert into public.user_entitlements(user_id,plan,status) values('60000000-0000-0000-0000-000000000002','free','active') on conflict(user_id) do update set plan='free'$$,'42501',null,'request cannot manipulate its plan');
select is((public.begin_recipe_suggestion(repeat('8',64),repeat('9',64))->>'action'),'process','active pro can run a new operation');
select is((select count(*) from public.recipe_monthly_usage),0::bigint,'active pro does not consume free usage');
select * from finish();
rollback;
