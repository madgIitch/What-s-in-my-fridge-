"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listItems } from "@/lib/inventory/db";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { syncInventory } from "@/lib/inventory/sync";
import type { LocalInventoryItem } from "@/lib/inventory/types";

export function PantryV3List({ userId }: { userId: string }) {
  const [items, setItems] = useState<LocalInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void listItems(userId).then((rows) => { if (active) { setItems(rows); setLoading(false); } });
    if (navigator.onLine) {
      try {
        const supabase = createBrowserSupabaseClient();
        void syncInventory(userId, supabase).then(() => listItems(userId)).then((rows) => { if (active) setItems(rows); }).catch(() => {});
      } catch { /* Local cache remains readable without Supabase configuration. */ }
    }
    return () => { active = false; };
  }, [userId]);
  return <main className="product-v3-pantry"><p className="product-v3-kicker">Despensa</p><h1>Lo que tienes</h1><p className="product-v3-lead">Los alimentos antiguos conservan su información original. Su cantidad y frescura están por comprobar.</p>
    {loading ? <p role="status">Cargando despensa…</p> : items.length === 0 ? <p role="status">Aún no hay alimentos guardados.</p> : <ul>{items.map((item) => <li key={item.id}><Link href={`/app/items/${item.id}`}>{item.name}</Link><small>Cantidad y frescura por comprobar</small></li>)}</ul>}
    <div className="product-v3-actions"><Link href="/app/items/new">Añadir alimento</Link><Link href="/app/scan">Escanear ticket</Link></div>
  </main>;
}
