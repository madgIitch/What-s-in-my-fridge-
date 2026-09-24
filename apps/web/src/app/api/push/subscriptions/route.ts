import { createHash } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/push/origin";
import { parseSubscriptionBody, parseUnsubscribeBody } from "@/lib/push/contracts";

const noStore = { "Cache-Control": "no-store" };
function fail(code: string, message: string, status: number, retryable = false) { return Response.json({ ok: false, data: null, error: { code, message, retryable } }, { status, headers: noStore }); }
function success(enabled: boolean) { return Response.json({ ok: true, data: { enabled }, error: null }, { headers: noStore }); }
function endpointHash(endpoint: string) { return createHash("sha256").update(endpoint).digest("hex"); }

async function authenticated() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function POST(request: Request) {
  if (process.env.PUSH_ENABLED === "false") return fail("PUSH_UNAVAILABLE", "Los avisos no están disponibles", 503, true);
  if (!isSameOrigin(request)) return fail("ORIGIN_REJECTED", "Origen no permitido", 403);
  let body: unknown; try { body = await request.json(); } catch { return fail("INVALID_SUBSCRIPTION", "Suscripción no válida", 400); }
  const subscription = parseSubscriptionBody(body);
  if (!subscription) return fail("INVALID_SUBSCRIPTION", "Suscripción no válida", 400);
  const { supabase, user } = await authenticated();
  if (!user) return fail("UNAUTHENTICATED", "Inicia sesión", 401);
  const { error } = await supabase.rpc("register_push_subscription" as never, { p_endpoint_hash: endpointHash(subscription.endpoint), p_endpoint: subscription.endpoint, p_p256dh: subscription.keys.p256dh, p_auth: subscription.keys.auth, p_expiration_time: subscription.expirationTime ? new Date(subscription.expirationTime).toISOString() : null } as never);
  return error ? fail("PUSH_UNAVAILABLE", "No se pudo guardar la suscripción", 503, true) : success(true);
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return fail("ORIGIN_REJECTED", "Origen no permitido", 403);
  let body: unknown; try { body = await request.json(); } catch { return fail("INVALID_SUBSCRIPTION", "Suscripción no válida", 400); }
  const subscription = parseUnsubscribeBody(body);
  if (!subscription) return fail("INVALID_SUBSCRIPTION", "Suscripción no válida", 400);
  const { supabase, user } = await authenticated();
  if (!user) return fail("UNAUTHENTICATED", "Inicia sesión", 401);
  const { error } = await supabase.rpc("revoke_push_subscription" as never, { p_endpoint_hash: endpointHash(subscription.endpoint) } as never);
  return error ? fail("PUSH_RETRYABLE", "No se pudo desactivar la suscripción", 503, true) : success(false);
}
