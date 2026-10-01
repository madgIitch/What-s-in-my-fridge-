import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LocalInventoryItem, OutboxMutation, ServerInventoryItem } from "./types";

const memory = vi.hoisted(() => ({ items: new Map<string, LocalInventoryItem>(), queue: new Map<string, OutboxMutation>() }));
vi.mock("./db", () => ({
  getItem: vi.fn(async (user: string, id: string) => memory.items.get(`${user}:${id}`)),
  listOutbox: vi.fn(async (user: string) => [...memory.queue.values()].filter(row => row.userId === user)),
  persistItemAndMutation: vi.fn(async (item: LocalInventoryItem, mutation: OutboxMutation) => { memory.items.set(item.key, item); memory.queue.set(mutation.clientMutationId, mutation); }),
  updateMutation: vi.fn(async (mutation: OutboxMutation) => { memory.queue.set(mutation.clientMutationId, mutation); }),
  putItems: vi.fn(async (items: LocalInventoryItem[]) => { items.forEach(item => memory.items.set(item.key, item)); }),
  applyCanonical: vi.fn(async (_user: string, id: string, item: LocalInventoryItem) => { memory.queue.delete(id); memory.items.set(item.key, item); }),
  getMeta: vi.fn(async () => undefined), setMeta: vi.fn(async () => {}), claimLease: vi.fn(async () => true),
  findMutationForItem: vi.fn(async () => undefined), removeMutation: vi.fn(async (id: string) => { memory.queue.delete(id); }), persistCreate: vi.fn(),
}));
import { fromServer, updateLocalItem, updatePantryItem } from "./repository";
import { syncInventory } from "./sync";

const original: ServerInventoryItem = {
  id: "00000000-0000-4000-8000-000000000001", user_id: "user-a", name: "Tomate", normalized_name: "tomate",
  expiry_date: "2026-10-10", category: null, quantity: 1, notes: null, unit: "unit", added_at: "2026-10-01T12:00:00Z",
  created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-01T12:00:00Z", deleted_at: null, version: 1,
};

function backend() {
  let row = { ...original };
  const rpc = vi.fn(async (_name: string, args: Record<string, unknown>) => {
    if (args.p_expected_version !== row.version) return { data: { status: "conflict", code: "SYNC_CONFLICT", item: row }, error: null };
    row = { ...row, ...(args.p_payload as Partial<ServerInventoryItem>), version: row.version + 1 };
    return { data: { status: "applied", code: "OK", item: row }, error: null };
  });
  const query = { select: () => query, order: () => query, or: () => query, eq: () => query, range: () => query, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [row], error: null }).then(resolve) };
  const client = { rpc, from: () => query, auth: { getUser: async () => ({ data: { user: { id: "user-a" } }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } } as unknown as SupabaseClient;
  return { client, rpc, current: () => row };
}

beforeEach(() => {
  memory.items.clear(); memory.queue.clear(); memory.items.set(`user-a:${original.id}`, fromServer(original));
  vi.stubGlobal("navigator", { onLine: true, locks: { request: async (_key: string, _options: unknown, callback: (lock: object) => Promise<void>) => callback({}) } });
});

describe("R1 preserves v2 and causal offline edits", () => {
  it("sends a legacy edit through the unchanged v2 inventory RPC", async () => {
    await updateLocalItem("user-a", original.id, { notes: "legacy note" });
    const server = backend(); await syncInventory("user-a", server.client);
    expect(server.rpc.mock.calls[0][0]).toBe("apply_inventory_mutation");
  });

  it("reconciles two unsent pantry edits without conflicting with its own first write", async () => {
    await updatePantryItem("user-a", original.id, { stockMode: "qualitative", stockState: "low", notes: "first edit" });
    await updatePantryItem("user-a", original.id, { stockMode: "qualitative", stockState: "empty", notes: "second edit" });
    const server = backend(); await syncInventory("user-a", server.client);
    expect(server.current().notes).toBe("second edit");
    expect(memory.queue.size).toBe(0);
    expect(memory.items.get(`user-a:${original.id}`)?.syncState).toBe("synced");
  });

  it("does not send an outbox when the authenticated account changed", async () => {
    await updatePantryItem("user-a", original.id, { stockMode: "qualitative", stockState: "low" });
    const server = backend();
    server.client.auth.getUser = vi.fn(async () => ({ data: { user: { id: "user-b" } }, error: null })) as never;
    await syncInventory("user-a", server.client);
    expect(server.rpc).not.toHaveBeenCalled();
    expect(memory.queue.size).toBe(1);
  });

  it("preserves a previously attempted payload and advances its successor's version", async () => {
    await updatePantryItem("user-a", original.id, { stockMode: "qualitative", stockState: "low", notes: "first attempt" });
    const first = [...memory.queue.values()][0];
    memory.queue.set(first.clientMutationId, { ...first, attempts: 1 });
    await updatePantryItem("user-a", original.id, { stockMode: "qualitative", stockState: "empty", notes: "later edit" });
    expect(memory.queue.size).toBe(2);
    expect(memory.queue.get(first.clientMutationId)?.payload.notes).toBe("first attempt");
    const server = backend(); await syncInventory("user-a", server.client);
    expect(server.rpc.mock.calls.map(call => call[1].p_expected_version)).toEqual([1, 2]);
    expect(server.current().notes).toBe("later edit");
    expect(memory.queue.size).toBe(0);
  });

  it("does not apply an awaited response after logout or account change", async () => {
    await updatePantryItem("user-a", original.id, { stockMode: "qualitative", stockState: "low" });
    const server = backend(); let checks = 0;
    server.client.auth.getUser = vi.fn(async () => ({ data: { user: { id: ++checks >= 3 ? "user-b" : "user-a" } }, error: null })) as never;
    await syncInventory("user-a", server.client);
    expect(server.rpc).toHaveBeenCalledTimes(1);
    expect(memory.queue.size).toBe(1);
    expect(memory.items.get(`user-a:${original.id}`)?.syncState).toBe("pending");
  });

  it("ignores pull rows owned by another user even if a client returns them", async () => {
    const server = backend();
    const foreign = { ...original, id: "00000000-0000-4000-8000-000000000099", user_id: "user-b" };
    const query = { select: () => query, eq: () => query, order: () => query, or: () => query, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [foreign], error: null }).then(resolve) };
    server.client.from = vi.fn(() => query) as never;
    await syncInventory("user-a", server.client);
    expect(memory.items.has(`user-b:${foreign.id}`)).toBe(false);
  });
});
