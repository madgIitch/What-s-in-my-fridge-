package com.example.whatsinmyfridge.ui.widgets

import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.glance.Button
import androidx.glance.GlanceModifier
import androidx.glance.layout.Column
import androidx.glance.layout.padding
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle

class ExpiryWidget : GlanceAppWidget() {
    @Composable
    override fun Content() {
        // Lee una Snapshot (DataStore/Room + Glance)
        Column(modifier = GlanceModifier.padding(12.dp)) {
            Text("FridgeMind", style = TextStyle(fontWeight = FontWeight.Bold))
            Text("3 a punto de caducar", maxLines = 1)
            Button(text = "Abrir") { actionRunCallback<OpenAppAction>() }
        }
    }
}
