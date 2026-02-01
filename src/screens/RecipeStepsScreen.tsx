import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { ArrowLeft, Heart } from 'lucide-react-native';
import { RootStackParamList } from '../types';
import { colors, typography, spacing } from '../theme';
import { borderRadius } from '../theme/spacing';
import { Card } from '../components/common/Card';
import { useFavorites } from '../hooks/useFavorites';

type RecipeStepsNavigationProp = StackNavigationProp<RootStackParamList, 'RecipeSteps'>;
type RecipeStepsRouteProp = RouteProp<RootStackParamList, 'RecipeSteps'>;

interface Props {
  navigation: RecipeStepsNavigationProp;
  route: RecipeStepsRouteProp;
}

const splitInstructions = (instructions: string | string[] | undefined): string[] => {
  // If instructions is already an array, return it directly
  if (Array.isArray(instructions)) {
    return instructions.filter((step) => step && step.trim().length > 0);
  }

  // If instructions is not a string or is empty, return empty array
  if (!instructions || typeof instructions !== 'string') {
    return [];
  }

  const cleaned = instructions.replace(/\r\n/g, '\n').trim();
  if (!cleaned) return [];

  if (cleaned.includes('\n')) {
    return cleaned
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  if (/\d+\s*[\).\:-]\s+/.test(cleaned)) {
    return cleaned
      .split(/\s*(?:^|\s)\d+[\).\:-]\s+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  return [cleaned];
};

const RecipeStepsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { recipe } = route.params;
  const { isFavorite, toggleFavorite } = useFavorites();

  const matchedIngredients = Array.isArray(recipe.matchedIngredients)
    ? recipe.matchedIngredients
    : [];
  const missingIngredients = Array.isArray(recipe.missingIngredients)
    ? recipe.missingIngredients
    : [];
  const ingredientsWithMeasures = Array.isArray(recipe.ingredientsWithMeasures)
    ? recipe.ingredientsWithMeasures
    : [];

  const steps = useMemo(() => splitInstructions(recipe.instructions), [recipe.instructions]);
  const isRecipeFavorite = isFavorite(recipe.id);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <ArrowLeft size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={2}>
          {recipe.name}
        </Text>
        <TouchableOpacity
          onPress={() => toggleFavorite(recipe)}
          style={styles.favoriteButton}
          activeOpacity={0.7}
        >
          <Heart
            size={24}
            color={isRecipeFavorite ? colors.error : colors.outline}
            fill={isRecipeFavorite ? colors.error : 'transparent'}
          />
        </TouchableOpacity>
        <View style={styles.matchBadge}>
          <Text style={styles.matchEmoji}>Match</Text>
          <Text style={styles.matchText}>{recipe.matchPercentage}%</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Card style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Resumen rapido</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryEmoji}>OK</Text>
            <Text style={styles.summaryText}>
              {matchedIngredients.length} ingredientes disponibles
            </Text>
          </View>
          {missingIngredients.length > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryEmoji}>Falta</Text>
              <Text style={styles.summaryText}>
                {missingIngredients.length} ingredientes faltantes
              </Text>
            </View>
          )}
          {missingIngredients.length === 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryEmoji}>Todo</Text>
              <Text style={styles.summaryText}>Tienes todo lo necesario</Text>
            </View>
          )}
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Ingredientes</Text>
          {ingredientsWithMeasures.length > 0 ? (
            <View style={styles.list}>
              {ingredientsWithMeasures.map((ing, index) => (
                <View key={`measure-${index}`} style={styles.listRow}>
                  <Text style={styles.listBullet}>-</Text>
                  <Text style={styles.listText}>{ing}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No se encontraron cantidades detalladas.</Text>
          )}

          {(matchedIngredients.length > 0 || missingIngredients.length > 0) && (
            <View style={styles.statusBlock}>
              {matchedIngredients.map((ing, index) => (
                <View key={`matched-${index}`} style={styles.listRow}>
                  <Text style={styles.statusEmoji}>OK</Text>
                  <Text style={styles.listText}>{ing}</Text>
                </View>
              ))}
              {missingIngredients.map((ing, index) => (
                <View key={`missing-${index}`} style={styles.listRow}>
                  <Text style={styles.statusEmoji}>Falta</Text>
                  <Text style={[styles.listText, styles.missingText]}>{ing}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Paso a paso</Text>
          {steps.length > 0 ? (
            <View style={styles.stepsList}>
              {steps.map((step, index) => (
                <View key={`step-${index}`} style={styles.stepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No hay instrucciones detalladas para esta receta.</Text>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFE5EC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  backButton: {
    padding: 4,
    marginRight: 4,
  },
  headerTitle: {
    ...typography.titleLarge,
    color: colors.onSurface,
    flex: 1,
    fontWeight: '800',
  },
  favoriteButton: {
    padding: 4,
    marginRight: 8,
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 107, 157, 0.12)',
    borderWidth: 2,
    borderColor: 'rgba(255, 107, 157, 0.3)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  matchEmoji: {
    fontSize: 14,
  },
  matchText: {
    ...typography.labelSmall,
    fontSize: 12,
    color: '#FF6B9D',
    fontWeight: 'bold',
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  summaryCard: {
    marginBottom: spacing.md,
    backgroundColor: '#B5EAD7',
  },
  sectionCard: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  summaryEmoji: {
    fontSize: 18,
  },
  summaryText: {
    ...typography.bodyMedium,
    color: colors.onSurface,
  },
  list: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  listBullet: {
    fontSize: 16,
    color: colors.primary,
    width: 20,
  },
  listText: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    flex: 1,
  },
  statusBlock: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  statusEmoji: {
    fontSize: 18,
    width: 20,
  },
  missingText: {
    color: colors.onSurfaceVariant,
  },
  stepsList: {
    gap: spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    ...typography.labelMedium,
    color: colors.onPrimary,
    fontWeight: '700',
  },
  stepText: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    flex: 1,
    lineHeight: 20,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
});

export default RecipeStepsScreen;
