package com.example.whatsinmyfridge.data.local.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "parsed_drafts")
data class ParsedDraftEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val rawText: String,
    val timestamp: Long = System.currentTimeMillis(),
    val merchant: String? = null,
    val purchaseDate: String? = null,
    val currency: String = "EUR",
    val total: Double? = null,
    val linesJson: String = "[]"
)