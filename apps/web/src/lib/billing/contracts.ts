import type { ApiEnvelope, BillingFeature, Entitlement } from "../../../../../packages/domain/src/billing";
import { timingSafeEqual } from "node:crypto";

export type { ApiEnvelope, BillingFeature, Entitlement };
export const FEATURES: BillingFeature[] = ["recipe_suggestions", "receipt_ocr", "recipe_import"];
export const BILLING_STATUSES = ["active", "trialing", "past_due", "canceled", "unpaid", "incomplete", "incomplete_expired", "paused", "none"] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];
export function isBillingStatus(value: unknown): value is BillingStatus { return typeof value === "string" && (BILLING_STATUSES as readonly string[]).includes(value); }

export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ ok: true, data, error: null } satisfies ApiEnvelope<T>, init);
}

export function fail(code: string, message: string, status: number, retryable = false): Response {
  return Response.json({ ok: false, data: null, error: { code, message, retryable } } satisfies ApiEnvelope<never>, { status });
}

export async function exactObject(request: Request, keys: readonly string[]): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const actual = Object.keys(body).sort();
    const expected = [...keys].sort();
    return actual.length === expected.length && actual.every((key, index) => key === expected[index]) ? body as Record<string, unknown> : null;
  } catch { return null; }
}

export function bearer(request: Request, expected: string | undefined): boolean {
  if (!expected) return false;
  const supplied = request.headers.get("authorization");
  if (!supplied?.startsWith("Bearer ")) return false;
  const actual = Buffer.from(supplied.slice(7));
  const secret = Buffer.from(expected);
  return actual.length === secret.length && timingSafeEqual(actual, secret);
}
