import { createServerSupabaseClient } from "@/lib/supabase/server";
import { jobError } from "@/lib/recipe-import/contracts";
import { enqueueRecipeJob } from "@/lib/recipe-import/queue";

export async function POST(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  if (process.env.RECIPE_IMPORT_REPROCESS_ENABLED !== "true") return jobError("REPROCESS_DISABLED", "La mejora de recetas aún no está disponible", 503);
  const { jobId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) return jobError("INVALID_REQUEST", "Importación no válida");
  const db = await createServerSupabaseClient();
  if (!(await db.auth.getUser()).data.user) return jobError("AUTH_REQUIRED", "Inicia sesión", 401);
  const { data, error } = await db.rpc("request_recipe_import_reprocess" as never, { p_job_id: jobId } as never);
  if (error || !data) return jobError("REPROCESS_UNAVAILABLE", "No se pudo preparar la revisión", 503);
  const result = data as { error?: string; jobId?: string; replay?: boolean };
  if (result.error || !result.jobId) return jobError(result.error ?? "REPROCESS_UNAVAILABLE", result.error === "SOURCE_EXPIRED" ? "El archivo temporal ya no está disponible." : "No se pudo preparar la revisión", result.error === "RATE_LIMITED" ? 429 : 400);
  // Replays may retry enqueue after a network failure; duplicate delivery is lease-safe.
  try { await enqueueRecipeJob(result.jobId); } catch { return jobError("QUEUE_UNAVAILABLE", "Puedes volver a intentarlo; no se consume otra importación", 503, true); }
  return Response.json(result, { status: 202, headers: { "Cache-Control": "no-store" } });
}
