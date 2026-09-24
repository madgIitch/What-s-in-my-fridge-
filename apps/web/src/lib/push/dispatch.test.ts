import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { sendNotification, rpc, single } = vi.hoisted(() => ({ sendNotification: vi.fn(), rpc: vi.fn(), single: vi.fn() }));
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification } }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient: () => ({ rpc, from: () => ({ select: () => ({ eq: () => ({ single }) }) }) }) }));

import { dispatchPushBatch } from "./dispatch.server";

const delivery = { id: "delivery", subscription_id: "subscription", event_key: "recipe-job-completed:4bace4e3-87ba-42af-a65f-261b508dee21:1", job_id: "4bace4e3-87ba-42af-a65f-261b508dee21", completed_version: 1, attempts: 1, endpoint: "https://push.example/device", p256dh: "public", auth: "auth" };

describe("push dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VAPID_SUBJECT = "mailto:test@example.com";
    process.env.VAPID_PUBLIC_KEY = "public";
    process.env.VAPID_PRIVATE_KEY = "private";
    rpc.mockResolvedValueOnce({ data: delivery, error: null }).mockResolvedValue({ data: null, error: null });
    sendNotification.mockResolvedValue({ statusCode: 201 });
  });

  it("does not send when the canonical recipe result is invalid", async () => {
    single.mockResolvedValueOnce({ data: { state: "completed", completed_version: 1, user_id: "old-user", result: { schemaVersion: "recipe-v1", title: "x" } }, error: null }).mockResolvedValueOnce({ data: { user_id: "old-user", revoked_at: null }, error: null });
    expect(await dispatchPushBatch()).toBe(1);
    expect(sendNotification).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("finish_push_delivery", expect.objectContaining({ p_error_code: "CANONICAL_STATE_CHANGED" }));
  });

  it("sends a minimal payload after validating the committed result", async () => {
    single.mockResolvedValueOnce({ data: { state: "completed", completed_version: 1, user_id: "old-user", result: { schemaVersion: "recipe-v1", title: "Sopa", ingredients: [{ name: "Agua" }], steps: ["Hervir"], source: { type: "manual" }, provenance: { sourceType: "manual" } } }, error: null }).mockResolvedValueOnce({ data: { user_id: "old-user", revoked_at: null }, error: null });
    expect(await dispatchPushBatch()).toBe(1);
    expect(sendNotification).toHaveBeenCalledOnce();
    const payload = JSON.parse(sendNotification.mock.calls[0][1]);
    expect(payload).toEqual({ version: "push-v1", type: "recipe-job-completed", eventId: expect.any(String), path: `/app/recipes/import?job=${delivery.job_id}` });
  });

  it("does not deliver an old user's event after endpoint ownership changes", async () => {
    single.mockResolvedValueOnce({ data: { state: "completed", completed_version: 1, user_id: "old-user", result: { schemaVersion: "recipe-v1", title: "Sopa", ingredients: [{ name: "Agua" }], steps: ["Hervir"], source: { type: "manual" }, provenance: { sourceType: "manual" } } }, error: null }).mockResolvedValueOnce({ data: { user_id: "new-user", revoked_at: null }, error: null });
    expect(await dispatchPushBatch()).toBe(1);
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
