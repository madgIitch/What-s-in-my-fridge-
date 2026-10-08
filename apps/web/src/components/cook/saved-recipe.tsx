import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { uuid, type RecipeRef } from '@/lib/cook/contracts';
import { safeOriginalUrl } from '../../../../../packages/domain/src/recipes/availability';
import styles from './cook.module.css';
export async function SavedRecipe({ userId, savedId, recipeRef }: { userId: string; savedId: string; recipeRef: RecipeRef }) {
  if (!uuid(savedId)) return <p>Esta receta guardada no está disponible.</p>;
  const db = await createServerSupabaseClient();
  const { data } = await db.from('favorite_recipes').select('snapshot').eq('id', savedId).eq('user_id', userId).eq('recipe_id', recipeRef.kind === 'import' ? `import:${recipeRef.id}` : recipeRef.id).is('deleted_at', null).maybeSingle();
  if (!data) return <main className={styles.shell}><h1>Esta receta guardada ya no está disponible</h1><Link href='/app/cook?view=saved'>Volver a guardadas</Link></main>;
  const s = data.snapshot as unknown as { title: string; reviewRequired?: boolean; ingredients: { name: string; quantity: number | null; unit: string | null; originalAmount?: string }[]; instructions: string[]; sourceUrl?: string };
  const url = safeOriginalUrl(s.sourceUrl);
  return <main className={styles.shell}><Link className={styles.link} href='/app/cook?view=saved'>← Tus guardadas</Link><h1>{s.title}</h1><p className={styles.notice}>Tu versión guardada. Se conserva aunque la receta original cambie.</p>{s.reviewRequired && <p className={styles.notice}>Receta provisional. Revisa los ingredientes y cantidades con la fuente original.</p>}<h2>Ingredientes</h2><ul className={styles.ingredients}>{s.ingredients.map((i, n) => <li key={n}><span>{i.name}<small>{i.quantity === null ? i.originalAmount || 'Cantidad no indicada' : `${i.quantity} ${i.unit ?? ''}`}</small></span></li>)}</ul><h2>Preparación</h2><ol className={styles.steps}>{s.instructions.map((step, n) => <li key={n}>{step}</li>)}</ol><div className={styles.actions}><Link className={styles.primary} href={recipeRef.kind === 'import' ? `/app/recipes/import/${recipeRef.id}` : `/app/recipes/${recipeRef.id}`}>Comparar la versión actual con tu despensa</Link><Link className={styles.secondary} href='/app/calendar?new=1'>Abrir calendario</Link>{url && <a className={styles.link} href={url} target='_blank' rel='noopener noreferrer'>Ver receta original ↗</a>}</div></main>;
}
