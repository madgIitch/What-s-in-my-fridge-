package com.example.whatsinmyfridge.di

import android.content.Context
import androidx.room.Room
import com.example.whatsinmyfridge.data.datastore.PrefsRepo
import com.example.whatsinmyfridge.data.local.DraftDao
import com.example.whatsinmyfridge.data.local.FoodDao
import com.example.whatsinmyfridge.data.local.db.AppDb
import com.example.whatsinmyfridge.data.repository.InventoryRepository
import com.example.whatsinmyfridge.ui.home.HomeVm
import com.example.whatsinmyfridge.ui.scan.ScanVm
import org.koin.android.ext.koin.androidContext
import org.koin.androidx.viewmodel.dsl.viewModel
import org.koin.dsl.module

val appModule = module {
    // Database
    single {
        Room.databaseBuilder(
            androidContext(),
            AppDb::class.java,
            "fridge.db"
        ).build()
    }

    // DAOs
    single<FoodDao> { get<AppDb>().food() }
    single<DraftDao> { get<AppDb>().drafts() }

    // Repositories
    single { InventoryRepository(get()) }
    single { PrefsRepo(androidContext()) }

    // ViewModels
    viewModel { HomeVm(get()) }
    viewModel { ScanVm() }
}