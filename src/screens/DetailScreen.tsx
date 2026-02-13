import React, { useState, useEffect } from 'react';
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
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, FOOD_CATEGORIES, FOOD_UNITS } from '../types';
import { useInventory } from '../hooks/useInventory';
import { collections } from '../database';
import FoodItem from '../database/models/FoodItem';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { DatePicker } from '../components/common/DatePicker';
import { Picker } from '../components/common/Picker';
import { LoadingNeverito } from '../components/common';
import { colors, typography, spacing } from '../theme';
import { borderRadius } from '../theme/spacing';

type DetailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Detail'>;
type DetailScreenRouteProp = RouteProp<RootStackParamList, 'Detail'>;

interface Props {
  navigation: DetailScreenNavigationProp;
  route: DetailScreenRouteProp;
}

const DetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { itemId } = route.params;
  const { updateItem, deleteItem, loading: actionLoading } = useInventory();

  const [item, setItem] = useState<FoodItem | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<string>('unidad');
  const [category, setCategory] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState(new Date());
  const [notes, setNotes] = useState('');

  // Validation errors
  const [nameError, setNameError] = useState('');
  const [quantityError, setQuantityError] = useState('');

  // Load item data
  useEffect(() => {
    loadItem();
  }, [itemId]);

  const loadItem = async () => {
    try {
      const fetchedItem = await collections.foodItems.find(itemId);
      setItem(fetchedItem);

      // Populate form
      setName(fetchedItem.name);
      setQuantity(fetchedItem.quantity.toString());
      setUnit(fetchedItem.unit);
      setCategory(fetchedItem.category || '');
      setExpiryDate(new Date(fetchedItem.expiryDate));
      setNotes(fetchedItem.notes || '');
    } catch (error) {
      Alert.alert('Error', 'Could not load item');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

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

  const handleSave = async () => {
    if (!validate()) return;

    try {
      await updateItem(itemId, {
        name: name.trim(),
        expiryDate: expiryDate.getTime(),
        category: category || undefined,
        quantity: parseInt(quantity),
        notes: notes.trim() || undefined,
        unit,
      });

      Alert.alert('Éxito', 'Item actualizado correctamente', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item?.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteItem(itemId);
              navigation.goBack();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingNeverito size={80} speed={120} />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  const categoryOptions = [
    { label: 'Uncategorized', value: '' },
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
        <View style={styles.header}>
          <Text style={styles.title}>Editar Item</Text>
          {item && (
            <View
              style={[
                styles.expiryBadge,
                {
                  backgroundColor:
                    item.expiryState === 'EXPIRED'
                      ? colors.expiryExpired
                      : item.expiryState === 'SOON'
                      ? colors.expirySoon
                      : colors.expiryOk,
                },
              ]}
            >
              <Text style={styles.expiryText}>
                {item.expiryState === 'EXPIRED'
                  ? 'EXPIRADO'
                  : item.expiryState === 'SOON'
                  ? `${item.daysLeft} days`
                  : `${item.daysLeft} days`}
              </Text>
            </View>
          )}
        </View>

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
            editable={!actionLoading}
          />

          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Input
                label="Quantity *"
                value={quantity}
                onChangeText={(text) => {
                  setQuantity(text);
                  setQuantityError('');
                }}
                error={quantityError}
                placeholder="1"
                keyboardType="numeric"
                editable={!actionLoading}
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
            label="Expiration Date *"
            value={expiryDate}
            onChange={setExpiryDate}
            minimumDate={new Date()}
          />

          <Picker
            label="Category"
            value={category}
            options={categoryOptions}
            onChange={setCategory}
            placeholder="Select category"
          />

          <Input
            label="Notas (Opcional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Ej: Comprado en Mercadona"
            multiline
            numberOfLines={3}
            editable={!actionLoading}
            style={styles.notesInput}
          />

          <View style={styles.metadata}>
            <Text style={styles.metadataText}>
              Added: {item && new Date(item.addedAt).toLocaleDateString()}
            </Text>
            <Text style={styles.metadataText}>
              Fuente: {item?.source === 'ocr' ? '📸 OCR' : '✏️ Manual'}
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <Button
              title="Delete"
              onPress={handleDelete}
              variant="text"
              disabled={actionLoading}
              style={styles.deleteButton}
              textStyle={styles.deleteButtonText}
            />
            <Button
              title="Save Changes"
              onPress={handleSave}
              loading={actionLoading}
              style={styles.saveButton}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#B5EAD7',
  },
  loadingText: {
    ...typography.bodyLarge,
    color: colors.onSurfaceVariant,
    marginTop: spacing.md,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.headlineSmall,
    color: colors.onSurface,
  },
  expiryBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
  },
  expiryText: {
    ...typography.labelMedium,
    color: colors.onPrimary,
    fontWeight: 'bold',
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
  metadata: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  metadataText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  deleteButton: {
    flex: 1,
  },
  deleteButtonText: {
    color: colors.error,
  },
  saveButton: {
    flex: 2,
  },
});

export default DetailScreen;
