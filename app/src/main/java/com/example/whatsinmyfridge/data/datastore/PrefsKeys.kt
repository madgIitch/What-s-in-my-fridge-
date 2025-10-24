package com.example.whatsinmyfridge.data.local.datastore

import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey

object PrefsKeys {
    val consentCloud = booleanPreferencesKey("consent_cloud")
    val remindHour = intPreferencesKey("remind_hour")
}
