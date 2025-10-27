package com.example.whatsinmyfridge.workers

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.example.whatsinmyfridge.data.local.db.AppDb
import com.example.whatsinmyfridge.data.repository.PrefsRepository
import com.example.whatsinmyfridge.domain.model.ExpiryState  // ✅ AGREGAR
import com.example.whatsinmyfridge.domain.model.FoodItemUi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import org.koin.core.component.KoinComponent
import org.koin.core.component.inject
import java.time.LocalDate
import java.time.temporal.ChronoUnit

class ExpiryWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params), KoinComponent {

    private val appDb: AppDb by inject()
    private val prefsRepository: PrefsRepository by inject()  // ✅ Cambiar a PrefsRepository

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            // Verificar si las notificaciones están activadas
            val notificationsEnabled = prefsRepository.notificationsEnabled.first()  // ✅ Usar instancia
            if (!notificationsEnabled) {
                return@withContext Result.success()
            }

            val reminderDays = prefsRepository.reminderDays.first()  // ✅ Usar prefsRepository

            val allItems = appDb.food().getAll()
            val expiringItems = allItems
                .map { entity ->
                    val days = ChronoUnit.DAYS.between(LocalDate.now(), entity.expiryDate)
                    val state = calculateExpiryState(days)
                    FoodItemUi(entity, state, days)
                }
                .filter { it.daysLeft <= reminderDays }
                .sortedBy { it.daysLeft }

            if (expiringItems.isNotEmpty()) {
                NotificationHelper.showExpirySummary(applicationContext, expiringItems)
            }

            Result.success()
        } catch (e: Exception) {
            Result.failure()
        }
    }

    private fun calculateExpiryState(days: Long): ExpiryState = when {
        days < 0 -> ExpiryState.EXPIRED
        days <= 3 -> ExpiryState.SOON
        else -> ExpiryState.OK
    }
}