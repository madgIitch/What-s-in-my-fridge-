import { productV3Enabled } from "@/app/(auth)/app/product-v3";
import { isUuid, shoppingError } from "@/lib/recommendations/contracts";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function validBody(value: unknown): value is { recipeId: string; snapshotKey: string; clientMutationId: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  return Object.keys(body).length === 3 && Object.keys(body).every((key) => ["recipeId", "snapshotKey", "clientMutationId"].includes(key))
    && isUuid(body.recipeId) && isUuid(body.snapshotKey) && isUuid(body.clientMutationId);
}

export async function POST(request: Request) {
  if (!productV3Enabled()) return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return shoppingError("AUTH_REQUIRED", "Inicia sesión para cambiar la compra", 401);
    let body: unknown;
    try { body = await request.json(); } catch { return shoppingError("INVALID_REQUEST", "La solicitud no es válida", 400); }
    if (!validBody(body)) return shoppingError("INVALID_REQUEST", "Solo se admiten receta, snapshot y mutation ID", 400);
    const db = supabase as unknown as { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> };
    const { data, error } = await db.rpc("apply_today_shopping_v1", {
      p_recipe_id: body.recipeId, p_snapshot_key: body.snapshotKey, p_client_mutation_id: body.clientMutationId,
    });
    if (error) return shoppingError("SHOPPING_UNAVAILABLE", "No pudimos actualizar la compra", 503, true);
    const result = data as unknown as { status: string; code: string; itemIds?: string[] };
    if (result.code === "SNAPSHOT_CONFLICT") return shoppingError("SNAPSHOT_CONFLICT", "Tu despensa ha cambiado. Actualiza Hoy antes de continuar.", 409, true);
    if (result.code === "MUTATION_CONFLICT") return shoppingError("MUTATION_CONFLICT", "Este intento ya corresponde a otra compra", 409);
    if (result.code === "RECIPE_NOT_FOUND") return shoppingError("RECIPE_NOT_FOUND", "La receta ya no está disponible", 404);
    if (result.code === "INVALID_REQUEST") return shoppingError("INVALID_REQUEST", "La solicitud no es válida", 400);
    if (result.code === "AUTH_REQUIRED") return shoppingError("AUTH_REQUIRED", "Inicia sesión para cambiar la compra", 401);
    if (result.status !== "applied") return shoppingError("SHOPPING_UNAVAILABLE", "No pudimos actualizar la compra", 503, true);
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser || currentUser.id !== user.id) return shoppingError("AUTH_REQUIRED", "La sesión ha cambiado", 401);
    return Response.json({ status: "applied", itemIds: result.itemIds ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return shoppingError("SHOPPING_UNAVAILABLE", "No pudimos actualizar la compra", 503, true);
  }
}
