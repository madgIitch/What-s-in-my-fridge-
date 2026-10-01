import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ adminRpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient: () => ({ rpc: mocks.adminRpc }) }));

import { calculateToday, type TodayDb } from "./today.server";

type DbResult = { data: unknown; error: { message: string } | null };
class Query implements PromiseLike<DbResult> {
  calls: Array<[string, unknown]> = [];
  constructor(private readonly result: DbResult) {}
  select(value?: string) { this.calls.push(["select", value]); return this; }
  eq(column: string, value: unknown) { this.calls.push([`eq:${column}`, value]); return this; }
  in(column: string, value: string[]) { this.calls.push([`in:${column}`, value]); return this; }
  is(column: string, value: null) { this.calls.push([`is:${column}`, value]); return this; }
  order(column: string) { this.calls.push(["order", column]); return this; }
  limit(value: number) { this.calls.push(["limit", value]); return this; }
  then<TResult1 = DbResult, TResult2 = never>(onfulfilled?: ((value: DbResult) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null) { return Promise.resolve(this.result).then(onfulfilled, onrejected); }
}

const ids = [1, 2, 3, 4].map((value) => `94000000-0000-4000-a000-00000000000${value}`);
function fixtureDb(readActions: Array<Record<string, unknown>>) {
  const queries: Record<string, Query[]> = {};
  const rows: Record<string, unknown> = {
    catalog_versions: [{ id: "93000000-0000-4000-a000-000000000001", matcher_version: "matcher-r2" }],
    inventory_items: [{ id: "pantry", name: "Huevos", food_concept_id: "egg", commercial_product_id: null, deleted_at: null, normalization_status: "confirmed", stock_mode: "exact", stock_state: "some", quantity_precision: "exact", quantity_exact: 2, quantity_unit: "unit", freshness_precision: "exact", freshness_source: "package", acquired_on: null, freshness_estimated_days: null, expiry_date_exact: "2026-10-03", knowledge_provenance: "user" }],
    recipes: ids.map((id) => ({ id, name: id, recipe_ingredients: [{ name: "Huevos", normalized_name: "huevos", measure: "1 unit", food_concept_id: "egg", position: 0 }, { name: "Tomate", normalized_name: "tomate", measure: "1 unit", food_concept_id: "tomato", position: 1 }] })),
    food_concepts: [{ id: "egg", display_name: "Huevos", food_concept_aliases: [] }, { id: "tomato", display_name: "Tomate", food_concept_aliases: [] }],
    favorite_recipes: [{ recipe_id: ids[3] }],
  };
  const db = {
    from(table: string) { const query = new Query({ data: rows[table] ?? [], error: null }); (queries[table] ??= []).push(query); return query; },
    rpc(name: string) {
      if (name === "read_today_cache_v1") return Promise.resolve({ data: readActions.shift(), error: null });
      if (name === "find_today_recipe_candidates_v1") return Promise.resolve({ data: ids.map((recipe_id) => ({ recipe_id })), error: null });
      return Promise.resolve({ data: null, error: { message: "unexpected" } });
    },
  } as unknown as TodayDb;
  return { db, queries };
}

beforeEach(() => { vi.clearAllMocks(); });

describe("Today server snapshot lifecycle", () => {
  it("uses the DB-authorized unexpired hit without loading private inputs", async () => {
    const response = { contract: "today-v2", date: "2026-10-02", generatedAt: "now", state: "no_candidates", main: [], secondary: [], snapshotKey: "snapshot", catalogVersion: "catalog", matcherVersion: "matcher-r2", recommendationVersion: "today-ranking-v3" } as const;
    const { db, queries } = fixtureDb([{ action: "hit", cacheKey: "key", result: { response } }]);
    await expect(calculateToday(db, "user", "2026-10-02")).resolves.toEqual(response);
    expect(queries.inventory_items).toBeUndefined(); expect(mocks.adminRpc).not.toHaveBeenCalled();
  });

  it("retries a stale publish, preserves the winning snapshot, and authorizes missing secondary recipes", async () => {
    const { db, queries } = fixtureDb([{ action: "miss", cacheKey: "key-one" }, { action: "miss", cacheKey: "key-two" }]);
    mocks.adminRpc.mockResolvedValueOnce({ data: { action: "stale" }, error: null }).mockImplementationOnce((_name, args) => ({ data: { action: "stored", result: args.p_result }, error: null }));
    const result = await calculateToday(db, "user", "2026-10-02");
    expect(result.main).toHaveLength(3); expect(result.secondary).toHaveLength(1);
    expect(mocks.adminRpc).toHaveBeenCalledTimes(2);
    const publish = mocks.adminRpc.mock.calls[1][1] as { p_result: { authorizedRecipeIds: string[] } };
    expect(publish.p_result.authorizedRecipeIds).toEqual(expect.arrayContaining(ids));
    expect(queries.favorite_recipes[0].calls).toContainEqual(["in:recipe_id", ids]);
    expect(queries.favorite_recipes[0].calls.some(([name]) => name === "limit")).toBe(false);
  });
});
