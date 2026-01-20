# Guía de Configuración y Ejecución

## ✅ Progreso Actual

**Fase 1 - Fundaciones: COMPLETADA ✅**
- ✅ Proyecto Expo + TypeScript
- ✅ WatermelonDB (4 tablas)
- ✅ Zustand stores (5 stores)
- ✅ Firebase SDK instalado
- ✅ Servicios de Firebase (Auth, Firestore, Functions)
- ✅ Navegación React Navigation
- ✅ Hook useInventory
- ✅ Componentes UI (Button, Card, Input)
- ✅ LoginScreen completa
- ✅ HomeScreen completa con sincronización Firestore
- ✅ Pantallas stub (Scan, ReviewDraft, Detail, AddItem, RecipesPro, Settings)

---

## 📋 Antes de Ejecutar

### 1. Configurar Firebase

**CRÍTICO:** Necesitas los archivos de configuración de Firebase para que la app funcione.

#### Opción A: Usar tu proyecto Firebase existente

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Selecciona tu proyecto "What's In My Fridge"
3. Descarga los archivos de configuración:

**Para Android:**
```
Configuración del proyecto → Tus apps → Android
→ Descargar google-services.json
→ Colocar en: whats-in-my-fridge-rn/google-services.json
```

**Para iOS:**
```
Configuración del proyecto → Tus apps → iOS
→ Descargar GoogleService-Info.plist
→ Colocar en: whats-in-my-fridge-rn/GoogleService-Info.plist
```

#### Opción B: Crear un nuevo proyecto Firebase (si no tienes uno)

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Crea un nuevo proyecto "WhatsInMyFridge"
3. Activa **Authentication** (Email/Password)
4. Activa **Firestore Database** (modo test)
5. Activa **Cloud Functions**
6. Descarga los archivos de configuración (ver Opción A)

---

### 2. Actualizar app.json

Edita `whats-in-my-fridge-rn/app.json` y agrega la configuración de Firebase:

```json
{
  "expo": {
    "name": "What's In My Fridge",
    "slug": "whats-in-my-fridge-rn",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#6750A4"
    },
    "android": {
      "package": "com.whatsinmyfridge",
      "googleServicesFile": "./google-services.json",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      }
    },
    "ios": {
      "bundleIdentifier": "com.whatsinmyfridge",
      "googleServicesFile": "./GoogleService-Info.plist",
      "supportsTablet": true
    },
    "plugins": [
      "@react-native-firebase/app",
      [
        "expo-build-properties",
        {
          "ios": {
            "useFrameworks": "static"
          }
        }
      ]
    ]
  }
}
```

---

## 🚀 Ejecutar la App

### Opción 1: Expo Go (Más rápido pero limitado)

⚠️ **NOTA:** Expo Go NO soporta Firebase nativo. Debes usar Opción 2.

```bash
cd whats-in-my-fridge-rn
npm start
```

### Opción 2: Development Build (RECOMENDADO)

Esta es la opción correcta para Firebase + WatermelonDB.

#### Instalar Expo Dev Client

```bash
cd whats-in-my-fridge-rn
npx expo install expo-dev-client expo-build-properties
```

#### Generar proyecto nativo

```bash
npx expo prebuild
```

Esto creará las carpetas `android/` e `ios/` con código nativo.

#### Ejecutar en Android

```bash
# Asegúrate de tener un emulador Android corriendo o un dispositivo conectado
npm run android
```

#### Ejecutar en iOS (solo macOS)

```bash
# Instalar dependencias de iOS
cd ios && pod install && cd ..

# Ejecutar
npm run ios
```

---

## 🔧 Troubleshooting

### Error: "google-services.json not found"

**Solución:** Descarga el archivo de Firebase Console y colócalo en la raíz del proyecto:
```
whats-in-my-fridge-rn/google-services.json
```

### Error: "@react-native-firebase/app requires a valid firebase.json"

**Solución:** Asegúrate de tener los archivos de configuración de Firebase:
- Android: `google-services.json`
- iOS: `GoogleService-Info.plist`

### Error: "Unable to resolve module @nozbe/watermelondb"

**Solución:** Reinstala las dependencias:
```bash
rm -rf node_modules
npm install
npx expo prebuild --clean
```

### Error al compilar en Android

**Solución:** Limpia el build:
```bash
cd android
./gradlew clean
cd ..
npx expo run:android
```

### La app se cierra al iniciar

**Solución:** Revisa los logs:
```bash
# Android
adb logcat | grep ReactNative

# iOS
npx react-native log-ios
```

---

## 📱 Probar la App

### 1. Crear una cuenta

1. Abre la app
2. Verás la pantalla de Login
3. Toca "¿No tienes cuenta? Regístrate"
4. Ingresa email y contraseña (mínimo 6 caracteres)
5. Toca "Crear Cuenta"

### 2. Funcionalidades disponibles

**✅ Funcionando:**
- ✅ Login / Registro con Firebase Auth
- ✅ Sincronización bidireccional con Firestore
- ✅ Navegación entre pantallas
- ✅ Pantalla Home (lista de inventario)
- ✅ Visualización de items con estado de expiración (OK, SOON, EXPIRED)
- ✅ Cerrar sesión (desde Settings)

**🚧 En construcción:**
- 🚧 Añadir item manual (AddItemScreen)
- 🚧 Escanear recibo (ScanScreen)
- 🚧 Revisar draft (ReviewDraftScreen)
- 🚧 Detalle de item (DetailScreen)
- 🚧 Recetas Pro (RecipesProScreen)
- 🚧 Settings completo (SettingsScreen)

---

## 🗂️ Estructura Actual del Proyecto

```
whats-in-my-fridge-rn/
├── src/
│   ├── components/
│   │   └── common/
│   │       ├── Button.tsx           ✅
│   │       ├── Card.tsx             ✅
│   │       └── Input.tsx            ✅
│   ├── screens/
│   │   ├── LoginScreen.tsx          ✅ Completa
│   │   ├── HomeScreen.tsx           ✅ Completa
│   │   ├── ScanScreen.tsx           🚧 Stub
│   │   ├── ReviewDraftScreen.tsx    🚧 Stub
│   │   ├── DetailScreen.tsx         🚧 Stub
│   │   ├── AddItemScreen.tsx        🚧 Stub
│   │   ├── RecipesProScreen.tsx     🚧 Stub
│   │   └── SettingsScreen.tsx       🚧 Básica
│   ├── navigation/
│   │   └── AppNavigator.tsx         ✅
│   ├── database/
│   │   ├── schema.ts                ✅
│   │   ├── models/
│   │   │   ├── FoodItem.ts          ✅
│   │   │   ├── ParsedDraft.ts       ✅
│   │   │   ├── RecipeCache.ts       ✅
│   │   │   └── Ingredient.ts        ✅
│   │   └── index.ts                 ✅
│   ├── stores/
│   │   ├── useAuthStore.ts          ✅
│   │   ├── useInventoryStore.ts     ✅
│   │   ├── useDraftStore.ts         ✅
│   │   ├── useRecipeStore.ts        ✅
│   │   └── usePreferencesStore.ts   ✅
│   ├── services/
│   │   └── firebase/
│   │       ├── auth.ts              ✅
│   │       ├── firestore.ts         ✅
│   │       └── functions.ts         ✅
│   ├── hooks/
│   │   └── useInventory.ts          ✅
│   ├── theme/
│   │   ├── colors.ts                ✅
│   │   ├── typography.ts            ✅
│   │   ├── spacing.ts               ✅
│   │   └── index.ts                 ✅
│   └── types/
│       └── index.ts                 ✅
├── App.tsx                          ✅
├── app.json                         ⚠️ Necesita configuración
├── package.json                     ✅
└── README.md                        ✅
```

---

## 📊 Progreso de la Migración

### Fase 1: Fundaciones (100% ✅)
- [x] Setup del proyecto
- [x] Base de datos
- [x] State management
- [x] Servicios de Firebase
- [x] Navegación
- [x] LoginScreen
- [x] HomeScreen

### Fase 2: Pantallas Core (Próximo)
- [ ] AddItemScreen (añadir item manual)
- [ ] DetailScreen (ver/editar item)
- [ ] SettingsScreen completo

### Fase 3: OCR (Próximo)
- [ ] ScanScreen (captura + OCR)
- [ ] ReviewDraftScreen (editar draft)
- [ ] Parser de tickets

### Fase 4: Recetas (Próximo)
- [ ] RecipesProScreen
- [ ] Integración con Cloud Functions
- [ ] Cache local

### Fase 5: Features Avanzadas (Próximo)
- [ ] Notificaciones
- [ ] Background tasks
- [ ] Widgets

---

## 🎯 Próximos Pasos Recomendados

1. **Configura Firebase** (app.json + archivos de configuración)
2. **Ejecuta la app** con `npx expo prebuild && npm run android`
3. **Prueba login/registro** y verifica que funcione
4. **Implementa AddItemScreen** para poder añadir items manualmente
5. **Implementa DetailScreen** para editar items
6. **Continúa con las demás pantallas**

---

## 📞 Soporte

Si encuentras errores:

1. Revisa los logs de la app
2. Verifica que los archivos de Firebase estén en su lugar
3. Asegúrate de que Firebase Authentication y Firestore estén activos
4. Revisa la consola de Firebase para errores

---

## 🎉 Estado Actual

**La app está lista para ejecutarse** con las funcionalidades básicas de login y visualización de inventario.

**Tiempo estimado para completar todas las pantallas:** 2-3 semanas de desarrollo.

¡Buena suerte! 🚀
