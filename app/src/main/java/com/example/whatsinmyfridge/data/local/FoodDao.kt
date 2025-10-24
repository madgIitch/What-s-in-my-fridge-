package com.example.whatsinmyfridge.data.local.db

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface FoodDao {
    @Query("SELECT * FROM food_items ORDER BY expiryAt ASC")
    fun observeAll(): Flow<List<FoodItemEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(items: List<FoodItemEntity>)

    @Query("DELETE FROM food_items WHERE id = :id")
    suspend fun deleteById(id: String)
}
