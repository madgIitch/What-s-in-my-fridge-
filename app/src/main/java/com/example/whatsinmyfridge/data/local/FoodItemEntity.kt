package com.example.whatsinmyfridge.data.local.db

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.time.LocalDate

@Entity(tableName = "food_items")
data class FoodItemEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val name: String,
    val expiryDate: LocalDate,
    val category: String? = null,
    val quantity: Int = 1,
    val notes: String? = null,
    val unit: String = "unidad",
    val expiryAt: Long = 0L,
    val addedAt: Long = System.currentTimeMillis(),
    val source: String = "manual"
)