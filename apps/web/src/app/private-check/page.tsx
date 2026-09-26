import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function PrivateCheckPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/private-check");

  return <main className="private-check"><h1>Sesión protegida</h1><p>La sesión se validó en el servidor.</p></main>;
}
