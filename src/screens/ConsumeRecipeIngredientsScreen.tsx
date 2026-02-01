import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
  Alert,
  StatusBar,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { ArrowLeft, Minus, Plus, Check } from 'lucide-react-native';
import { RootStackParamList, FOOD_UNITS, FoodUnit } from '../types';
import { colors, typography, spacing } from '../theme';
import { borderRadius } from '../theme/spacing';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { useInventory } from '../hooks/useInventory';
import FoodItem from '../database/models/FoodItem';

type ConsumeRecipeIngredientsNavigationProp = StackNavigationProp<
  RootStackParamList,
  'ConsumeRecipeIngredients'
>;
type ConsumeRecipeIngredientsRouteProp = RouteProp<RootStackParamList, 'ConsumeRecipeIngredients'>;

interface Props {
  navigation: ConsumeRecipeIngredientsNavigationProp;
  route: ConsumeRecipeIngredientsRouteProp;
}

interface IngredientConsumption {
  ingredientName: string;
  measure: string;
  inventoryItem: FoodItem | null;
  consumedAmount: number;
  selectedUnit: FoodUnit;
}

// Convert amount from one unit to another
const convertUnits = (amount: number, fromUnit: FoodUnit, toUnit: FoodUnit): number => {
  if (fromUnit === toUnit) return amount;

  // kg <-> g conversions
  if (fromUnit === 'kg' && toUnit === 'g') return amount * 1000;
  if (fromUnit === 'g' && toUnit === 'kg') return amount / 1000;

  // litros <-> ml conversions
  if (fromUnit === 'litros' && toUnit === 'ml') return amount * 1000;
  if (fromUnit === 'ml' && toUnit === 'litros') return amount / 1000;

  // If units are incompatible, return the amount as-is
  // (user is responsible for correct conversion)
  return amount;
};

const ConsumeRecipeIngredientsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { recipeName, matchedIngredients, ingredientsWithMeasures } = route.params;
  const { items, updateItem, deleteItem, addItem } = useInventory();
  const [consumptions, setConsumptions] = useState<IngredientConsumption[]>([]);
  const [saving, setSaving] = useState(false);
  const [addCookedDish, setAddCookedDish] = useState(true); // Default checked
  const [portions, setPortions] = useState('4'); // Default 4 portions
  const [selectedUnit, setSelectedUnit] = useState<FoodUnit>('porción'); // Default unit
  const [unitPickerVisible, setUnitPickerVisible] = useState(false);
  const [unitPickerTarget, setUnitPickerTarget] = useState<
    { type: 'dish' } | { type: 'ingredient'; index: number } | null
  >(null);

  // Initialize consumptions with matched ingredients
  useEffect(() => {
    const initialConsumptions: IngredientConsumption[] = matchedIngredients.map((ingredientName) => {
      // Find corresponding measure
      const measure = ingredientsWithMeasures.find((m) =>
        m.toLowerCase().includes(ingredientName.toLowerCase())
      ) || '';

      // Find inventory item (by name or normalizedName)
      const inventoryItem = items.find(
        (item) =>
          item.name.toLowerCase() === ingredientName.toLowerCase() ||
          item.normalizedName?.toLowerCase() === ingredientName.toLowerCase()
      ) || null;

      return {
        ingredientName,
        measure,
        inventoryItem,
        consumedAmount: 0,
        selectedUnit: (inventoryItem?.unit as FoodUnit) || 'unidad',
      };
    });

    setConsumptions(initialConsumptions);
  }, [matchedIngredients, ingredientsWithMeasures, items]);

  const handleIncrement = (index: number) => {
    const newConsumptions = [...consumptions];
    const item = newConsumptions[index];

    if (item.inventoryItem && item.consumedAmount < item.inventoryItem.quantity) {
      newConsumptions[index].consumedAmount += 1;
      setConsumptions(newConsumptions);
    }
  };

  const handleDecrement = (index: number) => {
    const newConsumptions = [...consumptions];
    if (newConsumptions[index].consumedAmount > 0) {
      newConsumptions[index].consumedAmount -= 1;
      setConsumptions(newConsumptions);
    }
  };

  const handleCustomAmount = (index: number, value: string) => {
    const newConsumptions = [...consumptions];
    const item = newConsumptions[index];
    const amount = parseFloat(value) || 0;

    const maxQuantity = item.inventoryItem?.quantity || 999;
    if (amount >= 0 && amount <= maxQuantity) {
      newConsumptions[index].consumedAmount = amount;
      setConsumptions(newConsumptions);
    }
  };

  const handleUnitSelection = () => {
    setUnitPickerTarget({ type: 'dish' });
    setUnitPickerVisible(true);
  };

  const handleIngredientUnitSelection = (index: number) => {
    setUnitPickerTarget({ type: 'ingredient', index });
    setUnitPickerVisible(true);
  };

  const handleUnitPick = (unit: FoodUnit) => {
    if (!unitPickerTarget) return;

    if (unitPickerTarget.type === 'dish') {
      setSelectedUnit(unit);
    } else {
      const newConsumptions = [...consumptions];
      newConsumptions[unitPickerTarget.index].selectedUnit = unit;
      setConsumptions(newConsumptions);
    }

    setUnitPickerVisible(false);
    setUnitPickerTarget(null);
  };

  const closeUnitPicker = () => {
    setUnitPickerVisible(false);
    setUnitPickerTarget(null);
  };

  const handleSave = async () => {
    const itemsToUpdate = consumptions.filter(
      (c) => c.consumedAmount > 0 && c.inventoryItem
    );

    if (itemsToUpdate.length === 0) {
      Alert.alert('Sin cambios', 'No has consumido ningún ingrediente');
      return;
    }

    setSaving(true);
    try {
      // 1. Update all consumed ingredients
      for (const consumption of itemsToUpdate) {
        if (!consumption.inventoryItem) continue;

        // Convert consumed amount to inventory unit if needed
        const inventoryUnit = consumption.inventoryItem.unit as FoodUnit;
        const amountInInventoryUnit = convertUnits(
          consumption.consumedAmount,
          consumption.selectedUnit,
          inventoryUnit
        );

        const newQuantity = consumption.inventoryItem.quantity - amountInInventoryUnit;

        if (newQuantity <= 0) {
          // Delete item if fully consumed
          await deleteItem(consumption.inventoryItem.id);
        } else {
          // Update quantity
          await updateItem(consumption.inventoryItem.id, { quantity: newQuantity });
        }
      }

      // 2. Add cooked dish to inventory if checkbox is checked
      if (addCookedDish) {
        const portionsNum = parseInt(portions) || 4;
        const expiryDate = Date.now() + (3 * 24 * 60 * 60 * 1000); // +3 days

        await addItem({
          name: recipeName,
          quantity: portionsNum,
          unit: selectedUnit,
          expiryDate,
          category: 'Platos preparados',
          notes: 'Cocinado desde receta',
          source: 'manual',
        });
      }

      const message = addCookedDish
        ? `Se actualizaron ${itemsToUpdate.length} ingrediente(s) y se añadió "${recipeName}" a tu nevera`
        : `Se actualizaron ${itemsToUpdate.length} ingrediente(s)`;

      const consumedIds = itemsToUpdate
        .map((consumption) => consumption.inventoryItem?.id)
        .filter((id): id is string => Boolean(id));

      Alert.alert(
        '¡Listo! 🎉',
        message,
        [
          {
            text: 'Registrar en calendario',
            onPress: () =>
              navigation.navigate('AddMeal', {
                prefillIngredientIds: consumedIds,
                prefillName: recipeName,
                prefillMealType: 'dinner',
                prefillConsumedAt: Date.now(),
              }),
          },
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  const totalConsumed = consumptions.reduce((sum, c) => sum + c.consumedAmount, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <ArrowLeft size={24} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Marcar como usado</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          Receta: {recipeName} 🍳
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        {/* Summary Card */}
        {totalConsumed > 0 && (
          <Card style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryEmoji}>📊</Text>
              <Text style={styles.summaryText}>
                {totalConsumed} unidad(es) seleccionada(s)
              </Text>
            </View>
          </Card>
        )}

        {/* Instructions Card */}
        <Card style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>💡 Instrucciones</Text>
          <Text style={styles.instructionsText}>
            Marca cuánto usaste de cada ingrediente. Si no usaste algo, déjalo en 0.
          </Text>
        </Card>

        {/* Add Cooked Dish Card */}
        <Card style={styles.cookedDishCard}>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setAddCookedDish(!addCookedDish)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, addCookedDish && styles.checkboxChecked]}>
              {addCookedDish && <Check size={18} color={colors.onPrimary} />}
            </View>
            <Text style={styles.checkboxLabel}>Añadir plato cocinado a mi nevera</Text>
          </TouchableOpacity>

          {addCookedDish && (
            <>
              <View style={styles.portionsRow}>
                <Text style={styles.portionsLabel}>Cantidad:</Text>
                <View style={styles.portionsInputContainer}>
                  <TouchableOpacity
                    onPress={() => {
                      const current = parseInt(portions) || 1;
                      if (current > 1) setPortions((current - 1).toString());
                    }}
                    style={styles.portionsButton}
                    activeOpacity={0.7}
                  >
                    <Minus size={16} color={colors.onPrimary} />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.portionsInput}
                    value={portions}
                    onChangeText={(value) => {
                      const num = parseInt(value) || 0;
                      if (num >= 0 && num <= 99) {
                        setPortions(value);
                      }
                    }}
                    keyboardType="number-pad"
                    selectTextOnFocus
                  />
                  <TouchableOpacity
                    onPress={() => {
                      const current = parseInt(portions) || 0;
                      if (current < 99) setPortions((current + 1).toString());
                    }}
                    style={styles.portionsButton}
                    activeOpacity={0.7}
                  >
                    <Plus size={16} color={colors.onPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.unitSelectorRow}>
                <Text style={styles.portionsLabel}>Unidad:</Text>
                <TouchableOpacity
                  onPress={handleUnitSelection}
                  style={styles.unitSelector}
                  activeOpacity={0.7}
                >
                  <Text style={styles.unitSelectorText}>{selectedUnit}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {addCookedDish && (
            <Text style={styles.cookedDishNote}>
              🍽️ "{recipeName}" se añadirá con {portions} {selectedUnit}, caducidad: {new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString()}
            </Text>
          )}
        </Card>

        {/* Ingredients List */}
        <View style={styles.itemsList}>
          {consumptions.map((consumption, index) => (
            <IngredientCard
              key={`${consumption.ingredientName}-${index}`}
              consumption={consumption}
              onIncrement={() => handleIncrement(index)}
              onDecrement={() => handleDecrement(index)}
              onCustomAmount={(value) => handleCustomAmount(index, value)}
              onUnitPress={() => handleIngredientUnitSelection(index)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Save Button */}
      {totalConsumed > 0 && (
        <View style={styles.footer}>
          <Button
            title={saving ? 'Guardando...' : 'Guardar Cambios'}
            onPress={handleSave}
            disabled={saving}
          />
        </View>
      )}

      {/* Unit Picker Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={unitPickerVisible}
        onRequestClose={closeUnitPicker}
      >
        <Pressable
          style={styles.unitModalOverlay}
          onPress={closeUnitPicker}
        >
          <Pressable style={styles.unitModalSheet} onPress={() => {}}>
            <View style={styles.unitModalHandle} />
            <Text style={styles.unitModalTitle}>Seleccionar unidad</Text>
            <Text style={styles.unitModalSubtitle}>
              {unitPickerTarget?.type === 'dish'
                ? 'Elige la unidad para el plato cocinado'
                : 'Elige la unidad para este ingrediente'}
            </Text>

            <View style={styles.unitOptions}>
              {FOOD_UNITS.map((unit) => {
                const isSelected =
                  unitPickerTarget?.type === 'dish'
                    ? unit === selectedUnit
                    : unit === consumptions[unitPickerTarget?.index ?? 0]?.selectedUnit;

                return (
                  <TouchableOpacity
                    key={unit}
                    onPress={() => handleUnitPick(unit)}
                    activeOpacity={0.8}
                    style={[styles.unitChip, isSelected && styles.unitChipSelected]}
                  >
                    <Text
                      style={[
                        styles.unitChipText,
                        isSelected && styles.unitChipTextSelected,
                      ]}
                    >
                      {unit}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={closeUnitPicker}
              style={styles.unitModalCancel}
              activeOpacity={0.8}
            >
              <Text style={styles.unitModalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

/**
 * IngredientCard Component
 */
interface IngredientCardProps {
  consumption: IngredientConsumption;
  onIncrement: () => void;
  onDecrement: () => void;
  onCustomAmount: (value: string) => void;
  onUnitPress: () => void;
}

const IngredientCard: React.FC<IngredientCardProps> = ({
  consumption,
  onIncrement,
  onDecrement,
  onCustomAmount,
  onUnitPress,
}) => {
  const { ingredientName, measure, inventoryItem, consumedAmount, selectedUnit } = consumption;

  if (!inventoryItem) {
    return (
      <Card style={StyleSheet.flatten([styles.itemCard, styles.itemCardUnavailable])}>
        <View style={styles.itemHeader}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{ingredientName}</Text>
            <Text style={styles.itemUnavailable}>No disponible en tu nevera</Text>
            {measure && <Text style={styles.itemMeasure}>{measure}</Text>}
          </View>
        </View>
      </Card>
    );
  }

  // Convert consumed amount to inventory unit for accurate remaining calculation
  const inventoryUnit = inventoryItem.unit as FoodUnit;
  const amountInInventoryUnit = convertUnits(consumedAmount, selectedUnit, inventoryUnit);
  const remainingQuantity = inventoryItem.quantity - amountInInventoryUnit;
  const isFullyConsumed = remainingQuantity <= 0;

  return (
    <Card style={[styles.itemCard, isFullyConsumed && styles.itemCardConsumed]}>
      <View style={styles.itemHeader}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{ingredientName}</Text>
          {measure && <Text style={styles.itemMeasure}>📝 {measure}</Text>}
          <View style={styles.itemQuantityRow}>
            <Text style={styles.itemQuantityLabel}>Disponible:</Text>
            <Text style={styles.itemQuantity}>
              {inventoryItem.quantity} {inventoryItem.unit}
            </Text>
          </View>
          {consumedAmount > 0 && (
            <View style={styles.itemQuantityRow}>
              <Text style={styles.itemRemainingLabel}>Restante:</Text>
              <Text style={[
                styles.itemRemaining,
                isFullyConsumed && styles.itemRemainingZero
              ]}>
                {remainingQuantity} {inventoryItem.unit}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Consumption Controls */}
      <View style={styles.controlsRow}>
        <TouchableOpacity
          onPress={onDecrement}
          style={[styles.controlButton, consumedAmount === 0 && styles.controlButtonDisabled]}
          disabled={consumedAmount === 0}
          activeOpacity={0.7}
        >
          <Minus size={20} color={consumedAmount === 0 ? colors.outline : colors.onPrimary} />
        </TouchableOpacity>

        <View style={styles.amountInputContainer}>
          <TextInput
            style={styles.amountInput}
            value={consumedAmount.toString()}
            onChangeText={onCustomAmount}
            keyboardType="decimal-pad"
            selectTextOnFocus
          />
          <TouchableOpacity onPress={onUnitPress} activeOpacity={0.7}>
            <Text style={styles.unitLabel}>{selectedUnit}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={onIncrement}
          style={[
            styles.controlButton,
            consumedAmount >= inventoryItem.quantity && styles.controlButtonDisabled
          ]}
          disabled={consumedAmount >= inventoryItem.quantity}
          activeOpacity={0.7}
        >
          <Plus
            size={20}
            color={consumedAmount >= inventoryItem.quantity ? colors.outline : colors.onPrimary}
          />
        </TouchableOpacity>
      </View>

      {/* Unit conversion indicator */}
      {selectedUnit !== inventoryUnit && consumedAmount > 0 && (
        <View style={styles.conversionNote}>
          <Text style={styles.conversionNoteText}>
            ↔️ {consumedAmount} {selectedUnit} = {amountInInventoryUnit.toFixed(2)} {inventoryUnit}
          </Text>
        </View>
      )}

      {isFullyConsumed && (
        <View style={styles.fullyConsumedBadge}>
          <Text style={styles.fullyConsumedText}>Se eliminará</Text>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFE5EC',
  },
  header: {
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
    marginBottom: spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  backButton: {
    padding: 4,
    marginRight: 4,
  },
  headerTitle: {
    ...typography.headlineLarge,
    fontSize: 28,
    fontWeight: '800',
    color: colors.onSurface,
    flex: 1,
  },
  headerSubtitle: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    opacity: 0.9,
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  summaryCard: {
    marginBottom: spacing.md,
    backgroundColor: '#B5EAD7',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryEmoji: {
    fontSize: 24,
  },
  summaryText: {
    ...typography.bodyLarge,
    color: colors.onSurface,
    fontWeight: '600',
  },
  instructionsCard: {
    marginBottom: spacing.md,
    backgroundColor: '#FFF0B3',
  },
  instructionsTitle: {
    ...typography.titleSmall,
    color: colors.onSurface,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  instructionsText: {
    ...typography.bodySmall,
    color: colors.onSurface,
  },
  cookedDishCard: {
    marginBottom: spacing.md,
    backgroundColor: '#E8F5E9',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    fontWeight: '600',
    flex: 1,
  },
  portionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  portionsLabel: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  portionsInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  portionsButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portionsInput: {
    ...typography.titleMedium,
    color: colors.onSurface,
    fontWeight: '700',
    textAlign: 'center',
    width: 50,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.outline,
  },
  cookedDishNote: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    fontStyle: 'italic',
  },
  unitSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  unitSelector: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.primary,
    minWidth: 100,
    alignItems: 'center',
  },
  unitSelectorText: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    fontWeight: '600',
  },
  conversionNote: {
    marginTop: spacing.xs,
    backgroundColor: '#E3F2FD',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    alignSelf: 'center',
  },
  conversionNoteText: {
    ...typography.labelSmall,
    color: '#1976D2',
    fontWeight: '600',
  },
  itemsList: {
    gap: spacing.md,
  },
  itemCard: {
    padding: spacing.md,
  },
  itemCardConsumed: {
    backgroundColor: 'rgba(255, 107, 157, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 107, 157, 0.3)',
  },
  itemCardUnavailable: {
    backgroundColor: 'rgba(158, 158, 158, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(158, 158, 158, 0.2)',
  },
  itemHeader: {
    marginBottom: spacing.md,
  },
  itemInfo: {
    gap: spacing.xs,
  },
  itemName: {
    ...typography.titleMedium,
    color: colors.onSurface,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  itemMeasure: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    fontStyle: 'italic',
  },
  itemUnavailable: {
    ...typography.bodySmall,
    color: colors.error,
    fontWeight: '600',
  },
  itemQuantityRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  itemQuantityLabel: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  itemQuantity: {
    ...typography.bodySmall,
    color: colors.onSurface,
    fontWeight: '600',
  },
  itemRemainingLabel: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  itemRemaining: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  itemRemainingZero: {
    color: colors.error,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  controlButtonDisabled: {
    backgroundColor: colors.surfaceVariant,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.outline,
    paddingHorizontal: spacing.sm,
  },
  amountInput: {
    ...typography.titleLarge,
    color: colors.onSurface,
    fontWeight: '700',
    textAlign: 'center',
    minWidth: 60,
    padding: spacing.sm,
  },
  unitLabel: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
  fullyConsumedBadge: {
    marginTop: spacing.sm,
    backgroundColor: colors.errorContainer,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    alignSelf: 'center',
  },
  fullyConsumedText: {
    ...typography.labelSmall,
    color: colors.error,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 2,
    borderTopColor: colors.surfaceVariant,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  unitModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'flex-end',
  },
  unitModalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  unitModalHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.outlineVariant,
    marginBottom: spacing.md,
  },
  unitModalTitle: {
    ...typography.titleLarge,
    color: colors.onSurface,
    fontWeight: '700',
    marginBottom: 4,
  },
  unitModalSubtitle: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.md,
  },
  unitOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  unitChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 2,
    borderColor: colors.outlineVariant,
  },
  unitChipSelected: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  unitChipText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
  unitChipTextSelected: {
    color: colors.onPrimaryContainer,
  },
  unitModalCancel: {
    marginTop: spacing.lg,
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceVariant,
  },
  unitModalCancelText: {
    ...typography.labelMedium,
    color: colors.onSurface,
    fontWeight: '600',
  },
});

export default ConsumeRecipeIngredientsScreen;
