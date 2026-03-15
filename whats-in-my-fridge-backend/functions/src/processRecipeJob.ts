import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { detectUrlType, extractRawText, runRecipePipeline } from "./recipeUrlPipeline";

interface RecipeJob {
  jobId: string;
  url: string;
  status: "pending" | "transcribing" | "extracting" | "completed" | "failed";
  sourceType: "youtube" | "instagram" | "tiktok" | "blog" | "manual";
  createdAt: number;
  updatedAt: number;
  result?: {
    ingredients: string[];
    steps: string[];
    rawText: string;
    recipeTitle?: string;
  };
  error?: string;
}

export const processRecipeJob = functions
  .region("europe-west1")
  .runWith({ memory: "1GB", timeoutSeconds: 540 })
  .firestore.document("users/{userId}/recipe_jobs/{jobId}")
  .onCreate(async (snap, context) => {
    const userId = context.params.userId as string;
    const jobId = context.params.jobId as string;
    const jobRef = snap.ref;
    const job = snap.data() as RecipeJob;

    try {
      const sourceType = (job.sourceType && job.sourceType !== "manual")
        ? job.sourceType
        : detectUrlType(job.url);
      if (sourceType === "blog") {
        throw new Error("Los jobs asinc estan disponibles solo para videos");
      }

      await jobRef.update({ status: "transcribing", updatedAt: Date.now() });
      const { rawText, recipeTitle } = await extractRawText(job.url, sourceType);

      await jobRef.update({ status: "extracting", updatedAt: Date.now() });
      const parsed = await runRecipePipeline({ url: job.url, manualText: rawText });

      const result = {
        ingredients: parsed.ingredients,
        steps: parsed.steps,
        rawText,
        recipeTitle: recipeTitle || parsed.recipeTitle,
      };

      await jobRef.update({
        status: "completed",
        result,
        updatedAt: Date.now(),
      });

      const userDoc = await admin.firestore().collection("users").doc(userId).get();
      const fcmToken = userDoc.data()?.fcmToken;

      if (fcmToken) {
        await admin.messaging().send({
          token: fcmToken,
          notification: {
            title: "Receta lista",
            body: `\"${result.recipeTitle || "Tu receta"}\" ya esta transcrita`,
          },
          data: {
            type: "RECIPE_JOB_COMPLETED",
            jobId,
          },
        });
      }
    } catch (error: any) {
      await jobRef.update({
        status: "failed",
        error: error?.message || "Error desconocido",
        updatedAt: Date.now(),
      });
    }
  });
