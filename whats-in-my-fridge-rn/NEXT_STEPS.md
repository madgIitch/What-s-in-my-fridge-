# Siguientes Pasos para Completar la Migración

## Estado Actual

✅ **Completado:**
- Proyecto Expo creado con TypeScript
- Estructura de carpetas organizada
- WatermelonDB configurado con 4 tablas (food_items, parsed_drafts, recipe_cache, ingredients)
- Modelos de base de datos creados
- Stores de Zustand implementados (auth, inventory, drafts, recipes, preferences)
- Sistema de tema Material Design 3 (colores, tipografía, spacing)
- TypeScript types definidos

---

## Paso 1: Instalar Dependencias Restantes

### Firebase React Native

```bash
cd whats-in-my-fridge-rn

# Instalar Firebase core
npm install @react-native-firebase/app

# Instalar módulos de Firebase
npm install @react-native-firebase/auth
npm install @react-native-firebase/firestore
npm install @react-native-firebase/functions
npm install @react-native-firebase/storage
```

### OCR y Image Picker

```bash
# Para OCR (ML Kit nativo)
# NOTA: react-native-text-recognition requiere configuración nativa
# Alternativa si tienes problemas: usar Cloud Vision API directamente

npm install react-native-text-recognition
npm install react-native-image-picker

# O usar la versión Expo (más sencilla):
npx expo install expo-image-picker
```

### Utilidades adicionales

```bash
npm install react-native-vector-icons
npm install crypto-js  # Para generar hashes de ingredientes
```

---

## Paso 2: Configurar Firebase

### 2.1 Descargar archivos de configuración

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Selecciona tu proyecto "What's In My Fridge"
3. Descarga los archivos:
   - **Android**: `google-services.json`
   - **iOS**: `GoogleService-Info.plist`
4. Coloca ambos archivos en la raíz del proyecto `whats-in-my-fridge-rn/`

### 2.2 Actualizar app.json

Edita `app.json` y agrega:

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
      "permissions": [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "POST_NOTIFICATIONS"
      ]
    },
    "ios": {
      "bundleIdentifier": "com.whatsinmyfridge",
      "googleServicesFile": "./GoogleService-Info.plist",
      "infoPlist": {
        "NSCameraUsageDescription": "Esta app necesita acceso a la cámara para escanear recibos",
        "NSPhotoLibraryUsageDescription": "Esta app necesita acceso a la galería para seleccionar fotos de recibos"
      }
    },
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#6750A4"
        }
      ],
      "@react-native-firebase/app"
    ]
  }
}
```

---

## Paso 3: Crear Servicios de Firebase

### 3.1 Servicio de Autenticación

Crea `src/services/firebase/auth.ts`:

```typescript
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { useAuthStore } from '../../stores/useAuthStore';

export const signIn = async (email: string, password: string) => {
  try {
    const userCredential = await auth().signInWithEmailAndPassword(email, password);
    const user = userCredential.user;

    useAuthStore.getState().setUser({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
    });

    return user;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const signUp = async (email: string, password: string) => {
  try {
    const userCredential = await auth().createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;

    useAuthStore.getState().setUser({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
    });

    return user;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const signOut = async () => {
  await auth().signOut();
  useAuthStore.getState().signOut();
};

export const onAuthStateChanged = (
  callback: (user: FirebaseAuthTypes.User | null) => void
) => {
  return auth().onAuthStateChanged(callback);
};
```

### 3.2 Servicio de Firestore (Sincronización)

Crea `src/services/firebase/firestore.ts`:

```typescript
import firestore from '@react-native-firebase/firestore';
import { database, collections } from '../../database';
import FoodItem from '../../database/models/FoodItem';
import { useAuthStore } from '../../stores/useAuthStore';

export const syncToFirestore = async (item: FoodItem) => {
  const userId = useAuthStore.getState().user?.uid;
  if (!userId) return;

  await firestore()
    .collection('users')
    .doc(userId)
    .collection('inventory')
    .doc(item.id)
    .set({
      name: item.name,
      expiryDate: item.expiryDate,
      category: item.category,
      quantity: item.quantity,
      notes: item.notes,
      unit: item.unit,
      expiryAt: item.expiryAt,
      addedAt: item.addedAt,
      source: item.source,
    });
};

export const deleteFromFirestore = async (itemId: string) => {
  const userId = useAuthStore.getState().user?.uid;
  if (!userId) return;

  await firestore()
    .collection('users')
    .doc(userId)
    .collection('inventory')
    .doc(itemId)
    .delete();
};

export const startFirestoreSync = (userId: string) => {
  const unsubscribe = firestore()
    .collection('users')
    .doc(userId)
    .collection('inventory')
    .onSnapshot(async (snapshot) => {
      await database.write(async () => {
        for (const change of snapshot.docChanges()) {
          const data = change.doc.data();
          const itemId = change.doc.id;

          if (change.type === 'added' || change.type === 'modified') {
            const existingItem = await collections.foodItems
              .find(itemId)
              .catch(() => null);

            if (existingItem) {
              await existingItem.update(() => {
                Object.assign(existingItem, data);
              });
            } else {
              await collections.foodItems.create((item) => {
                (item as any)._raw.id = itemId;
                Object.assign(item, data);
              });
            }
          }

          if (change.type === 'removed') {
            const item = await collections.foodItems
              .find(itemId)
              .catch(() => null);

            if (item) {
              await item.destroyPermanently();
            }
          }
        }
      });
    });

  return unsubscribe;
};
```

### 3.3 Servicio de Cloud Functions

Crea `src/services/firebase/functions.ts`:

```typescript
import functions from '@react-native-firebase/functions';
import { RecipeUi } from '../../database/models/RecipeCache';

export interface GetRecipeSuggestionsParams {
  ingredients: string[];
  cookingTime: number;
  availableUtensils: string[];
}

export const getRecipeSuggestions = async (
  params: GetRecipeSuggestionsParams
): Promise<RecipeUi[]> => {
  const callable = functions().httpsCallable('getRecipeSuggestions');
  const result = await callable(params);
  return result.data.recipes;
};

export const parseReceipt = async (imageUri: string): Promise<string> => {
  const callable = functions().httpsCallable('parseReceipt');
  const result = await callable({ imageUri });
  return result.data.text;
};
```

---

## Paso 4: Implementar Navegación

Crea `src/navigation/AppNavigator.tsx`:

```typescript
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { RootStackParamList } from '../types';

// Import screens (crearemos después)
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import ScanScreen from '../screens/ScanScreen';
import ReviewDraftScreen from '../screens/ReviewDraftScreen';
import DetailScreen from '../screens/DetailScreen';
import AddItemScreen from '../screens/AddItemScreen';
import RecipesProScreen from '../screens/RecipesProScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  const user = useAuthStore((state) => state.user);

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={user ? 'Home' : 'Login'}
        screenOptions={{
          headerStyle: {
            backgroundColor: '#6750A4',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Mi Inventario' }} />
        <Stack.Screen name="Scan" component={ScanScreen} options={{ title: 'Escanear Recibo' }} />
        <Stack.Screen name="ReviewDraft" component={ReviewDraftScreen} options={{ title: 'Revisar Items' }} />
        <Stack.Screen name="Detail" component={DetailScreen} options={{ title: 'Detalle' }} />
        <Stack.Screen name="AddItem" component={AddItemScreen} options={{ title: 'Añadir Item' }} />
        <Stack.Screen name="RecipesPro" component={RecipesProScreen} options={{ title: 'Recetas' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Configuración' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
```

---

## Paso 5: Actualizar App.tsx

Edita `App.tsx`:

```typescript
import React, { useEffect } from 'react';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { database } from './src/database';
import { AppNavigator } from './src/navigation/AppNavigator';
import { onAuthStateChanged } from './src/services/firebase/auth';
import { useAuthStore } from './src/stores/useAuthStore';
import { registerExpiryCheckTask } from './src/services/backgroundTasks';
import { requestNotificationPermissions } from './src/services/notifications';

export default function App() {
  useEffect(() => {
    // Listen to auth state changes
    const unsubscribe = onAuthStateChanged((user) => {
      if (user) {
        useAuthStore.getState().setUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
        });
      } else {
        useAuthStore.getState().setUser(null);
      }
    });

    // Request notification permissions
    requestNotificationPermissions().catch(console.error);

    // Register background task
    registerExpiryCheckTask().catch(console.error);

    return () => unsubscribe();
  }, []);

  return (
    <DatabaseProvider database={database}>
      <AppNavigator />
    </DatabaseProvider>
  );
}
```

---

## Paso 6: Crear Hook Personalizado para Inventario

Crea `src/hooks/useInventory.ts`:

```typescript
import { useEffect, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { collections } from '../database';
import FoodItem from '../database/models/FoodItem';
import { useInventoryStore } from '../stores/useInventoryStore';
import { syncToFirestore, deleteFromFirestore } from '../services/firebase/firestore';

export const useInventory = () => {
  const [items, setItems] = useState<FoodItem[]>([]);
  const store = useInventoryStore();

  useEffect(() => {
    const subscription = collections.foodItems
      .query()
      .observe()
      .subscribe((fetchedItems) => {
        setItems(fetchedItems);
        store.setItems(fetchedItems);
      });

    return () => subscription.unsubscribe();
  }, []);

  const addItem = async (itemData: Partial<FoodItem>) => {
    store.setLoading(true);
    try {
      await database.write(async () => {
        const newItem = await collections.foodItems.create((item) => {
          Object.assign(item, itemData);
          item.addedAt = Date.now();
        });

        await syncToFirestore(newItem);
      });
    } catch (error: any) {
      store.setError(error.message);
    } finally {
      store.setLoading(false);
    }
  };

  const deleteItem = async (itemId: string) => {
    store.setLoading(true);
    try {
      await database.write(async () => {
        const item = await collections.foodItems.find(itemId);
        await item.destroyPermanently();
        await deleteFromFirestore(itemId);
      });
    } catch (error: any) {
      store.setError(error.message);
    } finally {
      store.setLoading(false);
    }
  };

  return {
    items,
    addItem,
    deleteItem,
    loading: store.loading,
    error: store.error,
  };
};
```

---

## Paso 7: Crear Pantallas Básicas

### LoginScreen (ejemplo)

Crea `src/screens/LoginScreen.tsx`:

```typescript
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { signIn, signUp } from '../services/firebase/auth';
import { theme } from '../theme';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>What's In My Fridge</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title="Iniciar Sesión" onPress={handleSignIn} disabled={loading} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  title: {
    ...theme.typography.headlineLarge,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
});

export default LoginScreen;
```

---

## Paso 8: Ejecutar la Aplicación

```bash
# Opción 1: Expo Go (más rápido pero limitado)
npm start
# Escanea el QR con Expo Go app

# Opción 2: Development Build (recomendado para Firebase + OCR)
npx expo install expo-dev-client
npx expo prebuild
npm run android  # o npm run ios
```

---

## Resumen de Archivos Creados

✅ Base de datos:
- `src/database/schema.ts`
- `src/database/models/*.ts`
- `src/database/index.ts`

✅ Stores:
- `src/stores/useAuthStore.ts`
- `src/stores/useInventoryStore.ts`
- `src/stores/useDraftStore.ts`
- `src/stores/useRecipeStore.ts`
- `src/stores/usePreferencesStore.ts`

✅ Tema:
- `src/theme/colors.ts`
- `src/theme/typography.ts`
- `src/theme/spacing.ts`
- `src/theme/index.ts`

✅ Types:
- `src/types/index.ts`

---

## Próximos Archivos a Crear

🔜 Servicios:
- `src/services/firebase/auth.ts`
- `src/services/firebase/firestore.ts`
- `src/services/firebase/functions.ts`
- `src/services/ocr/textRecognition.ts`
- `src/services/ocr/receiptParser.ts`
- `src/services/notifications.ts`
- `src/services/backgroundTasks.ts`

🔜 Navegación:
- `src/navigation/AppNavigator.tsx`

🔜 Hooks:
- `src/hooks/useInventory.ts`
- `src/hooks/useFirestoreSync.ts`
- `src/hooks/useOCR.ts`
- `src/hooks/useRecipes.ts`

🔜 Pantallas:
- `src/screens/LoginScreen.tsx`
- `src/screens/HomeScreen.tsx`
- `src/screens/ScanScreen.tsx`
- `src/screens/ReviewDraftScreen.tsx`
- `src/screens/DetailScreen.tsx`
- `src/screens/AddItemScreen.tsx`
- `src/screens/RecipesProScreen.tsx`
- `src/screens/SettingsScreen.tsx`

🔜 Componentes:
- `src/components/common/Button.tsx`
- `src/components/common/Card.tsx`
- `src/components/common/Input.tsx`
- `src/components/inventory/FoodItemCard.tsx`
- `src/components/inventory/ExpiryBadge.tsx`
- `src/components/recipes/RecipeCard.tsx`

---

¿Listo para continuar? Sigue estos pasos en orden y tendrás tu app migrada a React Native funcionando completamente.
