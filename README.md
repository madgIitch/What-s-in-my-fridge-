# What's In My Fridge - Project Master Documentation

Last updated: 2026-02-15
Status: Single source of truth for the whole repository.

## 1. Purpose and Scope

This document replaces and consolidates all project markdown files currently in the repository. It covers:
- Product vision and user value
- Current architecture (frontend, backend, AI services, data)
- Monetization (RevenueCat + limits)
- Setup and deployment
- Ingredient normalization system
- Hackathon and roadmap context
- Script/tooling documentation
- Coverage map of legacy markdown files

## 2. Product Summary

What's In My Fridge is a cross-platform mobile app (Android + iOS) that helps users:
- Track fridge/pantry inventory
- Scan receipts and parse items with OCR
- Receive recipe suggestions from current inventory
- Import recipes from URL (YouTube, Instagram, TikTok, blogs)
- Save favorites, follow step-by-step cooking instructions, and generate shopping lists
- Plan meals in a calendar flow
- Unlock Pro usage through subscription

Core product idea: reduce the gap between "recipe inspiration" and "actually cooking".

## 3. Current Implementation Status (Code-validated)

### Implemented
- React Native app with Expo and TypeScript
- Firebase integration: Auth, Firestore, Functions, Storage
- WatermelonDB offline-first local database with sync workflows
- OCR flow with local/cloud fallback and receipt parsing
- Recipe suggestions via Cloud Functions
- URL recipe parsing flow backend and frontend screen
- Favorites and shopping list workflows
- Meal calendar and meal entry flows
- RevenueCat integration with paywall, purchase, restore, entitlement checks
- Free/Pro feature gating in app flows

### In progress / improving
- Automated tests (unit/integration/e2e) are still limited
- Documentation cleanup (this file is part of that consolidation)
- Production hardening and observability across all backend services

## 4. Architecture

### 4.1 Frontend Stack

Source of truth: `package.json`

- Expo `~54.0.31`
- React Native `0.81.5`
- React `19.1.0`
- TypeScript `~5.9.2`
- React Navigation v7 (`@react-navigation/native`, `@react-navigation/stack`, bottom tabs)
- Zustand `^5.0.10`
- WatermelonDB `^0.28.0`
- Firebase RN modules `^23.8.3` (app/auth/firestore/functions/storage)
- RevenueCat SDK `react-native-purchases ^9.8.0`

### 4.2 Mobile App Structure

Key navigation screens currently wired in `src/navigation/AppNavigator.tsx`:
- Auth: `Login`
- Main tabs/screens: `HomeTab`, `ScanTab`, `RecipesTab`, `CalendarTab`, `SettingsTab`, `FavoritesTab`
- Detail/modals: `ReviewDraft`, `Detail`, `AddItem`, `Crop`, `RecipeSteps`, `ConsumeIngredients`, `ConsumeRecipeIngredients`, `AddMeal`, `MealDetail`, `AddRecipeFromUrl`, `ShoppingList`, `Paywall`

### 4.3 Local Data Layer (WatermelonDB)

Source of truth: `src/database/schema.ts` (schema version 9)

Tables:
- `food_items`
- `parsed_drafts`
- `recipe_cache`
- `favorite_recipes`
- `meal_entries`
- `ingredients`
- `ingredient_mappings`

Architecture principle: offline-first local writes + asynchronous cloud sync.

### 4.4 Backend (Firebase Functions)

Source of truth: `whats-in-my-fridge-backend/functions/src/index.ts`

Exported cloud functions include:
- `parseReceipt`
- `getRecipeSuggestions`
- `normalizeScannedIngredient`
- `normalizeScannedIngredientsBatch`
- `parseRecipeFromUrl`
- `migrateInventoryNormalization`
- `uploadReceipt` (HTTP)
- `onReceiptUploaded` (Storage trigger)
- `syncInventoryToDevice` (Firestore trigger)

Functions runtime:
- Node 20 (`whats-in-my-fridge-backend/functions/package.json`)

### 4.5 AI and URL Parsing Services

`parseRecipeFromUrl` orchestrates extraction for:
- YouTube
- Instagram
- TikTok
- Blogs
- Manual text input fallback

Current implementation calls:
- Cloud Run Ollama service for ingredient/step extraction
- Cloud Run Whisper service for audio transcription fallback
- HTML scraping for blogs and metadata extraction

## 5. Core Features

### 5.1 Inventory and Sync
- Add/edit/delete inventory items
- Expiry tracking and item metadata
- Firestore sync for user inventory

### 5.2 OCR Receipt Flow
- Scan or upload receipt image
- Extract text (local/cloud strategy)
- Parse structured items into drafts
- Review draft before confirmation

### 5.3 Recipe Suggestions
- Recipe suggestion requests from available ingredients
- Local caching (`recipe_cache`)
- Match and missing-ingredient outputs

### 5.4 URL Recipe Import
- Paste social/blog URL
- Extract recipe text, ingredients, and steps
- Use result in cooking/favorites/shopping flows

### 5.5 Favorites, Steps, and Shopping
- Save favorite recipes
- Follow recipe steps in dedicated screen
- Generate shopping list from missing ingredients

### 5.6 Meal Planning
- Calendar-based meal entries
- Add meal with recipe or custom entries
- Meal detail and consumed ingredients tracking

## 6. Monetization (RevenueCat)

RevenueCat is integrated in current codebase.

Primary files:
- `App.tsx`
- `src/services/revenuecat/index.ts`
- `src/hooks/useSubscription.ts`
- `src/stores/useSubscriptionStore.ts`
- `src/screens/PaywallScreen.tsx`

### 6.1 Current Free vs Pro Limits

From `src/services/revenuecat/index.ts`:
- Free recipe suggestions: 5/month
- Free OCR scans: 5/month
- Free URL imports: 10/month
- Pro: unlimited for these gated flows

### 6.2 Gated Flows
- Recipe suggestions limit enforcement
- OCR monthly limit enforcement
- URL recipe import available only for Pro flow

### 6.3 Entitlements and Store
- Entitlement id default: `pro`
- RevenueCat keys loaded from Expo config/env
- Purchase and restore flows implemented

## 7. Setup and Local Development

### 7.1 Prerequisites
- Node.js 18+
- npm
- Expo tooling
- Android Studio / Xcode as needed
- Firebase project credentials

### 7.2 Frontend Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment (`.env`) for Firebase and RevenueCat keys:
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID`

3. Run app:
```bash
npm start
npm run android
npm run ios
```

### 7.3 Backend Functions Setup

```bash
cd whats-in-my-fridge-backend/functions
npm install
npm run build
npm run serve
```

Deploy:
```bash
npm run deploy
```

## 8. Deployment

### 8.1 Mobile (EAS)

Source of truth: `eas.json`
- Profiles: `development`, `preview`, `production`
- Production uses auto increment

### 8.2 Firebase
- Cloud Functions deployed from backend/functions project
- Firestore/Auth/Storage already part of architecture

### 8.3 Cloud Run (Optional but active in URL parsing flow)
- Ollama service (ingredient/steps extraction)
- Whisper service (audio transcription)

## 9. Ingredient Normalization System

Consolidated from strategy, integration, and backend docs.

### 9.1 Problem solved
Commercial/scanned ingredient names often do not match recipe-generic ingredient names.

### 9.2 Implemented approach
- Runtime normalization function(s) in Cloud Functions
- Multi-step matching strategy (exact/synonym/partial/fuzzy/llm fallback)
- Local cache in WatermelonDB table `ingredient_mappings`
- Use normalized ingredient names in recipe matching flow

### 9.3 Data and scripts
Backend includes scripts for:
- vocabulary upload
- ingredient classification
- action extraction
- normalization support workflows

Relevant folder:
- `whats-in-my-fridge-backend/scripts`

## 10. Legacy Context (Migration + Hackathon)

### 10.1 Migration Context
Project originated from Android native (Kotlin + Jetpack Compose) and migrated to React Native/Expo architecture.

### 10.2 Hackathon Context
Hackathon planning docs drove:
- URL import feature
- Cloud Run AI services
- RevenueCat monetization alignment
- Demo and submission planning

Some checklist items in old docs are historical snapshots and may no longer reflect current code state.

## 11. Risks and Gaps

- Tests are not yet comprehensive for critical flows
- Some historical docs conflict with current implementation (especially older migration/hackathon snapshots)
- Operational observability and SLO definitions are still maturing

## 12. Recommended Next Priorities

1. Add automated tests for critical user journeys:
- auth
- scan + parse + confirm
- recipes + limits
- paywall purchase/restore
- URL import happy path and failure modes

2. Harden backend integrations:
- retries and timeouts for external AI services
- better structured error taxonomy

3. Add observability:
- function-level metrics and alerts
- latency/error dashboards

4. Finalize store release readiness:
- build pipeline verification
- subscription product validation end-to-end

## 13. Legacy Markdown Coverage Map

This section maps every markdown file found in repository (excluding dependency/vendor folders) to where its content is consolidated here.

| Legacy file | Covered in this document |
|---|---|
| `README.md` | Sections 2, 3, 4, 7 |
| `ABOUT_PROJECT.md` | Sections 2, 10 |
| `TECH_STACK_ARCHITECTURE_AND_MONETIZATION.md` | Sections 4, 6 (updated with code truth) |
| `SETUP_GUIDE.md` | Section 7 |
| `NEXT_STEPS.md` | Sections 7, 12 |
| `MIGRATION_PLAN.md` | Section 10.1 |
| `MIGRATION_SUMMARY.md` | Sections 3, 10.1 |
| `PHASE2_COMPLETE.md` | Section 10.1 |
| `FRONTEND_INTEGRATION_PLAN.md` | Sections 4.2, 5.4, 12 |
| `REVENUECAT_SETUP.md` | Section 6 |
| `HACKATHON_PLAN.md` | Section 10.2 |
| `HACKATHON_PLAN_UPDATED.md` | Sections 4.5, 10.2 |
| `HACKATHON_CHECKLIST.md` | Sections 10.2, 12 |
| `CLOUD_RUN_SETUP.md` | Sections 4.5, 8.3 |
| `INGREDIENT_NORMALIZATION_STRATEGY.md` | Section 9 |
| `INGREDIENT_NORMALIZATION_INTEGRATION.md` | Section 9 |
| `whats-in-my-fridge-backend/QUICK-START.md` | Section 9.3 |
| `whats-in-my-fridge-backend/functions/DEPLOY_NORMALIZATION.md` | Section 9 |
| `whats-in-my-fridge-backend/functions/QUICKSTART_NORMALIZATION.md` | Section 9.3 |
| `whats-in-my-fridge-backend/functions/APPLY_NORMALIZED_GUIDE.md` | Section 9 |
| `whats-in-my-fridge-backend/functions/INGREDIENT_NORMALIZATION_GUIDE.md` | Section 9.3 |
| `whats-in-my-fridge-backend/scripts/README-classify.md` | Section 9.3 |
| `whats-in-my-fridge-backend/scripts/README-cooking-actions.md` | Section 9.3 |

## 14. Deprecation Plan for Old Markdown Files

Recommended:
1. Keep this file as canonical documentation.
2. Move old markdown files to an `archive/docs-legacy/` folder, or replace each with a 3-5 line pointer to this file.
3. Keep only task-specific runbooks when they are still actively used.

---

If any section here conflicts with implementation, implementation code is the source of truth.
