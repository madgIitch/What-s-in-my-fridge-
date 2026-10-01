import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({
    rpc: async (_name: string, args: { p_result: unknown }) => ({ data: { action: "stored", result: args.p_result }, error: null }),
  }),
}));

import { calculateToday, type TodayDb } from "./today.server";

function fixture(pantry: Record<string, unknown>[]) {
  const rpc = vi.fn(async () => ({ data: { action: "miss", cacheKey: "a".repeat(64) }, error: null }));
  const db = {
    rpc,
    from(table: string) {
      const result = { data: table === "catalog_versions" ? [{ id: "catalog", matcher_version: "test" }] : pantry, error: null };
      const query = Object.assign(Promise.resolve(result), {
        select: () => query, eq: () => query, in: () => query, is: () => query, order: () => query, limit: () => query,
      });
      return query;
    },
  } as unknown as TodayDb;
  return { db, rpc };
}

const legacy = {
  id: "legacy", name: "Compra anterior", deleted_at: null, food_concept_id: null,
  normalization_status: "unknown", stock_mode: "presence", stock_state: null,
  quantity_precision: "unknown", freshness_precision: "unknown", knowledge_provenance: "legacy",
};

describe("Today pantry state for migrated accounts", () => {
  it("asks to review an existing legacy item instead of treating the account as new", async () => {
    const { db, rpc } = fixture([legacy]);
    const result = await calculateToday(db, "owner", "2026-10-02");
    expect(result.state).toBe("unresolved_pantry");
    expect(result.main).toEqual([]);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("does not use a confirmed concept when its presence is still unknown", async () => {
    const { db, rpc } = fixture([{ ...legacy, food_concept_id: "concept", normalization_status: "confirmed" }]);
    const result = await calculateToday(db, "owner", "2026-10-02");
    expect(result.state).toBe("unresolved_pantry");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("allows the empty state after explicitly absent, empty, zero or deleted items", async () => {
    const { db } = fixture([
      { ...legacy, stock_state: "absent" },
      { ...legacy, stock_mode: "qualitative", stock_state: "empty" },
      { ...legacy, stock_mode: "exact", quantity_exact: 0 },
      { ...legacy, deleted_at: "2026-10-02T10:00:00Z" },
    ]);
    expect((await calculateToday(db, "owner", "2026-10-02")).state).toBe("empty_pantry");
  });
});
