import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), rpc: vi.fn(), adminRpc: vi.fn(),
  canonicalCustomer: vi.fn(), entitlementFor: vi.fn(), applyEvent: vi.fn(), reconcile: vi.fn(),
  createCheckout: vi.fn(), createPortal: vi.fn(), verifyWebhook: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient: () => ({ rpc: mocks.adminRpc }) }));
vi.mock("@/lib/billing/service.server", () => ({ canonicalCustomer: mocks.canonicalCustomer, entitlementFor: mocks.entitlementFor, applyEvent: mocks.applyEvent, reconcile: mocks.reconcile }));
vi.mock("@/lib/billing/stripe.server", () => ({ stripe: { createCheckout: mocks.createCheckout, createPortal: mocks.createPortal }, verifyWebhook: mocks.verifyWebhook }));

import { POST as checkout } from "../../app/api/stripe/checkout/route";
import { POST as portal } from "../../app/api/stripe/portal/route";
import { POST as webhook } from "../../app/api/stripe/webhook/route";
import { POST as override } from "../../app/api/stripe/admin/override/route";
import { POST as reconcile } from "../../app/api/stripe/reconcile/route";
import { GET as entitlement } from "../../app/api/stripe/entitlement/route";
import { POST as consume } from "../../app/api/usage/consume/route";

const request = (path: string, body: unknown, token?: string) => new Request(`http://local${path}`, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks(); vi.unstubAllEnvs();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://neverita.example");
  vi.stubEnv("STRIPE_PRO_PRICE_ID", "price_server_only");
  vi.stubEnv("BILLING_ADMIN_SECRET", "admin-test-secret");
  vi.stubEnv("STRIPE_RECONCILE_SECRET", "reconcile-test-secret");
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-one" } } });
  mocks.canonicalCustomer.mockResolvedValue({ id: "cus_one" });
  mocks.createCheckout.mockResolvedValue({ url: "https://checkout.stripe.test/session" });
  mocks.createPortal.mockResolvedValue({ url: "https://billing.stripe.test/session" });
});

describe("Stripe HTTP boundaries", () => {
  it("rejects unauthenticated checkout without contacting Stripe", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const response = await checkout(request("/api/stripe/checkout", { returnTo: "/app/pro" }));
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
    expect(mocks.canonicalCustomer).not.toHaveBeenCalled();
  });

  it("rejects external and extra-field redirects", async () => {
    expect((await checkout(request("/api/stripe/checkout", { returnTo: "https://evil.example" }))).status).toBe(400);
    expect((await checkout(request("/api/stripe/checkout", { returnTo: "/app/pro", userId: "another" }))).status).toBe(400);
    expect(mocks.canonicalCustomer).not.toHaveBeenCalled();
  });

  it("creates checkout with server-built return URLs", async () => {
    const response = await checkout(request("/api/stripe/checkout", { returnTo: "/app/pro" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, data: { url: "https://checkout.stripe.test/session" }, error: null });
    expect(mocks.createCheckout).toHaveBeenCalledWith("cus_one", "user-one", "https://neverita.example/app/pro?checkout=success", "https://neverita.example/app/pro?checkout=cancel");
  });

  it("never echoes a provider secret on checkout failure", async () => {
    mocks.createCheckout.mockRejectedValue(new Error("sk_test_private_provider_detail"));
    const response = await checkout(request("/api/stripe/checkout", { returnTo: "/app/pro" }));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("sk_test_private_provider_detail");
  });

  it("never creates a customer when opening the Portal", async () => {
    mocks.canonicalCustomer.mockResolvedValue({ code: "CUSTOMER_NOT_FOUND" });
    const response = await portal(request("/api/stripe/portal", { returnTo: "/app/pro" }));
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("CUSTOMER_NOT_FOUND");
    expect(mocks.canonicalCustomer).toHaveBeenCalledWith("user-one", false);
    expect(mocks.createPortal).not.toHaveBeenCalled();
  });

  it("rejects invalid webhook signatures before any writes", async () => {
    mocks.verifyWebhook.mockReturnValue(null);
    const response = await webhook(new Request("http://local/api/stripe/webhook", { method: "POST", body: "{}" }));
    expect(response.status).toBe(400);
    expect(mocks.applyEvent).not.toHaveBeenCalled();
  });

  it("returns the stored result for a valid webhook replay", async () => {
    mocks.verifyWebhook.mockReturnValue({ id: "evt_1", type: "customer.subscription.updated", created: 100, data: { object: { id: "sub_1" } } });
    mocks.applyEvent.mockResolvedValue({ result: { outcome: "applied" }, replay: true });
    const response = await webhook(new Request("http://local/api/stripe/webhook", { method: "POST", body: "signed" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, data: { outcome: "applied" }, error: null });
  });

  it("reads only the authenticated user's canonical entitlement", async () => {
    mocks.entitlementFor.mockResolvedValue({ plan: "pro", status: "trialing", source: "stripe", currentPeriodEnd: null, cancelAtPeriodEnd: false });
    const response = await entitlement();
    expect(response.status).toBe(200);
    expect((await response.json()).data.plan).toBe("pro");
    expect(mocks.entitlementFor).toHaveBeenCalledWith("user-one");
  });

  it("requires the dedicated override secret and derives the actor", async () => {
    expect((await override(request("/api/stripe/admin/override", { userId: "user-one", value: true, reason: "support" }))).status).toBe(401);
    mocks.adminRpc.mockResolvedValue({ data: { before: {}, after: {} }, error: null });
    const response = await override(request("/api/stripe/admin/override", { userId: "user-one", value: true, reason: "support" }, "admin-test-secret"));
    expect(response.status).toBe(200);
    expect(mocks.adminRpc).toHaveBeenCalledWith("set_billing_override", { p_user_id: "user-one", p_value: true, p_reason: "support", p_actor: "billing-admin" });
  });

  it("requires the dedicated reconcile secret", async () => {
    expect((await reconcile(request("/api/stripe/reconcile", { stripeCustomerId: "cus_one" }))).status).toBe(401);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("returns the stable reconcile contract for an authorized call", async () => {
    const value = { customerId: "cus_one", userId: "user-one", status: "active", applied: false, eventCursor: { created: 100, id: "evt_100" } };
    mocks.reconcile.mockResolvedValue(value);
    const response = await reconcile(request("/api/stripe/reconcile", { stripeCustomerId: "cus_one" }, "reconcile-test-secret"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, data: value, error: null });
  });
});

describe("usage HTTP contract", () => {
  it("requires a Supabase session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const response = await consume(request("/api/usage/consume", { feature: "receipt_ocr", idempotencyKey: "one" }));
    expect(response.status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("never accepts a caller-provided user, period or limit", async () => {
    const response = await consume(request("/api/usage/consume", { feature: "receipt_ocr", idempotencyKey: "one", period: "2099-01" }));
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns the exact 429 envelope for denied usage and its replay", async () => {
    mocks.rpc.mockResolvedValue({ data: { allowed: false, code: "QUOTA_EXCEEDED" }, error: null });
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await consume(request("/api/usage/consume", { feature: "receipt_ocr", idempotencyKey: "one" }));
      expect(response.status).toBe(429);
      expect(await response.json()).toEqual({ ok: false, data: null, error: { code: "QUOTA_EXCEEDED", message: "Has alcanzado el límite mensual de tu plan", retryable: false } });
    }
  });
});
