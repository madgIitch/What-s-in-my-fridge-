package com.example.whatsinmyfridge.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.whatsinmyfridge.data.repository.PrefsRepository
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class SettingsVm(
    private val prefsRepository: PrefsRepository
) : ViewModel() {

    val reminderDays = prefsRepository.reminderDays
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 3)

    val isPro = prefsRepository.isPro
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    val cloudConsent = prefsRepository.cloudConsent
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    val notificationsEnabled = prefsRepository.notificationsEnabled
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), true)

    fun setReminderDays(days: Int) {
        viewModelScope.launch {
            prefsRepository.setReminderDays(days)
        }
    }

    fun setNotificationsEnabled(enabled: Boolean) {
        viewModelScope.launch {
            prefsRepository.setNotificationsEnabled(enabled)
        }
    }

    fun setCloudConsent(consent: Boolean) {
        viewModelScope.launch {
            prefsRepository.setCloudConsent(consent)
        }
    }
}