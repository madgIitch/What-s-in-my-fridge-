'use client';
import Link from 'next/link';
import { useCookResource } from '@/lib/cook/use-resource';
import type { CookLibrary, LibraryItem } from '@/lib/cook/contracts';
import { useEffect, useState } from 'react';
import styles from './cook.module.css';

function label(item: LibraryItem) {
  const a = item.availability;
  if (a?.availability === 'ready') return 'Tienes todo';
  if (a?.unknownCount) return 'Por comprobar';
  if (a?.quantityToCheck) return 'Comprueba cantidad';
  if (a?.missingCount) return `Faltan ${a.missingCount}`;
  return item.state === 'failed' ? 'No completada' : item.state === 'invalid' ? 'Por revisar' : item.state === 'completed' ? 'Importada' : item.state === 'saved' ? 'Guardada' : 'Procesando';
}
export function CookLibraryApp({ userId, view }: { userId: string; view: string }) {
  const resource = useCookResource<CookLibrary>(`/api/cook/library?view=${view}`, userId);
  const refresh = resource.load;
  useEffect(() => { if (view !== 'imported') return; const timer = setInterval(() => { if (navigator.onLine) void refresh(); }, 5000); return () => clearInterval(timer); }, [refresh, view]);
  const [page, setPage] = useState<{ base: string; items: LibraryItem[]; next: string | null } | null>(null); const [paging, setPaging] = useState(false); const [pageMessage, setPageMessage] = useState('');
  const currentPage = page?.base === resource.data?.computedAt ? page : null;
  const items = [...(resource.data?.items ?? []), ...(currentPage?.items ?? [])];
  const next = currentPage ? currentPage.next : resource.data?.nextCursor;
  async function more() { if (paging || !next || !resource.data) return; const base = resource.data.computedAt; setPaging(true); try { const result = await resource.request(`/api/cook/library?view=${view}&cursor=${encodeURIComponent(next)}`); if (!result.response.ok) { setPageMessage(result.body.error.message); setPage(null); await resource.load(); return; } setPage(old => ({ base, items: [...(old?.base === base ? old.items : []), ...result.body.items], next: result.body.nextCursor })); } catch { setPageMessage('No pudimos cargar más recetas. Reintenta.'); } finally { setPaging(false); } }
  const groups = view === 'today' ? [
    { title: 'Puedes hacerlo ahora', items: items.filter(i => i.availability?.availability === 'ready') },
    { title: 'Te falta poco', items: items.filter(i => i.availability?.availability === 'missing_one' && !i.availability.unknownCount && !i.availability.quantityToCheck) },
    { title: 'Para revisar o completar', items: items.filter(i => i.availability?.availability !== 'ready' && !(i.availability?.availability === 'missing_one' && !i.availability.unknownCount && !i.availability.quantityToCheck)) },
  ] : [{ title: view === 'saved' ? 'Tus guardadas' : 'Tus importaciones', items }];
  return <main className={styles.shell}>
    <header className={styles.header}><h1>Cocinar</h1><Link className={styles.link} href='/app/recipes/import'>Traer receta</Link></header>
    <nav className={styles.tabs} aria-label='Biblioteca de recetas'>{[['today', 'Para hoy'], ['saved', 'Guardadas'], ['imported', 'Importadas']].map(([id, name]) => <Link key={id} href={`/app/cook?view=${id}`} aria-current={view === id ? 'page' : undefined}>{name}</Link>)}</nav>
    <p role='status'>{resource.status === 'loading' ? 'Consultando tus recetas…' : resource.status === 'offline' ? resource.data ? `Resultado anterior · Sin conexión · ${new Date(resource.data.computedAt).toLocaleString('es')}` : 'Sin conexión; aún no hay una biblioteca guardada.' : resource.message}</p>
    {resource.status === 'expired' ? <Link className={styles.link} href='/login?returnTo=%2Fapp%2Fcook'>Iniciar sesión</Link> : <>
      {resource.status === 'error' && <button className={styles.secondary} onClick={() => void resource.load()}>Reintentar</button>}
      {resource.data?.catalogMissing && view === 'today' && <p className={styles.notice}>El catálogo aún no está disponible. Tus importaciones siguen aquí.</p>}
      {resource.data && groups.map(group => <section key={group.title} className={styles.group}><h2>{group.title}</h2>{group.items.length ? <ul className={styles.list}>{group.items.map(item => <li className={styles.row} key={`${item.recipeRef.kind}:${item.recipeRef.id}`}><div><Link href={item.href}><strong>{item.title}</strong><small>{item.reviewRequired ? 'Comparación provisional · Revisa la receta' : item.availability?.quantityToCheck ? 'Comprueba las cantidades antes de cocinar' : item.state === 'failed' ? 'No pudimos completar esta importación. Abre para recuperarla.' : item.state === 'invalid' ? 'El resultado necesita revisión' : 'Ver receta e ingredientes'}</small></Link>{item.saved && <Link href='/app/calendar?new=1'>Abrir calendario</Link>}</div><span className={`${styles.badge} ${item.availability?.availability !== 'ready' ? styles.uncertain : ''}`}>{label(item)}</span></li>)}</ul> : <div className={styles.empty}>{view === 'saved' ? 'Guarda una receta y aparecerá aquí.' : view === 'imported' ? 'Trae tu primera receta por enlace, texto o archivo.' : 'Aún no hay recetas en este grupo.'}</div>}</section>)}
      {next && <button className={styles.secondary} disabled={paging || !resource.online} onClick={() => void more()}>{paging ? 'Cargando…' : 'Ver más recetas'}</button>}<p role='status'>{pageMessage}</p>
      {view === 'today' && <Link className={styles.link} href='/app/cook?view=saved'>Ver tus guardadas</Link>}
    </>}
  </main>;
}
