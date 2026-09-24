import { redirect } from "next/navigation";
import { logout } from "../actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { InventoryApp } from "@/components/inventory-app";
import { LogoutButton } from "@/components/pwa/logout-button";

export default async function AppEntryPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata.disabled === true) redirect("/login?error=session_expired");

  return <div className="inventory-shell">
    <nav className="inventory-nav"><span className="brand">Neverita</span><LogoutButton action={logout} /></nav>
    <InventoryApp userId={user.id} />
  </div>;
}
