"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { RecipeSuggestionsResponse } from "@/lib/recipes/contracts";
import { snapshotFromRecipe } from "@/lib/favorites/snapshot";
import { cacheFavorite, queueFeatureMutation } from "@/lib/favorites/db";
import type { FavoriteRecord, MutationEnvelope } from "@/lib/favorites/types";
import styles from "./recipe-suggestions.module.css";

type State = "loading" | "empty" | "results" | "no-matches" | "quota" | "error";

export function RecipeSuggestions({ userId }: { userId: string }) {
  const [state, setState] = useState<State>("loading");
  const [data, setData] = useState<RecipeSuggestionsResponse | null>(null);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState<Record<string,string>>({});
  const running = useRef(false);
  const load = useCallback(async () => {
    if (running.current) return;
    running.current = true; setState("loading"); setMessage("");
    try {
      const response = await fetch("/api/recipes/suggestions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ forceRefresh: false }) });
      const body = await response.json();
      if (!response.ok) {
        setMessage(body.message ?? "No se pudieron cargar las sugerencias");
        setState(body.code === "SUGGESTION_QUOTA_EXHAUSTED" ? "quota" : "error"); return;
      }
      const result = body as RecipeSuggestionsResponse; setData(result);
      setState(result.recipes.length ? "results" : result.inventoryEmpty ? "empty" : "no-matches");
    } catch { setMessage("No hay conexión. Inténtalo de nuevo."); setState("error"); }
    finally { running.current = false; }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const save = async (recipe: RecipeSuggestionsResponse["recipes"][number]) => {
    const clientMutationId=crypto.randomUUID(), snapshot=snapshotFromRecipe(recipe); setSaved(v=>({...v,[recipe.id]:"pending"}));
    const payload={client_mutation_id:clientMutationId,recipe_id:recipe.id,desired_state:"saved",snapshot};
    if(!navigator.onLine){await queueFeatureMutation({clientMutationId,userId,kind:"favorite",entityId:recipe.id,payload,state:"pending",createdAt:new Date().toISOString()});return}
    try{const response=await fetch("/api/favorites",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});const result=await response.json() as MutationEnvelope<FavoriteRecord>;if((result.status==="applied"||result.status==="duplicate")&&result.result){await cacheFavorite(userId,result.result);setSaved(v=>({...v,[recipe.id]:"saved"}))}else setSaved(v=>({...v,[recipe.id]:"error"}))}catch{await queueFeatureMutation({clientMutationId,userId,kind:"favorite",entityId:recipe.id,payload,state:"pending",createdAt:new Date().toISOString()})}
  };
  return <div className={styles.shell}><nav className={styles.nav}><strong>Neverita · Recetas</strong><span><a href="/app">Inventario</a> · <a href="/app/favorites">Favoritos</a> · <a href="/app/shopping-list">Compra</a></span></nav><main className={styles.main}>
    <header><p className={styles.eyebrow}>Con lo que ya tienes</p><h1>Ideas para cocinar hoy</h1><p className={styles.lede}>Comparamos tu inventario en el servidor y te mostramos qué puedes preparar y qué te falta.</p><Link className={styles.importLink} href="/app/recipes/import">Importar receta por enlace</Link></header>
    <div className={styles.toolbar}><button onClick={load} disabled={state === "loading"}>{state === "loading" ? "Buscando…" : "Actualizar sugerencias"}</button>{data?.cache.hit && <span className={styles.cache} role="status">Resultado guardado · no consume cuota</span>}</div>
    <section aria-busy={state === "loading"} aria-live="polite">
      {state === "loading" && <div className={styles.notice}><span className={styles.spinner} />Buscando las mejores coincidencias…</div>}
      {state === "empty" && <div className={styles.notice}><h2>Tu inventario está vacío</h2><p>Añade algún alimento para descubrir recetas.</p><a href="/app">Ir al inventario</a></div>}
      {state === "no-matches" && <div className={styles.notice}><h2>Aún no hay coincidencias</h2><p>Prueba a actualizar tu inventario con nombres más concretos.</p></div>}
      {state === "quota" && <div className={styles.notice} role="alert"><h2>Límite mensual alcanzado</h2><p>{message}</p><p>Los resultados guardados siguen disponibles durante 60 minutos.</p></div>}
      {state === "error" && <div className={styles.notice} role="alert"><h2>No pudimos cargar las recetas</h2><p>{message}</p><button onClick={load}>Reintentar</button></div>}
      {state === "results" && data && <div className={styles.grid}>{data.recipes.map((recipe) => <article className={styles.card} key={recipe.id}><div className={styles.cardHead}><div><p className={styles.kicker}>Coincidencia</p><h2>{recipe.name}</h2></div><strong className={styles.score} aria-label={`${recipe.matchPercentage} por ciento de coincidencia`}>{recipe.matchPercentage}%</strong></div><Link className={styles.detailLink} href={`/app/recipes/${recipe.id}`}>Ver receta y pasos</Link><button className={styles.save} onClick={()=>void save(recipe)} disabled={saved[recipe.id]==="pending"||saved[recipe.id]==="saved"}>{saved[recipe.id]==="saved"?"Guardada":saved[recipe.id]==="pending"?"Pendiente…":"Guardar receta"}</button><div className={styles.columns}><section><h3>Ya tienes</h3><ul>{recipe.matchedIngredients.map((item) => <li key={item}>✓ {item}</li>)}</ul></section><section><h3>Te falta</h3>{recipe.missingIngredients.length ? <ul>{recipe.missingIngredients.map((item) => <li key={item}>+ {item}</li>)}</ul> : <p>¡Nada!</p>}</section></div><details><summary>Ingredientes y medidas</summary><ul>{recipe.ingredientsWithMeasures.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></details><details><summary>Ver instrucciones</summary><p className={styles.instructions}>{recipe.instructions || "Esta receta no incluye instrucciones en el catálogo original."}</p></details></article>)}</div>}
    </section>
  </main></div>;
}
