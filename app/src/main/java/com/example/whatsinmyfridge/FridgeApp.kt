package com.example.whatsinmyfridge

import android.app.Application
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.example.whatsinmyfridge.di.appModule
import com.example.whatsinmyfridge.workers.ExpiryWorker
import org.koin.android.ext.koin.androidContext
import org.koin.core.context.startKoin
import java.util.concurrent.TimeUnit

class FridgeApp : Application() {
    override fun onCreate() {
        super.onCreate()
        startKoin {
            androidContext(this@FridgeApp)
            modules(appModule)
        }

        // Programar ExpiryWorker
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