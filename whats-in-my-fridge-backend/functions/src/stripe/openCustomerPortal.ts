import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import Stripe from "stripe";

const getStripe = () =>
  new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: "2025-02-24.acacia",
  });

/**
 * Creates a Stripe Customer Portal session for the authenticated user.
 * The portal lets users manage their subscription (cancel, update payment, etc.).
 * Returns the URL to open in the browser.
 *
 * Required env secrets: STRIPE_SECRET_KEY
 * Required env var: STRIPE_PORTAL_RETURN_URL — URL to return to after portal
 */
export const openCustomerPortal = functions
  .region("europe-west1")
  .runWith({ secrets: ["STRIPE_SECRET_KEY"] })
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

    const stripeCustomerId = doc.data()?.stripeCustomerId;
    if (!stripeCustomerId) {
      throw new functions.https.HttpsError(
        "not-found",
        "No se encontró una suscripción activa para este usuario"
      );
    }

    const stripe = getStripe();
    const returnUrl =
      process.env.STRIPE_PORTAL_RETURN_URL || "https://example.com";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    return { url: portalSession.url };
  });
