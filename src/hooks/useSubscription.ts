import { useCallback, useEffect } from 'react';
import { useSubscriptionStore } from '../stores/useSubscriptionStore';
import {
  FREE_OCR_LIMIT,
  FREE_RECIPE_LIMIT,
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
    store.checkAndResetMonthlyCounters();
  }, [store]);

  const syncSubscriptionStatus = useCallback(async () => {
    store.setLoading(true);
    store.setError(null);
    try {
      const snapshot = await refreshRevenueCatSubscription();
      store.setProStatus(snapshot.isPro);
      store.setActiveEntitlements(snapshot.activeEntitlements);
      return snapshot;
    } catch (error) {
      const message = toErrorMessage(error, 'No se pudo sincronizar la suscripción.');
      store.setError(message);
      throw error;
    } finally {
      store.setLoading(false);
    }
  }, [store]);

  const initializeSubscriptions = useCallback(async () => {
    store.setLoading(true);
    store.setError(null);
    try {
      await initializeRevenueCat();
      store.checkAndResetMonthlyCounters();
      await syncSubscriptionStatus();
      const packages = await getPaywallPackages();
      store.setPackages(packages);
      store.setInitialized(true);
    } catch (error) {
      const message = toErrorMessage(error, 'No se pudo inicializar RevenueCat.');
      store.setError(message);
      store.setInitialized(false);
      throw error;
    } finally {
      store.setLoading(false);
    }
  }, [store, syncSubscriptionStatus]);

  const refreshPackages = useCallback(async () => {
    store.setLoading(true);
    store.setError(null);
    try {
      const packages = await getPaywallPackages();
      store.setPackages(packages);
      return packages;
    } catch (error) {
      const message = toErrorMessage(error, 'No se pudieron cargar los planes.');
      store.setError(message);
      throw error;
    } finally {
      store.setLoading(false);
    }
  }, [store]);

  const purchasePro = useCallback(
    async (packageIdentifier: string) => {
      store.setLoading(true);
      store.setError(null);
      try {
        const snapshot = await purchasePackageByIdentifier(packageIdentifier);
        store.setProStatus(snapshot.isPro);
        store.setActiveEntitlements(snapshot.activeEntitlements);
        return snapshot;
      } catch (error) {
        const message = toErrorMessage(error, 'No se pudo completar la compra.');
        store.setError(message);
        throw error;
      } finally {
        store.setLoading(false);
      }
    },
    [store]
  );

  const restorePurchases = useCallback(async () => {
    store.setLoading(true);
    store.setError(null);
    try {
      const snapshot = await restoreRevenueCatPurchases();
      store.setProStatus(snapshot.isPro);
      store.setActiveEntitlements(snapshot.activeEntitlements);
      return snapshot;
    } catch (error) {
      const message = toErrorMessage(error, 'No se pudieron restaurar las compras.');
      store.setError(message);
      throw error;
    } finally {
      store.setLoading(false);
    }
  }, [store]);

  const recipeLimit = store.isPro ? Number.POSITIVE_INFINITY : FREE_RECIPE_LIMIT;
  const ocrLimit = store.isPro ? Number.POSITIVE_INFINITY : FREE_OCR_LIMIT;
  const remainingRecipeCalls = store.isPro
    ? Number.POSITIVE_INFINITY
    : Math.max(FREE_RECIPE_LIMIT - store.monthlyRecipeCallsUsed, 0);
  const remainingOcrScans = store.isPro
    ? Number.POSITIVE_INFINITY
    : Math.max(FREE_OCR_LIMIT - store.monthlyOcrScansUsed, 0);

  return {
    initialized: store.initialized,
    loading: store.loading,
    error: store.error,
    isPro: store.isPro,
    activeEntitlements: store.activeEntitlements,
    packages: store.packages,

    monthlyRecipeCallsUsed: store.monthlyRecipeCallsUsed,
    monthlyOcrScansUsed: store.monthlyOcrScansUsed,
    recipeLimit,
    ocrLimit,
    remainingRecipeCalls,
    remainingOcrScans,
    canUseRecipeSuggestions: store.isPro || store.monthlyRecipeCallsUsed < FREE_RECIPE_LIMIT,
    canUseOcrScans: store.isPro || store.monthlyOcrScansUsed < FREE_OCR_LIMIT,

    incrementRecipeCalls: store.incrementRecipeCalls,
    incrementOcrScans: store.incrementOcrScans,

    initializeSubscriptions,
    syncSubscriptionStatus,
    refreshPackages,
    purchasePro,
    restorePurchases,
  };
};
