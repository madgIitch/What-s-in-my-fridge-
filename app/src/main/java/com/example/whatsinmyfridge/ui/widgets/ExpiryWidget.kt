package com.example.whatsinmyfridge.ui.widgets

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.glance.Button
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.actionStartActivity
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.provideContent
import androidx.glance.layout.Column
import androidx.glance.layout.padding
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.example.whatsinmyfridge.MainActivity

class ExpiryWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            WidgetContent()
        }
    }

    @Composable
    private fun WidgetContent() {
        Column(modifier = GlanceModifier.padding(12.dp)) {
            Text(
                text = "FridgeMind",
                style = TextStyle(fontWeight = FontWeight.Bold)
            )
            Text(
                text = "3 a punto de caducar",
                maxLines = 1
            )
            Button(
                text = "Abrir",
                onClick = actionStartActivity<MainActivity>()
            )
        }
    }
}