import { afterEach, describe, expect, it } from "vitest";
import { getPublicSupabaseConfig } from "./config";

const original = { ...process.env };
afterEach(() => { process.env = { ...original }; });

describe("public Supabase config", () => {
  it("fails explicitly when browser-safe configuration is absent", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(() => getPublicSupabaseConfig()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("returns only public values", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-test-key";
    expect(getPublicSupabaseConfig()).toEqual({ url: "http://127.0.0.1:54321", publishableKey: "public-test-key" });
  });
});
