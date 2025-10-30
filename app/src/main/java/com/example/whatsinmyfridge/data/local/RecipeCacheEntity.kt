package com.example.whatsinmyfridge.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "recipe_cache")
data class RecipeCacheEntity(
    @PrimaryKey val ingredientsHash: String,
    val recipesJson: String,
    val timestamp: Long,
    val ttlMinutes: Int = 60
)