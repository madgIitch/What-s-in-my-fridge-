/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createAdminSupabaseClient } from "../supabase/admin";
import { isBillingStatus, type BillingStatus, type Entitlement } from "./contracts";
import { stripe, type StripeEvent } from "./stripe.server";

type DbLike = any;
const customerId = (value: unknown) => typeof value === "string" ? value : (value as { id?: string } | null)?.id ?? null;

export async function resolveCustomerUser(customer: { metadata?: Record<string, string> }, db: DbLike): Promise<{ userId?: string; code?: string }> {
  if (customer.metadata?.supabase_user_id) return { userId: customer.metadata.supabase_user_id };
  const firebaseUid = customer.metadata?.firebase_uid;
  if (!firebaseUid) return { code: "CUSTOMER_NOT_FOUND" };
  const { data, error } = await db.from("legacy_id_map").select("target_id").eq("source", "FIREBASE").eq("entity_type", "auth_user").eq("legacy_id", firebaseUid).limit(2);
  if (error || !data?.length) return { code: "CUSTOMER_NOT_FOUND" };
  if (data.length !== 1) return { code: "CUSTOMER_AMBIGUOUS" };
  return { userId: data[0].target_id };
}

export async function canonicalCustomer(userId: string, create: boolean): Promise<{ id?: string; code?: string }> {
  const db: DbLike = createAdminSupabaseClient();
  const { data, error } = await db.from("subscriptions").select("stripe_customer_id").eq("user_id", userId).not("stripe_customer_id", "is", null).limit(2);
  if (error) throw new Error("BILLING_UNAVAILABLE");
  const local = [...new Set<string>((data ?? []).map((x: { stripe_customer_id: string | null }) => x.stripe_customer_id).filter((value: string | null): value is string => Boolean(value)))];
  if (local.length > 1) return { code: "CUSTOMER_AMBIGUOUS" };
  if (local.length === 1) return { id: local[0]! };
  const mappings = await db.from("legacy_id_map").select("legacy_id").eq("source", "FIREBASE").eq("entity_type", "auth_user").eq("target_id", userId);
  if (mappings.error) throw new Error("BILLING_UNAVAILABLE");
  const found = await Promise.all([stripe.customersForUser(userId), ...((mappings.data ?? []) as Array<{ legacy_id: string }>).map((row) => stripe.customersForFirebaseUid(row.legacy_id))]);
  const remote = [...new Map(found.flat().map((customer) => [customer.id, customer])).values()];
  if (remote.length > 1) return { code: "CUSTOMER_AMBIGUOUS" };
  if (remote.length === 1) return { id: remote[0].id };
  if (!create) return { code: "CUSTOMER_NOT_FOUND" };
  return { id: (await stripe.createCustomer(userId)).id };
}

function normalizeSubscription(value: any, fallbackCreated: number, fallbackId: string) {
  const status: BillingStatus = isBillingStatus(value.status) && value.status !== "none" ? value.status : "canceled";
  return { subscriptionId: value.id, status, currentPeriodEnd: value.current_period_end ? new Date(value.current_period_end * 1000).toISOString() : null, cancelAtPeriodEnd: Boolean(value.cancel_at_period_end), cursor: { created: fallbackCreated, id: fallbackId } };
}

export async function applyEvent(event: StripeEvent): Promise<{ result: unknown; replay: boolean }> {
  const db: DbLike = createAdminSupabaseClient();
  const existing = await db.from("stripe_events").select("result").eq("event_id", event.id).maybeSingle();
  if (existing.data) return { result: existing.data.result, replay: true };
  const supported = ["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "invoice.payment_failed", "invoice.payment_succeeded"];
  if (!supported.includes(event.type)) {
    const result = { outcome: "ignored" };
    const rpc = await db.rpc("process_stripe_event", { p_event_id: event.id, p_event_type: event.type, p_event_created: event.created, p_user_id: null, p_customer_id: null, p_subscription_id: null, p_status: null, p_period_end: null, p_cancel_at_period_end: false, p_result: result });
    if (rpc.error) throw new Error("BILLING_UNAVAILABLE");
    return { result: rpc.data ?? result, replay: false };
  }
  let object: any = event.data.object;
  const cid = customerId(object.customer) ?? (event.type === "checkout.session.completed" ? customerId(object.customer) : null);
  if (!cid) throw new Error("CUSTOMER_NOT_FOUND");
  const customer = await stripe.getCustomer(cid);
  const mapped = await resolveCustomerUser(customer, db);
  if (!mapped.userId) throw new Error(mapped.code);
  if (event.type === "checkout.session.completed") {
    const result = { outcome: "recorded" };
    const rpc = await db.rpc("process_stripe_event", { p_event_id: event.id, p_event_type: event.type, p_event_created: event.created, p_user_id: mapped.userId, p_customer_id: cid, p_subscription_id: null, p_status: null, p_period_end: null, p_cancel_at_period_end: false, p_result: result });
    if (rpc.error) throw new Error("BILLING_UNAVAILABLE");
    return { result: rpc.data ?? result, replay: false };
  }
  if (event.type.startsWith("invoice.")) {
    const sid = customerId(object.subscription);
    if (!sid) throw new Error("CUSTOMER_NOT_FOUND");
    object = await stripe.getSubscription(sid);
  }
  const normalized = normalizeSubscription(object, event.created, event.id);
  const result = { outcome: "applied", status: normalized.status };
  const rpc = await db.rpc("process_stripe_event", { p_event_id: event.id, p_event_type: event.type, p_event_created: event.created, p_user_id: mapped.userId, p_customer_id: cid, p_subscription_id: normalized.subscriptionId, p_status: normalized.status, p_period_end: normalized.currentPeriodEnd, p_cancel_at_period_end: normalized.cancelAtPeriodEnd, p_result: result });
  if (rpc.error) throw new Error("BILLING_UNAVAILABLE");
  return { result: rpc.data ?? result, replay: false };
}

export async function entitlementFor(userId: string): Promise<Entitlement> {
  const db: DbLike = createAdminSupabaseClient();
  const { data, error } = await db.rpc("billing_entitlement", { p_user_id: userId });
  if (error || !data) throw new Error("BILLING_UNAVAILABLE");
  const value = data as any;
  return { plan: value.plan, status: value.status, source: value.source, currentPeriodEnd: value.currentPeriodEnd ?? null, cancelAtPeriodEnd: Boolean(value.cancelAtPeriodEnd) };
}

export async function reconcile(customerIdValue: string) {
  const db: DbLike = createAdminSupabaseClient();
  let customer;
  try { customer = await stripe.getCustomer(customerIdValue); } catch { throw new Error("CUSTOMER_NOT_FOUND"); }
  const mapped = await resolveCustomerUser(customer, db);
  if (!mapped.userId) throw new Error(mapped.code);
  const observedAt = Math.floor(Date.now() / 1000);
  const values = await stripe.subscriptions(customerIdValue);
  if (values.length > 1) {
    const anomaly = await db.from("billing_anomalies").insert({ user_id: mapped.userId, stripe_customer_id: customerIdValue, code: "MULTIPLE_SUBSCRIPTIONS", detail: { count: values.length } });
    if (anomaly.error) throw new Error("BILLING_UNAVAILABLE");
  }
  const chosen = values.sort((a, b) => (b.created ?? 0) - (a.created ?? 0) || b.id.localeCompare(a.id))[0];
  const cursor = { created: observedAt, id: `!reconcile:${chosen?.id ?? "none"}:${observedAt}` };
  const status: BillingStatus = chosen && isBillingStatus(chosen.status) ? chosen.status : "none";
  const result = await db.rpc("reconcile_subscription", { p_user_id: mapped.userId, p_customer_id: customerIdValue, p_subscription_id: chosen?.id ?? null, p_status: status, p_period_end: chosen?.current_period_end ? new Date(chosen.current_period_end * 1000).toISOString() : null, p_cancel_at_period_end: Boolean(chosen?.cancel_at_period_end), p_event_created: cursor.created, p_event_id: cursor.id });
  if (result.error) throw new Error("BILLING_UNAVAILABLE");
  return { customerId: customerIdValue, userId: mapped.userId, status: (result.data as any)?.status ?? status, applied: Boolean((result.data as any)?.applied), eventCursor: (result.data as any)?.eventCursor ?? null };
}
