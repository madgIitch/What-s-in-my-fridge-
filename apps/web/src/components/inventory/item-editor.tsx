"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { getItem, putItems } from "@/lib/inventory/db";
import { createLocalItem, deleteLocalItem, fromServer, updateLocalItem } from "@/lib/inventory/repository";
import { syncInventory } from "@/lib/inventory/sync";
import type { InventoryDraft, LocalInventoryItem, ServerInventoryItem } from "@/lib/inventory/types";
import styles from "./item-editor.module.css";

const today = () => new Date().toISOString().slice(0, 10);
const blank = (): InventoryDraft => ({ name: "", expiryDate: today(), quantity: 1, unit: "unidad", category: "", notes: "" });

export function ItemEditor({ userId, itemId }: { userId: string; itemId?: string }) {
  const router = useRouter();
  const [item, setItem] = useState<LocalInventoryItem | null>(null);
  const [draft, setDraft] = useState<InventoryDraft>(blank);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "saving" | "error">(itemId ? "loading" : "ready");
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [consumeAmount, setConsumeAmount] = useState(1);
  const [confirmConsume, setConfirmConsume] = useState(false);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const consumeButton = useRef<HTMLButtonElement>(null);
  const deleteHeading = useRef<HTMLHeadingElement>(null);
  const consumeConfirmation = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (confirmDelete) deleteHeading.current?.focus();
    if (confirmConsume) consumeConfirmation.current?.focus();
    if (!confirmDelete && !confirmConsume) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (confirmDelete) { setConfirmDelete(false); deleteButton.current?.focus(); }
      if (confirmConsume) { setConfirmConsume(false); window.requestAnimationFrame(() => consumeButton.current?.focus()); }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [confirmDelete, confirmConsume]);

  useEffect(() => {
    if (!itemId) return;
    let active = true;
    async function load() {
      try {
        let found = await getItem(userId, itemId!);
        if (!found && navigator.onLine) {
          const client = createBrowserSupabaseClient();
          const { data, error } = await client.from("inventory_items").select("*").eq("id", itemId!).maybeSingle();
          if (error) throw error;
          if (data && data.user_id === userId) {
            found = fromServer(data as ServerInventoryItem);
            await putItems([found]);
          }
        }
        if (!active) return;
        if (!found || found.deletedAt) { setState("missing"); return; }
        setItem(found);
        setDraft({ name: found.name, expiryDate: found.expiryDate, quantity: found.quantity, unit: found.unit, category: found.category ?? "", notes: found.notes ?? "" });
        setState("ready");
      } catch {
        if (active) { setState("error"); setMessage(navigator.onLine ? "No se pudo cargar este alimento." : "No hay una copia local de este alimento."); }
      }
    }
    void load();
    return () => { active = false; };
  }, [itemId, userId]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving"); setMessage("");
    try {
      const saved = item ? await updateLocalItem(userId, item.id, draft) : await createLocalItem(userId, draft);
      if (navigator.onLine) {
        try { await syncInventory(userId, createBrowserSupabaseClient()); } catch { /* The local outbox keeps the change. */ }
      }
      router.push(`/app/items/${saved.id}`);
      router.refresh();
      if (item) { setItem(saved); setState("ready"); setMessage("Cambio guardado. Puede quedar pendiente de sincronización."); }
    } catch { setState("error"); setMessage("Revisa los datos e inténtalo de nuevo."); }
  }

  async function remove() {
    if (!item) return;
    setState("saving");
    try {
      await deleteLocalItem(userId, item.id);
      if (navigator.onLine) {
        try { await syncInventory(userId, createBrowserSupabaseClient()); } catch { /* The local outbox keeps the deletion. */ }
      }
      router.push("/app");
      router.refresh();
    } catch { setState("error"); setMessage("No se pudo eliminar. Reintenta."); setConfirmDelete(false); }
  }

  async function consume() {
    if (!item || !Number.isFinite(consumeAmount) || consumeAmount <= 0 || consumeAmount > item.quantity) return;
    setState("saving"); setMessage("");
    try {
      const updated = await updateLocalItem(userId, item.id, { quantity: Math.max(0, item.quantity - consumeAmount) });
      setItem(updated);
      setDraft(current => ({ ...current, quantity: updated.quantity }));
      setConfirmConsume(false);
      setState("ready");
      setMessage("Consumo guardado. Puede quedar pendiente de sincronización.");
      if (navigator.onLine) {
        try { await syncInventory(userId, createBrowserSupabaseClient()); } catch { /* Pending outbox preserves this change. */ }
      }
    } catch { setState("error"); setMessage("No se pudo registrar el consumo."); }
  }

  return <main className={styles.shell}>
    <Link href="/app" className={styles.back}>← Volver al inventario</Link>
    <header><p className={styles.eyebrow}>INVENTARIO</p><h1>{itemId ? "Detalle del alimento" : "Añadir alimento"}</h1></header>
    {state === "loading" && <p role="status">Cargando alimento…</p>}
    {state === "missing" && <section role="status"><h2>Alimento no encontrado</h2><p>Puede haberse eliminado o aún no estar disponible en este dispositivo.</p><Link href="/app">Ver inventario</Link></section>}
    {state === "error" && <p role="alert">{message}</p>}
    {(state === "ready" || state === "saving" || (state === "error" && (!itemId || item))) && <form onSubmit={save} className={styles.form}>
      <label>Nombre<input required maxLength={120} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
      <div className={styles.columns}><label>Caducidad<input type="date" required value={draft.expiryDate} onChange={event => setDraft({ ...draft, expiryDate: event.target.value })} /></label><label>Cantidad<input type="number" min="0" step="0.01" required value={draft.quantity} onChange={event => setDraft({ ...draft, quantity: Number(event.target.value) })} /></label></div>
      <div className={styles.columns}><label>Unidad<input required value={draft.unit} onChange={event => setDraft({ ...draft, unit: event.target.value })} /></label><label>Categoría<input value={draft.category ?? ""} onChange={event => setDraft({ ...draft, category: event.target.value })} /></label></div>
      <label>Notas<textarea rows={3} value={draft.notes ?? ""} onChange={event => setDraft({ ...draft, notes: event.target.value })} /></label>
      {item && <p className={styles.sync} role="status">Estado: {item.syncState === "synced" ? "Sincronizado" : item.syncState === "pending" ? "Pendiente de sincronización" : item.syncState === "conflict" ? "Conflicto pendiente de resolver" : "Error de sincronización"}</p>}
      {message && state !== "error" && <p role="status">{message}</p>}
      <div className={styles.actions}><button type="submit" disabled={state === "saving"} className={styles.primary}>{state === "saving" ? "Guardando…" : item ? "Guardar cambios" : "Añadir al inventario"}</button>{item && <button ref={deleteButton} type="button" disabled={state === "saving"} onClick={() => { setConfirmConsume(false); setConfirmDelete(true); }}>Eliminar</button>}</div>
    </form>}
    {confirmDelete && item && <section className={styles.confirm} role="dialog" aria-labelledby="delete-title"><h2 id="delete-title" ref={deleteHeading} tabIndex={-1}>¿Eliminar {item.name}?</h2><p>La eliminación se sincronizará cuando haya conexión.</p><div className={styles.actions}><button type="button" onClick={() => { setConfirmDelete(false); deleteButton.current?.focus(); }}>Cancelar</button><button type="button" className={styles.danger} onClick={() => void remove()}>Sí, eliminar</button></div></section>}
    {item && state !== "missing" && <section className={styles.consume} aria-labelledby="consume-title"><h2 id="consume-title">Consumir alimento</h2><p>Disponible: {item.quantity} {item.unit}</p><label>Cantidad a consumir<input type="number" min="0.01" max={item.quantity} step="0.01" value={consumeAmount} onChange={event => setConsumeAmount(Number(event.target.value))} /></label>{!confirmConsume ? <button ref={consumeButton} type="button" disabled={item.quantity <= 0 || consumeAmount <= 0 || consumeAmount > item.quantity || state === "saving"} onClick={() => { setConfirmDelete(false); setConfirmConsume(true); }}>Revisar consumo</button> : <div className={styles.confirm} role="dialog" aria-label="Confirmar consumo"><p ref={consumeConfirmation} tabIndex={-1}>Se descontarán {consumeAmount} {item.unit} de {item.name}.</p><div className={styles.actions}><button type="button" onClick={() => { setConfirmConsume(false); window.requestAnimationFrame(() => consumeButton.current?.focus()); }}>Cancelar</button><button type="button" className={styles.primary} onClick={() => void consume()}>Confirmar consumo</button></div></div>}</section>}
  </main>;
}
