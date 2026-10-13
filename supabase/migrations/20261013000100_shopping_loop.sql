-- R5: shopping loop. Additive over R3 source/source_ref; legacy and R1/R2/R3/R4 contracts stay untouched.
-- Suggestions are never stock. Reconciliation writes only shopping rows and events, never pantry.

alter table public.shopping_list_items drop constraint cook_shopping_origin;
update public.shopping_list_items set source='legacy' where source is null;
alter table public.shopping_list_items
 alter column source set default 'legacy', alter column source set not null,
 add column food_concept_id uuid references public.food_concepts(id) on delete set null,
 add column selection text not null default 'selected' check(selection in('selected','suggested','dismissed')),
 add column purchased_at timestamptz,
 add column purchase_ref uuid references public.receipt_drafts(id) on delete set null,
 add column shopping_session_id uuid,
 add column suggested_stock_version bigint;
alter table public.shopping_list_items add constraint shopping_origin check(
 (source='recipe_missing' and source_ref ~ '^(catalog|import):[0-9a-f-]{36}$') or source in('low_stock_suggestion','manual','legacy'));
alter table public.shopping_list_items add constraint shopping_selection_origin check(selection='selected' or source='low_stock_suggestion');
create unique index shop_one_suggestion on public.shopping_list_items(user_id,food_concept_id)
 where source='low_stock_suggestion' and deleted_at is null and purchased_at is null;
create index shop_items_active on public.shopping_list_items(user_id,created_at,id) where deleted_at is null;

create table public.shopping_item_sources(
 id uuid primary key default extensions.gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 item_id uuid not null references public.shopping_list_items(id) on delete cascade,
 source text not null check(source in('recipe_missing','low_stock_suggestion','manual','legacy')),
 source_ref jsonb not null check(jsonb_typeof(source_ref)='object'), ref_key text not null, label text,
 quantity numeric check(quantity is null or quantity>=0), unit text, created_at timestamptz not null default statement_timestamp(),
 unique(item_id,source,ref_key));
create table public.shopping_sessions(
 id uuid primary key default extensions.gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'open' check(status in('open','reconciled','abandoned')),
 created_at timestamptz not null default statement_timestamp(), closed_at timestamptz,
 draft_id uuid references public.receipt_drafts(id) on delete set null);
create table public.shopping_events(
 id uuid primary key default extensions.gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 draft_id uuid not null references public.receipt_drafts(id) on delete cascade,
 session_id uuid references public.shopping_sessions(id) on delete set null,
 kind text not null check(kind in('reconcile','skip','compensation')),
 changes jsonb not null default '[]'::jsonb, summary jsonb not null default '{}'::jsonb,
 applied_at timestamptz not null default statement_timestamp(), undo_until timestamptz not null,
 compensates uuid unique references public.shopping_events(id));
create unique index shopping_events_one_per_draft on public.shopping_events(user_id,draft_id) where kind in('reconcile','skip');
create table public.shopping_v1_mutations(
 user_id uuid not null references auth.users(id) on delete cascade, client_mutation_id uuid not null,
 payload jsonb not null, result jsonb not null, created_at timestamptz not null default statement_timestamp(),
 primary key(user_id,client_mutation_id));

alter table public.shopping_item_sources enable row level security;
alter table public.shopping_sessions enable row level security;
alter table public.shopping_events enable row level security;
alter table public.shopping_v1_mutations enable row level security;
create policy shopping_sources_own on public.shopping_item_sources for select to authenticated using(user_id=auth.uid());
create policy shopping_sessions_own on public.shopping_sessions for select to authenticated using(user_id=auth.uid());
create policy shopping_events_own on public.shopping_events for select to authenticated using(user_id=auth.uid());
create policy shopping_v1_mutations_own on public.shopping_v1_mutations for select to authenticated using(user_id=auth.uid());
revoke all on public.shopping_item_sources,public.shopping_sessions,public.shopping_events,public.shopping_v1_mutations from anon,authenticated;
grant select on public.shopping_item_sources,public.shopping_sessions,public.shopping_events,public.shopping_v1_mutations to authenticated;
grant all on public.shopping_item_sources,public.shopping_sessions,public.shopping_events,public.shopping_v1_mutations to service_role;

-- Concept resolution is deterministic: an exact concept id or a single unambiguous alias, never fuzzy.
create function public.shop_concept_for_v1(p_name text,p_key text) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare v uuid;
begin
 if p_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
  select id into v from public.food_concepts where id=p_key::uuid; if found then return v; end if;
 end if;
 select (array_agg(distinct m.id))[1] into v from(
   select a.food_concept_id id from public.food_concept_aliases a where a.normalized_alias=public.r1_normalize_text(p_name)
   union select c.id from public.food_concepts c where public.r1_normalize_text(c.display_name)=public.r1_normalize_text(p_name)) m
  having count(distinct m.id)=1;
 return v;
end $$;
create function public.shop_unit_v1(p text) returns table(base text,factor numeric)
language sql immutable set search_path='' as $$
 select case when u in('g','gr','gramo','gramos') then 'g' when u in('kg','kilo','kilos') then 'g'
  when u in('ml','mililitro','mililitros') then 'ml' when u in('l','lt','litro','litros') then 'ml' when u='cl' then 'ml'
  when u in('u','ud','uds','unidad','unidades','unit','units','pieza','piezas') then 'unit'
  when u in('pack','packs','paquete','paquetes') then 'pack' when u='' then null else u end,
 case when u in('kg','kilo','kilos','l','lt','litro','litros') then 1000::numeric when u='cl' then 10::numeric else 1::numeric end
 from(select lower(btrim(coalesce(p,''))) u) x
$$;

create function public.shop_before_item() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.food_concept_id is null then new.food_concept_id:=public.shop_concept_for_v1(new.name,new.ingredient_key); end if;
 return new;
end $$;
create trigger shop_before_item before insert or update of name,ingredient_key on public.shopping_list_items
 for each row execute function public.shop_before_item();

create function public.shop_after_item() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_kind text; v_id uuid; v_label text;
begin
 if new.source='recipe_missing' and new.source_ref ~ '^(catalog|import):' then
  v_kind:=split_part(new.source_ref,':',1); v_id:=split_part(new.source_ref,':',2)::uuid;
  begin v_label:=public.cook_recipe_for_user_v1(new.user_id,v_kind,v_id)->>'title'; exception when others then v_label:=null; end;
  delete from public.shopping_item_sources where item_id=new.id and ref_key='self:'||new.id::text;
  insert into public.shopping_item_sources(user_id,item_id,source,source_ref,ref_key,label,quantity,unit)
   values(new.user_id,new.id,'recipe_missing',jsonb_build_object('kind',v_kind,'id',v_id),new.source_ref,v_label,new.quantity,new.unit)
   on conflict do nothing;
 elsif new.source in('manual','legacy') then
  insert into public.shopping_item_sources(user_id,item_id,source,source_ref,ref_key,label,quantity,unit)
   values(new.user_id,new.id,new.source,jsonb_build_object('itemId',new.id),'self:'||new.id::text,null,new.quantity,new.unit)
   on conflict do nothing;
 end if;
 return null;
end $$;
create trigger shop_after_item after insert or update of source,source_ref on public.shopping_list_items
 for each row execute function public.shop_after_item();

-- Today (R2) keeps its contract; its rows gain recipe provenance without changing its function.
create function public.shop_after_today() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_item uuid; v_ref text:='catalog:'||new.recipe_id::text; v_label text;
begin
 foreach v_item in array new.item_ids loop
  update public.shopping_list_items i set source='recipe_missing',source_ref=v_ref,version=i.version+1,updated_at=now()
   where i.id=v_item and i.user_id=new.user_id and i.source='legacy' and i.deleted_at is null
    and not exists(select 1 from public.shopping_list_items o where o.user_id=i.user_id and o.source_ref=v_ref and o.source='recipe_missing'
     and o.ingredient_key is not distinct from i.ingredient_key and coalesce(o.unit,'')=coalesce(i.unit,'') and o.deleted_at is null and o.id<>i.id);
  if not found then
   begin select name into v_label from public.recipes where id=new.recipe_id; exception when others then v_label:=null; end;
   insert into public.shopping_item_sources(user_id,item_id,source,source_ref,ref_key,label,quantity,unit)
    select i.user_id,i.id,'recipe_missing',jsonb_build_object('kind','catalog','id',new.recipe_id),v_ref,v_label,i.quantity,i.unit
    from public.shopping_list_items i where i.id=v_item and i.user_id=new.user_id on conflict do nothing;
  end if;
 end loop;
 return null;
end $$;
create trigger shop_after_today after insert on public.today_shopping_mutations
 for each row execute function public.shop_after_today();

-- Backfill: concepts and one provenance row per existing item; no row is deleted or reinterpreted.
update public.shopping_list_items i set food_concept_id=public.shop_concept_for_v1(i.name,i.ingredient_key) where food_concept_id is null;
insert into public.shopping_item_sources(user_id,item_id,source,source_ref,ref_key,label,quantity,unit)
 select i.user_id,i.id,i.source,
  case when i.source='recipe_missing' then jsonb_build_object('kind',split_part(i.source_ref,':',1),'id',split_part(i.source_ref,':',2)::uuid) else jsonb_build_object('itemId',i.id) end,
  case when i.source='recipe_missing' then i.source_ref else 'self:'||i.id::text end,null,i.quantity,i.unit
 from public.shopping_list_items i where i.source in('recipe_missing','manual','legacy') on conflict do nothing;

create function public.shop_refresh_suggestions_v1(p_uid uuid) returns void
language plpgsql volatile security definer set search_path='' as $$
declare r record; it public.shopping_list_items%rowtype;
begin
 update public.shopping_list_items s set deleted_at=statement_timestamp(),version=s.version+1,updated_at=now()
  where s.user_id=p_uid and s.source='low_stock_suggestion' and s.selection='suggested' and s.deleted_at is null and s.purchased_at is null
   and not exists(select 1 from public.inventory_items i where i.user_id=p_uid and i.food_concept_id=s.food_concept_id and i.deleted_at is null
    and i.stock_mode='qualitative' and i.stock_state in('low','empty'));
 for r in
  select distinct on(i.food_concept_id) i.id inventory_id,i.food_concept_id,i.version,i.location,c.display_name
  from public.inventory_items i join public.food_concepts c on c.id=i.food_concept_id
  where i.user_id=p_uid and i.deleted_at is null and i.normalization_status='confirmed' and i.stock_mode='qualitative' and i.stock_state in('low','empty')
   and not exists(select 1 from public.inventory_items o where o.user_id=p_uid and o.food_concept_id=i.food_concept_id and o.deleted_at is null and o.id<>i.id
    and ((o.stock_mode='qualitative' and o.stock_state in('plenty','some')) or (o.stock_mode='exact' and o.quantity_exact>0 and o.stock_state is distinct from 'empty')
     or (o.stock_mode='presence' and o.stock_state='present')))
   and not exists(select 1 from public.shopping_list_items w where w.user_id=p_uid and w.food_concept_id=i.food_concept_id and w.deleted_at is null
    and w.purchased_at is null and w.selection='selected')
  order by i.food_concept_id,i.version desc
 loop
  select * into it from public.shopping_list_items where user_id=p_uid and source='low_stock_suggestion' and food_concept_id=r.food_concept_id and deleted_at is null and purchased_at is null;
  if not found then
   insert into public.shopping_list_items(user_id,ingredient_key,name,source,selection,food_concept_id,suggested_stock_version)
    values(p_uid,r.food_concept_id::text,r.display_name,'low_stock_suggestion','suggested',r.food_concept_id,r.version) returning * into it;
   insert into public.shopping_item_sources(user_id,item_id,source,source_ref,ref_key,label)
    values(p_uid,it.id,'low_stock_suggestion',jsonb_build_object('inventoryItemId',r.inventory_id,'conceptId',r.food_concept_id,'stockVersion',r.version,'location',r.location),
     r.inventory_id::text||':'||r.version::text,r.display_name);
  elsif it.selection='dismissed' and it.suggested_stock_version is distinct from r.version then
   update public.shopping_list_items set selection='suggested',suggested_stock_version=r.version,version=version+1,updated_at=now() where id=it.id;
   insert into public.shopping_item_sources(user_id,item_id,source,source_ref,ref_key,label)
    values(p_uid,it.id,'low_stock_suggestion',jsonb_build_object('inventoryItemId',r.inventory_id,'conceptId',r.food_concept_id,'stockVersion',r.version,'location',r.location),
     r.inventory_id::text||':'||r.version::text,r.display_name) on conflict do nothing;
  end if;
 end loop;
end $$;

-- Merge only identical concept + compatible exact unit (or both unknown quantity). Repeated origins are not summed twice.
create function public.shop_consolidate_v1(p_uid uuid) returns void
language plpgsql volatile security definer set search_path='' as $$
declare g record; v_survivor uuid; v_dup uuid; v_s public.shopping_list_items%rowtype; v_d public.shopping_list_items%rowtype;
 v_added numeric; v_moved numeric; v_sf numeric; v_df numeric;
begin
 for g in
  select coalesce(i.food_concept_id::text,'n:'||public.r1_normalize_text(i.name)) group_key,u.base,(i.quantity is null) null_quantity,i.checked,array_agg(i.id order by i.created_at,i.id) ids
  from public.shopping_list_items i left join lateral public.shop_unit_v1(i.unit) u on true
  where i.user_id=p_uid and i.deleted_at is null and i.purchased_at is null and i.selection='selected'
   and i.source in('recipe_missing','manual','legacy')
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

create function public.shop_item_json(p_item public.shopping_list_items) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p_item.id,'name',p_item.name,'quantity',p_item.quantity,'unit',p_item.unit,'conceptId',p_item.food_concept_id,
  'checked',p_item.checked,'selection',p_item.selection,'source',p_item.source,'purchasedAt',p_item.purchased_at,'version',p_item.version,
  'createdAt',p_item.created_at,'sources',coalesce((select jsonb_agg(jsonb_build_object('source',s.source,'ref',s.source_ref,'label',s.label,'quantity',s.quantity,'unit',s.unit)
   order by s.created_at,s.id) from public.shopping_item_sources s where s.item_id=p_item.id),'[]'::jsonb))
$$;

create function public.shop_list_v1() returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_items jsonb; v_pending jsonb; v_session uuid;
begin
 if v_uid is null then return jsonb_build_object('error','AUTH_REQUIRED'); end if;
 perform pg_advisory_xact_lock(hashtextextended('shop-v1:'||v_uid::text,0));
 perform public.shop_refresh_suggestions_v1(v_uid);
 perform public.shop_consolidate_v1(v_uid);
 select coalesce(jsonb_agg(public.shop_item_json(i) order by i.created_at,i.id),'[]'::jsonb) into v_items
  from public.shopping_list_items i where i.user_id=v_uid and i.deleted_at is null and (i.purchased_at is null or i.purchased_at>statement_timestamp()-interval '24 hours');
 select id into v_session from public.shopping_sessions where user_id=v_uid and status='open' and created_at>statement_timestamp()-interval '24 hours' order by created_at desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('draftId',d.id,'confirmedAt',d.confirmed_at,'merchant',d.merchant,'itemCount',coalesce(array_length(d.confirmed_item_ids,1),0),
   'afterSession',v_session is not null and d.confirmed_at>(select created_at from public.shopping_sessions where id=v_session)) order by d.confirmed_at desc),'[]'::jsonb) into v_pending
  from public.receipt_drafts d where d.user_id=v_uid and d.confirmed_at is not null and d.confirmed_at>statement_timestamp()-interval '48 hours'
   and coalesce(array_length(d.confirmed_item_ids,1),0)>0
   and not exists(select 1 from public.shopping_events e where e.user_id=v_uid and e.draft_id=d.id and e.kind in('reconcile','skip'))
   and exists(select 1 from public.shopping_list_items w where w.user_id=v_uid and w.deleted_at is null and w.purchased_at is null and w.selection='selected');
 return jsonb_build_object('contract','shopping-list-v1','items',v_items,'pendingReconcile',v_pending,'sessionId',v_session,'serverTime',statement_timestamp());
end $$;

create function public.apply_shop_mutation_v1(p_mutation uuid,p_op text,p_item uuid,p_expected bigint,p_name text,p_quantity numeric,p_unit text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_payload jsonb; v_prior public.shopping_v1_mutations%rowtype; v_item public.shopping_list_items%rowtype;
 v_result jsonb; v_id uuid;
begin
 if v_uid is null then return jsonb_build_object('error','AUTH_REQUIRED'); end if;
 if p_mutation is null or p_op is null or p_op not in('add_manual','check','uncheck','select','dismiss','remove','restore','mark_purchased') then return jsonb_build_object('error','INVALID_REQUEST'); end if;
 v_payload:=jsonb_build_object('op',p_op,'item',p_item,'expected',p_expected,'name',p_name,'quantity',p_quantity,'unit',p_unit);
 perform pg_advisory_xact_lock(hashtextextended('shop-v1:'||v_uid::text,0));
 select * into v_prior from public.shopping_v1_mutations where user_id=v_uid and client_mutation_id=p_mutation;
 if found then
  if v_prior.payload<>v_payload then return jsonb_build_object('error','MUTATION_CONFLICT'); end if;
  return v_prior.result||jsonb_build_object('status','duplicate');
 end if;
 if p_op='add_manual' then
  if p_name is null or char_length(btrim(p_name)) not between 1 and 120 or (p_quantity is not null and (p_quantity<0 or p_quantity>1000000))
   or (p_unit is not null and char_length(btrim(p_unit))>20) then return jsonb_build_object('error','INVALID_REQUEST'); end if;
  v_id:=coalesce(p_item,extensions.gen_random_uuid());
  if exists(select 1 from public.shopping_list_items where id=v_id) then return jsonb_build_object('error','INVALID_REQUEST'); end if;
  insert into public.shopping_list_items(id,user_id,name,quantity,unit,source,selection)
   values(v_id,v_uid,btrim(p_name),p_quantity,nullif(btrim(p_unit),''),'manual','selected') returning * into v_item;
  perform public.shop_consolidate_v1(v_uid);
 else
  if p_item is null then return jsonb_build_object('error','INVALID_REQUEST'); end if;
  select * into v_item from public.shopping_list_items where id=p_item and user_id=v_uid for update;
  if not found then return jsonb_build_object('error','ITEM_NOT_FOUND'); end if;
  if p_expected is not null and p_expected<>v_item.version then return jsonb_build_object('error','VERSION_CONFLICT','version',v_item.version); end if;
  if p_op='restore' then
   if v_item.deleted_at is null or v_item.deleted_at<statement_timestamp()-interval '5 minutes' then return jsonb_build_object('error','UNDO_EXPIRED'); end if;
   update public.shopping_list_items set deleted_at=null,version=version+1,updated_at=now() where id=v_item.id returning * into v_item;
  else
   if v_item.deleted_at is not null or v_item.purchased_at is not null then return jsonb_build_object('error','ITEM_NOT_FOUND'); end if;
   if p_op in('check','uncheck') then
    update public.shopping_list_items set checked=(p_op='check'),version=version+1,updated_at=now() where id=v_item.id returning * into v_item;
   elsif p_op='select' then
    if v_item.source<>'low_stock_suggestion' or v_item.selection='selected' then return jsonb_build_object('error','INVALID_REQUEST'); end if;
    update public.shopping_list_items set selection='selected',version=version+1,updated_at=now() where id=v_item.id returning * into v_item;
   elsif p_op='dismiss' then
    if v_item.source<>'low_stock_suggestion' or v_item.selection<>'suggested' then return jsonb_build_object('error','INVALID_REQUEST'); end if;
    update public.shopping_list_items set selection='dismissed',version=version+1,updated_at=now() where id=v_item.id returning * into v_item;
   elsif p_op='remove' then
    if v_item.source='low_stock_suggestion' then
     update public.shopping_list_items set selection='dismissed',version=version+1,updated_at=now() where id=v_item.id returning * into v_item;
    else
     update public.shopping_list_items set deleted_at=statement_timestamp(),version=version+1,updated_at=now() where id=v_item.id returning * into v_item;
    end if;
   elsif p_op='mark_purchased' then
    if v_item.selection<>'selected' then return jsonb_build_object('error','INVALID_REQUEST'); end if;
    update public.shopping_list_items set purchased_at=statement_timestamp(),version=version+1,updated_at=now() where id=v_item.id returning * into v_item;
   end if;
  end if;
 end if;
 v_result:=jsonb_build_object('contract','shopping-mutation-v1','status','applied','itemId',v_item.id,'version',v_item.version);
 insert into public.shopping_v1_mutations(user_id,client_mutation_id,payload,result) values(v_uid,p_mutation,v_payload,v_result);
 return v_result;
end $$;

create function public.start_shopping_session_v1(p_mutation uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_payload jsonb:=jsonb_build_object('op','session'); v_prior public.shopping_v1_mutations%rowtype; v_id uuid; v_result jsonb;
begin
 if v_uid is null then return jsonb_build_object('error','AUTH_REQUIRED'); end if;
 if p_mutation is null then return jsonb_build_object('error','INVALID_REQUEST'); end if;
 perform pg_advisory_xact_lock(hashtextextended('shop-v1:'||v_uid::text,0));
 select * into v_prior from public.shopping_v1_mutations where user_id=v_uid and client_mutation_id=p_mutation;
 if found then
  if v_prior.payload<>v_payload then return jsonb_build_object('error','MUTATION_CONFLICT'); end if;
  return v_prior.result||jsonb_build_object('status','duplicate');
 end if;
 select id into v_id from public.shopping_sessions where user_id=v_uid and status='open' and created_at>statement_timestamp()-interval '24 hours' order by created_at desc limit 1;
 if v_id is null then insert into public.shopping_sessions(user_id) values(v_uid) returning id into v_id; end if;
 v_result:=jsonb_build_object('contract','shopping-session-v1','status','applied','sessionId',v_id);
 insert into public.shopping_v1_mutations(user_id,client_mutation_id,payload,result) values(v_uid,p_mutation,v_payload,v_result);
 return v_result;
end $$;

-- Reconcile one confirmed ticket against the list. Pantry, lots and the draft are read-only here.
create function public.reconcile_shopping_after_receipt_v1(p_draft uuid,p_mutation uuid,p_mode text default 'apply',p_session uuid default null) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_payload jsonb; v_prior public.shopping_v1_mutations%rowtype; v_draft public.receipt_drafts%rowtype;
 v_event public.shopping_events%rowtype; it public.shopping_list_items%rowtype; v_changes jsonb:='[]'::jsonb; v_matched jsonb:='[]'::jsonb;
 v_partial jsonb:='[]'::jsonb; v_ambiguous jsonb:='[]'::jsonb; v_unmatched jsonb:='[]'::jsonb; v_lots integer; v_unknown integer; v_bought numeric;
 v_base text; v_factor numeric; v_after public.shopping_list_items%rowtype; v_result jsonb; v_remaining numeric; v_session uuid:=p_session;
begin
 if v_uid is null then return jsonb_build_object('error','AUTH_REQUIRED'); end if;
 if p_draft is null or p_mutation is null or p_mode is null or p_mode not in('apply','skip') then return jsonb_build_object('error','INVALID_REQUEST'); end if;
 v_payload:=jsonb_build_object('op','reconcile','draft',p_draft,'mode',p_mode,'session',p_session);
 perform pg_advisory_xact_lock(hashtextextended('shop-v1:'||v_uid::text,0));
 select * into v_prior from public.shopping_v1_mutations where user_id=v_uid and client_mutation_id=p_mutation;
 if found then
  if v_prior.payload<>v_payload then return jsonb_build_object('error','MUTATION_CONFLICT'); end if;
  return v_prior.result||jsonb_build_object('status','duplicate');
 end if;
 select * into v_draft from public.receipt_drafts where id=p_draft and user_id=v_uid;
 if not found or v_draft.confirmed_at is null then return jsonb_build_object('error','DRAFT_NOT_FOUND'); end if;
 select * into v_event from public.shopping_events where user_id=v_uid and draft_id=p_draft and kind in('reconcile','skip');
 if found then
  v_result:=v_event.summary||jsonb_build_object('contract','shopping-reconcile-v1','status','duplicate','eventId',v_event.id,'undoUntil',v_event.undo_until);
  insert into public.shopping_v1_mutations(user_id,client_mutation_id,payload,result) values(v_uid,p_mutation,v_payload,v_result);
  return v_result;
 end if;
 if p_session is not null and not exists(select 1 from public.shopping_sessions where id=p_session and user_id=v_uid) then v_session:=null; end if;
 if p_mode='apply' then
  for it in select * from public.shopping_list_items where user_id=v_uid and deleted_at is null and purchased_at is null and selection='selected' order by created_at,id for update loop
   if it.food_concept_id is null then v_ambiguous:=v_ambiguous||jsonb_build_object('itemId',it.id,'reason','NO_CONCEPT'); continue; end if;
   select count(*),count(*) filter(where l.stock_mode<>'exact' or l.quantity_exact is null) into v_lots,v_unknown
    from public.inventory_items l where l.id=any(v_draft.confirmed_item_ids) and l.user_id=v_uid and l.food_concept_id=it.food_concept_id and l.deleted_at is null;
   if v_lots=0 then v_unmatched:=v_unmatched||jsonb_build_object('itemId',it.id); continue; end if;
   if it.quantity is null then
    v_bought:=null;
   else
    select base,factor into v_base,v_factor from public.shop_unit_v1(it.unit);
    select coalesce(sum(l.quantity_exact*u.factor),0)/coalesce(v_factor,1) into v_bought
     from public.inventory_items l join lateral public.shop_unit_v1(l.quantity_unit) u on true
     where l.id=any(v_draft.confirmed_item_ids) and l.user_id=v_uid and l.food_concept_id=it.food_concept_id and l.deleted_at is null
      and l.stock_mode='exact' and l.quantity_exact is not null and u.base is not distinct from v_base;
   end if;
   if it.quantity is null or v_bought>=it.quantity then
    update public.shopping_list_items set purchased_at=statement_timestamp(),purchase_ref=p_draft,shopping_session_id=v_session,version=version+1,updated_at=now() where id=it.id returning * into v_after;
    v_matched:=v_matched||jsonb_build_object('itemId',it.id);
    v_changes:=v_changes||jsonb_build_object('itemId',it.id,'kind','purchased','before',jsonb_build_object('quantity',it.quantity,'purchasedAt',it.purchased_at,'purchaseRef',it.purchase_ref,'sessionId',it.shopping_session_id),'afterVersion',v_after.version);
   elsif v_unknown>0 or v_bought=0 then
    v_ambiguous:=v_ambiguous||jsonb_build_object('itemId',it.id,'reason','QUANTITY_UNKNOWN');
   else
    v_remaining:=it.quantity-v_bought;
    update public.shopping_list_items set quantity=v_remaining,version=version+1,updated_at=now() where id=it.id returning * into v_after;
    v_partial:=v_partial||jsonb_build_object('itemId',it.id,'remaining',v_remaining);
    v_changes:=v_changes||jsonb_build_object('itemId',it.id,'kind','partial','before',jsonb_build_object('quantity',it.quantity,'purchasedAt',it.purchased_at,'purchaseRef',it.purchase_ref,'sessionId',it.shopping_session_id),'afterVersion',v_after.version);
   end if;
  end loop;
 end if;
 v_result:=jsonb_build_object('matched',v_matched,'partial',v_partial,'ambiguous',v_ambiguous,'unmatched',v_unmatched);
 insert into public.shopping_events(user_id,draft_id,session_id,kind,changes,summary,undo_until)
  values(v_uid,p_draft,v_session,case when p_mode='skip' then 'skip' else 'reconcile' end,v_changes,v_result,statement_timestamp()+interval '5 minutes') returning * into v_event;
 if v_session is not null then update public.shopping_sessions set status='reconciled',closed_at=statement_timestamp(),draft_id=p_draft where id=v_session and user_id=v_uid; end if;
 v_result:=v_result||jsonb_build_object('contract','shopping-reconcile-v1','status','applied','eventId',v_event.id,'undoUntil',v_event.undo_until);
 insert into public.shopping_v1_mutations(user_id,client_mutation_id,payload,result) values(v_uid,p_mutation,v_payload,v_result);
 return v_result;
end $$;

create function public.undo_shopping_reconciliation_v1(p_event uuid,p_mutation uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_payload jsonb; v_prior public.shopping_v1_mutations%rowtype; v_event public.shopping_events%rowtype;
 v_comp public.shopping_events%rowtype; c jsonb; v_item public.shopping_list_items%rowtype; v_result jsonb;
begin
 if v_uid is null then return jsonb_build_object('error','AUTH_REQUIRED'); end if;
 if p_event is null or p_mutation is null then return jsonb_build_object('error','INVALID_REQUEST'); end if;
 v_payload:=jsonb_build_object('op','undo','event',p_event);
 perform pg_advisory_xact_lock(hashtextextended('shop-v1:'||v_uid::text,0));
 select * into v_prior from public.shopping_v1_mutations where user_id=v_uid and client_mutation_id=p_mutation;
 if found then
  if v_prior.payload<>v_payload then return jsonb_build_object('error','MUTATION_CONFLICT'); end if;
  return v_prior.result||jsonb_build_object('status','duplicate');
 end if;
 select * into v_event from public.shopping_events where id=p_event and user_id=v_uid and compensates is null;
 if not found or v_event.kind<>'reconcile' then return jsonb_build_object('error','ITEM_NOT_FOUND'); end if;
 select * into v_comp from public.shopping_events where compensates=v_event.id;
 if found then
  v_result:=jsonb_build_object('contract','shopping-undo-v1','status','duplicate','eventId',v_comp.id);
  insert into public.shopping_v1_mutations(user_id,client_mutation_id,payload,result) values(v_uid,p_mutation,v_payload,v_result);
  return v_result;
 end if;
 if statement_timestamp()>v_event.undo_until then return jsonb_build_object('error','UNDO_EXPIRED'); end if;
 for c in select value from jsonb_array_elements(v_event.changes) loop
  select * into v_item from public.shopping_list_items where id=(c->>'itemId')::uuid and user_id=v_uid for update;
  if not found or v_item.deleted_at is not null or v_item.version<>(c->>'afterVersion')::bigint then return jsonb_build_object('error','UNDO_CONFLICT'); end if;
 end loop;
 for c in select value from jsonb_array_elements(v_event.changes) loop
  update public.shopping_list_items set quantity=(c#>>'{before,quantity}')::numeric,purchased_at=(c#>>'{before,purchasedAt}')::timestamptz,
   purchase_ref=(c#>>'{before,purchaseRef}')::uuid,shopping_session_id=(c#>>'{before,sessionId}')::uuid,version=version+1,updated_at=now()
   where id=(c->>'itemId')::uuid and user_id=v_uid;
 end loop;
 insert into public.shopping_events(user_id,draft_id,session_id,kind,changes,summary,undo_until,compensates)
  values(v_uid,v_event.draft_id,v_event.session_id,'compensation',v_event.changes,'{}'::jsonb,statement_timestamp(),v_event.id) returning * into v_comp;
 v_result:=jsonb_build_object('contract','shopping-undo-v1','status','applied','eventId',v_comp.id);
 insert into public.shopping_v1_mutations(user_id,client_mutation_id,payload,result) values(v_uid,p_mutation,v_payload,v_result);
 return v_result;
end $$;

revoke all on function public.shop_concept_for_v1(text,text),public.shop_unit_v1(text),public.shop_before_item(),public.shop_after_item(),public.shop_after_today(),
 public.shop_refresh_suggestions_v1(uuid),public.shop_consolidate_v1(uuid),public.shop_item_json(public.shopping_list_items),public.shop_list_v1(),
 public.apply_shop_mutation_v1(uuid,text,uuid,bigint,text,numeric,text),public.start_shopping_session_v1(uuid),
 public.reconcile_shopping_after_receipt_v1(uuid,uuid,text,uuid),public.undo_shopping_reconciliation_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.shop_list_v1(),public.apply_shop_mutation_v1(uuid,text,uuid,bigint,text,numeric,text),public.start_shopping_session_v1(uuid),
 public.reconcile_shopping_after_receipt_v1(uuid,uuid,text,uuid),public.undo_shopping_reconciliation_v1(uuid,uuid) to authenticated;
