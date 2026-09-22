import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stripe, verifyWebhook } from "./stripe.server";

vi.mock("server-only", () => ({}));

const event = { id: "evt_fixture", type: "customer.subscription.updated", created: 1_700_000_000, data: { object: { id: "sub_fixture", customer: "cus_fixture", status: "active" } } };

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Stripe adapter", () => {
  it("rejects missing and invalid webhook signatures before parsing", () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    expect(verifyWebhook(JSON.stringify(event), null)).toBeNull();
    expect(verifyWebhook(JSON.stringify(event), `t=${Math.floor(Date.now() / 1000)},v1=bad`)).toBeNull();
  });

  it("accepts a valid rotated signature over the exact raw body", () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    const raw = JSON.stringify(event);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", "whsec_test").update(`${timestamp}.${raw}`).digest("hex");
    expect(verifyWebhook(raw, `t=${timestamp},v1=${"0".repeat(64)},v1=${signature}`)).toEqual(event);
    expect(verifyWebhook(`${raw} `, `t=${timestamp},v1=${signature}`)).toBeNull();
  });

  it("pins the API version and never places the secret in the URL or body", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_private");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    await stripe.customersForUser("00000000-0000-4000-8000-000000000001");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain("sk_test_private");
    expect(init.headers).toMatchObject({ "Stripe-Version": "2024-06-20", Authorization: "Bearer sk_test_private" });
    expect(init.body).toBeUndefined();
  });

  it("uses only the server price and stamps the Checkout Session with the user ID", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_private");
    vi.stubEnv("STRIPE_PRO_PRICE_ID", "price_server_only");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: "https://checkout.stripe.test/session" }) });
    vi.stubGlobal("fetch", fetchMock);
    await stripe.createCheckout("cus_one", "user-one", "https://app.test/app/pro?checkout=success", "https://app.test/app/pro?checkout=cancel");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = new URLSearchParams(String(init.body));
    expect(body.get("line_items[0][price]")).toBe("price_server_only");
    expect(body.get("metadata[supabase_user_id]")).toBe("user-one");
    expect(body.get("customer")).toBe("cus_one");
    expect(body.toString()).not.toContain("sk_test_private");
  });
});
