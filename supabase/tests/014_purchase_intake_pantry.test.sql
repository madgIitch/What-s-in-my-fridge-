begin;
select plan(30);

select ok(not has_table_privilege('authenticated','public.catalog_manifests','INSERT'),'authenticated cannot insert catalog manifests');
select ok(not has_table_privilege('authenticated','public.commercial_products','UPDATE'),'authenticated cannot update catalog products');
select ok(not has_table_privilege('authenticated','public.food_concept_aliases','INSERT'),'authenticated cannot insert global aliases');
select ok(not has_table_privilege('authenticated','public.user_product_mappings','INSERT'),'authenticated cannot bypass mapping RPC');
select ok(not has_function_privilege('authenticated','public.import_retailer_catalog_v1(jsonb,jsonb)','EXECUTE'),'catalog import RPC is not exposed to authenticated');
select ok(has_function_privilege('service_role','public.import_retailer_catalog_v1(jsonb,jsonb)','EXECUTE'),'service tooling can execute catalog import');

insert into auth.users(id,email) values
('71000000-0000-0000-0000-000000000001','r1-a@example.test'),
('71000000-0000-0000-0000-000000000002','r1-b@example.test');
insert into public.food_concepts(id,slug,display_name,suggested_location,shelf_life_days) values
('72000000-0000-0000-0000-000000000001','huevos','Huevos','fridge',21),
('72000000-0000-0000-0000-000000000002','pasta','Pasta','pantry',null);
insert into public.receipt_drafts(id,user_id,status,raw_text,captured_at,normalizer_version,original_lines,normalization_review) values
('73000000-0000-4000-a000-000000000001','71000000-0000-0000-0000-000000000001','review','raw',now(),'receipt-normalizer-v2','[
 {"lineId":"line-1","rawText":"1 HUEVOS CAMPEROS","name":"HUEVOS CAMPEROS","quantity":"1","unit":"unit","quantityExplicit":false,"quantityEvidence":null},
 {"lineId":"line-2","rawText":"PASTA BIO","name":"PASTA BIO","quantity":"1","unit":"unit","quantityExplicit":false,"quantityEvidence":null}
]'::jsonb,'[
 {"lineId":"line-1","rawName":"HUEVOS CAMPEROS","rawText":"1 HUEVOS CAMPEROS","displayName":"Huevos","resolution":"resolved","foodConceptId":"72000000-0000-0000-0000-000000000001","candidates":[],"quantity":{"precision":"unknown"},"purchase":{"acquiredOn":"2026-10-01","source":"user"},"freshness":{"precision":"estimated","windowDays":21,"source":"catalog"},"suggestedLocation":"fridge"},
 {"lineId":"line-2","rawName":"PASTA BIO","rawText":"PASTA BIO","displayName":"PASTA BIO","resolution":"doubtful","foodConceptId":null,"candidates":[{"foodConceptId":"72000000-0000-0000-0000-000000000002","slug":"pasta","displayName":"Pasta"}],"quantity":{"precision":"unknown"},"purchase":{"acquiredOn":"2026-10-01","source":"user"},"freshness":{"precision":"unknown"}}
]'::jsonb),
('73000000-0000-4000-a000-000000000002','71000000-0000-0000-0000-000000000001','review','raw',now(),'receipt-normalizer-v2','[
 {"lineId":"ok","rawText":"HUEVOS","name":"HUEVOS","quantity":"1","unit":"unit","quantityExplicit":false,"quantityEvidence":null},
 {"lineId":"bad","rawText":"BAD","name":"BAD","quantity":"1","unit":"unit","quantityExplicit":false,"quantityEvidence":null}
]'::jsonb,'[
 {"lineId":"ok","rawName":"HUEVOS","rawText":"HUEVOS","displayName":"Huevos","foodConceptId":"72000000-0000-0000-0000-000000000001","candidates":[],"quantity":{"precision":"unknown"},"purchase":{"acquiredOn":"2026-10-01","source":"user"},"freshness":{"precision":"unknown"}},
 {"lineId":"bad","rawName":"BAD","rawText":"BAD","displayName":"Bad","foodConceptId":null,"candidates":[],"quantity":{"precision":"unknown"},"purchase":{"acquiredOn":"2026-10-01","source":"user"},"freshness":{"precision":"unknown"}}
]'::jsonb);
insert into public.receipt_drafts(id,user_id,status,raw_text,captured_at,normalizer_version,original_lines,normalization_review) values
('73000000-0000-4000-a000-000000000003','71000000-0000-0000-0000-000000000001','review','1 pack HUEVOS',now(),'receipt-normalizer-v2',
'[{"lineId":"pack","rawText":"1 pack HUEVOS","name":"HUEVOS","quantity":"1","unit":"pack","quantityExplicit":true,"quantityEvidence":"explicit_prefix"}]'::jsonb,
'[{"lineId":"pack","rawName":"HUEVOS","rawText":"1 pack HUEVOS","displayName":"Huevos","resolution":"unknown","foodConceptId":null,"candidates":[],"quantity":{"precision":"exact","quantity":1,"unit":"pack"},"purchase":{"acquiredOn":"2026-10-01","source":"user"},"freshness":{"precision":"unknown"}}]'::jsonb);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((public.confirm_receipt_draft_v2('73000000-0000-4000-a000-000000000002','receipt-normalizer-v2','[{"lineId":"ok","decision":"accept","foodConceptId":"72000000-0000-0000-0000-000000000001"},{"lineId":"bad","decision":"accept","foodConceptId":"72000000-0000-0000-0000-000000000099"}]','2026-10-01','bad')->>'code'),'VALIDATION_ERROR','later invalid line rejects complete plan');
select is((select count(*) from public.inventory_items where receipt_draft_id='73000000-0000-4000-a000-000000000002'),0::bigint,'invalid plan writes no earlier line');

select is((public.confirm_receipt_draft_v2('73000000-0000-4000-a000-000000000001','receipt-normalizer-v2','[{"lineId":"line-1","decision":"accept","foodConceptId":"72000000-0000-0000-0000-000000000001","displayName":"Huevos"},{"lineId":"line-2","decision":"unknown","displayName":"Pasta bio"}]','2026-10-01','same')->>'pendingCount')::int,1,'confirmation records one pending line');
select is((select count(*) from public.inventory_items where receipt_draft_id='73000000-0000-4000-a000-000000000001'),2::bigint,'one row per accepted line');
select is((select raw_name from public.inventory_items where receipt_line_id='line-1'),'HUEVOS CAMPEROS','raw name is preserved');
select is((select name from public.inventory_items where receipt_line_id='line-1'),'Huevos','human display name is stored');
select is((select food_concept_id from public.user_product_mappings where normalized_raw_name='huevos camperos'),'72000000-0000-0000-0000-000000000001'::uuid,'initial explicit correction creates private mapping');
select is((select quantity_precision from public.inventory_items where receipt_line_id='line-1'),'unknown','synthetic one remains unknown');
select is((select expiry_date_exact from public.inventory_items where receipt_line_id='line-1'),null::date,'estimate never becomes exact expiry');
select is((select location_confirmed from public.inventory_items where receipt_line_id='line-1'),false,'concept location remains proposed');
select is((public.confirm_receipt_draft_v2('73000000-0000-4000-a000-000000000001','receipt-normalizer-v2','[{"lineId":"line-1","decision":"accept","foodConceptId":"72000000-0000-0000-0000-000000000001","displayName":"Huevos"},{"lineId":"line-2","decision":"unknown","displayName":"Pasta bio"}]','2026-10-01','same')->>'pendingCount')::int,1,'identical replay is canonical');
select is((public.confirm_receipt_draft_v2('73000000-0000-4000-a000-000000000001','receipt-normalizer-v2','[{"lineId":"line-1","decision":"omit"}]','2026-10-01','changed')->>'code'),'DRAFT_STATE_CONFLICT','changed replay conflicts');

select is((public.resolve_receipt_line_v2('73000000-0000-4000-a000-000000000001','line-2','74000000-0000-4000-a000-000000000001',1,'resolve','72000000-0000-0000-0000-000000000002','Mi pasta','resolve')->>'code'),'OK','pending line resolves in place');
select is((select count(*) from public.inventory_items where receipt_draft_id='73000000-0000-4000-a000-000000000001'),2::bigint,'resolution never duplicates item');
select is((select display_name from public.user_product_mappings where normalized_raw_name='pasta bio'),'Mi pasta','user correction creates private mapping');
select is((public.resolve_receipt_line_v2('73000000-0000-4000-a000-000000000001','line-2','74000000-0000-4000-a000-000000000001',1,'resolve','72000000-0000-0000-0000-000000000002','Mi pasta','resolve')->>'code'),'OK','mutation replay returns canonical result');
select is((public.confirm_receipt_draft_v2('73000000-0000-4000-a000-000000000003','receipt-normalizer-v2','[{"lineId":"pack","decision":"unknown","displayName":"Huevos"}]','2026-10-01','ignored')->>'pendingCount')::int,1,'explicit pack confirms as pending without inventing concept');
select is((select quantity_precision from public.inventory_items where receipt_line_id='pack'),'exact','explicit receipt quantity is exact');
select is((select quantity_unit from public.inventory_items where receipt_line_id='pack'),'pack','pack purchase keeps pack unit');
select is((select quantity_exact from public.inventory_items where receipt_line_id='pack'),1::numeric,'pack is not expanded to internal contents');
select is((select receipt_quantity_evidence->>'evidence' from public.inventory_items where receipt_line_id='pack'),'explicit_prefix','original quantity evidence is preserved');
select is((public.apply_inventory_mutation('75000000-0000-4000-a000-000000000001','delete',(select id from public.inventory_items where receipt_line_id='line-2'),2,'{}'::jsonb)->>'code'),'OK','pending-resolved item can be tombstoned');
select is((public.restore_inventory_item_v3('75000000-0000-4000-a000-000000000002',(select id from public.inventory_items where receipt_line_id='line-2'),3)->>'code'),'OK','undo restores with compare-and-swap mutation');
select set_config('request.jwt.claims','{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is((select count(*) from public.user_product_mappings),0::bigint,'mapping is owner isolated');

select * from finish();
rollback;
