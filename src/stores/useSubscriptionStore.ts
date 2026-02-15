import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RevenueCatPackage } from '../services/revenuecat';

interface SubscriptionStore {
  initialized: boolean;
  loading: boolean;
  error: string | null;
  isPro: boolean;
  activeEntitlements: string[];
  packages: RevenueCatPackage[];

  monthlyRecipeCallsUsed: number;
  monthlyOcrScansUsed: number;
  monthlyUrlImportsUsed: number;
  lastRecipeResetMonth: string;
  lastOcrResetMonth: string;
  lastUrlImportResetMonth: string;

  setInitialized: (initialized: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setProStatus: (isPro: boolean) => void;
  setActiveEntitlements: (entitlements: string[]) => void;
  setPackages: (packages: RevenueCatPackage[]) => void;

  incrementRecipeCalls: () => void;
  incrementOcrScans: () => void;
  incrementUrlImports: () => void;
  resetMonthlyRecipeCalls: () => void;
  resetMonthlyOcrScans: () => void;
  resetMonthlyUrlImports: () => void;
  checkAndResetMonthlyCounters: () => void;
}

const currentMonth = () => new Date().toISOString().slice(0, 7);

export const useSubscriptionStore = create<SubscriptionStore>()(
  persist(
    (set, get) => ({
      initialized: false,
      loading: false,
      error: null,
      isPro: false,
      activeEntitlements: [],
      packages: [],

      monthlyRecipeCallsUsed: 0,
      monthlyOcrScansUsed: 0,
      monthlyUrlImportsUsed: 0,
      lastRecipeResetMonth: currentMonth(),
      lastOcrResetMonth: currentMonth(),
      lastUrlImportResetMonth: currentMonth(),

      setInitialized: (initialized) => set({ initialized }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      setProStatus: (isPro) => set({ isPro }),
      setActiveEntitlements: (activeEntitlements) => set({ activeEntitlements }),
      setPackages: (packages) => set({ packages }),

      incrementRecipeCalls: () => {
        get().checkAndResetMonthlyCounters();
        const state = get();
        set({ monthlyRecipeCallsUsed: state.monthlyRecipeCallsUsed + 1 });
      },

      incrementOcrScans: () => {
        get().checkAndResetMonthlyCounters();
        const state = get();
        set({ monthlyOcrScansUsed: state.monthlyOcrScansUsed + 1 });
      },

      incrementUrlImports: () => {
        get().checkAndResetMonthlyCounters();
        const state = get();
        set({ monthlyUrlImportsUsed: state.monthlyUrlImportsUsed + 1 });
      },

      resetMonthlyRecipeCalls: () => {
        set({ monthlyRecipeCallsUsed: 0, lastRecipeResetMonth: currentMonth() });
      },

      resetMonthlyOcrScans: () => {
        set({ monthlyOcrScansUsed: 0, lastOcrResetMonth: currentMonth() });
      },

      resetMonthlyUrlImports: () => {
        set({ monthlyUrlImportsUsed: 0, lastUrlImportResetMonth: currentMonth() });
      },

      checkAndResetMonthlyCounters: () => {
        const nowMonth = currentMonth();
        const state = get();

        if (state.lastRecipeResetMonth !== nowMonth) {
          set({ monthlyRecipeCallsUsed: 0, lastRecipeResetMonth: nowMonth });
        }

        if (state.lastOcrResetMonth !== nowMonth) {
          set({ monthlyOcrScansUsed: 0, lastOcrResetMonth: nowMonth });
        }

        if (state.lastUrlImportResetMonth !== nowMonth) {
          set({ monthlyUrlImportsUsed: 0, lastUrlImportResetMonth: nowMonth });
        }
      },
    }),
    {
      name: 'subscription-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isPro: state.isPro,
        activeEntitlements: state.activeEntitlements,
        monthlyRecipeCallsUsed: state.monthlyRecipeCallsUsed,
        monthlyOcrScansUsed: state.monthlyOcrScansUsed,
        monthlyUrlImportsUsed: state.monthlyUrlImportsUsed,
        lastRecipeResetMonth: state.lastRecipeResetMonth,
        lastOcrResetMonth: state.lastOcrResetMonth,
        lastUrlImportResetMonth: state.lastUrlImportResetMonth,
      }),
    }
  )
);
