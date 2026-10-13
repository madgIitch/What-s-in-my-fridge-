'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { applyIntentLocally, type ShopIntent, type ShopItem } from '../../../../../packages/domain/src/shopping-list/shop';
import type { ShopList, ShopReconcileResult } from './contracts';
import { deleteIntent, listIntents, loadCache, putIntent, saveCache, watchShopPrivacy, type StoredIntent } from './storage';

export type ShopStatus = 'loading' | 'ready' | 'offline' | 'error' | 'expired';
type NewIntent = Omit<ShopIntent, 'clientMutationId'>;

export function useShop(userId: string) {
  const [db] = useState(createBrowserSupabaseClient);
  const [server, setServer] = useState<ShopList | null>(null);
  const [intents, setIntents] = useState<StoredIntent[]>([]);
  const [status, setStatus] = useState<ShopStatus>('loading');
  const [message, setMessage] = useState('');
  const [online, setOnline] = useState(true);
  const [storageWarning, setStorageWarning] = useState(false);
  const [lastReconcile, setLastReconcile] = useState<ShopReconcileResult | null>(null);
  const [undoRemove, setUndoRemove] = useState<string | null>(null);
  const flushing = useRef(false); const rerun = useRef(false); const expired = useRef(false);

  const expire = useCallback(() => { expired.current = true; setServer(null); setIntents([]); setStatus('expired'); setMessage('La sesión ha caducado. Inicia sesión para ver tu lista.'); }, []);
  const call = useCallback(async (path: string, body?: unknown) => {
    const { data: { user } } = await db.auth.getUser();
    if (!user || user.id !== userId) { expire(); throw new DOMException('Aborted', 'AbortError'); }
    const response = await fetch(path, { method: body ? 'POST' : 'GET', cache: 'no-store', ...(body ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}) });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) { expire(); throw new DOMException('Aborted', 'AbortError'); }
    return { response, data };
  }, [db, expire, userId]);

  const refreshIntents = useCallback(async () => { try { setIntents(await listIntents(userId)); } catch { setStorageWarning(true); } }, [userId]);

  const fetchList = useCallback(async () => {
    const { response, data } = await call('/api/shop/v1/list');
    if (!response.ok) { setStatus('error'); setMessage(data.error?.message ?? 'No pudimos cargar la lista.'); return; }
    setServer(data as ShopList); setStatus('ready'); setMessage('');
    try { await saveCache(userId, data as ShopList); } catch { setStorageWarning(true); }
  }, [call, userId]);

  const flush = useCallback(async function run(): Promise<void> {
    if (expired.current || !navigator.onLine) { if (!navigator.onLine) { setOnline(false); setStatus('offline'); } return; }
    // A flush already running re-checks the queue when it ends, so no intent is left behind.
    if (flushing.current) { rerun.current = true; return; }
    flushing.current = true;
    try {
      for (const record of await listIntents(userId)) {
        if (record.status !== 'pending') continue;
        let result;
        try { result = await call('/api/shop/v1/mutations', record.intent); } catch (error) { if ((error as Error).name === 'AbortError') return; break; }
        const code = result.data?.error?.code as string | undefined;
        if (result.response.ok) await deleteIntent(record.clientMutationId);
        else if (code === 'VERSION_CONFLICT') await putIntent({ ...record, status: 'conflict' });
        else if (code === 'ITEM_NOT_FOUND' || code === 'INVALID_REQUEST' || code === 'MUTATION_CONFLICT' || code === 'UNDO_EXPIRED') await deleteIntent(record.clientMutationId);
        else break;
      }
    } catch { setStorageWarning(true); } finally { flushing.current = false; }
    await refreshIntents();
    if (rerun.current) { rerun.current = false; await run(); }
  }, [call, refreshIntents, userId]);

  const load = useCallback(async () => {
    if (expired.current) return;
    watchShopPrivacy(db, userId);
    try { const cache = await loadCache(userId); if (cache) setServer(prev => prev ?? cache.list); } catch { setStorageWarning(true); }
    await refreshIntents();
    if (!navigator.onLine) { setStatus('offline'); return; }
    try { await flush(); await fetchList(); await refreshIntents(); }
    catch (error) { if ((error as Error).name !== 'AbortError') { setStatus(navigator.onLine ? 'error' : 'offline'); setMessage('No pudimos actualizar. Tu lista guardada sigue disponible.'); } }
  }, [db, fetchList, flush, refreshIntents, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { setOnline(navigator.onLine); void load(); }, 0);
    const up = () => { setOnline(true); void load(); }; const down = () => { setOnline(false); setStatus('offline'); };
    window.addEventListener('online', up); window.addEventListener('offline', down);
    return () => { window.clearTimeout(timer); window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, [load]);

  const submit = useCallback(async (intent: NewIntent) => {
    const full: ShopIntent = { ...intent, clientMutationId: crypto.randomUUID() };
    if (full.op === 'add_manual' && !full.itemId) full.itemId = crypto.randomUUID();
    const base = server?.items.find(i => i.id === full.itemId);
    if (base && full.expectedVersion === undefined && base.version > 0 && full.op !== 'restore') full.expectedVersion = base.version;
    const record: StoredIntent = { clientMutationId: full.clientMutationId, userId, intent: full, status: 'pending', createdAt: new Date().toISOString() };
    setIntents(prev => [...prev, record]);
    if (!navigator.onLine) { setOnline(false); setStatus('offline'); }
    try { await putIntent(record); } catch { setStorageWarning(true); }
    if (full.op === 'remove' && base && base.source !== 'low_stock_suggestion') setUndoRemove(base.id);
    if (navigator.onLine) { await flush(); try { await fetchList(); } catch { /* keeps the optimistic pending view */ } }
    return full;
  }, [fetchList, flush, server, userId]);

  const resolveConflict = useCallback(async (record: StoredIntent, action: 'apply' | 'discard') => {
    await deleteIntent(record.clientMutationId);
    if (action === 'apply') {
      const { expectedVersion: _drop, ...rest } = record.intent; void _drop;
      await submit(rest);
    } else { await refreshIntents(); if (navigator.onLine) await fetchList(); }
  }, [fetchList, refreshIntents, submit]);

  const items = useMemo<ShopItem[]>(() => {
    let current = server?.items ?? [];
    const now = new Date().toISOString();
    for (const record of intents) {
      // A conflicting intent is only flagged: the item keeps showing the server's current state.
      if (record.status === 'conflict') current = current.map(i => i.id === record.intent.itemId ? { ...i, pending: true } : i);
      else current = applyIntentLocally(current, record.intent, now);
    }
    return current;
  }, [intents, server]);

  const startSession = useCallback(async () => {
    const { response, data } = await call('/api/shop/v1/session', { clientMutationId: crypto.randomUUID() });
    if (!response.ok) throw new Error(data.error?.message ?? 'No pudimos preparar el ticket.');
    return data.sessionId as string;
  }, [call]);
  const reconcile = useCallback(async (draftId: string, mode: 'apply' | 'skip', sessionId?: string | null) => {
    const { response, data } = await call('/api/shop/v1/reconcile', { draftId, clientMutationId: crypto.randomUUID(), mode, ...(sessionId ? { sessionId } : {}) });
    if (!response.ok) { setMessage(data.error?.message ?? 'No pudimos revisar el ticket.'); return null; }
    setLastReconcile(mode === 'apply' ? data as ShopReconcileResult : null); await fetchList(); return data as ShopReconcileResult;
  }, [call, fetchList]);
  const undoReconcile = useCallback(async (eventId: string) => {
    const { response, data } = await call('/api/shop/v1/undo', { eventId, clientMutationId: crypto.randomUUID() });
    if (!response.ok) { setMessage(data.error?.message ?? 'No pudimos deshacer.'); return false; }
    setLastReconcile(null); await fetchList(); return true;
  }, [call, fetchList]);

  return { items, server, status, message, online, storageWarning, intents, lastReconcile, undoRemove, setUndoRemove,
    pendingCount: intents.filter(i => i.status === 'pending').length, conflicts: intents.filter(i => i.status === 'conflict'),
    submit, resolveConflict, startSession, reconcile, undoReconcile, reload: load, clearMessage: () => setMessage('') };
}
