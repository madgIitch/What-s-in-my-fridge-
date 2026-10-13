import type { SupabaseClient } from '@supabase/supabase-js';
import type { ShopIntent, ShopList } from './contracts';

/** Private, user-scoped Compra storage. Its own database: inventory and cooking outboxes are never shared or migrated. */
const DB = 'neverita-shop-v1';
const SCHEMA = 1;
export type StoredIntent = { clientMutationId: string; userId: string; intent: ShopIntent; status: 'pending' | 'conflict' | 'error'; createdAt: string };
export type ShopCache = { userId: string; schema: number; list: ShopList; savedAt: string };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, SCHEMA);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('cache', { keyPath: 'userId' });
      db.createObjectStore('outbox', { keyPath: 'clientMutationId' }).createIndex('user', 'userId');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function run<T>(store: 'cache' | 'outbox', mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode); const request = work(tx.objectStore(store));
      tx.oncomplete = () => resolve(request.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
export async function loadCache(userId: string): Promise<ShopCache | null> {
  const value = await run<ShopCache | undefined>('cache', 'readonly', s => s.get(userId));
  return value && value.userId === userId && value.schema === SCHEMA ? value : null;
}
export async function saveCache(userId: string, list: ShopList) {
  await run('cache', 'readwrite', s => s.put({ userId, schema: SCHEMA, list, savedAt: new Date().toISOString() } satisfies ShopCache));
}
export async function listIntents(userId: string): Promise<StoredIntent[]> {
  const all = await run<StoredIntent[]>('outbox', 'readonly', s => s.index('user').getAll(userId));
  return all.filter(i => i.userId === userId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export async function putIntent(record: StoredIntent) { await run('outbox', 'readwrite', s => s.put(record)); }
export async function deleteIntent(id: string) { await run('outbox', 'readwrite', s => s.delete(id)); }

export async function purgeShopUser(userId: string) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['cache', 'outbox'], 'readwrite');
      tx.objectStore('cache').delete(userId);
      const index = tx.objectStore('outbox').index('user').openKeyCursor(IDBKeyRange.only(userId));
      index.onsuccess = () => { const cursor = index.result; if (cursor) { tx.objectStore('outbox').delete(cursor.primaryKey); cursor.continue(); } };
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

/** Whole-database wipe for sign-out and account switch, which signal through `neverita:stop-workers`. */
export function purgeAllShopData() {
  if (typeof indexedDB === 'undefined') return;
  try { indexedDB.deleteDatabase(DB); } catch { /* storage unavailable: nothing was persisted */ }
}

const watchers = new WeakMap<object, { userId: string }>();
/** Sign-out or an account switch purges the outgoing account's list and queued intents, even after unmount. */
export function watchShopPrivacy(db: SupabaseClient, userId: string) {
  const existing = watchers.get(db);
  if (existing) { if (existing.userId !== userId) void purgeShopUser(existing.userId).catch(() => {}); existing.userId = userId; return; }
  const owner = { userId }; watchers.set(db, owner);
  db.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || (session?.user && session.user.id !== owner.userId)) void purgeShopUser(owner.userId).catch(() => {});
  });
}
