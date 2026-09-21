import "server-only";
import { enqueueRecipeJob } from "./queue";
import type { CreateJobInput, SourceType } from "./contracts";

type RpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> };
type Claim = { action: "created" | "existing" | "reject"; jobId?: string; code?: string; state?: string };

export async function createRecipeImportJob(db: RpcClient, input: CreateJobInput, sourceType: SourceType) {
  const flags = process.env.RECIPE_IMPORT_ENABLED_SOURCES?.split(",").map((v) => v.trim()) ?? SOURCE_DEFAULT;
  if (!flags.includes(sourceType) || (sourceType === "file" && process.env.RECIPE_IMPORT_FILE_ENABLED === "false")) return { error: "SOURCE_DISABLED" } as const;
  const provenance = { sourceType, ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}), ...(input.originalFilename ? { originalFilename: input.originalFilename } : {}) };
  const result = await db.rpc("create_recipe_import_job", { p_idempotency_key: input.idempotencyKey, p_source_type: sourceType, p_source_url: input.sourceUrl ?? null, p_manual_text: input.text ?? null, p_upload_object: input.uploadObject ?? null, p_provenance: provenance });
  if (result.error || !result.data) return { error: "JOB_CREATE_FAILED" } as const;
  const claim = result.data as Claim;
  if (claim.action === "reject") return { error: claim.code ?? "JOB_CREATE_FAILED" } as const;
  if (!claim.jobId) return { error: "JOB_CREATE_FAILED" } as const;
  if (claim.action === "created") {
    try { await enqueueRecipeJob(claim.jobId); }
    catch { await db.rpc("mark_recipe_job_enqueue_failed", { p_job_id: claim.jobId }); return { error: "QUEUE_UNAVAILABLE", jobId: claim.jobId } as const; }
  }
  return { jobId: claim.jobId, state: claim.state ?? "queued", replay: claim.action === "existing" } as const;
}
const SOURCE_DEFAULT = ["youtube", "instagram", "tiktok", "blog", "manual", "file"];
