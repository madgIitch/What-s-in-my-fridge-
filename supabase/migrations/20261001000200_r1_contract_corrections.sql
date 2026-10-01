-- Corrective, additive R1 migration after the initial local application.
alter table public.receipt_drafts add column if not exists review_decisions jsonb not null default '[]'::jsonb;
do $$ begin
  alter table public.receipt_drafts add constraint receipt_drafts_review_decisions_array check (jsonb_typeof(review_decisions)='array');
exception when duplicate_object then null; end $$;

create or replace function public.import_retailer_catalog_v1(p_manifest jsonb,p_products jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p jsonb; imported integer:=0; manifest_id uuid;
begin
  if p_manifest->>'retailer' not in ('mercadona','dia','lidl','carrefour','eroski')
    or coalesce((p_manifest->>'schema_version')::integer,0)<>1
    or nullif(p_manifest->>'source','') is null
    or (p_manifest->>'sha256') !~ '^[0-9a-f]{64}$'
    or p_manifest->>'completeness' not in ('complete','partial','unverified')
    or jsonb_typeof(p_products)<>'array' or jsonb_array_length(p_products)=0
    or (p_manifest->>'product_count')::integer<>jsonb_array_length(p_products) then
    raise exception 'INVALID_CATALOG';
  end if;
  -- p_products is the transaction-local staging set: validate every row before
  -- creating the manifest or changing the active catalog.
  for p in select value from jsonb_array_elements(p_products) loop
    if nullif(btrim(p->>'display_name'),'') is null or (nullif(p->>'retailer_product_id','') is null and nullif(p->>'barcode','') is null) then
      raise exception 'INVALID_CATALOG_PRODUCT';
    end if;
  end loop;
  insert into public.catalog_manifests(retailer,schema_version,source,captured_at,fetched_at,sha256,completeness,product_count)
  values(p_manifest->>'retailer',(p_manifest->>'schema_version')::integer,p_manifest->>'source',(p_manifest->>'captured_at')::timestamptz,
    nullif(p_manifest->>'fetched_at','')::timestamptz,p_manifest->>'sha256',p_manifest->>'completeness',(p_manifest->>'product_count')::integer)
  on conflict(retailer,sha256) do update set imported_at=public.catalog_manifests.imported_at
  returning id into manifest_id;
  for p in select value from jsonb_array_elements(p_products) loop
    if p->>'retailer_product_id' is not null then
      insert into public.commercial_products(retailer,retailer_product_id,barcode,display_name,source,fetched_at,provenance,catalog_manifest_id)
      values(p->>'retailer',p->>'retailer_product_id',nullif(p->>'barcode',''),p->>'display_name','retailer_catalog',
        nullif(p_manifest->>'fetched_at','')::timestamptz,p->'provenance',manifest_id)
      on conflict(retailer,retailer_product_id) where retailer_product_id is not null do update set
        barcode=coalesce(excluded.barcode,public.commercial_products.barcode),display_name=excluded.display_name,
        fetched_at=excluded.fetched_at,provenance=excluded.provenance,catalog_manifest_id=excluded.catalog_manifest_id,updated_at=now();
    else
      insert into public.commercial_products(retailer,barcode,display_name,source,fetched_at,provenance,catalog_manifest_id)
      values(p->>'retailer',p->>'barcode',p->>'display_name','retailer_catalog',nullif(p_manifest->>'fetched_at','')::timestamptz,p->'provenance',manifest_id)
      on conflict(barcode) where barcode is not null do update set display_name=excluded.display_name,fetched_at=excluded.fetched_at,
        provenance=excluded.provenance,catalog_manifest_id=excluded.catalog_manifest_id,updated_at=now();
    end if;
    imported:=imported+1;
  end loop;
  return jsonb_build_object('imported',imported,'rejected',0,'manifestId',manifest_id);
end $$;
revoke all on function public.import_retailer_catalog_v1(jsonb,jsonb) from public;
grant execute on function public.import_retailer_catalog_v1(jsonb,jsonb) to service_role;

create or replace function public.confirm_receipt_draft_v2(
  p_draft_id uuid, p_normalizer_version text, p_lines jsonb, p_purchase_date date, p_payload_hash text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid := auth.uid(); v public.receipt_drafts%rowtype; d jsonb; original jsonb; ids uuid[] := '{}'::uuid[];
  v_item_id uuid; v_line_id text; v_name text; v_concept uuid; v_location text; v_date_source text; v_pending int := 0;
  v_quantity_exact boolean; v_suggested_location text; v_shelf_days integer; v_hash text;
begin
  if v_uid is null then return jsonb_build_object('code','AUTH_REQUIRED'); end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 or p_purchase_date is null
    or p_purchase_date > (now() at time zone 'UTC')::date + 1 then return jsonb_build_object('code','VALIDATION_ERROR'); end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_object('draftId',p_draft_id,'normalizerVersion',p_normalizer_version,'lines',p_lines,'purchaseDate',p_purchase_date,'transportHash',coalesce(p_payload_hash,''))::text,'UTF8'),'sha256'),'hex');
  select * into v from public.receipt_drafts where id=p_draft_id and user_id=v_uid for update;
  if not found then return jsonb_build_object('code','DRAFT_NOT_FOUND'); end if;
  if v.confirmed_at is not null then
    if v.confirmation_payload_hash = v_hash then
      return jsonb_build_object('itemIds',to_jsonb(v.confirmed_item_ids),'pendingCount',
        (select count(*) from public.inventory_items where user_id=v_uid and receipt_draft_id=p_draft_id and normalization_status='unknown' and deleted_at is null));
    end if;
    return jsonb_build_object('code','DRAFT_STATE_CONFLICT');
  end if;
  if v.status <> 'review' or v.normalizer_version is distinct from p_normalizer_version then return jsonb_build_object('code','DRAFT_STATE_CONFLICT'); end if;
  if (select count(*) from jsonb_array_elements(p_lines) x) <> (select count(distinct x->>'lineId') from jsonb_array_elements(p_lines) x) then return jsonb_build_object('code','VALIDATION_ERROR'); end if;
  -- Validate the complete plan before the first domain write. A returned error must
  -- never leave an earlier line committed.
  for d in select value from jsonb_array_elements(p_lines) loop
    v_line_id := d->>'lineId';
    select value into original from jsonb_array_elements(v.original_lines) where value->>'lineId'=v_line_id;
    if original is null or d->>'decision' not in ('accept','unknown','omit') then return jsonb_build_object('code','VALIDATION_ERROR'); end if;
    if d->>'decision'='omit' then continue; end if;
    v_name := btrim(coalesce(nullif(d->>'displayName',''), nullif(original->>'name',''), original->>'rawText'));
    if char_length(v_name) not between 1 and 120 then return jsonb_build_object('code','VALIDATION_ERROR'); end if;
    v_concept := null;
    if d->>'decision'='accept' then
      v_concept := nullif(d->>'foodConceptId','')::uuid;
      if v_concept is null or not exists (select 1 from public.food_concepts where id=v_concept) then return jsonb_build_object('code','VALIDATION_ERROR'); end if;
    elsif d ? 'foodConceptId' then return jsonb_build_object('code','VALIDATION_ERROR');
    end if;
    v_location := nullif(d->>'location','');
    if v_location is not null and v_location not in ('fridge','pantry','freezer') then return jsonb_build_object('code','VALIDATION_ERROR'); end if;
    if original->>'quantityExplicit'='true' and (original->>'quantityEvidence' is distinct from 'explicit_prefix'
      or nullif(original->>'quantity','') is null or (original->>'quantity')::numeric<=0
      or lower(coalesce(original->>'unit','')) not in ('unit','ud','uds','unidad','unidades','kg','g','l','ml','cl','pack')) then
      return jsonb_build_object('code','VALIDATION_ERROR');
    end if;
  end loop;
  for d in select value from jsonb_array_elements(p_lines) loop
    if d->>'decision'='omit' then continue; end if;
    v_line_id := d->>'lineId';
    select value into original from jsonb_array_elements(v.original_lines) where value->>'lineId'=v_line_id;
    v_name := btrim(coalesce(nullif(d->>'displayName',''), nullif(original->>'name',''), original->>'rawText'));
    v_concept := case when d->>'decision'='accept' then nullif(d->>'foodConceptId','')::uuid else null end;
    v_location := nullif(d->>'location','');
    v_date_source := case when v.purchase_date=p_purchase_date then 'receipt' else 'user' end;
    v_quantity_exact:=original->>'quantityExplicit'='true' and original->>'quantityEvidence'='explicit_prefix';
    select suggested_location,shelf_life_days into v_suggested_location,v_shelf_days from public.food_concepts where id=v_concept;
    v_item_id := (substr(md5(p_draft_id::text||':'||v_line_id),1,8)||'-'||substr(md5(p_draft_id::text||':'||v_line_id),9,4)||'-4'||substr(md5(p_draft_id::text||':'||v_line_id),14,3)||'-a'||substr(md5(p_draft_id::text||':'||v_line_id),18,3)||'-'||substr(md5(p_draft_id::text||':'||v_line_id),21,12))::uuid;
    insert into public.inventory_items(id,user_id,name,normalized_name,expiry_date,quantity,unit,notes,added_at,
      raw_name,raw_text,retailer,receipt_draft_id,receipt_line_id,normalizer_version,food_concept_id,
      stock_mode,stock_state,quantity_precision,quantity_exact,quantity_unit,receipt_quantity_evidence,
      freshness_precision,freshness_source,freshness_estimated_days,acquired_on,acquired_on_source,
      normalization_status,normalization_source,knowledge_provenance,location,location_confirmed)
    values(v_item_id,v_uid,v_name,public.r1_normalize_text(v_name),null,0,'unit',null,now(),coalesce(original->>'name',original->>'rawText'),original->>'rawText',v.retailer,
      p_draft_id,v_line_id,p_normalizer_version,v_concept,
      case when v_quantity_exact then 'exact' else 'presence' end,case when v_quantity_exact then null else 'present' end,
      case when v_quantity_exact then 'exact' else 'unknown' end,case when v_quantity_exact then (original->>'quantity')::numeric else null end,
      case when v_quantity_exact then lower(original->>'unit') else null end,
      jsonb_build_object('rawQuantity',original->>'quantity','rawUnit',original->>'unit','explicit',v_quantity_exact,'evidence',original->>'quantityEvidence'),
      case when v_shelf_days is not null then 'estimated' else 'unknown' end,case when v_shelf_days is not null then 'catalog' else null end,v_shelf_days,
      p_purchase_date,v_date_source,
      case when v_concept is null then 'unknown' else 'confirmed' end,case when v_concept is null then null else 'user' end,case when v_concept is null then 'receipt' else 'user' end,
      coalesce(v_location,v_suggested_location),
      v_location is not null)
    on conflict (user_id,receipt_draft_id,receipt_line_id) where receipt_draft_id is not null and receipt_line_id is not null do nothing;
    if d->>'decision'='accept' or public.r1_normalize_text(v_name)<>public.r1_normalize_text(coalesce(original->>'name',original->>'rawText')) then
      insert into public.user_product_mappings(user_id,retailer,normalized_raw_name,food_concept_id,display_name)
      values(v_uid,v.retailer,public.r1_normalize_text(coalesce(original->>'name',original->>'rawText')),v_concept,v_name)
      on conflict(user_id,retailer,normalized_raw_name) do update set food_concept_id=excluded.food_concept_id,display_name=excluded.display_name,
        confirmed_by_user=true,version=public.user_product_mappings.version+1,updated_at=now();
    end if;
    ids := array_append(ids,v_item_id); if v_concept is null then v_pending := v_pending+1; end if;
  end loop;
  if cardinality(ids)=0 then return jsonb_build_object('code','VALIDATION_ERROR'); end if;
  update public.receipt_drafts set status='confirmed',confirmed=true,confirmed_at=now(),confirmed_item_ids=ids,
    confirmation_payload_hash=v_hash,edited_lines=p_lines,review_decisions=p_lines,updated_at=now() where id=p_draft_id;
  return jsonb_build_object('itemIds',to_jsonb(ids),'pendingCount',v_pending);
exception when invalid_text_representation or check_violation or not_null_violation or raise_exception then
  return jsonb_build_object('code','VALIDATION_ERROR');
end $$;

create or replace function public.resolve_receipt_line_v2(
  p_draft_id uuid,p_line_id text,p_client_mutation_id uuid,p_expected_version bigint,p_decision text,
  p_food_concept_id uuid,p_display_name text,p_request_hash text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_item public.inventory_items%rowtype; v_existing public.receipt_line_mutations%rowtype; v_result jsonb; v_hash text;
begin
  if v_uid is null then return jsonb_build_object('code','AUTH_REQUIRED'); end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_object('draftId',p_draft_id,'lineId',p_line_id,'mutationId',p_client_mutation_id,'expectedVersion',p_expected_version,'decision',p_decision,'foodConceptId',p_food_concept_id,'displayName',p_display_name,'transportHash',coalesce(p_request_hash,''))::text,'UTF8'),'sha256'),'hex');
  -- Serialize all deliveries of the same mutation before inspecting either the
  -- ledger or the item, then re-check the ledger under that lock.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text||':'||p_client_mutation_id::text, 0));
  select * into v_existing from public.receipt_line_mutations where user_id=v_uid and client_mutation_id=p_client_mutation_id;
  if found then return case when v_existing.request_hash=v_hash then v_existing.result else jsonb_build_object('code','SYNC_CONFLICT') end; end if;
  select * into v_item from public.inventory_items where user_id=v_uid and receipt_draft_id=p_draft_id and receipt_line_id=p_line_id
    and normalization_status='unknown' and deleted_at is null for update;
  if not found then return jsonb_build_object('code','FORBIDDEN'); end if;
  if v_item.version<>p_expected_version then return jsonb_build_object('code','SYNC_CONFLICT','item',to_jsonb(v_item)); end if;
  if p_decision not in ('omit','resolve') or (p_decision='resolve' and (char_length(btrim(p_display_name)) not between 1 and 120
    or p_food_concept_id is null or not exists(select 1 from public.food_concepts where id=p_food_concept_id))) then return jsonb_build_object('code','VALIDATION_ERROR'); end if;
  if p_decision='omit' then
    update public.inventory_items set deleted_at=now() where id=v_item.id returning * into v_item;
  elsif p_decision='resolve' then
    update public.inventory_items set name=btrim(p_display_name),normalized_name=public.r1_normalize_text(p_display_name),food_concept_id=p_food_concept_id,
      normalization_status=case when p_food_concept_id is null then 'unknown' else 'confirmed' end,
      normalization_source=case when p_food_concept_id is null then null else 'user' end,knowledge_provenance='user'
      where id=v_item.id returning * into v_item;
    insert into public.user_product_mappings(user_id,retailer,normalized_raw_name,food_concept_id,display_name)
      values(v_uid,v_item.retailer,public.r1_normalize_text(v_item.raw_name),p_food_concept_id,btrim(p_display_name))
      on conflict (user_id,retailer,normalized_raw_name) do update set food_concept_id=excluded.food_concept_id,
        display_name=excluded.display_name,confirmed_by_user=true,version=public.user_product_mappings.version+1,updated_at=now();
  else return jsonb_build_object('code','VALIDATION_ERROR'); end if;
  v_result:=jsonb_build_object('code','OK','item',to_jsonb(v_item));
  insert into public.receipt_line_mutations(user_id,client_mutation_id,draft_id,line_id,request_hash,result)
    values(v_uid,p_client_mutation_id,p_draft_id,p_line_id,v_hash,v_result);
  return v_result;
end $$;

revoke all on function public.confirm_receipt_draft_v2(uuid,text,jsonb,date,text), public.resolve_receipt_line_v2(uuid,text,uuid,bigint,text,uuid,text,text) from public;
grant execute on function public.confirm_receipt_draft_v2(uuid,text,jsonb,date,text), public.resolve_receipt_line_v2(uuid,text,uuid,bigint,text,uuid,text,text) to authenticated;

create or replace function public.apply_pantry_mutation_v3(
  p_client_mutation_id uuid,p_item_id uuid,p_expected_version bigint,p_payload jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); existing public.client_mutations%rowtype; item public.inventory_items%rowtype; result jsonb;
begin
  if v_uid is null then return jsonb_build_object('client_mutation_id',p_client_mutation_id,'status','rejected','code','AUTH_REQUIRED','item',null); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text||':'||p_client_mutation_id::text,0));
  select * into existing from public.client_mutations where user_id=v_uid and client_mutation_id=p_client_mutation_id;
  if found then return jsonb_build_object('client_mutation_id',p_client_mutation_id,'status','duplicate','code',existing.code,'item',existing.result_item); end if;
  if p_expected_version is null or p_expected_version<1 or jsonb_typeof(p_payload)<>'object'
    or (p_payload ? 'name' and char_length(btrim(p_payload->>'name')) not between 1 and 120)
    or (p_payload ? 'location' and nullif(p_payload->>'location','') is not null and p_payload->>'location' not in ('fridge','pantry','freezer'))
    or (p_payload ? 'stock_mode' and p_payload->>'stock_mode' not in ('qualitative','exact'))
    or (p_payload->>'stock_mode'='qualitative' and p_payload->>'stock_state' not in ('plenty','some','low','empty'))
    or (p_payload->>'stock_mode'='exact' and (coalesce((p_payload->>'quantity_exact')::numeric,-1)<0 or nullif(btrim(p_payload->>'quantity_unit'),'') is null))
    or (p_payload ? 'expiry_date_exact' and nullif(p_payload->>'expiry_date_exact','') is not null and (p_payload->>'expiry_date_exact') !~ '^\d{4}-\d{2}-\d{2}$') then
    return jsonb_build_object('client_mutation_id',p_client_mutation_id,'status','rejected','code','VALIDATION_ERROR','item',null);
  end if;
  if p_payload ? 'food_concept_id' and nullif(p_payload->>'food_concept_id','') is not null
    and not exists(select 1 from public.food_concepts where id=(p_payload->>'food_concept_id')::uuid) then
    return jsonb_build_object('client_mutation_id',p_client_mutation_id,'status','rejected','code','VALIDATION_ERROR','item',null);
  end if;
  select * into item from public.inventory_items where id=p_item_id and user_id=v_uid for update;
  if not found then return jsonb_build_object('client_mutation_id',p_client_mutation_id,'status','rejected','code','FORBIDDEN','item',null); end if;
  if item.version<>p_expected_version or item.deleted_at is not null then
    result:=jsonb_build_object('client_mutation_id',p_client_mutation_id,'status','conflict','code','SYNC_CONFLICT','item',to_jsonb(item));
  else
    update public.inventory_items set
      name=case when p_payload ? 'name' then btrim(p_payload->>'name') else name end,
      normalized_name=case when p_payload ? 'name' then public.r1_normalize_text(p_payload->>'name') else normalized_name end,
      notes=case when p_payload ? 'notes' then nullif(p_payload->>'notes','') else notes end,
      location=case when p_payload ? 'location' then nullif(p_payload->>'location','') else location end,
      location_confirmed=case when p_payload ? 'location' then true else location_confirmed end,
      stock_mode=case when p_payload ? 'stock_mode' then p_payload->>'stock_mode' else stock_mode end,
      stock_state=case when p_payload->>'stock_mode'='exact' then case when (p_payload->>'quantity_exact')::numeric=0 then 'empty' else null end when p_payload ? 'stock_state' then p_payload->>'stock_state' else stock_state end,
      quantity_precision=case when p_payload->>'stock_mode'='exact' then 'exact' when p_payload->>'stock_mode'='qualitative' then 'unknown' else quantity_precision end,
      quantity_exact=case when p_payload->>'stock_mode'='exact' then (p_payload->>'quantity_exact')::numeric when p_payload->>'stock_mode'='qualitative' then null else quantity_exact end,
      quantity_unit=case when p_payload->>'stock_mode'='exact' then btrim(p_payload->>'quantity_unit') when p_payload->>'stock_mode'='qualitative' then null else quantity_unit end,
      freshness_precision=case when p_payload ? 'expiry_date_exact' then case when nullif(p_payload->>'expiry_date_exact','') is null then 'unknown' else 'exact' end else freshness_precision end,
      freshness_source=case when p_payload ? 'expiry_date_exact' then case when nullif(p_payload->>'expiry_date_exact','') is null then null else 'user' end else freshness_source end,
      freshness_estimated_days=case when p_payload ? 'expiry_date_exact' then null else freshness_estimated_days end,
      expiry_date_exact=case when p_payload ? 'expiry_date_exact' then nullif(p_payload->>'expiry_date_exact','')::date else expiry_date_exact end
      ,food_concept_id=case when p_payload ? 'food_concept_id' then nullif(p_payload->>'food_concept_id','')::uuid else food_concept_id end
      ,normalization_status=case when p_payload ? 'food_concept_id' then case when nullif(p_payload->>'food_concept_id','') is null then 'unknown' else 'confirmed' end else normalization_status end
      ,normalization_source=case when p_payload ? 'food_concept_id' then case when nullif(p_payload->>'food_concept_id','') is null then null else 'user' end else normalization_source end
      ,knowledge_provenance=case when p_payload ? 'food_concept_id' then 'user' else knowledge_provenance end
    where id=p_item_id returning * into item;
    if p_payload ? 'food_concept_id' and item.raw_name is not null then
      insert into public.user_product_mappings(user_id,retailer,normalized_raw_name,food_concept_id,display_name)
      values(v_uid,item.retailer,public.r1_normalize_text(item.raw_name),item.food_concept_id,item.name)
      on conflict(user_id,retailer,normalized_raw_name) do update set food_concept_id=excluded.food_concept_id,display_name=excluded.display_name,
        confirmed_by_user=true,version=public.user_product_mappings.version+1,updated_at=now();
    end if;
    result:=jsonb_build_object('client_mutation_id',p_client_mutation_id,'status','applied','code','OK','item',to_jsonb(item));
  end if;
  insert into public.client_mutations(user_id,client_mutation_id,operation,item_id,expected_version,payload,status,code,result_item)
  values(v_uid,p_client_mutation_id,'update',p_item_id,p_expected_version,p_payload,result->>'status',result->>'code',result->'item');
  return result;
exception when invalid_text_representation or datetime_field_overflow or numeric_value_out_of_range or check_violation then
  return jsonb_build_object('client_mutation_id',p_client_mutation_id,'status','rejected','code','VALIDATION_ERROR','item',null);
end $$;
revoke all on function public.apply_pantry_mutation_v3(uuid,uuid,bigint,jsonb) from public;
grant execute on function public.apply_pantry_mutation_v3(uuid,uuid,bigint,jsonb) to authenticated;

create or replace function public.inventory_server_fields()
returns trigger language plpgsql set search_path='' as $$
begin
  new.version:=old.version+1; new.updated_at:=clock_timestamp();
  if old.deleted_at is not null and not (current_user='postgres' and new.deleted_at is null) then new.deleted_at:=old.deleted_at; end if;
  return new;
end $$;

create or replace function public.restore_inventory_item_v3(p_client_mutation_id uuid,p_item_id uuid,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); existing public.client_mutations%rowtype; item public.inventory_items%rowtype; result jsonb;
begin
  if v_uid is null then return jsonb_build_object('client_mutation_id',p_client_mutation_id,'status','rejected','code','AUTH_REQUIRED','item',null); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text||':'||p_client_mutation_id::text,0));
  select * into existing from public.client_mutations where user_id=v_uid and client_mutation_id=p_client_mutation_id;
  if found then return jsonb_build_object('client_mutation_id',p_client_mutation_id,'status','duplicate','code',existing.code,'item',existing.result_item); end if;
  select * into item from public.inventory_items where id=p_item_id and user_id=v_uid for update;
  if not found then result:=jsonb_build_object('client_mutation_id',p_client_mutation_id,'status','rejected','code','FORBIDDEN','item',null);
  elsif item.version<>p_expected_version or item.deleted_at is null then result:=jsonb_build_object('client_mutation_id',p_client_mutation_id,'status','conflict','code','SYNC_CONFLICT','item',to_jsonb(item));
  else update public.inventory_items set deleted_at=null where id=p_item_id returning * into item; result:=jsonb_build_object('client_mutation_id',p_client_mutation_id,'status','applied','code','OK','item',to_jsonb(item)); end if;
  insert into public.client_mutations(user_id,client_mutation_id,operation,item_id,expected_version,payload,status,code,result_item)
  values(v_uid,p_client_mutation_id,'update',p_item_id,p_expected_version,'{"restore":true}'::jsonb,result->>'status',result->>'code',result->'item');
  return result;
end $$;
revoke all on function public.restore_inventory_item_v3(uuid,uuid,bigint) from public;
grant execute on function public.restore_inventory_item_v3(uuid,uuid,bigint) to authenticated;
