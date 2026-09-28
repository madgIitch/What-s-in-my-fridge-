import { describe, expect, it } from "vitest";
import { legacyV3CollectionDestination } from "./legacy-v3-redirect";

describe("v3 legacy collection links", () => {
  it("retains allowlisted query values and drops unknown or unsafe values", () => {
    expect(legacyV3CollectionDestination("saved", { q: "tarta de queso", page: "2", returnTo: "https://bad.test", token: "secret" }))
      .toBe("/app/cook?view=saved&q=tarta+de+queso&page=2");
    expect(legacyV3CollectionDestination("today", { page: "0", q: ["one", "two"] }))
      .toBe("/app/cook?view=today");
  });
});
