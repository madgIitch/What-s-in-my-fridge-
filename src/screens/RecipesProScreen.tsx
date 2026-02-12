import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Animated,
  StatusBar,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Slider from '@react-native-community/slider';
import { ArrowLeft, Heart, Shuffle, Link as LinkIcon, CheckCircle } from 'lucide-react-native';
import { parseRecipeFromUrl, ParseRecipeFromUrlResult } from '../services/firebase/functions';
import { colors, typography, spacing } from '../theme';
import { borderRadius } from '../theme/spacing';
import { useInventoryStore } from '../stores/useInventoryStore';
import { usePreferencesStore } from '../stores/usePreferencesStore';
import { useRecipes } from '../hooks/useRecipes';
import { useFavorites } from '../hooks/useFavorites';
import { RecipeUi } from '../database/models/RecipeCache';
import { RootStackParamList } from '../types';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { LoadingNeverito } from '../components/common';

// Common kitchen utensils (Spanish) with emojis
const COMMON_UTENSILS = [
  { name: 'horno', emoji: '🔥' },
  { name: 'microondas', emoji: '📡' },
  { name: 'batidora', emoji: '🥄' },
  { name: 'olla a presión', emoji: '🍲' },
  { name: 'freidora', emoji: '🍟' },
  { name: 'licuadora', emoji: '🥤' },
  { name: 'procesador', emoji: '⚙️' },
  { name: 'tostadora', emoji: '🍞' },
];

type RecipesNavigationProp = StackNavigationProp<RootStackParamList, 'RecipesTab'>;

const RecipesProScreen = () => {
  const navigation = useNavigation<RecipesNavigationProp>();
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
  const { isFavorite, toggleFavorite, addFavorite } = useFavorites();

  const [selectedUtensils, setSelectedUtensils] = useState<string[]>(availableUtensils);
  const [localCookingTime, setLocalCookingTime] = useState<number>(cookingTime);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const [selectedIngredientFilters, setSelectedIngredientFilters] = useState<string[]>([]);
  const [selectedCategoryFilters, setSelectedCategoryFilters] = useState<string[]>([]);
  const [recipeMode, setRecipeMode] = useState<'local' | 'url'>('local');
  // URL mode state
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlResult, setUrlResult] = useState<ParseRecipeFromUrlResult | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const wiggleAnim = useRef(new Animated.Value(0)).current;

  // Wiggle animation for emoji
  useEffect(() => {
    const anim = Animated.loop(
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
    );
    anim.start();
    return () => anim.stop();
  }, [wiggleAnim]);

  const maxCalls = isPro ? 100 : 10;
  const remainingCalls = maxCalls - monthlyRecipeCallsUsed;

  // Get normalized ingredient names from inventory for recipe matching
  // Falls back to original name if normalization hasn't been done yet
  const ingredientNames = items
    .map((item) => item.normalizedName || item.name)
    .filter((name) => name && name.trim() !== ''); // Remove empty/null names

  const ingredientOptions = useMemo(() => {
    const unique = new Set<string>();

    for (const item of items) {
      const name = (item.normalizedName || item.name || '').trim();
      if (name) unique.add(name);
    }

    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const categoryOptions = useMemo(() => {
    const unique = new Set(
      items
        .map((item) => item.category)
        .filter((category) => category && category.trim() !== '')
        .map((category) => category!.trim())
    );
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [items]);

  useEffect(() => {
    setSelectedUtensils(availableUtensils);
    setLocalCookingTime(cookingTime);
  }, [availableUtensils, cookingTime]);

  const handleUtensilToggle = (utensilName: string) => {
    setSelectedUtensils((prev) => {
      const newUtensils = prev.includes(utensilName)
        ? prev.filter((u) => u !== utensilName)
        : [...prev, utensilName];

      // Save to Firebase immediately
      setAvailableUtensils(newUtensils);

      return newUtensils;
    });
  };

  const handleGetRecipes = async () => {
    console.log('🍳 handleGetRecipes called');
    if (items.length === 0) {
      Alert.alert('Sin ingredientes', 'Añade ingredientes a tu inventario primero');
      return;
    }

    console.log('📝 Calling getRecipeSuggestions with:', {
      ingredients: ingredientNames.length,
      cookingTime: localCookingTime,
      utensils: selectedUtensils.length,
    });

    const MIN_LOADING_TIME = 800; // ms
    const startTime = Date.now();

    try {
      // Show loading overlay immediately
      console.log('🎬 [Screen] Showing loading overlay');
      setShowLoadingOverlay(true);

      // Small delay to ensure React renders the overlay
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get recipe suggestions
      await getRecipeSuggestions(ingredientNames, localCookingTime, selectedUtensils);

      console.log('✅ getRecipeSuggestions completed');

      // Ensure minimum loading time
      const elapsedTime = Date.now() - startTime;
      const remainingTime = MIN_LOADING_TIME - elapsedTime;

      if (remainingTime > 0) {
        console.log(`⏰ [Screen] Waiting ${remainingTime}ms more for animation`);
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }
    } finally {
      console.log('🎬 [Screen] Hiding loading overlay');
      setShowLoadingOverlay(false);
    }
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


  const normalized = (value: string) => value.trim().toLowerCase();

  const filteredRecipes = useMemo(() => {
    if (selectedIngredientFilters.length === 0 && selectedCategoryFilters.length === 0) {
      return recipes;
    }

    const ingredientFilters = selectedIngredientFilters.map(normalized);
    const categoryFilters = selectedCategoryFilters.map(normalized);

    const categoryIngredientMap = new Map<string, Set<string>>();
    for (const item of items) {
      const category = item.category ? normalized(item.category) : '';
      const ingredient = item.normalizedName ? normalized(item.normalizedName) : normalized(item.name);
      if (!category || !ingredient) continue;
      const bucket = categoryIngredientMap.get(category) ?? new Set<string>();
      bucket.add(ingredient);
      categoryIngredientMap.set(category, bucket);
    }

    const categoryIngredientUnion = new Set<string>();
    for (const category of categoryFilters) {
      const bucket = categoryIngredientMap.get(category);
      if (bucket) {
        bucket.forEach((value) => categoryIngredientUnion.add(value));
      }
    }

    return recipes.filter((recipe) => {
      const baseIngredients =
        Array.isArray(recipe.matchedIngredients) && Array.isArray(recipe.missingIngredients)
          ? [...recipe.matchedIngredients, ...recipe.missingIngredients]
          : [];
      const fallbackIngredients =
        baseIngredients.length > 0
          ? baseIngredients
          : Array.isArray(recipe.ingredientsWithMeasures)
            ? recipe.ingredientsWithMeasures
            : [];

      const recipeIngredientSet = new Set(fallbackIngredients.map(normalized));

      const ingredientsMatch = ingredientFilters.every((filter) => recipeIngredientSet.has(filter));
      if (!ingredientsMatch) return false;

      if (categoryFilters.length === 0) return true;
      if (categoryIngredientUnion.size === 0) return false;

      for (const ingredient of recipeIngredientSet) {
        if (categoryIngredientUnion.has(ingredient)) return true;
      }
      return false;
    });
  }, [items, recipes, selectedCategoryFilters, selectedIngredientFilters]);

  const handleIngredientFilterToggle = (ingredientName: string) => {
    setSelectedIngredientFilters((prev) =>
      prev.includes(ingredientName)
        ? prev.filter((name) => name !== ingredientName)
        : [...prev, ingredientName]
    );
  };

  const handleCategoryFilterToggle = (categoryName: string) => {
    setSelectedCategoryFilters((prev) =>
      prev.includes(categoryName)
        ? prev.filter((name) => name !== categoryName)
        : [...prev, categoryName]
    );
  };

  const handleClearFilters = () => {
    setSelectedIngredientFilters([]);
    setSelectedCategoryFilters([]);
  };

  const handleShuffleRecipe = () => {
    // Filtrar recetas con 100% de compatibilidad
    const perfectRecipes = filteredRecipes.filter((recipe) => recipe.matchPercentage === 100);

    if (perfectRecipes.length === 0) {
      Alert.alert(
        'Sin recetas perfectas',
        'No hay recetas con 100% de compatibilidad. Intenta obtener nuevas recetas o añade más ingredientes a tu inventario.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Seleccionar una receta aleatoria
    const randomIndex = Math.floor(Math.random() * perfectRecipes.length);
    const randomRecipe = perfectRecipes[randomIndex];

    // Navegar a los pasos de la receta
    navigation.navigate('RecipeSteps', { recipe: randomRecipe });
  };

  // --- URL mode handlers ---
  const handleParseUrl = async () => {
    if (!urlInput.trim()) {
      setUrlError('Por favor ingresa una URL válida');
      return;
    }
    setUrlLoading(true);
    setUrlError(null);
    setUrlResult(null);
    try {
      const data = await parseRecipeFromUrl({ url: urlInput.trim() });
      setUrlResult(data);
    } catch (err: any) {
      setUrlError(err.message || 'Error al procesar la receta. Intenta con otra URL.');
    } finally {
      setUrlLoading(false);
    }
  };

  const urlMatchedIngredients = urlResult?.ingredients.filter((ing) =>
    ingredientNames.some((inv) =>
      inv.toLowerCase().includes(ing.toLowerCase()) ||
      ing.toLowerCase().includes(inv.toLowerCase())
    )
  ) || [];

  const urlMissingIngredients = urlResult?.ingredients.filter(
    (ing) => !urlMatchedIngredients.includes(ing)
  ) || [];

  const urlMatchPercentage = urlResult
    ? Math.round((urlMatchedIngredients.length / urlResult.ingredients.length) * 100)
    : 0;

  const getSourceIcon = (sourceType?: string) => {
    switch (sourceType) {
      case 'youtube': return '📺';
      case 'instagram': return '📸';
      case 'tiktok': return '🎵';
      case 'blog': return '📰';
      default: return '🍽️';
    }
  };

  const handleSaveUrlRecipe = async () => {
    if (!urlResult) return;
    const recipe: RecipeUi = {
      id: `url_${Date.now()}`,
      name: urlResult.recipeTitle || 'Receta desde URL',
      matchPercentage: urlMatchPercentage,
      matchedIngredients: urlMatchedIngredients,
      missingIngredients: urlMissingIngredients,
      ingredientsWithMeasures: urlResult.ingredients,
      instructions: urlResult.steps.join('\n'),
    };
    try {
      await addFavorite(recipe);
      Alert.alert('Guardada', 'Receta guardada en favoritos');
      setUrlResult(null);
      setUrlInput('');
    } catch (err: any) {
      Alert.alert('Error al guardar', err?.message || 'No se pudo guardar la receta.');
    }
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
          <Text style={styles.headerTitle}>Recetas</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('FavoritesTab')}
            style={styles.favoritesButton}
            activeOpacity={0.7}
          >
            <Heart size={24} color={colors.error} fill={colors.error} />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>
          Magia culinaria personalizada ✨
        </Text>

        {/* Chef Character */}
        <View style={styles.chefContainer}>
          <Animated.Image
            source={require('../../assets/neveritoCocinando.png')}
            style={[
              styles.chefImage,
              {
                transform: [{
                  rotate: wiggleAnim.interpolate({
                    inputRange: [-3, 3],
                    outputRange: ['-3deg', '3deg']
                  })
                }]
              }
            ]}
            resizeMode="contain"
          />
          <Text style={styles.sparkleEmoji}>✨</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer}>

      {/* Mode Switch */}
      <View style={styles.modeSwitchContainer}>
        <TouchableOpacity
          style={[styles.modeSwitchTab, recipeMode === 'local' && styles.modeSwitchTabActive]}
          onPress={() => setRecipeMode('local')}
          activeOpacity={0.7}
        >
          <Text style={[styles.modeSwitchText, recipeMode === 'local' && styles.modeSwitchTextActive]}>
            ✨ Mi Nevera
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeSwitchTab, recipeMode === 'url' && styles.modeSwitchTabActive]}
          onPress={() => setRecipeMode('url')}
          activeOpacity={0.7}
        >
          <Text style={[styles.modeSwitchText, recipeMode === 'url' && styles.modeSwitchTextActive]}>
            🔗 Desde URL
          </Text>
        </TouchableOpacity>
      </View>

      {recipeMode === 'url' ? (
        <>
          {/* URL Input */}
          <Card style={styles.urlInputCard}>
            <Text style={styles.sectionTitle}>🔗 Pega la URL</Text>
            <Text style={styles.urlSubtitle}>
              YouTube, Instagram Reels, TikTok o blog de recetas
            </Text>
            <View style={styles.urlInputRow}>
              <LinkIcon size={20} color={colors.primary} />
              <TextInput
                style={styles.urlInput}
                placeholder="https://www.youtube.com/watch?v=..."
                value={urlInput}
                onChangeText={setUrlInput}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                editable={!urlLoading}
              />
            </View>
            <Button
              title={urlLoading ? 'Analizando... (20-30 seg)' : '✨ Analizar Receta'}
              onPress={handleParseUrl}
              disabled={urlLoading || !urlInput.trim()}
            />
          </Card>

          {/* URL Error */}
          {urlError && (
            <Card style={styles.urlErrorCard}>
              <Text style={styles.errorEmoji}>⚠️</Text>
              <Text style={styles.errorText}>{urlError}</Text>
            </Card>
          )}

          {/* URL Loading */}
          {urlLoading && (
            <Card style={styles.urlLoadingCard}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Analizando video...</Text>
              <Text style={styles.loadingSubtext}>Esto puede tomar 20-30 segundos</Text>
            </Card>
          )}

          {/* URL Result */}
          {urlResult && !urlLoading && (
            <>
              <Card style={styles.urlResultCard}>
                <View style={styles.urlRecipeHeader}>
                  <Text style={styles.urlRecipeEmoji}>{getSourceIcon(urlResult.sourceType)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.urlRecipeTitle}>{urlResult.recipeTitle || 'Receta'}</Text>
                    <Text style={styles.urlRecipeSource}>Fuente: {urlResult.sourceType}</Text>
                  </View>
                </View>
                <View style={styles.urlMatchBadge}>
                  <Text style={{ fontSize: 16 }}>❤️</Text>
                  <Text style={styles.urlMatchText}>{urlMatchPercentage}% de compatibilidad</Text>
                </View>
              </Card>

              {/* Ingredients */}
              <Card style={styles.urlIngredientsCard}>
                <Text style={styles.sectionTitle}>📋 Ingredientes ({urlResult.ingredients.length})</Text>
                {urlMatchedIngredients.length > 0 && (
                  <View style={styles.urlIngredientGroup}>
                    <Text style={styles.urlIngredientGroupTitle}>✅ Tienes ({urlMatchedIngredients.length})</Text>
                    {urlMatchedIngredients.map((ingredient, index) => (
                      <View key={`m-${index}`} style={styles.urlIngredientRow}>
                        <CheckCircle size={18} color={colors.primary} />
                        <Text style={styles.urlIngredientText}>{ingredient}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {urlMissingIngredients.length > 0 && (
                  <View style={styles.urlIngredientGroup}>
                    <Text style={styles.urlIngredientGroupTitle}>🛒 Te faltan ({urlMissingIngredients.length})</Text>
                    {urlMissingIngredients.map((ingredient, index) => (
                      <View key={`f-${index}`} style={styles.urlIngredientRow}>
                        <Text style={{ fontSize: 18 }}>🛒</Text>
                        <Text style={[styles.urlIngredientText, { color: colors.onSurfaceVariant }]}>{ingredient}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </Card>

              {/* Steps */}
              {urlResult.steps.length > 0 && (
                <Card style={styles.urlStepsCard}>
                  <Text style={styles.sectionTitle}>👨‍🍳 Pasos ({urlResult.steps.length})</Text>
                  {urlResult.steps.map((step, index) => (
                    <View key={index} style={styles.urlStepRow}>
                      <View style={styles.urlStepNumber}>
                        <Text style={styles.urlStepNumberText}>{index + 1}</Text>
                      </View>
                      <Text style={styles.urlStepText}>{step}</Text>
                    </View>
                  ))}
                </Card>
              )}

              <Button
                title="💾 Guardar en Favoritos"
                onPress={handleSaveUrlRecipe}
                style={{ marginBottom: spacing.md }}
              />
            </>
          )}
        </>
      ) : (
      <>
      {/* Usage Stats */}
      <Card style={styles.statsCard}>
        <View style={styles.statsHeader}>
          <Text style={styles.statsTitle}>
            {isPro ? '⭐ Plan Pro' : '🎯 Plan Gratuito'}
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
            title="⭐ Actualizar a Pro"
            onPress={handleUpgradeToPro}
            style={styles.upgradeButton}
          />
        )}
      </Card>

      <Card style={styles.filtersCard}>
          <View style={styles.filtersHeader}>
            <Text style={styles.sectionTitle}>🔎 Filtros de recetas</Text>
            {(selectedIngredientFilters.length > 0 || selectedCategoryFilters.length > 0) && (
              <TouchableOpacity onPress={handleClearFilters} activeOpacity={0.7}>
                <Text style={styles.clearFiltersText}>Limpiar</Text>
              </TouchableOpacity>
            )}
          </View>

          {ingredientOptions.length > 0 ? (
            <View style={styles.filterGroup}>
              <Text style={styles.preferenceLabel}>🥕 Ingredientes</Text>
              <View style={styles.filtersContainer}>
                {ingredientOptions.map((ingredient) => {
                  const isSelected = selectedIngredientFilters.includes(ingredient);
                  return (
                    <TouchableOpacity
                      key={ingredient}
                      style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                      onPress={() => handleIngredientFilterToggle(ingredient)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                        {ingredient}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : (
            <Text style={styles.filtersEmptyText}>
              Añade ingredientes o genera recetas para ver opciones de filtro.
            </Text>
          )}

          {categoryOptions.length > 0 && (
            <View style={styles.filterGroup}>
              <Text style={styles.preferenceLabel}>🧺 Categorías</Text>
              <View style={styles.filtersContainer}>
                {categoryOptions.map((category) => {
                  const isSelected = selectedCategoryFilters.includes(category);
                  return (
                    <TouchableOpacity
                      key={category}
                      style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                      onPress={() => handleCategoryFilterToggle(category)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                        {category}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </Card>

      {/* Get Recipes Button */}
      <View style={styles.mainButtonsContainer}>
        <Button
          title={loading ? '⏳ Obteniendo recetas...' : '✨ Obtener Recetas Mágicas'}
          onPress={handleGetRecipes}
          disabled={loading || remainingCalls <= 0}
          style={styles.getRecipesButton}
        />
        <TouchableOpacity
          onPress={handleShuffleRecipe}
          disabled={filteredRecipes.length === 0}
          style={[styles.shuffleButton, filteredRecipes.length === 0 && styles.shuffleButtonDisabled]}
          activeOpacity={0.7}
        >
          <Shuffle size={24} color={filteredRecipes.length === 0 ? colors.outline : colors.onPrimary} />
          <Text style={[styles.shuffleButtonText, filteredRecipes.length === 0 && styles.shuffleButtonTextDisabled]}>
            Sorpréndeme
          </Text>
        </TouchableOpacity>
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Recipes List */}
      {!loading && filteredRecipes.length > 0 && (
        <View style={styles.recipesContainer}>
          <View style={styles.recipesTitleContainer}>
            <Text style={styles.recipesTitle}>
              ✨ Recetas Sugeridas
            </Text>
            <View style={styles.recipesCount}>
              <Text style={styles.recipesCountText}>{filteredRecipes.length}</Text>
            </View>
          </View>
          {filteredRecipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              isFavorite={isFavorite(recipe.id)}
              onToggleFavorite={() => toggleFavorite(recipe)}
              onOpenSteps={() => navigation.navigate('RecipeSteps', { recipe })}
            />
          ))}
        </View>
      )}

      {/* Empty State */}
      {!loading && recipes.length === 0 && !error && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateEmoji}>👨‍🍳</Text>
          <Text style={styles.emptyStateTitle}>¡Listo para cocinar!</Text>
          <Text style={styles.emptyStateText}>
            Configura tus preferencias y obtén recetas mágicas personalizadas ✨
          </Text>
        </View>
      )}
      {!loading && recipes.length > 0 && filteredRecipes.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateEmoji}>🧽</Text>
          <Text style={styles.emptyStateTitle}>Sin resultados</Text>
          <Text style={styles.emptyStateText}>
            Ajusta los filtros para ver más recetas.
          </Text>
        </View>
      )}
      </>
      )}
      </ScrollView>

      {/* Loading Overlay */}
      {showLoadingOverlay && (
        <View style={styles.loadingOverlay}>
          <Card style={styles.loadingCard}>
            <LoadingNeverito size={80} speed={120} />
            <Text style={styles.loadingText}>Generando recetas mágicas...</Text>
            <Text style={styles.loadingSubtext}>
              Neverito está cocinando ideas ✨
            </Text>
          </Card>
        </View>
      )}
    </SafeAreaView>
  );
};

/**
 * RecipeCard Component
 */
interface RecipeCardProps {
  recipe: RecipeUi;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onOpenSteps: () => void;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, isFavorite, onToggleFavorite, onOpenSteps }) => {
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

      <Button
        title="Cocinar paso a paso"
        onPress={onOpenSteps}
        style={styles.stepsButton}
      />
      <TouchableOpacity onPress={onToggleFavorite} style={styles.favoriteButton} activeOpacity={0.7}>
        <Heart
          size={20}
          color={isFavorite ? colors.error : colors.outline}
          fill={isFavorite ? colors.error : 'transparent'}
        />
        <Text style={[styles.favoriteButtonText, isFavorite && styles.favoriteButtonTextActive]}>
          {isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
        </Text>
      </TouchableOpacity>
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
  headerEmoji: {
    fontSize: 28,
  },
  headerSubtitle: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    opacity: 0.9,
  },
  chefContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
    position: 'relative',
  },
  chefImage: {
    width: 80,
    height: 80,
  },
  sparkleEmoji: {
    position: 'absolute',
    top: -8,
    right: '35%',
    fontSize: 24,
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
  filtersCard: {
    marginBottom: spacing.md,
  },
  filtersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  clearFiltersText: {
    ...typography.labelMedium,
    color: colors.primary,
    fontWeight: '600',
  },
  filterGroup: {
    marginBottom: spacing.lg,
  },
  filtersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filtersEmptyText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
  },
  filterChipSelected: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  filterChipText: {
    ...typography.labelMedium,
    color: colors.onSurface,
  },
  filterChipTextSelected: {
    color: colors.onPrimaryContainer,
    fontWeight: '600',
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
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  timeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.primary,
    gap: spacing.xs,
  },
  timeEmoji: {
    fontSize: 24,
  },
  timeValue: {
    ...typography.titleLarge,
    fontWeight: 'bold',
    color: colors.onSurface,
  },
  timeUnit: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
  },
  utensilChipSelected: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  utensilEmoji: {
    fontSize: 16,
  },
  utensilChipText: {
    ...typography.labelMedium,
    color: colors.onSurface,
  },
  utensilChipTextSelected: {
    color: colors.onPrimaryContainer,
    fontWeight: '600',
  },
  mainButtonsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  getRecipesButton: {
    flex: 1,
  },
  shuffleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  shuffleButtonDisabled: {
    backgroundColor: colors.surfaceVariant,
    shadowOpacity: 0,
    elevation: 0,
  },
  shuffleButtonText: {
    ...typography.labelMedium,
    color: colors.onPrimary,
    fontWeight: '600',
  },
  shuffleButtonTextDisabled: {
    color: colors.outline,
  },
  debugButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    padding: spacing.lg,
    backgroundColor: colors.errorContainer,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
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
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFE5EC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    zIndex: 1000,
  },
  loadingCard: {
    alignItems: 'center',
    padding: spacing.xl,
    minWidth: 280,
    backgroundColor: '#B5EAD7',
  },
  loadingText: {
    ...typography.titleMedium,
    fontWeight: '700',
    color: colors.onSurface,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  loadingSubtext: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  recipesContainer: {
    marginBottom: spacing.xl,
  },
  recipesTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  recipesTitle: {
    ...typography.titleLarge,
    fontSize: 20,
    fontWeight: '700',
    color: colors.onSurface,
  },
  recipesCount: {
    backgroundColor: colors.primaryContainer,
    borderRadius: borderRadius.full,
    minWidth: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  recipesCountText: {
    ...typography.labelMedium,
    fontWeight: 'bold',
    color: colors.onPrimaryContainer,
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
  stepsButton: {
    marginTop: spacing.sm,
  },
  favoriteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    marginTop: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
  },
  favoriteButtonText: {
    ...typography.labelMedium,
    color: colors.onSurfaceVariant,
  },
  favoriteButtonTextActive: {
    color: colors.error,
    fontWeight: '600',
  },
  favoritesButton: {
    padding: 4,
  },
  addFromUrlButton: {
    padding: 4,
    marginLeft: 8,
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
  },
  // --- Mode Switch ---
  modeSwitchContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.full,
    padding: 4,
    marginBottom: spacing.md,
  },
  modeSwitchTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    alignItems: 'center',
  },
  modeSwitchTabActive: {
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modeSwitchText: {
    ...typography.labelMedium,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  modeSwitchTextActive: {
    color: colors.onSurface,
    fontWeight: '700',
  },
  // --- URL Mode ---
  urlInputCard: {
    marginBottom: spacing.md,
  },
  urlSubtitle: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.md,
  },
  urlInputRow: {
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
  urlInput: {
    flex: 1,
    ...typography.bodyMedium,
    color: colors.onSurface,
  },
  urlErrorCard: {
    backgroundColor: colors.errorContainer,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  urlLoadingCard: {
    alignItems: 'center',
    padding: spacing.xl,
    marginBottom: spacing.md,
  },
  urlResultCard: {
    marginBottom: spacing.md,
  },
  urlRecipeHeader: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  urlRecipeEmoji: {
    fontSize: 48,
  },
  urlRecipeTitle: {
    ...typography.titleLarge,
    fontWeight: '700',
    color: colors.onSurface,
    marginBottom: spacing.xs,
  },
  urlRecipeSource: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  urlMatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryContainer,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
  },
  urlMatchText: {
    ...typography.labelMedium,
    fontWeight: '700',
    color: colors.onPrimaryContainer,
  },
  urlIngredientsCard: {
    marginBottom: spacing.md,
  },
  urlIngredientGroup: {
    marginBottom: spacing.md,
  },
  urlIngredientGroupTitle: {
    ...typography.labelLarge,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  urlIngredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  urlIngredientText: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    flex: 1,
  },
  urlStepsCard: {
    marginBottom: spacing.md,
  },
  urlStepRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  urlStepNumber: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  urlStepNumberText: {
    ...typography.labelMedium,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  urlStepText: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    flex: 1,
  },
});

export default RecipesProScreen;
