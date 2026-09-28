import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { productV3Enabled } from "../product-v3";
import { PantryV3List } from "./pantry-v3-list";

export default async function PantryPage() {
  if (!productV3Enabled()) redirect("/app");
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=session_expired");
  return <PantryV3List userId={user.id} />;
}
