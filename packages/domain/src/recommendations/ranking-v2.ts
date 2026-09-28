import type { RecipeAvailability } from "../pantry/knowledge";

export const RECOMMENDATION_VERSION = "ranking-v2" as const;

export type RecommendationCandidate = Readonly<{
  recipeId: string;
  availability: RecipeAvailability;
  useSoon: "verified" | "estimated" | "none";
  preferred: boolean;
}>;

export type RankedRecommendation = Readonly<{
  recipeId: string;
  availability: RecipeAvailability;
  reasons: readonly ("ready" | "quantity_to_check" | "missing" | "unknown" | "use_soon" | "good_to_use" | "preferred")[];
}>;

/** Deterministic internal order. No numeric match or freshness claim reaches the UI. */
export function rankRecipesV2(candidates: readonly RecommendationCandidate[]): RankedRecommendation[] {
  const priority = (candidate: RecommendationCandidate) => {
    const availability = candidate.availability;
    const group = availability.state === "ready" ? 0
      : availability.state === "quantity_to_check" ? 1
        : availability.state === "missing" ? 2 + availability.missingCount
          : 100;
    const freshness = candidate.useSoon === "verified" ? 0 : candidate.useSoon === "estimated" ? 1 : 2;
    return [group, freshness, candidate.preferred ? 0 : 1] as const;
  };
  return [...candidates].sort((a, b) => {
    const aPriority = priority(a);
    const bPriority = priority(b);
    return aPriority[0] - bPriority[0]
      || aPriority[1] - bPriority[1]
      || aPriority[2] - bPriority[2]
      || a.recipeId.localeCompare(b.recipeId);
  }).map((candidate) => ({
    recipeId: candidate.recipeId,
    availability: candidate.availability,
    reasons: [
      candidate.availability.state === "ready" ? "ready"
        : candidate.availability.state === "quantity_to_check" ? "quantity_to_check"
          : candidate.availability.state === "unknown" ? "unknown" : "missing",
      ...(candidate.useSoon === "verified" ? ["use_soon" as const]
        : candidate.useSoon === "estimated" ? ["good_to_use" as const] : []),
      ...(candidate.preferred ? ["preferred" as const] : []),
    ],
  }));
}
