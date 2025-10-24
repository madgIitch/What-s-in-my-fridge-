package com.example.whatsinmyfridge.workers

import android.Manifest
import android.R
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import android.content.Context
import androidx.annotation.RequiresPermission
import com.example.whatsinmyfridge.domain.model.FoodItemUi

object NotificationHelper {
    private const val CH = "expiry"

    private fun ensureChannel(ctx: Context) {
        if (Build.VERSION.SDK_INT >= 26) {
            val ch = NotificationChannel(CH, "Caducidades", NotificationManager.IMPORTANCE_DEFAULT)
            ctx.getSystemService(NotificationManager::class.java).createNotificationChannel(ch)
        }
    }

    @RequiresPermission(Manifest.permission.POST_NOTIFICATIONS)
    fun showExpirySummary(ctx: Context, list: List<FoodItemUi>) {
        ensureChannel(ctx)
        val txt = list.joinToString { "${it.entity.name}(${it.daysLeft}d)" }
        val n = NotificationCompat.Builder(ctx, CH)
            .setSmallIcon(R.drawable.ic_dialog_info)
            .setContentTitle("Revisa tu nevera")
            .setContentText(txt.take(60))
            .setStyle(NotificationCompat.BigTextStyle().bigText(txt))
            .build()
        NotificationManagerCompat.from(ctx).notify(1001, n)
    }
}
