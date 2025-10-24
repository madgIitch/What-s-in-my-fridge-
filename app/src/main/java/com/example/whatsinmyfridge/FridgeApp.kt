package com.example.whatsinmyfridge

import android.app.Application
import com.example.whatsinmyfridge.di.appModule
import org.koin.android.ext.koin.androidContext
import org.koin.android.ext.koin.androidLogger
import org.koin.core.context.startKoin
import org.koin.core.logger.Level

class FridgeApp : Application() {
    override fun onCreate() {
        super.onCreate()

        startKoin {
            androidLogger(Level.ERROR)
            androidContext(this@FridgeApp)
            modules(appModule)
        }
    }
}