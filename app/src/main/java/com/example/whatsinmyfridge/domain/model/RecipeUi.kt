package com.example.whatsinmyfridge.domain.model

import kotlinx.serialization.Serializable

/**
 * Modelo de datos para UI de recetas.
 * Debe ser serializable para guardarse en caché.
 */
@Serializable
data class RecipeUi(
    val id: String,
    val name: String,
    val matchPercentage: Int,
    val matchedIngredients: List<String>,
    val missingIngredients: List<String>,
    val ingredientsWithMeasures: List<String>,
    val instructions: String
)