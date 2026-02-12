import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

export const FREE_RECIPE_LIMIT = 5;
export const FREE_OCR_LIMIT = 5;

export interface RevenueCatPackage {
  identifier: string;
  productIdentifier: string;
  title: string;
  description: string;
  priceString: string;
}

export interface SubscriptionSnapshot {
  isPro: boolean;
  activeEntitlements: string[];
}

let isConfigured = false;

const getEnv = (key: string): string | undefined => {
  const extra = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;
  return extra?.[key] || process.env[key];
};

export const getProEntitlementId = (): string => {
  return getEnv('EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID') || 'pro';
};

const getRevenueCatApiKey = (): string | undefined => {
  if (Platform.OS === 'ios') {
    return getEnv('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY');
  }
  return getEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY');
};

export const initializeRevenueCat = async (): Promise<boolean> => {
  if (isConfigured) return true;

  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    console.warn('[RevenueCat] Missing API key. RevenueCat will stay disabled.');
    return false;
  }

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }

  Purchases.configure({ apiKey });
  isConfigured = true;
  return true;
};

export const setRevenueCatUser = async (userId: string): Promise<void> => {
  const ready = await initializeRevenueCat();
  if (!ready) return;
  await Purchases.logIn(userId);
};

export const logoutRevenueCatUser = async (): Promise<void> => {
  if (!isConfigured) return;
  await Purchases.logOut();
};

export const getPaywallPackages = async (): Promise<RevenueCatPackage[]> => {
  const ready = await initializeRevenueCat();
  if (!ready) return [];

  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) return [];

  return current.availablePackages.map((pkg) => ({
    identifier: pkg.identifier,
    productIdentifier: pkg.product.identifier,
    title: pkg.product.title,
    description: pkg.product.description,
    priceString: pkg.product.priceString,
  }));
};

export const purchasePackageByIdentifier = async (
  packageIdentifier: string
): Promise<SubscriptionSnapshot> => {
  const ready = await initializeRevenueCat();
  if (!ready) {
    throw new Error('RevenueCat no está configurado.');
  }

  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) {
    throw new Error('No hay offerings disponibles en RevenueCat.');
  }

  const pkg = current.availablePackages.find(
    (candidate) =>
      candidate.identifier === packageIdentifier ||
      candidate.product.identifier === packageIdentifier
  );

  if (!pkg) {
    throw new Error('No se encontró el paquete seleccionado.');
  }

  const purchaseResult = await Purchases.purchasePackage(pkg);
  const customerInfo = (purchaseResult as { customerInfo: any }).customerInfo;
  return parseSubscriptionSnapshot(customerInfo);
};

export const restoreRevenueCatPurchases = async (): Promise<SubscriptionSnapshot> => {
  const ready = await initializeRevenueCat();
  if (!ready) {
    throw new Error('RevenueCat no está configurado.');
  }

  const customerInfo = await Purchases.restorePurchases();
  return parseSubscriptionSnapshot(customerInfo as any);
};

export const refreshRevenueCatSubscription = async (): Promise<SubscriptionSnapshot> => {
  const ready = await initializeRevenueCat();
  if (!ready) {
    return {
      isPro: false,
      activeEntitlements: [],
    };
  }

  const customerInfo = await Purchases.getCustomerInfo();
  return parseSubscriptionSnapshot(customerInfo as any);
};

const parseSubscriptionSnapshot = (customerInfo: any): SubscriptionSnapshot => {
  const activeEntitlements = Object.keys(customerInfo?.entitlements?.active || {});
  const proEntitlementId = getProEntitlementId();
  const isPro = activeEntitlements.includes(proEntitlementId);

  return {
    isPro,
    activeEntitlements,
  };
};
