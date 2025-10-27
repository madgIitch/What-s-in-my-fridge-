package com.example.whatsinmyfridge.ui.scan

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.whatsinmyfridge.data.local.db.ParsedDraftEntity
import com.example.whatsinmyfridge.data.repository.DraftRepository
import com.example.whatsinmyfridge.ui.review.ParsedItem
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

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
        println("========== INICIO PARSING OCR ==========")
        println("Texto completo recibido (${text.length} caracteres):")
        println(text)
        println("========================================")

        val lines = text.lines()
        println("\nTotal de líneas detectadas: ${lines.size}")

        // Buscar merchant (ignorar productos, buscar nombre de tienda)
        println("\n--- BUSCANDO MERCHANT ---")
        val merchant = lines
            .firstOrNull { line ->
                val isValid = line.isNotBlank() &&
                        line.contains("Str.") || line.contains("Damm") ||
                        (line.length > 10 && !line.matches(Regex(""".*\d+[.,]\d{2}.*""")))
                if (isValid) {
                    println("✓ Merchant encontrado: '$line'")
                }
                isValid
            }?.trim()
        println("Merchant final: ${merchant ?: "NO ENCONTRADO"}")

        // Buscar fecha
        println("\n--- BUSCANDO FECHA ---")
        val dateRegex = Regex("""(\d{2}[./]\d{2}[./]\d{4})|(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})""")
        val date = dateRegex.find(text)?.value?.take(10) // Solo fecha, sin hora
        println("Fecha encontrada: ${date ?: "NO ENCONTRADA"}")

        // Buscar total - buscar "SUMME" y luego el número más cercano
        println("\n--- BUSCANDO TOTAL ---")
        val summeIndex = lines.indexOfFirst { it.trim() == "SUMME" }
        var total: Double? = null
        if (summeIndex >= 0) {
            // Buscar número en las siguientes 5 líneas
            for (i in summeIndex + 1 until minOf(summeIndex + 6, lines.size)) {
                val amountRegex = Regex("""^(\d+),?\s*(\d{2})$""")
                val match = amountRegex.find(lines[i].trim())
                if (match != null) {
                    val euros = match.groupValues[1]
                    val cents = match.groupValues[2]
                    total = "$euros.$cents".toDoubleOrNull()
                    println("✓ Total encontrado en línea $i: '${lines[i]}' → €$total")
                    break
                }
            }
        }
        if (total == null) {
            println("✗ Total NO ENCONTRADO")
        }

        // Buscar items
        println("\n--- BUSCANDO ITEMS ---")
        val items = mutableListOf<ParsedItem>()

        // Patrón 1: "NOMBRE EUR X,XX A/B" (E-Center)
        val pattern1 = Regex("""^([A-ZÄÖÜ][A-ZÄÖÜa-zäöü\s.]+?)\s+(?:EUR\s+)?(\d+[.,]\d{2})\s+[AB]$""")

        // Patrón 2: Solo precio "X,XX B" o "X, XX B" (con espacio opcional)
        val pattern2Standalone = Regex("""^(\d+),?\s*(\d{2})\s+B$""")

        // Patrón 3: "NOMBRE" seguido de peso en siguiente línea
        val pattern3 = Regex("""^([A-ZÄÖÜ][A-ZÄÖÜa-zäöü\s.]+)$""")
        // Patrón 3b: Peso con espacio opcional después de coma
        val pattern3b = Regex("""^\s*(\d+),?\s*(\d+)\s*kg\s*x\s*(\d+[.,]\d{2})\s*EUR/kg""")

        // Mapear nombres a precios
        val productNames = mutableListOf<String>()
        val productPrices = mutableListOf<Double>()

        var i = 0
        while (i < lines.size) {
            val line = lines[i].trim()
            println("\nLínea $i: '$line'")

            // Ignorar metadata
            if (line.contains("Tel") || line.contains("UID") ||
                line.contains("Steuer") || line.contains("Geg.") ||
                line.contains("TSE-") || line.contains("Zahlung") ||
                line.contains("Beleg") || line.isEmpty() ||
                line.contains("Netto") || line.contains("Brutto") ||
                line.contains("Gesamtbetrag") || line == "EUR" ||
                line.matches(Regex("""\d{7,}""")) || // IDs largos
                line.contains("SUMME") || line.contains("Str.") ||
                line.matches(Regex("""[a-zA-Z0-9+/]{20,}"""))) { // Firmas
                println("  → IGNORADA (metadata/vacía)")
                i++
                continue
            }

            // Patrón 1: E-Center
            pattern1.find(line)?.let { match ->
                println("  ✓ PATRÓN 1 (E-Center)")
                println("    Nombre: '${match.groupValues[1].trim()}'")
                println("    Precio: '${match.groupValues[2]}'")
                items.add(ParsedItem(
                    name = match.groupValues[1].trim(),
                    quantity = 1,
                    price = match.groupValues[2].replace(",", ".").toDoubleOrNull()
                ))
                i++
                return@let
            }

            // Patrón 2: Precio standalone
            pattern2Standalone.find(line)?.let { match ->
                val euros = match.groupValues[1]
                val cents = match.groupValues[2]
                val price = "$euros.$cents".toDoubleOrNull()
                println("  ✓ PATRÓN 2 (Precio standalone)")
                println("    Precio: €$price")
                productPrices.add(price ?: 0.0)
                i++
                return@let
            }

            // Patrón 3: Nombre + peso
            pattern3.find(line)?.let { nameMatch ->
                if (i + 1 < lines.size) {
                    val nextLine = lines[i + 1]
                    println("  ? PATRÓN 3 (nombre detectado)")
                    println("    Nombre: '${nameMatch.groupValues[1].trim()}'")
                    println("    Siguiente línea: '$nextLine'")

                    pattern3b.find(nextLine)?.let { priceMatch ->
                        val weightInt = priceMatch.groupValues[1]
                        val weightDec = priceMatch.groupValues[2]
                        val weight = "$weightInt.$weightDec".toDoubleOrNull() ?: 1.0
                        val pricePerKg = priceMatch.groupValues[3].replace(",", ".").toDoubleOrNull()
                        val totalPrice = pricePerKg?.times(weight)

                        println("  ✓ PATRÓN 3 COMPLETO")
                        println("    Peso: ${weight}kg")
                        println("    Precio/kg: €$pricePerKg")
                        println("    Precio total: €$totalPrice")

                        items.add(ParsedItem(
                            name = "${nameMatch.groupValues[1].trim()} (${weight}kg)",
                            quantity = 1,
                            price = totalPrice
                        ))
                        i += 2
                        return@let
                    }
                    println("  ✗ Siguiente línea no coincide con patrón de peso")
                }
                // Si no hay peso, guardar nombre para emparejar después
                productNames.add(nameMatch.groupValues[1].trim())
            }

            println("  ✗ NO COINCIDE con ningún patrón")
            i++
        }

        // Emparejar nombres con precios
        val minSize = minOf(productNames.size, productPrices.size)
        for (j in 0 until minSize) {
            items.add(ParsedItem(
                name = productNames[j],
                quantity = 1,
                price = productPrices[j]
            ))
            println("  ✓ Emparejado: ${productNames[j]} → €${productPrices[j]}")
        }

        println("\n========== RESUMEN PARSING ==========")
        println("Merchant: ${merchant ?: "N/A"}")
        println("Fecha: ${date ?: "N/A"}")
        println("Total: €${total ?: "N/A"}")
        println("Items encontrados: ${items.size}")
        items.forEachIndexed { index, item ->
            println("  ${index + 1}. ${item.name} - €${item.price ?: "N/A"}")
        }
        println("=====================================\n")

        return ParsedReceiptInfo(
            merchant = merchant,
            date = date,
            total = total,
            currency = "EUR",
            itemsJson = Json.encodeToString(items)
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