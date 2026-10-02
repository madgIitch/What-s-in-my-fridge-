begin;
create extension if not exists pgtap with schema extensions;
-- Isolate the active-catalog fixture inside this rollback-only transaction.
update public.catalog_versions set active = false where active;
select plan(5);

insert into auth.users(id,email) values ('a4000000-0000-4000-a000-000000000001','r2-state-key@example.test');
insert into public.food_concepts(id,slug,display_name) values ('a5000000-0000-4000-a000-000000000001','r2-state-key-food','State key food');
insert into public.catalog_versions(id,checksum,source_version,matcher_version,active,recipe_count,ingredient_count)
values ('a6000000-0000-4000-a000-000000000001',encode(extensions.digest('r2-state-key-test','sha256'),'hex'),'r2-state-key','matcher-r2',true,10000,80000);
insert into public.recipes(catalog_version_id,external_id,name,instructions)
select 'a6000000-0000-4000-a000-000000000001', 'key-' || v, 'Recipe ' || v, repeat('Cook slowly and stir. ',60) from generate_series(1,10000) v;
insert into public.recipe_ingredients(recipe_id,position,name,normalized_name,measure)
select r.id,p,'Ingredient '||p,'ingredient '||p,'100 g'
from public.recipes r cross join generate_series(0,7) p where r.catalog_version_id='a6000000-0000-4000-a000-000000000001';

create temp table key_log(label text primary key, cache_key text, elapsed_ms numeric);
grant all on key_log to authenticated;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-a000-000000000001","role":"authenticated"}',true);
insert into key_log select 'initial', r->>'cacheKey', null
  from (select public.read_today_cache_v1('2026-10-02','matcher-r2','today-ranking-v3') r) s;
insert into key_log select 'repeat', r->>'cacheKey', extract(epoch from (clock_timestamp()-started))*1000
  from (select clock_timestamp() started) c, lateral (select public.read_today_cache_v1('2026-10-02','matcher-r2','today-ranking-v3') r) s;
reset role;

update public.recipe_ingredients set food_concept_id='a5000000-0000-4000-a000-000000000001'
where recipe_id=(select id from public.recipes where external_id='key-1') and position=0;

set local role authenticated;
insert into key_log select 'after_catalog_edit', r->>'cacheKey', null
  from (select public.read_today_cache_v1('2026-10-02','matcher-r2','today-ranking-v3') r) s;
reset role;

select diag(format('R2 state key read on 10000 recipes/80000 ingredients: elapsed_ms=%s (local Docker only)', (select round(elapsed_ms,2) from key_log where label='repeat')));
select ok((select cache_key from key_log where label='initial') ~ '^[a-f0-9]{64}$', 'state key is a sha256 digest');
select is((select cache_key from key_log where label='repeat'), (select cache_key from key_log where label='initial'), 'state key is stable without changes');
select isnt((select cache_key from key_log where label='after_catalog_edit'), (select cache_key from key_log where label='initial'), 'a catalog edit invalidates the state key');
select ok((select elapsed_ms from key_log where label='repeat') < 500, 'state key cost does not scale with catalog size');
select is((select count(*) from information_schema.role_table_grants where table_name='today_catalog_revision' and grantee in ('anon','authenticated')), 0::bigint, 'catalog revision is not exposed to clients');

select * from finish();
rollback;
