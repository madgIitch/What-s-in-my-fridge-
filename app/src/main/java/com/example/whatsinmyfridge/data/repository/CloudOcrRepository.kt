package com.example.whatsinmyfridge.data.repository

import android.net.Uri
import android.util.Base64
import com.example.whatsinmyfridge.data.local.db.ParsedDraftEntity
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.functions.ktx.functions
import com.google.firebase.ktx.Firebase
import kotlinx.coroutines.tasks.await
import java.io.InputStream

class CloudOcrRepository {
    private val functions: FirebaseFunctions = Firebase.functions

    suspend fun processReceiptWithCloud(
        imageUri: Uri,
        inputStream: InputStream
    ): ParsedDraftEntity {
        // Convertir imagen a base64
        val bytes = inputStream.readBytes()
        val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)

        // Llamar a Cloud Function
        val data = hashMapOf(
            "imageBase64" to base64
        )

        val result = functions
            .getHttpsCallable("uploadReceipt")
            .call(data)
            .await()

        val resultData = result.data as Map<*, *>
        val draft = resultData["draft"] as Map<*, *>

        return ParsedDraftEntity(
            rawText = draft["rawText"] as String,
            merchant = draft["merchant"] as? String,
            purchaseDate = draft["purchaseDate"] as? String,
            currency = draft["currency"] as String,
            total = (draft["total"] as? Number)?.toDouble(),
            linesJson = draft["linesJson"] as String,
            unrecognizedLines = draft["unrecognizedLines"] as String
        )
    }
}