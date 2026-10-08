'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { defaultChoices } from '../../../../../packages/domain/src/cooking/plan';
import { latestDraft, saveDraft, purgeCookingUser, watchCookingPrivacy, type CookingDraft, type CookingIntent } from './v3-storage';
import type { CookingPlan, CookingResult, CookingSource } from './v3-contracts';
type Status = 'loading' | 'ready' | 'offline' | 'error' | 'expired';
export function useCookingSession(userId: string, source: CookingSource) {
  const [db] = useState(createBrowserSupabaseClient); const [draft, setDraft] = useState<CookingDraft | null>(null);
  const [status, setStatus] = useState<Status>('loading'); const [message, setMessage] = useState(''); const [storageWarning, setStorageWarning] = useState(false); const [online, setOnline] = useState(true); const [busy, setBusy] = useState(false);
  const current = useRef<CookingDraft | null>(null); const guard = useRef({ epoch: 0, expired: false, controllers: new Set<AbortController>() }); const sending = useRef(false);
  const expire = useCallback(() => { guard.current.epoch++; guard.current.expired = true; guard.current.controllers.forEach(c => c.abort()); current.current = null; setDraft(null); setStatus('expired'); setMessage('La sesión ha caducado. Inicia sesión.'); void purgeCookingUser(userId).catch(() => {}); }, [userId]);
  const request = useCallback(async (path: string, body?: unknown) => {
    const epoch = guard.current.epoch; const controller = new AbortController(); guard.current.controllers.add(controller);
    try {
      if (guard.current.expired) throw new DOMException('Aborted', 'AbortError');
      const { data: { user } } = await db.auth.getUser(); if (!user || user.id !== userId) { expire(); throw new DOMException('Aborted', 'AbortError'); }
      if (epoch !== guard.current.epoch || controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const r = await fetch(path, { method: body ? 'POST' : 'GET', ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}), cache: 'no-store', signal: controller.signal }); const data = await r.json();
      const { data: { user: after } } = await db.auth.getUser(); if (!after || after.id !== userId || r.status === 401) { expire(); throw new DOMException('Aborted', 'AbortError'); }
      if (epoch !== guard.current.epoch || controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      return { response: r, data };
    } finally { guard.current.controllers.delete(controller); }
  }, [db, expire, userId]);
  const put = useCallback(async (value: CookingDraft) => {
    if (guard.current.expired) return; current.current = value; setDraft(value);
    try { await saveDraft(value); } catch { if (!guard.current.expired) setStorageWarning(true); }
  }, []);
  const update = useCallback(async (patch: Partial<CookingDraft>) => { if (current.current && !guard.current.expired) await put({ ...current.current, ...patch, updatedAt: new Date().toISOString() }); }, [put]);
  const refresh = useCallback(async (reset = false) => {
    if (guard.current.expired) return;
    if (!navigator.onLine) { setStatus('offline'); return; }
    setStatus('loading'); setMessage('');
    try {
      const { response, data } = await request(`/api/cooking/v3/plan?kind=${source.kind}&id=${source.id}`);
      if (!response.ok) { setStatus('error'); setMessage(data.error?.message ?? 'No pudimos cargar la receta.'); return; }
      const plan = data as CookingPlan; const old = current.current; const same = old?.plan.recipeVersion === plan.recipeVersion;
      await put({ key: `${userId}:${source.kind}:${source.id}:${plan.recipeVersion}`, userId, source, updatedAt: new Date().toISOString(), plan,
        steps: same ? old!.steps : [], choices: reset || !same ? defaultChoices(plan) : old!.choices, acknowledgeReview: reset || !same ? false : old!.acknowledgeReview,
        intent: null, state: 'draft', result: null, undoId: null });
      setStatus('ready');
    } catch (error) { if ((error as Error).name !== 'AbortError') { setStatus(navigator.onLine ? 'error' : 'offline'); setMessage('No pudimos actualizar. Vuelve a intentarlo.'); } }
  }, [put, request, source, userId]);
  const send = useCallback(async (intent: CookingIntent) => {
    if (sending.current || guard.current.expired || !navigator.onLine) return;
    sending.current = true; setBusy(true); setMessage('');
    try {
      const { response, data } = await request('/api/cooking/v3/confirm', intent);
      if (!response.ok) { if (response.status === 409 || response.status === 400 || response.status === 404 || response.status === 422) await update({ state: 'needs_review', acknowledgeReview: false }); setMessage(data.error?.message ?? 'No pudimos actualizar.'); return; }
      await update({ state: 'applied', intent: null, result: data as CookingResult }); setStatus('ready');
    } catch (error) { if ((error as Error).name !== 'AbortError') setMessage('El intento sigue pendiente. Reintenta con conexión.'); }
    finally { sending.current = false; setBusy(false); }
  }, [request, update]);
  const confirm = useCallback(async () => {
    const d = current.current; if (!d || d.state === 'needs_review' || d.state === 'applied' || sending.current || guard.current.expired) return;
    const intent = d.intent ?? { planKey: d.plan.planKey, clientMutationId: crypto.randomUUID(), acknowledgeReview: d.acknowledgeReview, choices: d.choices };
    await update({ intent, state: 'pending' }); await send(intent);
  }, [send, update]);
  const undo = useCallback(async () => {
    const d = current.current; if (!d?.result || !navigator.onLine || sending.current || guard.current.expired) return;
    const mutationId = d.undoId ?? crypto.randomUUID(); await update({ undoId: mutationId }); sending.current = true; setBusy(true); setMessage('');
    try { const { response, data } = await request('/api/cooking/v3/undo', { eventId: d.result.eventId, clientMutationId: mutationId }); if (!response.ok) { setMessage(data.error?.message ?? 'No pudimos deshacer.'); return; } await update({ result: data }); }
    catch (error) { if ((error as Error).name !== 'AbortError') setMessage('No pudimos deshacer. Reintenta con conexión.'); }
    finally { sending.current = false; setBusy(false); }
  }, [request, update]);
  useEffect(() => {
    const state = guard.current; state.expired = false; let active = true;
    watchCookingPrivacy(db, userId);
    const timer = setTimeout(() => { void (async () => {
      setOnline(navigator.onLine);
      const user = navigator.onLine ? (await db.auth.getUser()).data.user : (await db.auth.getSession()).data.session?.user; if (!active) return; if (!user || user.id !== userId) { expire(); return; }
      let cached: CookingDraft | null = null; try { cached = await latestDraft(userId, source); } catch { setStorageWarning(true); }
      if (!active || state.expired) return;
      if (cached) { current.current = cached; setDraft(cached); setStatus(navigator.onLine ? 'ready' : 'offline'); if (cached.state === 'pending' && cached.intent) await send(cached.intent); else if (cached.state === 'draft' && navigator.onLine) await refresh(); }
      else await refresh();
    })(); }, 0);
    const on = () => { setOnline(true); setStatus('ready'); const d = current.current; if (d?.state === 'pending' && d.intent) void send(d.intent); else if (!d) void refresh(); };
    const off = () => { setOnline(false); setStatus('offline'); };
    const { data: listener } = db.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT' || (session?.user && session.user.id !== userId)) expire(); });
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { active = false; clearTimeout(timer); state.epoch++; state.controllers.forEach(c => c.abort()); listener.subscription.unsubscribe(); window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [db, expire, refresh, send, source, userId]);
  return { draft: draft?.userId === userId && status !== 'expired' ? draft : null, status, online, busy, message, storageWarning, update, confirm, refresh: () => refresh(true), undo };
}
