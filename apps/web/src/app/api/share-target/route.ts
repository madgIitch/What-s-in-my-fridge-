import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createRecipeImportJob } from "@/lib/recipe-import/create-job";
import { createUploadObject, signGcsUpload } from "@/lib/recipe-import/gcs";

function validatedSharedUrl(raw: string | null) {
  if (!raw) return null;
  try { const value = new URL(raw); if (!['http:', 'https:'].includes(value.protocol) || value.username || value.password) return null; value.hash = ''; return value.toString().slice(0, 2048); } catch { return null; }
}

function importLocation(params: URLSearchParams, unauthenticated = false) {
  const shared = [params.get("url"), params.get("text")].filter(Boolean).join(" ");
  const match = shared.match(/https?:\/\/[^\s]+/i);
  const target = new URL("/app/recipes/import", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  const url = validatedSharedUrl(match?.[0] ?? null);
  if (url) {
    const reference = new URL(url);
    if (unauthenticated) reference.search = "";
    target.searchParams.set("url", reference.toString());
  } else if (shared && !unauthenticated) target.searchParams.set("text", shared.slice(0, 10_000));
  target.searchParams.set("shared", "1");
  return `${target.pathname}${target.search}`;
}

async function authenticatedLocation(request: Request, params: URLSearchParams) {
  const supabase = await createServerSupabaseClient(); const { data: { user } } = await supabase.auth.getUser();
  if (user) return importLocation(params);
  const returnTo = importLocation(params, true);
  return `/login?error=session_expired&returnTo=${encodeURIComponent(returnTo)}`;
}

export async function GET(request: Request) {
  if (process.env.SHARE_TARGET_ENABLED === "false") return new Response("Share target disabled", { status: 404 });
  const params = new URL(request.url).searchParams; redirect(await authenticatedLocation(request, params));
}
export async function POST(request: Request) {
  if (process.env.SHARE_TARGET_ENABLED === "false") return new Response("Share target disabled", { status: 404 });
  const type = request.headers.get("content-type") ?? "";
  if (!type.includes("form")) return new Response("Unsupported share payload", { status: 415 });
  const form = await request.formData(); const media = form.get("media");
  if (media instanceof File && media.size > 0) {
    const allowed = new Set(["video/mp4", "video/webm", "audio/mpeg", "audio/mp4", "audio/webm"]);
    if (!allowed.has(media.type) || media.size > 100 * 1024 * 1024) redirect("/app/recipes/import?shared=1&error=invalid_file");
    const supabase = await createServerSupabaseClient(); const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?error=session_expired&returnTo=%2Fapp%2Frecipes%2Fimport%3Fshared%3D1");
    let jobId: string | null = null;
    try {
      const signed = signGcsUpload(createUploadObject(user.id, randomUUID(), media.name), media.type);
      const upload = await fetch(signed.uploadUrl, { method: "PUT", headers: { "Content-Type": media.type }, body: media });
      if (!upload.ok) throw new Error("UPLOAD_FAILED");
      const result = await createRecipeImportJob(supabase as never, { idempotencyKey: `share-${randomUUID()}`, uploadObject: signed.object, originalFilename: media.name }, "file");
      if (!("error" in result)) jobId = result.jobId;
    } catch { redirect("/app/recipes/import?shared=1&error=upload_failed"); }
    if (jobId) redirect(`/app/recipes/import?shared=1&job=${jobId}`);
    redirect("/app/recipes/import?shared=1&error=upload_failed");
  }
  const params = new URLSearchParams();
  for (const key of ["title", "text", "url"]) { const value = form.get(key); if (typeof value === "string") params.set(key, value); }
  redirect(await authenticatedLocation(request, params));
}
