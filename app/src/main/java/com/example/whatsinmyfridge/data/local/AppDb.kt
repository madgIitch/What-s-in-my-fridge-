package com.example.whatsinmyfridge.data.local.db

import androidx.room.Database
import androidx.room.RoomDatabase
import com.example.whatsinmyfridge.data.local.DraftDao
import com.example.whatsinmyfridge.data.local.FoodDao

@Database(
    entities = [FoodItemEntity::class, ParsedDraftEntity::class],
    version = 1
)
abstract class AppDb : RoomDatabase() {
    abstract fun food(): FoodDao
    abstract fun drafts(): DraftDao
}
