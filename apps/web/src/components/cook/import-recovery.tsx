'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useCookResource } from '@/lib/cook/use-resource';
import styles from './cook.module.css';
export function importFailureMessage(code?: string | null) {
  if (code?.startsWith('WHISPER_')) return 'No pudimos leer el audio del vídeo. Puedes pegar la receta como texto.';
  if (code === 'YTDLP_AUTH_REQUIRED') return 'El enlace requiere iniciar sesión en la web original. Pega la receta como texto.';
  if (code === 'QUEUE_UNAVAILABLE') return 'No pudimos iniciar el procesamiento. Vuelve a intentarlo.';
  if (code === 'RECIPE_SCHEMA_INVALID') return 'No pudimos reconocer una receta completa. Pega ingredientes y preparación como texto.';
  return 'No pudimos completar esta importación. Puedes pegar la receta como texto o probar otro enlace.';
}
export function ImportRecovery({ jobId, errorCode, retryable, userId }: { jobId: string; errorCode?: string | null; retryable: boolean; userId: string }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const active = useRef(false); const router = useRouter();
  const resource = useCookResource(`/api/recipe-jobs/${jobId}`, userId);
  async function retry() {
    if (active.current) return; if (!navigator.onLine) { setMessage('Sin conexión. Conecta para reintentar.'); return; }
    if (resource.status === 'expired') return;
    active.current = true; setBusy(true);
    try { const { response, body } = await resource.request(`/api/recipe-jobs/${jobId}/retry`, { method: 'POST' }); setMessage(response.ok ? 'Importación en curso.' : body.error.message); if (response.ok) router.refresh(); }
    catch { setMessage('No pudimos reintentar. Tu importación conserva su cuota.'); } finally { active.current = false; setBusy(false); }
  }
  if (resource.status === 'expired') return <Link href='/login'>Iniciar sesión</Link>;
  return <section className={styles.notice}><p>{importFailureMessage(errorCode)}</p><div className={styles.actions}><Link className={styles.link} href='/app/recipes/import?mode=text'>Pegar la receta como texto</Link>{retryable && <button className={styles.secondary} disabled={busy || !resource.online} onClick={() => void retry()}>{busy ? 'Reintentando…' : 'Reintentar importación'}</button>}</div><p role='status'>{resource.status === 'offline' ? 'Sin conexión. Conecta para reintentar.' : message}</p></section>;
}
