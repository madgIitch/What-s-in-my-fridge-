import { redirect } from "next/navigation";
import { RecipeSuggestions } from "@/components/recipes/recipe-suggestions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function RecipesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=session_expired");
  return <RecipeSuggestions userId={user.id} />;
}
