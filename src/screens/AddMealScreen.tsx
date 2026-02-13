import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { startOfDay } from 'date-fns';
import { RootStackParamList } from '../types';
import { colors, typography, spacing } from '../theme';
import { borderRadius } from '../theme/spacing';
import { DatePicker } from '../components/common/DatePicker';
import { Button } from '../components/common/Button';
import { MealTypeSelector, MealType } from '../components/meals/MealTypeSelector';
import { IngredientPicker } from '../components/meals/IngredientPicker';
import { useInventory } from '../hooks/useInventory';
import { useMealStore } from '../stores/useMealStore';

type AddMealNavigationProp = StackNavigationProp<RootStackParamList, 'AddMeal'>;
type AddMealRouteProp = RouteProp<RootStackParamList, 'AddMeal'>;

interface Props {
  navigation: AddMealNavigationProp;
  route: AddMealRouteProp;
}

const AddMealScreen: React.FC<Props> = ({ navigation, route }) => {
  const { items, updateItem, deleteItem } = useInventory();
  const { addMeal } = useMealStore();

  const prefillIngredientIds = route.params?.prefillIngredientIds ?? [];
  const prefillName = route.params?.prefillName ?? '';
  const prefillMealType = route.params?.prefillMealType ?? 'lunch';
  const prefillConsumedAt = route.params?.prefillConsumedAt
    ? new Date(route.params.prefillConsumedAt)
    : new Date();

  const [mealType, setMealType] = useState<MealType>(prefillMealType);
  const [mealDate, setMealDate] = useState<Date>(startOfDay(prefillConsumedAt));
  const [mealTime, setMealTime] = useState<Date>(prefillConsumedAt);
  const [customName, setCustomName] = useState(prefillName);
  const [selectedIds, setSelectedIds] = useState<string[]>(prefillIngredientIds);
  const [notes, setNotes] = useState('');
  const [calories, setCalories] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds]
  );

  useEffect(() => {
    if (selectedItems.length === 1 && customName.trim() === '') {
      setCustomName(selectedItems[0].name);
    }
  }, [selectedItems, customName]);

  const handleSave = async () => {
    if (selectedIds.length === 0 && customName.trim() === '') {
      Alert.alert('Faltan datos', 'Selecciona ingredients o escribe un nombre.');
      return;
    }

    const combinedDate = new Date(mealDate);
    combinedDate.setHours(mealTime.getHours(), mealTime.getMinutes(), 0, 0);

    setSaving(true);
    try {
      await addMeal({
        mealType,
        mealDate: startOfDay(mealDate).getTime(),
        customName: customName.trim() || undefined,
        ingredientsConsumed: selectedIds,
        notes: notes.trim() || undefined,
        caloriesEstimate: calories ? Number(calories) : undefined,
        consumedAt: combinedDate.getTime(),
      });

      for (const item of selectedItems) {
        const newQuantity = item.quantity - 1;
        if (newQuantity <= 0) {
          await deleteItem(item.id);
        } else {
          await updateItem(item.id, { quantity: newQuantity });
        }
      }

      Alert.alert('Guardado', 'Comida registrada correctamente', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Registrar comida</Text>

        <Text style={styles.sectionLabel}>Tipo de comida</Text>
        <MealTypeSelector value={mealType} onChange={setMealType} />

        <DatePicker label="Fecha" value={mealDate} onChange={setMealDate} />

        <View style={styles.timeContainer}>
          <Text style={styles.sectionLabel}>Hora</Text>
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => setShowTimePicker(true)}
          >
            <Text style={styles.timeButtonText}>
              {mealTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>
          {showTimePicker && (
            <DateTimePicker
              value={mealTime}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_event, selected) => {
                setShowTimePicker(Platform.OS === 'ios');
                if (selected) setMealTime(selected);
              }}
            />
          )}
        </View>

        <IngredientPicker
          items={items}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
        />

        <View style={styles.inputGroup}>
          <Text style={styles.sectionLabel}>Nombre (opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Pasta con pollo"
            value={customName}
            onChangeText={setCustomName}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.sectionLabel}>Calorias estimadas (opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: 450"
            keyboardType="number-pad"
            value={calories}
            onChangeText={setCalories}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.sectionLabel}>Notas (opcional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Detalles de la comida"
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </View>

        <Button
          title={saving ? 'Saving...' : 'Save comida'}
          onPress={handleSave}
          disabled={saving}
        />
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
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.headlineSmall,
    color: colors.onSurface,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.labelMedium,
    color: colors.onSurface,
    marginBottom: spacing.xs,
  },
  timeContainer: {
    marginBottom: spacing.md,
  },
  timeButton: {
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    minHeight: 48,
    justifyContent: 'center',
  },
  timeButtonText: {
    ...typography.bodyLarge,
    color: colors.onSurface,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    color: colors.onSurface,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
});

export default AddMealScreen;
