package com.example.whatsinmyfridge.data.local.db

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.example.whatsinmyfridge.data.local.Converters
import com.example.whatsinmyfridge.data.local.DraftDao
import com.example.whatsinmyfridge.data.local.FoodDao
import com.example.whatsinmyfridge.data.local.IngredientDao
import com.example.whatsinmyfridge.data.local.IngredientEntity
import com.example.whatsinmyfridge.data.local.RecipeCacheDao
import com.example.whatsinmyfridge.data.local.RecipeCacheEntity

/**
 * Base de datos Room principal de la aplicación.
 *
 * Contiene tres tablas:
 * - food_items: Inventario confirmado de alimentos
 * - parsed_drafts: Borradores temporales de escaneo OCR
 * - recipe_cache: Caché local de recetas para consultas offline
 *
 * Versión 4: Agregada tabla recipe_cache para Sprint 3
 */
@Database(
    entities = [
        FoodItemEntity::class,
        ParsedDraftEntity::class,
        RecipeCacheEntity::class,
        IngredientEntity::class  // ← NUEVO
    ],
    version = 5,  // ← Incrementar versión
    exportSchema = false
)
@TypeConverters(Converters::class)
abstract class AppDb : RoomDatabase() {
    abstract fun food(): FoodDao
    abstract fun drafts(): DraftDao
    abstract fun recipeCache(): RecipeCacheDao
    abstract fun ingredients(): IngredientDao  // ← NUEVO
}