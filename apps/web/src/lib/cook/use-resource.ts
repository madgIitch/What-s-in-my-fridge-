'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

export function useCookResource<T>(url: string, userId: string) {
  const [db] = useState(createBrowserSupabaseClient); const [stored, setStored] = useState<{ key: string; value: T } | null>(null);
  const data = stored?.key === `${userId}:${url}` ? stored.value : null;
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'offline' | 'expired'>('loading');
  const [message, setMessage] = useState(''); const [online, setOnline] = useState(true);
  const guard = useRef({ epoch: 0, controllers: new Set<AbortController>(), expired: false });
  const reads = useRef(0);
  const clear = useCallback(() => { guard.current.epoch++; guard.current.expired = true; for (const c of guard.current.controllers) c.abort(); setStored(null); setStatus('expired'); setMessage('La sesión ha caducado. Inicia sesión.'); }, []);
  const request = useCallback(async (target: string, init?: RequestInit) => {
    const epoch = guard.current.epoch; const controller = new AbortController(); guard.current.controllers.add(controller);
    try {
      if (guard.current.expired) throw new Error('AUTH_REQUIRED');
      const { data: { user } } = await db.auth.getUser();
      if (!user || user.id !== userId) { clear(); throw new Error('AUTH_REQUIRED'); }
      if (epoch !== guard.current.epoch || controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const response = await fetch(target, { ...init, cache: 'no-store', signal: controller.signal });
      const body = await response.json();
      const { data: { user: current } } = await db.auth.getUser();
      if (!current || current.id !== userId || response.status === 401) { clear(); throw new Error('AUTH_REQUIRED'); }
      if (epoch !== guard.current.epoch || controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      return { response, body };
    } finally { guard.current.controllers.delete(controller); }
  }, [clear, db, userId]);
  const load = useCallback(async () => {
    if (guard.current.expired) return;
    const generation = ++reads.current;
    if (!navigator.onLine) { setOnline(false); setStatus('offline'); return; }
    setStatus('loading'); setMessage('');
    try { const { response, body } = await request(url); if (generation !== reads.current) return; if (!response.ok) { setStatus('error'); setMessage(body.error?.message ?? 'No pudimos actualizar.'); return; } setStored({ key: `${userId}:${url}`, value: body }); setStatus(navigator.onLine ? 'ready' : 'offline'); }
    catch (error) { if ((error as Error).name === 'AbortError' || guard.current.expired || generation !== reads.current) return; setStatus(navigator.onLine ? 'error' : 'offline'); setMessage('No pudimos actualizar. Vuelve a intentarlo.'); }
  }, [request, url, userId]);
  useEffect(() => {
    const state = guard.current; state.expired = false;
    const timer = setTimeout(() => { setOnline(navigator.onLine); void load(); }, 0);
    const on = () => { setOnline(true); void load(); }; const off = () => { setOnline(false); setStatus('offline'); };
    const { data: listener } = db.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT' || (session?.user && session.user.id !== userId)) clear(); });
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { clearTimeout(timer); state.epoch++; for (const c of state.controllers) c.abort(); listener.subscription.unsubscribe(); window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [clear, db, load, userId]);
  return { data: status === 'expired' ? null : data, status, online, message, load, request };
}
