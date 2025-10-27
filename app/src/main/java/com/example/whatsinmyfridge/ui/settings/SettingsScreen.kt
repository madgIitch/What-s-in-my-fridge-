package com.example.whatsinmyfridge.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import org.koin.androidx.compose.koinViewModel
import androidx.compose.material3.Switch
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import com.example.whatsinmyfridge.ui.settings.SettingsVm

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    viewModel: SettingsVm = koinViewModel()
) {
    val reminderDays by viewModel.reminderDays.collectAsState()
    val isPro by viewModel.isPro.collectAsState()
    val cloudConsent by viewModel.cloudConsent.collectAsState()
    val notificationsEnabled by viewModel.notificationsEnabled.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Configuración") })
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
        ) {
            // Días de antelación
            Text("Días de antelación para notificaciones")
            Slider(
                value = reminderDays.toFloat(),
                onValueChange = { viewModel.setReminderDays(it.toInt()) },
                valueRange = 1f..7f,
                steps = 5
            )
            Text("$reminderDays días")

            Spacer(modifier = Modifier.height(16.dp))

            // Notificaciones activadas
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Notificaciones activadas")
                Switch(
                    checked = notificationsEnabled,
                    onCheckedChange = { viewModel.setNotificationsEnabled(it) }
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Consentimiento de nube
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Sincronización en la nube")
                Switch(
                    checked = cloudConsent,
                    onCheckedChange = { viewModel.setCloudConsent(it) }
                )
            }

            // Estado Pro (solo lectura por ahora)
            if (isPro) {
                Spacer(modifier = Modifier.height(16.dp))
                Text("✨ Usuario Pro", style = MaterialTheme.typography.titleMedium)
            }
        }
    }
}