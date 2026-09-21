export interface SnapshotIngredient { ingredientKey: string | null; name: string; quantity: number | null; unit: string | null }
export interface RecipeSnapshot { version: 1; title: string; ingredients: SnapshotIngredient[]; instructions: string[] }
export interface FavoriteRecord { id: string; recipe_id: string; snapshot: RecipeSnapshot; snapshot_version: number; version: number; saved_at: string; deleted_at: string | null }
export interface MutationEnvelope<T> { client_mutation_id: string; status: "applied"|"duplicate"|"conflict"|"rejected"; code: string; result: T|null; conflicts: unknown[] }

