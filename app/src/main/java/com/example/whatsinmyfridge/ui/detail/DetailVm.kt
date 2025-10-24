package com.example.whatsinmyfridge.ui.detail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.whatsinmyfridge.data.local.db.FoodItemEntity
import com.example.whatsinmyfridge.data.repository.InventoryRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.time.LocalDate

class DetailVm(
    private val itemId: Long,
    private val inventoryRepository: InventoryRepository
) : ViewModel() {

    private val _item = MutableStateFlow<FoodItemEntity?>(null)
    val item: StateFlow<FoodItemEntity?> = _item.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    init {
        loadItem()
    }

    private fun loadItem() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                // Necesitarás agregar este método a InventoryRepository
                // val item = inventoryRepository.getItemById(itemId)
                // _item.value = item
            } catch (e: Exception) {
                println("Error cargando item: ${e.message}")
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun updateItem(
        name: String,
        expiryDate: LocalDate,
        category: String?,
        quantity: Int,
        notes: String?
    ) {
        viewModelScope.launch {
            _item.value?.let { current ->
                val updated = current.copy(
                    name = name,
                    expiryDate = expiryDate,
                    category = category,
                    quantity = quantity,
                    notes = notes
                )
                try {
                    // Necesitarás agregar este método a InventoryRepository
                    // inventoryRepository.updateItem(updated)
                } catch (e: Exception) {
                    println("Error actualizando item: ${e.message}")
                }
            }
        }
    }

    fun deleteItem() {
        viewModelScope.launch {
            _item.value?.let { current ->
                try {
                    inventoryRepository.deleteItem(current.id)
                } catch (e: Exception) {
                    println("Error eliminando item: ${e.message}")
                }
            }
        }
    }
}