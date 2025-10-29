package com.example.whatsinmyfridge

import android.app.Application
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.example.whatsinmyfridge.di.appModule
import com.example.whatsinmyfridge.workers.ExpiryWorker
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory
import org.koin.android.ext.koin.androidContext
import org.koin.core.context.startKoin
import java.util.concurrent.TimeUnit

/**
 * Clase Application principal de What's In My Fridge.
 *
 * Responsabilidades:
 * - Inicializar Koin para inyección de dependencias
 * - Configurar Firebase App Check para seguridad
 * - Programar ExpiryWorker para notificaciones diarias
 */
class FridgeApp : Application() {
    override fun onCreate() {
        super.onCreate()

        // ========== Inicializar Koin ==========
        startKoin {
            androidContext(this@FridgeApp)
            modules(appModule)
        }

        // ========== Configurar Firebase App Check ==========
        // Inicializar Firebase primero
        FirebaseApp.initializeApp(this)

        // Configurar App Check con Play Integrity
        val firebaseAppCheck = FirebaseAppCheck.getInstance()
        firebaseAppCheck.installAppCheckProviderFactory(
            PlayIntegrityAppCheckProviderFactory.getInstance()
        )

        // ========== Programar ExpiryWorker ==========
        scheduleExpiryWorker()
    }

    /**
     * Programa el worker de notificaciones de expiración.
     *
     * Se ejecuta diariamente y respeta las preferencias del usuario
     * (notificationsEnabled, reminderDays).
     */
    private fun scheduleExpiryWorker() {
        val workRequest = PeriodicWorkRequestBuilder<ExpiryWorker>(
            repeatInterval = 1,
            repeatIntervalTimeUnit = TimeUnit.DAYS
        ).build()

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "expiry_notifications",
            ExistingPeriodicWorkPolicy.KEEP,
            workRequest
        )
    }
}