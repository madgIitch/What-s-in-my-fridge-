package com.example.whatsinmyfridge.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "ingredients")
data class IngredientEntity(
    @PrimaryKey val name: String,
    val category: String // "mayonesa", "leche", etc.
)