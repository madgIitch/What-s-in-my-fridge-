import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { CookingSource } from '@/lib/cooking/v3-contracts';
import styles from './session.module.css';
export function StartCooking({ source }: { source: CookingSource }) { return <div className={styles.actions}><Link className={styles.primary} href={`/app/cook/session?kind=${source.kind}&id=${source.id}`}>Cocinar esta receta</Link></div>; }
export async function StartSavedCooking({ userId, savedId, recipeId }: { userId: string; savedId: string; recipeId: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(savedId)) return null;
  const db = await createServerSupabaseClient(); const { data } = await db.from('favorite_recipes').select('id').eq('id', savedId).eq('user_id', userId).eq('recipe_id', recipeId).is('deleted_at', null).maybeSingle();
  return data ? <aside className={styles.shell}><StartCooking source={{ kind: 'favorite', id: savedId }} /></aside> : null;
}
