import { InventoryApp } from "@/components/inventory-app";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import Link from "next/link";
import { productV3Enabled } from "./product-v3";

export default async function AppEntryPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (productV3Enabled()) return <main className="product-v3-home"><p className="product-v3-kicker">Hoy</p><h1>¿Qué cocinamos hoy?</h1><p className="product-v3-lead">Empieza por tu despensa. Neverita tendrá en cuenta lo que sabes y señalará lo que falta por comprobar.</p><div className="product-v3-actions"><Link href="/app/pantry">Ver despensa</Link><Link href="/app/recipes">Explorar recetas</Link></div></main>;
  return <InventoryApp userId={user!.id} />;
}
