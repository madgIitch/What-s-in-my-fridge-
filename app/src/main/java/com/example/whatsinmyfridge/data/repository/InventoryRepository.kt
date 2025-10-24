package com.example.whatsinmyfridge.data.repository

import com.example.whatsinmyfridge.data.local.db.FoodDao
import com.example.whatsinmyfridge.data.local.db.FoodItemEntity
import com.example.whatsinmyfridge.domain.model.ExpiryState
import com.example.whatsinmyfridge.domain.model.FoodItemUi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject

class InventoryRepository @Inject constructor(
    private val dao: FoodDao
) {
    fun observeUi(now: Long = System.currentTimeMillis()): Flow<List<FoodItemUi>> =
        dao.observeAll().map { list ->
            list.map { e ->
                val days = ((e.expiryAt - now) / 86_400_000L)
                val state = when {
                    days < 0 -> ExpiryState.EXPIRED
                    days <= 3 -> ExpiryState.SOON
                    else -> ExpiryState.OK
                }
                FoodItemUi(e, state, days)
            }
        }

    suspend fun upsert(items: List<FoodItemEntity>) = dao.upsert(items)
    suspend fun delete(id: String) = dao.deleteById(id)
}
