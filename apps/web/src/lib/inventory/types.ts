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
  rawName?: string | null;
  rawText?: string | null;
  foodConceptId?: string | null;
  stockMode?: "presence" | "qualitative" | "exact";
  stockState?: "present" | "absent" | "plenty" | "some" | "low" | "empty" | null;
  quantityPrecision?: "unknown" | "exact";
  quantityExact?: number | null;
  quantityUnit?: string | null;
  acquiredOn?: string | null;
  acquiredOnSource?: "receipt" | "user" | "retailer" | null;
  freshnessPrecision?: "unknown" | "estimated" | "exact";
  freshnessEstimatedDays?: number | null;
  expiryDateExact?: string | null;
  location?: "fridge" | "pantry" | "freezer" | null;
  locationConfirmed?: boolean;
  normalizationStatus?: "unknown" | "proposed" | "confirmed";
  receiptDraftId?: string | null;
  receiptLineId?: string | null;
}

export interface ServerInventoryItem {
  id: string;
  user_id: string;
  name: string;
  normalized_name: string | null;
  expiry_date: string | null;
  category: string | null;
  quantity: number;
  notes: string | null;
  unit: string;
  added_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  version: number;
  raw_name?: string | null; raw_text?: string | null; food_concept_id?: string | null;
  stock_mode?: "presence" | "qualitative" | "exact"; stock_state?: LocalInventoryItem["stockState"];
  quantity_precision?: "unknown" | "exact"; quantity_exact?: number | null; quantity_unit?: string | null;
  acquired_on?: string | null; acquired_on_source?: LocalInventoryItem["acquiredOnSource"];
  freshness_precision?: "unknown" | "estimated" | "exact"; freshness_estimated_days?: number | null; expiry_date_exact?: string | null;
  location?: LocalInventoryItem["location"]; location_confirmed?: boolean; normalization_status?: LocalInventoryItem["normalizationStatus"];
  receipt_draft_id?: string | null; receipt_line_id?: string | null;
}

export interface PantryPatch {
  name?: string; notes?: string | null; location?: "fridge" | "pantry" | "freezer" | null;
  stockMode?: "qualitative" | "exact"; stockState?: "plenty" | "some" | "low" | "empty";
  quantityExact?: number | null; quantityUnit?: string | null; expiryDateExact?: string | null; foodConceptId?: string | null;
}

export interface OutboxMutation {
  clientMutationId: string;
  userId: string;
  operation: MutationOperation;
  domain: "legacy" | "pantry" | "restore";
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
