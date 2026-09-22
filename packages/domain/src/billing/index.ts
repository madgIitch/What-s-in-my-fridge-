export const BILLING_STATUSES = ["active", "trialing", "past_due", "canceled", "unpaid", "incomplete", "incomplete_expired", "paused", "none"] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];
export type BillingFeature = "recipe_suggestions" | "receipt_ocr" | "recipe_import";
export const BILLING_LIMITS: Record<BillingFeature, number> = { recipe_suggestions: 5, receipt_ocr: 5, recipe_import: 10 };

export type ApiEnvelope<T> = { ok: true; data: T; error: null } | { ok: false; data: null; error: { code: string; message: string; retryable: boolean } };
export type Entitlement = { plan: "free" | "pro"; status: BillingStatus; source: "override" | "stripe" | "legacy" | "default"; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean };

export function isBillingStatus(value: unknown): value is BillingStatus {
  return typeof value === "string" && (BILLING_STATUSES as readonly string[]).includes(value);
}

export function isProStatus(status: BillingStatus): boolean {
  return status === "active" || status === "trialing";
}
