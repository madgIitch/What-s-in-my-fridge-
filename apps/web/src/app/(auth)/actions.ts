"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/supabase/auth";
import { safeReturnTo } from "@/lib/supabase/redirects";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function credentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email.includes("@") || password.length < 8) redirect("/login?error=invalid_fields");
  return { email, password };
}

export async function login(formData: FormData) {
  const returnTo = safeReturnTo(formData.get("returnTo"));
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword(credentials(formData));
  if (error || !data.user || data.user.app_metadata.disabled === true) {
    if (data.user) await supabase.auth.signOut();
    redirect(`/login?error=invalid_credentials&returnTo=${encodeURIComponent(returnTo)}`);
  }
  await ensureProfile(data.user.id, data.user.user_metadata.display_name as string | undefined);
  redirect(returnTo);
}

export async function signup(formData: FormData) {
  const { email, password } = credentials(formData);
  const displayName = String(formData.get("displayName") ?? "").trim().slice(0, 80);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName || null },
      emailRedirectTo: `${APP_URL}/auth/callback?next=/app`,
    },
  });
  if (error) redirect("/signup?status=check_email");
  if (data.user && data.session) await ensureProfile(data.user.id, displayName);
  redirect("/signup?status=check_email");
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email.includes("@")) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${APP_URL}/auth/callback?next=/reset-password`,
    });
  }
  redirect("/forgot-password?status=sent");
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) redirect("/reset-password?error=invalid_password");
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=session_expired");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/reset-password?error=update_failed");
  redirect("/login?status=password_updated");
}

export async function logout() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login?status=signed_out");
}
