'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PLAN_LIMITS, addCivilDays, buildWeek, canPlanOn, civilToday, classifyEntry, mondayOf, weekInRange, type PlanEntry } from '../../../../../packages/domain/src/planning/week';
import type { MealEntry } from '@/lib/meal-calendar/types';
import { listMutations } from '@/lib/meal-calendar/db';
import { loadPlanRows, refreshPlanRows, removeEntry, setOutside } from '@/lib/planning/schedule';
import type { PlanMissing } from '@/lib/planning/contracts';
import { formatRange, formatWeekday } from './format';
import styles from './planning.module.css';

type Status = 'loading' | 'ready' | 'offline' | 'error' | 'expired';
const titleOf = (e: MealEntry) => e.recipe_snapshot?.title ?? e.custom_name ?? 'Comida';
const refHref = (e: MealEntry) => {
  const ref = e.recipe_snapshot?.recipe_id;
  if (ref?.startsWith('import:')) return `/app/recipes/import/${ref.slice(7)}`;
  return e.recipe_id ? `/app/recipes/${e.recipe_id}` : null;
};

export function WeekApp({ userId }: { userId: string }) {
  const router = useRouter();
  const [today] = useState(() => civilToday());
  const [from, setFrom] = useState(() => mondayOf(civilToday()));
  const [rows, setRows] = useState<MealEntry[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [missing, setMissing] = useState<PlanMissing | null>(null);
  const [pending, setPending] = useState(0);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [undo, setUndo] = useState<MealEntry | null>(null);
  const [online, setOnline] = useState(true);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(async () => {
    const onExpired = () => { setStatus('expired'); router.push('/login?error=session_expired&returnTo=%2Fapp%2Fcook%2Fweek'); };
    try {
      let loaded: MealEntry[];
      try { loaded = await refreshPlanRows(userId, onExpired); } catch (error) {
        if ((error as { status?: number }).status === 401) { onExpired(); return; }
        loaded = await loadPlanRows(userId); setStatus(navigator.onLine ? 'error' : 'offline');
      }
      setRows(loaded); setPending((await listMutations(userId)).filter(m => m.state !== 'rejected').length);
      if (!navigator.onLine) { setStatus('offline'); setMissing(null); return; }
      const response = await fetch(`/api/plan/v1/week?from=${from}&today=${today}`, { cache: 'no-store' });
      if (response.status === 401) { onExpired(); return; }
      if (response.ok) { const data = await response.json(); setMissing(data.missing as PlanMissing); setStatus('ready'); setAdded(false); }
      else { setMissing(null); setStatus('error'); }
    } catch { setStatus(navigator.onLine ? 'error' : 'offline'); }
  }, [from, router, today, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { setOnline(navigator.onLine); void load(); }, 0);
    const up = () => { setOnline(true); void load(); }; const down = () => { setOnline(false); setStatus('offline'); };
    window.addEventListener('online', up); window.addEventListener('offline', down);
    return () => { window.clearTimeout(timer); window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, [load]);

  const days = useMemo(() => buildWeek(rows as unknown as PlanEntry[], from, today), [rows, from, today]);
  const canBack = weekInRange(addCivilDays(from, -7), today); const canNext = weekInRange(addCivilDays(from, 7), today);
  const go = (delta: number) => { setUndo(null); setMessage(''); setAdded(false); setFrom(f => addCivilDays(f, delta)); headingRef.current?.focus(); };

  async function remove(entry: MealEntry) {
    setBusy(true);
    try { await removeEntry(userId, entry); setUndo(entry); setMessage('Quitada de tu plan.'); await load(); }
    catch { setMessage('No pudimos quitarla. Inténtalo de nuevo.'); } finally { setBusy(false); }
  }
  async function restore() {
    if (!undo) return; setBusy(true);
    try {
      const { queueMutation } = await import('@/lib/meal-calendar/db'); const { syncMealOutbox } = await import('@/lib/meal-calendar/sync');
      const { id: _id, user_id: _u, version: _v, created_at: _c, updated_at: _up, deleted_at: _d, plan_kind: _p, ...payload } = undo; void [_id, _u, _v, _c, _up, _d, _p];
      await queueMutation({ clientMutationId: crypto.randomUUID(), userId, operation: 'create', mealEntryId: crypto.randomUUID(), expectedVersion: null, payload, state: 'pending', createdAt: new Date().toISOString() });
      if (navigator.onLine) await syncMealOutbox(userId);
      setUndo(null); setMessage('Recuperada en tu plan.'); await load();
    } catch { setMessage('No pudimos recuperarla.'); } finally { setBusy(false); }
  }
  async function outside(date: string) {
    setBusy(true);
    try { await setOutside(userId, date, rows); setMessage('Marcado como cenar fuera.'); await load(); }
    catch { setMessage('No pudimos guardarlo. Inténtalo de nuevo.'); } finally { setBusy(false); }
  }
  async function addToShop() {
    if (!missing || busy) return; setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/plan/v1/shop', { method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ from, today, clientMutationId: crypto.randomUUID(), confirmedKey: missing.key }) });
      const data = await response.json().catch(() => ({}));
      if (response.ok) { setAdded(true); setMessage(`Añadido a la compra: ${data.count} ingrediente${data.count === 1 ? '' : 's'}.`); }
      else if (data?.error?.code === 'PLAN_CHANGED') { setMessage(data.error.message); await load(); }
      else setMessage(data?.error?.message ?? 'No pudimos añadirlo a la compra.');
    } catch { setMessage('No pudimos añadirlo. Reintenta con conexión.'); } finally { setBusy(false); }
  }

  const statusText = status === 'loading' ? 'Cargando tu semana…' : status === 'offline' || !online ? 'Sin conexión: ves tu último plan guardado.'
    : status === 'expired' ? 'La sesión ha caducado.' : status === 'error' ? 'No pudimos actualizar. Tu plan guardado sigue disponible.' : '';
  const plannedCount = rows.filter(r => classifyEntry(r as unknown as PlanEntry) === 'recipe').length;

  return <main className={styles.shell}>
    <p className={styles.kicker}><Link href="/app/cook">Cocinar</Link></p>
    <h1 ref={headingRef} tabIndex={-1}>Tu semana</h1>
    <div className={styles.range}>
      <button type="button" className={styles.secondary} disabled={!canBack} onClick={() => go(-7)} aria-label="Semana anterior">←</button>
      <strong>{formatRange(from)}</strong>
      <button type="button" className={styles.secondary} disabled={!canNext} onClick={() => go(7)} aria-label="Semana siguiente">→</button>
    </div>
    <p className={styles.status} role="status" aria-live="polite">{statusText}{pending > 0 ? ` ${pending} cambio${pending > 1 ? 's' : ''} pendiente${pending > 1 ? 's' : ''} de sincronizar.` : ''}</p>
    {status === 'error' && <button type="button" className={styles.secondary} onClick={() => void load()}>Reintentar</button>}
    {plannedCount === 0 && status !== 'loading' && days.every(d => d.undecided) && <p className={styles.notice}>Aún no has planificado nada. Abre una receta y elige ¿Cuándo la cocinas?, o marca un día como Cenar fuera.</p>}

    {days.map(day => {
      const planned = day.entries.filter(e => classifyEntry(e as unknown as PlanEntry) !== 'legacy');
      const legacy = day.entries.filter(e => classifyEntry(e as unknown as PlanEntry) === 'legacy');
      const label = formatWeekday(day.date);
      return <section key={day.date} className={styles.day} data-today={day.date === today} data-past={day.readOnly} aria-labelledby={`day-${day.date}`}>
        <h2 id={`day-${day.date}`}>{label}{day.date === today && <small>Hoy</small>}</h2>
        <ul className={styles.entries}>
          {planned.map(e => { const kind = classifyEntry(e as unknown as PlanEntry); const href = refHref(e as MealEntry); const entry = e as unknown as MealEntry;
            return <li key={entry.id} className={styles.entry}>
              <span>{kind === 'outside' ? 'Cenar fuera' : href ? <Link href={href}>{titleOf(entry)}</Link> : titleOf(entry)}{entry.version === 0 && <> <span className={styles.pending}>Pendiente</span></>}</span>
              {!day.readOnly && <button type="button" className={styles.link} disabled={busy} onClick={() => void remove(entry)} aria-label={`Quitar ${kind === 'outside' ? 'Cenar fuera' : titleOf(entry)} del ${label}`}>Quitar</button>}
            </li>; })}
          {legacy.map(e => { const entry = e as unknown as MealEntry; return <li key={entry.id} className={styles.entry}>
            <span><span className={styles.chip}>Registrado antes</span> <Link href={`/app/calendar/${entry.id}`}>{titleOf(entry)}</Link></span>
          </li>; })}
        </ul>
        {day.undecided && <p className={styles.undecided}>Sin decidir</p>}
        {!day.readOnly && canPlanOn(day.date, today) && <div className={styles.actions}>
          {day.undecided && <Link className={styles.secondary} href="/app/cook">Elegir receta</Link>}
          {!day.outside && <button type="button" className={styles.secondary} disabled={busy} onClick={() => void outside(day.date)}>Cenar fuera</button>}
        </div>}
      </section>;
    })}

    <section className={styles.missing} aria-labelledby="plan-missing">
      <h2 id="plan-missing">Lo que te falta</h2>
      {!online || status === 'offline' ? <p className={styles.undecided}>Necesitas conexión para calcular lo que falta.</p>
        : !missing ? <p className={styles.undecided}>{status === 'loading' ? 'Calculando…' : 'No pudimos calcularlo ahora.'}</p>
        : <>
          {missing.count === 0 && <p className={styles.undecided}>{plannedCount ? 'Con lo que tienes, tu plan de esta semana está cubierto.' : 'Planifica una receta y te diremos qué te falta.'}</p>}
          {missing.count > 0 && <ul>{missing.lines.map(l => <li key={`${l.conceptId}:${l.unit ?? ''}`}>{l.name}{l.quantity !== null ? ` · ${l.quantity}${l.unit ? ` ${l.unit}` : ''}` : ''}
            <small> · {[...new Set(l.entries.map(x => x.title))].join(', ')}</small></li>)}</ul>}
          {missing.unresolved.length > 0 && <p className={styles.notice}>{missing.unresolved.length} ingrediente{missing.unresolved.length === 1 ? '' : 's'} por comprobar: no los añadimos solos.</p>}
          {missing.unavailable.length > 0 && <p className={styles.notice}>{missing.unavailable.length} receta{missing.unavailable.length === 1 ? '' : 's'} ya no están disponibles y no cuentan en el cálculo.</p>}
          {missing.count > 0 && !added && <button type="button" className={styles.primary} disabled={busy} onClick={() => void addToShop()}>Añadir {missing.count} a la compra</button>}
          {added && <Link className={styles.primary} href="/app/shop">Ver compra</Link>}
        </>}
    </section>
    <p role="status" aria-live="polite" className={styles.status}>{message}</p>
    {undo && <div className={styles.toast} role="status"><span>Quitada de tu plan.</span><button type="button" onClick={() => void restore()} disabled={busy}>Deshacer</button></div>}
    <p className={styles.undecided}>Hasta {PLAN_LIMITS.perDay} recetas por día.</p>
  </main>;
}
