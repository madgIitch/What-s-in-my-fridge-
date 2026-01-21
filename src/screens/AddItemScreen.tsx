import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, FOOD_CATEGORIES, FOOD_UNITS } from '../types';
import { useInventory } from '../hooks/useInventory';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { DatePicker } from '../components/common/DatePicker';
import { Picker } from '../components/common/Picker';
import { colors, typography, spacing } from '../theme';
import { addDays } from 'date-fns';

type AddItemScreenNavigationProp = StackNavigationProp<RootStackParamList, 'AddItem'>;

interface Props {
  navigation: AddItemScreenNavigationProp;
}

const AddItemScreen: React.FC<Props> = ({ navigation }) => {
  const { addItem, loading } = useInventory();

  // Form state
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<string>('unidad');
  const [category, setCategory] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState(addDays(new Date(), 7)); // Default 7 days from now
  const [notes, setNotes] = useState('');

  // Validation errors
  const [nameError, setNameError] = useState('');
  const [quantityError, setQuantityError] = useState('');

  const validate = () => {
    let valid = true;

    setNameError('');
    setQuantityError('');

    if (!name.trim()) {
      setNameError('El nombre es requerido');
      valid = false;
    }

    const quantityNum = parseInt(quantity);
    if (!quantity.trim() || isNaN(quantityNum) || quantityNum <= 0) {
      setQuantityError('La cantidad debe ser mayor a 0');
      valid = false;
    }

    return valid;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      await addItem({
        name: name.trim(),
        expiryDate: expiryDate.getTime(),
        category: category || undefined,
        quantity: parseInt(quantity),
        notes: notes.trim() || undefined,
        unit,
        source: 'manual',
      });

      Alert.alert('Éxito', 'Item añadido correctamente', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const categoryOptions = [
    { label: 'Sin categoría', value: '' },
    ...FOOD_CATEGORIES.map((cat) => ({ label: cat, value: cat })),
  ];

  const unitOptions = FOOD_UNITS.map((u) => ({ label: u, value: u }));

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Añadir Nuevo Item</Text>
        <Text style={styles.subtitle}>Completa los datos del alimento</Text>

        <View style={styles.form}>
          <Input
            label="Nombre del Alimento *"
            value={name}
            onChangeText={(text) => {
              setName(text);
              setNameError('');
            }}
            error={nameError}
            placeholder="Ej: Leche, Manzanas, etc."
            editable={!loading}
          />

          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Input
                label="Cantidad *"
                value={quantity}
                onChangeText={(text) => {
                  setQuantity(text);
                  setQuantityError('');
                }}
                error={quantityError}
                placeholder="1"
                keyboardType="numeric"
                editable={!loading}
              />
            </View>

            <View style={styles.halfWidth}>
              <Picker
                label="Unidad"
                value={unit}
                options={unitOptions}
                onChange={setUnit}
              />
            </View>
          </View>

          <DatePicker
            label="Fecha de Expiración *"
            value={expiryDate}
            onChange={setExpiryDate}
            minimumDate={new Date()}
          />

          <Picker
            label="Categoría"
            value={category}
            options={categoryOptions}
            onChange={setCategory}
            placeholder="Seleccionar categoría"
          />

          <Input
            label="Notas (Opcional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Ej: Comprado en Mercadona"
            multiline
            numberOfLines={3}
            editable={!loading}
            style={styles.notesInput}
          />

          <View style={styles.buttonContainer}>
            <Button
              title="Cancelar"
              onPress={() => navigation.goBack()}
              variant="text"
              disabled={loading}
              style={styles.cancelButton}
            />
            <Button
              title="Añadir Item"
              onPress={handleSubmit}
              loading={loading}
              style={styles.submitButton}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  title: {
    ...typography.headlineSmall,
    color: colors.onSurface,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.xl,
  },
  form: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfWidth: {
    flex: 1,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  cancelButton: {
    flex: 1,
  },
  submitButton: {
    flex: 2,
  },
});

export default AddItemScreen;
