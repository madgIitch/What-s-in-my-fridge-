import { notFound } from "next/navigation";
import { ItemEditor } from "@/components/inventory/item-editor";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <ItemEditor userId={user!.id} itemId={id} />;
}
