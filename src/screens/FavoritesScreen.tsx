import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { ArrowLeft, Heart } from 'lucide-react-native';
import { colors, typography, spacing } from '../theme';
import { borderRadius } from '../theme/spacing';
import { useFavorites } from '../hooks/useFavorites';
import { RecipeUi } from '../database/models/RecipeCache';
import { RootStackParamList } from '../types';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';

type FavoritesNavigationProp = StackNavigationProp<RootStackParamList, 'FavoritesTab'>;

const FavoritesScreen = () => {
  const navigation = useNavigation<FavoritesNavigationProp>();
  const { favorites, loading, removeFavorite, persistUpdatedMatches } = useFavorites();
  const sortedFavorites = useMemo(
    () => [...favorites].sort((a, b) => b.matchPercentage - a.matchPercentage),
    [favorites]
  );

  useFocusEffect(
    React.useCallback(() => {
      persistUpdatedMatches();
    }, [persistUpdatedMatches])
  );

  const handleRemoveFavorite = (recipe: RecipeUi) => {
    Alert.alert(
      'Eliminar favorito',
      `¿Quieres eliminar "${recipe.name}" de tus favoritos?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => removeFavorite(recipe.id)
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header Kawaii */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <ArrowLeft size={24} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mis Favoritos</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          Tus recetas guardadas ❤️
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        {/* Stats Card */}
        <Card style={styles.statsCard}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsTitle}>❤️ Recetas favoritas</Text>
            <Text style={styles.statsCount}>{favorites.length}</Text>
          </View>
          <Text style={styles.statsSubtext}>
            {favorites.length === 0
              ? 'Aún no tienes favoritos'
              : favorites.length === 1
              ? '1 receta guardada'
              : `${favorites.length} recetas guardadas`}
          </Text>
        </Card>

        {/* Empty State */}
        {!loading && favorites.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>💕</Text>
            <Text style={styles.emptyStateTitle}>No tienes favoritos aún</Text>
            <Text style={styles.emptyStateText}>
              Explora recetas y guarda tus favoritas para encontrarlas fácilmente aquí
            </Text>
            <Button
              title="Explorar Recetas"
              onPress={() => navigation.navigate('RecipesTab')}
              style={styles.exploreButton}
            />
          </View>
        )}

        {/* Favorites List */}
        {favorites.length > 0 && (
          <View style={styles.recipesContainer}>
            {sortedFavorites.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onRemove={() => handleRemoveFavorite(recipe)}
                onOpenSteps={() => navigation.navigate('RecipeSteps', { recipe })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

/**
 * RecipeCard Component for Favorites
 */
interface RecipeCardProps {
  recipe: RecipeUi;
  onRemove: () => void;
  onOpenSteps: () => void;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, onRemove, onOpenSteps }) => {
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
      <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
        <View style={styles.recipeHeader}>
          {/* Large Recipe Emoji */}
          <Text style={styles.recipeEmoji}>🍽️</Text>

          <View style={styles.recipeInfo}>
            <View style={styles.recipeTitleRow}>
              <Text style={styles.recipeName}>{recipe.name}</Text>
              {/* Match Badge with Heart */}
              <View style={styles.matchBadge}>
                <Text style={styles.heartEmoji}>❤️</Text>
                <Text style={styles.matchText}>{recipe.matchPercentage}%</Text>
              </View>
            </View>
            {recipe.matchPercentage === 100 && (
              <View style={styles.readyBadge}>
                <Text style={styles.readyBadgeText}>Listo para cocinar</Text>
              </View>
            )}

            {/* Quick Stats */}
            <View style={styles.ingredientsRow}>
              <View style={styles.ingredientStat}>
                <Text style={styles.ingredientEmoji}>😊</Text>
                <Text style={styles.ingredientLabel}>
                  {matchedIngredients.length}/{matchedIngredients.length + missingIngredients.length}
                </Text>
              </View>
              {missingIngredients.length > 0 && (
                <View style={styles.ingredientStat}>
                  <Text style={styles.ingredientEmoji}>🛒</Text>
                  <Text style={styles.ingredientLabel}>
                    {missingIngredients.length}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {expanded && (
          <View style={styles.recipeDetails}>
            {/* All Ingredients with Emoji Status */}
            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>📋 Ingredientes</Text>
              <View style={styles.ingredientsList}>
                {matchedIngredients.map((ing, index) => (
                  <View key={`matched-${index}`} style={styles.ingredientRow}>
                    <Text style={styles.ingredientStatusEmoji}>😊</Text>
                    <Text style={styles.detailItem}>{ing}</Text>
                  </View>
                ))}
                {missingIngredients.map((ing, index) => (
                  <View key={`missing-${index}`} style={styles.ingredientRow}>
                    <Text style={styles.ingredientStatusEmoji}>🛒</Text>
                    <Text style={[styles.detailItem, styles.missingItem]}>{ing}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Full Ingredients with Measures */}
            {ingredientsWithMeasures.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.detailTitle}>🥄 Cantidades</Text>
                <View style={styles.ingredientsList}>
                  {ingredientsWithMeasures.map((ing, index) => (
                    <View key={index} style={styles.ingredientRow}>
                      <Text style={styles.bulletEmoji}>•</Text>
                      <Text style={styles.detailItem}>{ing}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Instructions */}
            {instructions && (
              <View style={styles.detailSection}>
                <Text style={styles.detailTitle}>👨‍🍳 Preparación</Text>
                <Text style={styles.instructionsText}>{instructions}</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <Button
          title="Cocinar paso a paso"
          onPress={onOpenSteps}
          style={styles.stepsButton}
        />
        <TouchableOpacity onPress={onRemove} style={styles.removeButton}>
          <Heart size={20} color={colors.error} fill={colors.error} />
          <Text style={styles.removeButtonText}>Quitar de favoritos</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
        <Text style={styles.expandText}>{expanded ? 'Ver menos ▲' : 'Ver más ▼'}</Text>
      </TouchableOpacity>
    </Card>
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
    backgroundColor: '#FFE5EC',
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
  backButton: {
    padding: 4,
    marginRight: 4,
  },
  headerTitle: {
    ...typography.headlineLarge,
    fontSize: 32,
    fontWeight: '800',
    color: colors.onSurface,
    flex: 1,
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
  statsSubtext: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    marginTop: spacing.md,
  },
  emptyStateEmoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyStateTitle: {
    ...typography.titleLarge,
    fontWeight: '700',
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  exploreButton: {
    marginTop: spacing.sm,
  },
  recipesContainer: {
    marginBottom: spacing.xl,
  },
  recipeCard: {
    marginBottom: spacing.md,
  },
  recipeHeader: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  recipeEmoji: {
    fontSize: 56,
    flexShrink: 0,
  },
  recipeInfo: {
    flex: 1,
    minWidth: 0,
  },
  recipeTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  recipeName: {
    ...typography.titleMedium,
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
    flex: 1,
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 107, 157, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 107, 157, 0.3)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    flexShrink: 0,
  },
  heartEmoji: {
    fontSize: 14,
  },
  matchText: {
    ...typography.labelSmall,
    fontSize: 12,
    color: '#FF6B9D',
    fontWeight: 'bold',
  },
  readyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryContainer,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginBottom: spacing.xs,
  },
  readyBadgeText: {
    ...typography.labelSmall,
    color: colors.primary,
    fontWeight: '700',
  },
  ingredientsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  ingredientStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ingredientEmoji: {
    fontSize: 16,
  },
  ingredientLabel: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
  actionButtons: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  stepsButton: {
    marginBottom: spacing.xs,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.errorContainer,
  },
  removeButtonText: {
    ...typography.labelMedium,
    color: colors.error,
    fontWeight: '600',
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
    backgroundColor: 'rgba(181, 234, 215, 0.05)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  detailSection: {
    marginBottom: spacing.md,
  },
  detailTitle: {
    ...typography.titleSmall,
    fontSize: 14,
    color: colors.onSurface,
    marginBottom: spacing.sm,
    fontWeight: '700',
  },
  ingredientsList: {
    gap: spacing.xs,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ingredientStatusEmoji: {
    fontSize: 18,
    width: 24,
  },
  bulletEmoji: {
    fontSize: 16,
    width: 24,
    color: colors.primary,
  },
  detailItem: {
    ...typography.bodySmall,
    fontSize: 14,
    color: colors.onSurface,
    flex: 1,
  },
  missingItem: {
    color: colors.onSurfaceVariant,
  },
  instructionsText: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    lineHeight: 20,
  },
});

export default FavoritesScreen;
