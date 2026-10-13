import "server-only";
import { redirect } from "next/navigation";
import { ShoppingListApp } from "@/components/shopping-list/shopping-list-app";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/cook/contracts";
import { productV3Enabled } from "../product-v3";

export default async function ShoppingListPage({ searchParams }: { searchParams: Promise<{ shoppingSession?: string }> }) {
  if (productV3Enabled()) {
    // Only a well-formed session id is carried over; any other parameter is dropped.
    const { shoppingSession } = await searchParams;
    redirect(uuid(shoppingSession) ? `/app/shop?shoppingSession=${shoppingSession}` : "/app/shop");
  }
  const s = await createServerSupabaseClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) redirect("/login?error=session_expired");
  return <ShoppingListApp userId={user.id} />;
}
