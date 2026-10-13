import "server-only";
import { redirect } from "next/navigation";
import { WeekApp } from "@/components/planning/week-app";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { productV3Enabled } from "../../product-v3";

export default async function WeekPage() {
  if (!productV3Enabled()) redirect("/app/calendar");
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=session_expired&returnTo=%2Fapp%2Fcook%2Fweek");
  return <WeekApp key={user.id} userId={user.id} />;
}
