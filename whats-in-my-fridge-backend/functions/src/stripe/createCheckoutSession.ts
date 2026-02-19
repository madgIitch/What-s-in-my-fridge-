import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import Stripe from "stripe";

const getStripe = () =>
  new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: "2025-02-24.acacia",
  });

/**
 * Creates a Stripe Checkout Session for the Pro subscription.
 * Returns the URL where the user completes payment in the browser.
 *
 * Required env secrets (Firebase):
 *   STRIPE_SECRET_KEY — Stripe secret key
 *
 * Required env vars (app.config.js):
 *   STRIPE_PRO_PRICE_ID — Stripe Price ID for the Pro plan
 *   STRIPE_SUCCESS_URL  — URL to redirect after successful payment
 *   STRIPE_CANCEL_URL   — URL to redirect if the user cancels
 */
export const createCheckoutSession = functions
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
    const userEmail = context.auth.token.email;
    const stripe = getStripe();
    const db = admin.firestore();
    const subscriptionRef = db
      .collection("users")
      .doc(userId)
      .collection("subscription")
      .doc("status");

    // Reutilizar stripeCustomerId si ya existe
    const subscriptionSnap = await subscriptionRef.get();
    let stripeCustomerId: string | null =
      subscriptionSnap.data()?.stripeCustomerId ?? null;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { firebaseUserId: userId },
      });
      stripeCustomerId = customer.id;
      await subscriptionRef.set(
        { stripeCustomerId, isPro: false, status: "inactive" },
        { merge: true }
      );
    }

    const priceId = process.env.STRIPE_PRO_PRICE_ID;
    const successUrl =
      process.env.STRIPE_SUCCESS_URL || "https://example.com/success";
    const cancelUrl =
      process.env.STRIPE_CANCEL_URL || "https://example.com/cancel";

    if (!priceId) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "STRIPE_PRO_PRICE_ID no configurado"
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { firebaseUserId: userId },
    });

    return { url: session.url };
  });
