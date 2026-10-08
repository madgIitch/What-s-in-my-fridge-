'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useCookingSession } from '@/lib/cooking/use-cooking-session';
import { choicePreview, stateLabel, type CookingChoice, type CookingLineV3, type CookingSource } from '../../../../../packages/domain/src/cooking/plan';
import styles from './session.module.css';

function humanUnit(value: string) { return value.replace(/\bunit\b/g, 'unidades').replace(/\bpack\b/g, 'paquetes'); }
function ChoiceEditor({ line, value, change, disabled }: { line: CookingLineV3; value: CookingChoice; change: (choice: CookingChoice) => void; disabled: boolean }) {
  const selected = value.inventoryItemId ?? (line.allocations.length === 1 ? line.allocations[0]?.inventoryItemId : '');
  const setAction = (action: string) => {
    if (action === 'apply' || action === 'keep') change({ lineId: line.lineId, action });
    else if (action === 'set_state') change({ lineId: line.lineId, action, inventoryItemId: selected, state: 'low' });
    else change({ lineId: line.lineId, action: 'set_consumption', ...(line.mode === 'exact' ? {} : { inventoryItemId: selected }), quantity: 0, unit: line.requiredUnit ?? line.allocations.find(l => l.inventoryItemId === selected)?.unit ?? 'unit' });
  };
  return <div className={styles.controls}><label>Acción para {line.name}<select disabled={disabled} value={value.action} onChange={e => setAction(e.target.value)}>{line.allowedActions.map(a => <option key={a} value={a}>{({ keep: 'No cambiar', apply: 'Usar propuesta', set_state: 'Indicar lo que queda', set_consumption: 'Ajustar consumo' })[a]}</option>)}</select></label>
    {(value.action === 'set_state' || (value.action === 'set_consumption' && line.mode !== 'exact')) && <label>Lote de {line.name}<select disabled={disabled} value={selected} onChange={e => { const lot = line.allocations.find(l => l.inventoryItemId === e.target.value); change({ ...value, inventoryItemId: e.target.value, ...(value.action === 'set_consumption' ? { quantity: 0, unit: lot?.unit ?? 'unit' } : {}) }); }}><option value=''>Elige un lote</option>{line.allocations.filter(l => value.action === 'set_state' || l.quantity !== null).map(l => <option key={l.inventoryItemId} value={l.inventoryItemId}>{l.name} · {l.quantity === null ? stateLabel(l.state) : humanUnit(`${l.quantity} ${l.unit}`)} · {l.inventoryItemId.slice(-4)}</option>)}</select></label>}
    {value.action === 'set_state' && <label>Después de cocinar {line.name}<select disabled={disabled} value={value.state} onChange={e => change({ ...value, state: e.target.value as 'plenty' | 'low' | 'empty' })}><option value='plenty'>Queda bastante</option><option value='low'>Queda poco</option><option value='empty'>Se acabó</option></select></label>}
    {value.action === 'set_consumption' && <label>Cantidad consumida de {line.name} ({humanUnit(value.unit ?? "")})<input disabled={disabled} type='number' inputMode='decimal' min='0' step='any' value={Number.isFinite(value.quantity) ? value.quantity : ''} onChange={e => change({ ...value, quantity: e.target.value === '' ? NaN : Number(e.target.value) })} /></label>}
  </div>;
}
export function CookingSession({ userId, source }: { userId: string; source: CookingSource }) {
  const resource = useCookingSession(userId, source); const { draft, status, online, busy, message, storageWarning } = resource;
  const pathname = usePathname(); const confirmView = pathname.endsWith('/confirm'); const [adjusting, setAdjusting] = useState(false); const heading = useRef<HTMLHeadingElement>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (confirmView) heading.current?.focus(); }, [confirmView]);
  const go = (confirm: boolean) => { window.history.pushState(null, '', `/app/cook/session${confirm ? '/confirm' : ''}?kind=${source.kind}&id=${source.id}`); };
  const locked = busy || status === 'loading' || draft?.state === 'pending' || draft?.state === 'needs_review' || draft?.state === 'applied';
  const invalid = draft?.choices.some(c => (c.action === 'set_state' || (c.action === 'set_consumption' && draft.plan.lines.find(l => l.lineId === c.lineId)?.mode !== 'exact')) && !c.inventoryItemId || c.action === 'set_consumption' && (!Number.isFinite(c.quantity) || c.quantity! < 0));
  return <main className={styles.shell}>
    <Link className={styles.link} href='/app/cook'>← Cocinar</Link>
    {status === 'expired' ? <><h1>Sesión caducada</h1><p role='alert'>{message}</p><Link className={styles.secondary} href='/login'>Iniciar sesión</Link></> : !draft ? <><h1>Cocinando</h1><p role='status'>{status === 'loading' ? 'Preparando tu receta…' : status === 'offline' ? 'Necesitas conexión para cargar esta receta por primera vez.' : message || 'No pudimos cargar la receta.'}</p>{online && <button className={styles.secondary} onClick={() => void resource.refresh()}>Reintentar</button>}</> : <>
      {!online && <p className={styles.notice} role='status'>Sin conexión. Puedes seguir los pasos; actualizar la despensa quedará pendiente.</p>}
      {storageWarning && <p className={styles.notice}>El progreso no se guardará en este dispositivo. Mantén esta página abierta.</p>}
      {draft.state === 'applied' && draft.result ? <>
        <h1 tabIndex={-1} ref={heading}>{draft.result.undone ? 'Cambios deshechos' : 'Despensa actualizada'}</h1>
        <p className={styles.success} role='status'>{draft.result.undone ? 'Se han restaurado los estados anteriores.' : draft.result.changes.length ? 'Hemos guardado lo que has usado.' : 'Cocinado registrado. La despensa sigue igual.'}</p>
        <ul className={styles.list}>{draft.result.changes.map(c => <li key={c.inventoryItemId}><div className={styles.row}><strong>{c.name}</strong><span className={styles.change}>{c.before.stock_mode === 'exact' ? humanUnit(`${c.before.quantity_exact} ${c.before.quantity_unit}`) : stateLabel(c.before.stock_state as string)} → {c.after.stock_mode === 'exact' ? humanUnit(`${c.after.quantity_exact} ${c.after.quantity_unit}`) : stateLabel(c.after.stock_state as string)}</span></div></li>)}</ul>
        <div className={styles.actions}>{!draft.result.undone && <button disabled={!online || busy || now >= Date.parse(draft.result.undoUntil)} className={styles.secondary} onClick={() => void resource.undo()}>{now >= Date.parse(draft.result.undoUntil) ? 'Plazo para deshacer terminado' : 'Deshacer actualización'}</button>}<Link className={styles.primary} href='/app/pantry'>Ver mi despensa</Link></div>
      </> : <>
        <p className={styles.eyebrow}>{confirmView ? 'CONFIRMAR CONSUMO' : 'COCINANDO'}</p>
        <h1 ref={heading} tabIndex={-1}>{confirmView ? '¿Lo has cocinado?' : draft.plan.recipe.title}</h1>
        {draft.plan.recipe.reviewRequired && <p className={styles.notice}>Receta provisional. Revisa los ingredientes y las cantidades con la fuente original.</p>}
        {confirmView ? <>
          <h2>Así quedaría tu despensa</h2>
          <ul className={styles.list}>{draft.plan.lines.map(line => { const value = draft.choices.find(c => c.lineId === line.lineId)!; return <li key={line.lineId}><div className={styles.row}><strong>{line.name}</strong><span className={styles.change}><span className={styles.small}>{humanUnit(line.before)}</span>→ {humanUnit(choicePreview(line, value))}</span></div>{line.insufficient && <small className={styles.small}>No hay suficiente cantidad verificada. Ajusta lo que has usado o deja sin cambios.</small>}{line.mode === 'unresolved' && <small className={styles.small}>Cantidad por comprobar. No se descuenta automáticamente.</small>}{adjusting && <ChoiceEditor line={line} value={value} disabled={!!locked} change={c => void resource.update({ choices: draft.choices.map(old => old.lineId === c.lineId ? c : old) })} />}{!line.allocations.length && <Link className={styles.link} href='/app/pantry'>Revisar despensa</Link>}</li>; })}</ul>
          {draft.plan.recipe.reviewRequired && <label className={styles.ack}><input type='checkbox' disabled={!!locked} checked={draft.acknowledgeReview} onChange={e => void resource.update({ acknowledgeReview: e.target.checked })} />He revisado los ingredientes y las cantidades.</label>}
          {draft.state === 'pending' && <p className={styles.notice} role='status'>Pendiente de conexión o confirmación del servidor. Tu despensa aún no está confirmada.</p>}
          {draft.state === 'needs_review' && <p className={styles.notice} role='alert'>Revisa una comparación nueva antes de confirmar.</p>}
          <div className={styles.actions}>{draft.state === 'needs_review' ? <button className={styles.primary} disabled={!online || busy} onClick={() => { setAdjusting(false); void resource.refresh(); }}>Actualizar comparación</button> : <button className={styles.primary} disabled={busy || status === 'loading' || invalid || (draft.plan.recipe.reviewRequired && !draft.acknowledgeReview)} onClick={() => void resource.confirm()}>{busy ? 'Confirmando…' : draft.state === 'pending' ? 'Reintentar confirmación' : online ? 'Sí, actualizar despensa' : 'Guardar intención pendiente'}</button>}<button className={styles.secondary} disabled={!!locked} onClick={() => setAdjusting(!adjusting)}>{adjusting ? 'Terminar ajustes' : 'Ajustar cantidades'}</button><button className={styles.link} onClick={() => go(false)}>Volver a los pasos</button></div>
        </> : <>
          <h2>Vas a usar</h2><ul className={styles.list}>{draft.plan.lines.map(line => <li key={line.lineId}><div className={styles.row}><strong>{line.name}</strong><span>{line.originalAmount ? humanUnit([line.originalAmount, line.originalUnit].filter(Boolean).join(' ')) : 'Cantidad no indicada'}</span></div><small className={styles.small}>{humanUnit(line.before)}</small></li>)}</ul>
          <h2>Pasos</h2><p className={styles.progress}>{draft.steps.length} de {draft.plan.recipe.steps.length} completados</p><ol className={styles.steps}>{draft.plan.recipe.steps.map((step, index) => <li key={index}><button className={styles.step} aria-pressed={draft.steps.includes(index)} onClick={() => void resource.update({ steps: draft.steps.includes(index) ? draft.steps.filter(n => n !== index) : [...draft.steps, index] })}><span className={styles.number}>{index + 1}</span><span>{step}</span></button></li>)}</ol><div className={styles.actions}><button className={styles.primary} onClick={() => go(true)}>Ya está</button></div>
        </>}
      </>}
      {message && <p className={styles.notice} role='alert'>{message}</p>}
    </>}
  </main>;
}
