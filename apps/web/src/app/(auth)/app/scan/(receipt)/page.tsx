import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ReceiptScanner } from "@/components/receipt/receipt-scanner";
export default async function ReceiptScanPage(){const supabase=await createServerSupabaseClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login?error=session_expired");return <ReceiptScanner/>}
