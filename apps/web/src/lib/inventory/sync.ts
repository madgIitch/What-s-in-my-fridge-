import type { SupabaseClient } from "@supabase/supabase-js";
import { applyCanonical, claimLease, getItem, getMeta, listOutbox, putItems, setMeta, updateMutation } from "./db";
import { fromServer } from "./repository";
import type { LocalInventoryItem, MutationResult, OutboxMutation, ServerInventoryItem } from "./types";

const MAX_ATTEMPTS = 5;
const LOCK_PREFIX = "neverita-inventory-sync:";
export const inventoryEvents = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("neverita-inventory");

export function retryDelay(attempt: number, random = Math.random): number {
  const base = Math.min(30_000, 1_000 * 2 ** Math.max(0, attempt - 1));
  return Math.min(30_000, Math.round(base * (0.8 + random() * 0.4)));
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callMutation(supabase: SupabaseClient, mutation: OutboxMutation): Promise<MutationResult> {
  const { data, error } = await supabase.rpc("apply_inventory_mutation", {
    p_client_mutation_id: mutation.clientMutationId,
    p_operation: mutation.operation,
    p_item_id: mutation.itemId,
    p_expected_version: mutation.expectedVersion,
    p_payload: mutation.payload,
  });
  if (error) throw error;
  return data as unknown as MutationResult;
}

async function processQueue(userId: string, supabase: SupabaseClient): Promise<void> {
  const mutations = await listOutbox(userId);
  const blockedItems = new Set<string>();
  for (const mutation of mutations) {
    if (blockedItems.has(mutation.itemId) || mutation.state === "conflict") continue;
    if (mutation.state === "error" && mutation.attempts >= MAX_ATTEMPTS) continue;
    let current: OutboxMutation = { ...mutation, state: "processing" };
    await updateMutation(current);
    try {
      const result = await callMutation(supabase, current);
      const local = await getItem(userId, current.itemId);
      if ((result.status === "applied" || result.status === "duplicate") && result.code === "OK" && result.item) {
        await applyCanonical(userId, current.clientMutationId, fromServer(result.item));
      } else if (result.code === "SYNC_CONFLICT" && local && result.item) {
        current = { ...current, state: "conflict", lastError: result.code, updatedAt: new Date().toISOString() };
        await updateMutation(current);
        await putItems([{ ...local, syncState: "conflict", remoteSnapshot: result.item }]);
        blockedItems.add(current.itemId);
      } else {
        current = { ...current, state: "error", lastError: result.code, updatedAt: new Date().toISOString() };
        await updateMutation(current);
        if (local) await putItems([{ ...local, syncState: "error" }]);
        if (result.code === "AUTH_REQUIRED") break;
        blockedItems.add(current.itemId);
      }
    } catch {
      const attempts = current.attempts + 1;
      current = { ...current, state: attempts >= MAX_ATTEMPTS ? "error" : "pending", attempts, lastError: "NETWORK_ERROR", updatedAt: new Date().toISOString() };
      await updateMutation(current);
      if (attempts >= MAX_ATTEMPTS) {
        const local = await getItem(userId, current.itemId);
        if (local) await putItems([{ ...local, syncState: "error" }]);
      } else {
        await wait(retryDelay(attempts));
      }
      blockedItems.add(current.itemId);
    }
  }
}

async function pull(userId: string, supabase: SupabaseClient): Promise<void> {
  const cursor = await getMeta<{ updatedAt: string; id: string }>(`cursor:${userId}`);
  let query = supabase.from("inventory_items").select("*").order("updated_at").order("id");
  if (cursor) query = query.or(`updated_at.gt.${cursor.updatedAt},and(updated_at.eq.${cursor.updatedAt},id.gt.${cursor.id})`);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as ServerInventoryItem[];
  const merged: LocalInventoryItem[] = [];
  for (const row of rows) {
    const local = await getItem(userId, row.id);
    if (!local || local.syncState === "synced") merged.push(fromServer(row));
  }
  await putItems(merged);
  const last = rows.at(-1);
  if (last) await setMeta(`cursor:${userId}`, { updatedAt: last.updated_at, id: last.id });
}

async function exclusive(userId: string, task: () => Promise<void>): Promise<void> {
  const locks = navigator.locks;
  if (locks) {
    await locks.request(`${LOCK_PREFIX}${userId}`, { ifAvailable: true }, async (lock) => { if (lock) await task(); });
    return;
  }
  const owner = crypto.randomUUID();
  if (await claimLease(userId, owner)) await task();
}

export async function syncInventory(userId: string, supabase: SupabaseClient): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  await exclusive(userId, async () => {
    await processQueue(userId, supabase);
    await pull(userId, supabase);
    inventoryEvents?.postMessage({ type: "changed", userId });
  });
}
