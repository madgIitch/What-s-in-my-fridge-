"use client";
import { useCallback, useEffect, useState } from "react";
import styles from "./recipe-import.module.css";

type Job = { id: string; state: string; source_type: string; result?: { title?: string }; error_code?: string; retryable?: boolean };
export function RecipeImport({ initialUrl = "", initialText = "" }: { initialUrl?: string; initialText?: string }) {
  const [mode, setMode] = useState(initialText && !initialUrl ? "text" : "url"); const [url, setUrl] = useState(initialUrl); const [text, setText] = useState(initialText);
  const [file, setFile] = useState<File | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const refresh = useCallback(async () => { const response = await fetch("/api/recipe-jobs", { cache: "no-store" }); if (response.ok) setJobs((await response.json()).jobs ?? []); }, []);
  useEffect(() => { const initial = window.setTimeout(refresh, 0); const timer = window.setInterval(refresh, 5000); return () => { clearTimeout(initial); clearInterval(timer); }; }, [refresh]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("Guardando y encolando…");
    let content: { sourceUrl?: string; text?: string; uploadObject?: string; originalFilename?: string } = mode === "url" ? { sourceUrl: url } : { text };
    const stable = crypto.randomUUID();
    try { if (mode === "file") { if (!file) throw new Error("FILE_REQUIRED"); const signed = await fetch("/api/recipe-jobs/upload-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }) }); const target = await signed.json(); if (!signed.ok) throw new Error(target.error?.message ?? "UPLOAD_FAILED"); const uploaded = await fetch(target.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file }); if (!uploaded.ok) throw new Error("UPLOAD_FAILED"); content = { uploadObject: target.object, originalFilename: file.name }; } const response = await fetch("/api/recipe-jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idempotencyKey: stable, ...content }) }); const result = await response.json(); setMessage(response.ok ? "Importación en curso. Puedes cerrar esta pantalla." : result.error?.message ?? "No se pudo importar"); await refresh(); }
    catch { setMessage("Sin conexión. Vuelve a intentarlo."); } finally { setBusy(false); }
  }
  return <main className={styles.shell}><p className={styles.eyebrow}>RECETAS · IMPORTAR</p><h1>Trae una receta de cualquier sitio</h1><p>Pega un enlace de YouTube, Instagram, TikTok o un blog. También puedes escribir la receta.</p>
    <div className={styles.tabs}><button type="button" aria-pressed={mode === "url"} onClick={() => setMode("url")}>Pegar enlace</button><button type="button" aria-pressed={mode === "text"} onClick={() => setMode("text")}>Texto manual</button><button type="button" aria-pressed={mode === "file"} onClick={() => setMode("file")}>Archivo</button></div>
    <form onSubmit={submit}>{mode === "url" ? <label>Enlace<input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></label> : mode === "text" ? <label>Receta<textarea required minLength={20} value={text} onChange={(e) => setText(e.target.value)} rows={8} /></label> : <label>Audio o vídeo<input type="file" required accept="video/mp4,video/webm,audio/mpeg,audio/mp4,audio/webm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>}<button className={styles.primary} disabled={busy}>{busy ? "Enviando…" : "Importar receta"}</button></form>
    <p role="status" aria-live="polite">{message}</p><section><h2>Importaciones recientes</h2>{jobs.length === 0 ? <p>Aún no has importado ninguna receta.</p> : <ul>{jobs.map((job) => <li key={job.id}><strong>{job.result?.title ?? job.source_type}</strong><span>{job.state === "completed" ? "Lista" : job.state === "failed" ? `Falló (${job.error_code ?? "error"})` : "Procesando"}</span></li>)}</ul>}</section>
  </main>;
}
