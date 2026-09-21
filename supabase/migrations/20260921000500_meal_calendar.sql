-- Sprint 9: additive meal calendar contract. Historical rows remain readable.
alter table public.meal_entries add column if not exists recipe_snapshot jsonb;
alter table public.meal_entries alter column consumed_at drop not null;

update public.meal_entries
set recipe_snapshot = jsonb_build_object(
  'version', 1, 'recipe_id', recipe_id, 'title', coalesce(nullif(btrim(custom_name), ''), 'Comida'),
  'ingredients', '[]'::jsonb, 'instructions', '[]'::jsonb
), custom_name = null
where recipe_id is not null and recipe_snapshot is null;

-- The original text reference predated the catalog FK. Invalid legacy references become
-- null while their historical title remains in recipe_snapshot/custom_name.
alter table public.meal_entries drop constraint if exists meal_entries_recipe_id_fkey;

update public.meal_entries
set recipe_id = null
where recipe_id is not null
  and recipe_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

update public.meal_entries as meal
set recipe_id = null
where meal.recipe_id is not null
  and not exists (
    select 1
    from public.recipes as recipe
    where recipe.id = meal.recipe_id::uuid
  );

alter table public.meal_entries alter column recipe_id type uuid
using recipe_id::uuid;
alter table public.meal_entries add constraint meal_entries_recipe_id_fkey
  foreign key (recipe_id) references public.recipes(id) on delete set null;

alter table public.meal_entries drop constraint if exists meal_entries_check;
alter table public.meal_entries add constraint meal_entries_identity_check check (
  (recipe_snapshot is not null and custom_name is null) or
  (recipe_snapshot is null and nullif(btrim(custom_name), '') is not null)
);
alter table public.meal_entries add constraint meal_entries_recipe_snapshot_check check (
  recipe_snapshot is null or (
    jsonb_typeof(recipe_snapshot)='object' and recipe_snapshot->>'version'='1' and
    nullif(btrim(recipe_snapshot->>'title'),'') is not null and
    jsonb_typeof(recipe_snapshot->'ingredients')='array' and jsonb_typeof(recipe_snapshot->'instructions')='array'
  )
);

create or replace function public.valid_meal_consumed(value jsonb) returns boolean
language sql immutable set search_path='' as $$
 select jsonb_typeof(value)='array' and not exists(
  select 1 from jsonb_array_elements(value) x where
   jsonb_typeof(x)<>'object' or nullif(btrim(x->>'name'),'') is null or
   (x ? 'quantity' and x->'quantity'<>'null'::jsonb and (((x->>'quantity')::numeric)<=0 or nullif(btrim(x->>'unit'),'') is null))
 )
$$;

-- Sprint 8 cooking mutations did not include a display name in each consumed
-- line. Preserve that contract while storing the stricter Sprint 9 shape.
create or replace function public.normalize_legacy_meal_consumed() returns trigger
language plpgsql set search_path='' as $$
begin
 if jsonb_typeof(new.ingredients_consumed) = 'array' then
  select coalesce(
   jsonb_agg(
    case
     when nullif(btrim(item.value->>'name'), '') is not null then item.value
     else item.value || jsonb_build_object(
      'name', coalesce(nullif(btrim(item.value->>'ingredient_key'), ''), 'Ingrediente')
     )
    end
    order by item.ordinality
   ),
   '[]'::jsonb
  )
  into new.ingredients_consumed
  from jsonb_array_elements(new.ingredients_consumed) with ordinality as item(value, ordinality);
 end if;
 return new;
end $$;

drop trigger if exists normalize_legacy_meal_consumed on public.meal_entries;
create trigger normalize_legacy_meal_consumed
before insert or update of ingredients_consumed on public.meal_entries
for each row execute function public.normalize_legacy_meal_consumed();

alter table public.meal_entries add constraint meal_entries_consumed_v1_check check (public.valid_meal_consumed(ingredients_consumed));

create table public.meal_mutations (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 client_mutation_id uuid not null,
 meal_entry_id uuid not null,
 request_hash text not null,
 status text not null check(status in ('applied','duplicate','conflict','rejected')),
 code text not null,
 result jsonb,
 conflicts jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now(),
 unique(user_id,client_mutation_id)
);
alter table public.meal_mutations enable row level security;
create policy meal_mutations_owner_select on public.meal_mutations for select to authenticated using(user_id=auth.uid());
create policy meal_mutations_owner_insert on public.meal_mutations for insert to authenticated with check(user_id=auth.uid());
create index meal_entries_pull_idx on public.meal_entries(user_id,updated_at,id);

create or replace function public.apply_meal_mutation(
 p_client_mutation_id uuid, p_operation text, p_meal_entry_id uuid,
 p_expected_version bigint default null, p_payload jsonb default null
) returns jsonb language plpgsql security definer set search_path='public','extensions' as $$
declare v_uid uuid:=auth.uid(); v_prior public.meal_mutations%rowtype; v_row public.meal_entries%rowtype;
 v_status text; v_code text; v_result jsonb; v_conflicts jsonb:='[]'::jsonb; v_hash text;
begin
 if v_uid is null then raise exception 'authentication required' using errcode='42501'; end if;
 v_hash:=encode(digest(jsonb_build_object('operation',p_operation,'meal_entry_id',p_meal_entry_id,'expected_version',p_expected_version,'payload',p_payload)::text,'sha256'),'hex');
 select * into v_prior from public.meal_mutations where user_id=v_uid and client_mutation_id=p_client_mutation_id;
 if found then return jsonb_build_object('client_mutation_id',p_client_mutation_id,'status','duplicate','code',v_prior.code,'result',v_prior.result,'conflicts',v_prior.conflicts); end if;

 if p_operation not in ('create','update','delete') or (p_operation='create' and p_expected_version is not null)
   or (p_operation in ('update','delete') and coalesce(p_expected_version,0)<=0)
   or (p_operation='delete' and p_payload is not null) then
   v_status:='rejected'; v_code:='VALIDATION_ERROR';
 elsif p_operation in ('create','update') and (p_payload is null or
   (p_payload->>'meal_type') not in ('breakfast','lunch','dinner','snack') or
   not ((p_payload->>'meal_date') ~ '^\d{4}-\d{2}-\d{2}$') or
   not public.valid_meal_consumed(coalesce(p_payload->'ingredients_consumed','[]'::jsonb)) or
   not (((p_payload->'recipe_snapshot') is not null and p_payload->'recipe_snapshot'<>'null'::jsonb and nullif(btrim(p_payload->>'custom_name'),'') is null)
        or ((p_payload->'recipe_snapshot') is null or p_payload->'recipe_snapshot'='null'::jsonb) and nullif(btrim(p_payload->>'custom_name'),'') is not null)) then
   v_status:='rejected'; v_code:='VALIDATION_ERROR';
 elsif p_operation='create' then
   select * into v_row from public.meal_entries where id=p_meal_entry_id;
   if found then v_status:='conflict';v_code:='ALREADY_EXISTS';v_result:=to_jsonb(v_row);v_conflicts:=jsonb_build_array(jsonb_build_object('entity_id',p_meal_entry_id,'expected_version',null,'current',v_result));
   else
    insert into public.meal_entries(id,user_id,meal_type,meal_date,recipe_id,recipe_snapshot,custom_name,ingredients_consumed,notes,calories_estimate,consumed_at)
    values(p_meal_entry_id,v_uid,p_payload->>'meal_type',(p_payload->>'meal_date')::date,nullif(p_payload->>'recipe_id','')::uuid,p_payload->'recipe_snapshot',nullif(btrim(p_payload->>'custom_name'),''),coalesce(p_payload->'ingredients_consumed','[]'),nullif(p_payload->>'notes',''),nullif(p_payload->>'calories_estimate','')::numeric,nullif(p_payload->>'consumed_at','')::timestamptz)
    returning * into v_row; v_status:='applied';v_code:='OK';v_result:=to_jsonb(v_row);
   end if;
 else
   select * into v_row from public.meal_entries where id=p_meal_entry_id and user_id=v_uid for update;
   if not found then v_status:='rejected';v_code:='NOT_FOUND';v_result:=null;
   elsif v_row.deleted_at is not null then
    v_result:=to_jsonb(v_row); if p_operation='delete' then v_status:='applied';v_code:='ALREADY_DELETED'; else v_status:='conflict';v_code:='ALREADY_DELETED';v_conflicts:=jsonb_build_array(jsonb_build_object('entity_id',p_meal_entry_id,'expected_version',p_expected_version,'current',v_result)); end if;
   elsif v_row.version<>p_expected_version then v_status:='conflict';v_code:='VERSION_CONFLICT';v_result:=to_jsonb(v_row);v_conflicts:=jsonb_build_array(jsonb_build_object('entity_id',p_meal_entry_id,'expected_version',p_expected_version,'current',v_result));
   elsif p_operation='delete' then update public.meal_entries set deleted_at=now(),version=version+1,updated_at=now() where id=p_meal_entry_id returning * into v_row;v_status:='applied';v_code:='OK';v_result:=to_jsonb(v_row);
   else update public.meal_entries set meal_type=p_payload->>'meal_type',meal_date=(p_payload->>'meal_date')::date,recipe_id=nullif(p_payload->>'recipe_id','')::uuid,recipe_snapshot=p_payload->'recipe_snapshot',custom_name=nullif(btrim(p_payload->>'custom_name'),''),ingredients_consumed=coalesce(p_payload->'ingredients_consumed','[]'),notes=nullif(p_payload->>'notes',''),calories_estimate=nullif(p_payload->>'calories_estimate','')::numeric,consumed_at=nullif(p_payload->>'consumed_at','')::timestamptz,version=version+1,updated_at=now() where id=p_meal_entry_id returning * into v_row;v_status:='applied';v_code:='OK';v_result:=to_jsonb(v_row);
   end if;
 end if;
 insert into public.meal_mutations(user_id,client_mutation_id,meal_entry_id,request_hash,status,code,result,conflicts) values(v_uid,p_client_mutation_id,p_meal_entry_id,v_hash,v_status,v_code,v_result,v_conflicts);
 return jsonb_build_object('client_mutation_id',p_client_mutation_id,'status',v_status,'code',v_code,'result',v_result,'conflicts',v_conflicts);
end $$;

create or replace function public.pull_meal_entries(p_cursor_updated_at timestamptz default null,p_cursor_id uuid default null,p_limit integer default 200)
returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_uid uuid:=auth.uid(); v_rows jsonb; v_count int; v_last jsonb;
begin
 if v_uid is null then raise exception 'authentication required' using errcode='42501'; end if;
 if p_limit<1 or p_limit>500 or ((p_cursor_updated_at is null)<>(p_cursor_id is null)) then raise exception 'invalid cursor' using errcode='22023'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.updated_at,x.id),'[]'),count(*) into v_rows,v_count from (select * from public.meal_entries where user_id=v_uid and (p_cursor_updated_at is null or (updated_at,id)>(p_cursor_updated_at,p_cursor_id)) order by updated_at,id limit p_limit) x;
 v_last:=case when v_count=0 then null else v_rows->(v_count-1) end;
 return jsonb_build_object('entries',v_rows,'next_cursor',case when v_last is null then null else jsonb_build_object('updated_at',v_last->>'updated_at','id',v_last->>'id') end,'has_more',v_count=p_limit);
end $$;
revoke all on function public.apply_meal_mutation(uuid,text,uuid,bigint,jsonb), public.pull_meal_entries(timestamptz,uuid,integer) from public;
grant execute on function public.apply_meal_mutation(uuid,text,uuid,bigint,jsonb), public.pull_meal_entries(timestamptz,uuid,integer) to authenticated;
grant select on public.meal_mutations to authenticated;
