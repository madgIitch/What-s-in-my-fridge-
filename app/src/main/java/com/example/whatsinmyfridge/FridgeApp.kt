package com.example.whatsinmyfridge

import android.app.Application
import android.util.Log
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.example.whatsinmyfridge.data.local.IngredientEntity
import com.example.whatsinmyfridge.data.local.db.AppDb
import com.example.whatsinmyfridge.di.appModule
import com.example.whatsinmyfridge.workers.ExpiryWorker
import com.google.firebase.BuildConfig
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.koin.android.ext.koin.androidContext
import org.koin.android.ext.koin.androidLogger
import org.koin.core.component.KoinComponent
import org.koin.core.component.inject
import org.koin.core.context.startKoin
import org.koin.core.logger.Level
import java.util.concurrent.TimeUnit

/**
 * Clase Application principal de What's In My Fridge.
 *
 * Esta clase se inicializa antes que cualquier Activity o Service y es el punto
 * de entrada para configurar componentes globales de la aplicación.
 *
 * ## Responsabilidades:
 *
 * ### 1. Inyección de Dependencias (Koin)
 * Inicializa el contenedor de DI con todos los singletons necesarios:
 * - Room Database (AppDb)
 * - DAOs (FoodDao, DraftDao, RecipeCacheDao, IngredientDao)
 * - Repositories (InventoryRepository, DraftRepository, PrefsRepository)
 * - ViewModels (HomeVm, DetailVm, ScanVm, etc.)
 *
 * ### 2. Seguridad Firebase
 * Configura Firebase App Check con Play Integrity para proteger las Cloud Functions
 * contra acceso no autorizado y abuso de API.
 *
 * ### 3. Notificaciones de Expiración
 * Programa un worker periódico que verifica diariamente items próximos a caducar
 * y envía notificaciones al usuario según sus preferencias.
 *
 * ### 4. Carga de Ingredientes
 * Importa ingredientes desde assets/recipes.json a la base de datos Room al primer inicio
 * para clasificación fuzzy de alimentos escaneados.
 *
 * @see com.example.whatsinmyfridge.di.appModule
 * @see com.example.whatsinmyfridge.workers.ExpiryWorker
 */
class FridgeApp : Application(), KoinComponent {

    companion object {
        private const val TAG = "FridgeApp"
        private const val EXPIRY_WORKER_NAME = "expiry_notifications"
        private const val WORKER_REPEAT_INTERVAL_HOURS = 24L
    }

    override fun onCreate() {
        super.onCreate()

        Log.d(TAG, "🚀 Inicializando What's In My Fridge...")

        // ========== 1. Inicializar Koin ==========
        initializeKoin()

        // ========== 2. Configurar Firebase ==========
        initializeFirebase()

        // ========== 3. Programar Workers de Background ==========
        scheduleBackgroundWorkers()

        // ========== 4. Cargar Ingredientes ==========
        loadIngredientsDatabase()

        Log.d(TAG, "✅ Inicialización completada")
    }

    /**
     * Carga ingredientes desde assets/recipes.json a la base de datos Room.
     *
     * ## Flujo:
     * 1. Verifica si ya existen ingredientes en Room (evita reimportar)
     * 2. Lee recipes.json desde assets
     * 3. Extrae ingredientes únicos de todas las recetas
     * 4. Crea IngredientEntity para cada ingrediente
     * 5. Guarda en Room para fuzzy matching
     *
     * ## Ejecución:
     * - Se ejecuta en background (CoroutineScope con Dispatchers.IO)
     * - Solo al primer inicio de la app
     * - Puede tardar varios segundos con miles de ingredientes
     */
    private fun loadIngredientsDatabase() {
        Log.d(TAG, "📚 Cargando ingredientes desde recipes.json...")

        // Inyectar AppDb usando Koin
        val appDb: AppDb by inject()

        // Usar CoroutineScope en lugar de lifecycleScope (Application no tiene lifecycleScope)
        CoroutineScope(Dispatchers.IO).launch {
            try {
                // Verificar si ya se cargaron ingredientes
                val count = appDb.ingredients().getAll().size
                if (count > 0) {
                    Log.d(TAG, "✅ Ingredientes ya cargados: $count")
                    return@launch
                }

                // Leer recipes.json desde assets
                val json = assets.open("recipes.json").bufferedReader().use { it.readText() }
                val recipesData = Json { ignoreUnknownKeys = true }.decodeFromString<RecipesData>(json)

                // Extraer ingredientes únicos de todas las recetas
                val uniqueIngredients = mutableSetOf<String>()
                recipesData.recipes.forEach { recipe ->
                    uniqueIngredients.addAll(recipe.ingredients)
                }

                // Crear entidades para Room
                val entities = uniqueIngredients.map { ingredient ->
                    IngredientEntity(
                        name = ingredient,
                        category = ingredient // Inicialmente, categoría = nombre del ingrediente
                    )
                }

                // Guardar en Room
                appDb.ingredients().insertAll(entities)
                Log.d(TAG, "✅ ${entities.size} ingredientes cargados correctamente")
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error cargando ingredientes: ${e.message}", e)
            }
        }
    }

    /**
     * Inicializa Koin con el módulo de dependencias de la aplicación.
     *
     * Configuración:
     * - androidContext: Proporciona el contexto de Android a Koin
     * - androidLogger: Habilita logs de Koin en desarrollo (Level.ERROR en producción)
     * - modules: Registra appModule con todos los singletons y ViewModels
     *
     * @see com.example.whatsinmyfridge.di.appModule
     */
    private fun initializeKoin() {
        Log.d(TAG, "📦 Inicializando Koin DI...")

        startKoin {
            // Proporcionar contexto de Android
            androidContext(this@FridgeApp)

            // Habilitar logs de Koin (solo en debug)
            androidLogger(if (BuildConfig.DEBUG) Level.DEBUG else Level.ERROR)

            // Registrar módulos de dependencias
            modules(appModule)
        }

        Log.d(TAG, "✅ Koin inicializado correctamente")
    }

    /**
     * Inicializa Firebase y configura App Check para seguridad.
     *
     * ## Firebase App Check
     * Protege las Cloud Functions contra:
     * - Acceso desde apps no autorizadas
     * - Abuso de API y scraping
     * - Ataques de replay
     *
     * Usa Play Integrity API para verificar que las solicitudes provienen
     * de una instalación legítima de la app desde Google Play Store.
     *
     * @see com.google.firebase.appcheck.FirebaseAppCheck
     */
    private fun initializeFirebase() {
        Log.d(TAG, "🔥 Inicializando Firebase...")

        // Inicializar Firebase SDK
        FirebaseApp.initializeApp(this)

        // Configurar App Check con Play Integrity
        val firebaseAppCheck = FirebaseAppCheck.getInstance()
        firebaseAppCheck.installAppCheckProviderFactory(
            PlayIntegrityAppCheckProviderFactory.getInstance()
        )

        Log.d(TAG, "✅ Firebase App Check configurado con Play Integrity")
    }

    /**
     * Programa todos los workers de background necesarios.
     *
     * Actualmente programa:
     * - ExpiryWorker: Notificaciones diarias de items próximos a caducar
     */
    private fun scheduleBackgroundWorkers() {
        Log.d(TAG, "⏰ Programando workers de background...")

        scheduleExpiryWorker()

        Log.d(TAG, "✅ Workers programados correctamente")
    }

    /**
     * Programa el worker de notificaciones de expiración.
     *
     * ## Comportamiento:
     * - Se ejecuta cada 24 horas
     * - Consulta items del inventario próximos a caducar
     * - Respeta preferencias del usuario (notificationsEnabled, reminderDays)
     * - Envía notificación de resumen si hay items expirando
     *
     * ## Política de Ejecución:
     * - ExistingPeriodicWorkPolicy.KEEP: No reemplaza el worker si ya existe
     * - Esto evita duplicados al reiniciar la app
     *
     * @see com.example.whatsinmyfridge.workers.ExpiryWorker
     * @see com.example.whatsinmyfridge.data.repository.PrefsRepository
     */
    private fun scheduleExpiryWorker() {
        val workRequest = PeriodicWorkRequestBuilder<ExpiryWorker>(
            repeatInterval = WORKER_REPEAT_INTERVAL_HOURS,
            repeatIntervalTimeUnit = TimeUnit.HOURS
        ).build()

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            EXPIRY_WORKER_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            workRequest
        )

        Log.d(TAG, "✅ ExpiryWorker programado (cada ${WORKER_REPEAT_INTERVAL_HOURS}h)")
    }
}

/**
 * Estructura de datos para deserializar recipes.json.
 * Contiene la lista completa de recetas con sus ingredientes normalizados.
 */
@Serializable
data class RecipesData(
    val recipes: List<Recipe>
)

/**
 * Estructura de una receta individual.
 * Cada receta tiene un nombre y una lista de ingredientes normalizados por Llama.
 */
@Serializable
data class Recipe(
    val name: String,
    val ingredients: List<String>
)