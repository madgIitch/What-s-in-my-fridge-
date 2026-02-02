import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { addMonths, format, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { RootStackParamList } from '../types';
import { colors, typography, spacing } from '../theme';
import { CalendarGrid } from '../components/meals/CalendarGrid';
import { DaySummary } from '../components/meals/DaySummary';
import { MealCard } from '../components/meals/MealCard';
import { KawaiiFAB } from '../components/common/KawaiiFAB';
import { Plus, ArrowLeft } from 'lucide-react-native';
import { useMealStore } from '../stores/useMealStore';
import { useInventory } from '../hooks/useInventory';
import { borderRadius } from '../theme/spacing';

type CalendarScreenNavigationProp = StackNavigationProp<RootStackParamList, 'CalendarTab'>;

interface Props {
  navigation: CalendarScreenNavigationProp;
}

const CalendarScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [monthDate, setMonthDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const { meals, initMonth, getMealsByDate } = useMealStore();
  const { items } = useInventory();

  useEffect(() => {
    initMonth(monthDate);
  }, [monthDate, initMonth]);

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
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFE5EC" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
      >
        <View style={styles.heroHeader}>
          <View style={styles.heroHeaderContent}>
            <View style={styles.heroHeaderLeft}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.backButton}
                activeOpacity={0.7}
              >
                <ArrowLeft size={22} color={colors.onSurface} />
              </TouchableOpacity>
              <View style={styles.heroTitleBlock}>
                <Text style={styles.heroTitle}>Calendario</Text>
                <Text style={styles.heroSubtitle}>Registra tus comidas</Text>
              </View>
              <Image
                source={require('../../assets/neveritoCalendar.png')}
                style={styles.heroImage}
                resizeMode="contain"
              />
            </View>
          </View>
        </View>
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
    backgroundColor: '#FFE5EC',
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  heroHeader: {
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
    marginHorizontal: -spacing.lg,
    marginBottom: spacing.lg,
  },
  heroHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFE5EC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.outlineVariant,
  },
  heroTitle: {
    ...typography.headlineLarge,
    fontSize: 32,
    fontWeight: '800',
    color: colors.onSurface,
  },
  heroTitleBlock: {
    flexDirection: 'column',
    gap: 4,
  },
  heroImage: {
    width: 44,
    height: 44,
  },
  heroSubtitle: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    opacity: 0.9,
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
