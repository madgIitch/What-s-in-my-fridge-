"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { listOutbox } from "@/lib/inventory/db";
import type { TodayRecipe, TodayResponse } from "@/lib/recommendations/contracts";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type LoadState = "loading" | "ready" | "stale" | "error" | "catalog" | "offline" | "pending_sync";
type ShoppingState = { recipe: TodayRecipe; snapshotKey: string; mutationId: string; state: "confirm" | "saving" | "error" | "conflict" | "done" };

function metricId() { return crypto.randomUUID(); }
function emitMetric(detail: Record<string, unknown>) { window.dispatchEvent(new CustomEvent("neverita:today-metric", { detail })); }
function statusLabel(recipe: TodayRecipe) {
  if (recipe.availability === "ready") return "Tienes todo";
  if (recipe.availability === "quantity_to_check") return "Tienes los ingredientes";
  if (recipe.availability === "missing_one") return "Te falta 1";
  if (recipe.availability === "missing_many") return `Te faltan ${recipe.missingCount}`;
  return "Hay ingredientes por comprobar";
}
function reasonLabel(recipe: TodayRecipe) {
  const verified = recipe.reasons.find((reason) => reason.code === "use_soon_verified");
  if (verified?.ingredient) return `Gasta primero ${verified.ingredient}`;
  const estimated = recipe.reasons.find((reason) => reason.code === "use_soon_estimated");
  if (estimated?.ingredient) return `Buena opción para aprovechar ${estimated.ingredient} · conservación estimada`;
  if (recipe.availability === "quantity_to_check") return "Cantidad por comprobar antes de cocinar";
  if (recipe.missingCount > 0) return recipe.missingIngredients.join(" · ");
  if (recipe.unknownCount > 0) return "Por comprobar: " + recipe.unknownIngredients.join(" · ");
  return "Puedes prepararla con lo que sabemos de tu despensa";
}

function DecisionCard({ recipe, snapshotKey, writesDisabled, demo, onShop }: {
  recipe: TodayRecipe; snapshotKey: string; writesDisabled: boolean; demo: boolean;
  onShop(recipe: TodayRecipe, snapshotKey: string): void;
}) {
  return <article className={`today-decision today-${recipe.availability}`}>
    <div className="today-decision-top"><span className="today-status">{statusLabel(recipe)}</span>{recipe.reasons.some((reason) => reason.code === "favorite") && <span className="today-favorite">Favorita</span>}</div>
    <h2>{recipe.name}</h2><p>{reasonLabel(recipe)}</p>
    {recipe.missingCount > 0 && recipe.unknownCount > 0 && <p className="today-uncertainty">Por comprobar: {recipe.unknownCount}</p>}
    {recipe.quantityToCheck && <p className="today-uncertainty">Cantidad por comprobar</p>}
    <div className="today-card-actions">
      {(recipe.availability === "ready" || recipe.availability === "quantity_to_check") && (demo
        ? <button type="button" disabled aria-describedby="today-demo-note">Cocinar esto · solo ejemplo</button>
        : <Link className="today-primary-action" href={`/app/recipes/${recipe.recipeId}`}>Cocinar esto</Link>)}
      {recipe.missingCount > 0 && <button className="today-shopping-action" type="button" disabled={writesDisabled} onClick={() => onShop(recipe, snapshotKey)}>Añadir a la compra</button>}
      {recipe.availability === "unknown" && (demo ? <span>En tus resultados podrás revisar la receta o la despensa.</span> : <><Link href={`/app/recipes/${recipe.recipeId}`}>Revisar receta</Link><Link href="/app/pantry">Revisar despensa</Link></>)}
    </div>
  </article>;
}

function Onboarding({ userId, onClose, onExample }: { userId: string; onClose(): void; onExample(): void }) {
  const choose = (action: () => void) => { try { localStorage.setItem(`neverita:today-onboarding:${userId}`, "seen"); } catch { /* Storage can be unavailable. */ } action(); };
  return <section className="today-onboarding" aria-labelledby="today-onboarding-title">
    <p className="product-v3-kicker">Neverita</p><h1 id="today-onboarding-title">Sabe lo que tienes y te dice qué cenar</h1><p>Empieza con tu última compra. Con un ticket basta.</p>
    <Link className="today-onboarding-primary" href="/app/scan" onClick={() => choose(onClose)}>Escanear un ticket</Link>
    <Link href="/app/add-purchase" onClick={() => choose(onClose)}>Escribir unas pocas cosas</Link>
    <button type="button" onClick={() => choose(onExample)}>Ver un ejemplo primero</button><button className="today-skip" type="button" onClick={() => choose(onClose)}>Saltar por ahora</button>
    <small>Tu despensa es privada. El ejemplo no guarda ningún dato.</small>
  </section>;
}

function ShoppingDialog({ shopping, online, onClose, onConfirm, onRefresh }: { shopping: ShoppingState; online: boolean; onClose(): void; onConfirm(): void; onRefresh(): void }) {
  const dialogRef = useRef<HTMLElement>(null); const closeRef = useRef<HTMLButtonElement>(null); const restoreRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (closeRef.current && !closeRef.current.disabled) closeRef.current.focus(); else dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && shopping.state !== "saving") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) { event.preventDefault(); dialogRef.current.focus(); return; } const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown); return () => { document.removeEventListener("keydown", onKeyDown); restoreRef.current?.focus(); };
  }, [onClose, shopping.state]);
  return <div className="today-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && shopping.state !== "saving") onClose(); }}>
    <section ref={dialogRef} tabIndex={-1} className="today-modal" role="dialog" aria-modal="true" aria-labelledby="today-shopping-title">
      {shopping.state === "done" ? <><h2 id="today-shopping-title">Añadido a la compra</h2><p>Los faltantes actuales se guardaron una sola vez.</p><Link className="today-primary-action" href="/app/shopping-list">Ver lista de compra</Link><button ref={closeRef} type="button" onClick={onClose}>Cerrar</button></>
        : <><h2 id="today-shopping-title">Añadir faltantes</h2><p>Se añadirán para <strong>{shopping.recipe.name}</strong>:</p><ul>{shopping.recipe.missingIngredients.map((item) => <li key={item}>{item}</li>)}</ul>
          {!online && <p role="alert">Sin conexión. Conecta de nuevo para confirmar.</p>}{shopping.state === "error" && <p role="alert">No se confirmó la compra. Reintenta con el mismo intento.</p>}
          {shopping.state === "conflict" && <p role="alert">Esta propuesta ha cambiado. Actualiza Hoy y revisa los faltantes antes de confirmar otra compra.</p>}
          <div><button ref={closeRef} type="button" disabled={shopping.state === "saving"} onClick={onClose}>Cancelar</button><button className="today-primary-action" type="button" disabled={shopping.state === "saving" || !online} onClick={shopping.state === "conflict" ? onRefresh : onConfirm}>{shopping.state === "conflict" ? "Actualizar Hoy" : shopping.state === "saving" ? "Añadiendo…" : shopping.state === "error" ? "Reintentar" : "Confirmar y añadir"}</button></div></>}
    </section>
  </div>;
}

const example: TodayResponse = { contract: "today-v2", date: "2026-10-02", generatedAt: "", state: "ready", snapshotKey: "example", catalogVersion: "example", matcherVersion: "example", recommendationVersion: "example", main: [{ recipeId: "example", name: "Huevos con cebolla", availability: "ready", missingCount: 0, unknownCount: 0, quantityToCheck: false, missingIngredients: [], unknownIngredients: [], reasons: [{ code: "have_all" }, { code: "use_soon_estimated", ingredient: "huevos" }] }], secondary: [] };

export function TodayApp({ userId }: { userId: string }) {
  const [supabase] = useState(() => createBrowserSupabaseClient()); const [loadState, setLoadState] = useState<LoadState>("loading"); const [result, setResult] = useState<TodayResponse | null>(null);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine); const [onboarding, setOnboarding] = useState(false); const [demo, setDemo] = useState(false); const [shopping, setShopping] = useState<ShoppingState | null>(null);
  const metric = useRef({ sessionId: metricId(), started: 0, opened: false, ended: false }); const resultRef = useRef<TodayResponse | null>(null); const demoRef = useRef(false); const requestRef = useRef<{ epoch: number; controller: AbortController | null }>({ epoch: 0, controller: null });
  const privacyEpoch = useRef(0);
  const closeShopping = useCallback(() => setShopping(null), []);
  const clearPrivateState = useCallback(() => { privacyEpoch.current += 1; requestRef.current.epoch += 1; requestRef.current.controller?.abort(); requestRef.current.controller = null; resultRef.current = null; demoRef.current = false; setResult(null); setDemo(false); setShopping(null); setOnboarding(false); setLoadState("error"); }, []);
  const finishMetric = useCallback((outcome: string) => { if (metric.current.ended) return; metric.current.ended = true; emitMetric({ eventId: metricId(), sessionId: metric.current.sessionId, phase: "decision_visible", outcome, timestamp: new Date().toISOString(), durationMs: Math.max(0, performance.now() - metric.current.started) }); }, []);

  const load = useCallback(async () => {
    if (demoRef.current) return; const epoch = requestRef.current.epoch + 1; requestRef.current.epoch = epoch; requestRef.current.controller?.abort(); const controller = new AbortController(); requestRef.current.controller = controller;
    if (!navigator.onLine) { setOnline(false); setLoadState(resultRef.current ? "stale" : "offline"); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser(); if (controller.signal.aborted || epoch !== requestRef.current.epoch) return; if (!user || user.id !== userId) { clearPrivateState(); return; }
      if ((await listOutbox(userId)).length > 0) { if (epoch === requestRef.current.epoch) setLoadState("pending_sync"); return; } setLoadState("loading");
      const response = await fetch("/api/recommendations/today", { cache: "no-store", headers: { Accept: "application/json" }, signal: controller.signal }); const body = await response.json();
      const { data: { user: currentUser } } = await supabase.auth.getUser(); if (controller.signal.aborted || epoch !== requestRef.current.epoch) return; if (!currentUser || currentUser.id !== userId) { clearPrivateState(); return; }
      if (!response.ok) { setLoadState(resultRef.current ? "stale" : body.code === "CATALOG_NOT_READY" ? "catalog" : "error"); return; }
      resultRef.current = body as TodayResponse; setResult(body as TodayResponse); setLoadState("ready"); let seen = false; try { seen = localStorage.getItem(`neverita:today-onboarding:${userId}`) === "seen"; } catch { /* Continue without persistence. */ } setOnboarding((body as TodayResponse).state === "empty_pantry" && !seen);
    } catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; if (epoch === requestRef.current.epoch) setLoadState(resultRef.current ? "stale" : navigator.onLine ? "error" : "offline"); }
  }, [clearPrivateState, supabase, userId]);

  useEffect(() => {
    const requests = requestRef.current;
    if (!metric.current.started) metric.current.started = performance.now(); if (!metric.current.opened) { metric.current.opened = true; emitMetric({ eventId: metricId(), sessionId: metric.current.sessionId, phase: "opened", timestamp: new Date().toISOString() }); }
    const timer = window.setTimeout(() => void load(), 0); const onOnline = () => { setOnline(true); void load(); }; const onOffline = () => { setOnline(false); setLoadState(resultRef.current ? "stale" : "offline"); }; const onFocus = () => { if (navigator.onLine) void load(); };
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => { if (!session?.user || session.user.id !== userId) clearPrivateState(); });
    window.addEventListener("online", onOnline); window.addEventListener("offline", onOffline); window.addEventListener("focus", onFocus);
    return () => { privacyEpoch.current += 1; window.clearTimeout(timer); requests.epoch += 1; requests.controller?.abort(); authListener.subscription.unsubscribe(); window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); window.removeEventListener("focus", onFocus); };
  }, [clearPrivateState, load, supabase, userId]);
  useEffect(() => { if (loadState !== "ready" || !result || onboarding) return; const outcome = result.state === "ready" && result.main.length > 0 ? "proposal" : result.state; const frame = requestAnimationFrame(() => finishMetric(outcome)); return () => cancelAnimationFrame(frame); }, [finishMetric, loadState, onboarding, result]);

  const confirmShopping = async () => {
    if (!shopping || !online || loadState !== "ready") return; const submitted = shopping; const epoch = privacyEpoch.current; setShopping({ ...submitted, state: "saving" });
    try { const response = await fetch("/api/recommendations/shopping", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipeId: submitted.recipe.recipeId, snapshotKey: submitted.snapshotKey, clientMutationId: submitted.mutationId }) }); if (epoch !== privacyEpoch.current) return; const { data: { user } } = await supabase.auth.getUser(); if (epoch !== privacyEpoch.current) return; if (!user || user.id !== userId) { clearPrivateState(); return; } setShopping({ ...submitted, state: response.ok ? "done" : response.status === 409 ? "conflict" : "error" }); } catch { if (epoch === privacyEpoch.current) setShopping({ ...submitted, state: "error" }); }
  };
  if (onboarding) return <Onboarding userId={userId} onClose={() => setOnboarding(false)} onExample={() => { setOnboarding(false); demoRef.current = true; requestRef.current.controller?.abort(); setDemo(true); setLoadState("ready"); }} />;
  const shown = demo ? example : result; const showResult = Boolean(shown && (loadState === "ready" || loadState === "stale")); const writesDisabled = !online || demo || loadState !== "ready";
  return <main className="today-page">
    <header className="today-heading"><div><p className="today-date">{new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p><h1>¿Qué cenamos?</h1><p>Opciones con lo que sabemos de tu despensa.</p></div><span aria-hidden="true">♡</span></header>
    {demo && <div id="today-demo-note" className="today-demo" role="status"><strong>Ejemplo</strong><span>No usa ni guarda datos de tu despensa. Sus acciones están desactivadas.</span><button type="button" onClick={() => { demoRef.current = false; setDemo(false); void load(); }}>Cerrar ejemplo</button></div>}
    {loadState === "stale" && shown && <div className="today-offline" role="status"><p>Resultado anterior · {online ? "No se pudo actualizar" : "Sin conexión"}</p>{online && <button type="button" onClick={() => void load()}>Reintentar</button>}</div>}
    {loadState === "loading" && <section className="today-message" role="status"><h2>Buscando opciones…</h2><p>Comprobamos ingredientes y cantidades.</p></section>}
    {loadState === "offline" && !shown && <section className="today-message" role="status"><h2>Hoy necesita conexión</h2><p>Todavía no hay un resultado de esta sesión para mostrar.</p></section>}
    {loadState === "pending_sync" && <section className="today-message" role="status"><h2>Guardando cambios de tu despensa</h2><p>Hoy se actualizará cuando termine la sincronización.</p><button type="button" onClick={() => void load()}>Reintentar</button></section>}
    {(loadState === "error" || loadState === "catalog") && <section className="today-message" role="alert"><h2>{loadState === "catalog" ? "El catálogo se está preparando" : "No pudimos calcular Hoy"}</h2><p>{loadState === "catalog" ? "Vuelve a intentarlo en unos minutos." : "Tu despensa no se ha modificado."}</p><button type="button" onClick={() => void load()}>Reintentar</button></section>}
    {showResult && shown?.state === "empty_pantry" && !demo && <section className="today-empty"><h2>Aún no sabemos qué tienes</h2><p>Añade tu última compra y te proponemos una cena con lo que hay.</p><Link className="today-primary-action" href="/app/add-purchase">Añadir compra</Link><Link href="/app/recipes/import">Trae una receta que te guste</Link></section>}
    {showResult && shown?.state === "unresolved_pantry" && <section className="today-empty"><h2>Revisa tu despensa</h2><p>Hay alimentos, pero todavía no sabemos con certeza qué son.</p><Link className="today-primary-action" href="/app/pantry">Revisar despensa</Link></section>}
    {showResult && shown?.state === "no_candidates" && <section className="today-empty"><h2>No encontramos una opción clara</h2><p>No vamos a inventar una recomendación. Puedes revisar tu despensa o traer una receta.</p><Link href="/app/pantry">Revisar despensa</Link><Link href="/app/recipes/import">Traer una receta</Link><button type="button" onClick={() => void load()}>Reintentar</button></section>}
    {showResult && shown?.state === "ready" && <><section className="today-main" aria-label="Decisiones para hoy">{shown.main.map((recipe) => <DecisionCard key={recipe.recipeId} recipe={recipe} snapshotKey={shown.snapshotKey} writesDisabled={writesDisabled} demo={demo} onShop={(selected, snapshotKey) => setShopping({ recipe: selected, snapshotKey, mutationId: crypto.randomUUID(), state: "confirm" })} />)}</section>{shown.secondary.length > 0 && <section className="today-secondary" aria-labelledby="today-secondary-title"><h2 id="today-secondary-title">También podrías aprovechar</h2>{shown.secondary.map((recipe) => demo ? <div key={recipe.recipeId}><strong>{recipe.name}</strong><span>{reasonLabel(recipe)}</span></div> : <Link key={recipe.recipeId} href={`/app/recipes/${recipe.recipeId}`}><strong>{recipe.name}</strong><span>{reasonLabel(recipe)}</span></Link>)}</section>}</>}
    {shopping && <ShoppingDialog shopping={shopping} online={online && loadState === "ready"} onClose={closeShopping} onConfirm={() => void confirmShopping()} onRefresh={() => { closeShopping(); void load(); }} />}
  </main>;
}
