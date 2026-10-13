'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useRef, useState } from 'react';
import { sectionOf, shopCounts, shopReason, type ShopItem } from '../../../../../packages/domain/src/shopping-list/shop';
import { useShop } from '@/lib/shop/use-shop';
import type { PendingReconcile } from '@/lib/shop/contracts';
import styles from './shop.module.css';

const OFFLINE_COPY = 'Sin conexión, tu lista sigue funcionando.';
const amount = (item: ShopItem) => item.quantity === null ? '' : `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`;
const recipeHref = (ref: Record<string, unknown>) => typeof ref.id === 'string'
  ? (ref.kind === 'import' ? `/app/recipes/import/${ref.id}` : ref.kind === 'catalog' ? `/app/recipes/${ref.id}` : null) : null;

function Row({ item, onCheck, onRemove, children }: { item: ShopItem; onCheck: () => void; onRemove: () => void; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const recipes = item.sources.filter(s => s.source === 'recipe_missing');
  const planned = item.sources.some(s => s.source === 'plan_missing');
  return <li className={styles.item}>
    <div className={styles.row}>
      <input className={styles.check} type="checkbox" checked={item.checked} onChange={onCheck} aria-label={`${item.name}: ${item.checked ? 'ya en el carrito' : 'marcar como cogido'}`} />
      <span className={styles.name} data-done={item.checked}>{item.name}</span>
      {amount(item) && <span className={styles.qty}>{amount(item)}</span>}
      {item.pending && <span className={styles.pending}>Pendiente</span>}
      <button type="button" className={styles.link} aria-expanded={open} onClick={() => setOpen(v => !v)}>{open ? 'Cerrar' : '¿Por qué?'}</button>
    </div>
    {open && <div className={styles.more}>
      <span>{shopReason(item)}</span>
      {planned && <Link href="/app/cook/week">Ver tu semana</Link>}
      {recipes.length > 0 && <ul className={styles.sources}>{recipes.map((s, i) => {
        const href = recipeHref(s.ref);
        return <li key={i}>{href && s.label ? <Link href={href}>{s.label}</Link> : s.label ?? 'Receta no disponible'}</li>;
      })}</ul>}
      {children}
      <div className={styles.actions}><button type="button" className={styles.secondary} onClick={onRemove}>Quitar de la lista</button></div>
    </div>}
  </li>;
}

export function ShopApp({ userId }: { userId: string }) {
  const router = useRouter();
  const shop = useShop(userId);
  const [name, setName] = useState(''); const [quantity, setQuantity] = useState(''); const [unit, setUnit] = useState('');
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  const [closedReview, setClosedReview] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const items = shop.items.filter(i => !i.purchasedAt);
  const counts = shopCounts(shop.items);
  const byId = new Map(shop.items.map(i => [i.id, i]));
  const recipes = items.filter(i => sectionOf(i) === 'recipes' && i.selection === 'selected');
  const manual = items.filter(i => sectionOf(i) === 'manual');
  const suggestions = items.filter(i => sectionOf(i) === 'suggestions' && i.selection !== 'dismissed');
  const pendingReconcile: PendingReconcile[] = shop.server?.pendingReconcile ?? [];
  const sessionId = shop.server?.sessionId ?? null;

  const review = shop.lastReconcile && shop.lastReconcile.eventId !== closedReview ? shop.lastReconcile : null;

  async function add(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim(); if (!trimmed) { nameRef.current?.focus(); return; }
    const parsed = quantity.trim() === '' ? null : Number(quantity.replace(',', '.'));
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) { setNotice('La cantidad debe ser un número positivo.'); return; }
    setNotice(''); setName(''); setQuantity(''); setUnit('');
    await shop.submit({ op: 'add_manual', name: trimmed, quantity: parsed, unit: unit.trim() || null });
    nameRef.current?.focus();
  }
  async function finish() {
    setBusy(true); setNotice('');
    try { const id = await shop.startSession(); router.push(`/app/scan?shoppingSession=${id}`); }
    catch (error) { setNotice((error as Error).message || 'No pudimos preparar el ticket.'); setBusy(false); }
  }
  const check = (i: ShopItem) => shop.submit({ op: i.checked ? 'uncheck' : 'check', itemId: i.id });
  const remove = (i: ShopItem) => shop.submit({ op: 'remove', itemId: i.id });
  const reconcile = async (draftId: string, mode: 'apply' | 'skip') => {
    setBusy(true); await shop.reconcile(draftId, mode, sessionId); setBusy(false);
  };

  const status = shop.status === 'loading' && !shop.server ? 'Cargando tu lista…'
    : shop.status === 'expired' ? shop.message
    : !shop.online || shop.status === 'offline' ? OFFLINE_COPY
    : shop.status === 'error' ? shop.message : '';
  const hasContent = recipes.length + manual.length + suggestions.length > 0;

  return <main className={styles.shell}>
    <p className={styles.kicker}>Compra</p>
    <h1>Tu lista</h1>
    <p className={styles.status} role="status" aria-live="polite">{status}{shop.pendingCount > 0 ? ` ${shop.pendingCount} cambio${shop.pendingCount > 1 ? 's' : ''} por sincronizar.` : ''}</p>
    {shop.storageWarning && <p className={styles.notice} role="alert">No podemos guardar tu lista en este dispositivo; los cambios sin conexión podrían perderse.</p>}
    {notice && <p className={styles.notice} role="alert">{notice}</p>}
    {shop.status === 'error' && <button type="button" className={styles.secondary} onClick={() => void shop.reload()}>Reintentar</button>}

    {shop.conflicts.length > 0 && <section className={`${styles.notice} ${styles.warn}`} aria-labelledby="shop-conflict">
      <strong id="shop-conflict">Tu lista cambió en otro dispositivo</strong>
      {shop.conflicts.map(c => <div key={c.clientMutationId}>
        <p>{c.intent.op === 'remove' ? 'Quitar' : c.intent.op === 'select' ? 'Añadir' : 'Cambiar'} «{byId.get(c.intent.itemId ?? '')?.name ?? 'un elemento'}». ¿Lo aplicamos sobre la versión actual?</p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => void shop.resolveConflict(c, 'apply')}>Aplicar</button>
          <button type="button" className={styles.secondary} onClick={() => void shop.resolveConflict(c, 'discard')}>Descartar</button>
        </div>
      </div>)}
    </section>}

    {pendingReconcile.map(p => <section key={p.draftId} className={styles.notice} aria-label="Ticket nuevo">
      <strong>{p.afterSession ? 'Ya tienes tu ticket' : 'Hemos visto un ticket nuevo'}</strong>
      <p>{p.itemCount} producto{p.itemCount === 1 ? '' : 's'}{p.merchant ? ` de ${p.merchant}` : ''}. ¿Marcamos en tu lista lo que ya has comprado? Solo cerraremos lo que coincida con seguridad; tu despensa no cambia.</p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} disabled={busy || !shop.online} onClick={() => void reconcile(p.draftId, 'apply')}>Revisar compra</button>
        <button type="button" className={styles.secondary} disabled={busy || !shop.online} onClick={() => void reconcile(p.draftId, 'skip')}>Ahora no</button>
      </div>
    </section>)}

    {review && <section className={styles.notice} aria-labelledby="shop-review">
      <strong id="shop-review">Compra revisada</strong>
      <p>{review.matched.length} cerrado{review.matched.length === 1 ? '' : 's'}{review.partial.length ? `, ${review.partial.length} con una parte pendiente` : ''}{review.ambiguous.length ? `, ${review.ambiguous.length} por confirmar` : ''}.</p>
      {review.ambiguous.map(a => { const it = byId.get(a.itemId); if (!it || it.purchasedAt) return null; return <div key={a.itemId} className={styles.row}>
        <span className={styles.name}>{it.name}</span>
        <button type="button" className={styles.secondary} onClick={() => void shop.submit({ op: 'mark_purchased', itemId: it.id })}>Ya lo compré</button>
      </div>; })}
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={async () => { await shop.undoReconcile(review.eventId); }}>Deshacer</button>
        <button type="button" className={styles.link} onClick={() => setClosedReview(review.eventId)}>Cerrar</button>
      </div>
    </section>}

    <form className={styles.add} onSubmit={add} aria-label="Añadir a la lista">
      <input ref={nameRef} value={name} onChange={e => setName(e.target.value)} placeholder="Añadir algo" aria-label="Qué quieres comprar" maxLength={120} autoComplete="off" />
      <input value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Cant." aria-label="Cantidad (opcional)" inputMode="decimal" />
      <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="Ud." aria-label="Unidad (opcional)" maxLength={20} />
      <button type="submit" className={styles.primary}>Añadir</button>
    </form>

    {!hasContent && shop.status !== 'loading' && <p className={styles.empty}>Tu lista está vacía. Añade lo que falta desde una receta en Cocinar, o escribe algo aquí arriba.</p>}

    {recipes.length > 0 && <section aria-labelledby="shop-recipes">
      <h2 id="shop-recipes">Para tus recetas</h2><p className={styles.hint}>Lo que te falta para cocinar.</p>
      <ul className={styles.list}>{recipes.map(i => <Row key={i.id} item={i} onCheck={() => void check(i)} onRemove={() => void remove(i)} />)}</ul>
    </section>}

    {suggestions.length > 0 && <section aria-labelledby="shop-suggestions">
      <h2 id="shop-suggestions">Sugerencias por poco stock</h2>
      <p className={styles.hint}>Solo son ideas: no cuentan en tu lista hasta que las añades.</p>
      {suggestions.filter(i => i.selection === 'suggested').map(i => <div key={i.id} className={styles.suggested}>
        <div className={styles.row}><span className={styles.name}>{i.name}</span>{i.pending && <span className={styles.pending}>Pendiente</span>}</div>
        <p className={styles.hint}>{shopReason(i)}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => void shop.submit({ op: 'select', itemId: i.id })}>Añadir a mi compra</button>
          <button type="button" className={styles.secondary} onClick={() => void shop.submit({ op: 'dismiss', itemId: i.id })}>No hace falta</button>
        </div>
      </div>)}
      {suggestions.some(i => i.selection === 'selected') && <ul className={styles.list}>{suggestions.filter(i => i.selection === 'selected').map(i =>
        <Row key={i.id} item={i} onCheck={() => void check(i)} onRemove={() => void remove(i)} />)}</ul>}
    </section>}

    {manual.length > 0 && <section aria-labelledby="shop-manual">
      <h2 id="shop-manual">Añadido por ti</h2>
      <ul className={styles.list}>{manual.map(i => <Row key={i.id} item={i} onCheck={() => void check(i)} onRemove={() => void remove(i)} />)}</ul>
    </section>}

    <div className={styles.footer}>
      <button type="button" className={styles.primary} disabled={busy || !shop.online || counts.selected === 0} onClick={() => void finish()}>He terminado, añadir ticket</button>
      {!shop.online && <p className={styles.hint}>{OFFLINE_COPY} El ticket necesita conexión.</p>}
    </div>

    {shop.undoRemove && <div className={styles.toast} role="status">
      <span>Quitado de la lista.</span>
      <button type="button" onClick={async () => { const id = shop.undoRemove!; shop.setUndoRemove(null); await shop.submit({ op: 'restore', itemId: id }); }}>Deshacer</button>
    </div>}
  </main>;
}
