import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Linking } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { useSubscriptionStore } from '../stores/useSubscriptionStore';
import {
  FREE_OCR_LIMIT,
  FREE_RECIPE_LIMIT,
  FREE_URL_IMPORT_LIMIT,
  createStripeCheckoutSession,
  fetchSubscriptionStatus,
  getStripeCustomerPortalUrl,
} from '../services/stripe';

const toErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

export const useSubscription = () => {
  const store = useSubscriptionStore();
  const firestoreUnsubscribeRef = useRef<(() => void) | null>(null);

  // Reset monthly counters on mount
  useEffect(() => {
    useSubscriptionStore.getState().checkAndResetMonthlyCounters();
  }, []);

  /** Sync server-side usage counters for the current month from Firestore */
  const syncUsageFromFirestore = useCallback(async () => {
    const user = auth().currentUser;
    if (!user) return;
    try {
      const month = new Date().toISOString().slice(0, 7); // "YYYY-MM"
      const snap = await firestore()
        .collection('users')
        .doc(user.uid)
        .collection('usage')
        .doc(month)
        .get();
      if (snap.exists) {
        const d = snap.data()!;
        useSubscriptionStore.getState().setUsageCounts({
          recipeCallsUsed: d.recipeCallsUsed ?? 0,
          ocrScansUsed: d.ocrScansUsed ?? 0,
          urlImportsUsed: d.urlImportsUsed ?? 0,
        });
      }
    } catch {
      // Silent — persisted local value remains as fallback
    }
  }, []);

  /** Sync isPro from Firestore (called on init and on AppState foreground) */
  const syncFromFirestore = useCallback(async () => {
    const user = auth().currentUser;
    if (!user) return;
    try {
      const snap = await firestore()
        .collection('users')
        .doc(user.uid)
        .collection('subscription')
        .doc('status')
        .get();
      const isPro = snap.data()?.isPro ?? false;
      useSubscriptionStore.getState().setProStatus(isPro);
    } catch {
      // Silent — we'll rely on the persisted value if Firestore is unavailable
    }
  }, []);

  /**
   * Sets up a real-time Firestore listener so the app updates instantly
   * when the Stripe webhook writes isPro = true.
   */
  const startFirestoreListener = useCallback(() => {
    const user = auth().currentUser;
    if (!user) return;
    if (firestoreUnsubscribeRef.current) return; // already listening

    firestoreUnsubscribeRef.current = firestore()
      .collection('users')
      .doc(user.uid)
      .collection('subscription')
      .doc('status')
      .onSnapshot(
        (snap) => {
          const isPro = snap.data()?.isPro ?? false;
          useSubscriptionStore.getState().setProStatus(isPro);
        },
        () => {
          // Ignore listener errors — persisted value remains
        }
      );
  }, []);

  const stopFirestoreListener = useCallback(() => {
    firestoreUnsubscribeRef.current?.();
    firestoreUnsubscribeRef.current = null;
  }, []);

  /** Initialize: start Firestore listener + initial sync */
  const initializeSubscriptions = useCallback(async () => {
    const state = useSubscriptionStore.getState();
    state.setLoading(true);
    state.setError(null);
    try {
      state.checkAndResetMonthlyCounters();
      startFirestoreListener();
      await Promise.all([syncFromFirestore(), syncUsageFromFirestore()]);
      state.setInitialized(true);
    } catch (error) {
      const message = toErrorMessage(error, 'Error al inicializar suscripción.');
      useSubscriptionStore.getState().setError(message);
    } finally {
      useSubscriptionStore.getState().setLoading(false);
    }
  }, [syncFromFirestore, syncUsageFromFirestore, startFirestoreListener]);

  /** When the app comes back to foreground, re-check Firestore */
  useEffect(() => {
    const handleAppState = (next: AppStateStatus) => {
      if (next === 'active') {
        syncFromFirestore();
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => {
      sub.remove();
      stopFirestoreListener();
    };
  }, [syncFromFirestore, stopFirestoreListener]);

  /** Opens Stripe Checkout in the external browser */
  const openPaywall = useCallback(async (billingPeriod: 'monthly' | 'yearly' = 'monthly') => {
    const state = useSubscriptionStore.getState();
    state.setLoading(true);
    state.setError(null);
    try {
      const url = await createStripeCheckoutSession(billingPeriod);
      await Linking.openURL(url);
    } catch (error) {
      const message = toErrorMessage(error, 'No se pudo abrir el pago.');
      useSubscriptionStore.getState().setError(message);
      throw error;
    } finally {
      useSubscriptionStore.getState().setLoading(false);
    }
  }, []);

  /** Opens the Stripe Customer Portal in the external browser */
  const openCustomerPortal = useCallback(async () => {
    const state = useSubscriptionStore.getState();
    state.setLoading(true);
    state.setError(null);
    try {
      const url = await getStripeCustomerPortalUrl();
      await Linking.openURL(url);
    } catch (error) {
      const message = toErrorMessage(error, 'No se pudo abrir el portal.');
      useSubscriptionStore.getState().setError(message);
      throw error;
    } finally {
      useSubscriptionStore.getState().setLoading(false);
    }
  }, []);

  /** Manual sync from the Cloud Function (server-side source of truth) */
  const syncSubscriptionStatus = useCallback(async () => {
    const state = useSubscriptionStore.getState();
    state.setLoading(true);
    state.setError(null);
    try {
      const status = await fetchSubscriptionStatus();
      useSubscriptionStore.getState().setProStatus(status.isPro);
      return status;
    } catch (error) {
      const message = toErrorMessage(error, 'Error al sincronizar suscripción.');
      useSubscriptionStore.getState().setError(message);
      throw error;
    } finally {
      useSubscriptionStore.getState().setLoading(false);
    }
  }, []);

  const recipeLimit = store.isPro ? Number.POSITIVE_INFINITY : FREE_RECIPE_LIMIT;
  const ocrLimit = store.isPro ? Number.POSITIVE_INFINITY : FREE_OCR_LIMIT;
  const urlImportLimit = store.isPro ? Number.POSITIVE_INFINITY : FREE_URL_IMPORT_LIMIT;
  const remainingRecipeCalls = store.isPro
    ? Number.POSITIVE_INFINITY
    : Math.max(FREE_RECIPE_LIMIT - store.monthlyRecipeCallsUsed, 0);
  const remainingOcrScans = store.isPro
    ? Number.POSITIVE_INFINITY
    : Math.max(FREE_OCR_LIMIT - store.monthlyOcrScansUsed, 0);
  const remainingUrlImports = store.isPro
    ? Number.POSITIVE_INFINITY
    : Math.max(FREE_URL_IMPORT_LIMIT - store.monthlyUrlImportsUsed, 0);

  return {
    initialized: store.initialized,
    loading: store.loading,
    error: store.error,
    isPro: store.isPro,

    monthlyRecipeCallsUsed: store.monthlyRecipeCallsUsed,
    monthlyOcrScansUsed: store.monthlyOcrScansUsed,
    monthlyUrlImportsUsed: store.monthlyUrlImportsUsed,
    recipeLimit,
    ocrLimit,
    urlImportLimit,
    remainingRecipeCalls,
    remainingOcrScans,
    remainingUrlImports,
    canUseRecipeSuggestions: store.isPro || store.monthlyRecipeCallsUsed < FREE_RECIPE_LIMIT,
    canUseOcrScans: store.isPro || store.monthlyOcrScansUsed < FREE_OCR_LIMIT,
    canUseUrlImports: store.isPro || store.monthlyUrlImportsUsed < FREE_URL_IMPORT_LIMIT,

    incrementRecipeCalls: store.incrementRecipeCalls,
    incrementOcrScans: store.incrementOcrScans,
    incrementUrlImports: store.incrementUrlImports,

    initializeSubscriptions,
    syncSubscriptionStatus,
    openPaywall,
    openCustomerPortal,
  };
};
