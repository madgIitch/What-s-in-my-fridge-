import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  row: { id: "draft-1", raw_text: "MERCADO\n1 COUS COUS\n1,95", ocr_locale: "es-ES" } as { id: string; raw_text: string; ocr_locale: string } | null,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => {
    const query = {
      eq: () => query, is: () => query, order: () => query, limit: () => query,
      maybeSingle: async () => ({ data: state.row, error: null }),
    };
    return {
      auth: { getUser: async () => ({ data: { user: state.user } }) },
      from: () => ({ select: () => query }),
    };
  },
}));

import { GET } from "./route";

describe("recover receipt draft", () => {
  beforeEach(() => {
    state.user = { id: "user-1" };
    state.row = { id: "draft-1", raw_text: "MERCADO\n1 COUS COUS\n1,95", ocr_locale: "es-ES" };
  });

  it("reinterprets a pending draft without another Vision call", async () => {
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.draftId).toBe("draft-1");
    expect(body.draft.items[0]).toMatchObject({ name: "COUS COUS", totalPrice: "1.95" });
  });

  it("requires a session", async () => {
    state.user = null;
    expect((await GET()).status).toBe(401);
  });

  it("reports when there is no unfinished draft", async () => {
    state.row = null;
    expect((await GET()).status).toBe(404);
  });
});
