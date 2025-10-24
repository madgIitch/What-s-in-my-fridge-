// app/src/main/java/com/example/whatsinmyfridge/workers/ExpiryWorker.kt
package com.example.whatsinmyfridge.workers

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

class ExpiryWorker(
    ctx: Context,
    params: WorkerParameters
) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        // TODO: leer DB y notificar; por ahora solo OK
        return Result.success()
    }
}
