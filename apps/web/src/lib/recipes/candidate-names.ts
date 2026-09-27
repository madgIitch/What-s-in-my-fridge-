import catalogNameIndex from "./catalog-name-index.json";
import { levenshteinSimilarity, normalizeIngredient, FUZZY_THRESHOLD, type MatcherIngredient, type MatcherInventoryItem, type VerifiedMapping } from "./matcher";

export function matchingCatalogNames(input: {
  checksum: string;
  inventory: MatcherInventoryItem[];
  vocabulary: MatcherIngredient[];
  mappings: VerifiedMapping[];
}): string[] {
  if (input.checksum !== catalogNameIndex.checksum) throw new Error("CATALOG_INDEX_STALE");
  const inventory = input.inventory.map((item) => normalizeIngredient(item.name));
  const inventorySet = new Set(inventory);
  const verifiedTargets = new Set(input.mappings
    .filter((mapping) => mapping.verifiedByUser && inventorySet.has(normalizeIngredient(mapping.scannedName)))
    .map((mapping) => normalizeIngredient(mapping.normalizedName)));
  const firstVocabularyEntry = new Map<string, boolean>();
  for (const item of input.vocabulary) {
    const names = [item.normalizedName ?? item.name, ...(item.aliases ?? [])].map(normalizeIngredient);
    const available = names.some((name) => inventorySet.has(name));
    for (const name of names) if (!firstVocabularyEntry.has(name)) firstVocabularyEntry.set(name, available);
  }
  const inventoryKeywords = inventory.map((name) => new Set(name.split(" ").filter((term) => term.length >= 3)));
  return catalogNameIndex.names.filter((name) => {
    const target = normalizeIngredient(name);
    if (verifiedTargets.has(target) || inventorySet.has(target) || firstVocabularyEntry.get(target)) return true;
    if (inventory.some((candidate) => candidate.includes(target) || target.includes(candidate))) return true;
    const terms = target.split(" ").filter((term) => term.length >= 3);
    if (inventoryKeywords.some((keywords) => terms.some((term) => keywords.has(term)))) return true;
    return inventory.some((candidate) => levenshteinSimilarity(target, candidate) >= FUZZY_THRESHOLD);
  });
}
