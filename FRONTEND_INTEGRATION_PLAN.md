# Plan de Integración Frontend - Add Recipe from URL
## Análisis de Estructura Actual + Roadmap de Implementación

**Fecha:** 12 Febrero 2026
**Objetivo:** Integrar funcionalidad "Add Recipe from URL" en app existente

---

## 📁 Estructura Actual de la App

### **Arquitectura**
```
What-s-in-my-fridge-/
├── App.tsx                          # Entry point
├── src/
│   ├── screens/                     # Pantallas de la app
│   │   ├── HomeScreen.tsx
│   │   ├── RecipesProScreen.tsx    # 🎯 Pantalla de recetas (punto de partida)
│   │   ├── ScanScreen.tsx
│   │   ├── RecipeStepsScreen.tsx
│   │   └── ...
│   ├── navigation/
│   │   └── AppNavigator.tsx        # Stack Navigator principal
│   ├── components/
│   │   ├── common/                 # Componentes reutilizables
│   │   └── ...
│   ├── services/
│   │   └── firebase/
│   │       └── functions.ts        # 🎯 Wrapper de Firebase Functions
│   ├── hooks/
│   │   ├── useRecipes.ts           # Hook para recetas
│   │   └── ...
│   ├── stores/                     # Zustand stores
│   ├── database/                   # WatermelonDB models
│   └── types/
│       └── index.ts                # 🎯 Tipos TypeScript globales
└── whats-in-my-fridge-backend/     # Backend (Firebase Functions)
```

---

## 🔍 Análisis de Componentes Clave

### **1. AppNavigator.tsx (Navegación)**

**Ubicación:** `src/navigation/AppNavigator.tsx`

**Estructura actual:**
- Stack Navigator con autenticación
- Screens principales: Home, Scan, Recipes, Calendar, Settings
- Modales: ReviewDraft, AddItem, AddMeal, Crop

**Pantallas relevantes:**
- `RecipesTab` → `RecipesProScreen`
- `RecipeSteps` → `RecipeStepsScreen`

**Dónde agregar la nueva pantalla:**
Después de línea 156 (antes del cierre del stack autenticado):

```typescript
<Stack.Screen
  name="AddRecipeFromUrl"
  component={AddRecipeFromUrlScreen}
  options={{
    headerShown: false,
    presentation: 'modal'
  }}
/>
```

---

### **2. RecipesProScreen.tsx (Pantalla de Recetas)**

**Ubicación:** `src/screens/RecipesProScreen.tsx`

**Funcionalidad actual:**
- Obtiene recetas basadas en inventario del usuario
- Llama a Cloud Function `getRecipeSuggestions`
- Muestra recetas con match percentage
- Permite guardar favoritos
- Navega a `RecipeSteps` para cocinar

**Punto de integración:**
- Agregar botón "Add from URL" en el header o como FAB
- Navegar a la nueva pantalla `AddRecipeFromUrl`

**Código sugerido (línea 360, después del botón de favoritos):**

```typescript
<TouchableOpacity
  onPress={() => navigation.navigate('AddRecipeFromUrl')}
  style={styles.addFromUrlButton}
  activeOpacity={0.7}
>
  <LinkIcon size={24} color={colors.primary} />
</TouchableOpacity>
```

---

### **3. functions.ts (Firebase Functions Wrapper)**

**Ubicación:** `src/services/firebase/functions.ts`

**Estructura actual:**
- Usa `@react-native-firebase/functions`
- Maneja autenticación con tokens
- Functions existentes:
  - `getRecipeSuggestions`
  - `parseReceipt`
  - `normalizeScannedIngredient`
  - `migrateInventoryNormalization`

**Dónde agregar parseRecipeFromUrl:**
Después de línea 283 (al final del archivo):

```typescript
/**
 * Parse recipe from URL (YouTube, Instagram, TikTok, Blog)
 */
export interface ParseRecipeFromUrlParams {
  url: string;
  manualText?: string;
}

export interface ParseRecipeFromUrlResult {
  ingredients: string[];
  steps: string[];
  sourceType: "youtube" | "instagram" | "tiktok" | "blog" | "manual";
  rawText: string;
  recipeTitle?: string;
}

export const parseRecipeFromUrl = async (
  params: ParseRecipeFromUrlParams
): Promise<ParseRecipeFromUrlResult> => {
  try {
    const callable = functions().httpsCallableFromUrl(
      getCallableUrl('europe-west1', 'parseRecipeFromUrl'),
      {
        timeout: 540000, // 9 minutes (transcripción puede tardar)
      }
    );
    const result = await callable(params);

    if (!result.data) {
      throw new Error('Invalid response from Cloud Function');
    }

    return result.data;
  } catch (error: any) {
    console.error('Error calling parseRecipeFromUrl:', error);

    if (error.code === 'functions/unauthenticated') {
      throw new Error('Debes iniciar sesión para parsear recetas');
    } else if (error.code === 'functions/invalid-argument') {
      throw new Error('URL inválida');
    } else if (error.code === 'functions/failed-precondition') {
      throw new Error('No se pudo extraer información de esta URL. Prueba con otra o usa entrada manual.');
    }

    throw new Error(error.message || 'Error al procesar la receta');
  }
};
```

---

### **4. types/index.ts (Tipos de Navegación)**

**Ubicación:** `src/types/index.ts`

**Dónde agregar el tipo de ruta:**
Línea 41, agregar dentro de `RootStackParamList`:

```typescript
export type RootStackParamList = {
  Login: undefined;
  HomeTab: undefined;
  ScanTab: undefined;
  RecipesTab: undefined;
  FavoritesTab: undefined;
  SettingsTab: undefined;
  CalendarTab: undefined;
  ReviewDraft: { draftId: string };
  Detail: { itemId: string };
  AddItem: undefined;
  Crop: { imageUri: string; onCropComplete: (uri: string) => void };
  AddMeal: { /* ... */ };
  MealDetail: { mealId: string };
  RecipeSteps: { recipe: RecipeUi };
  ConsumeIngredients: undefined;
  ConsumeRecipeIngredients: { /* ... */ };
  AddRecipeFromUrl: undefined; // ✅ NUEVO
};
```

---

## 🚀 Plan de Implementación (Paso a Paso)

### **Paso 1: Agregar tipos y función de Firebase (15 min)**

#### 1.1. Actualizar types/index.ts
```bash
# Agregar tipo de navegación para AddRecipeFromUrl
```

```typescript
// En src/types/index.ts, línea 41
AddRecipeFromUrl: undefined;
```

#### 1.2. Actualizar services/firebase/functions.ts
```typescript
// Agregar al final del archivo
export const parseRecipeFromUrl = async (
  params: ParseRecipeFromUrlParams
): Promise<ParseRecipeFromUrlResult> => {
  // ... código completo arriba
};
```

---

### **Paso 2: Crear pantalla AddRecipeFromUrlScreen (1.5 horas)**

#### 2.1. Crear archivo
```bash
# Ubicación: src/screens/AddRecipeFromUrlScreen.tsx
```

#### 2.2. Estructura básica

```typescript
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { ArrowLeft, Link as LinkIcon, CheckCircle } from 'lucide-react-native';
import { colors, typography, spacing } from '../theme';
import { borderRadius } from '../theme/spacing';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { parseRecipeFromUrl, ParseRecipeFromUrlResult } from '../services/firebase/functions';
import { useInventoryStore } from '../stores/useInventoryStore';
import { RootStackParamList } from '../types';

type AddRecipeFromUrlNavigationProp = StackNavigationProp<RootStackParamList, 'AddRecipeFromUrl'>;

const AddRecipeFromUrlScreen = () => {
  const navigation = useNavigation<AddRecipeFromUrlNavigationProp>();
  const { items } = useInventoryStore();

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ParseRecipeFromUrlResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get user inventory for matching
  const inventoryNames = items
    .map((item) => item.normalizedName || item.name)
    .filter((name) => name && name.trim() !== '');

  const handleParseUrl = async () => {
    if (!url.trim()) {
      setError('Por favor ingresa una URL válida');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await parseRecipeFromUrl({ url: url.trim() });
      setResult(data);
    } catch (err: any) {
      console.error('Error parsing recipe:', err);
      setError(err.message || 'Error al procesar la receta. Intenta con otra URL.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRecipe = () => {
    if (!result) return;

    // TODO: Guardar receta en Firestore o WatermelonDB
    Alert.alert(
      'Receta guardada',
      `${result.recipeTitle || 'Receta'} guardada exitosamente`,
      [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  // Calculate match with inventory
  const matchedIngredients = result?.ingredients.filter((ing) =>
    inventoryNames.some((inv) =>
      inv.toLowerCase().includes(ing.toLowerCase()) ||
      ing.toLowerCase().includes(inv.toLowerCase())
    )
  ) || [];

  const missingIngredients = result?.ingredients.filter(
    (ing) => !matchedIngredients.includes(ing)
  ) || [];

  const matchPercentage = result
    ? Math.round((matchedIngredients.length / result.ingredients.length) * 100)
    : 0;

  const getSourceIcon = (sourceType?: string) => {
    switch (sourceType) {
      case 'youtube':
        return '📺';
      case 'instagram':
        return '📸';
      case 'tiktok':
        return '🎵';
      case 'blog':
        return '📰';
      default:
        return '🍽️';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <ArrowLeft size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Agregar desde URL</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        {/* URL Input Card */}
        <Card style={styles.inputCard}>
          <Text style={styles.sectionTitle}>🔗 Pega la URL</Text>
          <Text style={styles.sectionSubtitle}>
            YouTube, Instagram Reels, TikTok o blog de recetas
          </Text>

          <View style={styles.inputContainer}>
            <LinkIcon size={20} color={colors.primary} />
            <TextInput
              style={styles.input}
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              editable={!loading}
            />
          </View>

          <Button
            title={loading ? 'Analizando... (20-30 seg)' : '✨ Analizar Receta'}
            onPress={handleParseUrl}
            disabled={loading || !url.trim()}
            style={styles.analyzeButton}
          />
        </Card>

        {/* Error Message */}
        {error && (
          <Card style={styles.errorCard}>
            <Text style={styles.errorEmoji}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        )}

        {/* Loading State */}
        {loading && (
          <Card style={styles.loadingCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Analizando video...</Text>
            <Text style={styles.loadingSubtext}>
              Esto puede tomar 20-30 segundos
            </Text>
          </Card>
        )}

        {/* Result */}
        {result && !loading && (
          <>
            {/* Recipe Header */}
            <Card style={styles.resultCard}>
              <View style={styles.recipeHeader}>
                <Text style={styles.recipeEmoji}>
                  {getSourceIcon(result.sourceType)}
                </Text>
                <View style={styles.recipeInfo}>
                  <Text style={styles.recipeTitle}>
                    {result.recipeTitle || 'Receta'}
                  </Text>
                  <Text style={styles.recipeSource}>
                    Fuente: {result.sourceType}
                  </Text>
                </View>
              </View>

              {/* Match Badge */}
              <View style={styles.matchBadge}>
                <Text style={styles.matchEmoji}>❤️</Text>
                <Text style={styles.matchText}>
                  {matchPercentage}% de compatibilidad
                </Text>
              </View>
            </Card>

            {/* Ingredients */}
            <Card style={styles.ingredientsCard}>
              <Text style={styles.sectionTitle}>
                📋 Ingredientes ({result.ingredients.length})
              </Text>

              {/* Matched Ingredients */}
              {matchedIngredients.length > 0 && (
                <View style={styles.ingredientGroup}>
                  <Text style={styles.ingredientGroupTitle}>
                    ✅ Tienes ({matchedIngredients.length})
                  </Text>
                  {matchedIngredients.map((ingredient, index) => (
                    <View key={`matched-${index}`} style={styles.ingredientRow}>
                      <CheckCircle size={18} color={colors.primary} />
                      <Text style={styles.ingredientText}>{ingredient}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Missing Ingredients */}
              {missingIngredients.length > 0 && (
                <View style={styles.ingredientGroup}>
                  <Text style={styles.ingredientGroupTitle}>
                    🛒 Te faltan ({missingIngredients.length})
                  </Text>
                  {missingIngredients.map((ingredient, index) => (
                    <View key={`missing-${index}`} style={styles.ingredientRow}>
                      <Text style={styles.missingEmoji}>🛒</Text>
                      <Text style={[styles.ingredientText, styles.missingText]}>
                        {ingredient}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>

            {/* Steps */}
            {result.steps.length > 0 && (
              <Card style={styles.stepsCard}>
                <Text style={styles.sectionTitle}>
                  👨‍🍳 Pasos ({result.steps.length})
                </Text>
                {result.steps.map((step, index) => (
                  <View key={index} style={styles.stepRow}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </Card>
            )}

            {/* Save Button */}
            <Button
              title="💾 Guardar Receta"
              onPress={handleSaveRecipe}
              style={styles.saveButton}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFE5EC',
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#FFE5EC',
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.headlineMedium,
    fontWeight: '700',
    color: colors.onSurface,
  },
  inputCard: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.titleMedium,
    fontWeight: '700',
    color: colors.onSurface,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.md,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.outline,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    ...typography.bodyMedium,
    color: colors.onSurface,
  },
  analyzeButton: {
    marginTop: spacing.xs,
  },
  errorCard: {
    backgroundColor: colors.errorContainer,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  errorEmoji: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.bodyMedium,
    color: colors.onErrorContainer,
    textAlign: 'center',
  },
  loadingCard: {
    alignItems: 'center',
    padding: spacing.xl,
    marginBottom: spacing.md,
  },
  loadingText: {
    ...typography.titleMedium,
    fontWeight: '600',
    color: colors.onSurface,
    marginTop: spacing.md,
  },
  loadingSubtext: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginTop: spacing.xs,
  },
  resultCard: {
    marginBottom: spacing.md,
  },
  recipeHeader: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  recipeEmoji: {
    fontSize: 48,
  },
  recipeInfo: {
    flex: 1,
  },
  recipeTitle: {
    ...typography.titleLarge,
    fontWeight: '700',
    color: colors.onSurface,
    marginBottom: spacing.xs,
  },
  recipeSource: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryContainer,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
  },
  matchEmoji: {
    fontSize: 16,
  },
  matchText: {
    ...typography.labelMedium,
    fontWeight: '700',
    color: colors.onPrimaryContainer,
  },
  ingredientsCard: {
    marginBottom: spacing.md,
  },
  ingredientGroup: {
    marginBottom: spacing.md,
  },
  ingredientGroupTitle: {
    ...typography.labelLarge,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  ingredientText: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    flex: 1,
  },
  missingEmoji: {
    fontSize: 18,
  },
  missingText: {
    color: colors.onSurfaceVariant,
  },
  stepsCard: {
    marginBottom: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumberText: {
    ...typography.labelMedium,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  stepText: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    flex: 1,
  },
  saveButton: {
    marginTop: spacing.md,
  },
});

export default AddRecipeFromUrlScreen;
```

---

### **Paso 3: Integrar en navegación (10 min)**

#### 3.1. Agregar import en AppNavigator.tsx

```typescript
// Línea 24, agregar:
import AddRecipeFromUrlScreen from '../screens/AddRecipeFromUrlScreen';
```

#### 3.2. Agregar screen en Stack

```typescript
// Línea 156, antes del cierre de </>:
<Stack.Screen
  name="AddRecipeFromUrl"
  component={AddRecipeFromUrlScreen}
  options={{
    headerShown: false,
    presentation: 'modal'
  }}
/>
```

---

### **Paso 4: Agregar botón en RecipesProScreen (15 min)**

#### 4.1. Agregar import de icono

```typescript
// Línea 17, modificar:
import { ArrowLeft, Heart, Shuffle, Link as LinkIcon } from 'lucide-react-native';
```

#### 4.2. Agregar botón en header

```typescript
// Línea 360, después del botón de favoritos:
<TouchableOpacity
  onPress={() => navigation.navigate('AddRecipeFromUrl')}
  style={styles.addFromUrlButton}
  activeOpacity={0.7}
>
  <LinkIcon size={24} color={colors.primary} />
</TouchableOpacity>
```

#### 4.3. Agregar estilo

```typescript
// En styles (línea 1260):
addFromUrlButton: {
  padding: 4,
  marginLeft: 8,
},
```

---

## ✅ Checklist de Implementación

### **Archivos a crear:**
- [ ] `src/screens/AddRecipeFromUrlScreen.tsx`

### **Archivos a modificar:**
- [ ] `src/types/index.ts` - Agregar tipo de navegación
- [ ] `src/services/firebase/functions.ts` - Agregar función parseRecipeFromUrl
- [ ] `src/navigation/AppNavigator.tsx` - Agregar screen y import
- [ ] `src/screens/RecipesProScreen.tsx` - Agregar botón de navegación

### **Testing:**
- [ ] Navegar desde RecipesTab → AddRecipeFromUrl
- [ ] Pegar URL de YouTube y parsear
- [ ] Pegar URL de Instagram Reel y parsear
- [ ] Pegar URL de TikTok y parsear
- [ ] Verificar match con inventario
- [ ] Verificar que muestra pasos correctamente
- [ ] Guardar receta (implementar guardado)

---

## 📊 Estimación de Tiempo Total

| Fase | Duración Estimada |
|------|-------------------|
| Setup (tipos + función) | 15 min |
| Crear AddRecipeFromUrlScreen | 1.5 horas |
| Integrar en navegación | 10 min |
| Agregar botón en RecipesProScreen | 15 min |
| Testing inicial | 30 min |
| **TOTAL** | **~2.5 horas** |

---

## 🎯 Siguiente Paso INMEDIATO

```bash
# 1. Agregar tipo de navegación
# Abrir: src/types/index.ts
# Línea 41, agregar: AddRecipeFromUrl: undefined;

# 2. Agregar función de Firebase
# Abrir: src/services/firebase/functions.ts
# Copiar el código de parseRecipeFromUrl al final del archivo

# 3. Crear pantalla nueva
# Crear archivo: src/screens/AddRecipeFromUrlScreen.tsx
# Copiar el código completo de la pantalla
```

¿Quieres que empiece con el **Paso 1** y creemos los archivos juntos?
