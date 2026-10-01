begin;
-- Isolate the active-catalog fixture inside this rollback-only transaction.
update public.catalog_versions set active = false where active;
select plan(29);

select ok(not has_table_privilege('authenticated','public.today_recommendation_cache','INSERT'),'browser cannot forge Today cache');
select ok(has_table_privilege('authenticated','public.today_recommendation_cache','SELECT'),'browser can read only its cache through RLS');
select ok(not has_function_privilege('authenticated','public.store_today_cache_v1(uuid,date,text,text,text,uuid,jsonb)','EXECUTE'),'cache publication is service-only');
select ok(has_function_privilege('authenticated','public.read_today_cache_v1(date,text,text)','EXECUTE'),'authenticated Today cache reader is exposed');
select ok(has_function_privilege('authenticated','public.apply_today_shopping_v1(uuid,uuid,uuid)','EXECUTE'),'authenticated atomic shopping RPC is exposed');

insert into auth.users(id,email) values
  ('81000000-0000-4000-a000-000000000001','r2-a@example.test'),
  ('81000000-0000-4000-a000-000000000002','r2-b@example.test');
insert into public.food_concepts(id,slug,display_name) values
  ('82000000-0000-4000-a000-000000000001','huevos-r2','Huevos R2'),
  ('82000000-0000-4000-a000-000000000002','tomate-r2','Tomate R2');
insert into public.catalog_versions(id,checksum,source_version,matcher_version,active,recipe_count,ingredient_count)
values ('83000000-0000-4000-a000-000000000001',repeat('a',64),'r2-test','matcher-r2',true,4,4);
insert into public.recipes(id,catalog_version_id,external_id,name,instructions) values
  ('84000000-0000-4000-a000-000000000001','83000000-0000-4000-a000-000000000001','external-z','Huevos suficientes','Cocinar'),
  ('84000000-0000-4000-a000-000000000002','83000000-0000-4000-a000-000000000001','external-a','Huevos y tomate','Cocinar'),
  ('84000000-0000-4000-a000-000000000003','83000000-0000-4000-a000-000000000001','external-b','Solo tomate','Cocinar'),
  ('84000000-0000-4000-a000-000000000004','83000000-0000-4000-a000-000000000001','external-c','Favorita','Cocinar');
insert into public.recipe_ingredients(id,recipe_id,position,name,normalized_name,measure,food_concept_id) values
  ('85000000-0000-4000-a000-000000000001','84000000-0000-4000-a000-000000000001',0,'Huevos R2','huevos r2','1 unit','82000000-0000-4000-a000-000000000001'),
  ('85000000-0000-4000-a000-000000000002','84000000-0000-4000-a000-000000000002',0,'Huevos R2','huevos r2','3 unit','82000000-0000-4000-a000-000000000001'),
  ('85000000-0000-4000-a000-000000000003','84000000-0000-4000-a000-000000000002',1,'Tomate R2','tomate r2','2 unit','82000000-0000-4000-a000-000000000002'),
  ('85000000-0000-4000-a000-000000000004','84000000-0000-4000-a000-000000000003',0,'Tomate R2','tomate r2','1 unit','82000000-0000-4000-a000-000000000002'),
  ('85000000-0000-4000-a000-000000000005','84000000-0000-4000-a000-000000000004',0,'Tomate R2','tomate r2','1 unit','82000000-0000-4000-a000-000000000002');
insert into public.inventory_items(id,user_id,name,expiry_date,quantity,unit,added_at,food_concept_id,normalization_status,normalization_source,knowledge_provenance,stock_mode,stock_state,quantity_precision,quantity_exact,quantity_unit) values
  ('86000000-0000-4000-a000-000000000001','81000000-0000-4000-a000-000000000001','Huevos','2026-10-10',2,'unit',now(),'82000000-0000-4000-a000-000000000001','confirmed','user','user','exact','some','exact',2,'unit'),
  ('86000000-0000-4000-a000-000000000002','81000000-0000-4000-a000-000000000002','Tomate','2026-10-10',1,'unit',now(),'82000000-0000-4000-a000-000000000002','confirmed','user','user','exact','some','exact',1,'unit');
insert into public.favorite_recipes(id,user_id,recipe_id,name,match_percentage,instructions,saved_at,snapshot) values
  ('87000000-0000-4000-a000-000000000001','81000000-0000-4000-a000-000000000001','84000000-0000-4000-a000-000000000004','Favorita',0,'Cocinar',now(),'{"title":"Favorita","ingredients":[],"instructions":["Cocinar"]}');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-a000-000000000001","role":"authenticated"}',true);
select is((select count(*) from public.find_today_recipe_candidates_v1(250)),3::bigint,'matched recipes plus own active-catalog favorite are selected without initial fallback');
select is((select recipe_id::text from public.find_today_recipe_candidates_v1(250) order by source_rank,overlap_count desc,recipe_id::text collate "C" limit 1),'84000000-0000-4000-a000-000000000001','candidate tie order uses public recipe UUID ASCII, not external id');
select is((select count(*) from public.find_today_recipe_candidates_v1(1)),1::bigint,'candidate limit is enforced');
select is((select count(*) from public.find_today_recipe_candidates_v1(999)),3::bigint,'candidate cardinality stays bounded and deduplicated');

reset role;
create temp table r2_keys(user_id uuid,key text);
grant select on r2_keys to service_role, authenticated;
insert into r2_keys values
 ('81000000-0000-4000-a000-000000000001',public.today_state_key_for_user_v1('81000000-0000-4000-a000-000000000001','2026-10-02','matcher-r2','today-ranking-v3')),
 ('81000000-0000-4000-a000-000000000002',public.today_state_key_for_user_v1('81000000-0000-4000-a000-000000000002','2026-10-02','matcher-r2','today-ranking-v3'));
set local role service_role;
select is((public.store_today_cache_v1('81000000-0000-4000-a000-000000000001','2026-10-02','matcher-r2','today-ranking-v3',(select key from r2_keys where user_id='81000000-0000-4000-a000-000000000001'),'88000000-0000-4000-a000-000000000001','{"response":{"snapshotKey":"88000000-0000-4000-a000-000000000001"},"authorizedRecipeIds":["84000000-0000-4000-a000-000000000002"]}')->>'action'),'stored','service publishes a revalidated private snapshot');
select is((public.store_today_cache_v1('81000000-0000-4000-a000-000000000002','2026-10-02','matcher-r2','today-ranking-v3',(select key from r2_keys where user_id='81000000-0000-4000-a000-000000000002'),'88000000-0000-4000-a000-000000000002','{"response":{"snapshotKey":"88000000-0000-4000-a000-000000000002"},"authorizedRecipeIds":[]}')->>'action'),'stored','second user gets a distinct private snapshot');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-a000-000000000001","role":"authenticated"}',true);
select is((public.read_today_cache_v1('2026-10-02','matcher-r2','today-ranking-v3')->>'action'),'hit','own unexpired cache is returned');
select is((select count(*) from public.today_recommendation_cache),1::bigint,'RLS exposes only own cache row');
select is((public.apply_today_shopping_v1('84000000-0000-4000-a000-000000000099','88000000-0000-4000-a000-000000000001','89000000-0000-4000-a000-000000000099')->>'code'),'RECIPE_NOT_FOUND','missing recipe is distinguished before cache authorization');
select is((public.apply_today_shopping_v1('84000000-0000-4000-a000-000000000002','88000000-0000-4000-a000-000000000002','89000000-0000-4000-a000-000000000001')->>'code'),'SNAPSHOT_CONFLICT','another user snapshot is rejected');
select is((public.apply_today_shopping_v1('84000000-0000-4000-a000-000000000002','88000000-0000-4000-a000-000000000001','89000000-0000-4000-a000-000000000001')->>'code'),'OK','authorized shopping mutation applies atomically');
select is((select count(*) from public.shopping_list_items),2::bigint,'all demonstrated missing concepts are added atomically');
select is((select quantity from public.shopping_list_items where ingredient_key='82000000-0000-4000-a000-000000000002'),null::numeric,'complete concept absence never invents a numeric deficit');
select is((select unit from public.shopping_list_items where ingredient_key='82000000-0000-4000-a000-000000000002'),null::text,'complete concept absence never invents a deficit unit');
select is((select quantity from public.shopping_list_items where ingredient_key='82000000-0000-4000-a000-000000000001'),1::numeric,'compatible exact insufficiency stores the real canonical deficit');
select is((public.apply_today_shopping_v1('84000000-0000-4000-a000-000000000002','88000000-0000-4000-a000-000000000001','89000000-0000-4000-a000-000000000001')->>'code'),'OK','identical replay succeeds');
select is((select count(*) from public.shopping_list_items),2::bigint,'replay creates no duplicate shopping row');
select is((public.apply_today_shopping_v1('84000000-0000-4000-a000-000000000001','88000000-0000-4000-a000-000000000001','89000000-0000-4000-a000-000000000001')->>'code'),'MUTATION_CONFLICT','mutation id cannot be reused for another recipe');

reset role;
update public.inventory_items set quantity_exact=4,quantity=4,version=version+1,updated_at=clock_timestamp() where id='86000000-0000-4000-a000-000000000001';
set local role authenticated;
select is((public.apply_today_shopping_v1('84000000-0000-4000-a000-000000000002','88000000-0000-4000-a000-000000000001','89000000-0000-4000-a000-000000000001')->'itemIds'),(select to_jsonb(item_ids) from public.today_shopping_mutations where client_mutation_id='89000000-0000-4000-a000-000000000001'),'applied replay returns the original IDs even after pantry changes');
select is((public.apply_today_shopping_v1('84000000-0000-4000-a000-000000000002','88000000-0000-4000-a000-000000000001','89000000-0000-4000-a000-000000000003')->>'code'),'SNAPSHOT_CONFLICT','a new mutation rejects the now-stale snapshot');
select is((select count(*) from public.shopping_list_items),2::bigint,'stale new mutation and applied replay leave shopping rows unchanged');
reset role;
set local role service_role;
select is((public.store_today_cache_v1('81000000-0000-4000-a000-000000000001','2026-10-02','matcher-r2','today-ranking-v3',(select key from r2_keys where user_id='81000000-0000-4000-a000-000000000001'),'88000000-0000-4000-a000-000000000003','{"response":{},"authorizedRecipeIds":[]}')->>'action'),'stale','cache write rejects a snapshot computed before pantry changed');
reset role;
select is((select count(*) from public.recipe_monthly_usage where user_id='81000000-0000-4000-a000-000000000001'),0::bigint,'Today and shopping do not consume legacy suggestion quota');
select is((select count(*) from public.usage_counters where user_id='81000000-0000-4000-a000-000000000001'),0::bigint,'Today does not create unified usage counters');

select * from finish();
rollback;
