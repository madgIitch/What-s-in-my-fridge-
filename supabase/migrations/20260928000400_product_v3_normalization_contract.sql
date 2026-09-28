-- R0 records how knowledge was obtained; normalization itself is implemented in R1.
alter table public.inventory_items
  add column normalization_status text not null default 'unknown',
  add column normalization_source text,
  add column knowledge_provenance text not null default 'legacy';

alter table public.inventory_items
  add constraint inventory_v3_normalization_status_check check (normalization_status in ('unknown', 'proposed', 'confirmed')),
  add constraint inventory_v3_normalization_source_check check (normalization_source is null or normalization_source in ('user', 'catalog', 'receipt', 'barcode')),
  add constraint inventory_v3_knowledge_provenance_check check (knowledge_provenance in ('legacy', 'user', 'receipt', 'retailer', 'package')),
  add constraint inventory_v3_normalization_consistency_check check (
    (normalization_status = 'unknown' and normalization_source is null)
    or (normalization_status in ('proposed', 'confirmed') and normalization_source is not null and food_concept_id is not null)
  );
