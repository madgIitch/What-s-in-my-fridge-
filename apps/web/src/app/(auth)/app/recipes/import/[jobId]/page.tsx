import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { recipeNeedsReview, recipeSourceUrl, validateImportedRecipe } from "@/lib/recipe-import/result";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import styles from "@/components/recipe-import/recipe-import.module.css";
import { RecipeJobWait, RecipeReview } from "@/components/recipe-import/recipe-review";
import { RecipeAvailability } from "@/components/cook/recipe-availability";
import { ImportRecovery } from "@/components/cook/import-recovery";
import { productV3Enabled } from "../../../product-v3";
import { SavedRecipe } from "@/components/cook/saved-recipe";

export default async function ImportedRecipePage({ params, searchParams }: { params: Promise<{ jobId: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { jobId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)) notFound();
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=session_expired");
  const saved = (await searchParams).saved;
  if (productV3Enabled() && saved) return <SavedRecipe userId={user.id} savedId={saved} recipeRef={{ kind: "import", id: jobId }} />;
  const { data, error } = await supabase.from("recipe_import_jobs").select("state,result,provenance,error_code,retryable,source_type").eq("id", jobId).eq("user_id", user.id).maybeSingle();
  if (!error && !data) notFound();
  const reviewEnabled = process.env.RECIPE_IMPORT_REVIEW_ENABLED === "true";
  let activeResult = data?.result;
  let version = 0;
  let reviewAvailable = reviewEnabled;
  if ((reviewEnabled || productV3Enabled()) && data?.state === "completed") {
    const revision = await supabase.from("recipe_import_revisions" as never).select("version,result").eq("job_id", jobId).eq("user_id", user.id).order("version", { ascending: false }).limit(1).maybeSingle();
    if (revision.error) reviewAvailable = false;
    else if (revision.data) { const saved = revision.data as { version: number; result: typeof activeResult }; activeResult = saved.result; version = saved.version; }
  }
  const recipe = validateImportedRecipe(activeResult) ? activeResult : null;
  const parentId = data?.provenance && typeof data.provenance === "object" && !Array.isArray(data.provenance) ? data.provenance.parentJobId : undefined;
  let parentVersion = 0;
  let candidateParent: string | undefined;
  if (reviewAvailable && typeof parentId === "string" && /^[0-9a-f-]{36}$/i.test(parentId)) {
    const parent = await supabase.from("recipe_import_jobs").select("id").eq("id", parentId).eq("user_id", user.id).maybeSingle();
    if (parent.data) {
      const latest = await supabase.from("recipe_import_revisions").select("version").eq("job_id", parentId).order("version", { ascending: false }).limit(1).maybeSingle();
      if (!latest.error) { candidateParent = parentId; parentVersion = latest.data?.version ?? 0; }
    }
  }
  const sourceUrl = recipeSourceUrl(recipe);
  return <main className={styles.shell}>
    <Link className={styles.openRecipe} href="/app/recipes/import">← Volver a importaciones</Link>
    <p className={styles.eyebrow}>TU RECETA IMPORTADA</p>
    {error ? <><h1>No pudimos cargar la receta</h1><p>Vuelve a intentarlo cuando tengas conexión.</p></> : data?.state === "failed" && productV3Enabled() ? <><h1>No pudimos importar la receta</h1><ImportRecovery jobId={jobId} userId={user.id} errorCode={data.error_code} retryable={data.retryable && data.source_type !== "file"} /></> : data?.state !== "completed" ? <><h1>La receta aún no está lista</h1><RecipeJobWait jobId={jobId} /></> : !recipe ? <><h1>No pudimos leer la receta</h1><p>El resultado guardado no tiene el formato esperado.</p><Link href="/app/recipes/import?mode=text">Pegar la receta como texto</Link></> : <>
      <h1>{recipe.title}</h1>
      {productV3Enabled() && <RecipeAvailability key={`${user.id}:${jobId}:${version}`} userId={user.id} recipeRef={{ kind: "import", id: jobId }} />}
      {!productV3Enabled() && sourceUrl && <a className={styles.openRecipe} href={sourceUrl} target="_blank" rel="noopener noreferrer">Ver receta original ↗</a>}
      {!productV3Enabled() && recipeNeedsReview(recipe) && <section className={styles.recipeSection} role="status"><h2>Revisa esta receta</h2><p>La importación contiene datos que no se han podido confirmar. Comprueba ingredientes, cantidades y preparación con la fuente original.</p></section>}
      {!productV3Enabled() && <section className={styles.recipeSection}><h2>Ingredientes</h2><ul>{recipe.ingredients.map((ingredient, index) => <li key={index}>{[ingredient.amount, ingredient.unit, ingredient.name].filter(value => value !== null && value !== undefined && value !== "").join(" ")}{!ingredient.amount && <small className={styles.quantityUnknown}>Cantidad no indicada</small>}</li>)}</ul></section>}
      <section className={styles.recipeSection}><h2>Preparación</h2><ol>{recipe.steps.map((step, index) => <li key={index}>{step}</li>)}</ol></section>
      {reviewAvailable && <RecipeReview key={`${version}-${parentVersion}`} jobId={candidateParent ?? jobId} version={candidateParent ? parentVersion : version} recipe={recipe} candidate={!!candidateParent} canReprocess={!candidateParent && process.env.RECIPE_IMPORT_REPROCESS_ENABLED === "true"} />}
    </>}
    <Link className={styles.openRecipe} href="/app/recipes">Volver a recetas →</Link>
  </main>;
}
