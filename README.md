Overview 
What's In My Fridge is an Android food inventory management application that uses OCR technology to automatically scan grocery receipts, track expiration dates, and provide AI-powered recipe suggestions based on available ingredients AppModule.kt:31-49 .

Key Features 
🎯 OCR Receipt Scanning 
Local processing with ML Kit Text Recognition ScanVm.kt:10-12
Parsing optimized for German receipts (E-Center, Kaiserin-Augusta) parseReceipt.ts:112-115
Draft review system before confirmation
📦 Inventory Management 
Local Room database with optional Firestore synchronization AppModule.kt:58-66
Expiration date tracking with automatic notifications FridgeApp.kt:232-243
Multi-device synchronization via Firebase Cloud Messaging InventoryRepository.kt:181-204
🍳 AI Recipe Suggestions 
120.5 MB corpus with ~100K recipes normalized by Llama 3.1 8B
Local cache with 60-minute TTL AppModule.kt:136-144
Freemium model with monthly limits for free users
Tech Stack 
Android (Frontend) 
UI: Jetpack Compose with Material3
Architecture: MVVM with Koin for dependency injection AppModule.kt:50
Database: Room v5 with 4 tables (food_items, parsed_drafts, recipe_cache, ingredients) AppModule.kt:72-89
Preferences: DataStore for user settings AppModule.kt:97
OCR: ML Kit Text Recognition 16.0.0 ScanVm.kt:10-12
Background: WorkManager for periodic notifications FridgeApp.kt:5-7
Backend (Firebase) 
Authentication: Firebase Auth with App Check (Play Integrity) FridgeApp.kt:190-198
Database: Firestore (eur3 region) with security rules
Functions: Cloud Functions in us-central1 and europe-west1
Storage: Cloud Storage for receipt images
Recipe Infrastructure 
Normalization: Offline pipeline with Ollama + Llama 3.1 8B on GCP GPU VMs FridgeApp.kt:118-120
Matching: Levenshtein similarity algorithm for ingredients
Architecture 
Data Flow 
User → UI (Compose) → ViewModel → Repository → Room DB  
                                   ↓ (optional)  
                                Firestore ← Cloud Functions  
Offline-First Pattern 
The application works completely offline. Firestore synchronization is optional and controlled by the cloudConsent preference .

Project Setup 
Requirements 
Android Studio Hedgehog or higher
JDK 17+
Node.js 20.x (for Cloud Functions)
Firebase account with configured project
Installation 
Clone the repository
git clone https://github.com/madgIitch/What-s-in-my-fridge-.git  
cd What-s-in-my-fridge-
Configure Firebase
Download google-services.json from Firebase Console
Place in app/google-services.json
Install backend dependencies
cd whats-in-my-fridge-backend/functions  
npm install
Build the Android app
./gradlew assembleDebug
Project Structure 
app/src/main/java/com/example/whatsinmyfridge/  
├── di/                    # Dependency injection (Koin)  
├── data/  
│   ├── local/            # Room DAOs and entities  
│   └── repository/       # Repository layer  
├── ui/                   # Compose screens and ViewModels  
│   ├── home/            # Main inventory  
│   ├── scan/            # OCR scanning  
│   ├── review/          # Draft review  
│   ├── recipespro/      # Recipe suggestions  
│   └── settings/        # Settings  
└── workers/             # Background tasks (WorkManager)  
  
whats-in-my-fridge-backend/functions/src/  
├── index.ts             # Main Cloud Functions  
├── parseReceipt.ts      # OCR parsing logic  
├── recipeMatcher.ts     # Recipe matching  
└── types/               # TypeScript interfaces  
Security 
Firebase App Check: Integrity validation with Play Integrity API FridgeApp.kt:193-196
Firestore Rules: User data ownership validation
Emulator Mode: Simulated authentication for local development
Contributions 
Developed by Pepe Ortiz Roldán. Recent commits between October-December 2025
