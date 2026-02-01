import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { format } from 'date-fns';
import { RootStackParamList } from '../types';
import { colors, typography, spacing } from '../theme';
import { borderRadius } from '../theme/spacing';
import { Button } from '../components/common/Button';
import MealEntry from '../database/models/MealEntry';
import { collections } from '../database';
import { useMealStore } from '../stores/useMealStore';

type MealDetailNavigationProp = StackNavigationProp<RootStackParamList, 'MealDetail'>;
type MealDetailRouteProp = RouteProp<RootStackParamList, 'MealDetail'>;

interface Props {
  navigation: MealDetailNavigationProp;
  route: MealDetailRouteProp;
}

const MealDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { mealId } = route.params;
  const { deleteMeal } = useMealStore();
  const [meal, setMeal] = useState<MealEntry | null>(null);

  useEffect(() => {
    const load = async () => {
      const entry = await collections.mealEntries.find(mealId).catch(() => null);
      setMeal(entry);
    };
    load();
  }, [mealId]);

  const handleDelete = async () => {
    Alert.alert('Eliminar comida', '¿Seguro que quieres eliminar esta comida?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMeal(mealId);
            navigation.goBack();
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  if (!meal) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loading}>Cargando...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{meal.customName || 'Comida registrada'}</Text>
        <Text style={styles.subtitle}>
          {format(new Date(meal.consumedAt), 'PPP p')}
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Tipo</Text>
          <Text style={styles.cardValue}>{meal.mealType}</Text>
          <Text style={styles.cardLabel}>Ingredientes</Text>
          <Text style={styles.cardValue}>{meal.ingredientsConsumedArray.length} item(s)</Text>
          {meal.notes ? (
            <>
              <Text style={styles.cardLabel}>Notas</Text>
              <Text style={styles.cardValue}>{meal.notes}</Text>
            </>
          ) : null}
        </View>

        <Button title="Eliminar comida" variant="secondary" onPress={handleDelete} />
      </ScrollView>
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
    gap: spacing.md,
  },
  loading: {
    ...typography.bodyLarge,
    color: colors.onSurface,
    padding: spacing.lg,
  },
  title: {
    ...typography.headlineSmall,
    color: colors.onSurface,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    gap: spacing.xs,
  },
  cardLabel: {
    ...typography.labelSmall,
    color: colors.onSurfaceVariant,
  },
  cardValue: {
    ...typography.bodyLarge,
    color: colors.onSurface,
  },
});

export default MealDetailScreen;
