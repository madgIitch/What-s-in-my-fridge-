"use client";

import { useEffect, useState } from "react";
import { registerNeveritaServiceWorker, urlBase64ToBytes } from "@/lib/pwa/registration";

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type InstallState = "unsupported" | "available" | "prompting" | "installed" | "dismissed" | "error";
type PushState = "unsupported" | "default" | "prompting" | "enabled" | "denied" | "error";

export function PwaControls({ installPromotion = true, pushEnabled = true }: { installPromotion?: boolean; pushEnabled?: boolean }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [install, setInstall] = useState<InstallState>("unsupported");
  const [push, setPush] = useState<PushState>("unsupported");

  useEffect(() => {
    void registerNeveritaServiceWorker().catch(() => undefined);
    queueMicrotask(() => {
      if ("Notification" in window && "PushManager" in window && "serviceWorker" in navigator && pushEnabled) setPush(Notification.permission === "granted" ? "enabled" : Notification.permission);
      if (window.matchMedia("(display-mode: standalone)").matches) setInstall("installed");
    });
    const onPrompt = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); setInstall("available"); };
    const onInstalled = () => setInstall("installed");
    window.addEventListener("beforeinstallprompt", onPrompt); window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, [pushEnabled]);

  async function installApp() {
    if (!prompt || install !== "available") return;
    setInstall("prompting");
    try { await prompt.prompt(); const choice = await prompt.userChoice; setInstall(choice.outcome === "accepted" ? "installed" : "dismissed"); setPrompt(null); } catch { setInstall("error"); }
  }

  async function enablePush() {
    if (push !== "default" && push !== "error") return;
    setPush("prompting");
    try {
      // Permission is intentionally requested only in this direct click handler.
      const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      if (permission !== "granted") { setPush(permission === "denied" ? "denied" : "default"); return; }
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("PUSH_UNAVAILABLE");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(key) });
      const response = await fetch("/api/push/subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: subscription.toJSON() }) });
      if (!response.ok) throw new Error("PUSH_UNAVAILABLE");
      setPush("enabled");
    } catch { setPush("error"); }
  }

  async function disablePush() {
    if (push !== "enabled") return;
    try {
      const registration = await navigator.serviceWorker.ready; const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const response = await fetch("/api/push/subscriptions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
        if (!response.ok) throw new Error("PUSH_RETRYABLE");
        await subscription.unsubscribe();
      }
      setPush("default");
    } catch { setPush("error"); }
  }

  return <aside aria-label="Aplicación instalada y avisos" style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", padding: ".5rem 1rem" }}>
    {installPromotion && install === "available" && <button type="button" onClick={() => void installApp()}>Instalar Neverita</button>}
    {installPromotion && install === "dismissed" && <span role="status">Instalación cancelada. Puedes intentarlo más tarde.</span>}
    {push === "default" && <button type="button" onClick={() => void enablePush()}>Activar avisos de recetas</button>}
    {push === "enabled" && <button type="button" onClick={() => void disablePush()}>Desactivar avisos</button>}
    {push === "denied" && <span role="status">Avisos bloqueados en el navegador.</span>}
    {push === "error" && <><span role="alert">No se pudieron actualizar los avisos.</span><button type="button" onClick={() => void enablePush()}>Reintentar avisos</button></>}
  </aside>;
}
