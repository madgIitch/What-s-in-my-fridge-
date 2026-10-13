import 'server-only';
import { redirect } from 'next/navigation';
import { ShopApp } from '@/components/shop/shop-app';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { productV3Enabled } from '../product-v3';

export default async function ShopPage() {
  if (!productV3Enabled()) redirect('/app/shopping-list');
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=session_expired&returnTo=%2Fapp%2Fshop');
  return <ShopApp key={user.id} userId={user.id} />;
}
