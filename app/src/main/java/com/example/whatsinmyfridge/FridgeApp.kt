package com.example.whatsinmyfridge

import android.app.Application
import com.example.whatsinmyfridge.di.appModule
import org.koin.android.ext.koin.androidContext
import org.koin.core.context.startKoin

class FridgeApp : Application() {
    override fun onCreate() {
        super.onCreate()

        startKoin {
            androidContext(this@FridgeApp)
            modules(appModule)
        }
    }
}