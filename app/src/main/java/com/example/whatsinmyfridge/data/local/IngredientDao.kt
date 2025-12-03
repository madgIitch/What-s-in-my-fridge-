package com.example.whatsinmyfridge.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface IngredientDao {
    @Query("SELECT * FROM ingredients")
    suspend fun getAll(): List<IngredientEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(ingredients: List<IngredientEntity>)

    @Query("DELETE FROM ingredients")
    suspend fun deleteAll()
}

// app/src/main/java/com/example/whatsinmyfridge/data/repository/FoodClassifierRepository.kt
