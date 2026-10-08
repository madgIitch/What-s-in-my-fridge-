'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { recipeNeedsReview } from '@/lib/recipe-import/result';
import { useCookResource } from '@/lib/cook/use-resource';
import { importFailureMessage } from '@/components/cook/import-recovery';
import styles from './recipe-import.module.css';

type Job = { id: string; state: string; source_type: string; result?: { title?: string }; error_code?: string; retryable?: boolean };
export function RecipeImport({ initialUrl = '', initialText = '', initialMode, userId }: { initialUrl?: string; initialText?: string; initialMode?: string; userId: string }) {
  const [mode, setMode] = useState(initialMode ?? (initialText && !initialUrl ? 'text' : 'url')); const [url, setUrl] = useState(initialUrl); const [text, setText] = useState(initialText); const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const submitting = useRef(false);
  const attempt = useRef<{ key: string; fingerprint: string; uploadObject?: string } | null>(null);
  const resource = useCookResource<{ jobs: Job[] }>('/api/recipe-jobs', userId);
  const refresh = resource.load;
  useEffect(() => { const interval = setInterval(() => { if (navigator.onLine) void refresh(); }, 5000); return () => clearInterval(interval); }, [refresh]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (submitting.current || !navigator.onLine || resource.status === 'expired') return;
    submitting.current = true; setBusy(true); setMessage('Guardando y encolando…');
    const fingerprint = JSON.stringify({ mode, url, text, file: file ? [file.name, file.size, file.lastModified] : null });
    const current = attempt.current?.fingerprint === fingerprint ? attempt.current : { key: crypto.randomUUID(), fingerprint }; attempt.current = current;
    try {
      let content: Record<string, string>;
      if (mode === 'file') {
        if (!file) throw new Error('FILE_REQUIRED');
        if (!current.uploadObject) {
          const signed = await resource.request('/api/recipe-jobs/upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }) });
          if (!signed.response.ok) { setMessage(signed.body.error?.message ?? 'No pudimos preparar la subida.'); return; }
          const uploaded = await fetch(signed.body.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
          if (!uploaded.ok) throw new Error('UPLOAD_FAILED'); current.uploadObject = signed.body.object;
        }
        content = { uploadObject: current.uploadObject!, originalFilename: file.name };
      } else content = mode === 'url' ? { sourceUrl: url } : { text };
      const result = await resource.request('/api/recipe-jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idempotencyKey: current.key, ...content }) });
      setMessage(result.response.ok ? 'Importación en curso. Puedes cerrar esta pantalla.' : result.body.error?.message ?? 'No se pudo importar.');
      if (result.response.ok) attempt.current = null;
      await resource.load();
    } catch (error) { if ((error as Error).name !== 'AbortError') setMessage('No se ha confirmado el envío. Reintenta para recuperar el mismo intento.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  const jobs = resource.data?.jobs ?? [];
  if (resource.status === 'expired') return <main className={styles.shell}><p>La sesión ha caducado.</p><Link href='/login'>Iniciar sesión</Link></main>;
  return <main className={styles.shell}><Link className={styles.openRecipe} href='/app/cook?view=imported'>← Cocinar · Importaciones</Link><p className={styles.eyebrow}>RECETAS · IMPORTAR</p><h1>Trae una receta</h1><p>Desde YouTube, Instagram, TikTok o un blog. También puedes pegar la receta como texto.</p>
    <div className={styles.tabs}>{[['url', 'Enlace'], ['text', 'Texto'], ['file', 'Archivo']].map(([id, name]) => <button key={id} type='button' disabled={busy} aria-pressed={mode === id} onClick={() => setMode(id)}>{name}</button>)}</div>
    <form onSubmit={submit}>{mode === 'url' ? <label>Enlace<input type='url' required value={url} onChange={e => setUrl(e.target.value)} placeholder='https://…' /></label> : mode === 'text' ? <label>Receta<textarea required minLength={20} value={text} onChange={e => setText(e.target.value)} rows={8} /></label> : <label>Audio o vídeo<input type='file' required accept='video/mp4,video/webm,audio/mpeg,audio/mp4,audio/webm' onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>}<button className={styles.primary} disabled={busy || !resource.online}>{busy ? 'Enviando…' : 'Importar receta'}</button></form>
    <p role='status' aria-live='polite'>{resource.status === 'offline' ? 'Resultado anterior · Sin conexión. Conecta para importar.' : message || resource.message}</p>
    {resource.status === 'error' && <button className={styles.primary} onClick={() => void resource.load()}>Actualizar importaciones</button>}
    <section><h2>Importaciones recientes</h2>{jobs.length === 0 ? <p>Aún no has importado ninguna receta.</p> : <ul>{jobs.map(job => <li key={job.id}><div><strong>{job.result?.title ?? `Receta de ${job.source_type}`}</strong>{job.state === 'failed' && <p>{importFailureMessage(job.error_code)}</p>}<Link className={styles.openRecipe} href={`/app/recipes/import/${job.id}`}>{job.state === 'completed' ? recipeNeedsReview(job.result) ? 'Lista para revisar →' : 'Ver receta →' : job.state === 'failed' ? 'Recuperar importación →' : 'Ver progreso →'}</Link></div>{job.state !== 'completed' && job.state !== 'failed' && <span>Procesando</span>}</li>)}</ul>}</section>
  </main>;
}
