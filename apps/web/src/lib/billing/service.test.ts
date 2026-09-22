import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  customersForUser: vi.fn(),
  customersForFirebaseUid: vi.fn(),
  createCustomer: vi.fn(),
  getCustomer: vi.fn(),
  getSubscription: vi.fn(),
  subscriptions: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../supabase/admin", () => ({ createAdminSupabaseClient: mocks.admin }));
vi.mock("./stripe.server", () => ({ stripe: mocks }));

import { applyEvent, canonicalCustomer, reconcile, resolveCustomerUser } from "./service.server";

function query(data: unknown, error: unknown = null) {
  const chain = {
    select: () => chain, eq: () => chain, not: () => chain,
    limit: async () => ({ data, error }),
    maybeSingle: async () => ({ data: null, error: null }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve),
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.customersForUser.mockResolvedValue([]);
  mocks.customersForFirebaseUid.mockResolvedValue([]);
  mocks.createCustomer.mockResolvedValue({ id: "cus_new" });
  mocks.getCustomer.mockResolvedValue({ id: "cus_one", metadata: { supabase_user_id: "user-one" } });
});

describe("canonical Stripe customer", () => {
  it("uses exactly one legacy Firebase customer without creating another", async () => {
    mocks.admin.mockReturnValue({ from: (table: string) => query(table === "legacy_id_map" ? [{ legacy_id: "firebase-one" }] : []) });
    mocks.customersForFirebaseUid.mockResolvedValue([{ id: "cus_legacy" }]);
    expect(await canonicalCustomer("user-one", true)).toEqual({ id: "cus_legacy" });
    expect(mocks.createCustomer).not.toHaveBeenCalled();
  });

  it("rejects several matching customers rather than picking one", async () => {
    mocks.admin.mockReturnValue({ from: () => query([]) });
    mocks.customersForUser.mockResolvedValue([{ id: "cus_a" }, { id: "cus_b" }]);
    expect(await canonicalCustomer("user-one", true)).toEqual({ code: "CUSTOMER_AMBIGUOUS" });
    expect(mocks.createCustomer).not.toHaveBeenCalled();
  });

  it("does not create a customer for the Portal", async () => {
    mocks.admin.mockReturnValue({ from: () => query([]) });
    expect(await canonicalCustomer("user-one", false)).toEqual({ code: "CUSTOMER_NOT_FOUND" });
    expect(mocks.createCustomer).not.toHaveBeenCalled();
  });

  it("requires one and only one Firebase mapping", async () => {
    const customer = { metadata: { firebase_uid: "firebase-one" } };
    expect(await resolveCustomerUser(customer, { from: () => query([]) })).toEqual({ code: "CUSTOMER_NOT_FOUND" });
    expect(await resolveCustomerUser(customer, { from: () => query([{ target_id: "a" }, { target_id: "b" }]) })).toEqual({ code: "CUSTOMER_AMBIGUOUS" });
    expect(await resolveCustomerUser(customer, { from: () => query([{ target_id: "user-one" }]) })).toEqual({ userId: "user-one" });
  });
});

describe("webhook processing boundary", () => {
  it("fails retryably when the atomic event RPC fails", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "db down" } });
    mocks.admin.mockReturnValue({ from: () => query(null), rpc });
    await expect(applyEvent({ id: "evt_1", type: "ignored.type", created: 1, data: { object: { id: "obj_1" } } })).rejects.toThrow("BILLING_UNAVAILABLE");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("replays a recorded event without contacting Stripe or writing", async () => {
    const rpc = vi.fn();
    mocks.admin.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { result: { outcome: "applied" } } }) }) }) }), rpc });
    expect(await applyEvent({ id: "evt_1", type: "customer.subscription.updated", created: 100, data: { object: { id: "sub_1" } } })).toEqual({ result: { outcome: "applied" }, replay: true });
    expect(mocks.getCustomer).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("uses the event cursor and canonical subscription status", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { outcome: "applied", status: "trialing" }, error: null });
    mocks.admin.mockReturnValue({ from: () => query(null), rpc });
    const event = { id: "evt_trial", type: "customer.subscription.updated", created: 105, data: { object: { id: "sub_1", customer: "cus_one", status: "trialing", current_period_end: 1_700_000_000 } } };
    expect((await applyEvent(event)).result).toEqual({ outcome: "applied", status: "trialing" });
    expect(rpc).toHaveBeenCalledWith("process_stripe_event", expect.objectContaining({ p_event_created: 105, p_event_id: "evt_trial", p_status: "trialing", p_user_id: "user-one" }));
  });

  it("fetches the current subscription for an invoice event", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { outcome: "applied" }, error: null });
    mocks.admin.mockReturnValue({ from: () => query(null), rpc });
    mocks.getSubscription.mockResolvedValue({ id: "sub_1", status: "past_due", current_period_end: 1_700_000_000, cancel_at_period_end: false });
    await applyEvent({ id: "evt_invoice", type: "invoice.payment_failed", created: 107, data: { object: { id: "in_1", customer: "cus_one", subscription: "sub_1" } } });
    expect(mocks.getSubscription).toHaveBeenCalledWith("sub_1");
    expect(rpc).toHaveBeenCalledWith("process_stripe_event", expect.objectContaining({ p_status: "past_due", p_event_created: 107 }));
  });
});

describe("reconciliation", () => {
  it("chooses one deterministic subscription and records an anomaly", async () => {
    vi.spyOn(Date, "now").mockReturnValue(200_000);
    const insert = vi.fn().mockResolvedValue({ error: null });
    const rpc = vi.fn().mockResolvedValue({ data: { applied: true, eventCursor: { created: 200, id: "!reconcile:sub_new:200" } }, error: null });
    mocks.admin.mockReturnValue({ from: () => ({ insert }), rpc });
    mocks.subscriptions.mockResolvedValue([{ id: "sub_old", created: 10, status: "canceled" }, { id: "sub_new", created: 20, status: "active" }]);
    const result = await reconcile("cus_one");
    expect(result).toEqual({ customerId: "cus_one", userId: "user-one", status: "active", applied: true, eventCursor: { created: 200, id: "!reconcile:sub_new:200" } });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ code: "MULTIPLE_SUBSCRIPTIONS" }));
    expect(rpc).toHaveBeenCalledWith("reconcile_subscription", expect.objectContaining({ p_subscription_id: "sub_new", p_event_created: 200 }));
    vi.restoreAllMocks();
  });
});
