package com.example.whatsinmyfridge.di

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.preferencesDataStore
import androidx.room.Room
import com.example.whatsinmyfridge.data.local.DraftDao
import com.example.whatsinmyfridge.data.local.FoodDao
import com.example.whatsinmyfridge.data.local.RecipeCacheDao
import com.example.whatsinmyfridge.data.local.db.AppDb
import com.example.whatsinmyfridge.data.repository.DraftRepository
import com.example.whatsinmyfridge.data.repository.InventoryRepository
import com.example.whatsinmyfridge.data.repository.PrefsRepository
import com.example.whatsinmyfridge.data.repository.RecipeCacheRepository
import com.example.whatsinmyfridge.ui.add.AddItemVm
import com.example.whatsinmyfridge.ui.detail.DetailVm
import com.example.whatsinmyfridge.ui.home.HomeVm
import com.example.whatsinmyfridge.ui.login.LoginVm
import com.example.whatsinmyfridge.ui.recipespro.RecipesProVm
import com.example.whatsinmyfridge.ui.review.ReviewDraftVm
import com.example.whatsinmyfridge.ui.scan.ScanVm
import com.example.whatsinmyfridge.ui.settings.SettingsVm
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import org.koin.android.ext.koin.androidContext
import org.koin.androidx.viewmodel.dsl.viewModel
import org.koin.dsl.module

/**
 * Extensión para crear DataStore de preferencias.
 * Nombre: "fridge_prefs"
 */
private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(
    name = "fridge_prefs"
)

/**
 * Módulo principal de Koin para la aplicación What's In My Fridge.
 *
 * Define todas las dependencias necesarias:
 * - Base de datos Room (AppDb)
 * - DAOs (FoodDao, DraftDao, RecipeCacheDao)
 * - DataStore para preferencias
 * - Repositorios (InventoryRepository, DraftRepository, PrefsRepository, RecipeCacheRepository)
 * - ViewModels para todas las pantallas
 * - Firebase Auth (para InventoryRepository)
 */
val appModule = module {

    // ========== Database ==========
    /**
     * Base de datos Room principal.
     * Versión 4: Agregada tabla recipe_cache para Sprint 3.
     * Estrategia: fallbackToDestructiveMigration() para desarrollo.
     */
    single<AppDb> {
        Room.databaseBuilder(
            androidContext(),
            AppDb::class.java,
            "fridge.db"
        )
            .fallbackToDestructiveMigration()
            .build()
    }

    // ========== DAOs ==========
    /**
     * DAO para acceso a la tabla food_items (inventario confirmado).
     */
    single<FoodDao> { get<AppDb>().food() }

    /**
     * DAO para acceso a la tabla parsed_drafts (borradores de escaneo OCR).
     */
    single<DraftDao> { get<AppDb>().drafts() }

    /**
     * DAO para acceso a la tabla recipe_cache (caché de recetas locales).
     * Agregado en Sprint 3 para consultas offline de recetas.
     */
    single<RecipeCacheDao> { get<AppDb>().recipeCache() }

    // ========== DataStore ==========
    /**
     * DataStore para preferencias del usuario.
     * Almacena: reminderDays, isPro, cloudConsent, notificationsEnabled,
     * cookingTime, availableUtensils, monthlyRecipeCallsUsed.
     */
    single<DataStore<Preferences>> { androidContext().dataStore }

    // ========== Firebase ==========
    /**
     * Firebase Authentication para sincronización con Firestore.
     * Usado por InventoryRepository para verificar userId.
     */
    single { Firebase.auth }

    // ========== Repositories ==========
    /**
     * InventoryRepository: Gestiona inventario de alimentos.
     * Dependencias: FoodDao, PrefsRepository, FirebaseAuth
     * Funcionalidades:
     * - CRUD de items en Room
     * - Sincronización opcional con Firestore
     * - Transformación FoodItemEntity → FoodItemUi con estados de caducidad
     */
    single { InventoryRepository(get(), get()) }

    /**
     * DraftRepository: Gestiona borradores de escaneo OCR.
     * Dependencias: DraftDao
     * Funcionalidades:
     * - CRUD de borradores ParsedDraftEntity
     * - Conversión de borradores a items confirmados
     */
    single { DraftRepository(get()) }

    /**
     * PrefsRepository: Gestiona preferencias del usuario.
     * Dependencias: DataStore<Preferences>
     * Funcionalidades:
     * - Lectura/escritura de preferencias con Flow reactivo
     * - Gestión de límites mensuales de llamadas a recetas
     * - Configuración de plan Pro
     */
    single { PrefsRepository(get()) }

    /**
     * RecipeCacheRepository: Gestiona caché local de recetas.
     * Dependencias: RecipeCacheDao
     * Funcionalidades:
     * - Almacenamiento de recetas con TTL
     * - Verificación de caché expirado
     * - Serialización/deserialización de JSON
     */
    single { RecipeCacheRepository(get()) }

    // ========== ViewModels ==========
    /**
     * HomeVm: ViewModel para la pantalla principal.
     * Dependencias: InventoryRepository
     * Funcionalidades:
     * - Observación reactiva del inventario
     * - Inicio/detención de sincronización Firestore
     */
    viewModel { HomeVm(get()) }

    /**
     * ScanVm: ViewModel para la pantalla de escaneo de recibos.
     * Dependencias: DraftRepository
     * Funcionalidades:
     * - Procesamiento de imágenes con OCR (local o cloud)
     * - Creación de borradores ParsedDraftEntity
     */
    viewModel { ScanVm(get()) }

    /**
     * DetailVm: ViewModel para la pantalla de detalle de item.
     * Parámetro: itemId (Long)
     * Dependencias: InventoryRepository
     * Funcionalidades:
     * - Carga de item por ID
     * - Actualización de item existente
     */
    viewModel { (itemId: Long) ->
        DetailVm(itemId = itemId, inventoryRepository = get())
    }

    /**
     * AddItemVm: ViewModel para la pantalla de añadir item manual.
     * Dependencias: InventoryRepository
     * Funcionalidades:
     * - Creación de nuevo FoodItemEntity
     * - Validación de campos
     */
    viewModel { AddItemVm(get()) }

    /**
     * ReviewDraftVm: ViewModel para la pantalla de revisión de borrador.
     * Parámetro: draftId (Long)
     * Dependencias: DraftRepository, InventoryRepository, PrefsRepository
     * Funcionalidades:
     * - Carga de borrador por ID
     * - Edición de items parseados
     * - Confirmación y migración a inventario
     */
    viewModel { (draftId: Long) ->
        ReviewDraftVm(
            draftId = draftId,
            draftRepository = get(),
            inventoryRepository = get(),
            prefsRepository = get()
        )
    }

    /**
     * SettingsVm: ViewModel para la pantalla de configuración.
     * Dependencias: PrefsRepository
     * Funcionalidades:
     * - Lectura/escritura de preferencias
     * - Gestión de consentimiento de nube
     * - Configuración de notificaciones
     */
    viewModel { SettingsVm(get()) }

    /**
     * LoginVm: ViewModel para la pantalla de login.
     * Sin dependencias.
     * Funcionalidades:
     * - Autenticación con Firebase Auth
     * - Gestión de estado de login
     */
    viewModel { LoginVm() }

    /**
     * RecipesProVm: ViewModel para la pantalla de IA Pro - Recetas.
     * Dependencias: PrefsRepository, RecipeCacheRepository, InventoryRepository
     * Funcionalidades:
     * - Gestión de preferencias de cocina (tiempo, utensilios)
     * - Consulta de recetas desde backend con caché local
     * - Verificación de límites mensuales por plan (Free/Pro)
     * - Búsqueda offline de recetas locales
     */
    viewModel { RecipesProVm(get(), get(), get()) }
}