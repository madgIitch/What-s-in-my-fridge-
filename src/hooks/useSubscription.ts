import { useCallback, useEffect } from 'react';
import { useSubscriptionStore } from '../stores/useSubscriptionStore';
import {
  FREE_OCR_LIMIT,
  FREE_RECIPE_LIMIT,
  FREE_URL_IMPORT_LIMIT,
  getPaywallPackages,
  initializeRevenueCat,
  purchasePackageByIdentifier,
  refreshRevenueCatSubscription,
  restoreRevenueCatPurchases,
} from '../services/revenuecat';

const toErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

export const useSubscription = () => {
  const store = useSubscriptionStore();

  useEffect(() => {
    useSubscriptionStore.getState().checkAndResetMonthlyCounters();
  }, []);

  const syncSubscriptionStatus = useCallback(async () => {
    const state = useSubscriptionStore.getState();
    state.setLoading(true);
    state.setError(null);
    try {
      const snapshot = await refreshRevenueCatSubscription();
      const currentState = useSubscriptionStore.getState();
      currentState.setProStatus(snapshot.isPro);
      currentState.setActiveEntitlements(snapshot.activeEntitlements);
      return snapshot;
    } catch (error) {
      const message = toErrorMessage(error, 'Failed to sync subscription status.');
      useSubscriptionStore.getState().setError(message);
      throw error;
    } finally {
      useSubscriptionStore.getState().setLoading(false);
    }
  }, []);

  const initializeSubscriptions = useCallback(async () => {
    const state = useSubscriptionStore.getState();
    state.setLoading(true);
    state.setError(null);
    try {
      await initializeRevenueCat();
      useSubscriptionStore.getState().checkAndResetMonthlyCounters();
      await syncSubscriptionStatus();
      const packages = await getPaywallPackages();
      const currentState = useSubscriptionStore.getState();
      currentState.setPackages(packages);
      currentState.setInitialized(true);
    } catch (error) {
      const message = toErrorMessage(error, 'Failed to initialize RevenueCat.');
      const currentState = useSubscriptionStore.getState();
      currentState.setError(message);
      currentState.setInitialized(false);
      throw error;
    } finally {
      useSubscriptionStore.getState().setLoading(false);
    }
  }, [syncSubscriptionStatus]);

  const refreshPackages = useCallback(async () => {
    const state = useSubscriptionStore.getState();
    state.setLoading(true);
    state.setError(null);
    try {
      const packages = await getPaywallPackages();
      useSubscriptionStore.getState().setPackages(packages);
      return packages;
    } catch (error) {
      const message = toErrorMessage(error, 'Failed to load plans.');
      useSubscriptionStore.getState().setError(message);
      throw error;
    } finally {
      useSubscriptionStore.getState().setLoading(false);
    }
  }, []);

  const purchasePro = useCallback(async (packageIdentifier: string) => {
    const state = useSubscriptionStore.getState();
    state.setLoading(true);
    state.setError(null);
    try {
      const snapshot = await purchasePackageByIdentifier(packageIdentifier);
      const currentState = useSubscriptionStore.getState();
      currentState.setProStatus(snapshot.isPro);
      currentState.setActiveEntitlements(snapshot.activeEntitlements);
      return snapshot;
    } catch (error) {
      const message = toErrorMessage(error, 'Could not complete purchase.');
      useSubscriptionStore.getState().setError(message);
      throw error;
    } finally {
      useSubscriptionStore.getState().setLoading(false);
    }
  }, []);

  const restorePurchases = useCallback(async () => {
    const state = useSubscriptionStore.getState();
    state.setLoading(true);
    state.setError(null);
    try {
      const snapshot = await restoreRevenueCatPurchases();
      const currentState = useSubscriptionStore.getState();
      currentState.setProStatus(snapshot.isPro);
      currentState.setActiveEntitlements(snapshot.activeEntitlements);
      return snapshot;
    } catch (error) {
      const message = toErrorMessage(error, 'Could not restore purchases.');
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
    activeEntitlements: store.activeEntitlements,
    packages: store.packages,

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
    refreshPackages,
    purchasePro,
    restorePurchases,
  };
};
