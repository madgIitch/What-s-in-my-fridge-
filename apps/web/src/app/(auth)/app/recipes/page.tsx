import { redirect } from "next/navigation";
import { RecipeSuggestions } from "@/components/recipes/recipe-suggestions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { productV3Enabled } from "../product-v3";
import { legacyV3CollectionDestination } from "../legacy-v3-redirect";

export default async function RecipesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (productV3Enabled()) redirect(legacyV3CollectionDestination("today", await searchParams));
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=session_expired");
  return <RecipeSuggestions userId={user.id} />;
}
