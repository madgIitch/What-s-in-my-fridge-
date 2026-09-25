"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { formatCivilDate } from "@/lib/inventory/dates";
import { listItems, listOutbox } from "@/lib/inventory/db";
import { discardConflict, retryFailedMutation, retryWithRemoteVersion } from "@/lib/inventory/repository";
import { inventoryEvents, syncInventory } from "@/lib/inventory/sync";
import type { LocalInventoryItem } from "@/lib/inventory/types";

type InventoryFilter = "all" | "fresh" | "soon" | "expired" | "prepared";

function expiryState(date: string) {
  const days = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${new Date().toISOString().slice(0, 10)}T12:00:00Z`)) / 86_400_000);
  return days < 0 ? "expired" : days <= 3 ? "soon" : "fresh";
}

export function InventoryApp({ userId }: { userId: string }) {
  const [items, setItems] = useState<LocalInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [hasCache, setHasCache] = useState(false);
  const [filter, setFilter] = useState<InventoryFilter>("all");
  const supabase = useState(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  })[0];

  const refresh = useCallback(async () => {
    const rows = await listItems(userId);
    setItems(rows); setHasCache(rows.length > 0 || (await listOutbox(userId)).length > 0); setLoading(false);
  }, [userId]);

  const sync = useCallback(async () => {
    if (!navigator.onLine || !supabase) return;
    try { await syncInventory(userId, supabase); } finally { await refresh(); }
  }, [refresh, supabase, userId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void refresh().then(sync), 0);
    const onOnline = () => { setOnline(true); void sync(); };
    const onOffline = () => setOnline(false);
    const onFocus = () => void sync();
    const onMessage = (event: MessageEvent<{ userId?: string }>) => { if (event.data.userId === userId) void refresh(); };
    window.addEventListener("online", onOnline); window.addEventListener("offline", onOffline); window.addEventListener("focus", onFocus);
    inventoryEvents?.addEventListener("message", onMessage);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); window.removeEventListener("focus", onFocus);
      inventoryEvents?.removeEventListener("message", onMessage);
    };
  }, [refresh, sync, userId]);

  const visibleItems = items.filter(item => filter === "all" || (filter === "prepared" ? item.category === "Platos preparados" : expiryState(item.expiryDate) === filter));

  return <main className="inventory-page">
    <header className="inventory-header">
      <div className="inventory-header-copy"><h1>Mi Nevera <Image src="/neverito-nevera.png" alt="" width={48} height={48} /></h1><p>{items.length} alimentos guardados ♡</p></div>
      <div className="inventory-header-links"><Link href="/app/settings" aria-label="Ajustes">⚙</Link><Link href="/app/calendar" aria-label="Calendario">▦</Link><Link href="/app/shopping-list" aria-label="Lista de compra">🛒</Link></div>
      <div className="inventory-filters" role="group" aria-label="Filtrar alimentos">
        {([ ["all", "Todos"], ["fresh", "♡ Fresco"], ["soon", "⚠ Pronto"], ["expired", "Caducado"], ["prepared", "🍲 Platos"] ] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
      </div>
    </header>
    <nav className="inventory-shortcuts" aria-label="Acciones del inventario"><Link href="/app/items/new"><span aria-hidden="true">＋</span><span>Añadir alimento</span></Link><Link href="/app/scan"><span aria-hidden="true">▣</span><span>Escanear ticket</span></Link><Link href="/app/recipes"><span aria-hidden="true">♨</span><span>Ver recetas</span></Link></nav>
    <p className="connection-state" role="status">{!supabase ? "Modo local · sincronización sin configurar" : online ? "Con conexión" : "Sin conexión"}</p>

    <section className="inventory-list" aria-labelledby="inventory-title">
      <div className="inventory-list-heading"><h2 id="inventory-title">Alimentos</h2><button type="button" onClick={() => void sync()}>Sincronizar</button></div>
      {loading && <p role="status">Cargando inventario…</p>}
      {!loading && !online && !hasCache && <p role="status">Sin conexión y todavía no hay una copia local.</p>}
      {!loading && items.length === 0 && (online || hasCache) && <div className="inventory-empty" role="status"><span aria-hidden="true">♡</span><h3>Tu nevera está esperando</h3><p>Añade tu primer alimento o escanea un ticket para empezar.</p><Link href="/app/items/new">Añadir alimento</Link></div>}
      {!loading && visibleItems.length === 0 && items.length > 0 && <p>No hay alimentos en este filtro.</p>}
      <ul>
        {visibleItems.map((item) => <li key={item.id} className="inventory-item">
          <div className="inventory-item-copy"><strong>{item.name}</strong><span>{item.quantity} {item.unit} · Caduca {formatCivilDate(item.expiryDate)}</span></div>
          <span className={`sync-label sync-${item.syncState}`}>Estado: {item.syncState}</span>
          {item.syncState === "conflict" && <div className="conflict-panel" role="alert">
            <p>Hay un conflicto. El servidor tiene «{item.remoteSnapshot?.name}» (versión {item.remoteSnapshot?.version}). Tus cambios siguen guardados.</p>
            <button type="button" onClick={async () => { await discardConflict(userId, item.id); await refresh(); }}>Descartar mis cambios</button>
            <button type="button" onClick={async () => { await retryWithRemoteVersion(userId, item.id); await refresh(); void sync(); }}>Reintentar con la versión actual</button>
          </div>}
          {item.syncState === "error" && <button type="button" onClick={async () => { await retryFailedMutation(userId, item.id); await refresh(); void sync(); }}>Reintentar sincronización</button>}
          <div className="item-actions"><Link href={`/app/items/${item.id}`} aria-label={`Ver y editar ${item.name}`}>Ver detalle y editar</Link></div>
        </li>)}
      </ul>
    </section>
  </main>;
}
