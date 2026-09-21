import { redirect } from "next/navigation";
import { FavoritesApp } from "@/components/favorites/favorites-app";
import { createServerSupabaseClient } from "@/lib/supabase/server";
export default async function FavoritesPage(){const s=await createServerSupabaseClient();const {data:{user}}=await s.auth.getUser();if(!user)redirect("/login?error=session_expired");return <FavoritesApp userId={user.id}/>}

