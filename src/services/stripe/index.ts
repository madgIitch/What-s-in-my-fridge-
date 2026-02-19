import auth from '@react-native-firebase/auth';
import functions from '@react-native-firebase/functions';

export const FREE_RECIPE_LIMIT = 5;
export const FREE_OCR_LIMIT = 5;
export const FREE_URL_IMPORT_LIMIT = 10;

export interface SubscriptionStatus {
  isPro: boolean;
  status: string;
  currentPeriodEnd: number | null;
}

const getCallable = (name: string, region = 'europe-west1') => {
  const projectId =
    functions().app?.options?.projectId || 'what-s-in-my-fridge-a2a07';
  const url = `https://${region}-${projectId}.cloudfunctions.net/${name}`;
  return functions().httpsCallableFromUrl(url);
};

const requireAuth = async () => {
  const user = auth().currentUser;
  if (!user) throw new Error('Debes iniciar sesión');
  return user;
};

/**
 * Calls the createCheckoutSession Cloud Function and returns the Stripe
 * Checkout URL. The caller should open it with Linking.openURL().
 */
export const createStripeCheckoutSession = async (): Promise<string> => {
  await requireAuth();
  const callable = getCallable('createCheckoutSession');
  const result = await callable({});
  const url = (result.data as { url: string }).url;
  if (!url) throw new Error('No se recibió URL de Stripe Checkout');
  return url;
};

/**
 * Calls the openCustomerPortal Cloud Function and returns the Stripe
 * Customer Portal URL. The caller should open it with Linking.openURL().
 */
export const getStripeCustomerPortalUrl = async (): Promise<string> => {
  await requireAuth();
  const callable = getCallable('openCustomerPortal');
  const result = await callable({});
  const url = (result.data as { url: string }).url;
  if (!url) throw new Error('No se recibió URL del portal de gestión');
  return url;
};

/**
 * Calls the getSubscriptionStatus Cloud Function and returns the current
 * subscription status from Firestore (server-side source of truth).
 */
export const fetchSubscriptionStatus = async (): Promise<SubscriptionStatus> => {
  await requireAuth();
  const callable = getCallable('getSubscriptionStatus');
  const result = await callable({});
  return result.data as SubscriptionStatus;
};
