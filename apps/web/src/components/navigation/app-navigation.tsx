"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./app-navigation.module.css";

const destinations = [
  { href: "/app", label: "Inventario", icon: "▤" },
  { href: "/app/scan", label: "Escanear", icon: "▣" },
  { href: "/app/recipes", label: "Recetas", icon: "♨" },
  { href: "/app/calendar", label: "Comidas", icon: "▦" },
  { href: "/app/settings", label: "Más", icon: "☰" },
] as const;

export function AppNavigation() {
  const pathname = usePathname();
  return <nav className={styles.navigation} aria-label="Navegación principal">
    <Link className={styles.brand} href="/app">Neverita</Link>
    <div className={styles.destinations}>
      {destinations.map(({ href, label, icon }) => {
        const active = href === "/app" ? pathname === "/app" || pathname.startsWith("/app/items/") : pathname === href || pathname.startsWith(`${href}/`) || (href === "/app/settings" && ["/app/favorites", "/app/shopping-list", "/app/pro"].some(path => pathname === path || pathname.startsWith(`${path}/`)));
        return <Link key={href} href={href} className={styles.destination} aria-current={active ? "page" : undefined}>
          <span className={styles.icon} aria-hidden="true">{icon}</span><span>{label}</span>
        </Link>;
      })}
    </div>
  </nav>;
}
