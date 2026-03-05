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
  cloudConsent: boolean;
  notificationsEnabled: boolean;
  cookingTime: number; // minutes

  // Actions
  setReminderDays: (days: number) => void;
  setCloudConsent: (consent: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setCookingTime: (time: number) => void;
  loadCookingPreferencesFromFirestore: (userId: string) => Promise<void>;
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set, get) => ({
      // Default values
      reminderDays: 3,
      cloudConsent: false,
      notificationsEnabled: true,
      cookingTime: 30,

      // Actions
      setReminderDays: (days) => set({ reminderDays: days }),

      setCloudConsent: (consent) => set({ cloudConsent: consent }),

      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),

      setCookingTime: async (time) => {
        set({ cookingTime: time });
        try {
          await syncCookingPreferencesToFirestore(time);
        } catch (error) {
          console.error('Error syncing cooking time to Firestore:', error);
        }
      },

      loadCookingPreferencesFromFirestore: async (userId: string) => {
        try {
          const preferences = await fetchCookingPreferencesFromFirestore(userId);
          if (preferences) {
            set({ cookingTime: preferences.cookingTime });
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
