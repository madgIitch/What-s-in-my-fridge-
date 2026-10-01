import type { Candidate, ReviewLine } from "./contracts";

export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
const tokenSet = (value: string) => new Set(normalizeText(value).split(" ").filter(Boolean));
const score = (a: Set<string>, b: Set<string>) => {
  const common = [...a].filter((token) => b.has(token)).length;
  return common ? common / new Set([...a, ...b]).size : 0;
};

type Knowledge = {
  mappings: { retailer: string | null; normalized_raw_name: string; food_concept_id: string | null; display_name: string }[];
  products: { retailer: string; retailer_product_id: string | null; barcode: string | null; display_name: string; food_concept_id: string | null }[];
  aliases: { normalized_alias: string; food_concept_id: string }[];
  concepts: { id: string; slug: string; display_name: string; category: string | null; suggested_location?: "fridge" | "pantry" | "freezer" | null; shelf_life_days?: number | null }[];
};
type RawLine = { lineId: string; rawText: string; name: string | null; quantity: string | null; unit: string | null; quantityExplicit?: boolean; barcode?: string; retailerProductId?: string };

function candidates(rawName: string, knowledge: Knowledge): Candidate[] {
  const input = tokenSet(rawName); const best = new Map<string, { candidate: Candidate; score: number }>();
  for (const concept of knowledge.concepts) {
    const candidate = { foodConceptId: concept.id, slug: concept.slug, displayName: concept.display_name };
    const currentScore = score(input, tokenSet(`${concept.display_name} ${concept.slug}`));
    if (!currentScore) continue;
    const old = best.get(concept.id); if (!old || currentScore > old.score) best.set(concept.id, { candidate, score: currentScore });
  }
  return [...best.values()].sort((a, b) => b.score - a.score || a.candidate.slug.localeCompare(b.candidate.slug)).slice(0, 3).map((entry) => entry.candidate);
}

export function normalizeLine(line: RawLine, retailer: string | null, acquiredOn: string | null, source: "receipt" | "user", knowledge: Knowledge): ReviewLine {
  const rawName = line.name?.trim() || line.rawText.trim(); const normalized = normalizeText(rawName);
  const mapping = knowledge.mappings.find((item) => normalizeText(item.retailer ?? "") === normalizeText(retailer ?? "") && item.normalized_raw_name === normalized);
  let displayName = mapping?.display_name ?? rawName; let foodConceptId = mapping?.food_concept_id ?? null;
  let resolution: ReviewLine["resolution"] = foodConceptId ? "resolved" : "unknown"; let lineCandidates: Candidate[] = [];
  if (!mapping) {
    const barcodeProducts = line.barcode ? knowledge.products.filter((product) => product.barcode === line.barcode) : [];
    const retailerProducts = line.retailerProductId ? knowledge.products.filter((product) => product.retailer === retailer && product.retailer_product_id === line.retailerProductId) : [];
    const exactProducts = [...new Map([...barcodeProducts, ...retailerProducts].map((product) => [`${product.retailer}:${product.retailer_product_id ?? product.barcode}`, product])).values()];
    const productConcepts = [...new Set(exactProducts.map((product) => product.food_concept_id).filter((id): id is string => Boolean(id)))];
    const identifierConflict = exactProducts.length > 1 && new Set(exactProducts.map((product) => product.food_concept_id ?? "unknown")).size > 1;
    if (!identifierConflict && productConcepts.length === 1 && exactProducts.every((product) => product.food_concept_id === productConcepts[0])) {
      foodConceptId = productConcepts[0]; displayName = exactProducts[0].display_name; resolution = "resolved";
    } else if (identifierConflict) {
      lineCandidates = knowledge.concepts.filter((item) => productConcepts.includes(item.id)).map((item) => ({ foodConceptId: item.id, slug: item.slug, displayName: item.display_name })).sort((a, b) => a.slug.localeCompare(b.slug)).slice(0, 3);
      resolution = "doubtful";
    } else {
      const aliasIds = [...new Set(knowledge.aliases.filter((alias) => alias.normalized_alias === normalized).map((alias) => alias.food_concept_id))];
      const ids = productConcepts.length > 1 ? productConcepts : aliasIds;
      if (ids.length === 1) {
        const concept = knowledge.concepts.find((item) => item.id === ids[0]);
        if (concept) { foodConceptId = concept.id; displayName = concept.display_name; resolution = "resolved"; }
      } else {
        lineCandidates = ids.length > 1
          ? knowledge.concepts.filter((item) => ids.includes(item.id)).map((item) => ({ foodConceptId: item.id, slug: item.slug, displayName: item.display_name })).sort((a, b) => a.slug.localeCompare(b.slug)).slice(0, 3)
          : candidates(rawName, knowledge);
        resolution = lineCandidates.length ? "doubtful" : "unknown";
      }
    }
  }
  const numericQuantity = Number(line.quantity?.replace(",", "."));
  const explicitQuantity = line.quantityExplicit === true;
  const quantity = explicitQuantity && line.unit && Number.isFinite(numericQuantity) && numericQuantity > 0
    ? { precision: "exact" as const, quantity: numericQuantity, unit: line.unit }
    : { precision: "unknown" as const };
  const resolvedConcept = foodConceptId ? knowledge.concepts.find((concept) => concept.id === foodConceptId) : undefined;
  return { lineId: line.lineId, rawName, rawText: line.rawText, displayName, resolution, foodConceptId, candidates: lineCandidates,
    quantity, purchase: { acquiredOn, source },
    freshness: resolvedConcept?.shelf_life_days !== null && resolvedConcept?.shelf_life_days !== undefined ? { precision: "estimated", windowDays: resolvedConcept.shelf_life_days, source: "catalog" } : { precision: "unknown" },
    suggestedLocation: resolvedConcept?.suggested_location ?? null };
}
