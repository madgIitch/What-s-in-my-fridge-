import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { format } from 'date-fns';
import { colors, typography, spacing } from '../../theme';
import { borderRadius } from '../../theme/spacing';
import MealEntry from '../../database/models/MealEntry';

const mealTypeLabels: Record<string, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  dinner: 'Cena',
  snack: 'Snack',
};

interface MealCardProps {
  meal: MealEntry;
  onPress?: () => void;
}

export const MealCard: React.FC<MealCardProps> = ({ meal, onPress }) => {
  const title = meal.customName || meal.recipeId || 'Comida registrada';
  const timeLabel = format(new Date(meal.consumedAt), 'HH:mm');

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
      disabled={!onPress}
    >
      <View style={styles.header}>
        <Text style={styles.mealType}>{mealTypeLabels[meal.mealType] || meal.mealType}</Text>
        <Text style={styles.time}>{timeLabel}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.meta}>
        {meal.ingredientsConsumedArray.length} ingrediente(s)
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  mealType: {
    ...typography.labelLarge,
    color: colors.primary,
    fontWeight: '700',
  },
  time: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  title: {
    ...typography.bodyLarge,
    color: colors.onSurface,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  meta: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
});
