import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import {parseReceipt} from "./parseReceipt";
import {getRecipeSuggestions} from "./recipeMatcher";
import {normalizeScannedIngredient, normalizeScannedIngredientsBatch} from "./normalizeScannedIngredient";
import {parseRecipeFromUrl} from "./parseRecipeFromUrl";
import {createCheckoutSession} from "./stripe/createCheckoutSession";
import {stripeWebhook} from "./stripe/stripeWebhook";
import {getSubscriptionStatus} from "./stripe/getSubscriptionStatus";
import {openCustomerPortal} from "./stripe/openCustomerPortal";

// Inicializar Firebase Admin
admin.initializeApp();

// ========== Exportar Cloud Functions ==========

// Función principal de parsing OCR
export {parseReceipt};

// Función de sugerencias de recetas
export {getRecipeSuggestions};

// Funciones de normalización de ingredientes
export {normalizeScannedIngredient, normalizeScannedIngredientsBatch};

// Función de parsing de recetas desde URLs (YouTube, Instagram, TikTok, blogs)
export {parseRecipeFromUrl};

// ========== Stripe — Sistema de pagos ==========
export {createCheckoutSession};
export {stripeWebhook};
export {getSubscriptionStatus};
export {openCustomerPortal};

// Función de migración para normalizar items existentes
export const migrateInventoryNormalization = functions
  .region("europe-west1")
  .runWith({ memory: "2GB", timeoutSeconds: 540 })
  .https.onCall(async (data, context) => {
    // Solo permitir a usuarios autenticados
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Usuario debe estar autenticado");
    }

    const userId = context.auth.uid;

    try {
      console.log(`🔄 Starting inventory normalization migration for user ${userId}`);

      // Obtener todos los items del inventario del usuario
      const inventoryRef = admin
        .firestore()
        .collection("users")
        .doc(userId)
        .collection("inventory");

      const snapshot = await inventoryRef.get();

      let updatedCount = 0;
      let errorCount = 0;
      const updates: any[] = [];

      for (const doc of snapshot.docs) {
        const itemData = doc.data();
        const itemName = itemData.name;

        // Skip if already has a valid normalized name
        if (itemData.normalizedName && itemData.normalizedName.trim().length > 0) {
          console.log(`⏭️ Skipping "${itemName}" - already normalized to "${itemData.normalizedName}"`);
          continue;
        }

        try {
          // Llamar a la función de normalización
          const normalizationResult = await normalizeScannedIngredient.run(
            {ingredientName: itemName, useLlmFallback: false},
            {auth: context.auth} as any
          );

          if (normalizationResult.result.normalizedName) {
            // Actualizar el documento con el nombre normalizado y categoría
            await doc.ref.update({
              normalizedName: normalizationResult.result.normalizedName,
              category: normalizationResult.result.categorySpanish || itemData.category || "Otros",
            });

            updates.push({
              id: doc.id,
              originalName: itemName,
              normalizedName: normalizationResult.result.normalizedName,
              category: normalizationResult.result.categorySpanish,
              method: normalizationResult.result.method,
              confidence: normalizationResult.result.confidence,
            });

            updatedCount++;
            console.log(
              `✅ Updated "${itemName}" → "${normalizationResult.result.normalizedName}" (${normalizationResult.result.method}, ${normalizationResult.result.confidence})`
            );
          } else {
            console.log(`⚠️ Could not normalize "${itemName}"`);
          }
        } catch (error: any) {
          errorCount++;
          console.error(`❌ Error normalizing "${itemName}":`, error.message);
        }
      }

      console.log(
        `✅ Migration complete: ${updatedCount} items updated, ${errorCount} errors, ${snapshot.size} total items`
      );

      return {
        success: true,
        totalItems: snapshot.size,
        updatedCount,
        errorCount,
        updates,
      };
    } catch (error: any) {
      console.error("❌ Error in migrateInventoryNormalization:", error);
      throw new functions.https.HttpsError("internal", error.message);
    }
  });  
  
// HTTP endpoint para subir imagen - us-central1 (cerca del Storage)  
export const uploadReceipt = functions  
  .region("us-central1")  
  .https.onRequest(async (req, res) => {  
    // Validar método
    if (req.method !== "POST") {  
      res.status(405).send("Method Not Allowed");  
      return;  
    }  
  
    try {  
      let userId: string;  
  
      // ✅ DETECTAR SI ESTAMOS EN EMULADORES  
      const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";  
  
      if (isEmulator) {  
        // En emuladores: usar userId simulado sin validar token  
        userId = "test-user-123";  
        console.log("🔧 Modo emulador detectado: usando userId simulado");  
      } else {  
        // En producción: validar token de Firebase Auth  
        const authHeader = req.headers.authorization;  
        if (!authHeader?.startsWith("Bearer ")) {  
          res.status(401).send("Unauthorized");  
          return;  
        }  
  
        const token = authHeader.split("Bearer ")[1];  
        const decodedToken = await admin.auth().verifyIdToken(token);  
        userId = decodedToken.uid;  
        console.log("🔐 Modo producción: token validado correctamente");  
      }  
  
      // Obtener imagen del body  
      const {imageBase64} = req.body;  
      if (!imageBase64) {  
        res.status(400).json({error: "imageBase64 is required"});  
        return;  
      }  
  
      // Subir a Cloud Storage  
      const bucket = admin.storage().bucket();  
      const fileName = `receipts/${userId}/${Date.now()}.jpg`;  
      const file = bucket.file(fileName);  
  
      const buffer = Buffer.from(imageBase64, "base64");  
      await file.save(buffer, {  
        metadata: {  
          contentType: "image/jpeg",  
          metadata: {userId},  
        },  
      });  
  
      // Obtener URL firmada  
      const [url] = await file.getSignedUrl({  
        action: "read",  
        expires: Date.now() + 3600000, // 1 hora  
      });  
  
      // Procesar con parseReceipt  
      const result = await parseReceipt.run(  
        {imageUri: url},  
        {auth: {uid: userId}} as any  
      );  
  
      res.status(200).json({  
        success: true,  
        draftId: result.draftId,  
        imageUrl: url,  
        draft: result.draft,  
      });  
    } catch (error: any) {  
      console.error("Error en uploadReceipt:", error);  
      res.status(500).json({  
        error: "Internal Server Error",  
        message: error.message,  
      });  
    }  
  });  
  
// Storage trigger automático - us-central1 (donde está el bucket)  
export const onReceiptUploaded = functions  
  .region("us-central1")  
  .storage.object()  
  .onFinalize(async (object) => {  
    const filePath = object.name;  
  
    if (!filePath?.startsWith("receipts/")) {  
      return;  
    }  
  
    const pathParts = filePath.split("/");  
    if (pathParts.length < 3) {  
      return;  
    }  
    const userId = pathParts[1];  
  
    try {  
      const bucket = admin.storage().bucket(object.bucket);  
      const file = bucket.file(filePath);  
      const [url] = await file.getSignedUrl({  
        action: "read",  
        expires: Date.now() + 3600000,  
      });  
  
      await parseReceipt.run(  
        {imageUri: url},  
        {auth: {uid: userId}} as any  
      );  
  
      console.log(`✅ Ticket procesado: ${filePath}`);  
    } catch (error) {  
      console.error("❌ Error en onReceiptUploaded:", error);  
    }  
  });  
  
// Función de sincronización Firestore → Room - europe-west1 (compatible con eur3)  
export const syncInventoryToDevice = functions  
  .region("europe-west1")  
  .firestore.document("users/{userId}/inventory/{itemId}")  
  .onWrite(async (change, context) => {  
    const userId = context.params.userId;  
    const itemId = context.params.itemId;  
  
    // Obtener token FCM del usuario (si existe)  
    const userDoc = await admin  
      .firestore()  
      .collection("users")  
      .doc(userId)  
      .get();  
  
    const fcmToken = userDoc.data()?.fcmToken;  
    if (!fcmToken) {  
      console.log(`No FCM token for user ${userId}`);  
      return;  
    }  
  
    // Enviar notificación de sincronización  
    const message = {  
      token: fcmToken,  
      data: {  
        type: "INVENTORY_SYNC",  
        itemId: itemId,  
        action: change.after.exists ? "UPDATE" : "DELETE",  
      },  
    };  
  
    try {  
      await admin.messaging().send(message);  
      console.log(`✅ Sync notification sent to ${userId}`);  
    } catch (error) {  
      console.error("❌ Error sending sync notification:", error);  
    }  
  });
