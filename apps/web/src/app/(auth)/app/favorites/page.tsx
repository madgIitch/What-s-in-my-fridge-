import { redirect } from "next/navigation";
import { FavoritesApp } from "@/components/favorites/favorites-app";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { productV3Enabled } from "../product-v3";
import { legacyV3CollectionDestination } from "../legacy-v3-redirect";
export default async function FavoritesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { if (productV3Enabled()) redirect(legacyV3CollectionDestination("saved", await searchParams)); const s=await createServerSupabaseClient();const {data:{user}}=await s.auth.getUser();if(!user)redirect("/login?error=session_expired");return <FavoritesApp userId={user.id}/>}
