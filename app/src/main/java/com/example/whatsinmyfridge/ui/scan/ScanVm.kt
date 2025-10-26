package com.example.whatsinmyfridge.ui.scan

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.whatsinmyfridge.data.local.db.ParsedDraftEntity
import com.example.whatsinmyfridge.data.repository.DraftRepository
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

/**
 * ViewModel para la pantalla de escaneo de tickets.
 *
 * Gestiona el ciclo completo de escaneo:
 * - Captura de imágenes desde cámara o galería
 * - Procesamiento OCR con ML Kit Text Recognition
 * - Guardado de borradores en base de datos
 * - Manejo de estados de carga y errores
 *
 * @param draftRepository Repositorio para gestionar borradores de escaneo
 */
class ScanVm(
    private val draftRepository: DraftRepository
) : ViewModel() {

    // ========== Estados Privados ==========

    private val _isProcessing = MutableStateFlow(false)
    val isProcessing: StateFlow<Boolean> = _isProcessing.asStateFlow()

    private val _capturedImageUri = MutableStateFlow<Uri?>(null)
    val capturedImageUri: StateFlow<Uri?> = _capturedImageUri.asStateFlow()

    private val _ocrResult = MutableStateFlow<String?>(null)
    val ocrResult: StateFlow<String?> = _ocrResult.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private val _savedDraftId = MutableStateFlow<Long?>(null)
    val savedDraftId: StateFlow<Long?> = _savedDraftId.asStateFlow()

    // ========== Métodos Públicos ==========

    /**
     * Procesa una imagen capturada con OCR.
     *
     * Flujo de procesamiento:
     * 1. Actualiza estado de carga
     * 2. Ejecuta OCR sobre la imagen (actualmente simulado)
     * 3. Parsea el texto para extraer información estructurada
     * 4. Guarda el borrador en base de datos
     * 5. Emite el ID del borrador guardado para navegación
     *
     * @param imageUri URI de la imagen a procesar (desde cámara o galería)
     */
    fun processImage(context: Context, imageUri: Uri) {
        viewModelScope.launch {
            _isProcessing.value = true
            _capturedImageUri.value = imageUri
            _errorMessage.value = null
            _savedDraftId.value = null

            try {
                // Crear InputImage desde URI
                val inputImage = InputImage.fromFilePath(context, imageUri)

                // Procesar con TextRecognizer
                val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
                val result = recognizer.process(inputImage).await()
                val rawText = result.text

                _ocrResult.value = rawText

                // Parsear información del texto OCR real
                val parsedInfo = parseSimulatedText(rawText) // Reutiliza el parser existente temporalmente

                // Crear entidad de borrador
                val draft = ParsedDraftEntity(
                    rawText = rawText,
                    merchant = parsedInfo.merchant,
                    purchaseDate = parsedInfo.date,
                    currency = parsedInfo.currency,
                    total = parsedInfo.total,
                    linesJson = parsedInfo.itemsJson
                )

                // Guardar en base de datos y obtener ID
                val draftId = draftRepository.saveDraft(draft)
                _savedDraftId.value = draftId

            } catch (e: Exception) {
                handleError(e)
            } finally {
                _isProcessing.value = false
            }
        }
    }
    /**
     * Limpia todos los estados después de procesar una imagen.
     * Útil para resetear la pantalla antes de un nuevo escaneo.
     */
    fun clearState() {
        _capturedImageUri.value = null
        _ocrResult.value = null
        _errorMessage.value = null
        _savedDraftId.value = null
    }

    /**
     * Descarta el mensaje de error actual.
     * Permite al usuario cerrar el diálogo de error.
     */
    fun dismissError() {
        _errorMessage.value = null
    }

    // ========== Métodos Privados ==========

    /**
     * Genera texto OCR simulado para testing.
     * Simula un ticket de supermercado típico.
     */
    private fun buildSimulatedOcrText(): String {
        return """  
            MERCADONA S.A.  
            C/ Valencia 123, Madrid  
            CIF: A46103834  
              
            TICKET: 2025-001234  
            Fecha: 12/01/2025 14:30  
              
            Leche Entera 1L        1.20€  
            Pan Integral 500g      1.50€  
            Tomates 1kg            2.30€  
            Yogur Natural x4       2.80€  
            Aceite Oliva 1L        5.90€  
              
            TOTAL:                13.70€  
              
            IVA 10%:               1.25€  
              
            Gracias por su compra  
        """.trimIndent()
    }

    /**
     * Parsea el texto simulado para extraer información estructurada.
     * En producción, esto se reemplazaría con lógica de parsing real.
     */
    private fun parseSimulatedText(text: String): ParsedReceiptInfo {
        return ParsedReceiptInfo(
            merchant = "Mercadona",
            date = "12/01/2025",
            currency = "EUR",
            total = 13.70,
            itemsJson = """  
                [  
                    {"name": "Leche Entera 1L", "quantity": 1, "price": 1.20},  
                    {"name": "Pan Integral 500g", "quantity": 1, "price": 1.50},  
                    {"name": "Tomates 1kg", "quantity": 1, "price": 2.30},  
                    {"name": "Yogur Natural x4", "quantity": 4, "price": 2.80},  
                    {"name": "Aceite Oliva 1L", "quantity": 1, "price": 5.90}  
                ]  
            """.trimIndent()
        )
    }

    /**
     * Maneja errores durante el procesamiento OCR.
     * Categoriza errores y genera mensajes apropiados para el usuario.
     */
    private fun handleError(exception: Exception) {
        val userMessage = when (exception) {
            is java.io.IOException -> "Error al leer la imagen. Verifica los permisos."
            is SecurityException -> "Permiso denegado para acceder a la imagen."
            else -> "Error procesando imagen: ${exception.message}"
        }

        _errorMessage.value = userMessage

        // Log para debugging (en producción usar un logger apropiado)
        println("Error en OCR: ${exception.javaClass.simpleName} - ${exception.message}")
        exception.printStackTrace()
    }

    // ========== Clases de Datos Internas ==========

    /**
     * Información parseada de un ticket.
     * Estructura intermedia antes de crear ParsedDraftEntity.
     */
    private data class ParsedReceiptInfo(
        val merchant: String?,
        val date: String?,
        val currency: String,
        val total: Double?,
        val itemsJson: String
    )
}