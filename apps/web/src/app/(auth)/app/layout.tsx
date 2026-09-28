import { redirect } from "next/navigation";
import { PwaControls } from "@/components/pwa/pwa-controls";
import { PrivateSessionGate } from "@/components/pwa/private-session-gate";
import { AppBackLink } from "@/components/navigation/app-back-link";
import { ProductV3Nav } from "@/components/navigation/product-v3-nav";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { productV3Enabled } from "./product-v3";
import "@/styles/product-v3.css";

export default async function AuthenticatedAppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata.disabled === true) redirect("/login?error=session_expired");
  const v3 = productV3Enabled();
  return <PrivateSessionGate userId={user.id}>
    <PwaControls installPromotion={process.env.PWA_INSTALL_PROMOTION_ENABLED !== "false"} pushEnabled={process.env.PUSH_ENABLED !== "false" && Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)} />
    {v3 ? <div className="product-v3"><header className="product-v3-header"><a className="product-v3-brand" href="/app">Neverita</a><a className="product-v3-settings" href="/app/settings" aria-label="Ajustes">⚙</a></header><div className="product-v3-content">{children}</div><ProductV3Nav /></div>
      : <><AppBackLink /><div className="app-content">{children}</div></>}
  </PrivateSessionGate>;
}
