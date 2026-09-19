export type SyncState = "synced" | "pending" | "conflict" | "error";
export type MutationOperation = "create" | "update" | "delete";

export interface LocalInventoryItem {
  key: string;
  id: string;
  userId: string;
  name: string;
  normalizedName: string | null;
  expiryDate: string;
  category: string | null;
  quantity: number;
  notes: string | null;
  unit: string;
  addedAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  version: number;
  syncState: SyncState;
  remoteSnapshot: ServerInventoryItem | null;
}

export interface ServerInventoryItem {
  id: string;
  user_id: string;
  name: string;
  normalized_name: string | null;
  expiry_date: string;
  category: string | null;
  quantity: number;
  notes: string | null;
  unit: string;
  added_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  version: number;
}

export interface OutboxMutation {
  clientMutationId: string;
  userId: string;
  operation: MutationOperation;
  itemId: string;
  payload: Record<string, unknown>;
  expectedVersion: number | null;
  state: "pending" | "processing" | "conflict" | "error";
  attempts: number;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
}

export interface InventoryDraft {
  name: string;
  expiryDate: string;
  category?: string;
  quantity: number;
  notes?: string;
  unit: string;
}

export interface MutationResult {
  client_mutation_id: string;
  status: "applied" | "duplicate" | "conflict" | "rejected";
  code: "OK" | "SYNC_CONFLICT" | "AUTH_REQUIRED" | "FORBIDDEN" | "VALIDATION_ERROR";
  item: ServerInventoryItem | null;
}
