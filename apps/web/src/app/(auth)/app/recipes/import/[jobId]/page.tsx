import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { validateImportedRecipe } from "@/lib/recipe-import/result";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import styles from "@/components/recipe-import/recipe-import.module.css";

export default async function ImportedRecipePage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)) notFound();
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=session_expired");
  const { data, error } = await supabase.from("recipe_import_jobs").select("state,result").eq("id", jobId).eq("user_id", user.id).maybeSingle();
  if (!error && !data) notFound();
  const recipe = validateImportedRecipe(data?.result) ? data.result : null;
  return <main className={styles.shell}>
    <Link className={styles.openRecipe} href="/app/recipes/import">← Volver a importaciones</Link>
    <p className={styles.eyebrow}>TU RECETA IMPORTADA</p>
    {error ? <><h1>No pudimos cargar la receta</h1><p>Vuelve a intentarlo cuando tengas conexión.</p></> : data?.state !== "completed" ? <><h1>La receta aún no está lista</h1><p>Consulta su estado en importaciones.</p></> : !recipe ? <><h1>No pudimos leer la receta</h1><p>El resultado guardado no tiene el formato esperado.</p></> : <>
      <h1>{recipe.title}</h1>
      <section className={styles.recipeSection}><h2>Ingredientes</h2><ul>{recipe.ingredients.map((ingredient, index) => <li key={index}>{[ingredient.amount, ingredient.unit, ingredient.name].filter(value => value !== null && value !== undefined && value !== "").join(" ")}</li>)}</ul></section>
      <section className={styles.recipeSection}><h2>Preparación</h2><ol>{recipe.steps.map((step, index) => <li key={index}>{step}</li>)}</ol></section>
    </>}
    <Link className={styles.openRecipe} href="/app/recipes">Volver a recetas →</Link>
  </main>;
}
