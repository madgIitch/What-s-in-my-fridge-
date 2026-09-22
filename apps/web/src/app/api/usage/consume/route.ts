/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { exactObject, fail, FEATURES, ok } from "@/lib/billing/contracts";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const body = await exactObject(request, ["feature", "idempotencyKey"]);
  if (!body || typeof body.feature !== "string" || !FEATURES.includes(body.feature as never) || typeof body.idempotencyKey !== "string" || body.idempotencyKey.length < 1 || body.idempotencyKey.length > 200) return fail("VALIDATION_ERROR", "La solicitud no es válida", 400);
  const supabase = await createServerSupabaseClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return fail("UNAUTHENTICATED", "La sesión ha caducado", 401);
  const { data, error } = await (supabase as any).rpc("consume_usage", { p_feature: body.feature, p_idempotency_key: body.idempotencyKey });
  if (error) return fail("BILLING_UNAVAILABLE", "No se pudo reservar uso", 503, true);
  const result = data as any; if (!result.allowed) return fail("QUOTA_EXCEEDED", "Has alcanzado el límite mensual de tu plan", 429);
  return ok(result);
}
