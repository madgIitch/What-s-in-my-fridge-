import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../../theme';
import { borderRadius } from '../../theme/spacing';

interface IngredientSummary {
  name: string;
  count: number;
}

interface DaySummaryProps {
  mealsCount: number;
  ingredients: IngredientSummary[];
}

export const DaySummary: React.FC<DaySummaryProps> = ({ mealsCount, ingredients }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Resumen del dia</Text>
      <Text style={styles.subtitle}>{mealsCount} comida(s) registrada(s)</Text>
      {ingredients.length === 0 ? (
        <Text style={styles.empty}>Sin ingredientes registrados</Text>
      ) : (
        <View style={styles.list}>
          {ingredients.slice(0, 4).map((ingredient) => (
            <Text key={ingredient.name} style={styles.item}>
              • {ingredient.name} x{ingredient.count}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  title: {
    ...typography.titleSmall,
    color: colors.onSurface,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.sm,
  },
  empty: {
    ...typography.bodySmall,
    color: colors.outline,
  },
  list: {
    gap: spacing.xs,
  },
  item: {
    ...typography.bodySmall,
    color: colors.onSurface,
  },
});
