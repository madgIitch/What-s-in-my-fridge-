import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/supabase/auth";
import { safeReturnTo } from "@/lib/supabase/redirects";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnTo = safeReturnTo(url.searchParams.get("next"));
  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.app_metadata.disabled !== true) {
        await ensureProfile(user.id, user.user_metadata.display_name as string | undefined);
        return NextResponse.redirect(new URL(returnTo, url.origin));
      }
      await supabase.auth.signOut();
    }
  }
  return NextResponse.redirect(new URL("/login?error=auth_callback", url.origin));
}
