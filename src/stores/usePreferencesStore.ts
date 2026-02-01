import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncCookingPreferencesToFirestore, fetchCookingPreferencesFromFirestore } from '../services/firebase/firestore';

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
  loadCookingPreferencesFromFirestore: (userId: string) => Promise<void>;
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

      setCookingTime: async (time) => {
        set({ cookingTime: time });
        const state = get();
        // Sync to Firestore
        try {
          await syncCookingPreferencesToFirestore(time, state.availableUtensils);
        } catch (error) {
          console.error('Error syncing cooking time to Firestore:', error);
        }
      },

      setAvailableUtensils: async (utensils) => {
        set({ availableUtensils: utensils });
        const state = get();
        // Sync to Firestore
        try {
          await syncCookingPreferencesToFirestore(state.cookingTime, utensils);
        } catch (error) {
          console.error('Error syncing utensils to Firestore:', error);
        }
      },

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

      loadCookingPreferencesFromFirestore: async (userId: string) => {
        try {
          const preferences = await fetchCookingPreferencesFromFirestore(userId);
          if (preferences) {
            set({
              cookingTime: preferences.cookingTime,
              availableUtensils: preferences.availableUtensils,
            });
            console.log('Loaded cooking preferences from Firestore');
          }
        } catch (error) {
          console.error('Error loading preferences from Firestore:', error);
        }
      },
    }),
    {
      name: 'preferences-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
