create table public.inventory_items (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'APP' check (source in ('APP', 'FIREBASE')),
  legacy_id text,
  name text not null check (btrim(name) <> ''),
  normalized_name text,
  expiry_date timestamptz not null,
  category text,
  quantity numeric not null check (quantity >= 0),
  notes text,
  unit text not null check (btrim(unit) <> ''),
  added_at timestamptz not null,
  deleted_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, legacy_id)
);

create table public.receipt_drafts (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'APP' check (source in ('APP', 'FIREBASE')),
  legacy_id text,
  raw_text text not null,
  captured_at timestamptz not null,
  merchant text,
  purchase_date date,
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  total numeric check (total is null or total >= 0),
  lines jsonb not null default '[]'::jsonb check (jsonb_typeof(lines) = 'array'),
  unrecognized_lines jsonb not null default '[]'::jsonb check (jsonb_typeof(unrecognized_lines) = 'array'),
  confirmed boolean not null default false,
  deleted_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, legacy_id)
);

create table public.favorite_recipes (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'APP' check (source in ('APP', 'FIREBASE')),
  legacy_id text,
  recipe_id text not null,
  name text not null,
  match_percentage numeric not null check (match_percentage between 0 and 100),
  matched_ingredients jsonb not null default '[]'::jsonb check (jsonb_typeof(matched_ingredients) = 'array'),
  missing_ingredients jsonb not null default '[]'::jsonb check (jsonb_typeof(missing_ingredients) = 'array'),
  ingredients_with_measures jsonb not null default '[]'::jsonb check (jsonb_typeof(ingredients_with_measures) = 'array'),
  instructions text not null,
  saved_at timestamptz not null,
  deleted_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, legacy_id)
);

create table public.meal_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'APP' check (source in ('APP', 'FIREBASE')),
  legacy_id text,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  meal_date date not null,
  recipe_id text,
  custom_name text,
  ingredients_consumed jsonb not null default '[]'::jsonb check (jsonb_typeof(ingredients_consumed) = 'array'),
  notes text,
  calories_estimate numeric check (calories_estimate is null or calories_estimate >= 0),
  consumed_at timestamptz not null,
  deleted_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((recipe_id is not null) or (custom_name is not null and btrim(custom_name) <> '')),
  unique (user_id, source, legacy_id)
);

create table public.ingredient_mappings (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'APP' check (source in ('APP', 'FIREBASE')),
  legacy_id text,
  scanned_name text not null check (btrim(scanned_name) <> ''),
  normalized_name text not null check (btrim(normalized_name) <> ''),
  confidence numeric not null check (confidence between 0 and 1),
  method text not null check (method in ('exact', 'synonym', 'partial', 'fuzzy', 'llm', 'user')),
  verified_by_user boolean not null default false,
  canonical boolean not null default false,
  deleted_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (verified_by_user or canonical),
  unique (user_id, source, legacy_id),
  unique (user_id, scanned_name)
);

create table public.ingredients (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  category text not null,
  synonyms jsonb not null default '[]'::jsonb check (jsonb_typeof(synonyms) = 'array'),
  seed_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inventory_items enable row level security;
alter table public.receipt_drafts enable row level security;
alter table public.favorite_recipes enable row level security;
alter table public.meal_entries enable row level security;
alter table public.ingredient_mappings enable row level security;
alter table public.ingredients enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['inventory_items','receipt_drafts','favorite_recipes','meal_entries','ingredient_mappings'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.owns_row(user_id))', table_name || '_select_own', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.owns_row(user_id))', table_name || '_insert_own', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (public.owns_row(user_id)) with check (public.owns_row(user_id))', table_name || '_update_own', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using (public.owns_row(user_id))', table_name || '_delete_own', table_name);
  end loop;
end $$;

create policy ingredients_read_authenticated on public.ingredients for select to authenticated using (true);

create index inventory_items_owner_active_idx on public.inventory_items(user_id, deleted_at, expiry_date);
create index receipt_drafts_owner_idx on public.receipt_drafts(user_id, captured_at desc);
create index favorite_recipes_owner_idx on public.favorite_recipes(user_id, saved_at desc);
create index meal_entries_owner_date_idx on public.meal_entries(user_id, meal_date);
create index ingredient_mappings_owner_idx on public.ingredient_mappings(user_id, scanned_name);
