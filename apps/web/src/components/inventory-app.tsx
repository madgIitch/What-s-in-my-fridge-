"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { formatCivilDate } from "@/lib/inventory/dates";
import { listItems, listOutbox } from "@/lib/inventory/db";
import { createLocalItem, discardConflict, retryFailedMutation, retryWithRemoteVersion } from "@/lib/inventory/repository";
import { inventoryEvents, syncInventory } from "@/lib/inventory/sync";
import type { LocalInventoryItem } from "@/lib/inventory/types";

const today = () => {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
};

export function InventoryApp({ userId }: { userId: string }) {
  const [items, setItems] = useState<LocalInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [hasCache, setHasCache] = useState(false);
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

  async function add(formData: FormData) {
    await createLocalItem(userId, {
      name: String(formData.get("name") ?? ""), expiryDate: String(formData.get("expiryDate") ?? ""),
      category: String(formData.get("category") ?? ""), quantity: Number(formData.get("quantity") ?? 1),
      notes: String(formData.get("notes") ?? ""), unit: String(formData.get("unit") ?? "unidad"),
    });
    await refresh(); void sync();
  }

  return <main className="inventory-page">
    <header className="inventory-header">
      <div><p className="eyebrow">INVENTARIO OFFLINE-FIRST</p><h1>Tu nevera</h1></div>
      <p className="connection-state" role="status">
        {!supabase ? "Modo local · sincronización sin configurar" : online ? "Con conexión" : "Sin conexión"}
      </p>
    </header>

    <form className="inventory-form" action={add}>
      <h2>Añadir alimento</h2>
      <label>Nombre<input name="name" required maxLength={120} /></label>
      <label>Caducidad<input name="expiryDate" type="date" required defaultValue={today()} /></label>
      <label>Cantidad<input name="quantity" type="number" min="0" step="0.01" defaultValue="1" required /></label>
      <label>Unidad<input name="unit" defaultValue="unidad" required /></label>
      <label>Categoría<input name="category" /></label>
      <label>Notas<input name="notes" /></label>
      <button type="submit">Añadir al inventario</button>
    </form>

    <section className="inventory-list" aria-labelledby="inventory-title">
      <div className="inventory-list-heading"><h2 id="inventory-title">Alimentos</h2><Link href="/app/items/new">Añadir alimento</Link><button type="button" onClick={() => void sync()}>Sincronizar</button></div>
      {loading && <p role="status">Cargando inventario…</p>}
      {!loading && !online && !hasCache && <p role="status">Sin conexión y todavía no hay una copia local.</p>}
      {!loading && items.length === 0 && (online || hasCache) && <p role="status">Tu inventario está vacío.</p>}
      <ul>
        {items.map((item) => <li key={item.id} className="inventory-item">
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
