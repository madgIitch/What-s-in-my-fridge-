import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createRecipeImportJob } from "@/lib/recipe-import/create-job";
import { createUploadObject, signGcsUpload } from "@/lib/recipe-import/gcs";

function importLocation(params: URLSearchParams) {
  const shared = [params.get("url"), params.get("text")].filter(Boolean).join(" ");
  const match = shared.match(/https?:\/\/[^\s]+/i);
  const target = new URL("/app/recipes/import", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  if (match) target.searchParams.set("url", match[0].slice(0, 2048));
  else if (shared) target.searchParams.set("text", shared.slice(0, 10_000));
  target.searchParams.set("shared", "1");
  return `${target.pathname}${target.search}`;
}

export async function GET(request: Request) { redirect(importLocation(new URL(request.url).searchParams)); }
export async function POST(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  if (!type.includes("form")) return new Response("Unsupported share payload", { status: 415 });
  const form = await request.formData(); const media = form.get("media");
  if (media instanceof File && media.size > 0) {
    const allowed = new Set(["video/mp4", "video/webm", "audio/mpeg", "audio/mp4", "audio/webm"]);
    if (!allowed.has(media.type) || media.size > 100 * 1024 * 1024) redirect("/app/recipes/import?shared=1&error=invalid_file");
    const supabase = await createServerSupabaseClient(); const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?error=session_expired");
    try {
      const signed = signGcsUpload(createUploadObject(user.id, randomUUID(), media.name), media.type);
      const upload = await fetch(signed.uploadUrl, { method: "PUT", headers: { "Content-Type": media.type }, body: media });
      if (!upload.ok) throw new Error("UPLOAD_FAILED");
      const result = await createRecipeImportJob(supabase as never, { idempotencyKey: `share-${randomUUID()}`, uploadObject: signed.object, originalFilename: media.name }, "file");
      if (!("error" in result)) redirect(`/app/recipes/import?shared=1&job=${result.jobId}`);
    } catch { redirect("/app/recipes/import?shared=1&error=upload_failed"); }
  }
  const params = new URLSearchParams();
  for (const key of ["title", "text", "url"]) { const value = form.get(key); if (typeof value === "string") params.set(key, value); }
  redirect(importLocation(params));
}
