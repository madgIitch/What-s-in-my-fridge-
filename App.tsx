import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { database } from './src/database';
import { AppNavigator } from './src/navigation/AppNavigator';
import { onAuthStateChanged } from './src/services/firebase/auth';
import { useAuthStore } from './src/stores/useAuthStore';
import {
  initializeRevenueCat,
  logoutRevenueCatUser,
  refreshRevenueCatSubscription,
  setRevenueCatUser,
} from './src/services/revenuecat';
import { useSubscriptionStore } from './src/stores/useSubscriptionStore';

export default function App() {
  // Firebase is auto-initialized via google-services.json

  useEffect(() => {
    initializeRevenueCat()
      .then(async (initialized) => {
        useSubscriptionStore.getState().setInitialized(initialized);
        if (!initialized) return;

        const snapshot = await refreshRevenueCatSubscription();
        useSubscriptionStore.getState().setProStatus(snapshot.isPro);
        useSubscriptionStore.getState().setActiveEntitlements(snapshot.activeEntitlements);
      })
      .catch((error) => {
        console.error('Error initializing RevenueCat:', error);
      });

    // Listen to auth state changes
    const unsubscribe = onAuthStateChanged((user) => {
      void (async () => {
        if (user) {
          useAuthStore.getState().setUser({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
          });

          await setRevenueCatUser(user.uid);
          const snapshot = await refreshRevenueCatSubscription();
          useSubscriptionStore.getState().setProStatus(snapshot.isPro);
          useSubscriptionStore.getState().setActiveEntitlements(snapshot.activeEntitlements);
        } else {
          useAuthStore.getState().setUser(null);
          await logoutRevenueCatUser();
          useSubscriptionStore.getState().setProStatus(false);
          useSubscriptionStore.getState().setActiveEntitlements([]);
        }
      })().catch((error) => {
        console.error('Error syncing auth/subscription state:', error);
      });
    });

    return () => unsubscribe();
  }, []);

  return (
    <DatabaseProvider database={database}>
      <AppNavigator />
      <StatusBar style="light" />
    </DatabaseProvider>
  );
}
