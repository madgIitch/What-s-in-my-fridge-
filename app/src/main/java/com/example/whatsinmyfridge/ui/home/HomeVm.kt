package com.example.whatsinmyfridge.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.whatsinmyfridge.data.repository.InventoryRepository
import com.example.whatsinmyfridge.domain.model.FoodItemUi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

@HiltViewModel
class HomeVm @Inject constructor(repo: InventoryRepository) : ViewModel() {
    val items: StateFlow<List<FoodItemUi>> =
        repo.observeUi().stateIn(viewModelScope, SharingStarted.WhileSubscribed(), emptyList())
}
