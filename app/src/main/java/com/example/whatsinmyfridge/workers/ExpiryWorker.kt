package com.example.whatsinmyfridge.workers

import android.content.Context
import androidx.work.*
import androidx.work.WorkerParameters
import com.example.whatsinmyfridge.data.repository.InventoryRepository
import kotlinx.coroutines.flow.first
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.android.scopes.ViewModelScoped
import javax.inject.Inject

class ExpiryWorker(
    ctx: Context,
    params: WorkerParameters,
    private val repo: InventoryRepository
) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        val soon = repo.observeUi().first().filter { it.state != com.example.whatsinmyfridge.domain.model.ExpiryState.OK }
        if (soon.isNotEmpty()) NotificationHelper.showExpirySummary(applicationContext, soon)
        return Result.success()
    }
}
