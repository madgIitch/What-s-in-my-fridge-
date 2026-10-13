begin;
select no_plan();
insert into auth.users(id,email) values('f1000000-0000-4000-a000-000000000001','r5-a@example.test'),('f1000000-0000-4000-a000-000000000002','r5-b@example.test');
insert into public.food_concepts(id,slug,display_name) values
 ('f2000000-0000-4000-a000-000000000001','r5-leche','Leche R5'),('f2000000-0000-4000-a000-000000000002','r5-tomate','Tomate R5'),
 ('f2000000-0000-4000-a000-000000000003','r5-huevos','Huevos R5'),('f2000000-0000-4000-a000-000000000004','r5-harina','Harina R5'),
 ('f2000000-0000-4000-a000-000000000005','r5-sal','Sal R5'),('f2000000-0000-4000-a000-000000000006','r5-queso','Queso R5');
insert into public.food_concept_aliases(normalized_alias,food_concept_id,source) values
 ('leche r5','f2000000-0000-4000-a000-000000000001','test'),('huevos r5','f2000000-0000-4000-a000-000000000003','test'),
 ('harina r5','f2000000-0000-4000-a000-000000000004','test'),('sal r5','f2000000-0000-4000-a000-000000000005','test');
-- A: tomato is low (suggestion), cheese is exact-and-small (never a suggestion by invented threshold).
insert into public.inventory_items(id,user_id,name,expiry_date,quantity,unit,added_at,food_concept_id,normalization_status,normalization_source,knowledge_provenance,stock_mode,stock_state,quantity_precision,quantity_exact,quantity_unit) values
 ('f4000000-0000-4000-a000-000000000001','f1000000-0000-4000-a000-000000000001','Tomate R5',null,1,'unit',now(),'f2000000-0000-4000-a000-000000000002','confirmed','user','user','qualitative','low','unknown',null,null),
 ('f4000000-0000-4000-a000-000000000002','f1000000-0000-4000-a000-000000000001','Queso R5',null,5,'g',now(),'f2000000-0000-4000-a000-000000000006','confirmed','user','user','exact',null,'exact',5,'g');
-- Legacy row written through the untouched legacy path keeps working and is classified, never deleted.
insert into public.shopping_list_items(id,user_id,name,quantity,unit) values('f5000000-0000-4000-a000-000000000001','f1000000-0000-4000-a000-000000000002','Pan viejo',1,'unit');
select is((select source from public.shopping_list_items where id='f5000000-0000-4000-a000-000000000001'),'legacy','legacy insert is classified legacy');
select is((select selection from public.shopping_list_items where id='f5000000-0000-4000-a000-000000000001'),'selected','legacy stays selected');
select ok(not has_function_privilege('authenticated','public.shop_refresh_suggestions_v1(uuid)','EXECUTE'),'arbitrary-user refresh is private');
select ok(not has_function_privilege('authenticated','public.shop_consolidate_v1(uuid)','EXECUTE'),'arbitrary-user consolidation is private');
select ok(not has_table_privilege('authenticated','public.shopping_events','INSERT'),'events are server-written only');
select ok(not has_table_privilege('authenticated','public.shopping_item_sources','UPDATE'),'provenance is server-written only');
select ok(has_function_privilege('authenticated','public.shop_list_v1()','EXECUTE'),'list RPC is available to users');

create temp table r5(k text primary key,v jsonb);
grant all on r5 to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-a000-000000000001","role":"authenticated"}',true);

-- Manual add resolves an unambiguous alias and merges only compatible units.
select is(public.apply_shop_mutation_v1('f6000000-0000-4000-a000-000000000001','add_manual','f5000000-0000-4000-a000-0000000000a1',null,'Leche R5',2,'l')->>'status','applied','manual add applied');
select is((select food_concept_id from public.shopping_list_items where id='f5000000-0000-4000-a000-0000000000a1'),'f2000000-0000-4000-a000-000000000001'::uuid,'alias resolved to concept');
select is(public.apply_shop_mutation_v1('f6000000-0000-4000-a000-000000000001','add_manual','f5000000-0000-4000-a000-0000000000a1',null,'Leche R5',2,'l')->>'status','duplicate','replay returns original result');
select is(public.apply_shop_mutation_v1('f6000000-0000-4000-a000-000000000001','add_manual','f5000000-0000-4000-a000-0000000000a1',null,'Otra cosa',2,'l')->>'error','MUTATION_CONFLICT','same id with another payload conflicts');
select is(public.apply_shop_mutation_v1('f6000000-0000-4000-a000-000000000002','add_manual','f5000000-0000-4000-a000-0000000000a2',null,'leche r5',500,'ml')->>'status','applied','second compatible add applied');
select is((select count(*) from public.shopping_list_items where user_id=auth.uid() and food_concept_id='f2000000-0000-4000-a000-000000000001' and deleted_at is null),1::bigint,'compatible units merge into one row');
select is((select quantity from public.shopping_list_items where id='f5000000-0000-4000-a000-0000000000a1'),2.5::numeric,'2 l plus 500 ml equals 2.5 l');
select is((select count(*) from public.shopping_item_sources where item_id='f5000000-0000-4000-a000-0000000000a1'),2::bigint,'provenance of both origins is kept');
select public.apply_shop_mutation_v1('f6000000-0000-4000-a000-000000000003','add_manual','f5000000-0000-4000-a000-0000000000a3',null,'Leche R5',2,'unidades');
select is((select count(*) from public.shopping_list_items where user_id=auth.uid() and food_concept_id='f2000000-0000-4000-a000-000000000001' and deleted_at is null),2::bigint,'2 units never merge with litres');
select public.apply_shop_mutation_v1('f6000000-0000-4000-a000-000000000004','add_manual',null,null,'Pan sin concepto',null,null);
select public.apply_shop_mutation_v1('f6000000-0000-4000-a000-000000000005','add_manual',null,null,'Pan sin concepto',null,null);
select is((select count(*) from public.shopping_list_items where user_id=auth.uid() and name='Pan sin concepto' and deleted_at is null),1::bigint,'identical unresolved names merge');
select is(public.apply_shop_mutation_v1('f6000000-0000-4000-a000-000000000006','add_manual',null,null,'   ',null,null)->>'error','INVALID_REQUEST','blank name is rejected');

-- Suggestions: qualitative low only, never selected, idempotent, dismissal tied to stock version.
insert into r5 select 'list',public.shop_list_v1();
select is((select jsonb_array_length(v->'items') from r5 where k='list')>0,true,'list returns items');
select is((select selection from public.shopping_list_items where user_id=auth.uid() and source='low_stock_suggestion'),'suggested','low stock is only suggested');
select is((select count(*) from public.shopping_list_items where user_id=auth.uid() and source='low_stock_suggestion'),1::bigint,'exact small stock never suggests');
select public.shop_list_v1();
select is((select count(*) from public.shopping_list_items where user_id=auth.uid() and source='low_stock_suggestion'),1::bigint,'refresh is idempotent');
select is((select count(*) from public.shopping_item_sources s join public.shopping_list_items i on i.id=s.item_id where i.user_id=auth.uid() and i.source='low_stock_suggestion'),1::bigint,'suggestion has recorded stock provenance');
select is((select quantity_exact from public.inventory_items where id='f4000000-0000-4000-a000-000000000002'),5::numeric,'suggesting never writes pantry');
insert into r5 select 'sug',to_jsonb(i) from public.shopping_list_items i where user_id=auth.uid() and source='low_stock_suggestion';
select is(public.apply_shop_mutation_v1('f6000000-0000-4000-a000-000000000007','check',(select (v->>'id')::uuid from r5 where k='sug'),null,null,null,null)->>'status','applied','a suggestion can be checked as ordinary item');
select is(public.apply_shop_mutation_v1('f6000000-0000-4000-a000-000000000008','dismiss',(select (v->>'id')::uuid from r5 where k='sug'),null,null,null,null)->>'status','applied','suggestion dismissed');
select public.shop_list_v1();
select is((select selection from public.shopping_list_items where user_id=auth.uid() and source='low_stock_suggestion'),'dismissed','dismissed stays dismissed at same stock version');
reset role;
update public.inventory_items set stock_state='empty',version=version+1 where id='f4000000-0000-4000-a000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-a000-000000000001","role":"authenticated"}',true);
select public.shop_list_v1();
select is((select selection from public.shopping_list_items where user_id=auth.uid() and source='low_stock_suggestion'),'suggested','new stock version resurfaces the suggestion');
select is(public.apply_shop_mutation_v1('f6000000-0000-4000-a000-000000000009','select',(select (v->>'id')::uuid from r5 where k='sug'),null,null,null,null)->>'status','applied','suggestion accepted');
select is(public.apply_shop_mutation_v1('f6000000-0000-4000-a000-000000000010','select',(select (v->>'id')::uuid from r5 where k='sug'),null,null,null,null)->>'error','INVALID_REQUEST','selecting twice is invalid');

-- Check/uncheck, version conflicts and soft delete never touch the pantry.
select is(public.apply_shop_mutation_v1('f6000000-0000-4000-a000-000000000011','check','f5000000-0000-4000-a000-0000000000a3',999,null,null,null)->>'error','VERSION_CONFLICT','stale version conflicts');
select is(public.apply_shop_mutation_v1('f6000000-0000-4000-a000-000000000012','check','f5000000-0000-4000-a000-0000000000a3',null,null,null,null)->>'status','applied','check applied');
select is((select checked from public.shopping_list_items where id='f5000000-0000-4000-a000-0000000000a3'),true,'item checked');
select is((select count(*) from public.inventory_items where user_id=auth.uid()),2::bigint,'pantry rows untouched by checks');
select is(public.apply_shop_mutation_v1('f6000000-0000-4000-a000-000000000013','remove','f5000000-0000-4000-a000-0000000000a3',null,null,null,null)->>'status','applied','remove is soft delete');
select is(public.apply_shop_mutation_v1('f6000000-0000-4000-a000-000000000014','restore','f5000000-0000-4000-a000-0000000000a3',null,null,null,null)->>'status','applied','restore within five minutes');

-- RLS: user B sees nothing of A and cannot mutate it.
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-a000-000000000002","role":"authenticated"}',true);
select is((select count(*) from public.shopping_list_items where name like 'Leche%'),0::bigint,'RLS hides other user items');
select is(public.apply_shop_mutation_v1('f6000000-0000-4000-a000-000000000015','check','f5000000-0000-4000-a000-0000000000a3',null,null,null,null)->>'error','ITEM_NOT_FOUND','foreign item looks missing');
select is((select count(*) from public.shopping_item_sources),1::bigint,'RLS hides other provenance');
select is((select jsonb_array_length(public.shop_list_v1()->'items')),1,'legacy row appears for its owner');

-- Reconciliation: safe, partial, ambiguous; pantry stays read-only; idempotent per draft; undo is single and strict.
reset role;
insert into public.inventory_items(id,user_id,name,expiry_date,quantity,unit,added_at,food_concept_id,normalization_status,normalization_source,knowledge_provenance,stock_mode,stock_state,quantity_precision,quantity_exact,quantity_unit) values
 ('f4000000-0000-4000-a000-000000000010','f1000000-0000-4000-a000-000000000001','Huevos R5',null,12,'unit',now(),'f2000000-0000-4000-a000-000000000003','confirmed','user','user','exact',null,'exact',12,'unit'),
 ('f4000000-0000-4000-a000-000000000011','f1000000-0000-4000-a000-000000000001','Harina R5',null,200,'g',now(),'f2000000-0000-4000-a000-000000000004','confirmed','user','user','exact',null,'exact',200,'g'),
 ('f4000000-0000-4000-a000-000000000012','f1000000-0000-4000-a000-000000000001','Sal R5',null,1,'unit',now(),'f2000000-0000-4000-a000-000000000005','confirmed','user','user','qualitative','plenty','unknown',null,null);
insert into public.receipt_drafts(id,user_id,raw_text,captured_at,status,confirmed,confirmed_at,confirmed_item_ids) values
 ('f7000000-0000-4000-a000-000000000001','f1000000-0000-4000-a000-000000000001','ticket',now(),'confirmed',true,now(),
  array['f4000000-0000-4000-a000-000000000010','f4000000-0000-4000-a000-000000000011','f4000000-0000-4000-a000-000000000012']::uuid[]);
insert into public.shopping_list_items(id,user_id,name,quantity,unit,source) values
 ('f5000000-0000-4000-a000-0000000000b1','f1000000-0000-4000-a000-000000000001','Huevos R5',6,'unidades','manual'),
 ('f5000000-0000-4000-a000-0000000000b2','f1000000-0000-4000-a000-000000000001','Harina R5',500,'g','manual'),
 ('f5000000-0000-4000-a000-0000000000b3','f1000000-0000-4000-a000-000000000001','Sal R5',100,'g','manual');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-a000-000000000001","role":"authenticated"}',true);
select is((select jsonb_array_length(public.shop_list_v1()->'pendingReconcile')),1,'confirmed ticket is offered for reconciliation');
select is(public.reconcile_shopping_after_receipt_v1('f7000000-0000-4000-a000-000000000002','f6000000-0000-4000-a000-000000000020')->>'error','DRAFT_NOT_FOUND','unknown draft fails closed');
insert into r5 select 'rec',public.reconcile_shopping_after_receipt_v1('f7000000-0000-4000-a000-000000000001','f6000000-0000-4000-a000-000000000021');
select is((select v->>'status' from r5 where k='rec'),'applied','reconciliation applied');
select is((select purchased_at is not null from public.shopping_list_items where id='f5000000-0000-4000-a000-0000000000b1'),true,'covered item is purchased');
select is((select quantity from public.shopping_list_items where id='f5000000-0000-4000-a000-0000000000b2'),300::numeric,'partial cover reduces what is pending');
select is((select purchased_at is null from public.shopping_list_items where id='f5000000-0000-4000-a000-0000000000b2'),true,'partial item stays open');
select is((select purchased_at is null from public.shopping_list_items where id='f5000000-0000-4000-a000-0000000000b3'),true,'unknown quantity is never auto-closed');
select is((select jsonb_array_length(v->'ambiguous') from r5 where k='rec'),2,'ambiguous items wait for review');
select is((select quantity_exact from public.inventory_items where id='f4000000-0000-4000-a000-000000000010'),12::numeric,'reconciliation never edits pantry');
select is(public.reconcile_shopping_after_receipt_v1('f7000000-0000-4000-a000-000000000001','f6000000-0000-4000-a000-000000000022')->>'status','duplicate','one reconciliation per draft');
select is((select count(*) from public.shopping_events where kind='reconcile'),1::bigint,'one event per draft');
select is(public.undo_shopping_reconciliation_v1((select (v->>'eventId')::uuid from r5 where k='rec'),'f6000000-0000-4000-a000-000000000023')->>'status','applied','undo applied');
select is((select purchased_at is null from public.shopping_list_items where id='f5000000-0000-4000-a000-0000000000b1'),true,'undo reopens purchased item');
select is((select quantity from public.shopping_list_items where id='f5000000-0000-4000-a000-0000000000b2'),500::numeric,'undo restores partial quantity');
select is(public.undo_shopping_reconciliation_v1((select (v->>'eventId')::uuid from r5 where k='rec'),'f6000000-0000-4000-a000-000000000024')->>'status','duplicate','undo is single per event');
select is(public.undo_shopping_reconciliation_v1((select (v->>'eventId')::uuid from r5 where k='rec'),'f6000000-0000-4000-a000-000000000021')->>'error','MUTATION_CONFLICT','mutation id cannot change operation');

-- Strict undo: a later edit blocks restoration, and an expired window is final.
reset role;
insert into public.receipt_drafts(id,user_id,raw_text,captured_at,status,confirmed,confirmed_at,confirmed_item_ids) values
 ('f7000000-0000-4000-a000-000000000003','f1000000-0000-4000-a000-000000000001','ticket 2',now(),'confirmed',true,now(),array['f4000000-0000-4000-a000-000000000010']::uuid[]);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-a000-000000000001","role":"authenticated"}',true);
delete from r5 where k='rec';
insert into r5 select 'rec',public.reconcile_shopping_after_receipt_v1('f7000000-0000-4000-a000-000000000003','f6000000-0000-4000-a000-000000000030');
reset role;
update public.shopping_list_items set version=version+1 where id='f5000000-0000-4000-a000-0000000000b1';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-a000-000000000001","role":"authenticated"}',true);
select is(public.undo_shopping_reconciliation_v1((select (v->>'eventId')::uuid from r5 where k='rec'),'f6000000-0000-4000-a000-000000000032')->>'error','UNDO_CONFLICT','later change blocks undo');
reset role;
update public.shopping_events set undo_until=now()-interval '1 minute' where id=(select (v->>'eventId')::uuid from r5 where k='rec');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-a000-000000000001","role":"authenticated"}',true);
select is(public.undo_shopping_reconciliation_v1((select (v->>'eventId')::uuid from r5 where k='rec'),'f6000000-0000-4000-a000-000000000033')->>'error','UNDO_EXPIRED','expired window is final');
select is(public.start_shopping_session_v1('f6000000-0000-4000-a000-000000000040')->>'status','applied','shopping session starts');
select is(public.start_shopping_session_v1('f6000000-0000-4000-a000-000000000041')->>'sessionId',public.start_shopping_session_v1('f6000000-0000-4000-a000-000000000040')->>'sessionId','open session is reused');
select * from finish();
rollback;
