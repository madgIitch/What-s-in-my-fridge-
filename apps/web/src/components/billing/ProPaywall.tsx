/* eslint-disable react-hooks/set-state-in-effect, @next/next/no-location-assign-relative-destination */
"use client";
import { useCallback, useEffect, useState } from "react";
import type { ApiEnvelope, Entitlement } from "@/lib/billing/contracts";
import styles from "../../app/(auth)/app/pro/pro.module.css";

type View = { kind: "loading"; last?: Entitlement } | { kind: "ready"; entitlement: Entitlement } | { kind: "error"; code: string; retryable: boolean; last?: Entitlement };

export function ProPaywall({ checkout }: { checkout?: string }) {
  const [view, setView] = useState<View>({ kind: "loading" }); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { setView((previous) => ({ kind: "loading", last: previous.kind === "ready" ? previous.entitlement : previous.last })); try { const response = await fetch("/api/stripe/entitlement", { cache: "no-store", signal: AbortSignal.timeout(10000) }); if (response.status === 401) { location.assign("/login?error=session_expired&returnTo=%2Fapp%2Fpro"); return; } const payload = await response.json() as ApiEnvelope<Entitlement>; if (!payload.ok) { setView((previous) => ({ kind: "error", code: payload.error.code, retryable: payload.error.retryable || response.status === 429 || response.status >= 500, last: previous.kind === "loading" ? previous.last : previous.kind === "ready" ? previous.entitlement : previous.last })); return; } setView({ kind: "ready", entitlement: payload.data }); } catch { setView((previous) => ({ kind: "error", code: "NETWORK_ERROR", retryable: true, last: previous.kind === "loading" ? previous.last : previous.kind === "ready" ? previous.entitlement : previous.last })); } }, []);
  useEffect(() => { void load(); }, [load, checkout]);
  async function open(kind: "checkout" | "portal") { setBusy(true); try { const response = await fetch(`/api/stripe/${kind}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ returnTo: "/app/pro" }) }); if (response.status === 401) { location.assign("/login?error=session_expired&returnTo=%2Fapp%2Fpro"); return; } const payload = await response.json() as ApiEnvelope<{ url: string }>; if (!payload.ok) { setView((previous) => ({ kind: "error", code: payload.error.code, retryable: payload.error.retryable, last: previous.kind === "ready" ? previous.entitlement : previous.last })); return; } location.assign(payload.data.url); } catch { setView((previous) => ({ kind: "error", code: "NETWORK_ERROR", retryable: true, last: previous.kind === "ready" ? previous.entitlement : previous.last })); } finally { setBusy(false); } }
  return <main className={styles.shell}>
    <section className={styles.hero}><p className={styles.kicker}>NEVERITA PRO</p><h1>Más ideas.<br/>Menos desperdicio.</h1><p>Convierte lo que ya tienes en comidas, sin preocuparte por los límites mensuales.</p></section>
    {checkout === "success" && <p className={styles.notice} role="status">Pago completado. Estamos comprobando tu plan con Stripe.</p>}
    {checkout === "cancel" && <p className={styles.notice} role="status">No se realizó ningún cambio en tu plan.</p>}
    <section className={styles.panel} aria-live="polite" aria-busy={view.kind === "loading"}>
      {view.kind === "loading" && <><span className={styles.pulse}/><h2>Consultando tu plan…</h2></>}
      {view.kind === "error" && <><p className={styles.label}>No pudimos comprobar tu plan</p><h2>{view.retryable ? "Inténtalo de nuevo" : "Necesitamos revisar tu plan"}</h2><p>Código: {view.code}</p>{view.last && <p>Último estado conocido: {view.last.plan === "pro" ? "Pro" : "Free"}. Puede haber cambiado.</p>}{view.retryable && <button onClick={() => void load()}>Reintentar</button>}</>}
      {view.kind === "ready" && <Ready entitlement={view.entitlement} busy={busy} open={open}/>}
    </section>
  </main>;
}
function Ready({ entitlement: e, busy, open }: { entitlement: Entitlement; busy: boolean; open: (kind: "checkout" | "portal") => void }) {
  const pro = e.plan === "pro"; const paymentIssue = e.status === "past_due"; const canceled = e.status === "canceled";
  return <><p className={styles.label}>{pro ? e.status === "trialing" ? "PRUEBA PRO" : "TU PLAN" : "PLAN ACTUAL"}</p><h2>{pro ? "Pro está activo" : paymentIssue ? "Pago pendiente" : canceled ? "Tu plan está cancelado" : "Neverita Free"}</h2><p>{pro ? "Tienes acceso sin límites Free." : paymentIssue ? "Actualiza tu método de pago para recuperar Pro." : canceled ? "Puedes volver a activar Pro cuando quieras." : "5 OCR, 5 sugerencias y 10 imports cada mes."}</p>{e.currentPeriodEnd && <p className={styles.meta}>Periodo actual hasta {new Date(e.currentPeriodEnd).toLocaleDateString("es-ES")}{e.cancelAtPeriodEnd ? " · se cancelará al finalizar" : ""}</p>}<button disabled={busy} onClick={() => void open(pro || paymentIssue ? "portal" : "checkout")}>{busy ? "Abriendo…" : pro || paymentIssue ? "Gestionar suscripción" : "Activar Pro"}</button></>;
}
