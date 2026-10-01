-- Catalog and learned-normalization writes are only performed by security
-- definer RPCs. RLS already denies them; explicit grants keep the boundary
-- visible and robust if a policy is added later.
revoke insert, update, delete, truncate, references, trigger on public.catalog_manifests from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.commercial_products from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.food_concept_aliases from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.user_product_mappings from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.receipt_line_mutations from anon, authenticated;

grant select on public.catalog_manifests, public.commercial_products, public.food_concept_aliases to authenticated;
grant select on public.user_product_mappings, public.receipt_line_mutations to authenticated;
