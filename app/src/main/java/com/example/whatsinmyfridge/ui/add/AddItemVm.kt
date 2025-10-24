package com.example.whatsinmyfridge.ui.add

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.whatsinmyfridge.data.local.db.FoodItemEntity
import com.example.whatsinmyfridge.data.repository.InventoryRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate

class AddItemVm(
    private val inventoryRepository: InventoryRepository
) : ViewModel() {

    private val _isSaving = MutableStateFlow(false)
    val isSaving: StateFlow<Boolean> = _isSaving.asStateFlow()

    fun addItem(
        name: String,
        expiryDate: LocalDate,
        category: String?,
        quantity: Int,
        notes: String?
    ) {
        viewModelScope.launch {
            _isSaving.value = true
            try {
                val item = FoodItemEntity(
                    name = name,
                    expiryDate = expiryDate,
                    category = category,
                    quantity = quantity,
                    notes = notes,
                    source = "manual"
                )
                inventoryRepository.addItem(item)
            } catch (e: Exception) {
                println("Error añadiendo item: ${e.message}")
            } finally {
                _isSaving.value = false
            }
        }
    }
}