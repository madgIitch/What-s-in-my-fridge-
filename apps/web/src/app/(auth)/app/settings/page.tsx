import Link from "next/link";
import { logout } from "../../actions";
import { LogoutButton } from "@/components/pwa/logout-button";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import styles from "./settings.module.css";

const links = [
  { href: "/app/favorites", label: "Favoritos", description: "Tus recetas guardadas" },
  { href: "/app/shopping-list", label: "Lista de compra", description: "Ingredientes que necesitas" },
  { href: "/app/recipes/import", label: "Importar receta", description: "Enlace, texto o archivo" },
  { href: "/app/pro", label: "Plan Pro", description: "Estado de tu suscripción" },
];

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <main className={styles.shell}>
    <header><p className={styles.kicker}>TU CUENTA</p><h1>Más opciones</h1><p>Accede a tus recetas, compras y plan desde aquí.</p></header>
    <nav aria-label="Opciones de la cuenta" className={styles.links}>
      {links.map(link => <Link key={link.href} href={link.href}><span><strong>{link.label}</strong><small>{link.description}</small></span><span aria-hidden="true">→</span></Link>)}
    </nav>
    <section className={styles.account} aria-labelledby="account-title"><h2 id="account-title">Cuenta</h2><p>{user?.email ?? "Sesión activa"}</p><LogoutButton action={logout} /></section>
  </main>;
}
