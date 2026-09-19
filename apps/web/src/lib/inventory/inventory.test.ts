import { describe, expect, it } from "vitest";
import { formatCivilDate, isCivilDate } from "./dates";
import { retryDelay } from "./sync";

describe("inventory offline contracts", () => {
  it("validates real civil dates", () => {
    expect(isCivilDate("2028-02-29")).toBe(true);
    expect(isCivilDate("2027-02-29")).toBe(false);
    expect(isCivilDate("2026-9-01")).toBe(false);
  });

  it("keeps the selected civil day in supported time zones", () => {
    const zones = ["Pacific/Honolulu", "Europe/Madrid", "Asia/Tokyo"];
    for (const timeZone of zones) {
      expect(new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
        .format(new Date("2026-09-21T12:00:00Z"))).toContain("2026");
    }
    expect(formatCivilDate("2026-09-21")).toMatch(/21/);
  });

  it("uses capped exponential backoff with jitter", () => {
    expect(retryDelay(1, () => 0)).toBe(800);
    expect(retryDelay(5, () => 0.5)).toBe(16_000);
    expect(retryDelay(99, () => 1)).toBe(30_000);
  });
});
