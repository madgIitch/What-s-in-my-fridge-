begin;
select no_plan();
insert into auth.users(id,email) values('a6000000-0000-4000-a000-000000000001','r6-a@example.test'),('a6000000-0000-4000-a000-000000000002','r6-b@example.test');
insert into public.food_concepts(id,slug,display_name) values('a6100000-0000-4000-a000-000000000001','r6-huevos','Huevos R6'),('a6100000-0000-4000-a000-000000000002','r6-leche','Leche R6');
insert into public.recipe_import_jobs(id,user_id,idempotency_key,source_type,manual_text,state,result) values
 ('a6200000-0000-4000-a000-000000000001','a6000000-0000-4000-a000-000000000001','r6-import-fixture-a','manual','receta','completed',
  '{"schemaVersion":"recipe-v1","title":"Tortilla R6","ingredients":[{"name":"Huevos R6","amount":"4","unit":"unit"},{"name":"Ingrediente raro R6"}],"steps":["Cocinar"],"source":{"type":"manual"},"provenance":{}}'),
 ('a6200000-0000-4000-a000-000000000002','a6000000-0000-4000-a000-000000000001','r6-import-fixture-b','manual','receta','completed',
  '{"schemaVersion":"recipe-v1","title":"Leche R6 sola","ingredients":[{"name":"Leche R6","amount":"1","unit":"l"}],"steps":["Calentar"],"source":{"type":"manual"},"provenance":{}}');
insert into public.inventory_items(id,user_id,name,expiry_date,quantity,unit,added_at,food_concept_id,normalization_status,normalization_source,knowledge_provenance,stock_mode,quantity_precision,quantity_exact,quantity_unit) values
 ('a6300000-0000-4000-a000-000000000001','a6000000-0000-4000-a000-000000000001','Huevos R6',null,6,'unit',now(),'a6100000-0000-4000-a000-000000000001','confirmed','user','user','exact','exact',6,'unit');
create temp table r6(k text primary key,v jsonb);
grant all on r6 to authenticated;
insert into r6 values('from',to_jsonb((date_trunc('week',(now() at time zone 'utc')::date)::date+7)::text)),('today',to_jsonb(((now() at time zone 'utc')::date)::text));
create function pg_temp.from_d() returns date language sql as $$ select (v#>>'{}')::date from r6 where k='from' $$;
create function pg_temp.today_d() returns date language sql as $$ select (v#>>'{}')::date from r6 where k='today' $$;
create function pg_temp.meal(p_id uuid,p_mut uuid,p_date date,p_ref text,p_title text,p_ings jsonb default '[]') returns jsonb language sql as $$
 select public.apply_meal_mutation(p_mut,'create',p_id,null,jsonb_build_object('meal_type','dinner','meal_date',p_date,'recipe_id',null,
  'recipe_snapshot',jsonb_build_object('version',1,'recipe_id',p_ref,'title',p_title,'ingredients',p_ings,'instructions','[]'::jsonb),'custom_name',null,'ingredients_consumed','[]'::jsonb))
$$;
grant execute on function pg_temp.from_d(),pg_temp.today_d(),pg_temp.meal(uuid,uuid,date,text,text,jsonb) to authenticated;

select ok(not has_function_privilege('authenticated','public.plan_compute_v1(uuid,date,date)','EXECUTE'),'arbitrary-user compute is private');
select ok(not has_function_privilege('authenticated','public.plan_recipe_for_entry_v1(uuid,public.meal_entries)','EXECUTE'),'recipe resolver is private');
select ok(has_function_privilege('authenticated','public.plan_week_v1(date,date)','EXECUTE'),'week RPC is for users');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a6000000-0000-4000-a000-000000000001","role":"authenticated"}',true);

select is(public.plan_week_v1(pg_temp.from_d()+1,pg_temp.today_d())->>'error','INVALID_REQUEST','from must be a Monday');
select is(public.plan_week_v1(pg_temp.from_d()+700,pg_temp.today_d())->>'error','INVALID_REQUEST','far dates are rejected');
select is(public.plan_week_v1(pg_temp.from_d(),pg_temp.today_d()+9)->>'error','INVALID_REQUEST','client today must be near the server clock');
select is((public.plan_week_v1(pg_temp.from_d(),pg_temp.today_d())->'missing'->>'count')::int,0,'empty week has no missing');
select is(jsonb_array_length(public.plan_week_v1(pg_temp.from_d(),pg_temp.today_d())->'days'),7,'week has seven days');

-- One recipe twice across the week: 4 + 4 eggs against 6 in stock asks for 2, not 0.
select is(pg_temp.meal('a6400000-0000-4000-a000-000000000001','a6500000-0000-4000-a000-000000000001',pg_temp.from_d()+1,'import:a6200000-0000-4000-a000-000000000001','Tortilla R6')->>'status','applied','recipe planned');
select is((public.plan_week_v1(pg_temp.from_d(),pg_temp.today_d())->'missing'->>'count')::int,0,'one recipe is covered by stock');
select pg_temp.meal('a6400000-0000-4000-a000-000000000002','a6500000-0000-4000-a000-000000000002',pg_temp.from_d()+2,'import:a6200000-0000-4000-a000-000000000001','Tortilla R6');
insert into r6 select 'wk',public.plan_week_v1(pg_temp.from_d(),pg_temp.today_d());
select is((select (v#>>'{missing,lines,0,quantity}')::numeric from r6 where k='wk'),2::numeric,'aggregated need is 8 against 6');
select is((select jsonb_array_length(v#>'{missing,lines,0,entries}') from r6 where k='wk'),2,'both recipes are referenced');
select is((select jsonb_array_length(v#>'{missing,unresolved}') from r6 where k='wk'),2,'unresolved ingredients are reported, not bought');
select is((select jsonb_array_length(v#>'{missing,lines}') from r6 where k='wk'),1,'unresolved ingredients are not missing lines');

-- Cenar fuera is classified, has no ingredients and removes that day from the calculation.
select is(public.apply_meal_mutation('a6500000-0000-4000-a000-000000000003','create','a6400000-0000-4000-a000-000000000003',null,
 jsonb_build_object('meal_type','dinner','meal_date',pg_temp.from_d()+2,'custom_name','cenar  fuera','ingredients_consumed','[]'::jsonb))->>'status','applied','outside entry written through the legacy RPC');
select is((select plan_kind from public.meal_entries where id='a6400000-0000-4000-a000-000000000003'),'outside','trigger classifies outside');
select is((select custom_name from public.meal_entries where id='a6400000-0000-4000-a000-000000000003'),'Cenar fuera','outside name is normalised');
select is((public.plan_week_v1(pg_temp.from_d(),pg_temp.today_d())->'missing'->>'count')::int,0,'outside day drops its recipes from the plan');
select is((select count(*) from jsonb_array_elements(public.plan_week_v1(pg_temp.from_d(),pg_temp.today_d())->'days'->2->'entries') e where e->>'kind'='outside'),1::bigint,'outside shown on its day');
select is(public.apply_meal_mutation('a6500000-0000-4000-a000-000000000004','delete','a6400000-0000-4000-a000-000000000003',1,null)->>'status','applied','outside removed again');
select is((public.plan_week_v1(pg_temp.from_d(),pg_temp.today_d())->'missing'->>'count')::int,1,'recipes count again once the day is free');

-- Legacy entries stay readable, read-only and out of the calculation.
select public.apply_meal_mutation('a6500000-0000-4000-a000-000000000005','create','a6400000-0000-4000-a000-000000000004',null,
 jsonb_build_object('meal_type','lunch','meal_date',pg_temp.from_d()+3,'custom_name','Pasta antigua','ingredients_consumed','[]'::jsonb));
select is((select e->>'kind' from jsonb_array_elements(public.plan_week_v1(pg_temp.from_d(),pg_temp.today_d())->'days'->3->'entries') e limit 1),'legacy','legacy entry is classified');
select is((select (e->>'readOnly')::boolean from jsonb_array_elements(public.plan_week_v1(pg_temp.from_d(),pg_temp.today_d())->'days'->3->'entries') e limit 1),true,'legacy entry is read-only');

-- Adding to Compra requires the key of what the user saw.
delete from r6 where k='wk';
insert into r6 select 'wk',public.plan_week_v1(pg_temp.from_d(),pg_temp.today_d());
select is(public.plan_add_to_shop_v1(pg_temp.from_d(),pg_temp.today_d(),'a6600000-0000-4000-a000-000000000001','stale-key')->>'error','PLAN_CHANGED','stale key does not write');
select is((select count(*) from public.shopping_list_items where user_id=auth.uid() and source='plan_missing'),0::bigint,'nothing was written on conflict');
insert into r6 select 'shop',public.plan_add_to_shop_v1(pg_temp.from_d(),pg_temp.today_d(),'a6600000-0000-4000-a000-000000000002',(select v#>>'{missing,key}' from r6 where k='wk'));
select is((select v->>'status' from r6 where k='shop'),'applied','plan added to Compra');
select is((select quantity from public.shopping_list_items where user_id=auth.uid() and source='plan_missing'),2::numeric,'only the deficit is added');
select is((select source_ref from public.shopping_list_items where user_id=auth.uid() and source='plan_missing'),'plan:'||pg_temp.from_d()::text,'source ref names the week');
select is((select count(*) from public.shopping_item_sources s join public.shopping_list_items i on i.id=s.item_id where i.user_id=auth.uid() and s.source='plan_missing'),1::bigint,'provenance row recorded');
select is((select jsonb_array_length(s.source_ref->'entries') from public.shopping_item_sources s join public.shopping_list_items i on i.id=s.item_id where i.user_id=auth.uid() and s.source='plan_missing'),2,'provenance keeps both recipes');
select is(public.plan_add_to_shop_v1(pg_temp.from_d(),pg_temp.today_d(),'a6600000-0000-4000-a000-000000000002',(select v#>>'{missing,key}' from r6 where k='wk'))->>'status','duplicate','replay returns original');
select is(public.plan_add_to_shop_v1(pg_temp.from_d()+7,pg_temp.today_d(),'a6600000-0000-4000-a000-000000000002','other')->>'error','MUTATION_CONFLICT','same id with another payload conflicts');
select is(public.plan_add_to_shop_v1(pg_temp.from_d(),pg_temp.today_d(),'a6600000-0000-4000-a000-000000000003',(select v#>>'{missing,key}' from r6 where k='wk'))->>'status','applied','a second gesture is accepted');
select is((select count(*) from public.shopping_list_items where user_id=auth.uid() and source='plan_missing' and deleted_at is null),1::bigint,'no duplicate item for the same week');
select is((select quantity from public.shopping_list_items where user_id=auth.uid() and source='plan_missing'),2::numeric,'quantity is not doubled');
select is((select quantity_exact from public.inventory_items where id='a6300000-0000-4000-a000-000000000001'),6::numeric,'planning never touches the pantry');

-- Changing the plan invalidates the shown key; growth updates only an unchecked item.
select pg_temp.meal('a6400000-0000-4000-a000-000000000005','a6500000-0000-4000-a000-000000000006',pg_temp.from_d()+4,'import:a6200000-0000-4000-a000-000000000001','Tortilla R6');
select is(public.plan_add_to_shop_v1(pg_temp.from_d(),pg_temp.today_d(),'a6600000-0000-4000-a000-000000000004',(select v#>>'{missing,key}' from r6 where k='wk'))->>'error','PLAN_CHANGED','changed plan needs a fresh comparison');
insert into r6 select 'wk2',public.plan_week_v1(pg_temp.from_d(),pg_temp.today_d());
select is(public.plan_add_to_shop_v1(pg_temp.from_d(),pg_temp.today_d(),'a6600000-0000-4000-a000-000000000005',(select v#>>'{missing,key}' from r6 where k='wk2'))->>'status','applied','fresh key applies');
select is((select quantity from public.shopping_list_items where user_id=auth.uid() and source='plan_missing' and deleted_at is null),6::numeric,'unchecked item grows to the new deficit');

-- A source that can no longer be read falls back to the saved snapshot; without snapshot it is reported.
reset role;
delete from public.recipe_import_jobs where id='a6200000-0000-4000-a000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a6000000-0000-4000-a000-000000000001","role":"authenticated"}',true);
select pg_temp.meal('a6400000-0000-4000-a000-000000000006','a6500000-0000-4000-a000-000000000007',pg_temp.from_d()+5,'import:a6200000-0000-4000-a000-000000000002','Receta borrada R6');
select is((public.plan_week_v1(pg_temp.from_d(),pg_temp.today_d())->'missing'->'unavailable'->0->>'title'),'Receta borrada R6','unreadable recipe without snapshot is reported');
select pg_temp.meal('a6400000-0000-4000-a000-000000000007','a6500000-0000-4000-a000-000000000008',pg_temp.from_d()+6,'import:a6200000-0000-4000-a000-000000000002','Receta con snapshot R6',
 '[{"ingredient_key":null,"name":"Leche R6","quantity":1,"unit":"l"}]'::jsonb);
select is((select l->>'name' from jsonb_array_elements(public.plan_week_v1(pg_temp.from_d(),pg_temp.today_d())->'missing'->'lines') l where l->>'name'='Leche R6'),'Leche R6','snapshot ingredients still count');

-- Another user sees none of it and cannot add it.
select set_config('request.jwt.claims','{"sub":"a6000000-0000-4000-a000-000000000002","role":"authenticated"}',true);
select is((select count(*) from jsonb_array_elements(public.plan_week_v1(pg_temp.from_d(),pg_temp.today_d())->'days') d, jsonb_array_elements(d->'entries') e),0::bigint,'RLS hides other users plan');
select is((public.plan_week_v1(pg_temp.from_d(),pg_temp.today_d())->'missing'->>'count')::int,0,'no foreign faltantes');
select * from finish();
rollback;
