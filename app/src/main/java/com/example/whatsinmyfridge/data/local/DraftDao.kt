package com.example.whatsinmyfridge.data.local.db

import androidx.room.*

@Dao
interface DraftDao {
    @Query("SELECT * FROM parsed_drafts WHERE id = :id")
    suspend fun get(id: String): ParsedDraftEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(draft: ParsedDraftEntity)

    @Query("DELETE FROM parsed_drafts WHERE id = :id")
    suspend fun delete(id: String)
}
