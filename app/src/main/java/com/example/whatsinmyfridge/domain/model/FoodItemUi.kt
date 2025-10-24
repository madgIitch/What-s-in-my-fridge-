package com.example.whatsinmyfridge.domain.model

import com.example.whatsinmyfridge.data.local.db.FoodItemEntity

data class FoodItemUi(
    val entity: FoodItemEntity,
    val state: ExpiryState,
    val daysLeft: Long
)
