import { createServerSupabaseClient } from "@/lib/supabase/server";
import { jobError } from "@/lib/recipe-import/contracts";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!UUID.test(jobId)) return jobError("INVALID_REQUEST", "Job no válido");
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jobError("AUTH_REQUIRED", "Inicia sesión", 401);
  const { data, error } = await supabase.from("recipe_import_jobs" as never).select("id,state,source_type,source_url,provenance,result,error_code,retryable,attempts,created_at,updated_at").eq("id", jobId).maybeSingle();
  if (error || !data) return jobError("JOB_NOT_FOUND", "No se encontró la importación", 404);
  return Response.json({ contract: "recipe-import-job-v1", job: data }, { headers: { "Cache-Control": "no-store" } });
}
