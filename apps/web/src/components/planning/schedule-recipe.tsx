'use client';
import Link from 'next/link';
import { useState } from 'react';
import { parseRecipeQuantity } from '../../../../../packages/domain/src/recommendations/today';
import { SCHEDULE_MESSAGES, addCivilDays, civilToday, resolveWhen, type WhenKind } from '../../../../../packages/domain/src/planning/week';
import { removeEntry, scheduleRecipe, type PlannableRecipe } from '@/lib/planning/schedule';
import { formatDay } from './format';
import styles from './planning.module.css';

export type ScheduleSource = { kind: 'catalog' | 'import'; id: string; title: string; ingredients: { name: string; measure?: string | null }[] };

export function ScheduleRecipe({ userId, source }: { userId: string; source: ScheduleSource }) {
  const [busy, setBusy] = useState(false);
  const [other, setOther] = useState(false);
  const [date, setDate] = useState('');
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState<{ entryId: string; date: string } | null>(null);
  const today = civilToday();

  const recipe: PlannableRecipe = {
    kind: source.kind, id: source.id, title: source.title,
    ingredients: source.ingredients.map(i => { const q = parseRecipeQuantity(i.measure ?? null); return { name: i.name, quantity: q?.quantity ?? null, unit: q?.unit ?? null }; }),
  };
  async function save(target: string) {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const result = await scheduleRecipe(userId, recipe, target, today);
      if (!result.ok) { setSaved(null); setMessage(SCHEDULE_MESSAGES[result.reason as keyof typeof SCHEDULE_MESSAGES] ?? 'No pudimos planificarla.'); return; }
      setSaved({ entryId: result.entryId, date: result.date }); setOther(false);
      setMessage(navigator.onLine ? `Planeada para ${formatDay(result.date, today)}.` : `Planeada para ${formatDay(result.date, today)}. Se confirmará al volver la conexión.`);
    } catch { setMessage('No pudimos guardar el plan. Tu receta no ha cambiado.'); } finally { setBusy(false); }
  }
  async function undo() {
    if (!saved || busy) return;
    setBusy(true);
    try { await removeEntry(userId, { id: saved.entryId, version: 1 }); setSaved(null); setMessage('Quitada de tu plan.'); }
    catch { setMessage('No pudimos deshacerlo. Quítala desde tu semana.'); } finally { setBusy(false); }
  }
  const when = (kind: WhenKind) => void save(resolveWhen(kind, today));

  return <section className={styles.when} aria-labelledby="when-title">
    <h2 id="when-title">¿Cuándo la cocinas?</h2>
    <div className={styles.actions}>
      <button type="button" className={styles.secondary} disabled={busy} onClick={() => when('today')}>Hoy</button>
      <button type="button" className={styles.secondary} disabled={busy} onClick={() => when('tomorrow')}>Mañana</button>
      <button type="button" className={styles.secondary} disabled={busy} aria-expanded={other} onClick={() => { setOther(v => !v); setDate(d => d || addCivilDays(today, 2)); }}>Otro día</button>
    </div>
    {other && <div className={styles.actions}>
      <label>Día<br /><input type="date" value={date} min={today} max={addCivilDays(today, 84)} onChange={e => setDate(e.target.value)} /></label>
      <button type="button" className={styles.primary} disabled={busy || !date} onClick={() => void save(date)}>Guardar</button>
    </div>}
    <p role="status" aria-live="polite">{message}</p>
    {saved && <div className={styles.actions}>
      <button type="button" className={styles.link} disabled={busy} onClick={() => void undo()}>Deshacer</button>
      <Link className={styles.link} href="/app/cook/week">Ver tu semana</Link>
    </div>}
  </section>;
}
