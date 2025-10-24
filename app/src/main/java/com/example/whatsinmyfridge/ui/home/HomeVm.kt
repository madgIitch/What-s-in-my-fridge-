package com.example.whatsinmyfridge.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.whatsinmyfridge.data.repository.InventoryRepository
import com.example.whatsinmyfridge.domain.model.FoodItemUi
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn

class HomeVm(repo: InventoryRepository) : ViewModel() {
    val items: StateFlow<List<FoodItemUi>> = repo.observeUi()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
}