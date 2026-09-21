import { redirect } from "next/navigation";
import { RecipeImport } from "@/components/recipe-import/recipe-import";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ url?: string; text?: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=session_expired");
  const params = await searchParams;
  return <RecipeImport initialUrl={params.url?.slice(0, 2048) ?? ""} initialText={params.text?.slice(0, 10_000) ?? ""} />;
}
