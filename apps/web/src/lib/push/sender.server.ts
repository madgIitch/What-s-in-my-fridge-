import { randomInt } from "node:crypto";
import { makePushPayload } from "./contracts";

export type Delivery = { id: string; subscription_id: string; event_key: string; job_id: string; completed_version: number; attempts: number; endpoint: string; p256dh: string; auth: string };
export type PushTransport = (subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string) => Promise<{ status: number }>;
type Db = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
};

const retryableStatus = (status: number) => status === 429 || status >= 500;
export function classifyPushFailure(status: number): { code: string; retryable: boolean; revoke: boolean } {
  if (status === 404 || status === 410) return { code: "SUBSCRIPTION_GONE", retryable: false, revoke: true };
  if (retryableStatus(status)) return { code: "PUSH_RETRYABLE", retryable: true, revoke: false };
  return { code: "PUSH_TERMINAL", retryable: false, revoke: false };
}

export function retryDelayMs(attempt: number, jitter = randomInt(0, 1000)): number { return Math.min(60_000, 2 ** Math.max(0, attempt - 1) * 5_000) + jitter; }

export async function deliverClaimedPush(db: Db, delivery: Delivery, transport: PushTransport): Promise<"sent" | "retry" | "terminal"> {
  const eventId = Buffer.from(delivery.event_key).toString("base64url");
  const payload = makePushPayload(eventId, `/app/recipes/import?job=${encodeURIComponent(delivery.job_id)}`);
  if (!payload || Buffer.byteLength(JSON.stringify(payload)) > 4096) {
    await db.rpc("finish_push_delivery", { p_delivery_id: delivery.id, p_status: "terminal", p_error_code: "INVALID_PAYLOAD", p_next_attempt_at: null, p_revoke_subscription: false });
    return "terminal";
  }
  try {
    const response = await transport({ endpoint: delivery.endpoint, keys: { p256dh: delivery.p256dh, auth: delivery.auth } }, JSON.stringify(payload));
    if (response.status >= 200 && response.status < 300) {
      await db.rpc("finish_push_delivery", { p_delivery_id: delivery.id, p_status: "sent", p_error_code: null, p_next_attempt_at: null, p_revoke_subscription: false }); return "sent";
    }
    const outcome = classifyPushFailure(response.status); const retry = outcome.retryable && delivery.attempts < 3;
    await db.rpc("finish_push_delivery", { p_delivery_id: delivery.id, p_status: retry ? "pending" : "terminal", p_error_code: retry ? "PUSH_RETRYABLE" : outcome.code, p_next_attempt_at: retry ? new Date(Date.now() + retryDelayMs(delivery.attempts)).toISOString() : null, p_revoke_subscription: outcome.revoke });
    return retry ? "retry" : "terminal";
  } catch {
    const retry = delivery.attempts < 3;
    await db.rpc("finish_push_delivery", { p_delivery_id: delivery.id, p_status: retry ? "pending" : "terminal", p_error_code: retry ? "PUSH_RETRYABLE" : "PUSH_TIMEOUT", p_next_attempt_at: retry ? new Date(Date.now() + retryDelayMs(delivery.attempts)).toISOString() : null, p_revoke_subscription: false });
    return retry ? "retry" : "terminal";
  }
}
