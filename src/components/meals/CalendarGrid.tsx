import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { addDays, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, startOfDay } from 'date-fns';
import { colors, typography, spacing } from '../../theme';
import { borderRadius } from '../../theme/spacing';

interface CalendarGridProps {
  monthDate: Date;
  selectedDate: Date;
  daysWithMeals: Set<number>;
  onSelectDate: (date: Date) => void;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  monthDate,
  selectedDate,
  daysWithMeals,
  onSelectDate,
}) => {
  const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });

  const days: Date[] = [];
  let cursor = start;
  while (cursor <= end) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  const weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  return (
    <View style={styles.container}>
      <View style={styles.weekHeader}>
        {weekDays.map((label) => (
          <Text key={label} style={styles.weekDayLabel}>
            {label}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {days.map((day) => {
          const isCurrentMonth = isSameMonth(day, monthDate);
          const isSelected = isSameDay(day, selectedDate);
          const dayKey = startOfDay(day).getTime();
          const hasMeals = daysWithMeals.has(dayKey);

          return (
            <TouchableOpacity
              key={dayKey}
              style={[
                styles.dayCell,
                !isCurrentMonth && styles.dayCellMuted,
                isSelected && styles.dayCellSelected,
              ]}
              onPress={() => onSelectDate(day)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.dayText,
                  !isCurrentMonth && styles.dayTextMuted,
                  isSelected && styles.dayTextSelected,
                ]}
              >
                {format(day, 'd')}
              </Text>
              {hasMeals && <View style={styles.dot} />}
            </TouchableOpacity>
          );
        })}
      </View>
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
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  weekDayLabel: {
    ...typography.labelSmall,
    color: colors.onSurfaceVariant,
    width: 32,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  dayCell: {
    width: 32,
    height: 36,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceVariant,
  },
  dayCellMuted: {
    backgroundColor: colors.surface,
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
  },
  dayText: {
    ...typography.labelMedium,
    color: colors.onSurface,
  },
  dayTextMuted: {
    color: colors.outline,
  },
  dayTextSelected: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.secondary,
    marginTop: 2,
  },
});
