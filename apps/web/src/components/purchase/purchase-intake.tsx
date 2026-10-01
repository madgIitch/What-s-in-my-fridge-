"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { localCivilDate } from "@/lib/inventory/dates";

type Mode = "barcode" | "voice" | "manual" | null;
type SpeechRecognitionLike = { lang: string; interimResults: boolean; onresult: ((event: { resultIndex?: number; results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null; onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null; start(): void; stop(): void; abort?(): void };

function dictationError(code: string): string {
  switch (code) {
    case "not-allowed": case "NotAllowedError": case "SecurityError": return "El navegador no permite usar el micrófono. Revisa el permiso de este sitio y vuelve a intentarlo. También puedes escribir el producto.";
    case "audio-capture": case "NotFoundError": return "No se pudo acceder al micrófono. Comprueba que esté conectado y disponible. También puedes escribir el producto.";
    case "service-not-allowed": case "language-not-supported": return "El servicio de dictado de este navegador no está disponible en español. Puedes escribir el producto o usar el micrófono del teclado de tu móvil.";
    case "network": return "No se pudo conectar con el servicio de dictado del navegador. Puedes reintentar, escribir el producto o usar el micrófono del teclado de tu móvil.";
    case "no-speech": return "No hemos oído ninguna palabra. Vuelve a dictar o escribe el producto.";
    case "aborted": return "El dictado se ha detenido. Puedes volver a dictar o escribir el producto.";
    default: return "El dictado no está disponible ahora. Puedes reintentar o escribir el producto.";
  }
}

export function PurchaseIntake() {
  const router = useRouter(); const [mode, setMode] = useState<Mode>(null); const [value, setValue] = useState(""); const [barcodeName, setBarcodeName] = useState("");
  const [needsBarcodeName, setNeedsBarcodeName] = useState(false); const [listening, setListening] = useState(false); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState<string | null>(null);
  const barcodeTrigger = useRef<HTMLButtonElement>(null); const voiceTrigger = useRef<HTMLButtonElement>(null); const manualTrigger = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement | HTMLTextAreaElement>(null); const recognition = useRef<SpeechRecognitionLike | null>(null); const activeMode = useRef<Exclude<Mode, null> | null>(null);
  const stopRecognition = useCallback(() => {
    const instance = recognition.current; recognition.current = null;
    if (!instance) return;
    instance.onresult = null; instance.onerror = null; instance.onend = null;
    try { if (instance.abort) instance.abort(); else instance.stop(); } catch { /* Already ended. */ }
  }, []);
  const close = useCallback(() => { stopRecognition(); setListening(false); setMode(null); setNeedsBarcodeName(false); setError(null); const origin = activeMode.current; window.setTimeout(() => { if (origin === "barcode") barcodeTrigger.current?.focus(); else if (origin === "voice") voiceTrigger.current?.focus(); else if (origin === "manual") manualTrigger.current?.focus(); }, 0); }, [stopRecognition]);
  useEffect(() => { if (mode) field.current?.focus(); }, [mode, needsBarcodeName]);
  useEffect(() => { if (!mode) return; const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); close(); } }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [close, mode]);
  useEffect(() => () => { stopRecognition(); }, [stopRecognition]);
  function open(next: Exclude<Mode, null>) { stopRecognition(); setListening(false); activeMode.current = next; setMode(next); setValue(""); setBarcodeName(""); setNeedsBarcodeName(false); setError(null); }
  function voice() {
    if (mode !== "voice") open("voice"); else { stopRecognition(); setListening(false); setError(null); }
    const Speech = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!Speech) { setError("Este navegador no ofrece dictado. Puedes escribir el producto o usar el micrófono del teclado de tu móvil."); return; }
    try {
      const instance = new Speech(); recognition.current = instance; instance.lang = "es-ES"; instance.interimResults = false;
      let received = false; let failed = false;
      instance.onresult = (event) => { if (recognition.current !== instance) return; const transcript = event.results[event.resultIndex ?? 0]?.[0]?.transcript?.trim(); if (transcript) { received = true; setValue(transcript); setError(null); } };
      instance.onerror = (event) => { if (recognition.current !== instance) return; failed = true; stopRecognition(); setListening(false); setError(dictationError(event.error)); field.current?.focus(); };
      instance.onend = () => { if (recognition.current !== instance) return; recognition.current = null; setListening(false); if (!received && !failed) setError(dictationError("no-speech")); };
      setListening(true); instance.start();
    } catch (cause) { stopRecognition(); setListening(false); const code = cause && typeof cause === "object" && "name" in cause && typeof cause.name === "string" ? cause.name : "unknown"; setError(dictationError(code)); }
  }
  function finishDictation() {
    try { recognition.current?.stop(); } catch { stopRecognition(); }
    setListening(false);
  }
  async function review() {
    if (!mode || submitting) return; stopRecognition(); setListening(false); setSubmitting(true); setError(null);
    try { const response = await fetch("/api/ocr/v2/manual", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: mode, value, ...(barcodeName.trim() ? { name: barcodeName.trim() } : {}), localDate: localCivilDate() }) }); const body = await response.json();
      if (!response.ok) { if (body.code === "BARCODE_NAME_REQUIRED") { setNeedsBarcodeName(true); setError("No conocemos este código. Escribe el nombre antes de revisarlo."); return; } setError(body.message ?? "No se pudo preparar la revisión."); return; }
      stopRecognition(); setListening(false); router.push(`/app/add-purchase/${body.draftId}`);
    } catch { setError("No hay conexión. Reintenta cuando vuelvas a estar online."); } finally { setSubmitting(false); }
  }
  return <main className="purchase-intake"><p className="product-v3-kicker">Añadir compra</p><h1>¿Cómo quieres añadirla?</h1><p className="product-v3-lead">El ticket es la forma más rápida. Siempre revisarás lo reconocido antes de guardarlo.</p>
    <Link className="purchase-primary" href="/app/scan"><span aria-hidden="true">▧</span><strong>Escanear ticket</strong><small>Fotografía o elige una imagen</small></Link>
    <div className="purchase-methods" aria-label="Otras formas de añadir"><button ref={barcodeTrigger} type="button" onClick={() => open("barcode")}><span aria-hidden="true">▥</span><strong>Código de barras</strong></button><button ref={voiceTrigger} type="button" onClick={voice}><span aria-hidden="true">◉</span><strong>Voz</strong></button><button ref={manualTrigger} type="button" onClick={() => open("manual")}><span aria-hidden="true">＋</span><strong>Manual</strong></button></div>
    {mode && <section className="purchase-entry" aria-labelledby="purchase-entry-title"><button className="purchase-close" type="button" aria-label="Cerrar" onClick={close}>×</button><h2 id="purchase-entry-title">{mode === "barcode" ? "Introduce el código" : mode === "voice" ? "Revisa lo que has dicho" : "Escribe el producto"}</h2><p>{mode === "barcode" ? "Si la cámara o el detector no están disponibles, puedes escribir los números." : "Nada se guardará hasta que lo confirmes."}</p>
      {mode === "manual" || mode === "voice" ? <textarea ref={field as React.RefObject<HTMLTextAreaElement>} value={value} onChange={(event) => setValue(event.target.value)} rows={3} aria-label="Producto reconocido" /> : <><input ref={field as React.RefObject<HTMLInputElement>} value={value} onChange={(event) => { setValue(event.target.value.replace(/\D/g, "")); setNeedsBarcodeName(false); }} inputMode="numeric" autoComplete="off" aria-label="Código de barras" />{needsBarcodeName && <label>Nombre del producto<input value={barcodeName} onChange={(event) => setBarcodeName(event.target.value)} minLength={1} maxLength={120} /></label>}</>}
      {mode === "voice" && <button className="purchase-confirm" type="button" disabled={submitting} onClick={listening ? finishDictation : voice}>{listening ? "Detener dictado" : "Volver a dictar"}</button>}
      {listening && <p role="status">Escuchando…</p>}{error && <p className="pantry-alert" role="alert">{error}</p>}<button className="purchase-confirm" type="button" disabled={!value.trim() || (needsBarcodeName && !barcodeName.trim()) || submitting} onClick={review}>{submitting ? "Preparando…" : "Revisar antes de guardar"}</button>
    </section>}
  </main>;
}
