import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { checkAndIncrementUsage, FREE_URL_IMPORT_LIMIT } from "./usageLimits";
import { detectUrlType } from "./recipeUrlPipeline";

export const submitRecipeJob = functions
  .region("europe-west1")
  .runWith({ memory: "256MB", timeoutSeconds: 30 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Usuario debe estar autenticado");
    }

    const url = data?.url;
    if (!url || typeof url !== "string") {
      throw new functions.https.HttpsError("invalid-argument", "URL invalida");
    }

    const userId = context.auth.uid;
    const sourceType = detectUrlType(url);

    if (sourceType === "blog") {
      throw new functions.https.HttpsError("invalid-argument", "Usa parseRecipeFromUrl para blogs");
    }

    await checkAndIncrementUsage(userId, "urlImportsUsed", FREE_URL_IMPORT_LIMIT);

    const jobRef = admin
      .firestore()
      .collection("users")
      .doc(userId)
      .collection("recipe_jobs")
      .doc();

    const now = Date.now();

    await jobRef.set({
      jobId: jobRef.id,
      url,
      status: "pending",
      sourceType,
      createdAt: now,
      updatedAt: now,
    });

    return { jobId: jobRef.id };
  });
