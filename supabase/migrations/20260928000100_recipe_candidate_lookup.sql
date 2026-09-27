-- Resolve the best matching recipe IDs in PostgreSQL without downloading the catalog.
create index if not exists recipe_ingredients_name_recipe_idx
  on public.recipe_ingredients(normalized_name, recipe_id);

create or replace function public.find_recipe_candidates(p_names text[], p_limit integer default 50)
returns table(recipe_id uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_names is null or cardinality(p_names) = 0 then return; end if;
  return query
    with active_catalog as (
      select id from public.catalog_versions where active = true
    ), matched as (
      select ri.recipe_id, count(*)::integer as matched_count
      from public.recipe_ingredients ri
      join public.recipes r on r.id = ri.recipe_id
      join active_catalog c on c.id = r.catalog_version_id
      where ri.normalized_name = any(p_names)
      group by ri.recipe_id
    )
    select m.recipe_id
    from matched m
    join public.recipes r on r.id = m.recipe_id
    cross join lateral (
      select count(*)::integer as ingredient_count
      from public.recipe_ingredients ri
      where ri.recipe_id = m.recipe_id
    ) totals
    order by totals.ingredient_count - m.matched_count asc,
      round(100.0 * m.matched_count / greatest(totals.ingredient_count, 1)) desc,
      r.external_id asc
    limit least(greatest(coalesce(p_limit, 50), 1), 50);
end $$;

revoke all on function public.find_recipe_candidates(text[], integer) from public, anon;
grant execute on function public.find_recipe_candidates(text[], integer) to authenticated;
