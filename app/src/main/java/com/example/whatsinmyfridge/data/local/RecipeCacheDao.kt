package com.example.whatsinmyfridge.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface RecipeCacheDao {

    @Query("SELECT * FROM recipe_cache WHERE ingredientsHash = :hash")
    suspend fun getByHash(hash: String): RecipeCacheEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entity: RecipeCacheEntity)

    @Query("DELETE FROM recipe_cache WHERE timestamp < :expiryTime")
    suspend fun deleteExpired(expiryTime: Long)

    @Query("DELETE FROM recipe_cache WHERE ingredientsHash = :hash")
    suspend fun deleteByHash(hash: String)

    @Query("DELETE FROM recipe_cache")
    suspend fun deleteAll()
}