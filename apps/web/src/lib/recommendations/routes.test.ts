import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ enabled: vi.fn(), getUser: vi.fn(), rpc: vi.fn(), calculate: vi.fn() }));
vi.mock("@/app/(auth)/app/product-v3", () => ({ productV3Enabled: mocks.enabled }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }) }));
vi.mock("@/lib/recommendations/today.server", () => ({ calculateToday: mocks.calculate }));

import { GET } from "@/app/api/recommendations/today/route";
import { POST } from "@/app/api/recommendations/shopping/route";

const user = { id: "user-one" };
const validBody = { recipeId: "91000000-0000-4000-a000-000000000001", snapshotKey: "92000000-0000-4000-a000-000000000001", clientMutationId: "93000000-0000-4000-a000-000000000001" };
const response = { contract: "today-v2", date: "2026-10-02", generatedAt: "now", state: "no_candidates", main: [], secondary: [], snapshotKey: validBody.snapshotKey, catalogVersion: "catalog", matcherVersion: "matcher", recommendationVersion: "today-ranking-v3" };

beforeEach(() => {
  vi.clearAllMocks(); mocks.enabled.mockReturnValue(true); mocks.getUser.mockResolvedValue({ data: { user } }); mocks.calculate.mockResolvedValue(response); mocks.rpc.mockResolvedValue({ data: { status: "applied", code: "OK", itemIds: [] }, error: null });
});

describe("Today HTTP contracts", () => {
  it("keeps v3 APIs dark behind the server flag", async () => {
    mocks.enabled.mockReturnValue(false);
    expect((await GET(new Request("http://local/api/recommendations/today"))).status).toBe(404);
    expect((await POST(new Request("http://local/api/recommendations/shopping", { method: "POST", body: JSON.stringify(validBody) }))).status).toBe(404);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("accepts only one valid civil date and no caller-owned inputs", async () => {
    expect((await GET(new Request("http://local/api/recommendations/today?date=2026-02-30"))).status).toBe(400);
    expect((await GET(new Request("http://local/api/recommendations/today?userId=other"))).status).toBe(400);
    expect(mocks.calculate).not.toHaveBeenCalled();
  });

  it("rechecks the session after calculation before exposing the result", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user } }).mockResolvedValueOnce({ data: { user: { id: "user-two" } } });
    const result = await GET(new Request("http://local/api/recommendations/today?date=2026-10-02"));
    expect(result.status).toBe(401); expect(await result.json()).toMatchObject({ code: "AUTH_REQUIRED" });
  });

  it("normalizes catalog and unexpected read failures", async () => {
    mocks.calculate.mockRejectedValueOnce(new Error("CATALOG_NOT_READY"));
    expect((await GET(new Request("http://local/api/recommendations/today"))).status).toBe(409);
    mocks.getUser.mockRejectedValueOnce(new Error("network private detail"));
    const unavailable = await GET(new Request("http://local/api/recommendations/today"));
    expect(unavailable.status).toBe(503); expect(JSON.stringify(await unavailable.json())).not.toContain("private detail");
  });
});

describe("Today shopping HTTP contract", () => {
  const request = (body: unknown) => new Request("http://local/api/recommendations/shopping", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  it("rejects extra fields and maps domain conflicts", async () => {
    expect((await POST(request({ ...validBody, name: "forged" }))).status).toBe(400); expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValueOnce({ data: { status: "conflict", code: "SNAPSHOT_CONFLICT" }, error: null });
    expect((await POST(request(validBody))).status).toBe(409);
  });

  it("normalizes thrown DB errors and rechecks session after writes", async () => {
    mocks.rpc.mockRejectedValueOnce(new Error("database private detail"));
    const unavailable = await POST(request(validBody)); expect(unavailable.status).toBe(503); expect(JSON.stringify(await unavailable.json())).not.toContain("private detail");
    mocks.getUser.mockResolvedValueOnce({ data: { user } }).mockResolvedValueOnce({ data: { user: null } });
    expect((await POST(request(validBody))).status).toBe(401);
  });
});
