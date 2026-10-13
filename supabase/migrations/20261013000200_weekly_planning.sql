-- R6: lightweight weekly planning. Additive over meal_entries and the R5 shopping contracts.
-- Planning never writes the pantry; faltantes are aggregated server-side with cook_missing_v1.

alter table public.meal_entries add column plan_kind text not null default 'meal' check(plan_kind in('meal','outside'));
alter table public.meal_entries add constraint meal_entries_plan_identity_check check(
 plan_kind='meal' or (recipe_snapshot is null and recipe_id is null and custom_name='Cenar fuera'));
create index meal_entries_plan_week on public.meal_entries(user_id,meal_date) where deleted_at is null;

-- apply_meal_mutation stays untouched: "Cenar fuera" written through it is classified here.
create function public.meal_plan_kind() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.recipe_snapshot is null and new.recipe_id is null and new.meal_type='dinner'
  and public.r1_normalize_text(new.custom_name)='cenar fuera' then
  new.plan_kind:='outside'; new.custom_name:='Cenar fuera';
 else new.plan_kind:='meal'; end if;
 return new;
end $$;
create trigger meal_plan_kind before insert or update of custom_name,recipe_snapshot,recipe_id,meal_type on public.meal_entries
 for each row execute function public.meal_plan_kind();

-- R5 contracts widened additively for source plan_missing.
alter table public.shopping_list_items drop constraint shopping_origin;
alter table public.shopping_list_items add constraint shopping_origin check(
 (source='recipe_missing' and source_ref ~ '^(catalog|import):[0-9a-f-]{36}$')
 or (source='plan_missing' and source_ref ~ '^plan:[0-9]{4}-[0-9]{2}-[0-9]{2}$')
 or source in('low_stock_suggestion','manual','legacy'));
alter table public.shopping_item_sources drop constraint shopping_item_sources_source_check;
alter table public.shopping_item_sources add constraint shopping_item_sources_source_check check(
 source in('recipe_missing','plan_missing','low_stock_suggestion','manual','legacy'));
create unique index shop_plan_one_active on public.shopping_list_items(user_id,source_ref,ingredient_key,coalesce(unit,''))
 where source='plan_missing' and deleted_at is null;

create or replace function public.shop_consolidate_v1(p_uid uuid) returns void
language plpgsql volatile security definer set search_path='' as $$
declare g record; v_survivor uuid; v_dup uuid; v_s public.shopping_list_items%rowtype; v_d public.shopping_list_items%rowtype;
 v_added numeric; v_moved numeric; v_sf numeric; v_df numeric;
begin
 for g in
  select coalesce(i.food_concept_id::text,'n:'||public.r1_normalize_text(i.name)) group_key,u.base,(i.quantity is null) null_quantity,i.checked,array_agg(i.id order by i.created_at,i.id) ids
  from public.shopping_list_items i left join lateral public.shop_unit_v1(i.unit) u on true
  where i.user_id=p_uid and i.deleted_at is null and i.purchased_at is null and i.selection='selected'
   and i.source in('recipe_missing','plan_missing','manual','legacy')
  group by coalesce(i.food_concept_id::text,'n:'||public.r1_normalize_text(i.name)),u.base,(i.quantity is null),i.checked having count(*)>1
 loop
  v_survivor:=g.ids[1];
  for v_dup in select unnest(g.ids[2:array_length(g.ids,1)]) loop
   select * into v_s from public.shopping_list_items where id=v_survivor for update;
   select * into v_d from public.shopping_list_items where id=v_dup for update;
   v_moved:=0;
   if not g.null_quantity then
    select coalesce(sum(s.quantity*coalesce(u.factor,1)),0) into v_moved from public.shopping_item_sources s
     left join lateral public.shop_unit_v1(s.unit) u on true
     where s.item_id=v_dup and s.quantity is not null and not exists(select 1 from public.shopping_item_sources t
      where t.item_id=v_survivor and t.source=s.source and t.ref_key=s.ref_key);
   end if;
   update public.shopping_item_sources s set item_id=v_survivor where s.item_id=v_dup
    and not exists(select 1 from public.shopping_item_sources t where t.item_id=v_survivor and t.source=s.source and t.ref_key=s.ref_key);
   if not g.null_quantity then
    select factor into v_sf from public.shop_unit_v1(v_s.unit); select factor into v_df from public.shop_unit_v1(v_d.unit);
    v_added:=least(v_d.quantity*coalesce(v_df,1),v_moved);
    update public.shopping_list_items set quantity=v_s.quantity+v_added/coalesce(v_sf,1),version=version+1,updated_at=now() where id=v_survivor;
   end if;
   update public.shopping_list_items set deleted_at=statement_timestamp(),version=version+1,updated_at=now() where id=v_dup;
  end loop;
 end loop;
end $$;


create function public.plan_concept_v1(p_ing jsonb) returns uuid
language sql stable security definer set search_path='' as $$
 select coalesce((select c.id from public.food_concepts c where c.id::text=p_ing->>'foodConceptId'),
  (select min(id::text)::uuid from (
    select c.id from public.food_concepts c where public.r1_normalize_text(c.display_name)=public.r1_normalize_text(coalesce(p_ing->>'normalizedName',p_ing->>'name'))
    union select a.food_concept_id from public.food_concept_aliases a where a.normalized_alias=public.r1_normalize_text(coalesce(p_ing->>'normalizedName',p_ing->>'name'))
  ) candidates having count(*)=1))
$$;

-- Live source when available; the saved snapshot only when the source can no longer be read.
create function public.plan_recipe_for_entry_v1(p_uid uuid,p_entry public.meal_entries) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_kind text; v_id uuid; v_r jsonb; v_ref text:=p_entry.recipe_snapshot->>'recipe_id';
begin
 if v_ref ~ '^import:[0-9a-f-]{36}$' then v_kind:='import'; v_id:=substr(v_ref,8)::uuid;
 elsif p_entry.recipe_id is not null then v_kind:='catalog'; v_id:=p_entry.recipe_id; end if;
 if v_kind is not null then
  v_r:=public.cook_recipe_for_user_v1(p_uid,v_kind,v_id);
  if v_r is not null and not coalesce((v_r->>'invalid')::boolean,false) then
   return jsonb_build_object('recipe',v_r,'source','live','kind',v_kind,'id',v_id);
  end if;
 end if;
 if jsonb_typeof(p_entry.recipe_snapshot->'ingredients')='array' and jsonb_array_length(p_entry.recipe_snapshot->'ingredients')>0 then
  return jsonb_build_object('source','snapshot','kind',coalesce(v_kind,'catalog'),'id',v_id,'recipe',jsonb_build_object('title',p_entry.recipe_snapshot->>'title',
   'ingredients',(select jsonb_agg(jsonb_build_object('name',i->>'name','normalizedName',i->>'ingredient_key',
     'measure',nullif(btrim(concat_ws(' ',i->>'quantity',i->>'unit')),'')) order by n)
    from jsonb_array_elements(p_entry.recipe_snapshot->'ingredients') with ordinality a(i,n))));
 end if;
 return jsonb_build_object('source',null,'recipe',null,'kind',v_kind,'id',v_id);
end $$;

create function public.plan_compute_v1(p_uid uuid,p_from date,p_today date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare e public.meal_entries%rowtype; v_rec jsonb; v_ing jsonb; v_to date:=p_from+6; v_start date:=greatest(p_from,p_today);
 v_all jsonb:='[]'::jsonb; v_unresolved jsonb:='[]'::jsonb; v_unavailable jsonb:='[]'::jsonb; v_meta jsonb; v_c uuid;
 v_map jsonb:='{}'::jsonb; v_lines jsonb:='[]'::jsonb; v_entries jsonb:='[]'::jsonb; m record; v_title text; v_ents jsonb;
begin
 for e in select * from public.meal_entries x where x.user_id=p_uid and x.deleted_at is null and x.plan_kind='meal' and x.consumed_at is null
   and x.meal_type='dinner' and x.recipe_snapshot is not null and x.meal_date between v_start and v_to
   and not exists(select 1 from public.meal_entries o where o.user_id=p_uid and o.deleted_at is null and o.plan_kind='outside' and o.meal_date=x.meal_date)
   order by x.meal_date,x.id
 loop
  v_rec:=public.plan_recipe_for_entry_v1(p_uid,e);
  v_title:=coalesce(v_rec#>>'{recipe,title}',e.recipe_snapshot->>'title');
  v_meta:=jsonb_build_object('mealEntryId',e.id,'title',v_title,'date',e.meal_date,'recipeKind',v_rec->>'kind','recipeId',v_rec->>'id','source',v_rec->>'source');
  v_entries:=v_entries||jsonb_build_array(jsonb_build_object('id',e.id,'version',e.version,'date',e.meal_date));
  if v_rec->'recipe' is null or v_rec->'recipe'='null'::jsonb then v_unavailable:=v_unavailable||jsonb_build_array(v_meta); continue; end if;
  for v_ing in select value from jsonb_array_elements(v_rec->'recipe'->'ingredients') loop
   v_all:=v_all||jsonb_build_array(v_ing);
   v_c:=public.plan_concept_v1(v_ing);
   if v_c is null then
    v_unresolved:=v_unresolved||jsonb_build_array(jsonb_build_object('name',v_ing->>'name','mealEntryId',e.id,'title',v_title,'date',e.meal_date));
   else
    v_ents:=coalesce(v_map->(v_c::text),'[]'::jsonb);
    if not exists(select 1 from jsonb_array_elements(v_ents) x where x->>'mealEntryId'=e.id::text) then
     v_map:=jsonb_set(v_map,array[v_c::text],v_ents||jsonb_build_array(v_meta),true);
    end if;
   end if;
  end loop;
 end loop;
 for m in select * from public.cook_missing_v1(p_uid,jsonb_build_object('ingredients',v_all)) loop
  v_lines:=v_lines||jsonb_build_array(jsonb_build_object('conceptId',m.concept_id,'name',m.name,'quantity',m.quantity,'unit',m.unit,
   'entries',coalesce(v_map->(m.concept_id::text),'[]'::jsonb)));
 end loop;
 return jsonb_build_object('from',p_from,'to',v_to,'lines',v_lines,'unresolved',v_unresolved,'unavailable',v_unavailable,
  'key',encode(extensions.digest(convert_to(jsonb_build_object('lines',v_lines,'entries',v_entries,'from',p_from)::text,'UTF8'),'sha256'),'hex'));
end $$;

create function public.plan_args_ok_v1(p_from date,p_today date) returns boolean
language sql stable set search_path='' as $$
 select p_from is not null and p_today is not null and extract(isodow from p_from)=1
  and abs(p_today-(statement_timestamp() at time zone 'UTC')::date)<=1 and p_from between p_today-56 and p_today+84
$$;

create function public.plan_week_v1(p_from date,p_today date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_days jsonb:='[]'::jsonb; d date; v_missing jsonb;
begin
 if v_uid is null then return jsonb_build_object('error','AUTH_REQUIRED'); end if;
 if not public.plan_args_ok_v1(p_from,p_today) then return jsonb_build_object('error','INVALID_REQUEST'); end if;
 v_missing:=public.plan_compute_v1(v_uid,p_from,p_today);
 for d in select g::date from generate_series(p_from::timestamp,(p_from+6)::timestamp,interval '1 day') g loop
  v_days:=v_days||jsonb_build_array(jsonb_build_object('date',d,'entries',coalesce((
   select jsonb_agg(jsonb_build_object('id',e.id,'version',e.version,'mealType',e.meal_type,
     'kind',case when e.plan_kind='outside' then 'outside' when e.recipe_snapshot is not null and e.meal_type='dinner' and e.consumed_at is null then 'recipe' else 'legacy' end,
     'state',case when e.plan_kind='outside' or (e.recipe_snapshot is not null and e.meal_type='dinner' and e.consumed_at is null) then 'planned' else 'registered' end,
     'title',coalesce(e.recipe_snapshot->>'title',e.custom_name),
     'recipeRef',case when e.recipe_snapshot->>'recipe_id' ~ '^import:' then jsonb_build_object('kind','import','id',substr(e.recipe_snapshot->>'recipe_id',8))
       when e.recipe_id is not null then jsonb_build_object('kind','catalog','id',e.recipe_id) else null end,
     'readOnly',d<p_today or not(e.plan_kind='outside' or (e.recipe_snapshot is not null and e.meal_type='dinner' and e.consumed_at is null)))
    order by e.created_at,e.id)
   from public.meal_entries e where e.user_id=v_uid and e.deleted_at is null and e.meal_date=d),'[]'::jsonb)));
 end loop;
 return jsonb_build_object('contract','plan-week-v1','from',p_from,'days',v_days,'missing',jsonb_build_object(
  'count',jsonb_array_length(v_missing->'lines'),'lines',v_missing->'lines','unresolved',v_missing->'unresolved','unavailable',v_missing->'unavailable',
  'key',v_missing->>'key','computedAt',statement_timestamp()));
end $$;

create function public.plan_add_to_shop_v1(p_from date,p_today date,p_mutation uuid,p_key text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_payload jsonb; v_prior public.shopping_v1_mutations%rowtype; v_plan jsonb; l jsonb; v_ids uuid[]:='{}'::uuid[];
 v_item public.shopping_list_items%rowtype; v_src public.shopping_item_sources%rowtype; v_ref text; v_label text; v_n int; v_titles text[];
 v_result jsonb; v_delta numeric; v_sf numeric; v_df numeric; v_changed int:=0;
begin
 if v_uid is null then return jsonb_build_object('error','AUTH_REQUIRED'); end if;
 if p_mutation is null or p_key is null or not public.plan_args_ok_v1(p_from,p_today) then return jsonb_build_object('error','INVALID_REQUEST'); end if;
 v_payload:=jsonb_build_object('op','plan_shop','from',p_from,'key',p_key);
 perform pg_advisory_xact_lock(hashtextextended('shop-v1:'||v_uid::text,0));
 select * into v_prior from public.shopping_v1_mutations where user_id=v_uid and client_mutation_id=p_mutation;
 if found then
  if v_prior.payload<>v_payload then return jsonb_build_object('error','MUTATION_CONFLICT'); end if;
  return v_prior.result||jsonb_build_object('status','duplicate');
 end if;
 v_plan:=public.plan_compute_v1(v_uid,p_from,p_today);
 if v_plan->>'key' is distinct from p_key then return jsonb_build_object('error','PLAN_CHANGED'); end if;
 v_ref:='plan:'||p_from::text;
 for l in select value from jsonb_array_elements(v_plan->'lines') loop
  select array_agg(distinct x->>'title') into v_titles from jsonb_array_elements(l->'entries') x;
  v_n:=coalesce(array_length(v_titles,1),0);
  v_label:=case when v_n=0 then null when v_n=1 then v_titles[1] else v_titles[1]||' (+'||(v_n-1)||' más)' end;
  select i.* into v_item from public.shopping_list_items i join public.shopping_item_sources s on s.item_id=i.id
   where i.user_id=v_uid and s.source='plan_missing' and s.ref_key=v_ref and i.food_concept_id=(l->>'conceptId')::uuid
    and coalesce(s.unit,'')=coalesce(l->>'unit','') and i.deleted_at is null and i.purchased_at is null order by i.created_at limit 1 for update of i;
  if found then
   select * into v_src from public.shopping_item_sources where item_id=v_item.id and source='plan_missing' and ref_key=v_ref;
   if not v_item.checked and v_item.quantity is not null and v_src.quantity is not null and (l->>'quantity') is not null
    and (l->>'quantity')::numeric is distinct from v_src.quantity then
    select factor into v_sf from public.shop_unit_v1(l->>'unit'); select factor into v_df from public.shop_unit_v1(v_item.unit);
    v_delta:=((l->>'quantity')::numeric-v_src.quantity)*coalesce(v_sf,1)/coalesce(v_df,1);
    update public.shopping_list_items set quantity=greatest(quantity+v_delta,0),version=version+1,updated_at=now() where id=v_item.id;
    v_changed:=v_changed+1;
   end if;
   update public.shopping_item_sources set source_ref=jsonb_build_object('weekStart',p_from,'entries',l->'entries'),label=v_label,
    quantity=case when v_item.checked then v_src.quantity else (l->>'quantity')::numeric end where id=v_src.id;
   v_ids:=array_append(v_ids,v_item.id);
  else
   insert into public.shopping_list_items(user_id,ingredient_key,name,quantity,unit,source,source_ref,selection,food_concept_id)
    values(v_uid,l->>'conceptId',l->>'name',(l->>'quantity')::numeric,nullif(l->>'unit',''),'plan_missing',v_ref,'selected',(l->>'conceptId')::uuid)
    on conflict(user_id,source_ref,ingredient_key,(coalesce(unit,''))) where source='plan_missing' and deleted_at is null do nothing returning * into v_item;
   if not found then
    select * into v_item from public.shopping_list_items where user_id=v_uid and source='plan_missing' and source_ref=v_ref and ingredient_key=l->>'conceptId'
     and coalesce(unit,'')=coalesce(l->>'unit','') and deleted_at is null;
   else v_changed:=v_changed+1; end if;
   insert into public.shopping_item_sources(user_id,item_id,source,source_ref,ref_key,label,quantity,unit)
    values(v_uid,v_item.id,'plan_missing',jsonb_build_object('weekStart',p_from,'entries',l->'entries'),v_ref,v_label,(l->>'quantity')::numeric,nullif(l->>'unit',''))
    on conflict(item_id,source,ref_key) do nothing;
   v_ids:=array_append(v_ids,v_item.id);
  end if;
 end loop;
 perform public.shop_consolidate_v1(v_uid);
 v_result:=jsonb_build_object('contract','plan-shop-v1','status','applied','itemIds',to_jsonb(v_ids),'count',coalesce(array_length(v_ids,1),0),'changed',v_changed);
 insert into public.shopping_v1_mutations(user_id,client_mutation_id,payload,result) values(v_uid,p_mutation,v_payload,v_result);
 return v_result;
end $$;

revoke all on function public.meal_plan_kind(),public.plan_concept_v1(jsonb),public.plan_recipe_for_entry_v1(uuid,public.meal_entries),
 public.plan_compute_v1(uuid,date,date),public.plan_args_ok_v1(date,date),public.plan_week_v1(date,date),public.plan_add_to_shop_v1(date,date,uuid,text) from public,anon,authenticated;
grant execute on function public.plan_week_v1(date,date),public.plan_add_to_shop_v1(date,date,uuid,text) to authenticated;
