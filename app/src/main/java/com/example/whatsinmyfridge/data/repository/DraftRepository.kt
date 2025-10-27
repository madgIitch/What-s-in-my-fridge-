package com.example.whatsinmyfridge.data.repository

import com.example.whatsinmyfridge.data.local.DraftDao
import com.example.whatsinmyfridge.data.local.db.ParsedDraftEntity
import kotlinx.coroutines.flow.Flow

class DraftRepository(
    private val draftDao: DraftDao
) {
    suspend fun saveDraft(draft: ParsedDraftEntity): Long = draftDao.insert(draft)

    // Cambiar de getPendingDrafts() a getAllFlow()
    fun getAllDrafts(): Flow<List<ParsedDraftEntity>> = draftDao.getAllFlow()

    suspend fun deleteDraft(draft: ParsedDraftEntity) = draftDao.delete(draft)

    suspend fun getById(id: Long): ParsedDraftEntity? = draftDao.getById(id)

}