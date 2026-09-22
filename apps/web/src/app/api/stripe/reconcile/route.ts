import { bearer, exactObject, fail, ok } from "@/lib/billing/contracts";
import { reconcile } from "@/lib/billing/service.server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!bearer(request, process.env.STRIPE_RECONCILE_SECRET)) return fail("UNAUTHENTICATED", "Credenciales inválidas", 401);
  const body = await exactObject(request, ["stripeCustomerId"]); if (!body || typeof body.stripeCustomerId !== "string" || !body.stripeCustomerId) return fail("VALIDATION_ERROR", "La solicitud no es válida", 400);
  try { return ok(await reconcile(body.stripeCustomerId)); } catch (error) { const code = error instanceof Error ? error.message : "BILLING_UNAVAILABLE"; if (code === "CUSTOMER_NOT_FOUND") return fail(code, "Customer no encontrado", 404); if (code === "CUSTOMER_AMBIGUOUS") return fail(code, "Customer ambiguo", 409); return fail("BILLING_UNAVAILABLE", "No se pudo reconciliar", 503, true); }
}
