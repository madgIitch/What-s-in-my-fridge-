begin;
-- Isolate the active-catalog fixture inside this rollback-only transaction.
update public.catalog_versions set active = false where active;
select plan(3);

insert into auth.users(id,email) values ('a1000000-0000-4000-a000-000000000001','r2-benchmark@example.test');
insert into public.food_concepts(id,slug,display_name) values ('a2000000-0000-4000-a000-000000000001','r2-benchmark-food','Benchmark food');
insert into public.catalog_versions(id,checksum,source_version,matcher_version,active,recipe_count,ingredient_count)
values ('a3000000-0000-4000-a000-000000000001',repeat('b',64),'r2-benchmark-10000','matcher-r2',true,10002,10001);
insert into public.recipes(catalog_version_id,external_id,name,instructions)
select 'a3000000-0000-4000-a000-000000000001', 'bench-' || lpad(value::text,5,'0'), 'Recipe ' || value, 'Cook'
from generate_series(1,10000) value;
insert into public.recipes(catalog_version_id,external_id,name,instructions) values
  ('a3000000-0000-4000-a000-000000000001','ineligible-empty','Empty instructions',''),
  ('a3000000-0000-4000-a000-000000000001','ineligible-no-ingredients','No ingredients','Cook');
insert into public.recipe_ingredients(recipe_id,position,name,normalized_name,measure,food_concept_id)
select id,0,'Benchmark food','benchmark food','1 unit','a2000000-0000-4000-a000-000000000001'
from public.recipes where catalog_version_id='a3000000-0000-4000-a000-000000000001' and external_id <> 'ineligible-no-ingredients';
insert into public.inventory_items(user_id,name,expiry_date,quantity,unit,added_at,food_concept_id,normalization_status,normalization_source,knowledge_provenance,stock_mode,stock_state,quantity_precision,quantity_exact,quantity_unit)
values ('a1000000-0000-4000-a000-000000000001','Benchmark food','2026-10-10',1,'unit',now(),'a2000000-0000-4000-a000-000000000001','confirmed','user','user','exact','some','exact',1,'unit');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-a000-000000000001","role":"authenticated"}',true);
create temp table benchmark_clock(started_at timestamptz);
insert into benchmark_clock values(clock_timestamp());
create temp table benchmark_candidates as select * from public.find_today_recipe_candidates_v1(250);
select diag(format('R2 local candidate benchmark: dataset=10002 recipes/10001 ingredients; returned=%s; elapsed_ms=%s; local Docker only, not a production SLA',
  (select count(*) from benchmark_candidates),
  round(extract(epoch from (clock_timestamp()-(select started_at from benchmark_clock)))*1000,2)));
select is((select count(*) from benchmark_candidates),200::bigint,'10k matching recipes are bounded to the top 200');
select ok((select count(*) from benchmark_candidates) <= 250,'candidate pool never exceeds 250');
select is((select count(*) from benchmark_candidates c join public.recipes r on r.id=c.recipe_id where btrim(r.instructions)='' or not exists(select 1 from public.recipe_ingredients i where i.recipe_id=r.id)),0::bigint,'ineligible recipes never enter the bounded pool');

select * from finish();
rollback;
