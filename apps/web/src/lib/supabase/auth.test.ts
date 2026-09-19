import { describe, expect, it } from "vitest";
import { safeReturnTo } from "./redirects";

describe("safeReturnTo", () => {
  it("accepts only private application paths", () => {
    expect(safeReturnTo("/app/inventory?view=fresh#today")).toBe("/app/inventory?view=fresh#today");
  });

  it.each([null, "", "https://evil.test", "//evil.test/app", "/login", "/application"])(
    "rejects unsafe return target %s",
    (target) => expect(safeReturnTo(target)).toBe("/app"),
  );
});
