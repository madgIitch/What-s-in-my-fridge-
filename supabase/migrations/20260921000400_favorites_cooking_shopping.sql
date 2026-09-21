-- Sprint 8: additive favorites, atomic cooking, and explicit shopping list.
alter table public.favorite_recipes
  add column if not exists snapshot jsonb,
  add column if not exists snapshot_version integer not null default 1 check (snapshot_version > 0);

update public.favorite_recipes set snapshot = jsonb_build_object(
  'version', 1, 'title', name,
  'ingredients', coalesce((select jsonb_agg(jsonb_build_object('ingredientKey',null,'name',value #>> '{}','quantity',null,'unit',null)) from jsonb_array_elements(ingredients_with_measures)), '[]'::jsonb),
  'instructions', jsonb_build_array(instructions)
) where snapshot is null;

alter table public.favorite_recipes alter column snapshot set not null;
alter table public.favorite_recipes add constraint favorite_snapshot_object check (
  jsonb_typeof(snapshot) = 'object' and snapshot ? 'title' and snapshot ? 'ingredients' and snapshot ? 'instructions'
  and jsonb_typeof(snapshot->'ingredients') = 'array' and jsonb_typeof(snapshot->'instructions') = 'array'
);
with ranked as (
  select id,row_number() over(partition by user_id,recipe_id order by saved_at desc,created_at desc,id) as position
  from public.favorite_recipes where deleted_at is null
)
update public.favorite_recipes f set deleted_at=clock_timestamp(),updated_at=clock_timestamp(),version=version+1
from ranked where ranked.id=f.id and ranked.position>1;
create unique index favorite_recipes_one_active_idx on public.favorite_recipes(user_id, recipe_id) where deleted_at is null;

create or replace function public.favorite_snapshot_immutable() returns trigger language plpgsql set search_path='' as $$
begin if old.snapshot is distinct from new.snapshot then raise exception 'favorite snapshot is immutable' using errcode='23514'; end if; return new; end $$;
create trigger favorite_snapshot_immutable_before_update before update on public.favorite_recipes for each row execute function public.favorite_snapshot_immutable();

create table public.favorite_mutations (
  id uuid primary key default extensions.gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  client_mutation_id uuid not null, recipe_id text not null, payload jsonb not null,
  status text not null check (status in ('applied','conflict','rejected')), code text not null,
  result jsonb, conflicts jsonb not null default '[]'::jsonb, created_at timestamptz not null default now(),
  unique(user_id, client_mutation_id)
);

create table public.cooking_mutations (
  id uuid primary key default extensions.gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  client_mutation_id uuid not null, payload jsonb not null,
  status text not null check (status in ('applied','conflict','rejected')), code text not null,
  result jsonb, conflicts jsonb not null default '[]'::jsonb, created_at timestamptz not null default now(),
  unique(user_id, client_mutation_id)
);

create table public.shopping_list_items (
  id uuid primary key default extensions.gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  ingredient_key text, name text not null check (btrim(name) <> ''), quantity numeric check (quantity is null or quantity >= 0), unit text,
  checked boolean not null default false, deleted_at timestamptz, version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.shopping_list_mutations (
  id uuid primary key default extensions.gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  client_mutation_id uuid not null, payload jsonb not null,
  status text not null check (status in ('applied','conflict','rejected')), code text not null,
  result jsonb, conflicts jsonb not null default '[]'::jsonb, created_at timestamptz not null default now(),
  unique(user_id, client_mutation_id)
);

alter table public.favorite_mutations enable row level security;
alter table public.cooking_mutations enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.shopping_list_mutations enable row level security;
create policy favorite_mutations_select_own on public.favorite_mutations for select to authenticated using (user_id = auth.uid());
create policy cooking_mutations_select_own on public.cooking_mutations for select to authenticated using (user_id = auth.uid());
create policy shopping_items_all_own on public.shopping_list_items for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy shopping_mutations_select_own on public.shopping_list_mutations for select to authenticated using (user_id = auth.uid());

create or replace function public.apply_favorite_mutation(p_client_mutation_id uuid, p_recipe_id text, p_desired_state text, p_snapshot jsonb default null, p_expected_version bigint default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_prior public.favorite_mutations%rowtype; v_row public.favorite_recipes%rowtype; v_result jsonb; v_status text := 'applied'; v_code text := 'OK';
begin
  if v_uid is null then return jsonb_build_object('client_mutation_id',p_client_mutation_id,'status','rejected','code','UNAUTHENTICATED','result',null,'conflicts','[]'::jsonb); end if;
  select * into v_prior from public.favorite_mutations where user_id=v_uid and client_mutation_id=p_client_mutation_id;
  if found then return jsonb_build_object('client_mutation_id',p_client_mutation_id,'status','duplicate','code',v_prior.code,'result',v_prior.result,'conflicts',v_prior.conflicts); end if;
  if p_desired_state not in ('saved','removed') or nullif(btrim(p_recipe_id),'') is null then v_status:='rejected'; v_code:='VALIDATION_ERROR';
  else
    select * into v_row from public.favorite_recipes where user_id=v_uid and recipe_id=p_recipe_id order by (deleted_at is null) desc, updated_at desc limit 1 for update;
    if p_desired_state='saved' then
      if found and v_row.deleted_at is null then null;
      elsif p_snapshot is null or jsonb_typeof(p_snapshot)<>'object' or jsonb_typeof(p_snapshot->'ingredients')<>'array' or jsonb_typeof(p_snapshot->'instructions')<>'array' or nullif(btrim(p_snapshot->>'title'),'') is null then v_status:='rejected'; v_code:='VALIDATION_ERROR'; v_row:=null;
      elsif found then update public.favorite_recipes set deleted_at=null, saved_at=now(), version=version+1, updated_at=now() where id=v_row.id returning * into v_row;
      else insert into public.favorite_recipes(user_id,recipe_id,name,match_percentage,instructions,saved_at,snapshot,snapshot_version) values(v_uid,p_recipe_id,p_snapshot->>'title',0,'',now(),p_snapshot,coalesce((p_snapshot->>'version')::int,1)) returning * into v_row; end if;
    elsif not found or v_row.deleted_at is not null then null;
    elsif p_expected_version is not null and v_row.version<>p_expected_version then v_status:='conflict'; v_code:='VERSION_CONFLICT';
    else update public.favorite_recipes set deleted_at=now(),version=version+1,updated_at=now() where id=v_row.id returning * into v_row; end if;
  end if;
  v_result:=case when v_row.id is null then null else to_jsonb(v_row) end;
  insert into public.favorite_mutations(user_id,client_mutation_id,recipe_id,payload,status,code,result) values(v_uid,p_client_mutation_id,p_recipe_id,jsonb_build_object('desired_state',p_desired_state,'snapshot',p_snapshot,'expected_version',p_expected_version),v_status,v_code,v_result);
  return jsonb_build_object('client_mutation_id',p_client_mutation_id,'status',v_status,'code',v_code,'result',v_result,'conflicts','[]'::jsonb);
exception when unique_violation then
 select * into v_prior from public.favorite_mutations where user_id=v_uid and client_mutation_id=p_client_mutation_id;
 if found then return jsonb_build_object('client_mutation_id',p_client_mutation_id,'status','duplicate','code',v_prior.code,'result',v_prior.result,'conflicts',v_prior.conflicts); end if;
 select * into v_row from public.favorite_recipes where user_id=v_uid and recipe_id=p_recipe_id and deleted_at is null;
 v_result:=to_jsonb(v_row); insert into public.favorite_mutations(user_id,client_mutation_id,recipe_id,payload,status,code,result) values(v_uid,p_client_mutation_id,p_recipe_id,jsonb_build_object('desired_state',p_desired_state),'applied','OK',v_result);
 return jsonb_build_object('client_mutation_id',p_client_mutation_id,'status','applied','code','OK','result',v_result,'conflicts','[]'::jsonb); end $$;

create or replace function public.apply_cooking_mutation(p_client_mutation_id uuid, p_recipe_snapshot jsonb, p_lines jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=auth.uid(); v_prior public.cooking_mutations%rowtype; v_line jsonb; v_item public.inventory_items%rowtype; v_conflicts jsonb:='[]'::jsonb; v_entry public.meal_entries%rowtype; v_result jsonb; v_requested numeric;
begin
 if v_uid is null then return jsonb_build_object('client_mutation_id',p_client_mutation_id,'status','rejected','code','UNAUTHENTICATED','result',null,'conflicts','[]'::jsonb); end if;
 select * into v_prior from public.cooking_mutations where user_id=v_uid and client_mutation_id=p_client_mutation_id;
 if found then return jsonb_build_object('client_mutation_id',p_client_mutation_id,'status','duplicate','code',v_prior.code,'result',v_prior.result,'conflicts',v_prior.conflicts); end if;
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then insert into public.cooking_mutations(user_id,client_mutation_id,payload,status,code) values(v_uid,p_client_mutation_id,jsonb_build_object('snapshot',p_recipe_snapshot,'lines',p_lines),'rejected','VALIDATION_ERROR'); return jsonb_build_object('client_mutation_id',p_client_mutation_id,'status','rejected','code','VALIDATION_ERROR','result',null,'conflicts','[]'::jsonb); end if;
 for v_line in select value from jsonb_array_elements(p_lines) loop
   select * into v_item from public.inventory_items where id=(v_line->>'inventory_item_id')::uuid and user_id=v_uid for update;
   select sum((value->>'quantity')::numeric) into v_requested from jsonb_array_elements(p_lines) where value->>'inventory_item_id'=v_line->>'inventory_item_id';
   if nullif(btrim(v_line->>'ingredient_key'),'') is null then v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('requested',v_line,'current',null,'code','INGREDIENT_UNMAPPED'));
   elsif not found or v_item.deleted_at is not null then v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('requested',v_line,'current',null,'code','FORBIDDEN'));
   elsif nullif(btrim(v_line->>'unit'),'') is null or v_item.unit<>v_line->>'unit' then v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('requested',v_line,'current',to_jsonb(v_item),'code','UNIT_INCOMPATIBLE'));
   elsif coalesce((v_line->>'quantity')::numeric,0)<=0 or v_item.quantity<v_requested then v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('requested',v_line,'current',to_jsonb(v_item),'code','INSUFFICIENT_QUANTITY'));
   elsif v_item.version<>(v_line->>'expected_version')::bigint then v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('requested',v_line,'current',to_jsonb(v_item),'code','VERSION_CONFLICT')); end if;
 end loop;
 if jsonb_array_length(v_conflicts)>0 then insert into public.cooking_mutations(user_id,client_mutation_id,payload,status,code,conflicts) values(v_uid,p_client_mutation_id,jsonb_build_object('snapshot',p_recipe_snapshot,'lines',p_lines),'conflict',coalesce(v_conflicts->0->>'code','VERSION_CONFLICT'),v_conflicts); return jsonb_build_object('client_mutation_id',p_client_mutation_id,'status','conflict','code',coalesce(v_conflicts->0->>'code','VERSION_CONFLICT'),'result',null,'conflicts',v_conflicts); end if;
 for v_line in select value from jsonb_array_elements(p_lines) loop update public.inventory_items set quantity=quantity-(v_line->>'quantity')::numeric where id=(v_line->>'inventory_item_id')::uuid and user_id=v_uid; end loop;
 insert into public.meal_entries(user_id,meal_type,meal_date,custom_name,ingredients_consumed,consumed_at) values(v_uid,'dinner',current_date,coalesce(p_recipe_snapshot->>'title','Receta'),p_lines,now()) returning * into v_entry;
 v_result:=to_jsonb(v_entry); insert into public.cooking_mutations(user_id,client_mutation_id,payload,status,code,result) values(v_uid,p_client_mutation_id,jsonb_build_object('snapshot',p_recipe_snapshot,'lines',p_lines),'applied','OK',v_result);
 return jsonb_build_object('client_mutation_id',p_client_mutation_id,'status','applied','code','OK','result',v_result,'conflicts','[]'::jsonb);
exception when unique_violation then select * into v_prior from public.cooking_mutations where user_id=v_uid and client_mutation_id=p_client_mutation_id; return jsonb_build_object('client_mutation_id',p_client_mutation_id,'status','duplicate','code',v_prior.code,'result',v_prior.result,'conflicts',v_prior.conflicts); when invalid_text_representation or numeric_value_out_of_range or check_violation then return jsonb_build_object('client_mutation_id',p_client_mutation_id,'status','rejected','code','VALIDATION_ERROR','result',null,'conflicts','[]'::jsonb); end $$;

create or replace function public.apply_shopping_list_mutation(p_client_mutation_id uuid,p_item_id uuid,p_name text,p_ingredient_key text,p_quantity numeric,p_unit text,p_desired_state text,p_expected_version bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_prior public.shopping_list_mutations%rowtype; v_item public.shopping_list_items%rowtype; v_status text:='applied'; v_code text:='OK'; v_result jsonb;
begin
 if v_uid is null then return jsonb_build_object('client_mutation_id',p_client_mutation_id,'status','rejected','code','UNAUTHENTICATED','result',null,'conflicts','[]'::jsonb); end if;
 select * into v_prior from public.shopping_list_mutations where user_id=v_uid and client_mutation_id=p_client_mutation_id; if found then return jsonb_build_object('client_mutation_id',p_client_mutation_id,'status','duplicate','code',v_prior.code,'result',v_prior.result,'conflicts',v_prior.conflicts); end if;
 if p_desired_state not in ('active','removed','checked') or nullif(btrim(p_name),'') is null or p_quantity<0 then v_status:='rejected';v_code:='VALIDATION_ERROR';
 else select * into v_item from public.shopping_list_items where id=p_item_id and user_id=v_uid for update;
   if found and p_expected_version is not null and v_item.version<>p_expected_version then v_status:='conflict';v_code:='VERSION_CONFLICT';
   elsif found then update public.shopping_list_items set name=btrim(p_name),ingredient_key=nullif(btrim(p_ingredient_key),''),quantity=p_quantity,unit=nullif(btrim(p_unit),''),checked=p_desired_state='checked',deleted_at=case when p_desired_state='removed' then now() else null end,version=version+1,updated_at=now() where id=v_item.id returning * into v_item;
   elsif p_desired_state='active' then insert into public.shopping_list_items(id,user_id,name,ingredient_key,quantity,unit) values(coalesce(p_item_id,extensions.gen_random_uuid()),v_uid,btrim(p_name),nullif(btrim(p_ingredient_key),''),p_quantity,nullif(btrim(p_unit),'')) returning * into v_item; end if;
 end if;
 v_result:=case when v_item.id is null then null else to_jsonb(v_item) end; insert into public.shopping_list_mutations(user_id,client_mutation_id,payload,status,code,result) values(v_uid,p_client_mutation_id,jsonb_build_object('item_id',p_item_id,'desired_state',p_desired_state),v_status,v_code,v_result);
 return jsonb_build_object('client_mutation_id',p_client_mutation_id,'status',v_status,'code',v_code,'result',v_result,'conflicts','[]'::jsonb);
exception when unique_violation then select * into v_prior from public.shopping_list_mutations where user_id=v_uid and client_mutation_id=p_client_mutation_id; return jsonb_build_object('client_mutation_id',p_client_mutation_id,'status','duplicate','code',v_prior.code,'result',v_prior.result,'conflicts',v_prior.conflicts); end $$;

revoke all on function public.apply_favorite_mutation(uuid,text,text,jsonb,bigint), public.apply_cooking_mutation(uuid,jsonb,jsonb), public.apply_shopping_list_mutation(uuid,uuid,text,text,numeric,text,text,bigint) from public;
grant execute on function public.apply_favorite_mutation(uuid,text,text,jsonb,bigint), public.apply_cooking_mutation(uuid,jsonb,jsonb), public.apply_shopping_list_mutation(uuid,uuid,text,text,numeric,text,text,bigint) to authenticated;
