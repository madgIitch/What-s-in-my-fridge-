import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { colors, typography, spacing } from '../theme';
import { useInventoryStore } from '../stores/useInventoryStore';
import { usePreferencesStore } from '../stores/usePreferencesStore';
import { useRecipes } from '../hooks/useRecipes';
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

  const { recipes, loading, error, getRecipeSuggestions } = useRecipes();

  const [selectedUtensils, setSelectedUtensils] = useState<string[]>(availableUtensils);
  const [localCookingTime, setLocalCookingTime] = useState<number>(cookingTime);

  const maxCalls = isPro ? 100 : 10;
  const remainingCalls = maxCalls - monthlyRecipeCallsUsed;

  // Get ingredient names from inventory
  const ingredientNames = items.map((item) => item.name);

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Recetas IA</Text>
        <Text style={styles.subtitle}>
          Obtén sugerencias de recetas basadas en tus ingredientes
        </Text>
      </View>

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
            ✓ Tienes: {recipe.matchedIngredients.length}
          </Text>
          <Text style={styles.ingredientLabel}>
            ✗ Faltan: {recipe.missingIngredients.length}
          </Text>
        </View>

        {expanded && (
          <View style={styles.recipeDetails}>
            {/* Matched Ingredients */}
            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>Ingredientes disponibles:</Text>
              {recipe.matchedIngredients.map((ing, index) => (
                <Text key={index} style={styles.detailItem}>
                  • {ing}
                </Text>
              ))}
            </View>

            {/* Missing Ingredients */}
            {recipe.missingIngredients.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.detailTitle}>Ingredientes faltantes:</Text>
                {recipe.missingIngredients.map((ing, index) => (
                  <Text key={index} style={[styles.detailItem, styles.missingItem]}>
                    • {ing}
                  </Text>
                ))}
              </View>
            )}

            {/* Full Ingredients with Measures */}
            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>Ingredientes completos:</Text>
              {recipe.ingredientsWithMeasures.map((ing, index) => (
                <Text key={index} style={styles.detailItem}>
                  • {ing}
                </Text>
              ))}
            </View>

            {/* Instructions */}
            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>Instrucciones:</Text>
              <Text style={styles.instructionsText}>{recipe.instructions}</Text>
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
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.headlineMedium,
    color: colors.onSurface,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
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
    height: 8,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
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
    borderRadius: 16,
    borderWidth: 1,
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
    marginBottom: spacing.md,
  },
  errorContainer: {
    padding: spacing.md,
    backgroundColor: colors.errorContainer,
    borderRadius: 8,
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
    borderRadius: 12,
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
    borderTopWidth: 1,
    borderTopColor: colors.outline,
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
