import Link from "next/link";
import { redirect } from "next/navigation";
import { RecipeSuggestions } from "@/components/recipes/recipe-suggestions";
import { FavoritesApp } from "@/components/favorites/favorites-app";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { productV3Enabled } from "../product-v3";

export default async function CookPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (!productV3Enabled()) redirect("/app/recipes");
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=session_expired");
  const view = (await searchParams).view === "saved" ? "saved" : "today";
  return <div className="product-v3-cook"><p className="product-v3-kicker">Cocinar</p><h1>Tus recetas</h1><p className="product-v3-lead">Explora el catálogo o vuelve a las recetas que guardaste.</p>
    <div className="product-v3-cook-links"><Link href="/app/cook?view=today" aria-current={view === "today" ? "page" : undefined}>Para hoy</Link><Link href="/app/cook?view=saved" aria-current={view === "saved" ? "page" : undefined}>Guardadas</Link><Link href="/app/recipes/import">Traer receta</Link></div>
    {view === "saved" ? <FavoritesApp userId={user.id} /> : <RecipeSuggestions userId={user.id} />}
  </div>;
}
