-- R2 hotfix: the Today state key serialized the whole catalog (recipes, ingredients, concepts, aliases)
-- on every request and exceeded the authenticated statement timeout in production. Global catalog
-- changes are now summarized by a revision counter bumped by statement-level triggers, so the key
-- only serializes the user's own pantry and favorites.

create table public.today_catalog_revision (
  singleton boolean primary key default true check (singleton),
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.today_catalog_revision(singleton) values (true);
alter table public.today_catalog_revision enable row level security;
revoke all on public.today_catalog_revision from public, anon, authenticated;
grant select on public.today_catalog_revision to service_role;

create or replace function public.today_bump_catalog_revision_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.today_catalog_revision set revision = revision + 1, updated_at = clock_timestamp() where singleton;
  return null;
end $$;
revoke all on function public.today_bump_catalog_revision_v1() from public, anon, authenticated;

create trigger today_catalog_revision_catalog_versions after insert or update or delete or truncate on public.catalog_versions
  for each statement execute function public.today_bump_catalog_revision_v1();
create trigger today_catalog_revision_recipes after insert or update or delete or truncate on public.recipes
  for each statement execute function public.today_bump_catalog_revision_v1();
create trigger today_catalog_revision_recipe_ingredients after insert or update or delete or truncate on public.recipe_ingredients
  for each statement execute function public.today_bump_catalog_revision_v1();
create trigger today_catalog_revision_food_concepts after insert or update or delete or truncate on public.food_concepts
  for each statement execute function public.today_bump_catalog_revision_v1();
create trigger today_catalog_revision_food_concept_aliases after insert or update or delete or truncate on public.food_concept_aliases
  for each statement execute function public.today_bump_catalog_revision_v1();

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
  v_revision bigint;
  v_payload jsonb;
begin
  if v_uid is null then return null; end if;
  select * into v_catalog from public.catalog_versions where active limit 1;
  if not found then return null; end if;
  select revision into v_revision from public.today_catalog_revision where singleton;
  v_payload := jsonb_build_object(
    'date', p_date,
    'matcherVersion', p_matcher_version,
    'recommendationVersion', p_recommendation_version,
    'catalog', jsonb_build_object('id', v_catalog.id, 'checksum', v_catalog.checksum, 'sourceVersion', v_catalog.source_version, 'recipeCount', v_catalog.recipe_count, 'ingredientCount', v_catalog.ingredient_count),
    'catalogRevision', coalesce(v_revision, 0),
    'pantry', coalesce((
      select jsonb_agg(jsonb_build_array(i.id, i.food_concept_id, i.deleted_at, i.normalization_status,
        i.stock_mode, i.stock_state, i.quantity_precision, i.quantity_exact, i.quantity_unit,
        i.freshness_precision, i.freshness_source, i.acquired_on, i.freshness_estimated_days, i.expiry_date_exact,
        i.version, i.updated_at) order by i.id)
      from public.inventory_items i where i.user_id = v_uid
    ), '[]'::jsonb),
    'favorites', coalesce((
      select jsonb_agg(f.recipe_id order by f.recipe_id) from public.favorite_recipes f where f.user_id = v_uid and f.deleted_at is null
    ), '[]'::jsonb)
  );
  return encode(extensions.digest(convert_to(v_payload::text, 'UTF8'), 'sha256'), 'hex');
end $$;

revoke all on function public.today_state_key_for_user_v1(uuid,date,text,text) from public, anon, authenticated;
grant execute on function public.today_state_key_for_user_v1(uuid,date,text,text) to service_role;
