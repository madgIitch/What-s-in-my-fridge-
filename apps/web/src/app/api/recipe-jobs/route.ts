import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createRecipeImportJob } from "@/lib/recipe-import/create-job";
import { jobError, validateCreateInput } from "@/lib/recipe-import/contracts";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jobError("AUTH_REQUIRED", "Inicia sesión para importar una receta", 401);
  let body: unknown;
  try { body = await request.json(); } catch { return jobError("INVALID_REQUEST", "La solicitud no es válida"); }
  const parsed = validateCreateInput(body);
  if (!parsed) return jobError("INVALID_REQUEST", "Indica una URL, texto o archivo válido");
  const result = await createRecipeImportJob(supabase as never, parsed.input, parsed.sourceType);
  if ("error" in result) {
    const errorCode = result.error ?? "JOB_CREATE_FAILED";
    const status = errorCode === "IMPORT_QUOTA_EXHAUSTED" ? 429 : errorCode === "SOURCE_DISABLED" ? 503 : 502;
    return jobError(errorCode, errorCode === "IMPORT_QUOTA_EXHAUSTED" ? "Has usado tus 10 importaciones de este mes" : "No se pudo preparar la importación", status, errorCode === "QUEUE_UNAVAILABLE");
  }
  return Response.json({ contract: "recipe-import-job-v1", ...result }, { status: result.replay ? 200 : 202, headers: { "Cache-Control": "no-store", Location: `/api/recipe-jobs/${result.jobId}` } });
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jobError("AUTH_REQUIRED", "Inicia sesión", 401);
  const { data, error } = await supabase.from("recipe_import_jobs" as never).select("id,state,source_type,source_url,provenance,result,error_code,retryable,created_at,updated_at").order("created_at", { ascending: false }).limit(50);
  if (error) return jobError("JOB_READ_FAILED", "No se pudieron recuperar las importaciones", 500, true);
  return Response.json({ contract: "recipe-import-jobs-v1", jobs: data }, { headers: { "Cache-Control": "no-store" } });
}
