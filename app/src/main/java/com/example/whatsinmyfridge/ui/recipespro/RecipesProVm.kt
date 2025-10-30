package com.example.whatsinmyfridge.ui.recipespro

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.whatsinmyfridge.data.repository.InventoryRepository
import com.example.whatsinmyfridge.data.repository.PrefsRepository
import com.example.whatsinmyfridge.data.repository.RecipeCacheRepository
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import com.example.whatsinmyfridge.domain.model.RecipeUi

/**
 * ViewModel para la pantalla de recetas IA Pro.
 *
 * Gestiona:
 * - Preferencias de cocina (tiempo disponible, utensilios)
 * - Límites mensuales de llamadas a Cloud Functions
 * - Consulta de recetas desde backend con caché local
 * - Verificación de plan Pro del usuario
 *
 * @param prefsRepository Repositorio de preferencias del usuario
 * @param recipeCacheRepository Repositorio de caché de recetas
 * @param inventoryRepository Repositorio de inventario para obtener ingredientes
 */
class RecipesProVm(
    private val prefsRepository: PrefsRepository,
    private val recipeCacheRepository: RecipeCacheRepository,
    private val inventoryRepository: InventoryRepository
) : ViewModel() {

    // ========== Estado de Preferencias ==========

    /**
     * Tiempo de cocina disponible en minutos (10-120).
     * Default: 30 minutos
     */
    val cookingTime = prefsRepository.cookingTime
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 30)

    /**
     * Conjunto de utensilios disponibles en la cocina.
     * Ejemplos: "horno", "microondas", "batidora", "olla a presión"
     */
    val availableUtensils = prefsRepository.availableUtensils
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptySet())

    /**
     * Número de llamadas a getRecipeSuggestions usadas este mes.
     * Límites: Free = 10/mes, Pro = 100/mes
     */
    val monthlyRecipeCallsUsed = prefsRepository.monthlyRecipeCallsUsed
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    /**
     * Estado de plan Pro del usuario.
     * Si es false, se aplican límites de plan Free.
     */
    val isPro = prefsRepository.isPro
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    // ========== Estado de Recetas ==========

    /**
     * Lista de recetas sugeridas para mostrar en la UI.
     * Usa RecipeUi en lugar de RecipeSuggestion para compatibilidad con RecipesProScreen.
     */
    private val _recipes = MutableStateFlow<List<RecipeUi>>(emptyList())
    val recipes: StateFlow<List<RecipeUi>> = _recipes.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    // JSON serializer para RecipeUi
    private val json = Json { ignoreUnknownKeys = true }

    // ========== Métodos de Preferencias ==========

    /**
     * Actualiza el tiempo de cocina disponible.
     * @param minutes Tiempo en minutos (10-120)
     */
    fun setCookingTime(minutes: Int) {
        viewModelScope.launch {
            prefsRepository.setCookingTime(minutes.coerceIn(10, 120))
        }
    }

    /**
     * Actualiza el conjunto de utensilios disponibles.
     * @param utensils Set de nombres de utensilios
     */
    fun setAvailableUtensils(utensils: Set<String>) {
        viewModelScope.launch {
            prefsRepository.setAvailableUtensils(utensils)
        }
    }

    // ========== Métodos de Recetas ==========

    /**
     * Obtiene sugerencias de recetas desde el backend.
     *
     * Flujo:
     * 1. Verifica límites mensuales según plan (Free: 10, Pro: 100)
     * 2. Obtiene inventario del usuario
     * 3. Verifica caché local primero
     * 4. Si no hay caché, llama a Cloud Function getRecipeSuggestions
     * 5. Guarda resultado en caché local
     * 6. Incrementa contador de llamadas mensuales
     *
     * @throws Exception si se alcanza el límite mensual
     */
    fun getRecipeSuggestions() {
        viewModelScope.launch {
            try {
                _isLoading.value = true
                _errorMessage.value = null

                // 1. Verificar límites mensuales
                val currentCalls = monthlyRecipeCallsUsed.first()
                val maxCalls = if (isPro.first()) 100 else 10

                if (currentCalls >= maxCalls) {
                    _errorMessage.value = "Límite mensual alcanzado ($maxCalls llamadas). " +
                            if (!isPro.first()) "Actualiza a Pro para más llamadas." else ""
                    return@launch
                }

                // 2. Obtener inventario
                val inventory = inventoryRepository.observeUi().first()
                if (inventory.isEmpty()) {
                    _errorMessage.value = "Tu inventario está vacío. Agrega items primero."
                    return@launch
                }
                val ingredientNames = inventory.map { it.entity.name }

                // 3. Verificar caché primero
                val inventoryHash = generateInventoryHash(ingredientNames)
                val cachedEntity = recipeCacheRepository.getCachedRecipes(inventoryHash)

                if (cachedEntity != null) {
                    // Deserializar JSON a List<RecipeUi>
                    try {
                        val cachedRecipes = json.decodeFromString<List<RecipeUi>>(cachedEntity.recipesJson)
                        _recipes.value = cachedRecipes
                        println("✅ Usando ${cachedRecipes.size} recetas desde caché local")
                        return@launch
                    } catch (e: Exception) {
                        println("⚠️ Error deserializando caché, se eliminará: ${e.message}")
                        recipeCacheRepository.deleteCachedRecipes(inventoryHash)
                    }
                }

                // 4. Llamar a Cloud Function
                println("🔄 Llamando a Cloud Function getRecipeSuggestions...")
                val functions = FirebaseFunctions.getInstance()
                val result = functions
                    .getHttpsCallable("getRecipeSuggestions")
                    .call(mapOf(
                        "cookingTime" to cookingTime.first(),
                        "utensils" to availableUtensils.first().toList()
                    ))
                    .await()

                // 5. Parsear respuesta
                @Suppress("UNCHECKED_CAST")
                val data = result.data as? Map<String, Any>
                val success = data?.get("success") as? Boolean ?: false

                if (success) {
                    val recipesData = data?.get("recipes") as? List<Map<String, Any>> ?: emptyList()

                    // Mapear a RecipeUi
                    val recipeUiList = recipesData.map { recipe ->
                        RecipeUi(
                            id = recipe["id"] as? String ?: "",
                            name = recipe["name"] as? String ?: "",
                            matchPercentage = (recipe["matchPercentage"] as? Number)?.toInt() ?: 0,
                            matchedIngredients = (recipe["matchedIngredients"] as? List<String>) ?: emptyList(),
                            missingIngredients = (recipe["missingIngredients"] as? List<String>) ?: emptyList(),
                            ingredientsWithMeasures = (recipe["ingredientsWithMeasures"] as? List<String>) ?: emptyList(),
                            instructions = recipe["instructions"] as? String ?: ""
                        )
                    }

                    _recipes.value = recipeUiList

                    // 6. Guardar en caché (serializar a JSON)
                    val recipesJson = json.encodeToString(recipeUiList)
                    recipeCacheRepository.cacheRecipes(inventoryHash, recipesJson)

                    // 7. Incrementar contador
                    prefsRepository.incrementRecipeCalls()

                    println("✅ ${recipeUiList.size} recetas obtenidas y cacheadas")
                } else {
                    _errorMessage.value = "Error al obtener recetas del servidor"
                }

            } catch (e: Exception) {
                _errorMessage.value = "Error: ${e.message}"
                println("❌ Error en getRecipeSuggestions: ${e.message}")
                e.printStackTrace()
            } finally {
                _isLoading.value = false
            }
        }
    }

    /**
     * Limpia el mensaje de error.
     */
    fun clearError() {
        _errorMessage.value = null
    }

    /**
     * Obtiene recetas desde caché local (offline).
     * Útil cuando no hay conexión a internet.
     */
    fun getRecipesFromCache() {
        viewModelScope.launch {
            try {
                _isLoading.value = true

                // Obtener inventario actual para generar hash
                val inventory = inventoryRepository.observeUi().first()
                if (inventory.isEmpty()) {
                    _errorMessage.value = "Tu inventario está vacío."
                    return@launch
                }

                val ingredientNames = inventory.map { it.entity.name }
                val inventoryHash = generateInventoryHash(ingredientNames)

                val cachedEntity = recipeCacheRepository.getCachedRecipes(inventoryHash)

                if (cachedEntity != null) {
                    try {
                        val cachedRecipes = json.decodeFromString<List<RecipeUi>>(cachedEntity.recipesJson)
                        _recipes.value = cachedRecipes
                        println("✅ ${cachedRecipes.size} recetas cargadas desde caché")
                    } catch (e: Exception) {
                        _errorMessage.value = "Error al deserializar caché: ${e.message}"
                        println("❌ Error deserializando caché: ${e.message}")
                    }
                } else {
                    _errorMessage.value = "No hay recetas en caché. Conecta a internet para obtener sugerencias."
                }
            } catch (e: Exception) {
                _errorMessage.value = "Error al cargar caché: ${e.message}"
                println("❌ Error en getRecipesFromCache: ${e.message}")
            } finally {
                _isLoading.value = false
            }
        }
    }

    /**
     * Genera un hash del inventario para usar como clave de caché.
     * Sigue el mismo patrón que el backend en recipeCache.ts.
     */
    private fun generateInventoryHash(ingredients: List<String>): String {
        return ingredients.sorted().joinToString(",")
    }
}

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