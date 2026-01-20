# What's in my fridge

## Estado actual del proyecto
- Android app en Kotlin + Jetpack Compose con navegacion y pantallas: login, home (inventario), add item, detail, scan, review draft, settings, recipes pro.
- Datos locales con Room (food_items, parsed_drafts, recipe_cache, ingredients) y preferencias con DataStore.
- OCR en dispositivo con ML Kit; parser heuristico genera borradores que se revisan antes de confirmar.
- Sync opcional con Firebase Auth/Firestore (consentimiento de nube) para inventario.
- Recetas Pro via Cloud Functions con cache local, limites mensuales (Free/Pro) y preferencias de cocina.
- Notificaciones de caducidad con WorkManager + widget de resumen.
- Backend Firebase Functions (TS): parseReceipt (Vision API), uploadReceipt, storage trigger, getRecipeSuggestions, syncInventoryToDevice (FCM).
- Seguridad con Firebase App Check (Play Integrity).

## Arquitectura y componentes
- App Android: `app/` (Compose UI, Koin DI, Room, DataStore, WorkManager).
- Backend: `whats-in-my-fridge-backend/` (Firebase Functions + reglas de Firestore/Storage).
- Datos de recetas: `app/src/main/assets/recipes.json` y `whats-in-my-fridge-backend/functions/data/recipes.json`.

## Trabajo realizado (sprints completados)
### Sprint 1 - Base app e inventario
- Estructura del proyecto Android, Compose UI, Koin DI y navegacion base.
- Login/registro con Firebase Auth.
- CRUD de inventario local con Room y pantalla de detalle.

### Sprint 2 - OCR y borradores
- Flujo de escaneo con ML Kit (OCR local).
- Parser heuristico y guardado de borradores en Room.
- Pantalla de revision para convertir borradores en items confirmados.
- Preferencias de usuario (notificaciones, cloud consent).

### Sprint 3 - Recetas Pro y experiencia extendida
- Cloud Functions para sugerencias de recetas con fuzzy matching.
- Cache local de recetas y limites mensuales Free/Pro.
- Carga de ingredientes desde assets para clasificacion.
- Worker de caducidad + widget y App Check.

## Trabajo por realizar (sprints propuestos)
### Sprint 4 - Cierre de flujo recetas y clasificacion
- Implementar navegacion pendiente en Recipes Pro (detalle de receta y lista de compra).
- Integrar FoodClassifierRepository en el flujo de alta (auto-categoria).
- Unificar flujo OCR app + backend (usar uploadReceipt/parseReceipt desde la app).

### Sprint 5 - Sincronizacion y robustez
- Manejar FCM en la app (registro de token y recepcion de eventos INVENTORY_SYNC).
- Resolver conflictos y reintentos de sync (offline-first real).
- Mejorar parsing de tickets con mas formatos y pruebas de regresion.

### Sprint 6 - Calidad y release
- Tests unitarios/instrumentados para repositorios y ViewModels clave.
- CI basico (lint + tests) y build de release.
- Documentacion de despliegue Firebase y configuracion de entornos.
