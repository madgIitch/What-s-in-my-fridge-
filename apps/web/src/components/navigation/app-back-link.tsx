"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppBackLink() {
  const pathname = usePathname();
  if (pathname === "/app") return null;
  return <div className="app-back-row"><Link href="/app">← Mi Nevera</Link></div>;
}
