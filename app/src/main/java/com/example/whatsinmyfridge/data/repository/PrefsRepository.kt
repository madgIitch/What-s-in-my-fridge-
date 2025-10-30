package com.example.whatsinmyfridge.data.repository

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class PrefsRepository(
    private val dataStore: DataStore<Preferences>
) {
    private object PrefsKeys {
        val REMINDER_DAYS = intPreferencesKey("reminder_days")
        val IS_PRO = booleanPreferencesKey("is_pro")
        val CLOUD_CONSENT = booleanPreferencesKey("cloud_consent")
        val NOTIFICATIONS_ENABLED = booleanPreferencesKey("notifications_enabled")
        val COOKING_TIME = intPreferencesKey("cooking_time")
        val AVAILABLE_UTENSILS = stringSetPreferencesKey("available_utensils")
        val MONTHLY_RECIPE_CALLS_USED = intPreferencesKey("monthly_recipe_calls_used")
    }

    // ========== Flows de Lectura ==========

    val reminderDays: Flow<Int> = dataStore.data
        .map { it[PrefsKeys.REMINDER_DAYS] ?: 3 }

    val isPro: Flow<Boolean> = dataStore.data
        .map { it[PrefsKeys.IS_PRO] ?: false }

    val cloudConsent: Flow<Boolean> = dataStore.data
        .map { it[PrefsKeys.CLOUD_CONSENT] ?: false }

    val notificationsEnabled: Flow<Boolean> = dataStore.data
        .map { it[PrefsKeys.NOTIFICATIONS_ENABLED] ?: true }

    val cookingTime: Flow<Int> = dataStore.data
        .map { it[PrefsKeys.COOKING_TIME] ?: 30 }

    val availableUtensils: Flow<Set<String>> = dataStore.data
        .map { it[PrefsKeys.AVAILABLE_UTENSILS] ?: emptySet() }

    val monthlyRecipeCallsUsed: Flow<Int> = dataStore.data
        .map { it[PrefsKeys.MONTHLY_RECIPE_CALLS_USED] ?: 0 }

    // ========== Métodos de Escritura ==========

    suspend fun setReminderDays(days: Int) {
        dataStore.edit { it[PrefsKeys.REMINDER_DAYS] = days }
    }

    suspend fun setProStatus(isPro: Boolean) {
        dataStore.edit { it[PrefsKeys.IS_PRO] = isPro }
    }

    suspend fun setCloudConsent(consent: Boolean) {
        dataStore.edit { it[PrefsKeys.CLOUD_CONSENT] = consent }
    }

    suspend fun setNotificationsEnabled(enabled: Boolean) {
        dataStore.edit { it[PrefsKeys.NOTIFICATIONS_ENABLED] = enabled }
    }

    suspend fun setCookingTime(minutes: Int) {
        dataStore.edit { it[PrefsKeys.COOKING_TIME] = minutes }
    }

    suspend fun setAvailableUtensils(utensils: Set<String>) {
        dataStore.edit { it[PrefsKeys.AVAILABLE_UTENSILS] = utensils }
    }

    suspend fun incrementRecipeCalls() {
        dataStore.edit {
            val current = it[PrefsKeys.MONTHLY_RECIPE_CALLS_USED] ?: 0
            it[PrefsKeys.MONTHLY_RECIPE_CALLS_USED] = current + 1
        }
    }

    suspend fun resetMonthlyRecipeCalls() {
        dataStore.edit { it[PrefsKeys.MONTHLY_RECIPE_CALLS_USED] = 0 }
    }


}