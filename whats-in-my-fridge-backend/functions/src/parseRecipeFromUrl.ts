import * as functions from "firebase-functions";
import { logger } from "firebase-functions";
import { checkAndIncrementUsage, FREE_URL_IMPORT_LIMIT } from "./usageLimits";
import { runRecipePipeline } from "./recipeUrlPipeline";

interface ParseRecipeFromUrlRequest {
  url: string;
  manualText?: string;
}

export const parseRecipeFromUrl = functions
  .region("europe-west1")
  .runWith({ memory: "1GB", timeoutSeconds: 540 })
  .https.onCall(async (data: ParseRecipeFromUrlRequest, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Usuario debe estar autenticado");
    }

    const { url, manualText } = data;
    if (!url || typeof url !== "string") {
      throw new functions.https.HttpsError("invalid-argument", "URL invalida");
    }

    const start = Date.now();
    const userId = context.auth.uid;

    await checkAndIncrementUsage(userId, "urlImportsUsed", FREE_URL_IMPORT_LIMIT);

    try {
      const result = await runRecipePipeline({ url, manualText });

      logger.info("feature_usage", {
        feature: "url_import",
        userId,
        durationMs: Date.now() - start,
        success: true,
        sourceType: result.sourceType,
        usedWhisper: result.sourceType === "youtube" || result.sourceType === "instagram" || result.sourceType === "tiktok",
        ingredientsFound: result.ingredients.length,
        stepsFound: result.steps.length,
      });

      return result;
    } catch (error: any) {
      logger.error("feature_usage", {
        feature: "url_import",
        userId,
        durationMs: Date.now() - start,
        success: false,
        error: error.message,
      });

      const message = String(error?.message || "");
      if (message.toLowerCase().includes("no se pudo extraer")) {
        throw new functions.https.HttpsError("failed-precondition", message);
      }

      throw new functions.https.HttpsError("internal", `Error procesando la receta: ${error.message}`);
    }
  });
