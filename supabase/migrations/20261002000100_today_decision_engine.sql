-- Sprint R2: bounded Today candidates, private cache and atomic shopping replay.
-- Additive only: legacy suggestion cache/quota and shopping RPC remain unchanged.

create table public.today_recommendation_cache (
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_key uuid not null,
  cache_key text not null check (cache_key ~ '^[a-f0-9]{64}$'),
  civil_date date not null,
  catalog_version_id uuid not null references public.catalog_versions(id),
  matcher_version text not null,
  recommendation_version text not null,
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null check (expires_at <= created_at + interval '60 minutes'),
  primary key (user_id, snapshot_key),
  unique (user_id, cache_key)
);

create index today_recommendation_cache_expiry_idx
  on public.today_recommendation_cache(user_id, expires_at desc);

create table public.today_shopping_mutations (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_mutation_id uuid not null,
  recipe_id uuid not null references public.recipes(id),
  snapshot_key uuid not null,
  item_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now(),
  primary key (user_id, client_mutation_id)
);

alter table public.today_recommendation_cache enable row level security;
alter table public.today_shopping_mutations enable row level security;
create policy today_cache_select_own on public.today_recommendation_cache
  for select to authenticated using (user_id = auth.uid());
create policy today_shopping_mutations_select_own on public.today_shopping_mutations
  for select to authenticated using (user_id = auth.uid());

-- Writes to the cache are server-only. The web route rechecks the session and uses
-- service_role so a browser cannot forge cached shopping authorization or ownership.
revoke all on public.today_recommendation_cache, public.today_shopping_mutations from anon, authenticated;
grant select on public.today_recommendation_cache, public.today_shopping_mutations to authenticated;
grant all on public.today_recommendation_cache, public.today_shopping_mutations to service_role;

create index if not exists food_concept_aliases_normalized_lookup_idx
  on public.food_concept_aliases(normalized_alias, food_concept_id);
create index if not exists food_concepts_normalized_name_idx
  on public.food_concepts(public.r1_normalize_text(display_name), id);
create index if not exists favorite_recipes_active_recipe_lookup_idx
  on public.favorite_recipes(user_id, recipe_id) where deleted_at is null;

create or replace function public.today_parse_measure_v1(value text)
returns table(quantity numeric, unit text)
language sql immutable parallel safe set search_path = '' as $$
  with matched as (
    select regexp_match(lower(btrim(coalesce(value, ''))), '^(\d+(?:[\.,]\d+)?)\s*(g|kg|ml|l|unidad|unidades|unit|pack|packs)$') as parts
  )
  select
    case when parts[2] in ('kg', 'l') then replace(parts[1], ',', '.')::numeric * 1000
         else replace(parts[1], ',', '.')::numeric end,
    case when parts[2] in ('g', 'kg') then 'g'
         when parts[2] in ('ml', 'l') then 'ml'
         when parts[2] in ('unidad', 'unidades', 'unit') then 'unit'
         else 'pack' end
  from matched where parts is not null and replace(parts[1], ',', '.')::numeric > 0
$$;

create or replace function public.today_state_key_for_user_v1(
  p_user_id uuid,
  p_date date,
  p_matcher_version text,
  p_recommendation_version text
) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := p_user_id;
  v_catalog public.catalog_versions%rowtype;
  v_payload jsonb;
begin
  if v_uid is null then return null; end if;
  select * into v_catalog from public.catalog_versions where active limit 1;
  if not found then return null; end if;
  v_payload := jsonb_build_object(
    'date', p_date,
    'matcherVersion', p_matcher_version,
    'recommendationVersion', p_recommendation_version,
    'catalog', jsonb_build_object('id', v_catalog.id, 'checksum', v_catalog.checksum, 'sourceVersion', v_catalog.source_version, 'recipeCount', v_catalog.recipe_count, 'ingredientCount', v_catalog.ingredient_count),
    'recipes', coalesce((
      select jsonb_agg(jsonb_build_array(r.id, r.name, r.instructions, r.metadata) order by r.id::text collate "C")
      from public.recipes r where r.catalog_version_id = v_catalog.id
    ), '[]'::jsonb),
    'recipeIngredients', coalesce((
      select jsonb_agg(jsonb_build_array(ri.id, ri.recipe_id, ri.position, ri.name, ri.normalized_name, ri.measure, ri.food_concept_id)
        order by ri.recipe_id::text collate "C", ri.position, ri.id::text collate "C")
      from public.recipe_ingredients ri join public.recipes r on r.id = ri.recipe_id
      where r.catalog_version_id = v_catalog.id
    ), '[]'::jsonb),
    'pantry', coalesce((
      select jsonb_agg(jsonb_build_array(i.id, i.food_concept_id, i.deleted_at, i.normalization_status,
        i.stock_mode, i.stock_state, i.quantity_precision, i.quantity_exact, i.quantity_unit,
        i.freshness_precision, i.freshness_source, i.acquired_on, i.freshness_estimated_days, i.expiry_date_exact,
        i.version, i.updated_at) order by i.id)
      from public.inventory_items i where i.user_id = v_uid
    ), '[]'::jsonb),
    'concepts', coalesce((
      select jsonb_agg(jsonb_build_array(c.id, c.display_name, c.updated_at) order by c.id) from public.food_concepts c
    ), '[]'::jsonb),
    'aliases', coalesce((
      select jsonb_agg(jsonb_build_array(a.normalized_alias, a.food_concept_id, a.source) order by a.normalized_alias, a.food_concept_id, a.source)
      from public.food_concept_aliases a
    ), '[]'::jsonb),
    'favorites', coalesce((
      select jsonb_agg(f.recipe_id order by f.recipe_id) from public.favorite_recipes f where f.user_id = v_uid and f.deleted_at is null
    ), '[]'::jsonb)
  );
  return encode(extensions.digest(convert_to(v_payload::text, 'UTF8'), 'sha256'), 'hex');
end $$;

create or replace function public.today_state_key_v1(
  p_date date,
  p_matcher_version text,
  p_recommendation_version text
) returns text
language sql stable security definer set search_path = '' as $$
  select public.today_state_key_for_user_v1(auth.uid(), p_date, p_matcher_version, p_recommendation_version)
$$;

create or replace function public.today_lock_snapshot_v1()
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  lock table public.catalog_versions in share mode;
  lock table public.recipes in share mode;
  lock table public.recipe_ingredients in share mode;
  lock table public.food_concepts in share mode;
  lock table public.food_concept_aliases in share mode;
  lock table public.inventory_items in share mode;
  lock table public.favorite_recipes in share mode;
  lock table public.today_recommendation_cache in share row exclusive mode;
end $$;

create or replace function public.read_today_cache_v1(
  p_date date, p_matcher_version text, p_recommendation_version text
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_key text; v_cache public.today_recommendation_cache%rowtype;
begin
  if v_uid is null then return jsonb_build_object('action','unauthorized'); end if;
  perform public.today_lock_snapshot_v1();
  v_key := public.today_state_key_for_user_v1(v_uid, p_date, p_matcher_version, p_recommendation_version);
  if v_key is null then return jsonb_build_object('action','catalog_missing'); end if;
  select * into v_cache from public.today_recommendation_cache
    where user_id = v_uid and cache_key = v_key and expires_at > statement_timestamp();
  if found then return jsonb_build_object('action','hit','cacheKey',v_key,'result',v_cache.result); end if;
  return jsonb_build_object('action','miss','cacheKey',v_key);
end $$;

create or replace function public.store_today_cache_v1(
  p_user_id uuid, p_date date, p_matcher_version text, p_recommendation_version text,
  p_cache_key text, p_snapshot_key uuid, p_result jsonb
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_key text; v_catalog_id uuid; v_cache public.today_recommendation_cache%rowtype;
begin
  if p_user_id is null or p_result is null or jsonb_typeof(p_result) <> 'object' then
    return jsonb_build_object('action','invalid');
  end if;
  perform public.today_lock_snapshot_v1();
  v_key := public.today_state_key_for_user_v1(p_user_id, p_date, p_matcher_version, p_recommendation_version);
  if v_key is distinct from p_cache_key then return jsonb_build_object('action','stale'); end if;
  select id into v_catalog_id from public.catalog_versions where active limit 1;
  insert into public.today_recommendation_cache(
    user_id,snapshot_key,cache_key,civil_date,catalog_version_id,matcher_version,recommendation_version,result,created_at,expires_at
  ) values (
    p_user_id,p_snapshot_key,p_cache_key,p_date,v_catalog_id,p_matcher_version,p_recommendation_version,p_result,
    statement_timestamp(),statement_timestamp()+interval '60 minutes'
  ) on conflict(user_id,cache_key) do update set
    snapshot_key=excluded.snapshot_key,result=excluded.result,created_at=excluded.created_at,expires_at=excluded.expires_at,
    civil_date=excluded.civil_date,catalog_version_id=excluded.catalog_version_id,
    matcher_version=excluded.matcher_version,recommendation_version=excluded.recommendation_version
  where public.today_recommendation_cache.expires_at <= statement_timestamp();
  select * into v_cache from public.today_recommendation_cache
    where user_id=p_user_id and cache_key=p_cache_key and expires_at > statement_timestamp();
  return jsonb_build_object('action','stored','result',v_cache.result);
end $$;

create or replace function public.find_today_recipe_candidates_v1(p_limit integer default 250)
returns table(recipe_id uuid, overlap_count bigint, source_rank integer)
language sql stable security definer set search_path = '' as $$
  with active_catalog as (
    select id from public.catalog_versions where active limit 1
  ), pantry_concepts as (
    select distinct i.food_concept_id
    from public.inventory_items i
    where i.user_id = auth.uid() and i.deleted_at is null and i.food_concept_id is not null
      and i.normalization_status = 'confirmed'
      and ((i.stock_mode = 'presence' and i.stock_state = 'present')
        or (i.stock_mode = 'qualitative' and i.stock_state in ('plenty', 'some', 'low'))
        or (i.stock_mode = 'exact' and i.quantity_exact > 0 and i.stock_state is distinct from 'empty'))
  ), eligible as (
    select r.id
    from public.recipes r join active_catalog c on c.id = r.catalog_version_id
    where btrim(r.instructions) <> '' and exists (select 1 from public.recipe_ingredients ri where ri.recipe_id = r.id)
  ), resolved_ingredients as (
    select ri.recipe_id, coalesce(ri.food_concept_id, exact_match.food_concept_id) as food_concept_id
    from public.recipe_ingredients ri join eligible e on e.id = ri.recipe_id
    left join lateral (
      select min(candidate.food_concept_id::text)::uuid as food_concept_id
      from (
        select c.id as food_concept_id from public.food_concepts c
        where public.r1_normalize_text(c.display_name) = public.r1_normalize_text(coalesce(ri.normalized_name, ri.name))
        union
        select a.food_concept_id from public.food_concept_aliases a
        where a.normalized_alias = public.r1_normalize_text(coalesce(ri.normalized_name, ri.name))
      ) candidate having count(*) = 1
    ) exact_match on true
  ), matched as (
    select e.id as recipe_id, count(distinct ri.food_concept_id)::bigint as overlap_count, 0 as source_rank
    from eligible e join resolved_ingredients ri on ri.recipe_id = e.id join pantry_concepts p on p.food_concept_id = ri.food_concept_id
    group by e.id order by count(distinct ri.food_concept_id) desc, e.id::text collate "C" limit 200
  ), favorite as (
    select e.id as recipe_id, 0::bigint as overlap_count, 1 as source_rank
    from eligible e join public.favorite_recipes f on f.user_id = auth.uid() and f.deleted_at is null
      and f.recipe_id = e.id::text
    order by e.id::text collate "C" limit 50
  ), initial as (
    select e.id as recipe_id, 0::bigint as overlap_count, 2 as source_rank
    from eligible e where not exists (select 1 from matched)
    order by e.id::text collate "C" limit 50
  ), pooled as (
    select * from matched union all select * from favorite union all select * from initial
  )
  select p.recipe_id, max(p.overlap_count)::bigint, min(p.source_rank)::integer
  from pooled p group by p.recipe_id
  order by min(p.source_rank), max(p.overlap_count) desc, p.recipe_id::text collate "C"
  limit least(greatest(coalesce(p_limit, 250), 1), 250)
$$;

create or replace function public.apply_today_shopping_v1(
  p_recipe_id uuid,
  p_snapshot_key uuid,
  p_client_mutation_id uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_prior public.today_shopping_mutations%rowtype;
  v_cache public.today_recommendation_cache%rowtype;
  v_current_key text;
  v_item_id uuid;
  v_item_ids uuid[] := '{}'::uuid[];
  v_missing record;
begin
  if v_uid is null then return jsonb_build_object('status', 'rejected', 'code', 'AUTH_REQUIRED'); end if;
  if p_recipe_id is null or p_snapshot_key is null or p_client_mutation_id is null then
    return jsonb_build_object('status', 'rejected', 'code', 'INVALID_REQUEST');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || p_client_mutation_id::text, 0));
  select * into v_prior from public.today_shopping_mutations
    where user_id = v_uid and client_mutation_id = p_client_mutation_id;
  if found then
    if v_prior.recipe_id = p_recipe_id and v_prior.snapshot_key = p_snapshot_key then
      return jsonb_build_object('status', 'applied', 'code', 'OK', 'itemIds', to_jsonb(v_prior.item_ids));
    end if;
    return jsonb_build_object('status', 'conflict', 'code', 'MUTATION_CONFLICT');
  end if;
  if not exists (
    select 1 from public.recipes r join public.catalog_versions c on c.id = r.catalog_version_id and c.active
    where r.id = p_recipe_id and btrim(r.instructions) <> ''
      and exists (select 1 from public.recipe_ingredients ri where ri.recipe_id = r.id)
  ) then return jsonb_build_object('status', 'rejected', 'code', 'RECIPE_NOT_FOUND'); end if;
  perform public.today_lock_snapshot_v1();
  lock table public.today_shopping_mutations in share row exclusive mode;
  lock table public.shopping_list_items in row exclusive mode;
  select * into v_cache from public.today_recommendation_cache
    where user_id = v_uid and snapshot_key = p_snapshot_key and expires_at > now() for share;
  if not found then return jsonb_build_object('status', 'conflict', 'code', 'SNAPSHOT_CONFLICT'); end if;
  if not exists (
    select 1 from jsonb_array_elements(coalesce(v_cache.result->'authorizedRecipeIds', '[]'::jsonb)) value
    where value #>> '{}' = p_recipe_id::text
  ) then return jsonb_build_object('status', 'conflict', 'code', 'SNAPSHOT_CONFLICT'); end if;
  v_current_key := public.today_state_key_for_user_v1(v_uid, v_cache.civil_date, v_cache.matcher_version, v_cache.recommendation_version);
  if v_current_key is distinct from v_cache.cache_key then
    return jsonb_build_object('status', 'conflict', 'code', 'SNAPSHOT_CONFLICT');
  end if;

  for v_missing in
    with resolved as (
      select ri.id, ri.measure, coalesce(ri.food_concept_id, exact_match.food_concept_id) as food_concept_id
      from public.recipe_ingredients ri
      left join lateral (
        select min(candidate.food_concept_id::text)::uuid as food_concept_id
        from (
          select c.id as food_concept_id from public.food_concepts c
          where public.r1_normalize_text(c.display_name) = public.r1_normalize_text(coalesce(ri.normalized_name, ri.name))
          union
          select a.food_concept_id from public.food_concept_aliases a
          where a.normalized_alias = public.r1_normalize_text(coalesce(ri.normalized_name, ri.name))
        ) candidate having count(*) = 1
      ) exact_match on true
      where ri.recipe_id = p_recipe_id
    ), requirements as (
      select r.food_concept_id, count(*) filter (where parsed.quantity is null) as unknown_measure_count,
        count(distinct parsed.unit) filter (where parsed.quantity is not null) as unit_count,
        sum(parsed.quantity) as required_quantity, min(parsed.unit) as required_unit
      from resolved r left join lateral public.today_parse_measure_v1(r.measure) parsed on true
      where r.food_concept_id is not null group by r.food_concept_id
    ), evaluated as (
      select req.*, c.display_name,
        coalesce(stock.positive_count, 0) as positive_count,
        coalesce(stock.unknown_amount_count, 0) as unknown_amount_count,
        coalesce(stock.compatible_quantity, 0) as compatible_quantity,
        coalesce(stock.incompatible_exact_count, 0) as incompatible_exact_count
      from requirements req join public.food_concepts c on c.id = req.food_concept_id
      left join lateral (
        select count(*) as positive_count,
          count(*) filter (where i.stock_mode <> 'exact') as unknown_amount_count,
          coalesce(sum(case
            when i.stock_mode = 'exact' and
              (case when lower(i.quantity_unit) in ('g','kg') then 'g' when lower(i.quantity_unit) in ('ml','l') then 'ml'
                when lower(i.quantity_unit) in ('unidad','unidades','unit') then 'unit' when lower(i.quantity_unit) in ('pack','packs') then 'pack' end) = req.required_unit
            then i.quantity_exact * (case when lower(i.quantity_unit) in ('kg','l') then 1000 else 1 end) else 0 end), 0) as compatible_quantity,
          count(*) filter (where i.stock_mode = 'exact' and
            (case when lower(i.quantity_unit) in ('g','kg') then 'g' when lower(i.quantity_unit) in ('ml','l') then 'ml'
              when lower(i.quantity_unit) in ('unidad','unidades','unit') then 'unit' when lower(i.quantity_unit) in ('pack','packs') then 'pack' end) is distinct from req.required_unit) as incompatible_exact_count
        from public.inventory_items i where i.user_id = v_uid and i.deleted_at is null
          and i.food_concept_id = req.food_concept_id and i.normalization_status = 'confirmed'
          and ((i.stock_mode = 'presence' and i.stock_state = 'present')
            or (i.stock_mode = 'qualitative' and i.stock_state in ('plenty','some','low'))
            or (i.stock_mode = 'exact' and i.quantity_exact > 0 and i.stock_state is distinct from 'empty'))
      ) stock on true
    )
    select food_concept_id, display_name,
      case when positive_count > 0 and unknown_measure_count = 0 and unit_count = 1
        then greatest(required_quantity - compatible_quantity, 0) else null end as deficit_quantity,
      case when positive_count > 0 and unknown_measure_count = 0 and unit_count = 1 then required_unit else null end as deficit_unit
    from evaluated
    where positive_count = 0
      or (unknown_measure_count = 0 and unit_count = 1 and compatible_quantity < required_quantity
        and unknown_amount_count = 0 and incompatible_exact_count = 0)
    order by food_concept_id
  loop
    insert into public.shopping_list_items(user_id, ingredient_key, name, quantity, unit)
      values(v_uid, v_missing.food_concept_id::text, v_missing.display_name, v_missing.deficit_quantity, v_missing.deficit_unit)
      returning id into v_item_id;
    v_item_ids := array_append(v_item_ids, v_item_id);
  end loop;
  insert into public.today_shopping_mutations(user_id, client_mutation_id, recipe_id, snapshot_key, item_ids)
    values(v_uid, p_client_mutation_id, p_recipe_id, p_snapshot_key, v_item_ids);
  return jsonb_build_object('status', 'applied', 'code', 'OK', 'itemIds', to_jsonb(v_item_ids));
exception
  when foreign_key_violation then return jsonb_build_object('status', 'rejected', 'code', 'RECIPE_NOT_FOUND');
  when invalid_text_representation or numeric_value_out_of_range or check_violation then
    return jsonb_build_object('status', 'rejected', 'code', 'INVALID_REQUEST');
end $$;

revoke all on function public.today_parse_measure_v1(text), public.today_state_key_for_user_v1(uuid,date,text,text),
  public.today_state_key_v1(date,text,text), public.today_lock_snapshot_v1(), public.read_today_cache_v1(date,text,text),
  public.store_today_cache_v1(uuid,date,text,text,text,uuid,jsonb), public.find_today_recipe_candidates_v1(integer),
  public.apply_today_shopping_v1(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.today_state_key_v1(date,text,text), public.read_today_cache_v1(date,text,text),
  public.find_today_recipe_candidates_v1(integer), public.apply_today_shopping_v1(uuid,uuid,uuid) to authenticated;
grant execute on function public.today_state_key_for_user_v1(uuid,date,text,text), public.today_lock_snapshot_v1(),
  public.store_today_cache_v1(uuid,date,text,text,text,uuid,jsonb) to service_role;
grant execute on function public.today_parse_measure_v1(text) to authenticated, service_role;
