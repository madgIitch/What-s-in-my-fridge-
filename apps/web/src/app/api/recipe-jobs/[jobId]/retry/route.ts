import { productV3Enabled } from '@/app/(auth)/app/product-v3';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { jobError } from '@/lib/recipe-import/contracts';
import { enqueueRecipeJob } from '@/lib/recipe-import/queue';
import { sameOrigin, uuid } from '@/lib/cook/contracts';
import { type CookDb } from '@/lib/cook/server';
export const runtime = 'nodejs';
export const maxDuration = 30;
export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  if (!productV3Enabled()) return new Response(null, { status: 404 });
  const { jobId } = await params;
  if (!uuid(jobId) || !sameOrigin(request) || (await request.text()).length) return jobError('INVALID_REQUEST', 'La solicitud no es válida');
  const s = await createServerSupabaseClient(); const { data: { user } } = await s.auth.getUser();
  if (!user) return jobError('AUTH_REQUIRED', 'Inicia sesión', 401);
  const db = s as unknown as CookDb;
  const { data, error } = await db.rpc('retry_recipe_import_v1', { p_id: jobId });
  if (error || !data) return jobError('JOB_READ_FAILED', 'No pudimos recuperar la importación', 503, true);
  const result = data as { error?: string; jobId: string; generation: number; replay: boolean };
  if (result.error) return jobError(result.error, result.error === 'JOB_NOT_FOUND' ? 'No se encontró la importación' : 'Esta fuente ya no se puede reintentar. Pega la receta como texto.', result.error === 'JOB_NOT_FOUND' ? 404 : 409);
  try { await enqueueRecipeJob(jobId, result.generation); }
  catch { await db.rpc('mark_recipe_job_enqueue_failed', { p_job_id: jobId }); return jobError('QUEUE_UNAVAILABLE', 'No pudimos encolar la importación. Reintenta.', 503, true); }
  const { data: { user: current } } = await s.auth.getUser();
  if (!current || current.id !== user.id) return jobError('AUTH_REQUIRED', 'La sesión ha cambiado', 401);
  return Response.json({ contract: 'recipe-import-job-v1', jobId, state: 'queued', replay: result.replay }, { status: 202, headers: { 'Cache-Control': 'private, no-store' } });
}
