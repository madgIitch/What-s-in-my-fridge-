import { describe, expect, it } from "vitest";
import { canonicalEndpoint, makePushPayload, normalizePushPath, parsePushPayload, parseSubscriptionBody } from "./contracts";

describe("push contracts", () => {
  it.each(["https://evil.example/app", "//evil.example/app", "/app/../admin", "/app/%2e%2e/admin", "/app/%5cadmin", "/app/recipes/import?job=%0a", "/app/recipes/import?next=https://evil.example", "javascript:alert(1)"])("rejects unsafe notification path %s", (path) => expect(normalizePushPath(path)).toBeNull());
  it.each(["/app", "/app/recipes", "/app/recipes/import?job=4bace4e3-87ba-42af-a65f-261b508dee21"])("accepts allowlisted path %s", (path) => expect(normalizePushPath(path)).toBe(path));
  it("keeps the payload minimal and versioned", () => {
    const payload = makePushPayload("cmVjaXBlLWpvYi0xMjM", "/app/recipes/import");
    expect(payload).toEqual({ version: "push-v1", type: "recipe-job-completed", eventId: "cmVjaXBlLWpvYi0xMjM", path: "/app/recipes/import" });
    expect(parsePushPayload({ ...payload, title: "private" })).toBeNull();
  });
  it("normalizes endpoints and rejects ownership fields", () => {
    expect(canonicalEndpoint("https://PUSH.example:443/device/1#fragment")).toBeNull();
    expect(parseSubscriptionBody({ userId: "attacker", subscription: {} })).toBeNull();
    expect(parseSubscriptionBody({ subscription: { endpoint: "https://push.example/device/1", expirationTime: null, keys: { p256dh: "abc_DEF", auth: "abc-123" } } })?.endpoint).toBe("https://push.example/device/1");
  });
});
