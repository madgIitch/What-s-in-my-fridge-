-- R0: additive product and pantry knowledge. Legacy quantity/expiry_date remain intact.
create table public.food_concepts (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  display_name text not null check (btrim(display_name) <> ''),
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.commercial_products (
  id uuid primary key default extensions.gen_random_uuid(),
  retailer text not null check (btrim(retailer) <> ''),
  retailer_product_id text,
  barcode text,
  display_name text not null check (btrim(display_name) <> ''),
  food_concept_id uuid references public.food_concepts(id),
  source text not null check (source in ('retailer_catalog', 'barcode', 'manual')),
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (retailer_product_id is not null or barcode is not null or source = 'manual')
);
create unique index commercial_products_retailer_id_unique
  on public.commercial_products(retailer, retailer_product_id) where retailer_product_id is not null;
create unique index commercial_products_barcode_unique
  on public.commercial_products(barcode) where barcode is not null;
create index commercial_products_concept_idx on public.commercial_products(food_concept_id);

alter table public.food_concepts enable row level security;
alter table public.commercial_products enable row level security;
create policy food_concepts_catalog_read on public.food_concepts for select to authenticated using (true);
create policy commercial_products_catalog_read on public.commercial_products for select to authenticated using (true);

alter table public.inventory_items
  add column food_concept_id uuid references public.food_concepts(id),
  add column commercial_product_id uuid references public.commercial_products(id),
  add column stock_mode text not null default 'presence',
  add column stock_state text,
  add column quantity_precision text not null default 'unknown',
  add column quantity_exact numeric,
  add column quantity_unit text,
  add column freshness_precision text not null default 'unknown',
  add column freshness_source text,
  add column acquired_on date,
  add column acquired_on_source text,
  add column freshness_estimated_days integer,
  add column expiry_date_exact date;

alter table public.inventory_items
  add constraint inventory_v3_stock_mode_check check (stock_mode in ('presence', 'qualitative', 'exact')),
  add constraint inventory_v3_stock_state_check check (stock_state is null or stock_state in ('present', 'absent', 'plenty', 'some', 'low', 'empty')),
  add constraint inventory_v3_quantity_precision_check check (quantity_precision in ('unknown', 'exact')),
  add constraint inventory_v3_stock_consistency_check check (
    (stock_mode = 'presence' and quantity_precision = 'unknown' and quantity_exact is null and quantity_unit is null
      and (stock_state is null or stock_state in ('present', 'absent')))
    or (stock_mode = 'qualitative' and quantity_precision = 'unknown' and quantity_exact is null and quantity_unit is null
      and stock_state is not null and stock_state in ('plenty', 'some', 'low', 'empty'))
    or (stock_mode = 'exact' and quantity_precision = 'exact' and quantity_exact is not null and quantity_exact >= 0
      and quantity_unit is not null and btrim(quantity_unit) <> '' and (stock_state is null or stock_state in ('plenty', 'some', 'low', 'empty'))
      and (stock_state is distinct from 'empty' or quantity_exact = 0)
      and (quantity_exact <> 0 or stock_state is null or stock_state = 'empty'))
  ),
  add constraint inventory_v3_freshness_precision_check check (freshness_precision in ('unknown', 'estimated', 'exact')),
  add constraint inventory_v3_freshness_source_check check (freshness_source is null or freshness_source in ('package', 'user', 'retailer', 'receipt', 'catalog')),
  add constraint inventory_v3_acquired_source_check check (acquired_on_source is null or acquired_on_source in ('receipt', 'user', 'retailer')),
  add constraint inventory_v3_freshness_consistency_check check (
    (freshness_precision = 'unknown' and freshness_source is null and freshness_estimated_days is null and expiry_date_exact is null)
    or (freshness_precision = 'estimated' and freshness_source is not null and freshness_estimated_days is not null
      and freshness_estimated_days >= 0 and expiry_date_exact is null)
    or (freshness_precision = 'exact' and freshness_source is not null and freshness_source in ('package', 'user', 'retailer')
      and expiry_date_exact is not null and freshness_estimated_days is null)
  ),
  add constraint inventory_v3_acquired_consistency_check check (
    (acquired_on is null and acquired_on_source is null) or (acquired_on is not null and acquired_on_source is not null)
  );

create index inventory_items_food_concept_idx on public.inventory_items(user_id, food_concept_id)
  where deleted_at is null and food_concept_id is not null;

alter table public.recipe_ingredients
  add column food_concept_id uuid references public.food_concepts(id);
create index recipe_ingredients_food_concept_idx on public.recipe_ingredients(food_concept_id)
  where food_concept_id is not null;
