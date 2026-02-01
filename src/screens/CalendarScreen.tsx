import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { addMonths, format, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { RootStackParamList } from '../types';
import { colors, typography, spacing } from '../theme';
import { CalendarGrid } from '../components/meals/CalendarGrid';
import { DaySummary } from '../components/meals/DaySummary';
import { MealCard } from '../components/meals/MealCard';
import { KawaiiFAB } from '../components/common/KawaiiFAB';
import { Plus } from 'lucide-react-native';
import { useMealStore } from '../stores/useMealStore';
import { useInventory } from '../hooks/useInventory';
import { useAuthStore } from '../stores/useAuthStore';
import { borderRadius } from '../theme/spacing';

type CalendarScreenNavigationProp = StackNavigationProp<RootStackParamList, 'CalendarTab'>;

interface Props {
  navigation: CalendarScreenNavigationProp;
}

const CalendarScreen: React.FC<Props> = ({ navigation }) => {
  const [monthDate, setMonthDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const { meals, initMonth, getMealsByDate, startSync, stopSync } = useMealStore();
  const { items } = useInventory();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    initMonth(monthDate);
  }, [monthDate, initMonth]);

  useEffect(() => {
    if (user?.uid) {
      startSync(user.uid);
      return () => stopSync();
    }
    return undefined;
  }, [user?.uid, startSync, stopSync]);

  const mealsForDay = getMealsByDate(selectedDate);
  const daysWithMeals = useMemo(() => new Set(meals.map((meal) => meal.mealDate)), [meals]);

  const ingredientSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const meal of mealsForDay) {
      for (const id of meal.ingredientsConsumedArray) {
        counts[id] = (counts[id] || 0) + 1;
      }
    }
    const nameMap = new Map(items.map((item) => [item.id, item.name]));
    return Object.entries(counts)
      .map(([id, count]) => ({
        name: nameMap.get(id) || 'Ingrediente',
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [items, mealsForDay]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => setMonthDate(addMonths(monthDate, -1))}
          >
            <Text style={styles.navButtonText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>
            {format(monthDate, 'MMMM yyyy', { locale: es })}
          </Text>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => setMonthDate(addMonths(monthDate, 1))}
          >
            <Text style={styles.navButtonText}>›</Text>
          </TouchableOpacity>
        </View>

        <CalendarGrid
          monthDate={monthDate}
          selectedDate={selectedDate}
          daysWithMeals={daysWithMeals}
          onSelectDate={(date) => setSelectedDate(startOfDay(date))}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {format(selectedDate, 'PPP', { locale: es })}
          </Text>
          <DaySummary mealsCount={mealsForDay.length} ingredients={ingredientSummary} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Comidas del dia</Text>
          <View style={styles.mealList}>
            {mealsForDay.length === 0 ? (
              <Text style={styles.emptyText}>No hay comidas registradas</Text>
            ) : (
              mealsForDay.map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  onPress={() => navigation.navigate('MealDetail', { mealId: meal.id })}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>

      <View style={styles.fabContainer}>
        <KawaiiFAB
          icon={<Plus size={26} color={colors.onPrimary} />}
          onPress={() => navigation.navigate('AddMeal', { prefillConsumedAt: Date.now() })}
          size="large"
          pulse
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  monthTitle: {
    ...typography.titleLarge,
    color: colors.onSurface,
    textTransform: 'capitalize',
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonText: {
    ...typography.titleLarge,
    color: colors.onSurface,
  },
  section: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.onSurface,
    fontWeight: '700',
  },
  mealList: {
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.bodyMedium,
    color: colors.outline,
  },
  fabContainer: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
  },
});

export default CalendarScreen;
