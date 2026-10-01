-- Supabase's default function privileges grant EXECUTE directly to API roles.
-- Remove those grants explicitly for service-only and authenticated-only R1 RPCs.
revoke all on function public.import_retailer_catalog_v1(jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.import_retailer_catalog_v1(jsonb,jsonb) to service_role;

revoke all on function public.confirm_receipt_draft_v2(uuid,text,jsonb,date,text) from public, anon;
revoke all on function public.resolve_receipt_line_v2(uuid,text,uuid,bigint,text,uuid,text,text) from public, anon;
revoke all on function public.apply_pantry_mutation_v3(uuid,uuid,bigint,jsonb) from public, anon;
revoke all on function public.restore_inventory_item_v3(uuid,uuid,bigint) from public, anon;
grant execute on function public.confirm_receipt_draft_v2(uuid,text,jsonb,date,text) to authenticated;
grant execute on function public.resolve_receipt_line_v2(uuid,text,uuid,bigint,text,uuid,text,text) to authenticated;
grant execute on function public.apply_pantry_mutation_v3(uuid,uuid,bigint,jsonb) to authenticated;
grant execute on function public.restore_inventory_item_v3(uuid,uuid,bigint) to authenticated;
