import { ItemEditor } from "@/components/inventory/item-editor";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function NewItemPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <ItemEditor userId={user!.id} />;
}
