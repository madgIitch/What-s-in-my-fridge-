package com.example.whatsinmyfridge.domain.model

data class ParsedDraft(
    val id: String,
    val merchant: String?,
    val purchaseDate: Long?,
    val items: List<String> = emptyList()
)
