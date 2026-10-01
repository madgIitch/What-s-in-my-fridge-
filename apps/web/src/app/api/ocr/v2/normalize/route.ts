import { createServerSupabaseClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/receipt/errors";
import { isCivilDate } from "@/lib/inventory/dates";
import { isUuid, NORMALIZER_VERSION } from "@/lib/normalization/contracts";
import { normalizeLine, normalizeText } from "@/lib/normalization/normalizer";
import { productV3ApiEnabled, productV3Unavailable } from "../_guard";

type DraftRow = { id: string; merchant: string | null; purchase_date: string | null; original_lines: unknown; normalization_review?: unknown; review_decisions?: unknown; normalizer_version?: string | null; status: string };
const retailers = ["mercadona", "dia", "lidl", "carrefour", "eroski"];
function retailerFor(merchant: string | null): string | null {
  const value = normalizeText(merchant ?? "");
  return retailers.find((retailer) => value.includes(retailer)) ?? null;
}

export async function POST(request: Request) {
  if (!productV3ApiEnabled()) return productV3Unavailable();
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return errorResponse("AUTH_REQUIRED", null);
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return errorResponse("INVALID_REQUEST", null); }
  if (Object.keys(body).some((key) => ["userId", "user_id", "owner"].includes(key)) || !isUuid(body.draftId)) return errorResponse("INVALID_REQUEST", null);
  const { data: draftData, error: draftError } = await supabase.from("receipt_drafts").select("*").eq("id", body.draftId).eq("user_id", user.id).maybeSingle();
  if (draftError || !draftData) return errorResponse("DRAFT_NOT_FOUND", null);
  const draft = draftData as unknown as DraftRow;
  if (!['review', 'confirmed'].includes(draft.status)) return errorResponse("DRAFT_STATE_CONFLICT", null);
  const clientCivilDate = request.headers.get("x-client-civil-date");
  if (!clientCivilDate || !isCivilDate(clientCivilDate)) return errorResponse("INVALID_REQUEST", null, "Necesitamos la fecha local para añadir la compra");
  if (draft.normalizer_version === NORMALIZER_VERSION && Array.isArray(draft.normalization_review) && draft.normalization_review.length) {
    return Response.json({ draftId: draft.id, normalizerVersion: NORMALIZER_VERSION, lines: draft.normalization_review, decisions: Array.isArray(draft.review_decisions) ? draft.review_decisions : [] });
  }
  const rawLines = Array.isArray(draft.original_lines) ? draft.original_lines as Parameters<typeof normalizeLine>[0][] : [];
  const retailer = retailerFor(draft.merchant);
  const normalizedNames = [...new Set(rawLines.map((line) => normalizeText(line.name?.trim() || line.rawText.trim())).filter(Boolean))];
  const barcodes = [...new Set(rawLines.map((line) => line.barcode).filter((value): value is string => Boolean(value)))];
  const retailerIds = [...new Set(rawLines.map((line) => line.retailerProductId).filter((value): value is string => Boolean(value)))];
  const concepts: { id: string; slug: string; display_name: string; category: string | null; suggested_location?: "fridge" | "pantry" | "freezer" | null; shelf_life_days?: number | null }[] = [];
  for (let from = 0; ; from += 1000) { const page = await supabase.from("food_concepts").select("id,slug,display_name,category,suggested_location,shelf_life_days").order("id").range(from, from + 999); if (page.error) return errorResponse("DRAFT_STATE_CONFLICT", null); concepts.push(...page.data.map((item) => { const location = item.suggested_location === "fridge" || item.suggested_location === "pantry" || item.suggested_location === "freezer" ? item.suggested_location as "fridge" | "pantry" | "freezer" : null; return { ...item, suggested_location: location }; })); if (page.data.length < 1000) break; }
  const [barcodeResult, retailerResult, aliasResult, mappingResult] = await Promise.all([
    barcodes.length ? supabase.from("commercial_products").select("retailer,retailer_product_id,barcode,display_name,food_concept_id").in("barcode", barcodes) : Promise.resolve({ data: [], error: null }),
    retailer && retailerIds.length ? supabase.from("commercial_products").select("retailer,retailer_product_id,barcode,display_name,food_concept_id").eq("retailer", retailer).in("retailer_product_id", retailerIds) : Promise.resolve({ data: [], error: null }),
    normalizedNames.length ? supabase.from("food_concept_aliases").select("normalized_alias,food_concept_id").in("normalized_alias", normalizedNames) : Promise.resolve({ data: [], error: null }),
    normalizedNames.length ? supabase.from("user_product_mappings").select("retailer,normalized_raw_name,food_concept_id,display_name").in("normalized_raw_name", normalizedNames) : Promise.resolve({ data: [], error: null }),
  ]);
  const products = [...(barcodeResult.data ?? []), ...(retailerResult.data ?? [])];
  const aliases = aliasResult.data ?? []; const mappings = mappingResult.data ?? [];
  const reliableReceiptDate = Boolean(draft.purchase_date && draft.purchase_date <= clientCivilDate);
  const acquiredOn = reliableReceiptDate ? draft.purchase_date : clientCivilDate; const purchaseSource = reliableReceiptDate ? "receipt" as const : "user" as const;
  const lines = rawLines.map((line) => normalizeLine(line, retailer, acquiredOn, purchaseSource, { concepts, products, aliases, mappings }));
  const { error } = await supabase.from("receipt_drafts").update({ retailer, normalizer_version: NORMALIZER_VERSION, normalization_review: lines } as never).eq("id", draft.id).eq("user_id", user.id).eq("status", "review");
  if (error) return errorResponse("DRAFT_STATE_CONFLICT", null);
  return Response.json({ draftId: draft.id, normalizerVersion: NORMALIZER_VERSION, lines, decisions: [] });
}
