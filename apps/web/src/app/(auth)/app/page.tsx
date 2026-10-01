import { InventoryApp } from "@/components/inventory-app";
import { TodayApp } from "@/components/today/today-app";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { productV3Enabled } from "./product-v3";

export default async function AppEntryPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (productV3Enabled()) return <TodayApp key={user!.id} userId={user!.id} />;
  return <InventoryApp userId={user!.id} />;
}
