package com.example.whatsinmyfridge.data.repository

import com.example.whatsinmyfridge.data.local.FoodDao
import com.example.whatsinmyfridge.data.local.db.FoodItemEntity
import com.example.whatsinmyfridge.domain.model.ExpiryState
import com.example.whatsinmyfridge.domain.model.FoodItemUi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.time.LocalDate
import java.time.temporal.ChronoUnit

class InventoryRepository(private val dao: FoodDao) {

    fun observeUi(): Flow<List<FoodItemUi>> =
        dao.getAllFlow().map { list ->
            list.map { entity ->
                val days = ChronoUnit.DAYS.between(LocalDate.now(), entity.expiryDate)  // Sin .toInt()
                val state = when {
                    days < 0 -> ExpiryState.EXPIRED
                    days <= 3 -> ExpiryState.SOON
                    else -> ExpiryState.OK
                }
                FoodItemUi(entity, state, days)
            }
        }

    suspend fun addItem(item: FoodItemEntity) = dao.insert(item)

    suspend fun deleteItem(id: Long) = dao.deleteById(id)
}