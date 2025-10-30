package com.example.whatsinmyfridge.data.repository

import com.example.whatsinmyfridge.data.local.RecipeDao
import com.example.whatsinmyfridge.data.local.RecipeEntity
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.serialization.json.Json

class RecipeRepository(private val recipeDao: RecipeDao) {

    fun getAllRecipesFlow(): Flow<List<RecipeEntity>> = recipeDao.getAllFlow()

    suspend fun searchByIngredients(ingredients: List<String>): List<RecipeEntity> {
        // Buscar recetas que contengan alguno de los ingredientes
        val allRecipes = recipeDao.getAllFlow().first()
        return allRecipes.filter { recipe ->
            val recipeIngredients = Json.decodeFromString<List<String>>(recipe.ingredientsJson)
            ingredients.any { userIngredient ->
                recipeIngredients.any { recipeIngredient ->
                    calculateSimilarity(userIngredient, recipeIngredient) >= 0.7
                }
            }
        }
    }

    suspend fun getRecipeCount(): Int = recipeDao.getCount()

    suspend fun importRecipes(recipes: List<RecipeEntity>) {
        recipeDao.insertAll(recipes)
    }

    private fun calculateSimilarity(str1: String, str2: String): Double {
        val s1 = str1.lowercase().trim()
        val s2 = str2.lowercase().trim()

        if (s1 == s2) return 1.0

        val len1 = s1.length
        val len2 = s2.length

        if (len1 == 0 || len2 == 0) return 0.0

        // Levenshtein distance matrix
        val matrix = Array(len1 + 1) { IntArray(len2 + 1) }

        for (i in 0..len1) matrix[i][0] = i
        for (j in 0..len2) matrix[0][j] = j

        for (i in 1..len1) {
            for (j in 1..len2) {
                val cost = if (s1[i - 1] == s2[j - 1]) 0 else 1
                matrix[i][j] = minOf(
                    matrix[i - 1][j] + 1,      // deletion
                    matrix[i][j - 1] + 1,      // insertion
                    matrix[i - 1][j - 1] + cost // substitution
                )
            }
        }

        val distance = matrix[len1][len2]
        val maxLen = maxOf(len1, len2)
        return 1.0 - distance.toDouble() / maxLen
    }
}