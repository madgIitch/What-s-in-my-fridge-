package com.example.whatsinmyfridge.data.local.datastore

import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey

object PrefsKeys {
    val CONSENT_CLOUD = booleanPreferencesKey("consent_cloud")
    val REMIND_HOUR = intPreferencesKey("remind_hour")
    val COOKING_TIME = intPreferencesKey("cooking_time")
    val AVAILABLE_UTENSILS = stringSetPreferencesKey("available_utensils")
    val MONTHLY_RECIPE_CALLS_USED = intPreferencesKey("monthly_recipe_calls_used")
    val MONTHLY_RECIPE_CALLS = intPreferencesKey("monthly_recipe_calls")

}