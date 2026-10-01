import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/normalization/contracts";
import { PantryItemEditor } from "@/components/pantry/pantry-item-editor";
import { productV3Enabled } from "../../product-v3";
export default async function PantryItemPage({ params }: { params: Promise<{ itemId: string }> }) { if (!productV3Enabled()) redirect("/app"); const { itemId } = await params; if (!isUuid(itemId)) redirect("/app/pantry"); const supabase = await createServerSupabaseClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login?error=session_expired"); return <PantryItemEditor userId={user.id} itemId={itemId} />; }
