import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fail, ok } from "@/lib/billing/contracts";
import { entitlementFor } from "@/lib/billing/service.server";
export const runtime = "nodejs";
export async function GET() { const supabase = await createServerSupabaseClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return fail("UNAUTHENTICATED", "La sesión ha caducado", 401); try { return ok(await entitlementFor(user.id)); } catch { return fail("BILLING_UNAVAILABLE", "No se pudo consultar tu plan", 503, true); } }
