import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { colors, typography, spacing } from '../theme';
import { borderRadius } from '../theme/spacing';
import { useInventoryStore } from '../stores/useInventoryStore';
import { usePreferencesStore } from '../stores/usePreferencesStore';
import { useRecipes } from '../hooks/useRecipes';
import { useInventory } from '../hooks/useInventory';
import { RecipeUi } from '../database/models/RecipeCache';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';

// Common kitchen utensils (Spanish)
const COMMON_UTENSILS = [
  'horno',
  'microondas',
  'batidora',
  'olla a presión',
  'freidora',
  'licuadora',
  'procesador',
  'tostadora',
];

const RecipesProScreen = () => {
  const { items } = useInventoryStore();
  const {
    isPro,
    monthlyRecipeCallsUsed,
    cookingTime,
    availableUtensils,
    setCookingTime,
    setAvailableUtensils,
  } = usePreferencesStore();

  const { recipes, loading, error, getRecipeSuggestions, clearAllCaches } = useRecipes();
  const { forceSyncAllToFirestore } = useInventory();

  const [selectedUtensils, setSelectedUtensils] = useState<string[]>(availableUtensils);
  const [syncing, setSyncing] = useState(false);
  const [localCookingTime, setLocalCookingTime] = useState<number>(cookingTime);
  const wiggleAnim = useRef(new Animated.Value(0)).current;

  // Wiggle animation for emoji
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(wiggleAnim, {
          toValue: -3,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(wiggleAnim, {
          toValue: 3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(wiggleAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.delay(2000),
      ])
    ).start();
  }, [wiggleAnim]);

  // Debug: Log recipes state
  useEffect(() => {
    console.log('Recipes state updated:', recipes.length, 'recipes');
  }, [recipes]);

  const maxCalls = isPro ? 100 : 10;
  const remainingCalls = maxCalls - monthlyRecipeCallsUsed;

  // Get normalized ingredient names from inventory for recipe matching
  // Falls back to original name if normalization hasn't been done yet
  const ingredientNames = items
    .map((item) => item.normalizedName || item.name)
    .filter((name) => name && name.trim() !== ''); // Remove empty/null names

  useEffect(() => {
    setSelectedUtensils(availableUtensils);
    setLocalCookingTime(cookingTime);
  }, [availableUtensils, cookingTime]);

  const handleUtensilToggle = (utensil: string) => {
    setSelectedUtensils((prev) => {
      if (prev.includes(utensil)) {
        return prev.filter((u) => u !== utensil);
      } else {
        return [...prev, utensil];
      }
    });
  };

  const handleGetRecipes = async () => {
    if (items.length === 0) {
      Alert.alert('Sin ingredientes', 'Añade ingredientes a tu inventario primero');
      return;
    }

    // Save preferences
    setCookingTime(localCookingTime);
    setAvailableUtensils(selectedUtensils);

    // Get recipe suggestions
    await getRecipeSuggestions(ingredientNames, localCookingTime, selectedUtensils);
  };

  const handleUpgradeToPro = () => {
    Alert.alert(
      'Actualizar a Pro',
      '¿Deseas actualizar a la versión Pro para obtener más recetas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Actualizar', onPress: () => console.log('Upgrade to Pro') },
      ]
    );
  };

  const handleClearCache = async () => {
    await clearAllCaches();
    Alert.alert('Caché limpiado', 'Ahora puedes obtener nuevas recetas');
  };

  const handleForceSync = async () => {
    setSyncing(true);
    try {
      await forceSyncAllToFirestore();
      await clearAllCaches();
      Alert.alert('Sincronización completada', 'Items sincronizados con nombres normalizados. Caché limpiado.');
    } catch (err) {
      Alert.alert('Error', 'No se pudo sincronizar los items');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header Kawaii */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Recetas IA</Text>
          <Animated.Text
            style={[
              styles.headerEmoji,
              {
                transform: [{
                  rotate: wiggleAnim.interpolate({
                    inputRange: [-3, 3],
                    outputRange: ['-3deg', '3deg']
                  })
                }]
              }
            ]}
          >
            👨‍🍳
          </Animated.Text>
        </View>
        <Text style={styles.headerSubtitle}>
          {recipes.length} {recipes.length === 1 ? 'receta' : 'recetas'} disponibles ♡
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer}>

      {/* Usage Stats */}
      <Card style={styles.statsCard}>
        <View style={styles.statsHeader}>
          <Text style={styles.statsTitle}>
            {isPro ? 'Plan Pro' : 'Plan Gratuito'}
          </Text>
          <Text style={styles.statsCount}>
            {monthlyRecipeCallsUsed} / {maxCalls}
          </Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${(monthlyRecipeCallsUsed / maxCalls) * 100}%`,
                backgroundColor:
                  monthlyRecipeCallsUsed / maxCalls >= 0.9
                    ? colors.error
                    : colors.primary,
              },
            ]}
          />
        </View>

        <Text style={styles.statsSubtext}>
          {remainingCalls} {remainingCalls === 1 ? 'llamada restante' : 'llamadas restantes'} este mes
        </Text>

        {!isPro && (
          <Button
            title="Actualizar a Pro"
            onPress={handleUpgradeToPro}
            style={styles.upgradeButton}
          />
        )}
      </Card>

      {/* Preferences Section */}
      <Card style={styles.preferencesCard}>
        <Text style={styles.sectionTitle}>Preferencias de Cocina</Text>

        {/* Cooking Time Slider */}
        <View style={styles.preferenceItem}>
          <Text style={styles.preferenceLabel}>
            Tiempo de cocción: {localCookingTime} minutos
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={10}
            maximumValue={120}
            step={5}
            value={localCookingTime}
            onValueChange={setLocalCookingTime}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.surfaceVariant}
            thumbTintColor={colors.primary}
          />
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>10 min</Text>
            <Text style={styles.sliderLabel}>120 min</Text>
          </View>
        </View>

        {/* Utensils Selection */}
        <View style={styles.preferenceItem}>
          <Text style={styles.preferenceLabel}>Utensilios disponibles:</Text>
          <View style={styles.utensilsContainer}>
            {COMMON_UTENSILS.map((utensil) => {
              const isSelected = selectedUtensils.includes(utensil);
              return (
                <TouchableOpacity
                  key={utensil}
                  style={[
                    styles.utensilChip,
                    isSelected && styles.utensilChipSelected,
                  ]}
                  onPress={() => handleUtensilToggle(utensil)}
                >
                  <Text
                    style={[
                      styles.utensilChipText,
                      isSelected && styles.utensilChipTextSelected,
                    ]}
                  >
                    {utensil}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Card>

      {/* Get Recipes Button */}
      <Button
        title={loading ? 'Obteniendo recetas...' : 'Obtener Recetas'}
        onPress={handleGetRecipes}
        disabled={loading || remainingCalls <= 0}
        style={styles.getRecipesButton}
      />

      {/* Debug Buttons */}
      <View style={styles.debugButtonsContainer}>
        <TouchableOpacity onPress={handleClearCache} style={styles.clearCacheButton}>
          <Text style={styles.clearCacheText}>🗑️ Limpiar Caché</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleForceSync}
          style={styles.clearCacheButton}
          disabled={syncing}
        >
          <Text style={styles.clearCacheText}>
            {syncing ? '⏳ Sincronizando...' : '🔄 Forzar Sync Firestore'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Loading Indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Generando recetas...</Text>
        </View>
      )}

      {/* Recipes List */}
      {!loading && recipes.length > 0 && (
        <View style={styles.recipesContainer}>
          <Text style={styles.recipesTitle}>
            Recetas Sugeridas ({recipes.length})
          </Text>
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </View>
      )}

      {/* Empty State */}
      {!loading && recipes.length === 0 && !error && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            👨‍🍳 Configura tus preferencias y pulsa "Obtener Recetas" para ver sugerencias
          </Text>
        </View>
      )}
      </ScrollView>
    </SafeAreaView>
  );
};

/**
 * RecipeCard Component
 */
interface RecipeCardProps {
  recipe: RecipeUi;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe }) => {
  const [expanded, setExpanded] = useState(false);
  const matchedIngredients = Array.isArray(recipe.matchedIngredients)
    ? recipe.matchedIngredients
    : [];
  const missingIngredients = Array.isArray(recipe.missingIngredients)
    ? recipe.missingIngredients
    : [];
  const ingredientsWithMeasures = Array.isArray(recipe.ingredientsWithMeasures)
    ? recipe.ingredientsWithMeasures
    : [];
  const instructions = recipe.instructions || '';

  return (
    <Card style={styles.recipeCard}>
      <TouchableOpacity onPress={() => setExpanded(!expanded)}>
        <View style={styles.recipeHeader}>
          <Text style={styles.recipeName}>{recipe.name}</Text>
          <View style={styles.matchBadge}>
            <Text style={styles.matchText}>{recipe.matchPercentage}%</Text>
          </View>
        </View>

        <View style={styles.ingredientsRow}>
          <Text style={styles.ingredientLabel}>
            ✓ Tienes: {matchedIngredients.length}
          </Text>
          <Text style={styles.ingredientLabel}>
            ✗ Faltan: {missingIngredients.length}
          </Text>
        </View>

        {expanded && (
          <View style={styles.recipeDetails}>
            {/* Matched Ingredients */}
            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>Ingredientes disponibles:</Text>
              {matchedIngredients.map((ing, index) => (
                <Text key={index} style={styles.detailItem}>
                  • {ing}
                </Text>
              ))}
            </View>

            {/* Missing Ingredients */}
            {missingIngredients.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.detailTitle}>Ingredientes faltantes:</Text>
                {missingIngredients.map((ing, index) => (
                  <Text key={index} style={[styles.detailItem, styles.missingItem]}>
                    • {ing}
                  </Text>
                ))}
              </View>
            )}

            {/* Full Ingredients with Measures */}
            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>Ingredientes completos:</Text>
              {ingredientsWithMeasures.map((ing, index) => (
                <Text key={index} style={styles.detailItem}>
                  • {ing}
                </Text>
              ))}
            </View>

            {/* Instructions */}
            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>Instrucciones:</Text>
              <Text style={styles.instructionsText}>{instructions}</Text>
            </View>
          </View>
        )}

        <Text style={styles.expandText}>{expanded ? 'Ver menos ▲' : 'Ver más ▼'}</Text>
      </TouchableOpacity>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  headerTitle: {
    ...typography.headlineLarge,
    fontSize: 32,
    fontWeight: '800',
    color: colors.onSurface,
  },
  headerEmoji: {
    fontSize: 28,
  },
  headerSubtitle: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    opacity: 0.9,
  },
  statsCard: {
    marginBottom: spacing.md,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statsTitle: {
    ...typography.titleMedium,
    color: colors.onSurface,
  },
  statsCount: {
    ...typography.titleLarge,
    color: colors.primary,
    fontWeight: 'bold',
  },
  progressBarContainer: {
    height: 10,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressBar: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  statsSubtext: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.sm,
  },
  upgradeButton: {
    marginTop: spacing.xs,
  },
  preferencesCard: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.onSurface,
    marginBottom: spacing.md,
  },
  preferenceItem: {
    marginBottom: spacing.lg,
  },
  preferenceLabel: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  utensilsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  utensilChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
  },
  utensilChipSelected: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  utensilChipText: {
    ...typography.labelMedium,
    color: colors.onSurface,
  },
  utensilChipTextSelected: {
    color: colors.onPrimaryContainer,
    fontWeight: '600',
  },
  getRecipesButton: {
    marginBottom: spacing.sm,
  },
  debugButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  clearCacheButton: {
    alignItems: 'center',
    padding: spacing.sm,
  },
  clearCacheText: {
    ...typography.labelMedium,
    color: colors.muted,
  },
  errorContainer: {
    padding: spacing.md,
    backgroundColor: colors.errorContainer,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.bodyMedium,
    color: colors.onErrorContainer,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    marginTop: spacing.sm,
  },
  recipesContainer: {
    marginBottom: spacing.xl,
  },
  recipesTitle: {
    ...typography.titleLarge,
    color: colors.onSurface,
    marginBottom: spacing.md,
  },
  recipeCard: {
    marginBottom: spacing.md,
  },
  recipeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  recipeName: {
    ...typography.titleMedium,
    color: colors.onSurface,
    flex: 1,
  },
  matchBadge: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
    marginLeft: spacing.sm,
  },
  matchText: {
    ...typography.labelSmall,
    color: colors.onPrimaryContainer,
    fontWeight: 'bold',
  },
  ingredientsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  ingredientLabel: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  expandText: {
    ...typography.labelMedium,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  recipeDetails: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 2,
    borderTopColor: colors.surfaceVariant,
  },
  detailSection: {
    marginBottom: spacing.md,
  },
  detailTitle: {
    ...typography.titleSmall,
    color: colors.onSurface,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  detailItem: {
    ...typography.bodySmall,
    color: colors.onSurface,
    marginBottom: 2,
  },
  missingItem: {
    color: colors.error,
  },
  instructionsText: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyStateText: {
    ...typography.bodyLarge,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
});

export default RecipesProScreen;
