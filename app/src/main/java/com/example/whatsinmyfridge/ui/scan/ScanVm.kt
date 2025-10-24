package com.example.whatsinmyfridge.ui.scan

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.whatsinmyfridge.data.local.db.ParsedDraftEntity
import com.example.whatsinmyfridge.data.repository.DraftRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * ViewModel para la pantalla de escaneo de tickets.
 *
 * Gestiona la captura de imágenes, procesamiento OCR y guardado de borradores.
 *
 * @param draftRepository Repositorio para gestionar borradores de escaneo
 */
class ScanVm(
    private val draftRepository: DraftRepository
) : ViewModel() {

    private val _isProcessing = MutableStateFlow(false)
    val isProcessing: StateFlow<Boolean> = _isProcessing.asStateFlow()

    private val _capturedImageUri = MutableStateFlow<Uri?>(null)
    val capturedImageUri: StateFlow<Uri?> = _capturedImageUri.asStateFlow()

    private val _ocrResult = MutableStateFlow<String?>(null)
    val ocrResult: StateFlow<String?> = _ocrResult.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    /**
     * Procesa una imagen capturada con OCR.
     *
     * @param imageUri URI de la imagen a procesar
     */
    fun processImage(imageUri: Uri) {
        viewModelScope.launch {
            _isProcessing.value = true
            _capturedImageUri.value = imageUri
            _errorMessage.value = null

            try {
                // TODO: Implementar OCR con ML Kit Text Recognition
                // val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
                // val inputImage = InputImage.fromFilePath(context, imageUri)
                // val result = recognizer.process(inputImage).await()
                // val text = result.text

                // Por ahora, simulamos el resultado
                val simulatedText = "Texto OCR simulado\nMercadona\n12/01/2025\nTotal: 45.67€"
                _ocrResult.value = simulatedText

                // Guardar borrador
                val draft = ParsedDraftEntity(
                    rawText = simulatedText,
                    merchant = "Mercadona", // Extraer del texto OCR
                    purchaseDate = "12/01/2025", // Extraer del texto OCR
                    currency = "EUR",
                    total = 45.67, // Extraer del texto OCR
                    linesJson = "[]" // Parsear líneas de productos
                )

                draftRepository.saveDraft(draft)

            } catch (e: Exception) {
                _errorMessage.value = "Error procesando imagen: ${e.message}"
                println("Error en OCR: ${e.message}")
            } finally {
                _isProcessing.value = false
            }
        }
    }

    /**
     * Limpia el estado después de procesar una imagen.
     */
    fun clearState() {
        _capturedImageUri.value = null
        _ocrResult.value = null
        _errorMessage.value = null
    }

    /**
     * Descarta el error actual.
     */
    fun dismissError() {
        _errorMessage.value = null
    }
}