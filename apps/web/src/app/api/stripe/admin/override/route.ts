/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { bearer, exactObject, fail, ok } from "@/lib/billing/contracts";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!bearer(request, process.env.BILLING_ADMIN_SECRET)) return fail("UNAUTHENTICATED", "Credenciales inválidas", 401);
  const body = await exactObject(request, ["userId", "value", "reason"]);
  if (!body || typeof body.userId !== "string" || !(typeof body.value === "boolean" || body.value === null) || typeof body.reason !== "string" || !body.reason.trim()) return fail("VALIDATION_ERROR", "La solicitud no es válida", 400);
  const { data, error } = await (createAdminSupabaseClient() as any).rpc("set_billing_override", { p_user_id: body.userId, p_value: body.value, p_reason: body.reason.trim(), p_actor: "billing-admin" });
  return error ? fail("BILLING_UNAVAILABLE", "No se pudo aplicar el override", 503, true) : ok(data);
}
