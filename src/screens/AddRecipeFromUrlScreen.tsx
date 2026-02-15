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
import { useFavorites } from '../hooks/useFavorites';
import { RecipeUi } from '../database/models/RecipeCache';
import { useSubscription } from '../hooks/useSubscription';

type AddRecipeFromUrlNavigationProp = StackNavigationProp<RootStackParamList, 'AddRecipeFromUrl'>;

const AddRecipeFromUrlScreen = () => {
  const navigation = useNavigation<AddRecipeFromUrlNavigationProp>();
  const { items } = useInventoryStore();
  const { addFavorite } = useFavorites();
  const {
    canUseUrlImports,
    incrementUrlImports,
    isPro,
    remainingUrlImports,
  } = useSubscription();

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ParseRecipeFromUrlResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get user inventory for matching
  const inventoryNames = items
    .map((item) => item.normalizedName || item.name)
    .filter((name) => name && name.trim() !== '');

  const handleParseUrl = async () => {
    if (!canUseUrlImports) {
      navigation.navigate('Paywall', { source: 'url_recipes' });
      return;
    }
    if (!url.trim()) {
      setError('Please enter a valid URL');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await parseRecipeFromUrl({ url: url.trim() });
      setResult(data);
      if (!isPro) {
        incrementUrlImports();
      }
    } catch (err: any) {
      console.error('Error parsing recipe:', err);
      setError(err.message || 'Error processing recipe. Try another URL.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRecipe = async () => {
    if (!result) return;

    const recipe: RecipeUi = {
      id: `url_${Date.now()}`,
      name: result.recipeTitle || 'Recipe from URL',
      matchPercentage,
      matchedIngredients,
      missingIngredients,
      ingredientsWithMeasures: result.ingredients,
      instructions: result.steps.join('\n'),
    };

    try {
      await addFavorite(recipe);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert(
        'Error saving',
        err?.message || 'Could not save recipe. Try again.'
      );
    }
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
            YouTube, Instagram Reels, TikTok or recipe blog
          </Text>
          {!isPro && (
            <Text style={styles.sectionSubtitle}>
              Free plan: {remainingUrlImports} / 10 URL imports left this month
            </Text>
          )}

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
            title={loading ? 'Analyzing... (20-30 sec)' : '✨ Analyze Recipe'}
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
                    {result.recipeTitle || 'Recipe'}
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
              title="💾 Save Recipe"
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
