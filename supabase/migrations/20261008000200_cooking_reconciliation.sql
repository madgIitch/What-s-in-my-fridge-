-- R4: private cooking plans and append-only consumption/compensation events.
create table public.cooking_v3_plans (
 id uuid primary key default extensions.gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in('catalog','import','favorite')), source_id uuid not null,
 recipe_version text not null, state_key text not null, result jsonb not null,
 created_at timestamptz not null default statement_timestamp(), expires_at timestamptz not null,
 check(expires_at<=created_at+interval '60 minutes')
);
create index cooking_v3_plans_context on public.cooking_v3_plans(user_id,kind,source_id,state_key);
create table public.cooking_v3_events (
 id uuid primary key default extensions.gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 source_ref jsonb not null, recipe_version text not null, recipe_snapshot jsonb not null,
 choices jsonb not null, changes jsonb not null, applied_at timestamptz not null default statement_timestamp(),
 undo_until timestamptz not null, compensates uuid unique references public.cooking_v3_events(id), result jsonb not null
);
create table public.cooking_v3_mutations (
 user_id uuid not null references auth.users(id) on delete cascade, client_mutation_id uuid not null,
 payload jsonb not null, result jsonb not null, primary key(user_id,client_mutation_id)
);
alter table public.cooking_v3_plans enable row level security;
alter table public.cooking_v3_events enable row level security;
alter table public.cooking_v3_mutations enable row level security;
create policy cooking_v3_plan_own on public.cooking_v3_plans for select to authenticated using(user_id=auth.uid());
create policy cooking_v3_event_own on public.cooking_v3_events for select to authenticated using(user_id=auth.uid());
create policy cooking_v3_mutation_own on public.cooking_v3_mutations for select to authenticated using(user_id=auth.uid());
revoke all on public.cooking_v3_plans,public.cooking_v3_events,public.cooking_v3_mutations from anon,authenticated;
grant select on public.cooking_v3_plans,public.cooking_v3_events,public.cooking_v3_mutations to authenticated;
grant all on public.cooking_v3_plans,public.cooking_v3_events,public.cooking_v3_mutations to service_role;

create function public.cooking_v3_source(p_uid uuid,p_kind text,p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r jsonb; s jsonb;
begin
 if p_kind in('catalog','import') then r:=public.cook_recipe_for_user_v1(p_uid,p_kind,p_id);
 elsif p_kind='favorite' then
  select snapshot into s from public.favorite_recipes where id=p_id and user_id=p_uid and deleted_at is null;
  if not found then return null; end if;
  if jsonb_typeof(s->'ingredients') is distinct from 'array' or jsonb_typeof(s->'instructions') is distinct from 'array' then return jsonb_build_object('invalid',true); end if;
  r:=jsonb_build_object('title',s->>'title','steps',s->'instructions','reviewRequired',coalesce((s->>'reviewRequired')::boolean,false),'sourceUrl',s->'sourceUrl','provenance',s->'provenance',
   'ingredients',(select jsonb_agg(jsonb_build_object('name',i->>'name','originalAmount',coalesce(i->>'originalAmount',(i->>'quantity')),'originalUnit',i->>'unit',
    'measure',case when i->>'amount_status'='exact' then concat_ws(' ',i->>'quantity',i->>'unit') else null end) order by n) from jsonb_array_elements(s->'ingredients') with ordinality x(i,n)),
   'recipeRef',jsonb_build_object('kind','catalog','id',p_id));
  r:=r||jsonb_build_object('recipeVersion',encode(extensions.digest(convert_to(s::text,'UTF8'),'sha256'),'hex'));
 else return null; end if;
 if r is null then return null; end if;
 if coalesce((r->>'invalid')::boolean,false) then return r; end if;
 if jsonb_typeof(r->'ingredients') is distinct from 'array' or jsonb_typeof(r->'steps') is distinct from 'array' then return jsonb_build_object('invalid',true); end if;
 if jsonb_array_length(r->'ingredients') not between 1 and 200 or jsonb_array_length(r->'steps') not between 1 and 100
  or length(btrim(coalesce(r->>'title',''))) not between 1 and 200
  or exists(select 1 from jsonb_array_elements(r->'ingredients') i where jsonb_typeof(i->'name') is distinct from 'string' or length(btrim(i->>'name')) not between 1 and 200)
  or exists(select 1 from jsonb_array_elements(r->'steps') i where jsonb_typeof(i) is distinct from 'string' or length(btrim(i#>>'{}')) not between 1 and 2000)
 then return jsonb_build_object('invalid',true); end if;
 return r;
end $$;

-- Compatible catalog locks, then inventory before any row locks. No lock
-- upgrades of R2/R3's SHARE inventory lock and no competing favorites table lock.
create function public.cooking_v3_lock(p_write boolean) returns void
language plpgsql volatile security definer set search_path='' as $$
begin
 lock table public.catalog_versions,public.recipes,public.recipe_ingredients,public.food_concepts,public.food_concept_aliases in share mode;
 if p_write then lock table public.inventory_items in row exclusive mode;
 else lock table public.inventory_items in share mode; end if;
 lock table public.recipe_import_jobs,public.recipe_import_revisions in share mode;
end $$;
create function public.cooking_v3_state(p_uid uuid,p_kind text,p_id uuid) returns text
language sql stable security definer set search_path='' as $$
 select encode(extensions.digest(convert_to(jsonb_build_object('engine','cooking-v3-1','recipe',public.cooking_v3_source(p_uid,p_kind,p_id),
 'catalogRevision',(select revision from public.today_catalog_revision where singleton),
 'pantry',coalesce((select jsonb_agg(to_jsonb(i) order by id) from public.inventory_items i where user_id=p_uid),'[]'::jsonb))::text,'UTF8'),'sha256'),'hex')
$$;
create function public.read_cooking_v3_context(p_kind text,p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare r jsonb;
begin
 if auth.uid() is null then return jsonb_build_object('error','AUTH_REQUIRED'); end if;
 if p_kind is null or p_kind not in('catalog','import','favorite') or p_id is null then return jsonb_build_object('error','INVALID_REQUEST'); end if;
 perform public.cooking_v3_lock(false);
 r:=public.cooking_v3_source(auth.uid(),p_kind,p_id);
 if r is null then return jsonb_build_object('error','SOURCE_NOT_FOUND'); end if;
 if coalesce((r->>'invalid')::boolean,false) then return jsonb_build_object('error','RECIPE_INVALID'); end if;
 return jsonb_build_object('recipe',r,'stateKey',public.cooking_v3_state(auth.uid(),p_kind,p_id),
 'pantry',coalesce((select jsonb_agg(to_jsonb(i) order by id) from public.inventory_items i where user_id=auth.uid()),'[]'::jsonb),
 'concepts',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'displayName',c.display_name,'aliases',coalesce((select jsonb_agg(a.normalized_alias) from public.food_concept_aliases a where a.food_concept_id=c.id),'[]'::jsonb))) from public.food_concepts c),'[]'::jsonb));
end $$;
create function public.store_cooking_v3_plan(p_uid uuid,p_kind text,p_id uuid,p_state text,p_result jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v public.cooking_v3_plans%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended('cooking-v3:'||p_uid::text,0));
 perform public.cooking_v3_lock(false);
 if public.cooking_v3_state(p_uid,p_kind,p_id) is distinct from p_state then return jsonb_build_object('error','PANTRY_CONFLICT'); end if;
 select * into v from public.cooking_v3_plans where user_id=p_uid and kind=p_kind and source_id=p_id and state_key=p_state and expires_at>statement_timestamp() order by created_at desc limit 1;
 if not found then
  insert into public.cooking_v3_plans(user_id,kind,source_id,recipe_version,state_key,result,expires_at)
  values(p_uid,p_kind,p_id,p_result->>'recipeVersion',p_state,p_result,statement_timestamp()+interval '60 minutes') returning * into v;
 end if;
 return v.result||jsonb_build_object('planKey',v.id,'computedAt',v.created_at,'expiresAt',v.expires_at);
end $$;

create function public.cooking_v3_stock(p_item public.inventory_items) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('stock_mode',p_item.stock_mode,'stock_state',p_item.stock_state,'quantity_precision',p_item.quantity_precision,
 'quantity_exact',p_item.quantity_exact,'quantity_unit',p_item.quantity_unit,'quantity',p_item.quantity,'unit',p_item.unit)
$$;
create function public.confirm_cooking_v3(p_plan uuid,p_mutation uuid,p_ack boolean,p_choices jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare uid uuid:=auth.uid(); payload jsonb; prior public.cooking_v3_mutations%rowtype; plan public.cooking_v3_plans%rowtype;
 recipe jsonb; line jsonb; choice jsonb; lot jsonb; item public.inventory_items%rowtype; before jsonb; after jsonb;
 changes jsonb:='[]'::jsonb; change jsonb; consumed numeric; remaining numeric; qty numeric; canonical numeric; canon_unit text;
 action text; new_state text; event_id uuid:=extensions.gen_random_uuid(); result jsonb; applied timestamptz:=statement_timestamp();
 used uuid[]:='{}'::uuid[]; expected_count integer; provenance text;
begin
 if uid is null then return jsonb_build_object('error','AUTH_REQUIRED'); end if;
 if p_plan is null or p_mutation is null or p_ack is null or jsonb_typeof(p_choices) is distinct from 'array' then return jsonb_build_object('error','INVALID_REQUEST'); end if;
 payload:=jsonb_build_object('operation','confirm','planKey',p_plan,'acknowledgeReview',p_ack,'choices',(select coalesce(jsonb_agg(c order by c->>'lineId'),'[]') from jsonb_array_elements(p_choices) c));
 perform pg_advisory_xact_lock(hashtextextended('cooking-v3:'||uid::text,0));
 select * into prior from public.cooking_v3_mutations where user_id=uid and client_mutation_id=p_mutation;
 if found then
  if prior.payload<>payload then return jsonb_build_object('error','MUTATION_CONFLICT'); end if;
  return prior.result||jsonb_build_object('status','duplicate');
 end if;
 perform public.cooking_v3_lock(true);
 perform 1 from public.inventory_items where user_id=uid order by id for update;
 select * into plan from public.cooking_v3_plans where id=p_plan and user_id=uid;
 if not found then return jsonb_build_object('error','SOURCE_NOT_FOUND'); end if;
 if plan.expires_at<=applied then return jsonb_build_object('error','PLAN_EXPIRED'); end if;
 if plan.kind='favorite' then perform 1 from public.favorite_recipes where id=plan.source_id and user_id=uid for share; end if;
 recipe:=public.cooking_v3_source(uid,plan.kind,plan.source_id);
 if recipe is null then return jsonb_build_object('error','SOURCE_NOT_FOUND'); end if;
 if coalesce((recipe->>'invalid')::boolean,false) then return jsonb_build_object('error','RECIPE_INVALID'); end if;
 if recipe->>'recipeVersion'<>plan.recipe_version then return jsonb_build_object('error','RECIPE_CONFLICT'); end if;
 if public.cooking_v3_state(uid,plan.kind,plan.source_id)<>plan.state_key then return jsonb_build_object('error','PANTRY_CONFLICT'); end if;
 if coalesce((recipe->>'reviewRequired')::boolean,false) and not p_ack then return jsonb_build_object('error','INVALID_REQUEST'); end if;
 expected_count:=jsonb_array_length(plan.result->'lines');
 if jsonb_array_length(p_choices)<>expected_count or (select count(distinct c->>'lineId') from jsonb_array_elements(p_choices)c)<>expected_count then return jsonb_build_object('error','INVALID_REQUEST'); end if;
 for line in select l from jsonb_array_elements(plan.result->'lines') l loop
  select c into choice from jsonb_array_elements(p_choices)c where c->>'lineId'=line->>'lineId';
  if choice is null or jsonb_typeof(choice) is distinct from 'object' then raise exception 'INVALID_REQUEST'; end if;
  action:=choice->>'action';
  if not coalesce((line->'allowedActions')?action,false) then raise exception 'INVALID_REQUEST'; end if;
  if action in('apply','keep') then
   if (select count(*) from jsonb_object_keys(choice))<>2 then raise exception 'INVALID_REQUEST'; end if;
  elsif action='set_state' then
   if (select count(*) from jsonb_object_keys(choice))<>4 or not(choice ?& array['lineId','action','inventoryItemId','state']) or jsonb_typeof(choice->'state') is distinct from 'string' or choice->>'state' not in('plenty','low','empty') then raise exception 'INVALID_REQUEST'; end if;
  elsif action='set_consumption' then
   if (select count(*) from jsonb_object_keys(choice)) not in(4,5) or not(choice ?& array['lineId','action','quantity','unit']) or exists(select 1 from jsonb_object_keys(choice) k where k not in('lineId','action','quantity','unit','inventoryItemId'))
    or jsonb_typeof(choice->'quantity') is distinct from 'number' then raise exception 'INVALID_REQUEST'; end if;
  else raise exception 'INVALID_REQUEST'; end if;
  if action='keep' then continue; end if;
  remaining:=case when action='apply' and line->>'mode'='exact' then (line->>'required')::numeric when action='set_consumption' then (choice->>'quantity')::numeric else 0 end;
  if remaining<0 then raise exception 'INVALID_REQUEST'; end if;
  if choice ? 'inventoryItemId' and not exists(select 1 from jsonb_array_elements(line->'allocations') a where a->>'inventoryItemId'=choice->>'inventoryItemId') then raise exception 'INVALID_REQUEST'; end if;
  if action='set_consumption' and line->>'mode'<>'exact' and not(choice ? 'inventoryItemId') then raise exception 'INVALID_REQUEST'; end if;
  provenance:=case when action='apply' then 'recipe_consumption' else 'user_adjustment' end;
  for lot in select a from jsonb_array_elements(line->'allocations')a loop
   if choice ? 'inventoryItemId' and lot->>'inventoryItemId'<>choice->>'inventoryItemId' then continue; end if;
   select * into item from public.inventory_items where id=(lot->>'inventoryItemId')::uuid and user_id=uid and deleted_at is null;
   if not found or item.version<>(lot->>'version')::bigint or item.normalization_status<>'confirmed' or item.food_concept_id::text is distinct from line->>'conceptId' then raise exception 'PANTRY_CONFLICT'; end if;
   before:=public.cooking_v3_stock(item); after:=before;
   if action='set_state' or (action='apply' and line->>'mode'='qualitative') then
    new_state:=case when action='set_state' then choice->>'state' when item.stock_state='low' then 'empty' else 'low' end;
    after:=before||jsonb_build_object('stock_mode','qualitative','stock_state',new_state,'quantity_precision','unknown','quantity_exact',null,'quantity_unit',null);
   else
    if item.stock_mode<>'exact' or item.quantity_precision<>'exact' then raise exception 'INVALID_REQUEST'; end if;
    select p.quantity,p.unit into canonical,canon_unit from public.today_parse_measure_v1(item.quantity_exact::text||' '||item.quantity_unit) p;
    if canonical is null or canon_unit is distinct from (case when action='apply' then line->>'requiredUnit' else choice->>'unit' end) then raise exception 'INVALID_REQUEST'; end if;
    consumed:=least(remaining,canonical); remaining:=remaining-consumed;
    if consumed=0 then continue; end if;
    qty:=(canonical-consumed)/case when lower(item.quantity_unit) in('kg','l') then 1000 else 1 end;
    after:=before||jsonb_build_object('quantity_exact',qty,'quantity',qty,'unit',item.quantity_unit,'stock_state',case when qty=0 then 'empty' else null end);
   end if;
   if before=after then continue; end if;
   if item.id=any(used) then raise exception 'INVALID_REQUEST'; end if;
   used:=array_append(used,item.id);
   changes:=changes||jsonb_build_array(jsonb_build_object('inventoryItemId',item.id,'name',item.name,'before',before,'after',after,'beforeVersion',item.version,'afterVersion',item.version+1,'provenance',provenance));
  end loop;
  if remaining>0 then raise exception 'INVALID_REQUEST'; end if;
 end loop;
 -- All choices validated before writes. Exceptions still roll back this block.
 for change in select c from jsonb_array_elements(changes)c loop
  after:=change->'after';
  update public.inventory_items set stock_mode=after->>'stock_mode',stock_state=after->>'stock_state',quantity_precision=after->>'quantity_precision',quantity_exact=(after->>'quantity_exact')::numeric,quantity_unit=after->>'quantity_unit',quantity=(after->>'quantity')::numeric,unit=after->>'unit',version=version+1,updated_at=applied where id=(change->>'inventoryItemId')::uuid and user_id=uid;
 end loop;
 result:=jsonb_build_object('contract','cooking-mutation-v1','status','applied','eventId',event_id,'appliedAt',applied,'undoUntil',applied+interval '5 minutes','changes',changes);
 insert into public.cooking_v3_events(id,user_id,source_ref,recipe_version,recipe_snapshot,choices,changes,applied_at,undo_until,result)
 values(event_id,uid,jsonb_build_object('kind',plan.kind,'id',plan.source_id),plan.recipe_version,recipe,p_choices,changes,applied,applied+interval '5 minutes',result);
 insert into public.cooking_v3_mutations values(uid,p_mutation,payload,result);
 return result;
exception when raise_exception then return jsonb_build_object('error',SQLERRM);
 when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('error','INVALID_REQUEST');
end $$;

create function public.undo_cooking_v3(p_event uuid,p_mutation uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare uid uuid:=auth.uid(); original public.cooking_v3_events%rowtype; prior public.cooking_v3_mutations%rowtype;
 payload jsonb:=jsonb_build_object('operation','undo','eventId',p_event); result jsonb; c jsonb; b jsonb; item public.inventory_items%rowtype;
 changes jsonb:='[]'::jsonb; event_id uuid:=extensions.gen_random_uuid(); applied timestamptz:=statement_timestamp();
begin
 if uid is null then return jsonb_build_object('error','AUTH_REQUIRED'); end if;
 if p_event is null or p_mutation is null then return jsonb_build_object('error','INVALID_REQUEST'); end if;
 perform pg_advisory_xact_lock(hashtextextended('cooking-v3:'||uid::text,0));
 select * into prior from public.cooking_v3_mutations where user_id=uid and client_mutation_id=p_mutation;
 if found then
  if prior.payload<>payload then return jsonb_build_object('error','MUTATION_CONFLICT'); end if;
  return prior.result||jsonb_build_object('status','duplicate');
 end if;
 select * into original from public.cooking_v3_events where id=p_event and user_id=uid and compensates is null;
 if not found then return jsonb_build_object('error','SOURCE_NOT_FOUND'); end if;
 select e.result into result from public.cooking_v3_events e where e.compensates=p_event and e.user_id=uid;
 if found then
  result:=result||jsonb_build_object('status','duplicate');
  insert into public.cooking_v3_mutations values(uid,p_mutation,payload,result); return result;
 end if;
 if original.undo_until<=applied then return jsonb_build_object('error','UNDO_EXPIRED'); end if;
 lock table public.inventory_items in row exclusive mode;
 perform 1 from public.inventory_items where user_id=uid order by id for update;
 for c in select a from jsonb_array_elements(original.changes)a loop
  select * into item from public.inventory_items where id=(c->>'inventoryItemId')::uuid and user_id=uid;
  if not found or item.deleted_at is not null or item.version<>(c->>'afterVersion')::bigint then return jsonb_build_object('error','UNDO_CONFLICT'); end if;
  changes:=changes||jsonb_build_array(jsonb_build_object('inventoryItemId',item.id,'name',item.name,'before',public.cooking_v3_stock(item),'after',c->'before','beforeVersion',item.version,'afterVersion',item.version+1,'provenance','compensation'));
 end loop;
 for c in select a from jsonb_array_elements(changes)a loop
  b:=c->'after';
  update public.inventory_items set stock_mode=b->>'stock_mode',stock_state=b->>'stock_state',quantity_precision=b->>'quantity_precision',quantity_exact=(b->>'quantity_exact')::numeric,quantity_unit=b->>'quantity_unit',quantity=(b->>'quantity')::numeric,unit=b->>'unit',version=version+1,updated_at=applied where id=(c->>'inventoryItemId')::uuid and user_id=uid;
 end loop;
 result:=jsonb_build_object('contract','cooking-mutation-v1','status','applied','eventId',event_id,'appliedAt',applied,'undoUntil',applied,'changes',changes,'undone',true);
 insert into public.cooking_v3_events(id,user_id,source_ref,recipe_version,recipe_snapshot,choices,changes,applied_at,undo_until,compensates,result)
 values(event_id,uid,original.source_ref,original.recipe_version,original.recipe_snapshot,'[]',changes,applied,applied,p_event,result);
 insert into public.cooking_v3_mutations values(uid,p_mutation,payload,result); return result;
end $$;

revoke all on function public.cooking_v3_source(uuid,text,uuid),public.cooking_v3_lock(boolean),public.cooking_v3_state(uuid,text,uuid),public.read_cooking_v3_context(text,uuid),public.store_cooking_v3_plan(uuid,text,uuid,text,jsonb),public.cooking_v3_stock(public.inventory_items),public.confirm_cooking_v3(uuid,uuid,boolean,jsonb),public.undo_cooking_v3(uuid,uuid) from public,anon,authenticated;
grant execute on function public.read_cooking_v3_context(text,uuid),public.confirm_cooking_v3(uuid,uuid,boolean,jsonb),public.undo_cooking_v3(uuid,uuid) to authenticated;
grant execute on function public.store_cooking_v3_plan(uuid,text,uuid,text,jsonb) to service_role;
