insert into public.ingredients (slug, name, category, synonyms, seed_version)
values
  ('butter', 'butter', 'dairy', '["mantequilla","margarine"]', 'catalog-v1'),
  ('chicken', 'chicken', 'protein', '["pollo"]', 'catalog-v1'),
  ('milk', 'milk', 'dairy', '["leche"]', 'catalog-v1'),
  ('salt', 'salt', 'spice', '["sal","salz"]', 'catalog-v1'),
  ('tomato', 'tomato', 'vegetable', '["tomate"]', 'catalog-v1')
on conflict (slug) where catalog_version_id is null do update set
  name = excluded.name,
  category = excluded.category,
  synonyms = excluded.synonyms,
  seed_version = excluded.seed_version,
  updated_at = now();
