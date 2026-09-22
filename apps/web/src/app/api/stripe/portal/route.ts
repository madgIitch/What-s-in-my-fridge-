import { createServerSupabaseClient } from "@/lib/supabase/server";
import { exactObject, fail, ok } from "@/lib/billing/contracts";
import { canonicalCustomer } from "@/lib/billing/service.server";
import { stripe } from "@/lib/billing/stripe.server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const body = await exactObject(request, ["returnTo"]); if (!body) return fail("VALIDATION_ERROR", "La solicitud no es válida", 400);
  if (body.returnTo !== "/app/pro") return fail("INVALID_REDIRECT", "La ruta de retorno no está permitida", 400);
  const supabase = await createServerSupabaseClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return fail("UNAUTHENTICATED", "La sesión ha caducado", 401);
  try { const customer = await canonicalCustomer(user.id, false); if (!customer.id) return fail(customer.code!, customer.code === "CUSTOMER_NOT_FOUND" ? "No hay un customer asociado" : "Hay varios customers asociados", customer.code === "CUSTOMER_NOT_FOUND" ? 404 : 409); const base = process.env.NEXT_PUBLIC_APP_URL; if (!base) throw new Error(); const session = await stripe.createPortal(customer.id, `${base}/app/pro`); return ok({ url: session.url as string }); }
  catch { return fail("STRIPE_UNAVAILABLE", "Stripe no está disponible temporalmente", 503, true); }
}
