import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { ArrowLeft, Minus, Plus, Check } from 'lucide-react-native';
import { RootStackParamList } from '../types';
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
}

const ConsumeRecipeIngredientsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { recipeName, matchedIngredients, ingredientsWithMeasures } = route.params;
  const { items, updateItem, deleteItem } = useInventory();
  const [consumptions, setConsumptions] = useState<IngredientConsumption[]>([]);
  const [saving, setSaving] = useState(false);

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
      // Update all items
      for (const consumption of itemsToUpdate) {
        if (!consumption.inventoryItem) continue;

        const newQuantity = consumption.inventoryItem.quantity - consumption.consumedAmount;

        if (newQuantity <= 0) {
          // Delete item if fully consumed
          await deleteItem(consumption.inventoryItem.id);
        } else {
          // Update quantity
          await updateItem(consumption.inventoryItem.id, { quantity: newQuantity });
        }
      }

      Alert.alert(
        '¡Listo!',
        `Se actualizaron ${itemsToUpdate.length} ingrediente(s)`,
        [
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

        {/* Ingredients List */}
        <View style={styles.itemsList}>
          {consumptions.map((consumption, index) => (
            <IngredientCard
              key={`${consumption.ingredientName}-${index}`}
              consumption={consumption}
              onIncrement={() => handleIncrement(index)}
              onDecrement={() => handleDecrement(index)}
              onCustomAmount={(value) => handleCustomAmount(index, value)}
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
            icon={<Check size={20} color="#000000" />}
          />
        </View>
      )}
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
}

const IngredientCard: React.FC<IngredientCardProps> = ({
  consumption,
  onIncrement,
  onDecrement,
  onCustomAmount,
}) => {
  const { ingredientName, measure, inventoryItem, consumedAmount } = consumption;

  if (!inventoryItem) {
    return (
      <Card style={[styles.itemCard, styles.itemCardUnavailable]}>
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

  const remainingQuantity = inventoryItem.quantity - consumedAmount;
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

        <TextInput
          style={styles.amountInput}
          value={consumedAmount.toString()}
          onChangeText={onCustomAmount}
          keyboardType="decimal-pad"
          selectTextOnFocus
        />

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
  amountInput: {
    ...typography.titleLarge,
    color: colors.onSurface,
    fontWeight: '700',
    textAlign: 'center',
    minWidth: 80,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.outline,
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
});

export default ConsumeRecipeIngredientsScreen;
