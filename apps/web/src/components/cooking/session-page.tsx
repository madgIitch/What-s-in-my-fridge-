import { redirect } from 'next/navigation';
import { productV3Enabled } from '@/app/(auth)/app/product-v3';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { sourceRef } from '@/lib/cooking/v3-contracts';
import { CookingSession } from './session';
export async function CookingSessionPage({ searchParams }: { searchParams: Promise<{ kind?: string; id?: string }> }) {
  if (!productV3Enabled()) redirect('/app/recipes');
  const source = await searchParams;
  if (!sourceRef(source)) return <main><h1>Esta receta no está disponible</h1></main>;
  const db = await createServerSupabaseClient(); const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/login?error=session_expired');
  return <CookingSession key={`${user.id}:${source.kind}:${source.id}`} userId={user.id} source={source} />;
}
