# Plan de Migración: Kotlin + Jetpack Compose → React Native

## Resumen Ejecutivo

**Objetivo:** Migrar la aplicación Android "What's In My Fridge" de Kotlin/Jetpack Compose a React Native para soportar iOS y Android desde una única base de código.

**Stack Tecnológico Seleccionado:**
- **Framework:** Expo (React Native)
- **Plataformas:** iOS + Android
- **Navegación:** React Navigation v6
- **Estado Global:** Zustand
- **Base de Datos Local:** WatermelonDB (SQLite reactivo)
- **Backend:** Firebase (reutilizar infraestructura existente)
- **OCR:** react-native-text-recognition (ML Kit nativo)
- **Preferencias:** AsyncStorage (equivalente a DataStore)
- **Notificaciones:** expo-notifications
- **Background Tasks:** expo-task-manager

---

## Mapeo de Tecnologías: Kotlin → React Native

| Componente Android | Tecnología React Native | Razón |
|-------------------|------------------------|-------|
| Jetpack Compose | React Native + React | Ambos son declarativos y basados en componentes |
| Room Database | WatermelonDB | Base de datos reactiva con SQLite, similar arquitectura |
| DataStore Preferences | AsyncStorage | Persistencia simple key-value |
| Koin (DI) | Hooks + Context | DI no es tan necesario en React, hooks son suficientes |
| Firebase Auth/Firestore | @react-native-firebase | SDK oficial para React Native |
| ML Kit (OCR) | react-native-text-recognition | Wrapper de ML Kit nativo |
| WorkManager | expo-task-manager | Background tasks programadas |
| Notifications | expo-notifications | Push y local notifications |
| ViewModel + StateFlow | Zustand stores + hooks | Estado reactivo simplificado |
| Coil (imágenes) | expo-image | Carga de imágenes optimizada |
| Serialization | JSON nativo + TypeScript | JavaScript maneja JSON nativamente |

---

## Arquitectura de la Aplicación React Native

```
whats-in-my-fridge-rn/
├── app/                                # Expo Router (opcional) o src principal
├── src/
│   ├── components/                     # Componentes UI reutilizables
│   │   ├── common/                     # Botones, Cards, Inputs
│   │   ├── inventory/                  # FoodItemCard, ExpiryBadge
│   │   └── recipes/                    # RecipeCard, IngredientList
│   ├── screens/                        # Pantallas principales (8 screens)
│   │   ├── LoginScreen.tsx
│   │   ├── HomeScreen.tsx              # Inventario principal
│   │   ├── ScanScreen.tsx              # OCR de recibos
│   │   ├── ReviewDraftScreen.tsx       # Edición de draft
│   │   ├── DetailScreen.tsx            # Detalle de item
│   │   ├── AddItemScreen.tsx           # Añadir item manual
│   │   ├── RecipesProScreen.tsx        # Sugerencias IA
│   │   └── SettingsScreen.tsx          # Configuración
│   ├── navigation/
│   │   └── AppNavigator.tsx            # React Navigation setup
│   ├── database/
│   │   ├── schema.ts                   # Esquema WatermelonDB
│   │   ├── models/                     # Modelos de las 4 tablas
│   │   │   ├── FoodItem.ts
│   │   │   ├── ParsedDraft.ts
│   │   │   ├── RecipeCache.ts
│   │   │   └── Ingredient.ts
│   │   └── migrations.ts               # Migraciones de DB
│   ├── stores/                         # Zustand state management
│   │   ├── useInventoryStore.ts        # Items del inventario
│   │   ├── useDraftStore.ts            # Borradores OCR
│   │   ├── usePreferencesStore.ts      # Configuración usuario
│   │   ├── useRecipeStore.ts           # Cache de recetas
│   │   └── useAuthStore.ts             # Estado de autenticación
│   ├── services/                       # Lógica de negocio y APIs
│   │   ├── firebase/
│   │   │   ├── auth.ts                 # Firebase Auth
│   │   │   ├── firestore.ts            # Sync bidireccional
│   │   │   ├── functions.ts            # Cloud Functions
│   │   │   └── storage.ts              # Firebase Storage
│   │   ├── ocr/
│   │   │   ├── textRecognition.ts      # ML Kit wrapper
│   │   │   └── receiptParser.ts        # Lógica de parsing
│   │   ├── notifications.ts            # Expo notifications
│   │   └── backgroundTasks.ts          # Tareas programadas
│   ├── hooks/                          # Custom React hooks
│   │   ├── useInventory.ts             # Lógica de inventario
│   │   ├── useFirestoreSync.ts         # Sincronización
│   │   ├── useOCR.ts                   # OCR flow
│   │   └── useRecipes.ts               # Recetas con cache
│   ├── utils/
│   │   ├── dateUtils.ts                # Cálculo de expiración
│   │   ├── expiryState.ts              # OK, SOON, EXPIRED
│   │   └── constants.ts                # Constantes globales
│   ├── theme/
│   │   ├── colors.ts
│   │   ├── typography.ts
│   │   └── spacing.ts
│   └── types/                          # TypeScript definitions
│       ├── FoodItem.ts
│       ├── Recipe.ts
│       └── Draft.ts
├── assets/
│   ├── recipes.json                    # Base de recetas
│   ├── images/
│   └── fonts/
├── app.json                            # Expo configuration
├── package.json
├── tsconfig.json
└── eas.json                            # EAS Build config

# Backend (SIN CAMBIOS - Reutilizar)
whats-in-my-fridge-backend/
└── functions/                          # Cloud Functions existentes
    ├── src/
    │   ├── parseReceipt.ts             # Vision API OCR
    │   ├── getRecipeSuggestions.ts     # Recetas IA
    │   └── syncInventoryToDevice.ts    # FCM sync
    └── data/
        └── recipes.json
```

---

## Mapeo de Componentes: Pantalla por Pantalla

### 1. LoginScreen (LoginScreen.kt → LoginScreen.tsx)

**Kotlin (Compose):**
```kotlin
// LoginVm + Firebase.auth
val auth = Firebase.auth
auth.signInWithEmailAndPassword(email, password)
```

**React Native:**
```typescript
// useAuthStore + @react-native-firebase/auth
import auth from '@react-native-firebase/auth';

const signIn = async (email: string, password: string) => {
  const userCredential = await auth().signInWithEmailAndPassword(email, password);
  return userCredential.user;
};
```

**Componentes UI:**
- TextInput (equivalente a TextField de Compose)
- Button (equivalente a Button de Compose)
- ActivityIndicator (equivalente a CircularProgressIndicator)

---

### 2. HomeScreen (HomeScreen.kt → HomeScreen.tsx)

**Kotlin (Compose):**
```kotlin
val items by homeVm.items.collectAsState()
LazyColumn {
  items(items) { item ->
    FoodItemCard(item)
  }
}
```

**React Native:**
```typescript
import { observer } from 'mobx-react-lite'; // O React hooks
import { FlatList } from 'react-native';

const HomeScreen = observer(() => {
  const { items } = useInventoryStore();

  return (
    <FlatList
      data={items}
      renderItem={({ item }) => <FoodItemCard item={item} />}
      keyExtractor={(item) => item.id}
    />
  );
});
```

**WatermelonDB Query:**
```typescript
// Equivalente a FoodDao.getAllFlow()
const observeInventory = () => {
  return database.collections
    .get<FoodItem>('food_items')
    .query()
    .observe(); // Retorna Observable (reactive)
};
```

**Firestore Sync (Bidireccional):**
```typescript
// Equivalente a InventoryRepository.startFirestoreSync()
import firestore from '@react-native-firebase/firestore';

const startFirestoreSync = (userId: string) => {
  // Listener de cambios en Firestore
  const unsubscribe = firestore()
    .collection('users')
    .doc(userId)
    .collection('inventory')
    .onSnapshot(async (snapshot) => {
      await database.write(async () => {
        for (const change of snapshot.docChanges()) {
          if (change.type === 'added' || change.type === 'modified') {
            const data = change.doc.data();
            await syncToLocal(data); // Insertar/actualizar en WatermelonDB
          }
          if (change.type === 'removed') {
            await deleteFromLocal(change.doc.id);
          }
        }
      });
    });

  return unsubscribe;
};
```

---

### 3. ScanScreen (ScanScreen.kt → ScanScreen.tsx)

**Kotlin (Compose):**
```kotlin
// ML Kit TextRecognition
val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
recognizer.process(image)
  .addOnSuccessListener { visionText ->
    val text = visionText.text
    parseSimulatedText(text)
  }
```

**React Native:**
```typescript
import TextRecognition from 'react-native-text-recognition';
import { launchCamera } from 'react-native-image-picker';

const scanReceipt = async () => {
  // 1. Capturar imagen
  const result = await launchCamera({ mediaType: 'photo' });
  const imageUri = result.assets[0].uri;

  // 2. OCR con ML Kit
  const recognizedText = await TextRecognition.recognize(imageUri);
  const fullText = recognizedText.map(block => block.text).join('\n');

  // 3. Parsear texto (reutilizar lógica de Kotlin)
  const parsedDraft = parseReceiptText(fullText);

  // 4. Guardar en WatermelonDB
  await database.write(async () => {
    await draftsCollection.create(draft => {
      draft.rawText = fullText;
      draft.timestamp = Date.now();
      draft.linesJson = JSON.stringify(parsedDraft.items);
    });
  });
};
```

**Parsing de Tickets (Reutilizar lógica):**
```typescript
// Equivalente a ScanVm.parseSimulatedText()
const parseReceiptText = (text: string): ParsedDraft => {
  const lines = text.split('\n');
  const items: ParsedItem[] = [];
  let merchant: string | null = null;
  let total: number | null = null;

  // Detectar tienda (E-Center, Kaiserin-Augusta, etc.)
  if (text.includes('E-Center')) merchant = 'E-Center';
  if (text.includes('KAISERIN-AUGUSTA')) merchant = 'Kaiserin-Augusta';

  // Parsear items (regex patterns)
  const itemPattern = /^(.+?)\s+(\d+[,\.]\d{2})\s*€?$/;
  const datePattern = /(\d{2})[\.\/](\d{2})[\.\/](\d{2,4})/;

  for (const line of lines) {
    const itemMatch = line.match(itemPattern);
    if (itemMatch) {
      items.push({
        name: itemMatch[1].trim(),
        price: parseFloat(itemMatch[2].replace(',', '.')),
        quantity: 1
      });
    }

    // Detectar total
    if (line.includes('SUMME') || line.includes('TOTAL')) {
      const totalMatch = line.match(/(\d+[,\.]\d{2})/);
      if (totalMatch) total = parseFloat(totalMatch[1].replace(',', '.'));
    }
  }

  return { items, merchant, total, currency: 'EUR' };
};
```

---

### 4. ReviewDraftScreen (ReviewDraftScreen.kt → ReviewDraftScreen.tsx)

**Kotlin (Compose):**
```kotlin
val draft by reviewDraftVm.draft.collectAsState()
val items by reviewDraftVm.items.collectAsState()

// Editar item
reviewDraftVm.updateParsedItem(index, updatedItem)

// Confirmar draft
reviewDraftVm.confirmDraft()
```

**React Native:**
```typescript
const ReviewDraftScreen = ({ route }) => {
  const { draftId } = route.params;
  const [draft, setDraft] = useState<ParsedDraft | null>(null);
  const [items, setItems] = useState<ParsedItem[]>([]);

  useEffect(() => {
    loadDraft(draftId);
  }, [draftId]);

  const loadDraft = async (id: string) => {
    const draftRecord = await database.collections
      .get<ParsedDraft>('parsed_drafts')
      .find(id);

    setDraft(draftRecord);
    setItems(JSON.parse(draftRecord.linesJson));
  };

  const updateItem = (index: number, updatedItem: ParsedItem) => {
    const newItems = [...items];
    newItems[index] = updatedItem;
    setItems(newItems);
  };

  const confirmDraft = async () => {
    await database.write(async () => {
      // Crear FoodItems desde ParsedItems
      for (const item of items) {
        await foodItemsCollection.create(foodItem => {
          foodItem.name = item.name;
          foodItem.quantity = item.quantity;
          foodItem.expiryDate = item.expiryDate || calculateDefaultExpiry();
          foodItem.category = item.category;
          foodItem.source = 'ocr';
          foodItem.addedAt = Date.now();
        });
      }

      // Eliminar draft
      await draft.destroyPermanently();
    });

    // Sincronizar con Firestore
    await syncInventoryToFirestore();

    navigation.navigate('Home');
  };

  return (
    <FlatList
      data={items}
      renderItem={({ item, index }) => (
        <EditableItemCard
          item={item}
          onUpdate={(updated) => updateItem(index, updated)}
        />
      )}
    />
  );
};
```

---

### 5. RecipesProScreen (RecipesProScreen.kt → RecipesProScreen.tsx)

**Kotlin (Compose):**
```kotlin
val recipes by recipesProVm.recipes.collectAsState()

// Llamar Cloud Function
recipesProVm.getRecipeSuggestions()
```

**React Native:**
```typescript
import functions from '@react-native-firebase/functions';

const RecipesProScreen = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const { isPro, monthlyCallsUsed } = usePreferencesStore();

  const getRecipeSuggestions = async () => {
    setLoading(true);

    try {
      // 1. Verificar límites (Free: 10, Pro: 100)
      const limit = isPro ? 100 : 10;
      if (monthlyCallsUsed >= limit) {
        throw new Error('Límite mensual alcanzado');
      }

      // 2. Obtener inventario actual
      const inventory = await database.collections
        .get<FoodItem>('food_items')
        .query()
        .fetch();

      const ingredients = inventory.map(item => item.name);
      const hash = generateHash(ingredients.sort().join(','));

      // 3. Buscar en caché
      const cached = await database.collections
        .get<RecipeCache>('recipe_cache')
        .find(hash)
        .catch(() => null);

      if (cached && Date.now() - cached.timestamp < cached.ttlMinutes * 60 * 1000) {
        setRecipes(JSON.parse(cached.recipesJson));
        return;
      }

      // 4. Llamar Cloud Function
      const getRecipes = functions().httpsCallable('getRecipeSuggestions');
      const result = await getRecipes({
        ingredients,
        cookingTime: 30,
        availableUtensils: ['oven', 'stove']
      });

      const recipesData = result.data.recipes;

      // 5. Guardar en caché
      await database.write(async () => {
        await recipeCacheCollection.create(cache => {
          cache._raw.id = hash;
          cache.recipesJson = JSON.stringify(recipesData);
          cache.timestamp = Date.now();
          cache.ttlMinutes = 60;
        });
      });

      // 6. Incrementar contador
      usePreferencesStore.getState().incrementRecipeCalls();

      setRecipes(recipesData);
    } catch (error) {
      console.error('Error getting recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <Button title="Obtener Recetas" onPress={getRecipeSuggestions} />
      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={recipes}
          renderItem={({ item }) => <RecipeCard recipe={item} />}
        />
      )}
    </View>
  );
};
```

---

### 6. SettingsScreen (SettingsScreen.kt → SettingsScreen.tsx)

**Kotlin (DataStore):**
```kotlin
val reminderDays by settingsVm.reminderDays.collectAsState(initial = 3)
settingsVm.setReminderDays(5)
```

**React Native (AsyncStorage + Zustand):**
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Store de preferencias con persistencia
const usePreferencesStore = create(
  persist(
    (set) => ({
      reminderDays: 3,
      isPro: false,
      cloudConsent: false,
      notificationsEnabled: true,
      cookingTime: 30,
      availableUtensils: ['oven', 'stove'],
      monthlyRecipeCallsUsed: 0,

      setReminderDays: (days: number) => set({ reminderDays: days }),
      setProStatus: (isPro: boolean) => set({ isPro }),
      setCloudConsent: (consent: boolean) => set({ cloudConsent: consent }),
      setNotificationsEnabled: (enabled: boolean) => set({ notificationsEnabled: enabled }),
      setCookingTime: (time: number) => set({ cookingTime: time }),
      setAvailableUtensils: (utensils: string[]) => set({ availableUtensils: utensils }),
      incrementRecipeCalls: () => set((state) => ({
        monthlyRecipeCallsUsed: state.monthlyRecipeCallsUsed + 1
      })),
      resetMonthlyRecipeCalls: () => set({ monthlyRecipeCallsUsed: 0 })
    }),
    {
      name: 'preferences-storage',
      storage: createJSONStorage(() => AsyncStorage)
    }
  )
);

// Uso en SettingsScreen
const SettingsScreen = () => {
  const {
    reminderDays,
    notificationsEnabled,
    cloudConsent,
    setReminderDays,
    setNotificationsEnabled,
    setCloudConsent
  } = usePreferencesStore();

  return (
    <ScrollView>
      <Text>Días de recordatorio: {reminderDays}</Text>
      <Slider
        value={reminderDays}
        onValueChange={setReminderDays}
        minimumValue={1}
        maximumValue={7}
        step={1}
      />

      <Switch
        value={notificationsEnabled}
        onValueChange={setNotificationsEnabled}
      />

      <Switch
        value={cloudConsent}
        onValueChange={setCloudConsent}
      />
    </ScrollView>
  );
};
```

---

## WatermelonDB: Esquema Completo

**Equivalente a Room Database (AppDb.kt):**

```typescript
// src/database/schema.ts
import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 5,
  tables: [
    // FoodItemEntity
    tableSchema({
      name: 'food_items',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'expiry_date', type: 'number' }, // timestamp
        { name: 'category', type: 'string', isOptional: true },
        { name: 'quantity', type: 'number' },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'unit', type: 'string' },
        { name: 'expiry_at', type: 'number' },
        { name: 'added_at', type: 'number' },
        { name: 'source', type: 'string' }, // 'manual' | 'ocr'
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' }
      ]
    }),

    // ParsedDraftEntity
    tableSchema({
      name: 'parsed_drafts',
      columns: [
        { name: 'raw_text', type: 'string' },
        { name: 'timestamp', type: 'number' },
        { name: 'merchant', type: 'string', isOptional: true },
        { name: 'purchase_date', type: 'string', isOptional: true },
        { name: 'currency', type: 'string' },
        { name: 'total', type: 'number', isOptional: true },
        { name: 'lines_json', type: 'string' }, // JSON array
        { name: 'unrecognized_lines', type: 'string' }, // JSON array
        { name: 'confirmed', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' }
      ]
    }),

    // RecipeCacheEntity
    tableSchema({
      name: 'recipe_cache',
      columns: [
        { name: 'ingredients_hash', type: 'string', isIndexed: true },
        { name: 'recipes_json', type: 'string' },
        { name: 'timestamp', type: 'number' },
        { name: 'ttl_minutes', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' }
      ]
    }),

    // IngredientEntity
    tableSchema({
      name: 'ingredients',
      columns: [
        { name: 'name', type: 'string', isIndexed: true },
        { name: 'category', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' }
      ]
    })
  ]
});
```

**Modelos WatermelonDB:**

```typescript
// src/database/models/FoodItem.ts
import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export class FoodItem extends Model {
  static table = 'food_items';

  @field('name') name!: string;
  @field('expiry_date') expiryDate!: number;
  @field('category') category?: string;
  @field('quantity') quantity!: number;
  @field('notes') notes?: string;
  @field('unit') unit!: string;
  @field('expiry_at') expiryAt!: number;
  @field('added_at') addedAt!: number;
  @field('source') source!: 'manual' | 'ocr';

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  // Computed property (equivalente a FoodItemUi)
  get expiryState(): 'OK' | 'SOON' | 'EXPIRED' {
    const now = Date.now();
    const daysLeft = Math.floor((this.expiryDate - now) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) return 'EXPIRED';
    if (daysLeft <= 3) return 'SOON';
    return 'OK';
  }

  get daysLeft(): number {
    const now = Date.now();
    return Math.floor((this.expiryDate - now) / (1000 * 60 * 60 * 24));
  }
}
```

---

## Zustand State Management

**Equivalente a ViewModels de Kotlin:**

```typescript
// src/stores/useInventoryStore.ts
import { create } from 'zustand';
import { database } from '../database';
import { FoodItem } from '../database/models/FoodItem';
import { syncToFirestore, deleteFromFirestore } from '../services/firebase/firestore';

interface InventoryStore {
  items: FoodItem[];
  loading: boolean;
  error: string | null;

  // Actions
  loadItems: () => Promise<void>;
  addItem: (item: Partial<FoodItem>) => Promise<void>;
  updateItem: (id: string, updates: Partial<FoodItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  deleteAllItems: () => Promise<void>;
}

export const useInventoryStore = create<InventoryStore>((set, get) => ({
  items: [],
  loading: false,
  error: null,

  loadItems: async () => {
    set({ loading: true });
    try {
      const itemsCollection = database.collections.get<FoodItem>('food_items');

      // Observar cambios (equivalente a Flow)
      itemsCollection.query().observe().subscribe(items => {
        set({ items, loading: false });
      });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  addItem: async (itemData) => {
    await database.write(async () => {
      const newItem = await database.collections
        .get<FoodItem>('food_items')
        .create(item => {
          Object.assign(item, itemData);
          item.addedAt = Date.now();
        });

      // Sincronizar con Firestore
      await syncToFirestore(newItem);
    });
  },

  updateItem: async (id, updates) => {
    await database.write(async () => {
      const item = await database.collections
        .get<FoodItem>('food_items')
        .find(id);

      await item.update(() => {
        Object.assign(item, updates);
      });

      await syncToFirestore(item);
    });
  },

  deleteItem: async (id) => {
    await database.write(async () => {
      const item = await database.collections
        .get<FoodItem>('food_items')
        .find(id);

      await item.destroyPermanently();
      await deleteFromFirestore(id);
    });
  },

  deleteAllItems: async () => {
    await database.write(async () => {
      const items = await database.collections
        .get<FoodItem>('food_items')
        .query()
        .fetch();

      for (const item of items) {
        await item.destroyPermanently();
        await deleteFromFirestore(item.id);
      }
    });
  }
}));
```

---

## Background Tasks y Notificaciones

**Equivalente a ExpiryWorker.kt:**

```typescript
// src/services/backgroundTasks.ts
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import { database } from '../database';
import { FoodItem } from '../database/models/FoodItem';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EXPIRY_CHECK_TASK = 'EXPIRY_CHECK_TASK';

// Definir tarea de background
TaskManager.defineTask(EXPIRY_CHECK_TASK, async () => {
  try {
    // Verificar si notificaciones están habilitadas
    const prefsJson = await AsyncStorage.getItem('preferences-storage');
    const prefs = JSON.parse(prefsJson || '{}');

    if (!prefs.state?.notificationsEnabled) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const reminderDays = prefs.state?.reminderDays || 3;

    // Obtener items del inventario
    const items = await database.collections
      .get<FoodItem>('food_items')
      .query()
      .fetch();

    // Filtrar items por expirar
    const expiringItems = items.filter(item => {
      const daysLeft = item.daysLeft;
      return daysLeft >= 0 && daysLeft <= reminderDays;
    });

    // Enviar notificación
    if (expiringItems.length > 0) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ Items por expirar',
          body: `Tienes ${expiringItems.length} items que expiran en ${reminderDays} días`,
          data: { items: expiringItems.map(i => ({ id: i.id, name: i.name })) }
        },
        trigger: null // Inmediato
      });
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Error in expiry check task:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Registrar tarea (llamar en App.tsx al iniciar)
export const registerExpiryCheckTask = async () => {
  await BackgroundFetch.registerTaskAsync(EXPIRY_CHECK_TASK, {
    minimumInterval: 60 * 60 * 24, // 24 horas
    stopOnTerminate: false,
    startOnBoot: true
  });
};
```

**Configuración de notificaciones:**

```typescript
// src/services/notifications.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configurar handler de notificaciones
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true
  })
});

export const requestNotificationPermissions = async () => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    throw new Error('Permission not granted for notifications');
  }

  // Configurar canal en Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('expiry-alerts', {
      name: 'Expiry Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C'
    });
  }
};
```

---

## Firebase Integration (Reutilizar Backend)

**No hay cambios en Cloud Functions. Solo adaptar el SDK del cliente:**

```typescript
// src/services/firebase/firestore.ts
import firestore from '@react-native-firebase/firestore';
import { database } from '../../database';
import { FoodItem } from '../../database/models/FoodItem';
import { useAuthStore } from '../../stores/useAuthStore';

// Sincronizar item a Firestore
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
      source: item.source
    });
};

// Eliminar de Firestore
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

// Listener bidireccional (equivalente a startFirestoreSync)
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
            // Buscar si ya existe localmente
            const existingItem = await database.collections
              .get<FoodItem>('food_items')
              .find(itemId)
              .catch(() => null);

            if (existingItem) {
              // Actualizar
              await existingItem.update(() => {
                Object.assign(existingItem, data);
              });
            } else {
              // Crear nuevo
              await database.collections
                .get<FoodItem>('food_items')
                .create(item => {
                  item._raw.id = itemId;
                  Object.assign(item, data);
                });
            }
          }

          if (change.type === 'removed') {
            const item = await database.collections
              .get<FoodItem>('food_items')
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

---

## Dependencias Principales (package.json)

```json
{
  "name": "whats-in-my-fridge-rn",
  "version": "1.0.0",
  "main": "expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web"
  },
  "dependencies": {
    // Core
    "expo": "^50.0.0",
    "react": "18.2.0",
    "react-native": "0.73.0",

    // Navegación
    "@react-navigation/native": "^6.1.9",
    "@react-navigation/stack": "^6.3.20",
    "react-native-screens": "~3.29.0",
    "react-native-safe-area-context": "4.8.2",

    // State Management
    "zustand": "^4.4.7",

    // Database
    "@nozbe/watermelondb": "^0.27.1",
    "@nozbe/with-observables": "^1.6.0",

    // Firebase
    "@react-native-firebase/app": "^19.0.1",
    "@react-native-firebase/auth": "^19.0.1",
    "@react-native-firebase/firestore": "^19.0.1",
    "@react-native-firebase/functions": "^19.0.1",
    "@react-native-firebase/storage": "^19.0.1",

    // OCR
    "react-native-text-recognition": "^0.3.0",
    "react-native-image-picker": "^7.1.0",

    // UI
    "react-native-elements": "^3.4.3",
    "react-native-vector-icons": "^10.0.3",
    "expo-linear-gradient": "~13.0.2",

    // Utilities
    "@react-native-async-storage/async-storage": "1.21.0",
    "expo-notifications": "~0.27.6",
    "expo-task-manager": "~11.7.2",
    "expo-background-fetch": "~12.0.1",
    "expo-image": "~1.10.1",
    "date-fns": "^3.0.6",

    // TypeScript
    "typescript": "^5.3.3"
  },
  "devDependencies": {
    "@babel/core": "^7.23.7",
    "@types/react": "~18.2.45",
    "@types/react-native": "~0.73.0",
    "babel-plugin-module-resolver": "^5.0.0"
  }
}
```

---

## Pasos de Migración Detallados

### Fase 1: Setup del Proyecto (Sprint 1)

1. **Crear proyecto Expo:**
   ```bash
   npx create-expo-app whats-in-my-fridge-rn --template expo-template-blank-typescript
   cd whats-in-my-fridge-rn
   ```

2. **Instalar dependencias core:**
   ```bash
   npx expo install expo-dev-client
   npm install @react-navigation/native @react-navigation/stack
   npx expo install react-native-screens react-native-safe-area-context
   npm install zustand @nozbe/watermelondb
   ```

3. **Configurar WatermelonDB:**
   - Crear esquema (4 tablas)
   - Crear modelos
   - Configurar database instance

4. **Setup Firebase:**
   ```bash
   npm install @react-native-firebase/app @react-native-firebase/auth
   npm install @react-native-firebase/firestore @react-native-firebase/functions
   ```
   - Descargar `google-services.json` (Android)
   - Descargar `GoogleService-Info.plist` (iOS)
   - Configurar en `app.json`

5. **Configurar navegación base:**
   - Crear `AppNavigator.tsx`
   - Definir 8 rutas principales
   - Setup de auth flow

---

### Fase 2: Pantallas Core (Sprint 2)

6. **Migrar LoginScreen:**
   - UI con email/password inputs
   - Integración Firebase Auth
   - Store de autenticación (Zustand)

7. **Migrar HomeScreen:**
   - FlatList con items del inventario
   - WatermelonDB query con observe()
   - Firestore sync bidireccional
   - Pull-to-refresh

8. **Migrar DetailScreen y AddItemScreen:**
   - Formularios de edición
   - CRUD operations con WatermelonDB
   - Sincronización automática

---

### Fase 3: OCR y Drafts (Sprint 3)

9. **Implementar OCR:**
   ```bash
   npm install react-native-text-recognition react-native-image-picker
   ```
   - Cámara/galería con `react-native-image-picker`
   - OCR con `react-native-text-recognition`
   - Parsear texto (reutilizar lógica Kotlin)

10. **Migrar ReviewDraftScreen:**
    - Cargar draft desde WatermelonDB
    - Editar items parseados
    - Confirmar draft → crear FoodItems

---

### Fase 4: Recetas IA (Sprint 4)

11. **Migrar RecipesProScreen:**
    - UI de preferencias de cocina
    - Llamar Cloud Function `getRecipeSuggestions`
    - Caché local con WatermelonDB
    - Verificar límites mensuales (Free/Pro)

12. **Implementar cache de recetas:**
    - Generar hash de ingredientes
    - Guardar/recuperar de `recipe_cache` table
    - TTL de 60 minutos

---

### Fase 5: Settings y Preferencias (Sprint 5)

13. **Migrar SettingsScreen:**
    - AsyncStorage + Zustand persist
    - Sliders, switches, pickers
    - Sincronizar preferencias entre sesiones

14. **Cargar ingredientes desde assets:**
    ```typescript
    const loadIngredients = async () => {
      const recipesJson = require('../assets/recipes.json');
      await database.write(async () => {
        for (const recipe of recipesJson) {
          for (const ingredient of recipe.ingredients) {
            await ingredientsCollection.create(ing => {
              ing.name = ingredient.name;
              ing.category = ingredient.category;
            });
          }
        }
      });
    };
    ```

---

### Fase 6: Background Tasks y Notificaciones (Sprint 6)

15. **Configurar notificaciones:**
    ```bash
    npx expo install expo-notifications
    ```
    - Request permissions
    - Setup notification handler
    - Crear canal de Android

16. **Implementar background task:**
    ```bash
    npx expo install expo-task-manager expo-background-fetch
    ```
    - Tarea de verificación de expiración cada 24h
    - Enviar notificación si hay items por expirar

---

### Fase 7: UI y Theming (Sprint 7)

17. **Crear sistema de diseño:**
    - Definir colores, tipografía, espaciado
    - Componentes reutilizables (Card, Button, Input)
    - Equivalente a Material3 de Compose

18. **Implementar componentes específicos:**
    - `FoodItemCard` con badge de expiración
    - `ExpiryBadge` (OK, SOON, EXPIRED)
    - `RecipeCard` con porcentaje de match
    - `EditableItemCard` para review draft

---

### Fase 8: Testing y Build (Sprint 8)

19. **Testing:**
    - Unit tests para stores (Zustand)
    - Integration tests para flujos críticos
    - E2E con Detox (opcional)

20. **Configurar builds:**
    ```bash
    npm install -g eas-cli
    eas login
    eas build:configure
    ```
    - Crear `eas.json`
    - Build profiles (development, preview, production)
    - Submit a stores

---

## Diferencias Clave: Kotlin vs React Native

| Aspecto | Kotlin + Compose | React Native |
|---------|-----------------|--------------|
| **UI** | Declarativo (@Composable) | Declarativo (JSX) |
| **Estado** | StateFlow + collectAsState() | useState + useEffect |
| **Navegación** | NavHost + NavController | NavigationContainer + Stack |
| **DI** | Koin (manual) | Hooks + Context (built-in) |
| **Database** | Room (SQL annotations) | WatermelonDB (decorators) |
| **Async** | Coroutines + Flow | Promises + async/await |
| **Observables** | Flow.collectAsState() | Observable.subscribe() |
| **Preferencias** | DataStore (Proto) | AsyncStorage (JSON) |
| **TypeSystem** | Kotlin (null-safety) | TypeScript (structural typing) |

---

## Ventajas de React Native

1. **Cross-platform:** iOS + Android con una sola base de código
2. **Hot Reload:** Cambios instantáneos sin recompilar
3. **Ecosistema JavaScript:** NPM con millones de paquetes
4. **Desarrollo más rápido:** Menos boilerplate que Kotlin
5. **Flexibilidad:** Más fácil integrar librerías web
6. **Comunidad:** Mayor comunidad y recursos

---

## Desafíos a Considerar

1. **ML Kit nativo:** `react-native-text-recognition` puede tener limitaciones vs ML Kit directo
2. **Performance:** OCR intensivo puede ser más lento que nativo
3. **Configuración nativa:** Requiere tocar código iOS/Android para algunas features
4. **Debuggin:** Menos integrado que Android Studio para desarrollo nativo
5. **Background tasks:** Limitaciones en iOS para tareas en background

---

## Cronograma Estimado

| Sprint | Duración | Entregables |
|--------|----------|-------------|
| Sprint 1 | 1 semana | Setup proyecto, database, Firebase, navegación |
| Sprint 2 | 1 semana | Login, Home, Detail, AddItem |
| Sprint 3 | 1.5 semanas | OCR, Scan, ReviewDraft |
| Sprint 4 | 1 semana | RecipesPro, cache |
| Sprint 5 | 3 días | Settings, preferencias |
| Sprint 6 | 1 semana | Notificaciones, background tasks |
| Sprint 7 | 1 semana | UI polish, componentes |
| Sprint 8 | 1 semana | Testing, builds, deployment |
| **TOTAL** | **7-8 semanas** | App completa para iOS + Android |

---

## Próximos Pasos

1. Crear proyecto Expo
2. Configurar WatermelonDB con esquema
3. Setup Firebase y navegación
4. Comenzar con LoginScreen y HomeScreen
5. Implementar sincronización Firestore
6. Migrar flujo de OCR
7. Completar todas las pantallas
8. Testing y deployment

---

## Recursos Útiles

- [Expo Docs](https://docs.expo.dev)
- [React Navigation](https://reactnavigation.org)
- [WatermelonDB](https://watermelondb.dev)
- [React Native Firebase](https://rnfirebase.io)
- [Zustand](https://zustand-demo.pmnd.rs)

---

**¿Listo para comenzar la migración?** 🚀
