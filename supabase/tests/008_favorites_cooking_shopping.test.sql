begin;
select plan(19);
insert into auth.users(id,email) values
 ('80000000-0000-0000-0000-000000000001','s8-a@example.test'),
 ('80000000-0000-0000-0000-000000000002','s8-b@example.test');

set local role authenticated;
set local request.jwt.claim.sub='80000000-0000-0000-0000-000000000001';
select is((public.apply_favorite_mutation('81000000-0000-4000-8000-000000000001','recipe-1','saved','{"version":1,"title":"Sopa","ingredients":[{"ingredientKey":"tomate","name":"Tomate","quantity":2,"unit":"ud"}],"instructions":["Cocer"]}'::jsonb,null)->>'status'),'applied','favorite is saved');
select is((public.apply_favorite_mutation('81000000-0000-4000-8000-000000000001','recipe-1','saved','{"version":1,"title":"Changed","ingredients":[],"instructions":[]}'::jsonb,null)->>'status'),'duplicate','favorite replay is duplicate');
select is((select count(*) from public.favorite_recipes where recipe_id='recipe-1' and deleted_at is null),1::bigint,'one active favorite');
select is((select snapshot->>'title' from public.favorite_recipes where recipe_id='recipe-1'),'Sopa','snapshot remains immutable on replay');

reset role;
insert into public.inventory_items(id,user_id,name,normalized_name,expiry_date,quantity,unit,added_at) values
 ('82000000-0000-4000-8000-000000000001','80000000-0000-0000-0000-000000000001','Tomate','tomate',current_date+1,3,'ud',now()),
 ('82000000-0000-4000-8000-000000000002','80000000-0000-0000-0000-000000000002','Tomate','tomate',current_date+1,9,'ud',now());
set local role authenticated;
set local request.jwt.claim.sub='80000000-0000-0000-0000-000000000001';
select is((public.apply_cooking_mutation('83000000-0000-4000-8000-000000000001','{"title":"Sopa"}'::jsonb,'[{"ingredient_key":"tomate","inventory_item_id":"82000000-0000-4000-8000-000000000001","expected_version":1,"quantity":2,"unit":"ud"}]'::jsonb)->>'status'),'applied','cook applies atomically');
select is((select quantity from public.inventory_items where id='82000000-0000-4000-8000-000000000001'),1::numeric,'quantity deducted once');
select is((public.apply_cooking_mutation('83000000-0000-4000-8000-000000000001','{"title":"Sopa"}'::jsonb,'[]'::jsonb)->>'status'),'duplicate','cook replay is duplicate');
select is((select quantity from public.inventory_items where id='82000000-0000-4000-8000-000000000001'),1::numeric,'replay does not deduct');
select is((public.apply_cooking_mutation('83000000-0000-4000-8000-000000000002','{"title":"Sopa"}'::jsonb,'[{"ingredient_key":"tomate","inventory_item_id":"82000000-0000-4000-8000-000000000001","expected_version":2,"quantity":2,"unit":"ud"}]'::jsonb)->>'code'),'INSUFFICIENT_QUANTITY','insufficient quantity conflicts');
select is((select quantity from public.inventory_items where id='82000000-0000-4000-8000-000000000001'),1::numeric,'conflict leaves quantity unchanged');
select is((select count(*) from public.meal_entries),1::bigint,'conflict creates no meal');
select is((public.apply_cooking_mutation('83000000-0000-4000-8000-000000000003','{"title":"Sopa"}'::jsonb,'[{"ingredient_key":"tomate","inventory_item_id":"82000000-0000-4000-8000-000000000001","expected_version":1,"quantity":1,"unit":"ud"}]'::jsonb)->>'code'),'VERSION_CONFLICT','stale version conflicts');

select is((public.apply_shopping_list_mutation('84000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000001','Leche','leche',1,'l','active',null)->>'status'),'applied','explicit shopping item applies');
select is((public.apply_shopping_list_mutation('84000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000001','Leche','leche',1,'l','active',null)->>'status'),'duplicate','shopping replay is duplicate');
select is((select count(*) from public.shopping_list_items),1::bigint,'one explicit item');

set local request.jwt.claim.sub='80000000-0000-0000-0000-000000000002';
select is((select count(*) from public.favorite_recipes),0::bigint,'RLS hides favorites');
select is((select count(*) from public.cooking_mutations),0::bigint,'RLS hides cooking mutations');
select is((select count(*) from public.shopping_list_items),0::bigint,'RLS hides shopping items');
select is((select quantity from public.inventory_items where id='82000000-0000-4000-8000-000000000002'),9::numeric,'other user inventory untouched');
select * from finish();
rollback;
