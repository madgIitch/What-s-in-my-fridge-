import type { CookingPlan, CookingChoice, CookingResult, CookingSource } from './v3-contracts';
import type { SupabaseClient } from '@supabase/supabase-js';
export type CookingIntent = { planKey: string; clientMutationId: string; acknowledgeReview: boolean; choices: CookingChoice[] };
export type CookingDraft = { key: string; userId: string; source: CookingSource; updatedAt: string; plan: CookingPlan; steps: number[]; choices: CookingChoice[]; acknowledgeReview: boolean; intent: CookingIntent | null; state: 'draft' | 'pending' | 'needs_review' | 'applied'; result: CookingResult | null; undoId: string | null };
// Reserved private DB already included in the app's sign-out/account-change
// cleanup. No other feature creates this database; inventory/outboxes stay intact.
const DB = 'neverita-pwa-v1';
const privacyWatchers = new WeakMap<object, { userId: string }>();
// Retained for the browser client's lifetime: sign-out on Settings must also
// purge drafts after the cooking view has unmounted.
export function watchCookingPrivacy(db: SupabaseClient, userId: string) {
  const existing = privacyWatchers.get(db);
  if (existing) { if (existing.userId !== userId) void purgeCookingUser(existing.userId).catch(() => {}); existing.userId = userId; return; }
  const owner = { userId }; privacyWatchers.set(db, owner);
  db.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT' || (session?.user && session.user.id !== owner.userId)) void purgeCookingUser(owner.userId).catch(() => {}); });
}
function open(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => { const s = r.result.createObjectStore('drafts', { keyPath: 'key' }); s.createIndex('user', 'userId'); }; r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
export async function latestDraft(userId: string, source: CookingSource): Promise<CookingDraft | null> {
  const db = await open(); try { return await new Promise((resolve, reject) => { const r = db.transaction('drafts').objectStore('drafts').index('user').getAll(userId); r.onsuccess = () => resolve((r.result as CookingDraft[]).filter(d => d.source.kind === source.kind && d.source.id === source.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null); r.onerror = () => reject(r.error); }); } finally { db.close(); }
}
export async function saveDraft(draft: CookingDraft) { const db = await open(); try { await new Promise<void>((resolve, reject) => { const tx = db.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put(draft); tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(tx.error); }); } finally { db.close(); } }
export async function purgeCookingUser(userId: string) { const db = await open(); try { await new Promise<void>((resolve, reject) => { const tx = db.transaction('drafts', 'readwrite'); const store = tx.objectStore('drafts'); const r = store.index('user').openCursor(IDBKeyRange.only(userId)); r.onsuccess = () => { const cursor = r.result; if (cursor) { cursor.delete(); cursor.continue(); } }; tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(tx.error); }); } finally { db.close(); } }
