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
                    linesJson = parsedInfo.itemsJson,
                    unrecognizedLines = parsedInfo.unrecognizedLinesJson
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

        // Buscar merchant - buscar líneas con "Center", "Str.", "Damm"
        println("\n--- BUSCANDO MERCHANT ---")
        val merchant = lines
            .firstOrNull { line ->
                val isValid = line.contains("Center", ignoreCase = true) ||
                        line.contains("Str.") ||
                        line.contains("Damm")
                if (isValid) {
                    println("✓ Merchant encontrado: '$line'")
                }
                isValid
            }?.trim()
        println("Merchant final: ${merchant ?: "NO ENCONTRADO"}")

        // Buscar fecha
        println("\n--- BUSCANDO FECHA ---")
        val dateRegex = Regex("""(\d{2}[./]\d{2}[./]\d{4})|(\d{4}-\d{2}-\d{2})""")
        val date = dateRegex.find(text)?.value?.take(10)
        println("Fecha encontrada: ${date ?: "NO ENCONTRADA"}")

        // Buscar total - buscar "SUMME" y luego el número más cercano
        println("\n--- BUSCANDO TOTAL ---")
        val summeIndex = lines.indexOfFirst { it.trim().startsWith("SUMME") }
        var total: Double? = null
        if (summeIndex >= 0) {
            for (i in summeIndex + 1 until minOf(summeIndex + 30, lines.size)) {
                val amountRegex = Regex("""^(\d+),(\d{2})$""")
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

        println("\n--- BUSCANDO ITEMS ---")
        val items = mutableListOf<ParsedItem>()
        val unrecognizedLines = mutableListOf<String>()

        // ESTRATEGIA PARA E-CENTER: Recolectar nombres y precios por separado
        val productNames = mutableListOf<String>()
        val productPrices = mutableListOf<Double>()

        // Patrón para nombres de productos (líneas que empiezan con mayúscula/letra, sin números al final)
        val namePattern = Regex("""^([A-ZÄÖÜ&][A-ZÄÖÜa-zäöü&.\s-]+)$""")

        // Patrón para precios E-Center: "X,XX A" (con categoría fiscal A)
        val pricePatternA = Regex("""^(\d+),(\d{2})\s+A$""")

        // Patrón para precios Kaiserin-Augusta: "X,XX B" o "X, XX B"
        val pricePatternB = Regex("""^(\d+),?\s*(\d{2})\s+B$""")

        // Patrón para peso: "X,XXX kg x X,XX EUR/kg"
        val weightPattern = Regex("""^\s*(\d+),?\s*(\d+)\s*kg\s*x\s*(\d+),(\d{2})\s*EUR/kg""")

        var i = 0
        while (i < lines.size) {
            val line = lines[i].trim()
            println("\nLínea $i: '$line'")

            // Ignorar metadata conocida
            if (line.isEmpty() ||
                line.contains("Tel") || line.contains("UID") ||
                line.contains("Steuer") || line.contains("Geg.") ||
                line.contains("TSE-") || line.contains("Zahlung") ||
                line.contains("Beleg") || line.contains("Bitte") ||
                line.contains("Netto") || line.contains("Brutto") ||
                line.contains("Gesamtbetrag") || line == "EUR" ||
                line.contains("Posten:") || line.contains("SUMME") ||
                line.contains("Visa") || line.contains("Contactless") ||
                line.contains("Datum:") || line.contains("Uhrzeit:") ||
                line.contains("Beleg-Nr") || line.contains("Trace-Nr") ||
                line.contains("Terminal") || line.contains("Pos-Info") ||
                line.contains("AS-") || line.contains("Capt.") ||
                line.contains("AID") || line.contains("EMV-") ||
                line.contains("ProC-Code") || line.contains("Betrag") ||
                line.contains("Bezahlung") || line.contains("erfolgt") ||
                line.contains("aufbewahren") || line.contains("Kundenbeleg") ||
                line.matches(Regex("""\d{2}:\d{2}.*""")) || // Horas
                line.matches(Regex("""\d{5,}""")) || // IDs largos
                line.matches(Regex("""[#*]+.*""")) || // Líneas con símbolos
                line.matches(Regex("""\d{2}\.\d{2}\.\d{4}""")) || // Fechas solas
                line.matches(Regex("""[A-Z]{2,}-[A-Z].*""")) || // Códigos tipo "VU-Nr"
                line.matches(Regex(""".*\d{2}\s+\d{3}\s+\d{2}.*"""))) { // Códigos numéricos
                println("  → IGNORADA (metadata)")
                i++
                continue
            }

            var matched = false

            // Intentar capturar precio E-Center (X,XX A)
            pricePatternA.find(line)?.let { match ->
                val euros = match.groupValues[1]
                val cents = match.groupValues[2]
                val price = "$euros.$cents".toDoubleOrNull()
                println("  ✓ PRECIO E-CENTER: €$price")
                if (price != null) {
                    productPrices.add(price)
                }
                matched = true
                i++
                return@let
            }

            // Intentar capturar precio Kaiserin-Augusta (X,XX B)
            if (!matched) {
                pricePatternB.find(line)?.let { match ->
                    val euros = match.groupValues[1]
                    val cents = match.groupValues[2]
                    val price = "$euros.$cents".toDoubleOrNull()
                    println("  ✓ PRECIO KAISERIN: €$price")
                    if (price != null) {
                        productPrices.add(price)
                    }
                    matched = true
                    i++
                    return@let
                }
            }

            // Intentar capturar nombre + peso en siguiente línea
            if (!matched) {
                namePattern.find(line)?.let { nameMatch ->
                    if (i + 1 < lines.size) {
                        val nextLine = lines[i + 1]
                        println("  ? NOMBRE DETECTADO: '${nameMatch.groupValues[1]}'")
                        println("    Siguiente línea: '$nextLine'")

                        weightPattern.find(nextLine)?.let { weightMatch ->
                            val weightInt = weightMatch.groupValues[1]
                            val weightDec = weightMatch.groupValues[2]
                            val weight = "$weightInt.$weightDec".toDoubleOrNull() ?: 1.0
                            val priceInt = weightMatch.groupValues[3]
                            val priceDec = weightMatch.groupValues[4]
                            val pricePerKg = "$priceInt.$priceDec".toDoubleOrNull()
                            val totalPrice = pricePerKg?.times(weight)

                            println("  ✓ ITEM CON PESO")
                            println("    Peso: ${weight}kg")
                            println("    Precio/kg: €$pricePerKg")
                            println("    Precio total: €$totalPrice")

                            items.add(ParsedItem(
                                name = "${nameMatch.groupValues[1].trim()} (${weight}kg)",
                                quantity = 1,
                                price = totalPrice
                            ))
                            matched = true
                            i += 2
                            return@let
                        }
                    }

                    // Si no hay peso, guardar como nombre para emparejar después
                    val name = nameMatch.groupValues[1].trim()
                    // Filtrar nombres que son claramente metadata
                    if (name.length > 3 &&
                        !name.contains("Berlin") &&
                        !name.contains("Debit") &&
                        !name.contains("Nr.")) {
                        println("  ✓ NOMBRE GUARDADO: '$name'")
                        productNames.add(name)
                        matched = true
                    }
                }
            }

            // Si ningún patrón coincidió, guardar como no reconocida
            if (!matched && line.length > 2) {
                println("  ⚠ LÍNEA NO RECONOCIDA: '$line'")
                unrecognizedLines.add(line)
            }

            if (!matched) {
                i++
            }
        }

        // Emparejar nombres con precios
        println("\n--- EMPAREJANDO NOMBRES Y PRECIOS ---")
        val minSize = minOf(productNames.size, productPrices.size)
        println("Nombres: ${productNames.size}, Precios: ${productPrices.size}")
        for (j in 0 until minSize) {
            items.add(ParsedItem(
                name = productNames[j],
                quantity = 1,
                price = productPrices[j]
            ))
            println("  ✓ ${productNames[j]} → €${productPrices[j]}")
        }

        println("\n--- LÍNEAS NO RECONOCIDAS ---")
        println("Total: ${unrecognizedLines.size}")
        unrecognizedLines.forEach { println("  - $it") }

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
            itemsJson = Json.encodeToString(items),
            unrecognizedLinesJson = Json.encodeToString(unrecognizedLines)
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
        val itemsJson: String,
        val unrecognizedLinesJson: String = "[]"
    )
}