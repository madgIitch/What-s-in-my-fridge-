import type { AvailabilityIngredient, RecipeRef } from '../../../../../packages/domain/src/recipes/availability';
import type { AvailabilityState } from '../../../../../packages/domain/src/recommendations/today';

export type { RecipeRef };
export type CookAvailability = {
  contract: 'recipe-availability-v1'; recipeRef: RecipeRef; recipeVersion: string; snapshotKey: string;
  computedAt: string; expiresAt: string; title: string; steps: string[]; sourceUrl: string | null;
  availability: AvailabilityState; haveCount: number; totalCount: number; missingCount: number; unknownCount: number;
  quantityToCheck: boolean; ingredients: AvailabilityIngredient[]; reviewRequired: boolean;
};
export type LibraryItem = { recipeRef: RecipeRef; title: string; href: string; state: string; errorCode?: string; retryable?: boolean; saved?: boolean; reviewRequired?: boolean; availability?: CookAvailability };
export type CookLibrary = { contract: 'cook-library-v1'; items: LibraryItem[]; nextCursor: string | null; catalogMissing: boolean; computedAt: string };
export const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function recipeRef(v: unknown): v is RecipeRef {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const r = v as Record<string, unknown>;
  return Object.keys(r).length === 2 && ['catalog', 'import'].includes(String(r.kind)) && uuid(r.id);
}
export function mutationBody(v: unknown, operation: 'shopping' | 'save'): v is { recipeRef: RecipeRef; snapshotKey: string; recipeVersion: string; clientMutationId: string } {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const b = v as Record<string, unknown>; const token = operation === 'shopping' ? 'snapshotKey' : 'recipeVersion';
  return Object.keys(b).length === 3 && Object.keys(b).every(k => ['recipeRef', token, 'clientMutationId'].includes(k)) && recipeRef(b.recipeRef) && uuid(b.clientMutationId) && (operation === 'shopping' ? uuid(b[token]) : typeof b[token] === 'string' && /^[a-f0-9]{64}$/.test(b[token] as string));
}
export const privateHeaders = { 'Cache-Control': 'private, no-store' };
export function cookError(code: string, status = 503) {
  const messages: Record<string, string> = { AUTH_REQUIRED: 'La sesión ha caducado. Inicia sesión.', INVALID_REQUEST: 'La solicitud no es válida.', CURSOR_INVALID: 'La biblioteca ha cambiado. Actualízala.', RECIPE_NOT_FOUND: 'La receta ya no está disponible.', RECIPE_INVALID: 'No pudimos leer esta receta. Pégala como texto para importarla de nuevo.', SNAPSHOT_CONFLICT: 'Tu despensa ha cambiado. Actualiza y revisa la compra.', RECIPE_CONFLICT: 'La receta ha cambiado. Actualízala antes de guardar.', MUTATION_CONFLICT: 'Este intento corresponde a otra operación.', COOK_UNAVAILABLE: 'No pudimos actualizar Cocinar. Vuelve a intentarlo.' };
  return Response.json({ contract: 'cook-error-v1', error: { code, message: messages[code] ?? messages.COOK_UNAVAILABLE, retryable: status === 503 || code === 'SNAPSHOT_CONFLICT' || code === 'CURSOR_INVALID' } }, { status, headers: privateHeaders });
}
export function sameOrigin(request: Request) { const url = new URL(request.url); return request.headers.get('origin') === `${url.protocol}//${request.headers.get('host') ?? url.host}`; }
