'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCookResource } from '@/lib/cook/use-resource';
import type { CookAvailability, RecipeRef } from '@/lib/cook/contracts';
import styles from './cook.module.css';

export function RecipeAvailability({ userId, recipeRef }: { userId: string; recipeRef: RecipeRef }) {
  const resource = useCookResource<CookAvailability>(`/api/cook/availability?kind=${recipeRef.kind}&id=${recipeRef.id}`, userId);
  const [confirming, setConfirming] = useState(false); const [acknowledged, setAcknowledged] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [conflict, setConflict] = useState(false); const [done, setDone] = useState(false);
  const intent = useRef<{ shopping?: { id: string; token: string }; save?: { id: string; token: string } }>({}); const running = useRef(false); const dialog = useRef<HTMLElement>(null); const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => { setConfirming(false); trigger.current?.focus(); }, []);
  useEffect(() => {
    if (!confirming) return; const panel = dialog.current; panel?.querySelector<HTMLElement>('button')?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !running.current) close(); if (e.key !== 'Tab') return; const controls = [...(panel?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href]') ?? [])]; if (!controls.length) return; if (e.shiftKey && document.activeElement === controls[0]) { e.preventDefault(); controls.at(-1)?.focus(); } else if (!e.shiftKey && document.activeElement === controls.at(-1)) { e.preventDefault(); controls[0].focus(); } };
    document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key);
  }, [close, confirming]);
  async function mutate(operation: 'shopping' | 'save') {
    const data = resource.data; if (!data || running.current || !resource.online || resource.status !== 'ready' || (operation === 'shopping' && data.reviewRequired && !acknowledged)) return;
    const token = operation === 'shopping' ? data.snapshotKey : data.recipeVersion;
    const attempt = intent.current[operation] ?? { id: crypto.randomUUID(), token }; intent.current[operation] = attempt;
    running.current = true; setBusy(true); setMessage('');
    try {
      const result = await resource.request(`/api/cook/${operation}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipeRef, [operation === 'shopping' ? 'snapshotKey' : 'recipeVersion']: attempt.token, clientMutationId: attempt.id }) });
      if (!result.response.ok) { setMessage(result.body.error.message); if (result.response.status === 409) { setConflict(true); delete intent.current[operation]; } return; }
      if (operation === 'shopping') setDone(true); setMessage(operation === 'shopping' ? 'Faltantes añadidos a la compra.' : 'Receta guardada en Cocinar.');
      delete intent.current[operation];
    } catch (error) { if ((error as Error).name !== 'AbortError') setMessage('No se ha confirmado. Reintenta con el mismo intento.'); }
    finally { running.current = false; setBusy(false); }
  }
  const data = resource.data;
  if (resource.status === 'expired') return <section className={styles.notice}><p>La sesión ha caducado.</p><Link href='/login'>Iniciar sesión</Link></section>;
  return <section className={`${styles.shell} ${styles.comparison}`} aria-label='Disponibilidad de la receta'>
    <p role='status'>{resource.status === 'loading' ? 'Comparando con tu despensa…' : resource.status === 'offline' ? data ? `Resultado anterior · Sin conexión · ${new Date(data.computedAt).toLocaleString('es')}` : 'Sin conexión; aún no hay una comparación guardada.' : resource.message}</p>
    {resource.status === 'error' && <><button className={styles.secondary} onClick={() => void resource.load()}>Actualizar comparación</button><Link className={styles.link} href='/app/recipes/import?mode=text'>Pegar la receta como texto</Link></>}
    {data && <>
      <strong className={styles.count}>Tienes {data.haveCount} de {data.totalCount}</strong>
      {data.reviewRequired && <p className={styles.notice}>Comparación provisional. Revisa los ingredientes y las cantidades con la receta original.</p>}
      <ul className={styles.ingredients}>{data.ingredients.map(i => <li key={i.position}><span><strong>{i.name}</strong><small>{i.amount_status === 'unknown' ? i.originalAmount ? `Cantidad por comprobar · ${i.originalAmount}` : 'Cantidad no indicada' : `${i.amount_value} ${i.amount_unit}`}</small></span><span className={`${styles.badge} ${i.decision !== 'have_enough' ? styles.uncertain : ''}`}>{i.decision === 'have_enough' ? 'Suficiente' : i.decision === 'have_presence_unknown_amount' ? 'Lo tienes' : i.decision === 'missing' ? 'Te falta' : 'Por comprobar'}</span></li>)}</ul>
      {data.quantityToCheck && <p className={styles.notice}>Tener un ingrediente no confirma que haya suficiente. Comprueba las cantidades.</p>}
      {!!data.unknownCount && <p className={styles.notice}>Hay {data.unknownCount} ingredientes por comprobar. No se añadirán automáticamente a la compra.</p>}
      <div className={styles.actions}><button ref={trigger} className={styles.primary} disabled={busy || !resource.online || resource.status !== 'ready' || !data.missingCount} onClick={() => { setDone(false); setConflict(false); setMessage(''); setAcknowledged(false); setConfirming(true); }}>Añadir {data.missingCount} a la compra</button><button className={styles.secondary} disabled={busy || !resource.online || resource.status !== 'ready'} onClick={() => void mutate('save')}>Guardar en Cocinar</button>{data.sourceUrl && <a className={styles.link} href={data.sourceUrl} target='_blank' rel='noopener noreferrer'>Ver receta original ↗</a>}</div>
      {!confirming && <p role='status' aria-live='polite'>{message}</p>}{conflict && !confirming && <button className={styles.secondary} onClick={() => { setConflict(false); void resource.load(); }}>Actualizar receta</button>}
      {confirming && <div className={styles.backdrop}><section className={styles.dialog} ref={dialog} role='dialog' aria-modal='true' aria-labelledby='cook-confirm-title'>
        <h2 id='cook-confirm-title'>{done ? 'Añadido a la compra' : 'Revisar faltantes'}</h2>
        {!done && <><ul>{[...new Map(data.ingredients.filter(i => i.decision === 'missing').map(i => [i.groupKey, i.name])).values()].map(name => <li key={name}>{name}</li>)}</ul>{data.reviewRequired && <label><input type='checkbox' checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} />He revisado los ingredientes de esta receta provisional.</label>}</>}
        <p role='status'>{message}</p><div><button className={styles.secondary} disabled={busy} onClick={close}>{done ? 'Cerrar' : 'Cancelar'}</button>{done ? <Link className={styles.primary} href='/app/shopping-list'>Ver compra</Link> : conflict ? <button className={styles.primary} onClick={() => { close(); setConflict(false); void resource.load(); }}>Actualizar comparación</button> : <button className={styles.primary} disabled={busy || !resource.online || resource.status !== 'ready' || (data.reviewRequired && !acknowledged)} onClick={() => void mutate('shopping')}>{busy ? 'Añadiendo…' : 'Confirmar y añadir'}</button>}</div>
      </section></div>}
    </>}
  </section>;
}
