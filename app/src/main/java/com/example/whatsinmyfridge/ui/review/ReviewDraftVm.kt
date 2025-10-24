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
    private val inventoryRepository: InventoryRepository
) : ViewModel() {

    private val _draft = MutableStateFlow<ParsedDraftEntity?>(null)
    val draft: StateFlow<ParsedDraftEntity?> = _draft.asStateFlow()

    private val _parsedItems = MutableStateFlow<List<ParsedItem>>(emptyList())
    val parsedItems: StateFlow<List<ParsedItem>> = _parsedItems.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isSaving = MutableStateFlow(false)
    val isSaving: StateFlow<Boolean> = _isSaving.asStateFlow()

    init {
        loadDraft()
    }

    private fun loadDraft() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                // Cargar el borrador desde el repositorio
                // Nota: Necesitarás agregar getById() a DraftRepository
                // val draft = draftRepository.getById(draftId)
                // _draft.value = draft

                // Parsear el JSON de líneas
                _draft.value?.let { draft ->
                    val items = parseLineItems(draft.linesJson)
                    _parsedItems.value = items
                }
            } catch (e: Exception) {
                println("Error cargando borrador: ${e.message}")
            } finally {
                _isLoading.value = false
            }
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
                // Convertir cada ParsedItem a FoodItemEntity
                _parsedItems.value.forEach { parsedItem ->
                    // ✅ Ahora dateString es realmente String
                    val expiryDate = parsedItem.expiryDate?.let { dateString ->
                        try {
                            LocalDate.parse(dateString)  // ✅ Funciona correctamente
                        } catch (e: Exception) {
                            LocalDate.now().plusDays(7)  // Fallback si el parsing falla
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

                // Eliminar el borrador después de confirmar
                _draft.value?.let { draft ->
                    draftRepository.deleteDraft(draft)
                }
            } catch (e: Exception) {
                println("Error confirmando borrador: ${e.message}")
            } finally {
                _isSaving.value = false
            }
        }
    }    /**
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