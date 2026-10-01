export const NORMALIZER_VERSION = "receipt-normalizer-v2" as const;

export type PantryLocation = "fridge" | "pantry" | "freezer" | null;
export type QuantityKnowledge =
  | Readonly<{ precision: "unknown"; reason: "missing" | "synthetic" | "ambiguous" }>
  | Readonly<{ precision: "exact"; quantity: number; unit: string; evidence: "receipt" | "product" | "user" }>;

export type NormalizationCandidate = Readonly<{
  foodConceptId: string;
  slug: string;
  displayName: string;
}>;

export type NormalizationLine = Readonly<{
  lineId: string;
  rawName: string;
  displayName: string;
  resolution: "resolved" | "doubtful" | "unknown";
  foodConceptId: string | null;
  candidates: readonly NormalizationCandidate[];
  source: "user_mapping" | "identifier" | "alias" | "fuzzy" | "none";
}>;

export type NormalizationInput = Readonly<{
  lineId: string;
  rawName: string;
  retailer: string | null;
  barcode?: string | null;
  retailerProductId?: string | null;
}>;

export type ReceiptNormalizationKnowledge = Readonly<{
  userMappings: readonly Readonly<{ retailer: string | null; normalizedRawName: string; foodConceptId: string | null; displayName: string }>[];
  products: readonly Readonly<{ retailer: string; retailerProductId: string | null; barcode: string | null; displayName: string; foodConceptId: string | null }>[];
  aliases: readonly Readonly<{ normalizedAlias: string; foodConceptId: string }>[];
  concepts: readonly NormalizationCandidate[];
}>;

export function normalizeReceiptText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function tokens(value: string): Set<string> {
  return new Set(normalizeReceiptText(value).split(" ").filter((token) => /[a-z0-9]/.test(token)));
}

function jaccard(left: Set<string>, right: Set<string>): number {
  const common = [...left].filter((token) => right.has(token)).length;
  if (!common) return 0;
  return common / new Set([...left, ...right]).size;
}

export function fuzzyCandidates(rawName: string, concepts: readonly NormalizationCandidate[]): NormalizationCandidate[] {
  const input = tokens(rawName);
  const best = new Map<string, { candidate: NormalizationCandidate; score: number }>();
  for (const candidate of concepts) {
    const score = jaccard(input, tokens(`${candidate.displayName} ${candidate.slug}`));
    if (!score) continue;
    const current = best.get(candidate.foodConceptId);
    if (!current || score > current.score) best.set(candidate.foodConceptId, { candidate, score });
  }
  return [...best.values()].sort((a, b) => b.score - a.score || a.candidate.slug.localeCompare(b.candidate.slug))
    .slice(0, 3).map(({ candidate }) => candidate);
}

export function normalizeReceiptLine(input: NormalizationInput, knowledge: ReceiptNormalizationKnowledge): NormalizationLine {
  const normalizedRawName = normalizeReceiptText(input.rawName);
  const mapping = knowledge.userMappings.find((entry) =>
    normalizeReceiptText(entry.retailer ?? "") === normalizeReceiptText(input.retailer ?? "")
      && entry.normalizedRawName === normalizedRawName);
  if (mapping) return { lineId: input.lineId, rawName: input.rawName, displayName: mapping.displayName,
    resolution: mapping.foodConceptId ? "resolved" : "unknown", foodConceptId: mapping.foodConceptId,
    candidates: [], source: "user_mapping" };

  const identifiers = knowledge.products.filter((product) =>
    (input.barcode && product.barcode === input.barcode)
      || (input.retailerProductId && product.retailer === input.retailer && product.retailerProductId === input.retailerProductId));
  const identifierConcepts = new Set(identifiers.map((product) => product.foodConceptId).filter(Boolean));
  if (identifierConcepts.size === 1 && identifiers.every((product) => product.foodConceptId === [...identifierConcepts][0])) {
    const product = identifiers[0];
    return { lineId: input.lineId, rawName: input.rawName, displayName: product.displayName,
      resolution: "resolved", foodConceptId: product.foodConceptId, candidates: [], source: "identifier" };
  }
  if (identifierConcepts.size > 1) {
    const candidates = knowledge.concepts.filter((concept) => identifierConcepts.has(concept.foodConceptId))
      .sort((a, b) => a.slug.localeCompare(b.slug)).slice(0, 3);
    return { lineId: input.lineId, rawName: input.rawName, displayName: input.rawName,
      resolution: "doubtful", foodConceptId: null, candidates, source: "identifier" };
  }

  const exactIds = [...new Set(knowledge.aliases.filter((alias) => alias.normalizedAlias === normalizedRawName).map((alias) => alias.foodConceptId))];
  if (exactIds.length === 1) {
    const concept = knowledge.concepts.find((entry) => entry.foodConceptId === exactIds[0]);
    if (concept) return { lineId: input.lineId, rawName: input.rawName, displayName: concept.displayName,
      resolution: "resolved", foodConceptId: concept.foodConceptId, candidates: [], source: "alias" };
  }
  const candidates = exactIds.length > 1
    ? knowledge.concepts.filter((entry) => exactIds.includes(entry.foodConceptId)).sort((a, b) => a.slug.localeCompare(b.slug)).slice(0, 3)
    : fuzzyCandidates(input.rawName, knowledge.concepts);
  return { lineId: input.lineId, rawName: input.rawName, displayName: input.rawName,
    resolution: candidates.length ? "doubtful" : "unknown", foodConceptId: null, candidates,
    source: candidates.length ? (exactIds.length ? "alias" : "fuzzy") : "none" };
}

export function receiptQuantityKnowledge(input: Readonly<{
  quantity: string | null; unit: string | null; explicit: boolean; packContent?: Readonly<{ quantity: number; unit: string }> | null;
}>): QuantityKnowledge {
  if (!input.quantity || !input.unit) return { precision: "unknown", reason: "missing" };
  const quantity = Number(input.quantity.replace(",", "."));
  if (!input.explicit || !Number.isFinite(quantity) || quantity <= 0) return { precision: "unknown", reason: input.explicit ? "ambiguous" : "synthetic" };
  const unit = input.unit.trim().toLocaleLowerCase("es");
  if (!unit) return { precision: "unknown", reason: "ambiguous" };
  if (unit === "unit" || unit === "unidad" || unit === "unidades") {
    return { precision: "exact", quantity, unit: "unit", evidence: "receipt" };
  }
  if (unit === "pack") return { precision: "exact", quantity, unit: "pack", evidence: "receipt" };
  return { precision: "exact", quantity, unit, evidence: "receipt" };
}

export function localCivilDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
