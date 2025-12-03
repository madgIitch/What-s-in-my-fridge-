package com.example.whatsinmyfridge.data.repository

import com.example.whatsinmyfridge.data.local.IngredientDao
import com.example.whatsinmyfridge.data.local.IngredientEntity

class FoodClassifierRepository(
    private val ingredientDao: IngredientDao
) {
    suspend fun classifyFoodItem(productName: String, threshold: Double = 0.7): String? {
        val normalized = normalizeString(productName)
        val allIngredients = ingredientDao.getAll()

        var bestMatch: IngredientEntity? = null
        var bestScore = 0.0

        for (ingredient in allIngredients) {
            val similarity = calculateSimilarity(normalized, ingredient.name)
            if (similarity >= threshold && similarity > bestScore) {
                bestScore = similarity
                bestMatch = ingredient
            }
        }

        return bestMatch?.category
    }

    /**
     * Normaliza string para comparación (lowercase, sin acentos)
     */
    private fun normalizeString(str: String): String {
        return str
            .lowercase()
            .replace(Regex("[àáâãäå]"), "a")
            .replace(Regex("[èéêë]"), "e")
            .replace(Regex("[ìíîï]"), "i")
            .replace(Regex("[òóôõö]"), "o")
            .replace(Regex("[ùúûü]"), "u")
            .replace(Regex("\\s+"), " ")
            .trim()
    }

    /**
     * Calcula similitud usando Levenshtein distance.
     * Retorna valor entre 0 (totalmente diferente) y 1 (idéntico).
     *
     * Implementación idéntica a RecipeRepository.calculateSimilarity()
     */
    private fun calculateSimilarity(str1: String, str2: String): Double {
        val s1 = normalizeString(str1)
        val s2 = normalizeString(str2)

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