-- R3. Private imports remain jobs/revisions, never global catalog rows.
alter table public.shopping_list_items add column source text, add column source_ref text;
alter table public.shopping_list_items add constraint cook_shopping_origin check
 (source is null or (source='recipe_missing' and source_ref ~ '^(catalog|import):[0-9a-f-]{36}$'));
create unique index cook_shopping_one_active on public.shopping_list_items
 (user_id,source_ref,ingredient_key,coalesce(unit,'')) where deleted_at is null and source='recipe_missing';

create table public.cook_availability_cache (
 user_id uuid not null references auth.users(id) on delete cascade,
 snapshot_key uuid primary key default extensions.gen_random_uuid(), kind text not null check(kind in ('catalog','import')),
 recipe_id uuid not null, recipe_version text not null, state_key text not null,
 result jsonb not null, created_at timestamptz not null default now(), expires_at timestamptz not null,
 check(expires_at<=created_at+interval '60 minutes'), unique(user_id,kind,recipe_id,state_key)
);
create table public.cook_mutations (
 user_id uuid not null references auth.users(id) on delete cascade, client_mutation_id uuid not null,
 payload jsonb not null, result jsonb not null, created_at timestamptz not null default now(), primary key(user_id,client_mutation_id)
);
alter table public.cook_availability_cache enable row level security;
alter table public.cook_mutations enable row level security;
create policy cook_cache_own on public.cook_availability_cache for select to authenticated using(user_id=auth.uid());
create policy cook_mutations_own on public.cook_mutations for select to authenticated using(user_id=auth.uid());
revoke all on public.cook_availability_cache,public.cook_mutations from anon,authenticated;
grant select on public.cook_availability_cache,public.cook_mutations to authenticated;
grant all on public.cook_availability_cache,public.cook_mutations to service_role;

create function public.cook_recipe_for_user_v1(p_uid uuid,p_kind text,p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb; v_job public.recipe_import_jobs%rowtype; v_raw jsonb;
begin
 if p_kind='catalog' then
  select jsonb_build_object('title',r.name,'steps',to_jsonb(regexp_split_to_array(r.instructions,E'\n')),
   'ingredients',(select jsonb_agg(jsonb_build_object('name',i.name,'normalizedName',i.normalized_name,'measure',i.measure,'foodConceptId',i.food_concept_id) order by i.position,i.id) from public.recipe_ingredients i where i.recipe_id=r.id),
   'reviewRequired',false,'sourceUrl',null,'provenance',r.metadata) into v_result
  from public.recipes r join public.catalog_versions c on c.id=r.catalog_version_id and c.active where r.id=p_id;
 elsif p_kind='import' then
  select * into v_job from public.recipe_import_jobs where id=p_id and user_id=p_uid and state='completed';
  if not found then return null; end if;
  select result into v_raw from public.recipe_import_revisions where job_id=p_id and user_id=p_uid order by version desc limit 1;
  v_raw:=coalesce(v_raw,v_job.result);
  if v_raw->>'schemaVersion' is distinct from 'recipe-v1' then return jsonb_build_object('invalid',true); end if;
  if jsonb_typeof(v_raw->'ingredients') is distinct from 'array' or jsonb_typeof(v_raw->'steps') is distinct from 'array' then return jsonb_build_object('invalid',true); end if;
  if jsonb_array_length(v_raw->'ingredients') not between 1 and 200 or jsonb_array_length(v_raw->'steps') not between 1 and 100
   or jsonb_typeof(v_raw->'title') is distinct from 'string' or length(btrim(coalesce(v_raw->>'title',''))) not between 1 and 200
   or exists(select 1 from jsonb_array_elements(v_raw->'ingredients') i where jsonb_typeof(i->'name') is distinct from 'string' or length(btrim(i->>'name')) not between 1 and 200
      or (i->'amount' is not null and i->'amount'<>'null'::jsonb and jsonb_typeof(i->'amount')<>'string')
      or (i->'unit' is not null and i->'unit'<>'null'::jsonb and jsonb_typeof(i->'unit')<>'string'))
   or exists(select 1 from jsonb_array_elements(v_raw->'steps') s where jsonb_typeof(s) is distinct from 'string' or length(btrim(s#>>'{}')) not between 1 and 2000)
   then return jsonb_build_object('invalid',true); end if;
  v_result:=jsonb_build_object('title',v_raw->>'title','steps',v_raw->'steps',
   'ingredients',(select jsonb_agg(jsonb_build_object('name',i->>'name','measure',nullif(btrim(concat_ws(' ',nullif(i->>'amount',''),nullif(i->>'unit',''))),''),'originalAmount',i->>'amount','originalUnit',i->>'unit','foodConceptId',null) order by n) from jsonb_array_elements(v_raw->'ingredients') with ordinality a(i,n)),
   'sourceUrl',v_raw#>>'{source,url}','reviewRequired',coalesce(v_raw#>>'{provenance,quality,status}'='review_required',false),'provenance',v_raw->'provenance');
 else return null; end if;
 if v_result is null then return null; end if;
 if v_result->'ingredients' is null or v_result->'ingredients'='null'::jsonb or length(btrim(coalesce(v_result->>'title','')))=0 then return jsonb_build_object('invalid',true); end if;
 return v_result||jsonb_build_object('recipeRef',jsonb_build_object('kind',p_kind,'id',p_id),'recipeVersion',encode(extensions.digest(convert_to(v_result::text,'UTF8'),'sha256'),'hex'));
end $$;

create function public.cook_state_key_v1(p_uid uuid,p_kind text,p_id uuid) returns text
language sql stable security definer set search_path='' as $$
 select encode(extensions.digest(convert_to(jsonb_build_object('engine','cook-r3-v1','date',current_date,'recipe',public.cook_recipe_for_user_v1(p_uid,p_kind,p_id),
 'catalogRevision',(select revision from public.today_catalog_revision where singleton),
 'pantry',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.inventory_items i where user_id=p_uid),'[]'::jsonb))::text,'UTF8'),'sha256'),'hex')
$$;

create function public.cook_lock_v1() returns void language plpgsql volatile security definer set search_path='' as $$
begin
 -- Serialize before R2 takes SHARE on favorites. Otherwise a second reader
 -- could hold that SHARE while waiting on Today cache, blocking this save.
 lock table public.favorite_recipes in share row exclusive mode;
 perform public.today_lock_snapshot_v1();
 lock table public.recipe_import_jobs in share mode;
 lock table public.recipe_import_revisions in share mode;
 lock table public.cook_availability_cache in share row exclusive mode;
end $$;

create function public.read_cook_context_v1(p_kind text,p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_recipe jsonb; v_key text; v_cache jsonb;
begin
 if auth.uid() is null then return jsonb_build_object('error','AUTH_REQUIRED'); end if;
 perform public.cook_lock_v1();
 v_recipe:=public.cook_recipe_for_user_v1(auth.uid(),p_kind,p_id);
 if v_recipe is null then return jsonb_build_object('error','RECIPE_NOT_FOUND'); end if;
 if coalesce((v_recipe->>'invalid')::boolean,false) then return jsonb_build_object('error','RECIPE_INVALID'); end if;
 v_key:=public.cook_state_key_v1(auth.uid(),p_kind,p_id);
 select result into v_cache from public.cook_availability_cache where user_id=auth.uid() and kind=p_kind and recipe_id=p_id and state_key=v_key and expires_at>statement_timestamp();
 return jsonb_build_object('recipe',v_recipe,'stateKey',v_key,'cached',v_cache,'date',current_date,
 'pantry',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.inventory_items i where user_id=auth.uid()),'[]'::jsonb),
 'concepts',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'displayName',c.display_name,'aliases',coalesce((select jsonb_agg(a.normalized_alias) from public.food_concept_aliases a where a.food_concept_id=c.id),'[]'::jsonb))) from public.food_concepts c),'[]'::jsonb));
end $$;

create function public.store_cook_cache_v1(p_uid uuid,p_kind text,p_id uuid,p_state_key text,p_version text,p_result jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_cache public.cook_availability_cache%rowtype;
begin
 perform public.cook_lock_v1();
 if public.cook_state_key_v1(p_uid,p_kind,p_id) is distinct from p_state_key then return jsonb_build_object('error','SNAPSHOT_CONFLICT'); end if;
 insert into public.cook_availability_cache(user_id,kind,recipe_id,recipe_version,state_key,result,created_at,expires_at)
 values(p_uid,p_kind,p_id,p_version,p_state_key,p_result,statement_timestamp(),statement_timestamp()+interval '60 minutes')
 on conflict(user_id,kind,recipe_id,state_key) do update set result=excluded.result,snapshot_key=extensions.gen_random_uuid(),created_at=excluded.created_at,expires_at=excluded.expires_at
 where public.cook_availability_cache.expires_at<=statement_timestamp();
 select * into v_cache from public.cook_availability_cache where user_id=p_uid and kind=p_kind and recipe_id=p_id and state_key=p_state_key;
 v_cache.result:=v_cache.result||jsonb_build_object('snapshotKey',v_cache.snapshot_key,'computedAt',v_cache.created_at,'expiresAt',v_cache.expires_at);
 update public.cook_availability_cache set result=v_cache.result where snapshot_key=v_cache.snapshot_key;
 return v_cache.result;
end $$;

-- SQL re-evaluates requirements independently of any web cache contents.
create function public.cook_missing_v1(p_uid uuid,p_recipe jsonb)
returns table(concept_id uuid,name text,quantity numeric,unit text) language sql stable security definer set search_path='' as $$
 with resolved as (
  select i->>'measure' measure,coalesce((select c.id from public.food_concepts c where c.id::text=i->>'foodConceptId'),exact_match.id) concept_id
  from jsonb_array_elements(p_recipe->'ingredients') i left join lateral (
   select min(id::text)::uuid id from (
    select c.id from public.food_concepts c where public.r1_normalize_text(c.display_name)=public.r1_normalize_text(coalesce(i->>'normalizedName',i->>'name'))
    union select a.food_concept_id from public.food_concept_aliases a where a.normalized_alias=public.r1_normalize_text(coalesce(i->>'normalizedName',i->>'name'))
   ) candidates having count(*)=1
  ) exact_match on true
 ), requirements as (
  select r.concept_id,count(*) filter(where p.quantity is null) unknown_count,count(distinct p.unit) unit_count,sum(p.quantity) required,min(p.unit) req_unit
  from resolved r left join lateral public.today_parse_measure_v1(r.measure) p on true where r.concept_id is not null group by r.concept_id
 ), evaluated as (
  select r.*,c.display_name,s.* from requirements r join public.food_concepts c on c.id=r.concept_id left join lateral (
   select count(*) positive,count(*) filter(where i.stock_mode<>'exact') unknown_stock,
    count(*) filter(where i.stock_mode='exact' and (p.unit is null or p.unit<>r.req_unit)) incompatible,
    coalesce(sum(p.quantity) filter(where p.unit=r.req_unit),0) available
   from public.inventory_items i left join lateral public.today_parse_measure_v1(i.quantity_exact::text||' '||i.quantity_unit) p on i.stock_mode='exact'
   where i.user_id=p_uid and i.food_concept_id=r.concept_id and i.deleted_at is null and i.normalization_status='confirmed'
    and ((i.stock_mode='presence' and i.stock_state='present') or(i.stock_mode='qualitative' and i.stock_state in('plenty','some','low')) or(i.stock_mode='exact' and i.quantity_exact>0 and i.stock_state is distinct from 'empty'))
  ) s on true
 ) select concept_id,display_name,
 case when positive>0 and unknown_count=0 and unit_count=1 then greatest(required-available,0) else null end,
 case when positive>0 and unknown_count=0 and unit_count=1 then req_unit else null end
 from evaluated where positive=0 or(unknown_count=0 and unit_count=1 and available<required and unknown_stock=0 and incompatible=0) order by concept_id
$$;

create function public.apply_cook_mutation_v1(p_operation text,p_kind text,p_id uuid,p_token text,p_mutation uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_payload jsonb; v_prior public.cook_mutations%rowtype; v_recipe jsonb; v_cache public.cook_availability_cache%rowtype;
 v_result jsonb; v_favorite public.favorite_recipes%rowtype; v_snapshot jsonb; v_source text; v_ids uuid[]:='{}'::uuid[]; v_item uuid; v_line record;
begin
 if v_uid is null then return jsonb_build_object('error','AUTH_REQUIRED'); end if;
 if p_operation is null or p_kind is null or p_operation not in('shopping','save') or p_kind not in('catalog','import') or p_id is null or p_token is null or p_mutation is null then return jsonb_build_object('error','INVALID_REQUEST'); end if;
 v_payload:=jsonb_build_object('operation',p_operation,'kind',p_kind,'id',p_id,'token',p_token);
 perform pg_advisory_xact_lock(hashtextextended('cook:'||v_uid::text,0));
 select * into v_prior from public.cook_mutations where user_id=v_uid and client_mutation_id=p_mutation;
 if found then
  if v_prior.payload<>v_payload then return jsonb_build_object('error','MUTATION_CONFLICT'); end if;
  return jsonb_build_object('contract','cook-mutation-v1','status','duplicate','result',v_prior.result);
 end if;
 perform public.cook_lock_v1();
 v_recipe:=public.cook_recipe_for_user_v1(v_uid,p_kind,p_id);
 if v_recipe is null then return jsonb_build_object('error','RECIPE_NOT_FOUND'); end if;
 if coalesce((v_recipe->>'invalid')::boolean,false) then return jsonb_build_object('error','RECIPE_INVALID'); end if;
 v_source:=p_kind||':'||p_id::text;
 if p_operation='shopping' then
  select * into v_cache from public.cook_availability_cache where user_id=v_uid and snapshot_key=p_token::uuid and kind=p_kind and recipe_id=p_id and expires_at>statement_timestamp();
  if not found or v_cache.state_key is distinct from public.cook_state_key_v1(v_uid,p_kind,p_id) then return jsonb_build_object('error','SNAPSHOT_CONFLICT'); end if;
  for v_line in select * from public.cook_missing_v1(v_uid,v_recipe) loop
   insert into public.shopping_list_items(user_id,ingredient_key,name,quantity,unit,source,source_ref)
    values(v_uid,v_line.concept_id::text,v_line.name,v_line.quantity,v_line.unit,'recipe_missing',v_source)
    on conflict(user_id,source_ref,ingredient_key,(coalesce(unit,''))) where deleted_at is null and source='recipe_missing' do nothing returning id into v_item;
   if v_item is null then select id into v_item from public.shopping_list_items where user_id=v_uid and source_ref=v_source and source='recipe_missing' and deleted_at is null and ingredient_key=v_line.concept_id::text and coalesce(unit,'')=coalesce(v_line.unit,''); end if;
   v_ids:=array_append(v_ids,v_item);
  end loop;
  v_result:=jsonb_build_object('itemIds',to_jsonb(v_ids));
 else
  if v_recipe->>'recipeVersion'<>p_token then return jsonb_build_object('error','RECIPE_CONFLICT'); end if;
  -- Existing text recipe_id naturally namespaces imports; no fictitious catalog UUID.
  select * into v_favorite from public.favorite_recipes where user_id=v_uid and recipe_id=case when p_kind='catalog' then p_id::text else v_source end order by (deleted_at is null) desc,saved_at desc limit 1 for update;
  if found then
   if v_favorite.deleted_at is not null then update public.favorite_recipes set deleted_at=null,saved_at=now(),version=version+1,updated_at=now() where id=v_favorite.id returning * into v_favorite; end if;
  else
   v_snapshot:=jsonb_build_object('version',1,'title',v_recipe->>'title','instructions',v_recipe->'steps','recipeRef',v_recipe->'recipeRef','recipeVersion',v_recipe->>'recipeVersion','reviewRequired',v_recipe->'reviewRequired','provenance',v_recipe->'provenance','sourceUrl',v_recipe->'sourceUrl',
    'ingredients',(select jsonb_agg(jsonb_build_object('ingredientKey',public.r1_normalize_text(i->>'name'),'name',i->>'name','quantity',p.quantity,'unit',p.unit,'amount_status',case when p.quantity is null then 'unknown' else 'exact' end,'originalAmount',i->>'measure')) from jsonb_array_elements(v_recipe->'ingredients') i left join lateral public.today_parse_measure_v1(i->>'measure') p on true));
   insert into public.favorite_recipes(user_id,recipe_id,name,match_percentage,instructions,saved_at,snapshot)
    values(v_uid,case when p_kind='catalog' then p_id::text else v_source end,v_recipe->>'title',0,'',now(),v_snapshot) returning * into v_favorite;
  end if;
  v_result:=jsonb_build_object('favoriteId',v_favorite.id,'version',v_favorite.version);
 end if;
 insert into public.cook_mutations(user_id,client_mutation_id,payload,result) values(v_uid,p_mutation,v_payload,v_result);
 return jsonb_build_object('contract','cook-mutation-v1','status','applied','result',v_result);
exception when invalid_text_representation then return jsonb_build_object('error','INVALID_REQUEST');
end $$;

create function public.read_cook_library_v1() returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_pantry jsonb; v_concepts jsonb; v_catalog jsonb; v_jobs jsonb; v_saved jsonb;
begin
 if auth.uid() is null then return jsonb_build_object('error','AUTH_REQUIRED'); end if;
 perform public.cook_lock_v1();
 select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]'::jsonb) into v_pantry from public.inventory_items i where user_id=auth.uid();
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'displayName',c.display_name,'aliases',coalesce((select jsonb_agg(a.normalized_alias) from public.food_concept_aliases a where a.food_concept_id=c.id),'[]'::jsonb))),'[]'::jsonb) into v_concepts from public.food_concepts c;
 select coalesce(jsonb_agg(public.cook_recipe_for_user_v1(auth.uid(),'catalog',r.recipe_id)),'[]'::jsonb) into v_catalog from public.find_today_recipe_candidates_v1(250) r;
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'state',j.state,'sourceType',j.source_type,'errorCode',j.error_code,'retryable',j.retryable,'createdAt',j.created_at,'recipe',case when j.state='completed' then public.cook_recipe_for_user_v1(auth.uid(),'import',j.id) else null end) order by j.created_at desc,j.id desc),'[]'::jsonb) into v_jobs from public.recipe_import_jobs j where user_id=auth.uid() and not(j.provenance ? 'parentJobId');
 select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'recipeId',f.recipe_id,'snapshot',f.snapshot,'savedAt',f.saved_at) order by f.saved_at desc,f.id desc),'[]'::jsonb) into v_saved from public.favorite_recipes f where user_id=auth.uid() and deleted_at is null;
 return jsonb_build_object('pantry',v_pantry,'concepts',v_concepts,'catalog',v_catalog,'jobs',v_jobs,'saved',v_saved,'date',current_date,'catalogMissing',not exists(select 1 from public.catalog_versions where active));
end $$;

-- Only non-file sources can be retried: worker finally cleans temporary uploads.
alter table public.recipe_import_jobs add column retry_generation bigint not null default 0;
create function public.retry_recipe_import_v1(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_job public.recipe_import_jobs%rowtype;
begin
 select * into v_job from public.recipe_import_jobs where id=p_id and user_id=auth.uid() for update;
 if not found then return jsonb_build_object('error','JOB_NOT_FOUND'); end if;
 if v_job.state='queued' and v_job.retry_generation>0 then return jsonb_build_object('jobId',p_id,'generation',v_job.retry_generation,'replay',true); end if;
 if v_job.state<>'failed' or not v_job.retryable or v_job.source_type='file' or (v_job.source_url is null and nullif(btrim(v_job.manual_text),'') is null) then return jsonb_build_object('error','RETRY_NOT_AVAILABLE'); end if;
 update public.recipe_import_jobs set state='queued',retry_generation=retry_generation+1,error_code=null,worker_id=null,lease_expires_at=null,updated_at=now() where id=p_id returning * into v_job;
 return jsonb_build_object('jobId',p_id,'generation',v_job.retry_generation,'replay',false);
end $$;

revoke all on function public.cook_recipe_for_user_v1(uuid,text,uuid),public.cook_state_key_v1(uuid,text,uuid),public.cook_lock_v1(),public.read_cook_context_v1(text,uuid),public.store_cook_cache_v1(uuid,text,uuid,text,text,jsonb),public.cook_missing_v1(uuid,jsonb),public.apply_cook_mutation_v1(text,text,uuid,text,uuid),public.read_cook_library_v1(),public.retry_recipe_import_v1(uuid) from public,anon,authenticated;
grant execute on function public.read_cook_context_v1(text,uuid),public.apply_cook_mutation_v1(text,text,uuid,text,uuid),public.read_cook_library_v1(),public.retry_recipe_import_v1(uuid) to authenticated;
grant execute on function public.store_cook_cache_v1(uuid,text,uuid,text,text,jsonb) to service_role;
