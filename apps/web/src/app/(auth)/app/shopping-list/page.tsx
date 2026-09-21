import { redirect } from "next/navigation";
import { ShoppingListApp } from "@/components/shopping-list/shopping-list-app";
import { createServerSupabaseClient } from "@/lib/supabase/server";
export default async function ShoppingListPage(){const s=await createServerSupabaseClient();const {data:{user}}=await s.auth.getUser();if(!user)redirect("/login?error=session_expired");return <ShoppingListApp userId={user.id}/>}

