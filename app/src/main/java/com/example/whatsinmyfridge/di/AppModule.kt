package com.example.whatsinmyfridge.di

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.preferencesDataStore
import androidx.room.Room
import com.example.whatsinmyfridge.data.datastore.PrefsRepo
import com.example.whatsinmyfridge.data.local.DraftDao
import com.example.whatsinmyfridge.data.local.FoodDao
import com.example.whatsinmyfridge.data.local.db.AppDb
import com.example.whatsinmyfridge.data.repository.DraftRepository
import com.example.whatsinmyfridge.data.repository.InventoryRepository
import com.example.whatsinmyfridge.ui.home.HomeVm
import com.example.whatsinmyfridge.ui.scan.ScanVm
import org.koin.android.ext.koin.androidContext
import org.koin.androidx.viewmodel.dsl.viewModel
import org.koin.dsl.module

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(
    name = "fridge_prefs"
)

val appModule = module {

    // ========== Database ==========
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
    single<FoodDao> { get<AppDb>().food() }
    single<DraftDao> { get<AppDb>().drafts() }

    // ========== DataStore ==========
    single<DataStore<Preferences>> { androidContext().dataStore }

    // ========== Repositories ==========
    // InventoryRepository(dao: FoodDao)
    single { InventoryRepository(get()) }

    // DraftRepository(draftDao: DraftDao)
    single { DraftRepository(get()) }

    // PrefsRepo(context: Context)
    single { PrefsRepo(androidContext()) }

    // ========== ViewModels ==========
    // HomeVm(inventoryRepository: InventoryRepository)
    viewModel { HomeVm(get()) }

    // ScanVm() - sin parámetros por ahora
    viewModel { ScanVm() }
}