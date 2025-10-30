package com.example.whatsinmyfridge.data.repository

import com.example.whatsinmyfridge.data.local.RecipeCacheDao
import com.example.whatsinmyfridge.data.local.RecipeCacheEntity

class RecipeCacheRepository(
    private val recipeCacheDao: RecipeCacheDao
) {
    suspend fun getCachedRecipes(hash: String): RecipeCacheEntity? {
        val cache = recipeCacheDao.getByHash(hash) ?: return null

        // Verificar TTL
        val now = System.currentTimeMillis()
        if (now - cache.timestamp > cache.ttlMinutes * 60 * 1000) {
            return null // Caché expirada
        }

        return cache
    }

    suspend fun cacheRecipes(hash: String, recipesJson: String, ttlMinutes: Int = 60) {
        val entity = RecipeCacheEntity(
            ingredientsHash = hash,
            recipesJson = recipesJson,
            timestamp = System.currentTimeMillis(),
            ttlMinutes = ttlMinutes
        )
        recipeCacheDao.insert(entity)
    }

    suspend fun deleteExpiredCaches() {
        val expiryTime = System.currentTimeMillis()
        recipeCacheDao.deleteExpired(expiryTime)
    }

    suspend fun deleteCachedRecipes(inventoryHash: String) {
        recipeCacheDao.deleteByHash(inventoryHash)
    }
}