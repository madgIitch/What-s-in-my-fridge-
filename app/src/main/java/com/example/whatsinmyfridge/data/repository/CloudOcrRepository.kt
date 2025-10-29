package com.example.whatsinmyfridge.data.repository

import android.net.Uri
import android.util.Base64
import com.example.whatsinmyfridge.data.local.db.ParsedDraftEntity
import com.google.firebase.auth.ktx.auth
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.functions.ktx.functions
import com.google.firebase.ktx.Firebase
import kotlinx.coroutines.tasks.await
import java.io.InputStream

/**
 * Repositorio para procesamiento OCR en la nube usando Firebase Cloud Functions.
 *
 * Envía imágenes de tickets al backend Firebase para procesamiento con Cloud Vision API,
 * retornando un ParsedDraftEntity compatible con el flujo de revisión local.
 */
class CloudOcrRepository {
    private val functions: FirebaseFunctions = Firebase.functions
    private val auth = Firebase.auth

    /**
     * Procesa una imagen de ticket usando Cloud Vision API via Firebase Functions.
     *
     * @param imageUri URI de la imagen (usado para logging, no se envía al backend)
     * @param inputStream Stream de la imagen a procesar
     * @return ParsedDraftEntity con los datos extraídos del ticket
     * @throws IllegalStateException si el usuario no está autenticado
     * @throws IllegalArgumentException si la respuesta del backend es inválida
     */
    suspend fun processReceiptWithCloud(
        imageUri: Uri,
        inputStream: InputStream
    ): ParsedDraftEntity {
        // ✅ Validar autenticación
        val currentUser = auth.currentUser
        if (currentUser == null) {
            throw IllegalStateException("Usuario debe estar autenticado para usar OCR en la nube")
        }

        // Convertir imagen a base64
        val bytes = inputStream.readBytes()
        val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)

        // Llamar a Cloud Function uploadReceipt
        val data = hashMapOf(
            "imageBase64" to base64
        )

        try {
            val result = functions
                .getHttpsCallable("uploadReceipt")
                .call(data)
                .await()

            // ✅ Validar estructura de respuesta
            val resultData = result.data as? Map<*, *>
                ?: throw IllegalArgumentException("Respuesta inválida del servidor: data no es un Map")

            val draft = resultData["draft"] as? Map<*, *>
                ?: throw IllegalArgumentException("Respuesta inválida del servidor: draft no encontrado")

            // ✅ Extraer campos con validación
            val rawText = draft["rawText"] as? String
                ?: throw IllegalArgumentException("Campo rawText es requerido")

            val currency = draft["currency"] as? String
                ?: throw IllegalArgumentException("Campo currency es requerido")

            val linesJson = draft["linesJson"] as? String
                ?: throw IllegalArgumentException("Campo linesJson es requerido")

            val unrecognizedLines = draft["unrecognizedLines"] as? String
                ?: throw IllegalArgumentException("Campo unrecognizedLines es requerido")

            return ParsedDraftEntity(
                rawText = rawText,
                merchant = draft["merchant"] as? String,
                purchaseDate = draft["purchaseDate"] as? String,
                currency = currency,
                total = (draft["total"] as? Number)?.toDouble(),
                linesJson = linesJson,
                unrecognizedLines = unrecognizedLines
            )
        } catch (e: Exception) {
            // Log del error para debugging
            println("Error procesando ticket con Cloud OCR: ${e.message}")
            throw e
        }
    }
}