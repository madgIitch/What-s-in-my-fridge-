export const FAVORITE_SNAPSHOT_VERSION = 1 as const;

export interface SnapshotIngredient {
  ingredientKey: string | null;
  name: string;
  quantity: number | null;
  unit: string | null;
}

export interface RecipeSnapshot {
  version: typeof FAVORITE_SNAPSHOT_VERSION;
  title: string;
  ingredients: SnapshotIngredient[];
  instructions: string[];
}

export function validateRecipeSnapshot(value: unknown): RecipeSnapshot {
  if (!value || typeof value !== "object") throw new Error("INVALID_SNAPSHOT");
  const snapshot = value as Partial<RecipeSnapshot>;
  if (snapshot.version !== FAVORITE_SNAPSHOT_VERSION || !snapshot.title?.trim()
    || !Array.isArray(snapshot.ingredients) || !Array.isArray(snapshot.instructions)) throw new Error("INVALID_SNAPSHOT");
  const ingredients = snapshot.ingredients.map((line) => {
    if (!line || typeof line !== "object" || !line.name?.trim()) throw new Error("INVALID_SNAPSHOT");
    if (line.quantity !== null && (!Number.isFinite(line.quantity) || line.quantity! < 0)) throw new Error("INVALID_SNAPSHOT");
    return { ingredientKey: line.ingredientKey?.trim() || null, name: line.name.trim(), quantity: line.quantity ?? null, unit: line.unit?.trim() || null };
  });
  return { version: FAVORITE_SNAPSHOT_VERSION, title: snapshot.title.trim(), ingredients, instructions: snapshot.instructions.map(String) };
}

