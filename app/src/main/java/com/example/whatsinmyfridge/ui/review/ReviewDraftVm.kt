package com.example.whatsinmyfridge.ui.review

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.whatsinmyfridge.data.local.db.FoodItemEntity
import com.example.whatsinmyfridge.data.local.db.ParsedDraftEntity
import com.example.whatsinmyfridge.data.repository.DraftRepository
import com.example.whatsinmyfridge.data.repository.InventoryRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.Serializable
import java.time.LocalDate
import com.example.whatsinmyfridge.data.repository.PrefsRepository
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import com.google.firebase.firestore.firestore
import kotlinx.coroutines.tasks.await

/**
 * ViewModel para la pantalla de revisión de borradores OCR.
 *
 * Permite al usuario revisar, editar y confirmar los resultados del escaneo
 * antes de convertirlos en items definitivos del inventario.
 *
 * @param draftId ID del borrador a revisar
 * @param draftRepository Repositorio para gestionar borradores
 * @param inventoryRepository Repositorio para añadir items al inventario
 */



class ReviewDraftVm(
    private val draftId: Long,
    private val draftRepository: DraftRepository,
    private val inventoryRepository: InventoryRepository,
    private val prefsRepository: PrefsRepository
) : ViewModel() {

    private val _draft = MutableStateFlow<ParsedDraftEntity?>(null)
    val draft: StateFlow<ParsedDraftEntity?> = _draft.asStateFlow()

    private val _parsedItems = MutableStateFlow<List<ParsedItem>>(emptyList())
    val parsedItems: StateFlow<List<ParsedItem>> = _parsedItems.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isSaving = MutableStateFlow(false)
    val isSaving: StateFlow<Boolean> = _isSaving.asStateFlow()

    private val _showUnrecognizedDialog = MutableStateFlow(false)
    val showUnrecognizedDialog: StateFlow<Boolean> = _showUnrecognizedDialog.asStateFlow()

    private val _unrecognizedLines = MutableStateFlow<List<String>>(emptyList())
    val unrecognizedLines: StateFlow<List<String>> = _unrecognizedLines.asStateFlow()

    init {
        loadDraft()
    }

    private fun loadDraft() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val draft = draftRepository.getById(draftId)
                _draft.value = draft

                // ✅ Usar 'draft' en lugar de 'it'
                draft?.let {
                    val items = parseLineItems(it.linesJson)
                    _parsedItems.value = items

                    val unrecognized = parseUnrecognizedLines(it.unrecognizedLines)
                    _unrecognizedLines.value = unrecognized
                }
            } catch (e: Exception) {
                println("Error cargando borrador: ${e.message}")
            } finally {
                _isLoading.value = false
            }
        }
    }
    // Método para parsear líneas no reconocidas
    private fun parseUnrecognizedLines(json: String): List<String> {
        return try {
            if (json.isBlank() || json == "[]") {
                emptyList()
            } else {
                Json.decodeFromString<List<String>>(json)
            }
        } catch (e: Exception) {
            println("Error parseando líneas no reconocidas: ${e.message}")
            emptyList()
        }
    }

    private fun parseLineItems(linesJson: String): List<ParsedItem> {
        return try {
            if (linesJson.isBlank() || linesJson == "[]") {
                emptyList()
            } else {
                Json.decodeFromString<List<ParsedItem>>(linesJson)
            }
        } catch (e: Exception) {
            println("Error parseando líneas: ${e.message}")
            emptyList()
        }
    }

    /**
     * Actualiza un item parseado en la lista.
     */
    fun updateParsedItem(index: Int, updatedItem: ParsedItem) {
        val currentItems = _parsedItems.value.toMutableList()
        if (index in currentItems.indices) {
            currentItems[index] = updatedItem
            _parsedItems.value = currentItems
        }
    }

    /**
     * Elimina un item parseado de la lista.
     */
    fun removeParsedItem(index: Int) {
        val currentItems = _parsedItems.value.toMutableList()
        if (index in currentItems.indices) {
            currentItems.removeAt(index)
            _parsedItems.value = currentItems
        }
    }

    /**
     * Confirma el borrador y convierte los items parseados en items del inventario.
     */


    fun confirmDraft() {
        viewModelScope.launch {
            _isSaving.value = true
            try {
                // 1. Convertir cada ParsedItem a FoodItemEntity y guardar en inventario
                _parsedItems.value.forEach { parsedItem ->
                    val expiryDate = parsedItem.expiryDate?.let { dateString ->
                        try {
                            LocalDate.parse(dateString)
                        } catch (e: Exception) {
                            LocalDate.now().plusDays(7)
                        }
                    } ?: LocalDate.now().plusDays(7)

                    val foodItem = FoodItemEntity(
                        name = parsedItem.name,
                        expiryDate = expiryDate,
                        category = parsedItem.category,
                        quantity = parsedItem.quantity,
                        notes = "Escaneado de ticket",
                        source = "ocr"
                    )
                    inventoryRepository.addItem(foodItem)
                }

                // 2. Subir draft a Firestore si cloudConsent está activado
                _draft.value?.let { draft ->
                    if (prefsRepository.cloudConsent.first()) {
                        saveDraftToFirestore(draft)
                    }
                }

                // 3. Verificar si hay líneas no reconocidas
                if (_unrecognizedLines.value.isNotEmpty()) {
                    _showUnrecognizedDialog.value = true
                } else {
                    // Si no hay líneas no reconocidas, eliminar draft local y finalizar
                    _draft.value?.let { draft ->
                        draftRepository.deleteDraft(draft)
                    }
                }
            } catch (e: Exception) {
                println("Error confirmando borrador: ${e.message}")
            } finally {
                _isSaving.value = false
            }
        }
    }

    /**
     * Sube el draft parseado a Firestore para historial de escaneos
     */
    private suspend fun saveDraftToFirestore(draft: ParsedDraftEntity) {
        try {
            val userId = Firebase.auth.currentUser?.uid ?: return

            Firebase.firestore.collection("users")
                .document(userId)
                .collection("scans")
                .add(mapOf(
                    "merchant" to draft.merchant,
                    "purchaseDate" to draft.purchaseDate,
                    "currency" to draft.currency,
                    "total" to draft.total,
                    "linesJson" to draft.linesJson,
                    "rawText" to draft.rawText,
                    "unrecognizedLines" to draft.unrecognizedLines,
                    "timestamp" to System.currentTimeMillis()
                ))
                .await()

            println("✅ Draft subido a Firestore correctamente")
        } catch (e: Exception) {
            println("⚠️ Error subiendo draft a Firestore: ${e.message}")
            // No lanzar excepción para no bloquear el flujo principal
        }
    }
    // ← NUEVO: Método para finalizar después del diálogo
    fun finishReview() {
        viewModelScope.launch {
            try {
                _draft.value?.let { draft ->
                    draftRepository.deleteDraft(draft)
                }
            } catch (e: Exception) {
                println("Error eliminando borrador: ${e.message}")
            }
        }
    }

    // ← NUEVO: Añadir línea no reconocida como item
    fun addUnrecognizedAsItem(line: String) {
        val newItem = ParsedItem(
            name = line,
            quantity = 1,
            price = null,
            expiryDate = null,
            category = null
        )
        val currentItems = _parsedItems.value.toMutableList()
        currentItems.add(newItem)
        _parsedItems.value = currentItems
    }


    /**
     * Descarta el borrador sin guardar los items.
     */
    fun discardDraft() {
        viewModelScope.launch {
            try {
                _draft.value?.let { draft ->
                    draftRepository.deleteDraft(draft)
                }
            } catch (e: Exception) {
                println("Error descartando borrador: ${e.message}")
            }
        }
    }
}

/**
 * Representa un item parseado del ticket.
 */
@Serializable
data class ParsedItem(
    val name: String,
    val quantity: Int = 1,
    val price: Double? = null,
    val expiryDate: String? = null,
    val category: String? = null
)