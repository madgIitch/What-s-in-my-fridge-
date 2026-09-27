import { describe, expect, it } from "vitest";
import { isRecipeId } from "./ids";

describe("recipe detail identifiers", () => {
  it("accepts the five UUID groups used by catalog recipes", () => {
    expect(isRecipeId("41d7c346-d319-4004-a0b2-9650703f73f5")).toBe(true);
  });

  it("rejects malformed and unsafe paths", () => {
    expect(isRecipeId("41d7c346-d319-4004-9650703f73f5")).toBe(false);
    expect(isRecipeId("../settings")).toBe(false);
  });
});
