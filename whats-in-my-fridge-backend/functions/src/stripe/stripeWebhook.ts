import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import Stripe from "stripe";

const getStripe = () =>
  new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: "2025-02-24.acacia",
  });

/**
 * Stripe webhook handler. Receives events from Stripe and updates
 * the Firestore subscription status for the corresponding user.
 *
 * Register the deployed URL in Stripe Dashboard → Developers → Webhooks.
 * Events to listen for:
 *   checkout.session.completed
 *   customer.subscription.updated
 *   customer.subscription.deleted
 *   invoice.payment_failed
 *
 * Required env secrets (Firebase):
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET
 */
export const stripeWebhook = functions
  .region("us-central1")
  .runWith({ secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] })
  .https.onRequest(async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;
    const stripe = getStripe();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    const db = admin.firestore();

    /** Given a stripeCustomerId, finds the Firebase UID from Firestore */
    const findUserId = async (customerId: string): Promise<string | null> => {
      const snap = await db
        .collectionGroup("subscription")
        .where("stripeCustomerId", "==", customerId)
        .limit(1)
        .get();
      if (snap.empty) return null;
      // Path: users/{uid}/subscription/status
      return snap.docs[0].ref.parent.parent?.id ?? null;
    };

    const updateSubscription = async (
      userId: string,
      data: Record<string, unknown>
    ) => {
      const subscriptionRef = db
        .collection("users")
        .doc(userId)
        .collection("subscription")
        .doc("status");

      const current = await subscriptionRef.get();
      const manualProOverride = current.data()?.manualProOverride === true;
      const nextData: Record<string, unknown> = { ...data };

      // If manual override is enabled for this user, keep Pro always on.
      if (manualProOverride) {
        nextData.isPro = true;
        nextData.status = "manual_override";
      }

      await subscriptionRef.set(
        { ...nextData, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
    };

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId =
            session.metadata?.firebaseUserId ||
            (await findUserId(session.customer as string));
          if (!userId) break;
          await updateSubscription(userId, {
            isPro: true,
            status: "active",
            stripeSubscriptionId: session.subscription,
          });
          console.log(`✅ checkout.session.completed for user ${userId}`);
          break;
        }

        case "customer.subscription.updated": {
          const sub = event.data.object as Stripe.Subscription;
          const userId = await findUserId(sub.customer as string);
          if (!userId) break;
          const isPro = sub.status === "active" || sub.status === "trialing";
          await updateSubscription(userId, {
            isPro,
            status: sub.status,
            stripeSubscriptionId: sub.id,
            currentPeriodEnd: admin.firestore.Timestamp.fromMillis(
              sub.current_period_end * 1000
            ),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
          });
          console.log(
            `🔄 customer.subscription.updated for user ${userId}: ${sub.status}`
          );
          break;
        }

        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          const userId = await findUserId(sub.customer as string);
          if (!userId) break;
          await updateSubscription(userId, {
            isPro: false,
            status: "canceled",
            stripeSubscriptionId: sub.id,
          });
          console.log(`❌ customer.subscription.deleted for user ${userId}`);
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          const userId = await findUserId(invoice.customer as string);
          if (!userId) break;
          await updateSubscription(userId, {
            isPro: false,
            status: "past_due",
          });
          console.log(`⚠️ invoice.payment_failed for user ${userId}`);
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (err: any) {
      console.error("Error processing webhook event:", err);
      res.status(500).send("Internal error");
      return;
    }

    res.status(200).json({ received: true });
  });
