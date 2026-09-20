-- Sprint 6: versioned recipe catalog and atomic suggestion cache/quota.
create table public.catalog_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  checksum text not null unique check (checksum ~ '^[a-f0-9]{64}$'),
  source_version text not null,
  matcher_version text not null default 'matcher-v1',
  active boolean not null default false,
  recipe_count integer not null check (recipe_count >= 0),
  ingredient_count integer not null check (ingredient_count >= 0),
  imported_at timestamptz not null default now()
);
create unique index catalog_one_active on public.catalog_versions(active) where active;

alter table public.ingredients
  add column if not exists normalized_name text,
  add column if not exists subcategory text,
  add column if not exists category_spanish text,
  add column if not exists catalog_version_id uuid references public.catalog_versions(id);
alter table public.ingredients drop constraint if exists ingredients_slug_key;
create unique index ingredients_catalog_slug_unique on public.ingredients(catalog_version_id,slug) where catalog_version_id is not null;
create unique index ingredients_legacy_slug_unique on public.ingredients(slug) where catalog_version_id is null;

create table public.ingredient_aliases (
  id uuid primary key default extensions.gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  catalog_version_id uuid not null references public.catalog_versions(id) on delete cascade,
  unique(catalog_version_id, normalized_alias, ingredient_id)
);

create table public.recipes (
  id uuid primary key default extensions.gen_random_uuid(),
  catalog_version_id uuid not null references public.catalog_versions(id) on delete cascade,
  external_id text not null,
  name text not null check (btrim(name) <> ''),
  instructions text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  unique(catalog_version_id, external_id)
);

create table public.recipe_ingredients (
  id uuid primary key default extensions.gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id),
  position integer not null check (position >= 0),
  name text not null check (btrim(name) <> ''),
  normalized_name text not null check (btrim(normalized_name) <> ''),
  measure text,
  category text,
  unique(recipe_id, position)
);

create table public.recipe_suggestion_cache (
  user_id uuid not null references auth.users(id) on delete cascade,
  cache_key text not null check (cache_key ~ '^[a-f0-9]{64}$'),
  inventory_hash text not null check (inventory_hash ~ '^[a-f0-9]{64}$'),
  catalog_version_id uuid not null references public.catalog_versions(id),
  matcher_version text not null,
  result jsonb,
  status text not null default 'processing' check (status in ('processing','ready','failed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key(user_id, cache_key)
);

create table public.recipe_monthly_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  consumed integer not null default 0 check (consumed >= 0),
  primary key(user_id, period_start)
);

alter table public.catalog_versions enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.ingredient_aliases enable row level security;
alter table public.recipe_suggestion_cache enable row level security;
alter table public.recipe_monthly_usage enable row level security;
create policy catalog_versions_server_read on public.catalog_versions for select to authenticated using (active);
create policy recipes_server_read on public.recipes for select to authenticated using (exists(select 1 from public.catalog_versions v where v.id=catalog_version_id and v.active));
create policy recipe_ingredients_server_read on public.recipe_ingredients for select to authenticated using (exists(select 1 from public.recipes r join public.catalog_versions v on v.id=r.catalog_version_id and v.active where r.id=recipe_id));
create policy ingredient_aliases_read on public.ingredient_aliases for select to authenticated using (true);
create policy recipe_cache_read_own on public.recipe_suggestion_cache for select to authenticated using (user_id=auth.uid());
create policy recipe_usage_read_own on public.recipe_monthly_usage for select to authenticated using (user_id=auth.uid());

create index recipes_catalog_idx on public.recipes(catalog_version_id,external_id);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients(recipe_id,position);
create index recipe_cache_expiry_idx on public.recipe_suggestion_cache(user_id,expires_at);

create or replace function public.begin_recipe_suggestion(p_cache_key text,p_inventory_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_catalog public.catalog_versions%rowtype; v_cache public.recipe_suggestion_cache%rowtype;
 v_period date:=date_trunc('month',now() at time zone 'UTC')::date; v_pro boolean; v_usage integer;
begin
 if v_uid is null then return jsonb_build_object('action','reject','code','AUTH_REQUIRED'); end if;
 if p_cache_key !~ '^[a-f0-9]{64}$' or p_inventory_hash !~ '^[a-f0-9]{64}$' then return jsonb_build_object('action','reject','code','INVENTORY_INVALID'); end if;
 select * into v_catalog from public.catalog_versions where active for share;
 if not found then return jsonb_build_object('action','reject','code','CATALOG_NOT_READY'); end if;
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text||p_cache_key,0));
 select * into v_cache from public.recipe_suggestion_cache where user_id=v_uid and cache_key=p_cache_key and status='ready' and expires_at>now();
 if found then return jsonb_build_object('action','hit','result',v_cache.result,'expiresAt',v_cache.expires_at,'catalogVersion',v_catalog.id,'matcherVersion',v_catalog.matcher_version); end if;
 select * into v_cache from public.recipe_suggestion_cache where user_id=v_uid and cache_key=p_cache_key and status='processing' and expires_at>now();
 if found then return jsonb_build_object('action','reject','code','SUGGESTION_IN_PROGRESS'); end if;
 select exists(select 1 from public.user_entitlements where user_id=v_uid and plan='pro' and status='active') into v_pro;
 if not v_pro then
  insert into public.recipe_monthly_usage(user_id,period_start,consumed) values(v_uid,v_period,1)
  on conflict(user_id,period_start) do update set consumed=public.recipe_monthly_usage.consumed+1 returning consumed into v_usage;
  if v_usage>5 then update public.recipe_monthly_usage set consumed=consumed-1 where user_id=v_uid and period_start=v_period; return jsonb_build_object('action','reject','code','SUGGESTION_QUOTA_EXHAUSTED'); end if;
 end if;
 insert into public.recipe_suggestion_cache(user_id,cache_key,inventory_hash,catalog_version_id,matcher_version,status,expires_at)
 values(v_uid,p_cache_key,p_inventory_hash,v_catalog.id,v_catalog.matcher_version,'processing',now()+interval '60 minutes')
 on conflict(user_id,cache_key) do update set inventory_hash=excluded.inventory_hash,catalog_version_id=excluded.catalog_version_id,matcher_version=excluded.matcher_version,status='processing',result=null,created_at=now(),expires_at=excluded.expires_at;
 return jsonb_build_object('action','process','expiresAt',now()+interval '60 minutes','catalogVersion',v_catalog.id,'matcherVersion',v_catalog.matcher_version);
end $$;

create or replace function public.complete_recipe_suggestion(p_cache_key text,p_result jsonb)
returns void language plpgsql security definer set search_path='' as $$ begin
 update public.recipe_suggestion_cache set result=p_result,status='ready' where user_id=auth.uid() and cache_key=p_cache_key and status='processing';
 if not found then raise exception 'SUGGESTION_CACHE_NOT_CLAIMED'; end if;
end $$;

create or replace function public.fail_recipe_suggestion(p_cache_key text)
returns void language plpgsql security definer set search_path='' as $$ begin
 update public.recipe_suggestion_cache set status='failed',expires_at=now() where user_id=auth.uid() and cache_key=p_cache_key;
end $$;

create or replace function public.activate_recipe_catalog(p_checksum text,p_source_version text,p_matcher_version text,p_vocabulary jsonb,p_recipes jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_version uuid; v_vocab jsonb; v_recipe jsonb; v_item jsonb; v_ingredient uuid; v_recipe_id uuid; v_pos integer;
begin
 if current_user not in ('postgres','service_role') then raise exception 'CATALOG_IMPORT_FORBIDDEN'; end if;
 select id into v_version from public.catalog_versions where checksum=p_checksum;
 if found then return jsonb_build_object('status','already_imported','catalogVersion',v_version); end if;
 if jsonb_typeof(p_vocabulary)<>'array' or jsonb_typeof(p_recipes)<>'array' then raise exception 'CATALOG_INVALID'; end if;
 insert into public.catalog_versions(checksum,source_version,matcher_version,recipe_count,ingredient_count)
 values(p_checksum,p_source_version,p_matcher_version,jsonb_array_length(p_recipes),jsonb_array_length(p_vocabulary)) returning id into v_version;
 for v_vocab in select value from jsonb_array_elements(p_vocabulary) loop
  insert into public.ingredients(slug,name,normalized_name,category,synonyms,subcategory,category_spanish,seed_version,catalog_version_id)
  values(v_vocab->>'slug',v_vocab->>'name',v_vocab->>'normalizedName',coalesce(nullif(v_vocab->>'category',''),'other'),coalesce(v_vocab->'aliases','[]'),v_vocab->>'subcategory',v_vocab->>'categorySpanish',p_source_version,v_version)
  on conflict(catalog_version_id,slug) where catalog_version_id is not null do update set name=excluded.name,normalized_name=excluded.normalized_name,category=excluded.category,synonyms=excluded.synonyms,subcategory=excluded.subcategory,category_spanish=excluded.category_spanish,seed_version=excluded.seed_version
  returning id into v_ingredient;
  for v_item in select value from jsonb_array_elements(coalesce(v_vocab->'aliases','[]')) loop
   insert into public.ingredient_aliases(ingredient_id,alias,normalized_alias,catalog_version_id) values(v_ingredient,v_item#>>'{}',lower(v_item#>>'{}'),v_version);
  end loop;
 end loop;
 for v_recipe in select value from jsonb_array_elements(p_recipes) loop
  insert into public.recipes(catalog_version_id,external_id,name,instructions,metadata) values(v_version,v_recipe->>'externalId',v_recipe->>'name',coalesce(v_recipe->>'instructions',''),coalesce(v_recipe->'metadata','{}')) returning id into v_recipe_id;
  v_pos:=0;
  for v_item in select value from jsonb_array_elements(v_recipe->'ingredients') loop
   select id into v_ingredient from public.ingredients where catalog_version_id=v_version and normalized_name=v_item->>'normalizedName' limit 1;
   insert into public.recipe_ingredients(recipe_id,ingredient_id,position,name,normalized_name,measure,category) values(v_recipe_id,v_ingredient,v_pos,v_item->>'name',v_item->>'normalizedName',v_item->>'measure',v_item->>'category');
   v_pos:=v_pos+1;
  end loop;
 end loop;
 update public.catalog_versions set active=false where active;
 update public.catalog_versions set active=true where id=v_version;
 return jsonb_build_object('status','imported','catalogVersion',v_version);
end $$;

revoke all on function public.begin_recipe_suggestion(text,text),public.complete_recipe_suggestion(text,jsonb),public.fail_recipe_suggestion(text),public.activate_recipe_catalog(text,text,text,jsonb,jsonb) from public;
grant execute on function public.begin_recipe_suggestion(text,text),public.complete_recipe_suggestion(text,jsonb),public.fail_recipe_suggestion(text) to authenticated;
grant execute on function public.activate_recipe_catalog(text,text,text,jsonb,jsonb) to service_role;
