import { createServerSupabaseClient } from "@/lib/supabase/server";
import { jobError } from "@/lib/recipe-import/contracts";
import { validateImportedRecipe } from "@/lib/recipe-import/result";

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  if (process.env.RECIPE_IMPORT_REVIEW_ENABLED !== "true") return jobError("REVIEW_DISABLED", "La revisión aún no está disponible", 503);
  const { jobId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) return jobError("INVALID_REQUEST", "Importación no válida");
  const db = await createServerSupabaseClient();
  if (!(await db.auth.getUser()).data.user) return jobError("AUTH_REQUIRED", "Inicia sesión", 401);
  let body: { expectedVersion?: number; result?: unknown; restore?: boolean };
  try {
    const input = await request.text();
    if (input.length > 100_000) return jobError("INVALID_REQUEST", "La receta es demasiado grande");
    body = JSON.parse(input);
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !["expectedVersion", "result", "restore"].includes(key))) throw new Error();
  } catch { return jobError("INVALID_REQUEST", "Revisión no válida"); }
  if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion! < 0 || (body.restore !== undefined && typeof body.restore !== "boolean") || (!body.restore && !validateImportedRecipe(body.result))) return jobError("INVALID_REQUEST", "Comprueba los ingredientes y pasos");
  const { data, error } = await db.rpc("save_recipe_import_revision" as never, { p_job_id: jobId, p_expected_version: body.expectedVersion, p_result: body.result ?? null, p_restore: body.restore ?? false } as never);
  if (error) return jobError("REVIEW_UNAVAILABLE", "No se pudo guardar la revisión", 503);
  const result = data as { error?: string; version?: number };
  if (result.error) return jobError(result.error, result.error === "VERSION_CONFLICT" ? "La receta cambió. Recarga antes de guardar." : "No se pudo guardar la revisión", result.error === "VERSION_CONFLICT" ? 409 : 400);
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
