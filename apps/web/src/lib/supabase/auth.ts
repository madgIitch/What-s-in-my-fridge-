import "server-only";

import { createServerSupabaseClient } from "./server";

export async function ensureProfile(userId: string, displayName?: string | null) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("profiles").upsert(
    { user_id: userId, display_name: displayName?.trim() || null, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  if (error) throw new Error("profile_sync_failed");
}
