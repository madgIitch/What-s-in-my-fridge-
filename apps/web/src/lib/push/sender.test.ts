import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { classifyPushFailure, deliverClaimedPush, retryDelayMs, type Delivery } from "./sender.server";

const delivery: Delivery = { id: "delivery", subscription_id: "subscription", event_key: "recipe-job-completed:4bace4e3-87ba-42af-a65f-261b508dee21:1", job_id: "4bace4e3-87ba-42af-a65f-261b508dee21", completed_version: 1, attempts: 1, endpoint: "https://push.example/device", p256dh: "public", auth: "auth" };
describe("push sender", () => {
  it.each([[404, true], [410, true], [429, false], [503, false]])("classifies %i without leaking subscription data", (status, revoke) => expect(classifyPushFailure(status).revoke).toBe(revoke));
  it("bounds exponential backoff", () => { expect(retryDelayMs(1, 0)).toBe(5000); expect(retryDelayMs(20, 0)).toBe(60000); });
  it("revokes only the claimed subscription on 410", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    expect(await deliverClaimedPush({ rpc }, delivery, async () => ({ status: 410 }))).toBe("terminal");
    expect(rpc).toHaveBeenCalledWith("finish_push_delivery", expect.objectContaining({ p_delivery_id: "delivery", p_revoke_subscription: true, p_error_code: "SUBSCRIPTION_GONE" }));
  });
  it("retries transient failures at most three attempts", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    expect(await deliverClaimedPush({ rpc }, { ...delivery, attempts: 2 }, async () => ({ status: 503 }))).toBe("retry");
    expect(await deliverClaimedPush({ rpc }, { ...delivery, attempts: 3 }, async () => ({ status: 503 }))).toBe("terminal");
  });
});
