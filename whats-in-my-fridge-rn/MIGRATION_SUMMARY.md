# Resumen de Migración: Android → React Native

## Estado de la Migración

**Fecha:** 2026-01-20
**Progreso:** Fase 1 Completada (Fundaciones)

---

## ✅ Completado

### 1. Setup del Proyecto
- ✅ Proyecto Expo creado con TypeScript
- ✅ Estructura de carpetas organizada (src/ con 9 subdirectorios)
- ✅ Dependencias core instaladas (React Navigation, Zustand, WatermelonDB)
- ✅ Configuración de TypeScript

### 2. Base de Datos (WatermelonDB)
- ✅ Esquema completo con 4 tablas:
  - `food_items`: Inventario principal (11 campos)
  - `parsed_drafts`: Borradores OCR (11 campos)
  - `recipe_cache`: Caché de recetas (6 campos)
  - `ingredients`: Referencia de ingredientes (4 campos)
- ✅ Modelos con decoradores y computed properties
- ✅ Inicialización de database con SQLiteAdapter

### 3. State Management (Zustand)
- ✅ **useAuthStore**: Autenticación (user, loading, error)
- ✅ **useInventoryStore**: Items del inventario con sync status
- ✅ **useDraftStore**: Borradores de OCR
- ✅ **useRecipeStore**: Recetas y caché
- ✅ **usePreferencesStore**: Preferencias persistidas con AsyncStorage
  - Incluye: reminderDays, isPro, cloudConsent, notificationsEnabled, cookingTime, availableUtensils, monthlyRecipeCallsUsed
  - Auto-reset mensual de contador de recetas

### 4. Sistema de Diseño
- ✅ **Colores**: Paleta Material Design 3 completa (28 colores)
- ✅ **Tipografía**: 15 estilos (display, headline, title, body, label)
- ✅ **Spacing**: Sistema basado en 8px grid (7 tamaños)
- ✅ **Border Radius**: 6 tamaños predefinidos

### 5. TypeScript Types
- ✅ ExpiryState, FoodItemSource, RootStackParamList
- ✅ Constantes de categorías, unidades, utensilios
- ✅ RECIPE_LIMITS por tier (Free: 10, Pro: 100)

### 6. Documentación
- ✅ README completo con arquitectura e instalación
- ✅ MIGRATION_PLAN detallado (mapeo Kotlin → React Native)
- ✅ NEXT_STEPS con instrucciones paso a paso
- ✅ MIGRATION_SUMMARY (este documento)

---

## 📋 Pendiente (Próximas Fases)

### Fase 2: Firebase y Servicios (Estimado: 1 semana)
- [ ] Instalar Firebase React Native SDK
- [ ] Configurar google-services.json y GoogleService-Info.plist
- [ ] Implementar servicios:
  - [ ] `firebase/auth.ts` (signIn, signUp, signOut)
  - [ ] `firebase/firestore.ts` (sync bidireccional)
  - [ ] `firebase/functions.ts` (getRecipeSuggestions, parseReceipt)
  - [ ] `firebase/storage.ts` (upload de imágenes)
- [ ] Configurar listener de auth state
- [ ] Implementar sincronización Firestore→WatermelonDB

### Fase 3: Navegación (Estimado: 2-3 días)
- [ ] Crear AppNavigator con Stack Navigator
- [ ] Configurar 8 rutas:
  - Login, Home, Scan, ReviewDraft, Detail, AddItem, RecipesPro, Settings
- [ ] Implementar auth flow (Login vs Home como inicial)
- [ ] Configurar estilos de headers

### Fase 4: Hooks Personalizados (Estimado: 3 días)
- [ ] `useInventory.ts`: CRUD operations con WatermelonDB + Firestore sync
- [ ] `useFirestoreSync.ts`: Start/stop sync listener
- [ ] `useOCR.ts`: Captura de imagen, OCR, parsing
- [ ] `useRecipes.ts`: Obtener recetas con cache y límites

### Fase 5: Pantallas (Estimado: 2 semanas)
- [ ] **LoginScreen**: Email/password, forgot password, sign up
- [ ] **HomeScreen**: FlatList de items, sync status, FAB para scan/add
- [ ] **ScanScreen**: Cámara, OCR con ML Kit, parsing de tickets
- [ ] **ReviewDraftScreen**: Editar items parseados antes de confirmar
- [ ] **DetailScreen**: Ver/editar item individual
- [ ] **AddItemScreen**: Formulario de añadir item manual
- [ ] **RecipesProScreen**: Lista de recetas, filtros, límites
- [ ] **SettingsScreen**: Preferencias, logout, sync settings

### Fase 6: Componentes UI (Estimado: 1 semana)
- [ ] **Common**:
  - [ ] Button.tsx (primary, secondary, text variants)
  - [ ] Card.tsx (elevated, outlined)
  - [ ] Input.tsx (text, number, date pickers)
  - [ ] Loading.tsx (spinner)
- [ ] **Inventory**:
  - [ ] FoodItemCard.tsx (con ExpiryBadge, swipe actions)
  - [ ] ExpiryBadge.tsx (OK/SOON/EXPIRED con colores)
  - [ ] SourceBadge.tsx (manual/ocr)
- [ ] **Recipes**:
  - [ ] RecipeCard.tsx (match %, ingredientes)
  - [ ] IngredientList.tsx (con checkmarks para matched)

### Fase 7: OCR y Parsing (Estimado: 1 semana)
- [ ] Configurar react-native-text-recognition (o alternativa Cloud Vision)
- [ ] Implementar `textRecognition.ts`
- [ ] Migrar lógica de `receiptParser.ts` desde Kotlin:
  - [ ] Detectar tienda (E-Center, Kaiserin-Augusta, etc.)
  - [ ] Regex patterns para items y precios
  - [ ] Detectar fecha de compra
  - [ ] Detectar total
  - [ ] Separar líneas no reconocidas
- [ ] Testing con múltiples formatos de recibos

### Fase 8: Notificaciones y Background (Estimado: 3-4 días)
- [ ] Configurar expo-notifications
- [ ] Request permissions (iOS/Android)
- [ ] Implementar `notifications.ts`:
  - [ ] showExpirySummary
  - [ ] scheduleNotification
  - [ ] Handle notification taps
- [ ] Implementar `backgroundTasks.ts`:
  - [ ] ExpiryCheckTask cada 24h
  - [ ] Filtrar items por expirar según reminderDays
  - [ ] Enviar notificación si hay items

### Fase 9: Assets y Datos Iniciales (Estimado: 1-2 días)
- [ ] Copiar `recipes.json` desde proyecto Android a `assets/`
- [ ] Implementar carga de ingredientes:
  - [ ] Parse JSON al iniciar app
  - [ ] Insertar en tabla `ingredients` de WatermelonDB
  - [ ] Evitar duplicados
- [ ] Crear iconos de app (icon.png, splash.png)
- [ ] Crear notification icon

### Fase 10: Testing (Estimado: 1 semana)
- [ ] Unit tests para stores (Zustand)
- [ ] Unit tests para utils (dateUtils, expiryState)
- [ ] Integration tests para hooks (useInventory, useRecipes)
- [ ] E2E tests con Detox (opcional):
  - [ ] Login flow
  - [ ] Add item flow
  - [ ] OCR flow
  - [ ] Recipe suggestions flow

### Fase 11: Build y Deployment (Estimado: 3-4 días)
- [ ] Instalar EAS CLI: `npm install -g eas-cli`
- [ ] Configurar `eas.json` con profiles (dev, preview, production)
- [ ] Build Android:
  - [ ] Development build
  - [ ] Preview build (APK)
  - [ ] Production build (AAB para Play Store)
- [ ] Build iOS:
  - [ ] Development build
  - [ ] Ad-hoc build (TestFlight)
  - [ ] Production build (App Store)
- [ ] Submit to stores

---

## Mapeo de Componentes Migrados

| Componente Android | Archivo Kotlin | Componente RN | Estado |
|-------------------|----------------|---------------|--------|
| FoodItemEntity | app/data/local/FoodItemEntity.kt | database/models/FoodItem.ts | ✅ |
| ParsedDraftEntity | app/data/local/ParsedDraftEntity.kt | database/models/ParsedDraft.ts | ✅ |
| RecipeCacheEntity | app/data/local/RecipeCacheEntity.kt | database/models/RecipeCache.ts | ✅ |
| IngredientEntity | app/data/local/IngredientEntity.kt | database/models/Ingredient.ts | ✅ |
| HomeVm | app/ui/home/HomeVm.kt | stores/useInventoryStore.ts | ✅ |
| LoginVm | app/ui/login/LoginVm.kt | stores/useAuthStore.ts | ✅ |
| SettingsVm | app/ui/settings/SettingsVm.kt | stores/usePreferencesStore.ts | ✅ |
| RecipesProVm | app/ui/recipespro/RecipesProVm.kt | stores/useRecipeStore.ts | ✅ |
| ReviewDraftVm | app/ui/review/ReviewDraftVm.kt | stores/useDraftStore.ts | ✅ |
| InventoryRepository | app/data/repository/InventoryRepository.kt | hooks/useInventory.ts | ⏳ |
| PrefsRepository | app/data/repository/PrefsRepository.kt | stores/usePreferencesStore.ts | ✅ |
| DraftRepository | app/data/repository/DraftRepository.kt | hooks/useDrafts.ts | ⏳ |
| RecipeCacheRepository | app/data/repository/RecipeCacheRepository.kt | hooks/useRecipes.ts | ⏳ |
| HomeScreen | app/ui/home/HomeScreen.kt | screens/HomeScreen.tsx | ⏳ |
| LoginScreen | app/ui/login/LoginScreen.kt | screens/LoginScreen.tsx | ⏳ |
| ScanScreen | app/ui/scan/ScanScreen.kt | screens/ScanScreen.tsx | ⏳ |
| ReviewDraftScreen | app/ui/review/ReviewDraftScreen.kt | screens/ReviewDraftScreen.tsx | ⏳ |
| DetailScreen | app/ui/detail/DetailScreen.kt | screens/DetailScreen.tsx | ⏳ |
| AddItemScreen | app/ui/add/AddItemScreen.kt | screens/AddItemScreen.tsx | ⏳ |
| RecipesProScreen | app/ui/recipespro/RecipesProScreen.kt | screens/RecipesProScreen.tsx | ⏳ |
| SettingsScreen | app/ui/settings/SettingsScreen.kt | screens/SettingsScreen.tsx | ⏳ |
| ExpiryWorker | app/workers/ExpiryWorker.kt | services/backgroundTasks.ts | ⏳ |
| OCR Parser | app/ui/scan/ScanVm.kt (parseSimulatedText) | services/ocr/receiptParser.ts | ⏳ |

**Leyenda:**
- ✅ Completado
- ⏳ Pendiente

---

## Equivalencias Tecnológicas

| Tecnología Android | Tecnología React Native | Cambio Principal |
|-------------------|------------------------|------------------|
| Jetpack Compose | React Native + JSX | Ambos declarativos, sintaxis diferente |
| Room Database | WatermelonDB | SQLite reactivo, similar API |
| DataStore | AsyncStorage + Zustand persist | Key-value storage |
| Koin DI | React Hooks + Context | DI built-in en React |
| StateFlow | useState + Zustand | Estado reactivo |
| ViewModel | Zustand stores | State management global |
| Coroutines | async/await | Async operations |
| Flow | Observables (WatermelonDB) | Reactive streams |
| ML Kit OCR | react-native-text-recognition | Wrapper de ML Kit |
| WorkManager | expo-task-manager | Background tasks |
| Firebase Auth | @react-native-firebase/auth | Mismo backend |
| Firestore | @react-native-firebase/firestore | Mismo backend |
| Cloud Functions | @react-native-firebase/functions | Mismo backend (sin cambios) |

---

## Ventajas Obtenidas con React Native

1. **Multiplataforma**: iOS + Android con una sola base de código
2. **Desarrollo más rápido**: Hot reload instantáneo
3. **Ecosistema JavaScript**: Acceso a NPM (millones de paquetes)
4. **Menor curva de aprendizaje**: JavaScript/TypeScript vs Kotlin
5. **Comunidad más grande**: Más recursos y ejemplos
6. **Web compatible**: Potencial uso de React Native Web

---

## Desafíos a Resolver

1. **OCR nativo**: react-native-text-recognition puede tener limitaciones
   - **Solución alternativa**: Usar Cloud Vision API directamente
2. **Background tasks en iOS**: Restricciones de iOS para tareas en background
   - **Solución**: Usar background fetch de Expo con límites de iOS
3. **Performance del parsing**: OCR intensivo puede ser más lento
   - **Solución**: Optimizar algoritmos de parsing, usar Web Workers si es necesario

---

## Métricas del Proyecto

### Archivos creados:
- **Database**: 6 archivos (schema + 4 modelos + index)
- **Stores**: 5 archivos (auth, inventory, drafts, recipes, preferences)
- **Theme**: 4 archivos (colors, typography, spacing, index)
- **Types**: 1 archivo
- **Docs**: 4 archivos (README, MIGRATION_PLAN, NEXT_STEPS, este archivo)

**Total**: 20 archivos de código + documentación

### Líneas de código:
- **Database**: ~400 líneas
- **Stores**: ~250 líneas
- **Theme**: ~200 líneas
- **Types**: ~70 líneas
- **Total código**: ~920 líneas

### Dependencias instaladas:
- Core: 6 (Expo, React, React Native, Navigation, Zustand, WatermelonDB)
- Expo modules: 6 (screens, safe-area, notifications, task-manager, background-fetch, image)
- Utilities: 2 (AsyncStorage, date-fns)

**Total**: 14 dependencias (Firebase pendiente)

---

## Próximos Pasos Recomendados

### Inmediato (Esta sesión):
1. Instalar Firebase SDK
2. Configurar archivos de Firebase (google-services.json, GoogleService-Info.plist)
3. Implementar servicios de Firebase (auth, firestore, functions)
4. Crear AppNavigator básico
5. Crear LoginScreen y HomeScreen básicas

### Esta semana:
1. Completar todas las pantallas
2. Implementar hooks personalizados (useInventory, useRecipes, etc.)
3. Crear componentes UI reutilizables
4. Testing básico de flujos principales

### Próximas 2 semanas:
1. Implementar OCR completo con parsing
2. Notificaciones y background tasks
3. Carga de datos iniciales (recipes.json)
4. Testing exhaustivo
5. Primera build de desarrollo

### Mes 1:
1. Refinamiento de UI/UX
2. Testing en dispositivos reales
3. Optimización de performance
4. Builds de producción
5. Preparación para stores (App Store + Play Store)

---

## Recursos Clave

### Documentación oficial:
- [Expo Docs](https://docs.expo.dev)
- [React Navigation](https://reactnavigation.org/docs/getting-started)
- [WatermelonDB](https://watermelondb.dev/docs)
- [React Native Firebase](https://rnfirebase.io)
- [Zustand](https://github.com/pmndrs/zustand)

### Guías de migración:
- [Android to React Native](https://reactnative.dev/docs/android-native-modules)
- [Room to WatermelonDB](https://watermelondb.dev/docs/Installation)

---

## Conclusión

La fase 1 de la migración está **completada con éxito**. Se han establecido todas las fundaciones:
- ✅ Estructura del proyecto
- ✅ Base de datos reactiva
- ✅ State management
- ✅ Sistema de diseño
- ✅ Documentación completa

**Siguiente fase**: Implementar servicios de Firebase y crear las pantallas principales.

**Tiempo estimado total**: 6-8 semanas para app completamente funcional en iOS + Android.

**¿Listo para continuar?** Sigue las instrucciones en [NEXT_STEPS.md](./NEXT_STEPS.md) 🚀
