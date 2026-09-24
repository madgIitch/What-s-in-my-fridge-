"use client";

import { useTransition } from "react";
import { clearPrivateSession } from "@/lib/pwa/private-data";

export function LogoutButton({ action }: { action: () => Promise<void> }) {
  const [pending, startTransition] = useTransition();
  return <button type="button" disabled={pending} onClick={() => startTransition(async () => {
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager?.getSubscription();
        if (subscription) {
          try { await fetch("/api/push/subscriptions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) }); } catch { /* Local unsubscribe still stops this device. */ }
          await subscription.unsubscribe();
        }
      }
    } finally {
      await clearPrivateSession();
      await action();
    }
  })}>{pending ? "Cerrando…" : "Cerrar sesión"}</button>;
}
