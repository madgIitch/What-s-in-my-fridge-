import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PurchaseIntake } from "@/components/purchase/purchase-intake";
import { productV3Enabled } from "../product-v3";

export default async function AddPurchasePage() {
  if (!productV3Enabled()) redirect("/app/scan");
  const supabase = await createServerSupabaseClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=session_expired");
  return <PurchaseIntake />;
}
