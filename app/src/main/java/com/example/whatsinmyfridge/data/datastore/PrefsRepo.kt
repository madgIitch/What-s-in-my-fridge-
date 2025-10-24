package com.example.whatsinmyfridge.data.datastore

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "settings")

class PrefsRepo(private val context: Context) {

    object PrefsKeys {
        val CLOUD_CONSENT = booleanPreferencesKey("cloud_consent")
        val REMINDER_DAYS = intPreferencesKey("reminder_days")
    }

    val cloudConsent: Flow<Boolean> = context.dataStore.data.map { prefs ->
        prefs[PrefsKeys.CLOUD_CONSENT] ?: false
    }

    val reminderDays: Flow<Int> = context.dataStore.data.map { prefs ->
        prefs[PrefsKeys.REMINDER_DAYS] ?: 3
    }

    suspend fun setCloudConsent(enabled: Boolean) {
        context.dataStore.edit { prefs ->
            prefs[PrefsKeys.CLOUD_CONSENT] = enabled
        }
    }

    suspend fun setReminderDays(days: Int) {
        context.dataStore.edit { prefs ->
            prefs[PrefsKeys.REMINDER_DAYS] = days
        }
    }
}