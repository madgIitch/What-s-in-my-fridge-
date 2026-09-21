import { randomUUID } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createUploadObject, signGcsUpload } from "@/lib/recipe-import/gcs";
import { jobError } from "@/lib/recipe-import/contracts";
const ALLOWED = new Set(["video/mp4", "video/webm", "audio/mpeg", "audio/mp4", "audio/webm"]); const MAX = 100 * 1024 * 1024;
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jobError("AUTH_REQUIRED", "Inicia sesión", 401);
  if (process.env.RECIPE_IMPORT_FILE_ENABLED === "false") return jobError("SOURCE_DISABLED", "La importación de archivos está desactivada", 503);
  let body: unknown; try { body = await request.json(); } catch { return jobError("INVALID_REQUEST", "Archivo no válido"); }
  const value = body as { filename?: unknown; contentType?: unknown; size?: unknown };
  if (typeof value?.filename !== "string" || typeof value.contentType !== "string" || !ALLOWED.has(value.contentType) || typeof value.size !== "number" || value.size < 1 || value.size > MAX) return jobError("INVALID_FILE", "Usa audio o vídeo de hasta 100 MB");
  try { return Response.json(signGcsUpload(createUploadObject(user.id, randomUUID(), value.filename), value.contentType), { headers: { "Cache-Control": "no-store" } }); }
  catch { return jobError("UPLOAD_UNAVAILABLE", "No se pudo preparar la subida", 503, true); }
}
