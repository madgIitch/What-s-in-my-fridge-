import { InventoryApp } from "@/components/inventory-app";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AppEntryPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <InventoryApp userId={user!.id} />;
}
