import { fail, ok } from "@/lib/billing/contracts";
import { applyEvent } from "@/lib/billing/service.server";
import { verifyWebhook } from "@/lib/billing/stripe.server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const raw = await request.text();
  const event = verifyWebhook(raw, request.headers.get("stripe-signature"));
  if (!event) return fail("INVALID_SIGNATURE", "Firma de webhook inválida", 400);
  try { const result = await applyEvent(event); return ok(result.result); }
  catch (error) { const code = error instanceof Error ? error.message : "BILLING_UNAVAILABLE"; if (code === "CUSTOMER_NOT_FOUND") return fail(code, "Customer no encontrado", 404); if (code === "CUSTOMER_AMBIGUOUS") return fail(code, "Mapping de customer ambiguo", 409); return fail("BILLING_UNAVAILABLE", "No se pudo procesar el evento", 503, true); }
}
