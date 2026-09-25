import { redirect } from "next/navigation";
import { PwaControls } from "@/components/pwa/pwa-controls";
import { PrivateSessionGate } from "@/components/pwa/private-session-gate";
import { AppNavigation } from "@/components/navigation/app-navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AuthenticatedAppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata.disabled === true) redirect("/login?error=session_expired");
  return <PrivateSessionGate userId={user.id}><PwaControls installPromotion={process.env.PWA_INSTALL_PROMOTION_ENABLED !== "false"} pushEnabled={process.env.PUSH_ENABLED !== "false" && Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)} /><AppNavigation /><div className="app-content">{children}</div></PrivateSessionGate>;
}
