import { create } from 'zustand';
import FoodItem from '../database/models/FoodItem';

/**
 * Inventory Store - Manages food inventory state
 * Equivalent to HomeVm + InventoryRepository from Android app
 *
 * Note: This store primarily holds reactive state.
 * Database operations are performed through hooks (useInventory)
 * to leverage WatermelonDB's reactive queries.
 */
interface InventoryStore {
  items: FoodItem[];
  loading: boolean;
  error: string | null;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  lastSyncTime: number | null;

  // Actions
  setItems: (items: FoodItem[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSyncStatus: (status: 'idle' | 'syncing' | 'success' | 'error') => void;
  setLastSyncTime: (time: number) => void;
  clearError: () => void;
}

export const useInventoryStore = create<InventoryStore>((set) => ({
  items: [],
  loading: false,
  error: null,
  syncStatus: 'idle',
  lastSyncTime: null,

  setItems: (items) => set({ items }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error, loading: false }),

  setSyncStatus: (status) => set({ syncStatus: status }),

  setLastSyncTime: (time) => set({ lastSyncTime: time }),

  clearError: () => set({ error: null }),
}));
