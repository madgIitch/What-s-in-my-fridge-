import type { LocalInventoryItem, OutboxMutation } from "./types";

const DB_NAME = "neverita-inventory-v1";
const DB_VERSION = 1;
const ITEMS = "items";
const OUTBOX = "outbox";
const META = "meta";

interface MetaRecord { key: string; value: unknown }

function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error ?? new Error("IndexedDB request failed"));
  });
}

function completion(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export async function openInventoryDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB no está disponible");
  const opening = indexedDB.open(DB_NAME, DB_VERSION);
  opening.onupgradeneeded = () => {
    const db = opening.result;
    const items = db.createObjectStore(ITEMS, { keyPath: "key" });
    items.createIndex("by_user", "userId", { unique: false });
    const outbox = db.createObjectStore(OUTBOX, { keyPath: "clientMutationId" });
    outbox.createIndex("by_user_created", ["userId", "createdAt"], { unique: false });
    outbox.createIndex("by_user_item", ["userId", "itemId", "createdAt"], { unique: false });
    db.createObjectStore(META, { keyPath: "key" });
  };
  return request(opening);
}

export async function persistCreate(item: LocalInventoryItem, mutation: OutboxMutation): Promise<void> {
  const db = await openInventoryDb();
  const tx = db.transaction([ITEMS, OUTBOX], "readwrite");
  tx.objectStore(ITEMS).add(item);
  tx.objectStore(OUTBOX).add(mutation);
  await completion(tx);
  db.close();
}

export async function persistItemAndMutation(item: LocalInventoryItem, mutation: OutboxMutation): Promise<void> {
  const db = await openInventoryDb();
  const tx = db.transaction([ITEMS, OUTBOX], "readwrite");
  tx.objectStore(ITEMS).put(item);
  tx.objectStore(OUTBOX).put(mutation);
  await completion(tx);
  db.close();
}

export async function listItems(userId: string, includeDeleted = false): Promise<LocalInventoryItem[]> {
  const db = await openInventoryDb();
  const tx = db.transaction(ITEMS, "readonly");
  const rows = await request(tx.objectStore(ITEMS).index("by_user").getAll(userId)) as LocalInventoryItem[];
  await completion(tx); db.close();
  return rows.filter((item) => includeDeleted || !item.deletedAt)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate) || a.name.localeCompare(b.name));
}

export async function getItem(userId: string, itemId: string): Promise<LocalInventoryItem | undefined> {
  const db = await openInventoryDb();
  const value = await request(db.transaction(ITEMS, "readonly").objectStore(ITEMS).get(`${userId}:${itemId}`)) as LocalInventoryItem | undefined;
  db.close(); return value;
}

export async function listOutbox(userId: string): Promise<OutboxMutation[]> {
  const db = await openInventoryDb();
  const tx = db.transaction(OUTBOX, "readonly");
  const range = IDBKeyRange.bound([userId, ""], [userId, "\uffff"]);
  const rows = await request(tx.objectStore(OUTBOX).index("by_user_created").getAll(range)) as OutboxMutation[];
  await completion(tx); db.close(); return rows;
}

export async function updateMutation(mutation: OutboxMutation): Promise<void> {
  const db = await openInventoryDb(); const tx = db.transaction(OUTBOX, "readwrite");
  tx.objectStore(OUTBOX).put(mutation); await completion(tx); db.close();
}

export async function applyCanonical(userId: string, mutationId: string, item: LocalInventoryItem): Promise<void> {
  const db = await openInventoryDb(); const tx = db.transaction([ITEMS, OUTBOX], "readwrite");
  tx.objectStore(ITEMS).put(item); tx.objectStore(OUTBOX).delete(mutationId);
  await completion(tx); db.close();
}

export async function removeMutation(mutationId: string): Promise<void> {
  const db = await openInventoryDb(); const tx = db.transaction(OUTBOX, "readwrite");
  tx.objectStore(OUTBOX).delete(mutationId); await completion(tx); db.close();
}

export async function findMutationForItem(userId: string, itemId: string): Promise<OutboxMutation | undefined> {
  return (await listOutbox(userId)).find((entry) => entry.itemId === itemId && (entry.state === "conflict" || entry.state === "error"));
}

export async function putItems(items: LocalInventoryItem[]): Promise<void> {
  if (!items.length) return;
  const db = await openInventoryDb(); const tx = db.transaction(ITEMS, "readwrite");
  for (const item of items) tx.objectStore(ITEMS).put(item);
  await completion(tx); db.close();
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await openInventoryDb();
  const row = await request(db.transaction(META, "readonly").objectStore(META).get(key)) as MetaRecord | undefined;
  db.close(); return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await openInventoryDb(); const tx = db.transaction(META, "readwrite");
  tx.objectStore(META).put({ key, value } satisfies MetaRecord); await completion(tx); db.close();
}

export async function claimLease(userId: string, owner: string, ttlMs = 15_000): Promise<boolean> {
  const db = await openInventoryDb(); const tx = db.transaction(META, "readwrite");
  const store = tx.objectStore(META); const key = `lease:${userId}`;
  const current = await request(store.get(key)) as MetaRecord | undefined;
  const now = Date.now();
  const lease = current?.value as { owner: string; expiresAt: number } | undefined;
  if (lease && lease.owner !== owner && lease.expiresAt > now) { tx.abort(); db.close(); return false; }
  store.put({ key, value: { owner, expiresAt: now + ttlMs } } satisfies MetaRecord);
  await completion(tx); db.close(); return true;
}
