# What's In My Fridge — Project Overview

**What's In My Fridge** is an Android food-inventory management application that uses **OCR recognition**, **local database storage**, and **AI-powered recipe suggestions** to help users track groceries, expiration dates, and meal possibilities seamlessly.

---

## 1. Overview

What's In My Fridge is an **offline-first Android app**. It automatically scans grocery receipts with OCR (optimized for German markets), extracts items, tracks expiration dates, and generates AI-based recipe ideas based on the user's inventory.

---

## 2. Key Features

### 🎯 OCR Receipt Scanning
- Local OCR with **ML Kit Text Recognition**  
  _Reference: `ScanVm.kt:10-12`_
- Parsing optimized for German receipts:  
  E-Center, Kaiserin-Augusta  
  _Reference: `parseReceipt.ts:112-115`_
- Draft review system before confirmation of scanned items.

### 📦 Inventory Management
- Local **Room** database with optional Firestore sync  
  _Reference: `AppModule.kt:58-66`_
- Expiration date tracking and **automatic notifications**  
  _Reference: `FridgeApp.kt:232-243`_
- Multi-device synchronization via **Firebase Cloud Messaging**  
  _Reference: `InventoryRepository.kt:181-204`_

### 🍳 AI Recipe Suggestions
- 120.5 MB corpus with **~100K normalized recipes** (Llama 3.1 8B)
- Local recipe cache with **60-minute TTL**  
  _Reference: `AppModule.kt:136-144`_
- Freemium model with monthly usage limits.

---

## 3. Tech Stack

### Android (Frontend)
- **UI:** Jetpack Compose + Material 3  
- **Architecture:** MVVM · Koin DI  
  _Reference: `AppModule.kt:50`_
- **Database:** Room v5 (4 tables)  
  - `food_items`  
  - `parsed_drafts`  
  - `recipe_cache`  
  - `ingredients`  
  _Reference: `AppModule.kt:72-89`_
- **Preferences:** DataStore  
  _Reference: `AppModule.kt:97`_
- **OCR:** ML Kit Text Recognition 16.0.0  
  _Reference: `ScanVm.kt:10-12`_
- **Background:** WorkManager for periodic tasks  
  _Reference: `FridgeApp.kt:5-7`_

### Backend (Firebase)
- Firebase Auth + App Check (Play Integrity)  
  _Reference: `FridgeApp.kt:190-198`_
- Firestore (region: eur3)  
- Cloud Functions (us-central1, europe-west1)  
- Cloud Storage for receipt images

### Recipe Infrastructure
- Offline normalization pipeline using **Ollama + Llama 3.1 8B**  
  _Reference: `FridgeApp.kt:118-120`_
- Ingredient matching via **Levenshtein similarity**

---

## 4. Architecture

### Data Flow
User → UI (Compose) → ViewModel → Repository → Room DB
↓ (optional)
Firestore ← Cloud Functions


### Offline-First Pattern
The application is **fully functional offline**.  
Cloud sync is optional and governed by the `cloudConsent` DataStore preference.

---

## 5. Project Setup

### Requirements
- Android Studio Hedgehog+
- JDK 17+
- Node.js 20.x (for Cloud Functions)
- Firebase Project

## Project Structure

### Android App  
`app/src/main/java/com/example/whatsinmyfridge/`


├── di/ # Dependency injection (Koin)
├── data/
│ ├── local/ # Room DAOs and entities
│ └── repository/ # Repository layer
├── ui/ # Compose screens & ViewModels
│ ├── home/ # Inventory
│ ├── scan/ # OCR scanning
│ ├── review/ # Draft review
│ ├── recipespro/ # AI recipe suggestions
│ └── settings/ # App settings
└── workers/ # WorkManager background tasks


---

### Backend  
`whats-in-my-fridge-backend/functions/src/`

├── index.ts # Cloud Functions entrypoint
├── parseReceipt.ts # OCR parsing logic
├── recipeMatcher.ts # Recipe matcher engine
└── types/ # TypeScript interfaces


---

### Credits

Developed by **Pepe Ortiz Roldán**  
Active development: **October–December 2025**

