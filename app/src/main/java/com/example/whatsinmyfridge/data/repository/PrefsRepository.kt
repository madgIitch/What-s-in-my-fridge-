package com.example.whatsinmyfridge.data.repository

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class PrefsRepository(
    private val dataStore: DataStore<Preferences>
) {
    private object PrefsKeys {
        val REMINDER_DAYS = intPreferencesKey("reminder_days")
        val IS_PRO = booleanPreferencesKey("is_pro")
        val CLOUD_CONSENT = booleanPreferencesKey("cloud_consent")
    }

    val reminderDays: Flow<Int> = dataStore.data
        .map { it[PrefsKeys.REMINDER_DAYS] ?: 3 }

    val isPro: Flow<Boolean> = dataStore.data
        .map { it[PrefsKeys.IS_PRO] ?: false }

    val cloudConsent: Flow<Boolean> = dataStore.data
        .map { it[PrefsKeys.CLOUD_CONSENT] ?: false }

    suspend fun setReminderDays(days: Int) {
        dataStore.edit { it[PrefsKeys.REMINDER_DAYS] = days }
    }

    suspend fun setProStatus(isPro: Boolean) {
        dataStore.edit { it[PrefsKeys.IS_PRO] = isPro }
    }

    suspend fun setCloudConsent(consent: Boolean) {
        dataStore.edit { it[PrefsKeys.CLOUD_CONSENT] = consent }
    }
}