package com.example.whatsinmyfridge.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.example.whatsinmyfridge.data.local.db.ParsedDraftEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface DraftDao {
    @Query("SELECT * FROM parsed_drafts ORDER BY timestamp DESC")
    fun getAllFlow(): Flow<List<ParsedDraftEntity>>

    @Query("SELECT * FROM parsed_drafts WHERE id = :id")
    suspend fun getById(id: Long): ParsedDraftEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(draft: ParsedDraftEntity): Long

    @Delete
    suspend fun delete(draft: ParsedDraftEntity)

    @Query("DELETE FROM parsed_drafts")
    suspend fun deleteAll()
}