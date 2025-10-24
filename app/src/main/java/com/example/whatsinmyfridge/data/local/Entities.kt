package com.example.whatsinmyfridge.data.local.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "food_items")
data class FoodItemEntity(
    @PrimaryKey val id: String,
    val name: String,
    val category: String,
    val quantity: Double,
    val unit: String,
    val expiryAt: Long,
    val addedAt: Long,
    val source: String
)

@Entity(tableName = "parsed_drafts")
data class ParsedDraftEntity(
    @PrimaryKey val id: String,
    val merchant: String?,
    val purchaseDate: Long?,
    val currency: String?,
    val total: Double?,
    val linesJson: String
)
