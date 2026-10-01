"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const destinations = [
  { href: "/app", label: "Hoy" },
  { href: "/app/pantry", label: "Despensa" },
  { href: "/app/cook", label: "Cocinar" },
  { href: "/app/shopping-list", label: "Compra" },
] as const;

function NavigationIcon({ href }: { href: string }) {
  return <svg className="product-v3-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {href === "/app" ? <><path d="m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9" /></>
      : href === "/app/pantry" ? <><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M6 10h12M9 5v2M9 13v4" /></>
        : href === "/app/cook" ? <><path d="M6 14a5 5 0 0 1-1-9 5 5 0 0 1 9-1 5 5 0 0 1 4 10v7H6v-7ZM6 17h12" /></>
          : <><path d="M2 3h3l3 13h11l3-10H6M10 20h.01M18 20h.01" /><circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>}
  </svg>;
}

export function ProductV3Nav() {
  const pathname = usePathname();
  return <nav className="product-v3-nav" aria-label="Navegación principal">
    {destinations.slice(0, 2).map((item) => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}>
      <NavigationIcon href={item.href} /><span>{item.label}</span>
    </Link>)}
    <div className="product-v3-add">
      <Link href="/app/add-purchase" aria-label="Añadir compra" aria-current={pathname.startsWith("/app/add-purchase") ? "page" : undefined}>+</Link>
    </div>
    {destinations.slice(2).map((item) => <Link key={item.href} href={item.href} aria-current={pathname === item.href || (item.href === "/app/cook" && ["/app/recipes", "/app/favorites"].includes(pathname)) ? "page" : undefined}>
      <NavigationIcon href={item.href} /><span>{item.label}</span>
    </Link>)}
  </nav>;
}
