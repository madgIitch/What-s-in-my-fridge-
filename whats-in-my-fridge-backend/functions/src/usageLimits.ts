import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

export const FREE_RECIPE_LIMIT = 5;
export const FREE_OCR_LIMIT = 5;
export const FREE_URL_IMPORT_LIMIT = 10;

export type UsageFeature = "recipeCallsUsed" | "ocrScansUsed" | "urlImportsUsed";

const currentMonth = (): string => new Date().toISOString().slice(0, 7); // "YYYY-MM"

/**
 * Checks whether the user has remaining quota for a feature and atomically
 * increments the counter if they do.
 *
 * Pro users bypass all limits.
 * Free users are blocked once they reach the monthly cap.
 *
 * Throws `resource-exhausted` HttpsError if the limit has been reached.
 * Firestore path: users/{uid}/usage/{YYYY-MM}  (field: recipeCallsUsed | ocrScansUsed | urlImportsUsed)
 */
export async function checkAndIncrementUsage(
  userId: string,
  feature: UsageFeature,
  limit: number
): Promise<void> {
  const db = admin.firestore();

  // Read Pro status before the transaction (a slightly stale read is acceptable here;
  // the webhook updates this within seconds of a real payment).
  const subSnap = await db
    .collection("users")
    .doc(userId)
    .collection("subscription")
    .doc("status")
    .get();

  const subData = subSnap.data();
  const isPro = subData?.manualProOverride === true || (subData?.isPro ?? false);

  if (isPro) return;

  const usageRef = db
    .collection("users")
    .doc(userId)
    .collection("usage")
    .doc(currentMonth());

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(usageRef);
    const current: number = snap.data()?.[feature] ?? 0;

    if (current >= limit) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        `Límite mensual alcanzado (${limit}). Actualiza a Pro para continuar.`
      );
    }

    tx.set(usageRef, { [feature]: current + 1 }, { merge: true });
  });
}
