# What's In My Fridge - React Native

Aplicación móvil multiplataforma (iOS + Android) para gestión de inventario de alimentos con OCR, sugerencias de recetas con IA y sincronización en la nube.

**Migrada de:** Android nativo (Kotlin + Jetpack Compose)
**Stack:** React Native + Expo

---

## Características

- **Inventario inteligente**: Gestiona alimentos con fechas de caducidad y notificaciones
- **Escaneo OCR**: Digitaliza recibos automáticamente con ML Kit
- **Recetas con IA**: Sugerencias personalizadas basadas en tu inventario (Firebase Functions)
- **Sincronización**: Datos sincronizados entre dispositivos con Firestore
- **Notificaciones**: Alertas cuando los alimentos están por expirar
- **Multiplataforma**: iOS y Android desde una sola base de código

---

## Stack Tecnológico

### Frontend
- **React Native**: Framework multiplataforma
- **Expo**: Tooling y servicios (SDK 54)
- **TypeScript**: Type safety
- **React Navigation**: Navegación entre pantallas
- **Zustand**: State management (simple y reactivo)

### Base de Datos Local
- **WatermelonDB**: SQLite reactivo y performante
  - `food_items`: Inventario principal
  - `parsed_drafts`: Borradores de OCR
  - `recipe_cache`: Caché de recetas
  - `ingredients`: Base de referencia

### Backend (Reutilizado)
- **Firebase Auth**: Autenticación de usuarios
- **Firestore**: Sincronización en tiempo real
- **Cloud Functions**: Lógica serverless (parseReceipt, getRecipeSuggestions)
- **Firebase Storage**: Almacenamiento de imágenes

### Funcionalidades
- **react-native-text-recognition**: OCR local con ML Kit
- **expo-notifications**: Notificaciones push y locales
- **expo-task-manager**: Tareas en background
- **date-fns**: Manejo de fechas

---

## Estructura del Proyecto

```
whats-in-my-fridge-rn/
├── src/
│   ├── components/          # Componentes UI reutilizables
│   │   ├── common/          # Botones, Cards, Inputs
│   │   ├── inventory/       # FoodItemCard, ExpiryBadge
│   │   └── recipes/         # RecipeCard, IngredientList
│   ├── screens/             # Pantallas principales
│   │   ├── LoginScreen.tsx
│   │   ├── HomeScreen.tsx
│   │   ├── ScanScreen.tsx
│   │   ├── ReviewDraftScreen.tsx
│   │   ├── DetailScreen.tsx
│   │   ├── AddItemScreen.tsx
│   │   ├── RecipesProScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── navigation/          # React Navigation setup
│   ├── database/            # WatermelonDB
│   │   ├── schema.ts        # Esquema de DB (4 tablas)
│   │   ├── models/          # Modelos (FoodItem, ParsedDraft, etc.)
│   │   └── index.ts         # Inicialización
│   ├── stores/              # Zustand state management
│   │   ├── useAuthStore.ts
│   │   ├── useInventoryStore.ts
│   │   ├── useDraftStore.ts
│   │   ├── useRecipeStore.ts
│   │   └── usePreferencesStore.ts
│   ├── services/            # Lógica de negocio
│   │   ├── firebase/        # Auth, Firestore, Functions
│   │   ├── ocr/             # OCR + parsing de tickets
│   │   ├── notifications.ts
│   │   └── backgroundTasks.ts
│   ├── hooks/               # Custom React hooks
│   ├── utils/               # Utilidades
│   ├── theme/               # Colores, tipografía, spacing
│   └── types/               # TypeScript types
├── assets/
│   ├── recipes.json         # Base de datos de recetas
│   └── images/
├── App.tsx                  # Entry point
├── app.json                 # Expo config
└── package.json
```

---

## Instalación y Setup

### Prerrequisitos

- Node.js 18+ y npm
- Expo CLI: `npm install -g expo-cli`
- Para iOS: macOS con Xcode (o usar Expo Go)
- Para Android: Android Studio + SDK

### 1. Instalar dependencias

```bash
cd whats-in-my-fridge-rn
npm install
```

### 2. Configurar Firebase

#### Descargar archivos de configuración:

**Android:**
1. Ir a Firebase Console
2. Descargar `google-services.json`
3. Colocar en raíz del proyecto

**iOS:**
1. Descargar `GoogleService-Info.plist`
2. Colocar en raíz del proyecto

#### Variables de entorno (recomendado)

Crea un archivo `.env` en la raíz con tus credenciales (ver `.env.example`):

```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
```

#### Actualizar `app.json`:

```json
{
  "expo": {
    "android": {
      "googleServicesFile": "./google-services.json"
    },
    "ios": {
      "googleServicesFile": "./GoogleService-Info.plist"
    }
  }
}
```

### 3. Instalar dependencias nativas (si usas bare workflow)

```bash
npx expo install expo-dev-client
npx expo prebuild
```

### 4. Ejecutar la app

**Expo Go (más rápido, limitado):**
```bash
npm start
# Escanear QR con Expo Go app
```

**Development Build (recomendado para OCR):**
```bash
# Android
npm run android

# iOS (requiere macOS)
npm run ios
```

---

## Dependencias Principales

```json
{
  "dependencies": {
    "expo": "^54.0.0",
    "react": "18.3.1",
    "react-native": "0.76.0",

    "@react-navigation/native": "^6.1.9",
    "@react-navigation/stack": "^6.3.20",

    "zustand": "^4.4.7",

    "@nozbe/watermelondb": "^0.27.1",

    "@react-native-firebase/app": "^19.0.1",
    "@react-native-firebase/auth": "^19.0.1",
    "@react-native-firebase/firestore": "^19.0.1",
    "@react-native-firebase/functions": "^19.0.1",

    "react-native-text-recognition": "^0.3.0",

    "@react-native-async-storage/async-storage": "1.21.0",
    "expo-notifications": "~0.27.6",
    "expo-task-manager": "~11.7.2",
    "expo-background-fetch": "~12.0.1",

    "date-fns": "^3.0.6"
  }
}
```

---

## Configuración de Firebase Functions

Las Cloud Functions ya están implementadas en el backend existente:

### Funciones disponibles:

1. **parseReceipt** (Vision API OCR)
   - Input: imagen de recibo
   - Output: texto extraído

2. **getRecipeSuggestions** (Recetas IA)
   - Input: lista de ingredientes, preferencias
   - Output: recetas con porcentaje de match

3. **syncInventoryToDevice** (Sync FCM)
   - Notifica a dispositivos sobre cambios en inventario

**No se requieren cambios en el backend**, solo usar el SDK de React Native Firebase.

---

## Migrando desde Android

### Equivalencias de componentes:

| Android (Kotlin) | React Native |
|-----------------|--------------|
| `@Composable` | Componente React (JSX) |
| `StateFlow` | `useState` + Zustand |
| `LazyColumn` | `FlatList` |
| `Room Database` | WatermelonDB |
| `DataStore` | AsyncStorage + Zustand persist |
| `ViewModel` | Zustand store + hooks |
| `Koin DI` | React Context/hooks (built-in) |
| `ML Kit OCR` | react-native-text-recognition |
| `WorkManager` | expo-task-manager |

### Flujos migrados:

✅ **Login con Firebase Auth**
✅ **Inventario con sincronización Firestore bidireccional**
✅ **OCR de recibos con ML Kit + parsing heurístico**
✅ **Revisión de drafts antes de confirmar**
✅ **Sugerencias de recetas con cache local**
✅ **Notificaciones de caducidad**
✅ **Background tasks cada 24h**
✅ **Preferencias de usuario persistidas**

---

## Scripts disponibles

```bash
# Desarrollo
npm start          # Iniciar Expo dev server
npm run android    # Ejecutar en Android
npm run ios        # Ejecutar en iOS

# Build (requiere EAS CLI)
npm install -g eas-cli
eas login
eas build --platform android
eas build --platform ios

# Linting
npm run lint

# Tests (próximamente)
npm test
```

---

## Estado del Proyecto

### ✅ Completado

- [x] Proyecto Expo creado con TypeScript
- [x] WatermelonDB configurado (4 tablas)
- [x] Stores de Zustand (auth, inventory, drafts, recipes, preferences)
- [x] Sistema de tema (Material Design 3)
- [x] Estructura de carpetas
- [x] Navegación con React Navigation
- [x] Servicios de Firebase (Auth, Firestore, Functions)
- [x] Pantallas principales (Login, Home, Scan, etc.)
- [x] OCR con react-native-text-recognition
- [x] Notificaciones y background tasks

### 🚧 En Progreso

- [ ] Componentes UI reutilizables

### 📋 Pendiente

- [ ] Testing (unit + integration)
- [ ] Builds de producción (EAS)
- [ ] Documentación completa
- [ ] App Store / Play Store deployment

---

## Próximos Pasos

1. **Instalar Firebase React Native:**
   ```bash
   npm install @react-native-firebase/app @react-native-firebase/auth
   npm install @react-native-firebase/firestore @react-native-firebase/functions
   ```

2. **Implementar navegación:**
   - Crear `AppNavigator.tsx` con Stack Navigator
   - Definir 8 rutas (Login, Home, Scan, etc.)

3. **Migrar pantallas:**
   - Comenzar con `LoginScreen` y `HomeScreen`
   - Implementar sincronización Firestore bidireccional
   - Añadir flujo OCR (Scan → ReviewDraft)

4. **Testing:**
   - Unit tests para stores
   - Integration tests para flujos críticos

5. **Deployment:**
   - Configurar EAS Build
   - Generar builds para iOS/Android
   - Subir a stores

---

## Recursos

- [Expo Documentation](https://docs.expo.dev)
- [React Navigation](https://reactnavigation.org)
- [WatermelonDB Docs](https://watermelondb.dev)
- [React Native Firebase](https://rnfirebase.io)
- [Zustand](https://zustand-demo.pmnd.rs)

---

## Licencia

MIT

---

## Soporte

Para issues y preguntas, contactar al equipo de desarrollo.
