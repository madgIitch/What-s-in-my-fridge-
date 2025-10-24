package com.example.whatsinmyfridge.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.example.whatsinmyfridge.data.local.db.FoodItemEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface FoodDao {
    @Query("SELECT * FROM food_items ORDER BY expiryDate ASC")
    fun getAllFlow(): Flow<List<FoodItemEntity>>

    // NUEVO: Método síncrono para el widget
    @Query("SELECT * FROM food_items ORDER BY expiryDate ASC")
    suspend fun getAll(): List<FoodItemEntity>

    @Query("SELECT * FROM food_items WHERE id = :id")
    suspend fun getById(id: Long): FoodItemEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(item: FoodItemEntity): Long

    @Update
    suspend fun update(item: FoodItemEntity)

    @Delete
    suspend fun delete(item: FoodItemEntity)

    @Query("DELETE FROM food_items WHERE id = :id")
    suspend fun deleteById(id: Long)
}