import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

/**
 * Returns the current subscription status for the authenticated user.
 * Reads from Firestore (source of truth updated by stripeWebhook).
 */
export const getSubscriptionStatus = functions
  .region("europe-west1")
  .https.onCall(async (_data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Debes iniciar sesión"
      );
    }

    const userId = context.auth.uid;
    const doc = await admin
      .firestore()
      .collection("users")
      .doc(userId)
      .collection("subscription")
      .doc("status")
      .get();

    if (!doc.exists) {
      return { isPro: false, status: "inactive", currentPeriodEnd: null };
    }

    const data = doc.data()!;
    return {
      isPro: data.isPro ?? false,
      status: data.status ?? "inactive",
      currentPeriodEnd: data.currentPeriodEnd?.toMillis?.() ?? null,
    };
  });
