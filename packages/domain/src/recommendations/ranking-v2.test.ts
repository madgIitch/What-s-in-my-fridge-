import { describe, expect, it } from "vitest";
import { recipeAvailability } from "../pantry/knowledge";
import { rankRecipesV2 } from "./ranking-v2";

describe("ranking-v2", () => {
  it("orders deterministic availability before softer signals", () => {
    const ranked = rankRecipesV2([
      { recipeId: "c", availability: recipeAvailability(["missing", "missing"]), useSoon: "verified", preferred: true },
      { recipeId: "b", availability: recipeAvailability(["have_enough"]), useSoon: "estimated", preferred: false },
      { recipeId: "a", availability: recipeAvailability(["have_enough"]), useSoon: "verified", preferred: false },
    ]);
    expect(ranked.map((entry) => entry.recipeId)).toEqual(["a", "b", "c"]);
    expect(ranked[1].reasons).toContain("good_to_use");
    expect(JSON.stringify(ranked)).not.toMatch(/percentage|score/i);
  });
});
