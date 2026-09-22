import { describe, expect, it } from "vitest";
import { exactObject } from "./contracts";

describe("billing request boundary", () => {
  it("accepts exactly the declared properties", async () => {
    expect(await exactObject(new Request("http://local", { method: "POST", body: JSON.stringify({ returnTo: "/app/pro" }) }), ["returnTo"])).toEqual({ returnTo: "/app/pro" });
    expect(await exactObject(new Request("http://local", { method: "POST", body: JSON.stringify({ returnTo: "/app/pro", userId: "injected" }) }), ["returnTo"])).toBeNull();
  });
});
