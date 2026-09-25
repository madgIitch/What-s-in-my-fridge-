import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import styles from "./recipe-detail.module.css";

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();

  const supabase = await createServerSupabaseClient();
  const { data: recipe, error } = await supabase
    .from("recipes")
    .select("id,name,instructions,recipe_ingredients(name,measure,position)")
    .eq("id", id)
    .maybeSingle();

  if (error) return <main className={styles.shell}><Link href="/app/recipes">← Volver a recetas</Link><h1>No pudimos cargar la receta</h1><p>Inténtalo de nuevo cuando tengas conexión.</p></main>;
  if (!recipe) notFound();

  const ingredients = [...recipe.recipe_ingredients].sort((a, b) => a.position - b.position);
  const steps = recipe.instructions.split(/\r?\n/).map(step => step.trim()).filter(Boolean);
  return <main className={styles.shell}>
    <Link href="/app/recipes" className={styles.back}>← Volver a recetas</Link>
    <p className={styles.eyebrow}>RECETARIO</p>
    <h1>{recipe.name}</h1>
    <div className={styles.columns}>
      <section aria-labelledby="ingredients-title"><h2 id="ingredients-title">Ingredientes</h2><ul>{ingredients.map(ingredient => <li key={`${ingredient.position}-${ingredient.name}`}>{ingredient.measure ? `${ingredient.measure} ${ingredient.name}` : ingredient.name}</li>)}</ul></section>
      <section aria-labelledby="steps-title"><h2 id="steps-title">Pasos</h2>{steps.length ? <ol>{steps.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol> : <p>Esta receta no incluye instrucciones en el catálogo original.</p>}</section>
    </div>
  </main>;
}
