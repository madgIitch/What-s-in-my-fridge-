import { redirect } from "next/navigation";
import { logout } from "../actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AppEntryPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata.disabled === true) redirect("/login?error=session_expired");

  return <main style={{ maxWidth: 680, margin: "8vh auto", padding: 24 }}>
    <p className="eyebrow">SESIÓN VERIFICADA</p>
    <h1>Tu nevera está lista</h1>
    <p>Has entrado con una sesión validada en el servidor. Los siguientes sprints conectarán aquí el inventario offline-first.</p>
    <form action={logout}><button type="submit">Cerrar sesión</button></form>
  </main>;
}
