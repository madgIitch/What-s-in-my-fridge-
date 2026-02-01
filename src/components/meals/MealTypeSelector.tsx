import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, typography, spacing } from '../../theme';
import { borderRadius } from '../../theme/spacing';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const options: { label: string; value: MealType }[] = [
  { label: 'Desayuno', value: 'breakfast' },
  { label: 'Almuerzo', value: 'lunch' },
  { label: 'Cena', value: 'dinner' },
  { label: 'Snack', value: 'snack' },
];

interface MealTypeSelectorProps {
  value: MealType;
  onChange: (value: MealType) => void;
}

export const MealTypeSelector: React.FC<MealTypeSelectorProps> = ({ value, onChange }) => {
  return (
    <View style={styles.container}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[styles.chip, selected && styles.chipSelected]}
            onPress={() => onChange(option.value)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 2,
    borderColor: colors.outlineVariant,
  },
  chipSelected: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: colors.onPrimaryContainer,
  },
});
