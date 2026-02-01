import { create } from 'zustand';
import { Q } from '@nozbe/watermelondb';
import { endOfMonth, startOfDay, startOfMonth } from 'date-fns';
import { collections, database } from '../database';
import MealEntry, { MealType } from '../database/models/MealEntry';
import { deleteMealEntryFromFirestore, startMealEntriesSync, syncMealEntryToFirestore } from '../services/firebase/firestore';
import { useAuthStore } from './useAuthStore';

interface MealStore {
  meals: MealEntry[];
  monthAnchor: Date;
  loading: boolean;
  error: string | null;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  lastSyncTime: number | null;

  initMonth: (monthDate: Date) => void;
  addMeal: (data: {
    mealType: MealType;
    mealDate: number;
    recipeId?: string;
    customName?: string;
    ingredientsConsumed: string[];
    notes?: string;
    caloriesEstimate?: number;
    consumedAt: number;
    userId?: string;
  }) => Promise<void>;
  updateMeal: (mealId: string, updates: Partial<Omit<MealEntry, 'id'>>) => Promise<void>;
  deleteMeal: (mealId: string) => Promise<void>;
  getMealsByDate: (date: Date) => MealEntry[];
  getTopIngredients: (limit?: number) => { ingredientId: string; count: number }[];
  startSync: (userId: string) => void;
  stopSync: () => void;
}

let monthSubscription: { unsubscribe: () => void } | null = null;
let syncUnsubscribe: (() => void) | null = null;

export const useMealStore = create<MealStore>((set, get) => ({
  meals: [],
  monthAnchor: new Date(),
  loading: false,
  error: null,
  syncStatus: 'idle',
  lastSyncTime: null,

  initMonth: (monthDate) => {
    const start = startOfMonth(monthDate).getTime();
    const end = endOfMonth(monthDate).getTime();

    set({ monthAnchor: monthDate, loading: true });

    if (monthSubscription) {
      monthSubscription.unsubscribe();
    }

    const mealCollection = (collections as { mealEntries?: typeof collections.mealEntries }).mealEntries;
    if (!mealCollection) {
      set({
        loading: false,
        error: 'Meal entries collection not initialized. Restart the app after migrations.',
      });
      return;
    }

    monthSubscription = mealCollection
      .query(Q.where('meal_date', Q.between(start, end)))
      .observe()
      .subscribe((entries) => {
        set({ meals: entries, loading: false });
      });
  },

  addMeal: async (data) => {
    const userId = data.userId || useAuthStore.getState().user?.uid || '';
    set({ loading: true });

    try {
      const mealCollection = (collections as { mealEntries?: typeof collections.mealEntries }).mealEntries;
      if (!mealCollection) {
        throw new Error('Meal entries collection not initialized. Restart the app after migrations.');
      }

      await database.write(async () => {
        const newEntry = await mealCollection.create((entry) => {
          entry.mealType = data.mealType;
          entry.mealDate = data.mealDate;
          entry.recipeId = data.recipeId;
          entry.customName = data.customName;
          entry.ingredientsConsumed = JSON.stringify(data.ingredientsConsumed);
          entry.notes = data.notes;
          entry.caloriesEstimate = data.caloriesEstimate;
          entry.userId = userId;
          entry.consumedAt = data.consumedAt;
        });

        await syncMealEntryToFirestore(newEntry);
      });

      set({ error: null, loading: false });
    } catch (error: any) {
      console.error('Error adding meal entry:', error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateMeal: async (mealId, updates) => {
    set({ loading: true });

    try {
      const mealCollection = (collections as { mealEntries?: typeof collections.mealEntries }).mealEntries;
      if (!mealCollection) {
        throw new Error('Meal entries collection not initialized. Restart the app after migrations.');
      }

      await database.write(async () => {
        const entry = await mealCollection.find(mealId);
        await entry.update(() => {
          if ((updates as any).mealType !== undefined) {
            entry.mealType = (updates as any).mealType;
          }
          if ((updates as any).mealDate !== undefined) {
            entry.mealDate = (updates as any).mealDate;
          }
          if ((updates as any).recipeId !== undefined) {
            entry.recipeId = (updates as any).recipeId;
          }
          if ((updates as any).customName !== undefined) {
            entry.customName = (updates as any).customName;
          }
          if ((updates as any).ingredientsConsumed !== undefined) {
            entry.ingredientsConsumed = (updates as any).ingredientsConsumed;
          }
          if ((updates as any).notes !== undefined) {
            entry.notes = (updates as any).notes;
          }
          if ((updates as any).caloriesEstimate !== undefined) {
            entry.caloriesEstimate = (updates as any).caloriesEstimate;
          }
          if ((updates as any).userId !== undefined) {
            entry.userId = (updates as any).userId;
          }
          if ((updates as any).consumedAt !== undefined) {
            entry.consumedAt = (updates as any).consumedAt;
          }
        });

        await syncMealEntryToFirestore(entry);
      });

      set({ error: null, loading: false });
    } catch (error: any) {
      console.error('Error updating meal entry:', error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  deleteMeal: async (mealId) => {
    set({ loading: true });

    try {
      const mealCollection = (collections as { mealEntries?: typeof collections.mealEntries }).mealEntries;
      if (!mealCollection) {
        throw new Error('Meal entries collection not initialized. Restart the app after migrations.');
      }

      await database.write(async () => {
        const entry = await mealCollection.find(mealId);
        await entry.destroyPermanently();
        await deleteMealEntryFromFirestore(mealId);
      });

      set({ error: null, loading: false });
    } catch (error: any) {
      console.error('Error deleting meal entry:', error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  getMealsByDate: (date) => {
    const target = startOfDay(date).getTime();
    return get().meals.filter((meal) => meal.mealDate === target);
  },

  getTopIngredients: (limit = 5) => {
    const counts: Record<string, number> = {};
    for (const meal of get().meals) {
      for (const id of meal.ingredientsConsumedArray) {
        counts[id] = (counts[id] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([ingredientId, count]) => ({ ingredientId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  },

  startSync: (userId) => {
    if (syncUnsubscribe) {
      syncUnsubscribe();
    }

    set({ syncStatus: 'syncing' });
    syncUnsubscribe = startMealEntriesSync(userId);
    set({ syncStatus: 'success', lastSyncTime: Date.now() });
  },

  stopSync: () => {
    if (syncUnsubscribe) {
      syncUnsubscribe();
      syncUnsubscribe = null;
    }
    set({ syncStatus: 'idle' });
  },
}));
