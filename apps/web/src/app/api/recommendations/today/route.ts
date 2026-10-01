import { productV3Enabled } from "@/app/(auth)/app/product-v3";
import { recommendationError } from "@/lib/recommendations/contracts";
import { calculateToday } from "@/lib/recommendations/today.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function madridCivilDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function validCivilDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day;
}

export async function GET(request: Request) {
  if (!productV3Enabled()) return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const url = new URL(request.url);
  if ([...url.searchParams.keys()].some((key) => key !== "date") || url.searchParams.getAll("date").length > 1) return recommendationError("INVALID_REQUEST", "Solo se admite una fecha civil", 400);
  const date = url.searchParams.get("date") ?? madridCivilDate();
  if (!validCivilDate(date)) return recommendationError("INVALID_REQUEST", "La fecha no es válida", 400);
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return recommendationError("AUTH_REQUIRED", "Inicia sesión para ver Hoy", 401);
    const result = await calculateToday(supabase as unknown as Parameters<typeof calculateToday>[0], user.id, date);
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser || currentUser.id !== user.id) return recommendationError("AUTH_REQUIRED", "La sesión ha cambiado", 401);
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "CATALOG_NOT_READY") return recommendationError("CATALOG_NOT_READY", "El catálogo todavía no está disponible", 409, true);
    return recommendationError("TODAY_UNAVAILABLE", "No pudimos calcular Hoy", 503, true);
  }
}
