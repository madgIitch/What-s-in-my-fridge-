package com.example.whatsinmyfridge.di

import android.content.Context
import androidx.room.Room
import com.example.whatsinmyfridge.data.local.db.AppDb
import com.example.whatsinmyfridge.data.local.db.FoodDao
import com.example.whatsinmyfridge.data.local.db.DraftDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides @Singleton
    fun provideDatabase(@ApplicationContext ctx: Context): AppDb =
        Room.databaseBuilder(ctx, AppDb::class.java, "fridge.db").build()

    @Provides fun provideFoodDao(db: AppDb): FoodDao = db.food()
    @Provides fun provideDraftDao(db: AppDb): DraftDao = db.drafts()
}
