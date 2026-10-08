import { uuid } from '@/lib/cook/contracts';
export { sameOrigin } from '@/lib/cook/contracts';
export type { CookingSource, CookingPlan, CookingLineV3, CookingChoice, CookingResult } from '../../../../../packages/domain/src/cooking/plan';
import type { CookingSource, CookingChoice } from '../../../../../packages/domain/src/cooking/plan';
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v: Record<string, unknown>, names: string[]) => Object.keys(v).length === names.length && names.every(n => n in v);
export function sourceRef(v: unknown): v is CookingSource { return object(v) && keys(v, ['kind', 'id']) && ['catalog', 'import', 'favorite'].includes(String(v.kind)) && uuid(v.id); }
export function choice(v: unknown): v is CookingChoice {
  if (!object(v) || typeof v.lineId !== 'string' || v.lineId.length > 100) return false;
  if (v.action === 'keep' || v.action === 'apply') return keys(v, ['lineId', 'action']);
  if (v.action === 'set_state') return keys(v, ['lineId', 'action', 'inventoryItemId', 'state']) && uuid(v.inventoryItemId) && ['plenty', 'low', 'empty'].includes(String(v.state));
  if (v.action === 'set_consumption') return keys(v, ['lineId', 'action', 'quantity', 'unit', ...(v.inventoryItemId === undefined ? [] : ['inventoryItemId'])]) && (v.inventoryItemId === undefined || uuid(v.inventoryItemId)) && typeof v.quantity === 'number' && Number.isFinite(v.quantity) && v.quantity >= 0 && ['g', 'ml', 'unit', 'pack'].includes(String(v.unit));
  return false;
}
export function confirmation(v: unknown): v is { planKey: string; clientMutationId: string; acknowledgeReview: boolean; choices: CookingChoice[] } {
  return object(v) && keys(v, ['planKey', 'clientMutationId', 'acknowledgeReview', 'choices']) && uuid(v.planKey) && uuid(v.clientMutationId) && typeof v.acknowledgeReview === 'boolean' && Array.isArray(v.choices) && v.choices.length <= 200 && v.choices.every(choice) && new Set(v.choices.map(c => c.lineId)).size === v.choices.length;
}
export function undoBody(v: unknown): v is { eventId: string; clientMutationId: string } { return object(v) && keys(v, ['eventId', 'clientMutationId']) && uuid(v.eventId) && uuid(v.clientMutationId); }
export const privateHeaders = { 'Cache-Control': 'private, no-store' };
export function cookingError(code: string) {
  const messages: Record<string, string> = { AUTH_REQUIRED: 'La sesión ha caducado. Inicia sesión.', INVALID_REQUEST: 'Revisa los cambios antes de confirmar.', SOURCE_NOT_FOUND: 'La receta ya no está disponible.', RECIPE_INVALID: 'Esta receta no tiene ingredientes y pasos válidos.', PLAN_EXPIRED: 'La comparación ha caducado. Actualízala y revisa los cambios.', RECIPE_CONFLICT: 'La receta ha cambiado. Actualiza la comparación.', PANTRY_CONFLICT: 'Tu despensa ha cambiado. Actualiza y revisa los cambios.', MUTATION_CONFLICT: 'Este intento corresponde a otra operación.', UNDO_CONFLICT: 'Tu despensa cambió después de cocinar. Deshacer ya no puede restaurarla.', UNDO_EXPIRED: 'Ha terminado el plazo para deshacer.', COOK_UNAVAILABLE: 'No pudimos actualizar la despensa. Vuelve a intentarlo.' };
  const status = code === 'AUTH_REQUIRED' ? 401 : code === 'INVALID_REQUEST' ? 400 : code === 'SOURCE_NOT_FOUND' ? 404 : code === 'RECIPE_INVALID' ? 422 : code.endsWith('CONFLICT') || code.endsWith('EXPIRED') ? 409 : 503;
  return Response.json({ contract: 'cooking-error-v1', error: { code, message: messages[code] ?? messages.COOK_UNAVAILABLE, retryable: status === 503 } }, { status, headers: privateHeaders });
}
