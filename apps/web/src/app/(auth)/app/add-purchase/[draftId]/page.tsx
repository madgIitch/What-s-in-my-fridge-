import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PurchaseReview } from "@/components/purchase/purchase-review";
import { isUuid } from "@/lib/normalization/contracts";
import { productV3Enabled } from "../../product-v3";

export default async function PurchaseReviewPage({ params, searchParams }: { params: Promise<{ draftId: string }>; searchParams: Promise<{ pending?: string }> }) {
  if (!productV3Enabled()) redirect("/app/scan");
  const { draftId } = await params; if (!isUuid(draftId)) redirect("/app/add-purchase");
  const supabase = await createServerSupabaseClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=session_expired");
  const query = await searchParams;
  return <PurchaseReview draftId={draftId} pending={query.pending === "1"} />;
}
