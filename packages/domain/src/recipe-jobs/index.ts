export const RECIPE_JOB_CONTRACT = "recipe-import-job-v1" as const;
export const RECIPE_SCHEMA_VERSION = "recipe-v1" as const;

export const RECIPE_JOB_STATES = ["queued", "fetching", "transcribing", "extracting", "validating", "completed", "failed", "cancelled"] as const;
export type RecipeJobState = (typeof RECIPE_JOB_STATES)[number];
export type RecipeSourceType = "youtube" | "instagram" | "tiktok" | "blog" | "manual" | "file";

export interface RecipeProvenance {
  sourceType: RecipeSourceType;
  sourceUrl?: string;
  originalFilename?: string;
  extractionPath?: Array<"jsonld" | "html" | "description" | "caption" | "transcript" | "whisper" | "manual">;
}

export interface CreateRecipeImportJobInput {
  idempotencyKey: string;
  sourceType?: RecipeSourceType;
  sourceUrl?: string;
  text?: string;
  uploadObject?: string;
  originalFilename?: string;
}

export interface RecipeImportJob {
  id: string;
  state: RecipeJobState;
  sourceType: RecipeSourceType;
  sourceUrl: string | null;
  provenance: RecipeProvenance;
  result: import("../recipes/index").ImportedRecipe | null;
  errorCode: string | null;
  retryable: boolean;
  createdAt: string;
  updatedAt: string;
}

export function detectUrlType(raw: string): Exclude<RecipeSourceType, "manual" | "file"> {
  const url = new URL(raw);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "youtu.be" || host.endsWith("youtube.com")) return "youtube";
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram";
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
  return "blog";
}

export function inferSourceType(input: CreateRecipeImportJobInput): RecipeSourceType {
  if (input.uploadObject) return "file";
  if (input.sourceUrl) return detectUrlType(input.sourceUrl);
  return "manual";
}

export function isIdempotencyKey(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(value);
}
