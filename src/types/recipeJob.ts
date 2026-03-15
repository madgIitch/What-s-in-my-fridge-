export type RecipeJobStatus = "pending" | "transcribing" | "extracting" | "completed" | "failed";
export type RecipeJobSourceType = "youtube" | "instagram" | "tiktok" | "blog" | "manual";

export interface RecipeJobResult {
  ingredients: string[];
  steps: string[];
  rawText: string;
  recipeTitle?: string;
}

export interface RecipeJob {
  jobId: string;
  url: string;
  status: RecipeJobStatus;
  sourceType: RecipeJobSourceType;
  createdAt: number;
  updatedAt: number;
  result?: RecipeJobResult;
  error?: string;
}
