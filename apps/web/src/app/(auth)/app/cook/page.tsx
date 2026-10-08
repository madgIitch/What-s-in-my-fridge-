import { redirect } from "next/navigation";
import { CookLibraryApp } from "@/components/cook/cook-library";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { productV3Enabled } from "../product-v3";

export default async function CookPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (!productV3Enabled()) redirect("/app/recipes");
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=session_expired");
  const requested = (await searchParams).view;
  const view = requested === "saved" || requested === "imported" ? requested : "today";
  return <CookLibraryApp key={`${user.id}:${view}`} userId={user.id} view={view} />;
}
