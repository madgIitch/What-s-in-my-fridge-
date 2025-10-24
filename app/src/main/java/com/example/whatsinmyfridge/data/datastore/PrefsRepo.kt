package com.example.whatsinmyfridge.data.local.datastore

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.map
import javax.inject.Inject

private val Context.dataStore by preferencesDataStore(name = "prefs")

class PrefsRepo @Inject constructor(@ApplicationContext ctx: Context) {
    private val ds = ctx.dataStore

    val consent = ds.data.map { it[PrefsKeys.consentCloud] ?: false }

    suspend fun setConsent(v: Boolean) {
        ds.edit { it[PrefsKeys.consentCloud] = v }
    }
}
