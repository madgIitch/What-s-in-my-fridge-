package com.example.whatsinmyfridge.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "recipes")
data class RecipeEntity(
    @PrimaryKey val id: String,
    val name: String,
    val ingredientsJson: String,              // JSON de List<String> sin medidas
    val ingredientsWithMeasuresJson: String,  // JSON de List<String> con medidas
    val minIngredients: Int,
    val instructionsJson: String,             // JSON de List<String>
    val language: String = "en-US",
    val source: String = "",
    val tags: String = "[]"                   // JSON de List<String>
)