package com.example.whatsinmyfridge.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.whatsinmyfridge.data.repository.InventoryRepository
import com.example.whatsinmyfridge.domain.model.FoodItemUi
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/**
 * ViewModel para la pantalla principal (HomeScreen).
 *
 * Gestiona el estado de la lista de alimentos y expone operaciones
 * para interactuar con el inventario.
 *
 * @param inventoryRepository Repositorio que provee acceso a los datos de inventario
 */
class HomeVm(
    private val inventoryRepository: InventoryRepository
) : ViewModel() {

    /**
     * Estado reactivo de la lista de items de comida.
     *
     * Se actualiza automáticamente cuando cambian los datos en la base de datos.
     * El StateFlow se mantiene activo mientras haya suscriptores activos (5 segundos
     * después de que el último suscriptor se desconecte).
     */
    val items: StateFlow<List<FoodItemUi>> = inventoryRepository
        .observeUi()
        .catch { exception ->
            // Log del error (en producción usar un logger apropiado)
            println("Error observando items: ${exception.message}")
            emit(emptyList())
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(stopTimeoutMillis = 5000),
            initialValue = emptyList()
        )

    /**
     * Elimina un item del inventario.
     *
     * @param item Item a eliminar
     */
    fun deleteItem(item: FoodItemUi) {
        viewModelScope.launch {
            try {
                // Cambiar de item.entity a item.entity.id
                inventoryRepository.deleteItem(item.entity.id)
            } catch (e: Exception) {
                println("Error eliminando item: ${e.message}")
            }
        }
    }

    /**
     * Marca un item como consumido (lo elimina del inventario).
     *
     * @param item Item consumido
     */
    fun markAsConsumed(item: FoodItemUi) {
        deleteItem(item)
    }
}