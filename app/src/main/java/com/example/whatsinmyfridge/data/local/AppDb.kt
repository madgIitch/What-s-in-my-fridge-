package com.example.whatsinmyfridge.data.local.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.example.whatsinmyfridge.data.local.Converters
import com.example.whatsinmyfridge.data.local.DraftDao
import com.example.whatsinmyfridge.data.local.FoodDao

@Database(
    entities = [FoodItemEntity::class, ParsedDraftEntity::class],
    version = 2,
    exportSchema = false
)
@TypeConverters(Converters::class)
abstract class AppDb : RoomDatabase() {
    abstract fun food(): FoodDao
    abstract fun drafts(): DraftDao

}