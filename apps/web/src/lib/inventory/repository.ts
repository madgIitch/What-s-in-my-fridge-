import { isCivilDate, utcNow } from "./dates";
import { findMutationForItem, getItem, listOutbox, persistCreate, persistItemAndMutation, putItems, removeMutation, updateMutation } from "./db";
import type { InventoryDraft, LocalInventoryItem, OutboxMutation, ServerInventoryItem } from "./types";

function payload(item: LocalInventoryItem): Record<string, unknown> {
  return {
    name: item.name, normalized_name: item.normalizedName, expiry_date: item.expiryDate,
    category: item.category, quantity: item.quantity, notes: item.notes, unit: item.unit,
    added_at: item.addedAt,
  };
}

function validate(draft: Pick<LocalInventoryItem, "name" | "unit" | "quantity" | "expiryDate"> | InventoryDraft): void {
  if (!draft.name.trim() || !draft.unit.trim() || draft.quantity < 0 || !isCivilDate(draft.expiryDate)) {
    throw new Error("VALIDATION_ERROR");
  }
}

export async function createLocalItem(userId: string, draft: InventoryDraft): Promise<LocalInventoryItem> {
  validate(draft);
  const id = crypto.randomUUID();
  const mutationId = crypto.randomUUID();
  const now = utcNow();
  const item: LocalInventoryItem = {
    key: `${userId}:${id}`, id, userId, name: draft.name.trim(),
    normalizedName: draft.name.trim().toLocaleLowerCase("es"), expiryDate: draft.expiryDate,
    category: draft.category?.trim() || null, quantity: draft.quantity,
    notes: draft.notes?.trim() || null, unit: draft.unit.trim(), addedAt: now,
    createdAt: now, updatedAt: now, deletedAt: null, version: 0,
    syncState: "pending", remoteSnapshot: null,
  };
  const mutation: OutboxMutation = {
    clientMutationId: mutationId, userId, operation: "create", itemId: id,
    payload: payload(item), expectedVersion: null, state: "pending", attempts: 0,
    createdAt: now, updatedAt: now, lastError: null,
  };
  await persistCreate(item, mutation);
  return item;
}

export async function updateLocalItem(userId: string, itemId: string, patch: Partial<InventoryDraft>): Promise<LocalInventoryItem> {
  const current = await getItem(userId, itemId);
  if (!current || current.deletedAt) throw new Error("ITEM_NOT_FOUND");
  const next = { ...current, ...patch, updatedAt: utcNow(), syncState: "pending" as const, remoteSnapshot: null };
  validate(next);
  const queued = await listOutbox(userId);
  const prior = queued.findLast((entry) => entry.itemId === itemId && entry.state === "pending");
  if (prior?.operation === "create" || prior?.operation === "update") {
    await persistItemAndMutation(next, { ...prior, payload: payload(next), updatedAt: next.updatedAt });
  } else {
    await persistItemAndMutation(next, {
      clientMutationId: crypto.randomUUID(), userId, operation: "update", itemId,
      payload: payload(next), expectedVersion: current.version, state: "pending", attempts: 0,
      createdAt: next.updatedAt, updatedAt: next.updatedAt, lastError: null,
    });
  }
  return next;
}

export async function deleteLocalItem(userId: string, itemId: string): Promise<void> {
  const current = await getItem(userId, itemId);
  if (!current || current.deletedAt) return;
  const now = utcNow();
  const queued = await listOutbox(userId);
  const prior = queued.findLast((entry) => entry.itemId === itemId && entry.state === "pending");
  if (prior?.operation === "create" && prior.attempts === 0) {
    // Keep the local tombstone for rollback compatibility, but cancel a create never sent.
    await putItems([{ ...current, deletedAt: now, updatedAt: now, syncState: "synced" }]);
    await removeMutation(prior.clientMutationId);
    return;
  }
  await persistItemAndMutation({ ...current, deletedAt: now, updatedAt: now, syncState: "pending" }, {
    clientMutationId: crypto.randomUUID(), userId, operation: "delete", itemId,
    payload: {}, expectedVersion: current.version, state: "pending", attempts: 0,
    createdAt: now, updatedAt: now, lastError: null,
  });
}


export async function discardConflict(userId: string, itemId: string): Promise<void> {
  const item = await getItem(userId, itemId);
  const mutation = await findMutationForItem(userId, itemId);
  if (!item?.remoteSnapshot || !mutation) return;
  await putItems([fromServer(item.remoteSnapshot)]);
  await removeMutation(mutation.clientMutationId);
}

export async function retryWithRemoteVersion(userId: string, itemId: string): Promise<void> {
  const item = await getItem(userId, itemId);
  const mutation = await findMutationForItem(userId, itemId);
  if (!item || !mutation) return;
  const expectedVersion = item.remoteSnapshot?.version ?? mutation.expectedVersion;
  const now = utcNow();
  await removeMutation(mutation.clientMutationId);
  await persistItemAndMutation({ ...item, syncState: "pending", remoteSnapshot: null }, {
    ...mutation, clientMutationId: crypto.randomUUID(), expectedVersion,
    state: "pending", attempts: 0, lastError: null, createdAt: now, updatedAt: now,
  });
}

export async function retryFailedMutation(userId: string, itemId: string): Promise<void> {
  const item = await getItem(userId, itemId);
  const mutation = await findMutationForItem(userId, itemId);
  if (!item || !mutation || mutation.state !== "error") return;
  await updateMutation({ ...mutation, state: "pending", attempts: 0, lastError: null, updatedAt: utcNow() });
  await putItems([{ ...item, syncState: "pending" }]);
}

export function fromServer(row: ServerInventoryItem, syncState: LocalInventoryItem["syncState"] = "synced"): LocalInventoryItem {
  return {
    key: `${row.user_id}:${row.id}`, id: row.id, userId: row.user_id, name: row.name,
    normalizedName: row.normalized_name, expiryDate: row.expiry_date, category: row.category,
    quantity: Number(row.quantity), notes: row.notes, unit: row.unit, addedAt: row.added_at,
    createdAt: row.created_at, updatedAt: row.updated_at, deletedAt: row.deleted_at,
    version: Number(row.version), syncState, remoteSnapshot: null,
  };
}
