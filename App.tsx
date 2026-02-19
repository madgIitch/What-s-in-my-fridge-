import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { database } from './src/database';
import { AppNavigator } from './src/navigation/AppNavigator';
import { onAuthStateChanged } from './src/services/firebase/auth';
import { useAuthStore } from './src/stores/useAuthStore';
import { fetchSubscriptionStatus } from './src/services/stripe';
import { useSubscriptionStore } from './src/stores/useSubscriptionStore';

export default function App() {
  // Firebase is auto-initialized via google-services.json

  useEffect(() => {
    // Listen to auth state changes
    const unsubscribe = onAuthStateChanged((user) => {
      void (async () => {
        if (user) {
          useAuthStore.getState().setUser({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
          });

          try {
            const status = await fetchSubscriptionStatus();
            useSubscriptionStore.getState().setProStatus(status.isPro);
          } catch {
            // Silent — persisted value remains
          }
          useSubscriptionStore.getState().setInitialized(true);
        } else {
          useAuthStore.getState().setUser(null);
          useSubscriptionStore.getState().setProStatus(false);
          useSubscriptionStore.getState().setInitialized(false);
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
