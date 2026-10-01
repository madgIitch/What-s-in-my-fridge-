"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { localCivilDate } from "@/lib/inventory/dates";

type Mode = "barcode" | "voice" | "manual" | null;
type SpeechRecognitionLike = { lang: string; interimResults: boolean; onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start(): void; stop(): void };

export function PurchaseIntake() {
  const router = useRouter(); const [mode, setMode] = useState<Mode>(null); const [value, setValue] = useState(""); const [barcodeName, setBarcodeName] = useState("");
  const [needsBarcodeName, setNeedsBarcodeName] = useState(false); const [listening, setListening] = useState(false); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState<string | null>(null);
  const barcodeTrigger = useRef<HTMLButtonElement>(null); const voiceTrigger = useRef<HTMLButtonElement>(null); const manualTrigger = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement | HTMLTextAreaElement>(null); const recognition = useRef<SpeechRecognitionLike | null>(null); const activeMode = useRef<Exclude<Mode, null> | null>(null);
  const close = useCallback(() => { recognition.current?.stop(); recognition.current = null; setListening(false); setMode(null); setNeedsBarcodeName(false); setError(null); const origin = activeMode.current; window.setTimeout(() => { if (origin === "barcode") barcodeTrigger.current?.focus(); else if (origin === "voice") voiceTrigger.current?.focus(); else if (origin === "manual") manualTrigger.current?.focus(); }, 0); }, []);
  useEffect(() => { if (mode) field.current?.focus(); }, [mode, needsBarcodeName]);
  useEffect(() => { if (!mode) return; const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); close(); } }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [close, mode]);
  useEffect(() => () => { recognition.current?.stop(); }, []);
  function open(next: Exclude<Mode, null>) { activeMode.current = next; setMode(next); setValue(""); setBarcodeName(""); setNeedsBarcodeName(false); setError(null); }
  function voice() {
    open("voice"); const Speech = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!Speech) return; const instance = new Speech(); recognition.current = instance; instance.lang = navigator.language || "es-ES"; instance.interimResults = false;
    instance.onresult = (event) => setValue(event.results[0]?.[0]?.transcript ?? ""); instance.onerror = () => { setListening(false); setError("No se pudo usar el dictado. Puedes escribir el producto."); }; instance.onend = () => setListening(false); setListening(true); instance.start();
  }
  async function review() {
    if (!mode || submitting) return; setSubmitting(true); setError(null);
    try { const response = await fetch("/api/ocr/v2/manual", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: mode, value, ...(barcodeName.trim() ? { name: barcodeName.trim() } : {}), localDate: localCivilDate() }) }); const body = await response.json();
      if (!response.ok) { if (body.code === "BARCODE_NAME_REQUIRED") { setNeedsBarcodeName(true); setError("No conocemos este código. Escribe el nombre antes de revisarlo."); return; } setError(body.message ?? "No se pudo preparar la revisión."); return; }
      recognition.current?.stop(); recognition.current = null; setListening(false); router.push(`/app/add-purchase/${body.draftId}`);
    } catch { setError("No hay conexión. Reintenta cuando vuelvas a estar online."); } finally { setSubmitting(false); }
  }
  return <main className="purchase-intake"><p className="product-v3-kicker">Añadir compra</p><h1>¿Cómo quieres añadirla?</h1><p className="product-v3-lead">El ticket es la forma más rápida. Siempre revisarás lo reconocido antes de guardarlo.</p>
    <Link className="purchase-primary" href="/app/scan"><span aria-hidden="true">▧</span><strong>Escanear ticket</strong><small>Fotografía o elige una imagen</small></Link>
    <div className="purchase-methods" aria-label="Otras formas de añadir"><button ref={barcodeTrigger} type="button" onClick={() => open("barcode")}><span aria-hidden="true">▥</span><strong>Código de barras</strong></button><button ref={voiceTrigger} type="button" onClick={voice}><span aria-hidden="true">◉</span><strong>Voz</strong></button><button ref={manualTrigger} type="button" onClick={() => open("manual")}><span aria-hidden="true">＋</span><strong>Manual</strong></button></div>
    {mode && <section className="purchase-entry" aria-labelledby="purchase-entry-title"><button className="purchase-close" type="button" aria-label="Cerrar" onClick={close}>×</button><h2 id="purchase-entry-title">{mode === "barcode" ? "Introduce el código" : mode === "voice" ? "Revisa lo que has dicho" : "Escribe el producto"}</h2><p>{mode === "barcode" ? "Si la cámara o el detector no están disponibles, puedes escribir los números." : "Nada se guardará hasta que lo confirmes."}</p>
      {mode === "manual" || mode === "voice" ? <textarea ref={field as React.RefObject<HTMLTextAreaElement>} value={value} onChange={(event) => setValue(event.target.value)} rows={3} aria-label="Producto reconocido" /> : <><input ref={field as React.RefObject<HTMLInputElement>} value={value} onChange={(event) => { setValue(event.target.value.replace(/\D/g, "")); setNeedsBarcodeName(false); }} inputMode="numeric" autoComplete="off" aria-label="Código de barras" />{needsBarcodeName && <label>Nombre del producto<input value={barcodeName} onChange={(event) => setBarcodeName(event.target.value)} minLength={1} maxLength={120} /></label>}</>}
      {listening && <p role="status">Escuchando…</p>}{error && <p className="pantry-alert" role="alert">{error}</p>}<button className="purchase-confirm" type="button" disabled={!value.trim() || (needsBarcodeName && !barcodeName.trim()) || submitting} onClick={review}>{submitting ? "Preparando…" : "Revisar antes de guardar"}</button>
    </section>}
  </main>;
}
