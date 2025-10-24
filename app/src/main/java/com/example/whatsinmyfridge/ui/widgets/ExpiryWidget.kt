package com.example.whatsinmyfridge.ui.widgets

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.*
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.text.FontWeight
import androidx.glance.appwidget.cornerRadius
import androidx.glance.unit.ColorProvider
import com.example.whatsinmyfridge.data.local.db.AppDb
import com.example.whatsinmyfridge.domain.model.ExpiryState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.koin.core.component.KoinComponent
import org.koin.core.component.inject
import java.time.LocalDate
import java.time.temporal.ChronoUnit

/**
 * Widget de Glance que muestra items próximos a caducar.
 *
 * Se actualiza cada 30 minutos y muestra hasta 5 items
 * ordenados por fecha de caducidad.
 */
class ExpiryWidget : GlanceAppWidget(), KoinComponent {

    // Inyectar AppDb usando Koin
    private val appDb: AppDb by inject()

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val items = loadExpiringItems()

        provideContent {
            GlanceTheme {
                WidgetContent(items)
            }
        }
    }

    @Composable
    private fun WidgetContent(items: List<WidgetItem>) {
        Column(
            modifier = GlanceModifier
                .fillMaxSize()
                .background(Color.White)
                .cornerRadius(16.dp)
                .padding(16.dp),
            verticalAlignment = Alignment.Top
        ) {
            // Título
            Text(
                text = "Mi Nevera 🥗",
                style = TextStyle(
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = ColorProvider(Color.Black)
                ),
                modifier = GlanceModifier.padding(bottom = 12.dp)
            )

            if (items.isEmpty()) {
                Text(
                    text = "Todo está fresco ✓",
                    style = TextStyle(
                        fontSize = 14.sp,
                        color = ColorProvider(Color.Gray)
                    )
                )
            } else {
                Column(
                    modifier = GlanceModifier.fillMaxWidth(),
                    verticalAlignment = Alignment.Top
                ) {
                    items.take(5).forEach { item ->
                        WidgetItemRow(item)
                        Spacer(modifier = GlanceModifier.height(8.dp))
                    }
                }
            }
        }
    }

    @Composable
    private fun WidgetItemRow(item: WidgetItem) {
        Row(
            modifier = GlanceModifier.fillMaxWidth(),
            horizontalAlignment = Alignment.Start,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Nombre del item
            Text(
                text = item.name,
                style = TextStyle(
                    fontSize = 14.sp,
                    color = ColorProvider(Color.Black)
                ),
                modifier = GlanceModifier.defaultWeight()
            )

            // Badge con días restantes
            Box(
                modifier = GlanceModifier
                    .background(item.badgeColor)
                    .cornerRadius(8.dp)
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "${item.daysLeft}d",
                    style = TextStyle(
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = ColorProvider(Color.White)
                    )
                )
            }
        }
    }

    private suspend fun loadExpiringItems(): List<WidgetItem> {
        return withContext(Dispatchers.IO) {
            try {
                // Usar la instancia de AppDb inyectada por Koin
                val allItems = appDb.food().getAll()

                allItems
                    .map { entity ->
                        val days = ChronoUnit.DAYS.between(LocalDate.now(), entity.expiryDate)
                        val state = when {
                            days < 0 -> ExpiryState.EXPIRED
                            days <= 3 -> ExpiryState.SOON
                            else -> ExpiryState.OK
                        }
                        val color = when (state) {
                            ExpiryState.OK -> Color(0xFF4CAF50)
                            ExpiryState.SOON -> Color(0xFFFFC107)
                            ExpiryState.EXPIRED -> Color(0xFFF44336)
                        }
                        WidgetItem(entity.name, days, color)
                    }
                    .filter { it.daysLeft <= 7 } // Solo items que caducan en 7 días
                    .sortedBy { it.daysLeft }
            } catch (e: Exception) {
                emptyList()
            }
        }
    }

    private data class WidgetItem(
        val name: String,
        val daysLeft: Long,
        val badgeColor: Color
    )
}

/**
 * Receiver que maneja las actualizaciones del widget.
 */
class ExpiryWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = ExpiryWidget()
}