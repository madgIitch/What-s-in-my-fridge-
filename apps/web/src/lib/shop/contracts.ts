import { uuid } from '@/lib/cook/contracts';
export { sameOrigin, uuid } from '@/lib/cook/contracts';
import type { ShopIntent, ShopItem } from '../../../../../packages/domain/src/shopping-list/shop';
export type { ShopIntent, ShopItem } from '../../../../../packages/domain/src/shopping-list/shop';

export type PendingReconcile = { draftId: string; confirmedAt: string; merchant: string | null; itemCount: number; afterSession: boolean };
export type ShopList = { contract: 'shopping-list-v1'; items: ShopItem[]; pendingReconcile: PendingReconcile[]; sessionId: string | null; serverTime: string };
export type ShopReconcileResult = {
  contract: 'shopping-reconcile-v1'; status: 'applied' | 'duplicate'; eventId: string; undoUntil: string;
  matched: { itemId: string }[]; partial: { itemId: string; remaining: number }[]; ambiguous: { itemId: string; reason: string }[]; unmatched: { itemId: string }[];
};

export const privateHeaders = { 'Cache-Control': 'private, no-store' };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const only = (v: Record<string, unknown>, names: string[]) => Object.keys(v).every(k => names.includes(k));
const MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: 'La sesión ha caducado. Inicia sesión.',
  INVALID_REQUEST: 'Revisa los datos e inténtalo de nuevo.',
  ITEM_NOT_FOUND: 'Ese elemento ya no está en tu lista.',
  DRAFT_NOT_FOUND: 'No encontramos ese ticket.',
  VERSION_CONFLICT: 'Tu lista ha cambiado en otro dispositivo. Revísala antes de continuar.',
  MUTATION_CONFLICT: 'Ese cambio ya se usó con otros datos. Inténtalo de nuevo.',
  UNDO_EXPIRED: 'Ya no se puede deshacer.',
  UNDO_CONFLICT: 'La lista cambió después; no se puede deshacer sin perder cambios.',
  SHOP_UNAVAILABLE: 'La lista no está disponible ahora. Reintenta en un momento.',
};
export function shopStatus(code: string) {
  return code === 'AUTH_REQUIRED' ? 401 : code === 'INVALID_REQUEST' ? 400 : code === 'ITEM_NOT_FOUND' || code === 'DRAFT_NOT_FOUND' ? 404
    : code === 'VERSION_CONFLICT' || code === 'MUTATION_CONFLICT' || code.startsWith('UNDO_') ? 409 : 503;
}
export function shopError(code: string) {
  const known = code in MESSAGES ? code : 'SHOP_UNAVAILABLE'; const status = shopStatus(known);
  return Response.json({ contract: 'shopping-error-v1', error: { code: known, message: MESSAGES[known], retryable: status === 503 } }, { status, headers: privateHeaders });
}

/** Strict, closed-shape validation: no userId, no source, no dates, no unknown keys. */
export function intentBody(v: unknown): v is ShopIntent {
  if (!object(v) || !uuid(v.clientMutationId) || typeof v.op !== 'string') return false;
  if (!only(v, ['clientMutationId', 'op', 'itemId', 'expectedVersion', 'name', 'quantity', 'unit'])) return false;
  if (v.expectedVersion !== undefined && !(Number.isInteger(v.expectedVersion) && (v.expectedVersion as number) >= 1)) return false;
  if (v.op === 'add_manual') {
    if (v.itemId !== undefined && !uuid(v.itemId)) return false;
    if (v.expectedVersion !== undefined) return false;
    if (typeof v.name !== 'string' || v.name.trim().length < 1 || v.name.trim().length > 120) return false;
    if (v.quantity !== undefined && v.quantity !== null && !(typeof v.quantity === 'number' && Number.isFinite(v.quantity) && v.quantity >= 0 && v.quantity <= 1_000_000)) return false;
    if (v.unit !== undefined && v.unit !== null && !(typeof v.unit === 'string' && v.unit.trim().length <= 20)) return false;
    return true;
  }
  if (!['check', 'uncheck', 'select', 'dismiss', 'remove', 'restore', 'mark_purchased'].includes(v.op)) return false;
  return uuid(v.itemId) && v.name === undefined && v.quantity === undefined && v.unit === undefined;
}
export function sessionBody(v: unknown): v is { clientMutationId: string } { return object(v) && Object.keys(v).length === 1 && uuid(v.clientMutationId); }
export function reconcileBody(v: unknown): v is { draftId: string; clientMutationId: string; mode: 'apply' | 'skip'; sessionId?: string } {
  return object(v) && only(v, ['draftId', 'clientMutationId', 'mode', 'sessionId']) && uuid(v.draftId) && uuid(v.clientMutationId)
    && (v.mode === 'apply' || v.mode === 'skip') && (v.sessionId === undefined || uuid(v.sessionId));
}
export function undoBody(v: unknown): v is { eventId: string; clientMutationId: string } {
  return object(v) && Object.keys(v).length === 2 && uuid(v.eventId) && uuid(v.clientMutationId);
}
