import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { database } from './src/database';
import { AppNavigator } from './src/navigation/AppNavigator';
import { onAuthStateChanged } from './src/services/firebase/auth';
import { useAuthStore } from './src/stores/useAuthStore';

export default function App() {
  useEffect(() => {
    // Listen to auth state changes
    const unsubscribe = onAuthStateChanged((user) => {
      if (user) {
        useAuthStore.getState().setUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
        });
      } else {
        useAuthStore.getState().setUser(null);
      }
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
