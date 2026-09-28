"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./recipe-import.module.css";

type Recipe = { title: string; ingredients: { name: string; amount?: string; unit?: string }[]; steps: string[] };
export function RecipeReview({ jobId, version, recipe, canReprocess, candidate = false }: { jobId: string; version: number; recipe: Recipe; canReprocess: boolean; candidate?: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(recipe.title);
  const [ingredients, setIngredients] = useState(recipe.ingredients);
  const [steps, setSteps] = useState(recipe.steps.join("\n"));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function send(operation: "save" | "restore" | "reprocess") {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/recipe-jobs/${jobId}/${operation === "reprocess" ? "reprocess" : "review"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(operation === "reprocess" ? {} : { expectedVersion: version, restore: operation === "restore", ...(operation === "save" ? { result: { schemaVersion: "recipe-v1", title: title.trim(), ingredients: ingredients.map(item => ({ name: item.name.trim(), ...(item.amount?.trim() ? { amount: item.amount.trim() } : {}), ...(item.unit?.trim() ? { unit: item.unit.trim() } : {}) })), steps: steps.split("\n").map(step => step.trim()).filter(Boolean) } } : {}) }) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error?.message ?? "No se pudo guardar"); return; }
      if (operation === "reprocess") { router.push(`/app/recipes/import/${result.jobId}`); return; }
      setEditing(false); setMessage(operation === "restore" ? "Versión original restaurada." : "Revisión guardada."); router.refresh();
    } catch { setMessage("No hay conexión. Vuelve a intentarlo."); } finally { setBusy(false); }
  }
  return <section className={styles.recipeSection}>
    <h2>{candidate ? "Nueva versión candidata" : "Tu revisión"}</h2>
    <p>El resultado original se conserva. Puedes corregir la receta y guardar tu propia versión.</p>
    {candidate && <button type="button" className={styles.primary} disabled={busy} onClick={() => void send("save")}>Aceptar esta versión</button>}
    {!editing ? <button type="button" className={styles.primary} disabled={busy} onClick={() => setEditing(true)}>Corregir receta</button> : <form onSubmit={event => { event.preventDefault(); void send("save"); }}>
      <label>Título<input required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} /></label>
      <h3>Ingredientes</h3>
      {ingredients.map((item, index) => <fieldset key={index} className={styles.reviewIngredient}><legend>Ingrediente {index + 1}</legend>{(["name", "amount", "unit"] as const).map(key => <label key={key}>{key === "name" ? "Nombre" : key === "amount" ? "Cantidad (opcional)" : "Unidad (opcional)"}<input required={key === "name"} maxLength={key === "name" ? 200 : 100} value={item[key] ?? ""} onChange={event => setIngredients(ingredients.map((other, position) => position === index ? { ...other, [key]: event.target.value } : other))} /></label>)}<button type="button" disabled={ingredients.length <= 1} onClick={() => setIngredients(ingredients.filter((_item, position) => position !== index))}>Quitar ingrediente</button></fieldset>)}
      <button type="button" disabled={ingredients.length >= 200} onClick={() => setIngredients([...ingredients, { name: "" }])}>Añadir ingrediente</button>
      <label>Preparación (un paso por línea)<textarea required rows={8} value={steps} onChange={event => setSteps(event.target.value)} /></label>
      <button className={styles.primary} disabled={busy}>Guardar mi versión</button><button type="button" disabled={busy} onClick={() => setEditing(false)}>Cancelar</button>
    </form>}
    {version > 0 && <button type="button" className={styles.primary} disabled={busy} onClick={() => void send("restore")}>Restaurar receta original</button>}
    {canReprocess && <button type="button" className={styles.primary} disabled={busy} onClick={() => void send("reprocess")}>Reprocesar sin consumir otra importación</button>}
    <p role="status" aria-live="polite">{busy ? "Guardando…" : message}</p>
  </section>;
}

export function RecipeJobWait({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("La receta se está procesando. Puedes volver a importaciones.");
  return <section className={styles.recipeSection}><p role="status">{message}</p><button className={styles.primary} type="button" onClick={async () => {
    try {
      const response = await fetch(`/api/recipe-jobs/${jobId}`, { cache: "no-store" });
      if (!response.ok) { setMessage("No se pudo consultar el estado. Vuelve a intentarlo."); return; }
      const { job } = await response.json();
      if (job.state === "completed") router.refresh();
      else setMessage(job.state === "failed" ? "La importación no ha podido completarse. La receta original se conserva." : "Todavía se está procesando. Puedes volver más tarde.");
    } catch { setMessage("No hay conexión. Vuelve a intentarlo."); }
  }}>Actualizar estado</button></section>;
}
