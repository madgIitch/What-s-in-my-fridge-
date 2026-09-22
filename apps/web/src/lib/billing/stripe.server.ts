/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

type StripeObject = { id: string; metadata?: Record<string, string>; customer?: string | { id: string }; subscription?: string | { id: string }; status?: string; current_period_end?: number; cancel_at_period_end?: boolean; created?: number };
export type StripeEvent = { id: string; type: string; created: number; data: { object: StripeObject } };

function config() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("STRIPE_UNAVAILABLE");
  return { secret, base: "https://api.stripe.com/v1" };
}

async function call(path: string, init?: RequestInit): Promise<any> {
  const { secret, base } = config();
  const response = await fetch(`${base}${path}`, { ...init, headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded", "Stripe-Version": "2024-06-20", ...init?.headers }, cache: "no-store" });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("STRIPE_UNAVAILABLE");
  return json;
}

const form = (values: Record<string, string>) => new URLSearchParams(values).toString();
export const stripe = {
  async customersForUser(userId: string): Promise<StripeObject[]> {
    const query = encodeURIComponent(`metadata['supabase_user_id']:'${userId.replaceAll("'", "")}'`);
    return (await call(`/customers/search?query=${query}&limit=100`)).data ?? [];
  },
  async customersForFirebaseUid(firebaseUid: string): Promise<StripeObject[]> {
    const query = encodeURIComponent(`metadata['firebase_uid']:'${firebaseUid.replaceAll("'", "").replaceAll("\\", "")}'`);
    return (await call(`/customers/search?query=${query}&limit=100`)).data ?? [];
  },
  createCustomer(userId: string) { return call("/customers", { method: "POST", body: form({ "metadata[supabase_user_id]": userId }), headers: { "Idempotency-Key": `customer:${userId}` } }) as Promise<StripeObject>; },
  getCustomer(id: string) { return call(`/customers/${encodeURIComponent(id)}`) as Promise<StripeObject>; },
  createCheckout(customerId: string, userId: string, success: string, cancel: string) {
    const price = process.env.STRIPE_PRO_PRICE_ID;
    if (!price) throw new Error("STRIPE_UNAVAILABLE");
    return call("/checkout/sessions", { method: "POST", headers: { "Idempotency-Key": `checkout:${userId}:${Math.floor(Date.now() / 300000)}` }, body: form({ mode: "subscription", customer: customerId, "line_items[0][price]": price, "line_items[0][quantity]": "1", allow_promotion_codes: "true", success_url: success, cancel_url: cancel, "metadata[supabase_user_id]": userId }) });
  },
  createPortal(customerId: string, returnUrl: string) { return call("/billing_portal/sessions", { method: "POST", body: form({ customer: customerId, return_url: returnUrl }) }); },
  async subscriptions(customerId: string): Promise<StripeObject[]> { return (await call(`/subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=100`)).data ?? []; },
  getSubscription(id: string) { return call(`/subscriptions/${encodeURIComponent(id)}`) as Promise<StripeObject>; },
};

export function verifyWebhook(raw: string, header: string | null): StripeEvent | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return null;
  const parts = header.split(",").map((part) => part.trim().split("=", 2));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0 || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return null;
  const digest = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  const expected = Buffer.from(digest, "hex");
  if (!signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature ?? "")) return false;
    return timingSafeEqual(expected, Buffer.from(signature!, "hex"));
  })) return null;
  try {
    const event = JSON.parse(raw);
    return typeof event?.id === "string" && typeof event?.type === "string" && Number.isInteger(event?.created) && event?.data?.object && typeof event.data.object === "object" ? event as StripeEvent : null;
  } catch { return null; }
}
