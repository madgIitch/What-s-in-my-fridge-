import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Preferences Store - User preferences and settings
 * Equivalent to PrefsRepository + DataStore from Android app
 */
interface PreferencesStore {
  // Preferences
  reminderDays: number;
  isPro: boolean;
  cloudConsent: boolean;
  notificationsEnabled: boolean;
  cookingTime: number; // minutes
  availableUtensils: string[];
  monthlyRecipeCallsUsed: number;
  lastResetMonth: string; // Format: 'YYYY-MM'

  // Actions
  setReminderDays: (days: number) => void;
  setProStatus: (isPro: boolean) => void;
  setCloudConsent: (consent: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setCookingTime: (time: number) => void;
  setAvailableUtensils: (utensils: string[]) => void;
  incrementRecipeCalls: () => void;
  resetMonthlyRecipeCalls: () => void;
  checkAndResetMonthlyCounter: () => void;
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set, get) => ({
      // Default values
      reminderDays: 3,
      isPro: false,
      cloudConsent: false,
      notificationsEnabled: true,
      cookingTime: 30,
      availableUtensils: ['oven', 'stove'],
      monthlyRecipeCallsUsed: 0,
      lastResetMonth: new Date().toISOString().slice(0, 7), // 'YYYY-MM'

      // Actions
      setReminderDays: (days) => set({ reminderDays: days }),

      setProStatus: (isPro) => set({ isPro }),

      setCloudConsent: (consent) => set({ cloudConsent: consent }),

      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),

      setCookingTime: (time) => set({ cookingTime: time }),

      setAvailableUtensils: (utensils) => set({ availableUtensils: utensils }),

      incrementRecipeCalls: () => {
        const state = get();
        state.checkAndResetMonthlyCounter();
        set({ monthlyRecipeCallsUsed: state.monthlyRecipeCallsUsed + 1 });
      },

      resetMonthlyRecipeCalls: () => {
        const currentMonth = new Date().toISOString().slice(0, 7);
        set({ monthlyRecipeCallsUsed: 0, lastResetMonth: currentMonth });
      },

      checkAndResetMonthlyCounter: () => {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const state = get();

        if (currentMonth !== state.lastResetMonth) {
          state.resetMonthlyRecipeCalls();
        }
      },
    }),
    {
      name: 'preferences-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
