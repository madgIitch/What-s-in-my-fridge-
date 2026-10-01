"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { listItems } from "@/lib/inventory/db";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { syncInventory } from "@/lib/inventory/sync";
import { estimatedWindowLabel, purchasedLabel } from "@/lib/inventory/dates";
import type { LocalInventoryItem } from "@/lib/inventory/types";

const groups = [{ location: "fridge", label: "Nevera" }, { location: "pantry", label: "Armario" }, { location: "freezer", label: "Congelador" }, { location: null, label: "Por ubicar" }] as const;
const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
const stateLabel = (item: LocalInventoryItem) => item.stockMode === "exact" && item.quantityExact !== null && item.quantityExact !== undefined ? `${item.quantityExact} ${item.quantityUnit ?? ""}`.trim() : ({ plenty: "Bastante", some: "Algo", low: "Poco", empty: "Se acabó", present: "Disponible", absent: "Se acabó" } as Record<string, string>)[item.stockState ?? "present"] ?? "Cantidad por comprobar";

export function PantryV3List({ userId }: { userId: string }) {
  const active = useRef(true);
  const [items, setItems] = useState<LocalInventoryItem[]>([]); const [loading, setLoading] = useState(true); const [query, setQuery] = useState(""); const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine); const [failed, setFailed] = useState(false);
  const load = useCallback(async () => { const rows = await listItems(userId, true); if (!active.current) return; setItems(rows); setLoading(false); }, [userId]);
  const synchronize = useCallback(async () => { if (!navigator.onLine || !active.current) return; try { setFailed(false); await syncInventory(userId, createBrowserSupabaseClient(), () => active.current); if (active.current) await load(); } catch { if (active.current) setFailed(true); } }, [load, userId]);
  useEffect(() => { active.current = true; void listItems(userId, true).then((rows) => { if (!active.current) return; setItems(rows); setLoading(false); void synchronize(); }); const online = () => { setOffline(false); void synchronize(); }; const offlineHandler = () => setOffline(true); window.addEventListener("online", online); window.addEventListener("offline", offlineHandler); return () => { active.current = false; window.removeEventListener("online", online); window.removeEventListener("offline", offlineHandler); }; }, [synchronize, userId]);
  const activeItems = useMemo(() => items.filter((item) => !item.deletedAt), [items]);
  const visible = useMemo(() => { const needle = fold(query.trim()); return !needle ? activeItems : activeItems.filter((item) => fold(`${item.name} ${item.rawName ?? ""}`).includes(needle)); }, [activeItems, query]);
  const availableCount = activeItems.filter((item) => item.stockState !== "empty" && item.stockState !== "absent").length;
  const latestPending = useMemo(() => { const purchases = items.filter((item) => item.receiptDraftId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); const draftId = purchases[0]?.receiptDraftId; return { draftId, count: activeItems.filter((item) => item.receiptDraftId === draftId && item.normalizationStatus === "unknown").length }; }, [activeItems, items]);
  return <main className="product-v3-pantry"><div className="pantry-heading"><div><p className="product-v3-kicker">Despensa</p><h1>Lo que tienes</h1></div><strong aria-label={`${availableCount} alimentos disponibles`}>{availableCount}</strong></div>
    {offline && <p className="pantry-alert" role="status">Estás sin conexión. Puedes consultar y editar; guardaremos los cambios para después.</p>}{failed && <p className="pantry-alert" role="alert">Algunos cambios no se han podido guardar. <button type="button" onClick={synchronize}>Reintentar</button></p>}
    {latestPending.draftId && latestPending.count > 0 && <Link className="pantry-pending" href={`/app/add-purchase/${latestPending.draftId}?pending=1`}><span><strong>Revisa {latestPending.count} del último ticket</strong><small>Completa solo los alimentos que siguen pendientes</small></span><span aria-hidden="true">→</span></Link>}
    <label className="pantry-search"><span className="sr-only">Buscar en la despensa</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar alimentos" /></label>
    {loading ? <p role="status">Cargando despensa…</p> : activeItems.length === 0 ? <section className="pantry-empty"><h2>Tu despensa está lista para empezar</h2><p>Escanea una compra y revisa únicamente lo que necesite tu ayuda.</p><Link href="/app/add-purchase">Añadir una compra</Link></section> : visible.length === 0 ? <p role="status">No hay alimentos que coincidan con “{query}”.</p> : <div className="pantry-groups">{groups.map((group) => { const groupItems = visible.filter((item) => (item.location ?? null) === group.location); if (!groupItems.length) return null; return <section key={group.label}><h2>{group.label}<span>{groupItems.filter((item) => item.stockState !== "empty" && item.stockState !== "absent").length}</span></h2><ul>{groupItems.map((item) => <li key={item.id}><Link href={`/app/pantry/${item.id}`}><span><strong>{item.name}</strong><small>{stateLabel(item)}{item.location && item.locationConfirmed === false ? " · Ubicación propuesta" : ""}</small>{item.acquiredOn && <small>{purchasedLabel(item.acquiredOn, item.acquiredOnSource === "receipt" ? "receipt" : "user")}</small>}{item.freshnessPrecision === "estimated" && item.freshnessEstimatedDays !== null && item.freshnessEstimatedDays !== undefined && <small>Conservación estimada: {estimatedWindowLabel(item.freshnessEstimatedDays)} desde la compra</small>}</span><span aria-hidden="true">›</span></Link></li>)}</ul></section>; })}</div>}
    <Link className="pantry-purchase-cta" href="/app/add-purchase">Añadir compra</Link></main>;
}
