import React, { useState } from 'react';
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
import { ArrowLeft, Minus, Plus, Check } from 'lucide-react-native';
import { RootStackParamList } from '../types';
import { colors, typography, spacing } from '../theme';
import { borderRadius } from '../theme/spacing';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { useInventory } from '../hooks/useInventory';
import FoodItem from '../database/models/FoodItem';

type ConsumeIngredientsNavigationProp = StackNavigationProp<RootStackParamList, 'ConsumeIngredients'>;

interface Props {
  navigation: ConsumeIngredientsNavigationProp;
}

interface ConsumptionItem {
  item: FoodItem;
  consumedAmount: number;
}

const ConsumeIngredientsScreen: React.FC<Props> = ({ navigation }) => {
  const { items, updateItem, deleteItem } = useInventory();
  const [consumptions, setConsumptions] = useState<Map<string, number>>(new Map());
  const [saving, setSaving] = useState(false);

  const handleIncrement = (itemId: string, currentQuantity: number) => {
    const consumed = consumptions.get(itemId) || 0;
    if (consumed < currentQuantity) {
      const newConsumptions = new Map(consumptions);
      newConsumptions.set(itemId, consumed + 1);
      setConsumptions(newConsumptions);
    }
  };

  const handleDecrement = (itemId: string) => {
    const consumed = consumptions.get(itemId) || 0;
    if (consumed > 0) {
      const newConsumptions = new Map(consumptions);
      newConsumptions.set(itemId, consumed - 1);
      setConsumptions(newConsumptions);
    }
  };

  const handleCustomAmount = (itemId: string, value: string, maxQuantity: number) => {
    const amount = parseFloat(value) || 0;
    if (amount >= 0 && amount <= maxQuantity) {
      const newConsumptions = new Map(consumptions);
      newConsumptions.set(itemId, amount);
      setConsumptions(newConsumptions);
    }
  };

  const handleSave = async () => {
    if (consumptions.size === 0) {
      Alert.alert('Sin cambios', 'No has consumido ningún ingrediente');
      return;
    }

    setSaving(true);
    try {
      const updates: ConsumptionItem[] = [];

      for (const [itemId, consumed] of consumptions.entries()) {
        if (consumed > 0) {
          const item = items.find((i) => i.id === itemId);
          if (item) {
            updates.push({ item, consumedAmount: consumed });
          }
        }
      }

      if (updates.length === 0) {
        Alert.alert('Sin cambios', 'No has consumido ningún ingrediente');
        setSaving(false);
        return;
      }

      // Update all items
      for (const { item, consumedAmount } of updates) {
        const newQuantity = item.quantity - consumedAmount;

        if (newQuantity <= 0) {
          // Delete item if fully consumed
          await deleteItem(item.id);
        } else {
          // Update quantity
          await updateItem(item.id, { quantity: newQuantity });
        }
      }

      const consumedIds = updates.map((update) => update.item.id);

      Alert.alert(
        'Actualizado',
        `Se actualizaron ${updates.length} ingrediente(s)`,
        [
          {
            text: 'Registrar en calendario',
            onPress: () =>
              navigation.navigate('AddMeal', {
                prefillIngredientIds: consumedIds,
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

  const totalConsumed = Array.from(consumptions.values()).reduce((sum, val) => sum + val, 0);

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
          <Text style={styles.headerTitle}>Consumir Ingredientes</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          Ajusta las cantidades consumidas 🍽️
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

        {/* Items List */}
        {items.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🍎</Text>
            <Text style={styles.emptyText}>No hay ingredientes en tu nevera</Text>
          </Card>
        ) : (
          <View style={styles.itemsList}>
            {items.map((item) => (
              <ConsumptionCard
                key={item.id}
                item={item}
                consumedAmount={consumptions.get(item.id) || 0}
                onIncrement={() => handleIncrement(item.id, item.quantity)}
                onDecrement={() => handleDecrement(item.id)}
                onCustomAmount={(value) => handleCustomAmount(item.id, value, item.quantity)}
              />
            ))}
          </View>
        )}
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
 * ConsumptionCard Component
 */
interface ConsumptionCardProps {
  item: FoodItem;
  consumedAmount: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onCustomAmount: (value: string) => void;
}

const ConsumptionCard: React.FC<ConsumptionCardProps> = ({
  item,
  consumedAmount,
  onIncrement,
  onDecrement,
  onCustomAmount,
}) => {
  const remainingQuantity = item.quantity - consumedAmount;
  const isFullyConsumed = remainingQuantity <= 0;

  return (
    <Card style={[styles.itemCard, isFullyConsumed && styles.itemCardConsumed]}>
      <View style={styles.itemHeader}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          <View style={styles.itemQuantityRow}>
            <Text style={styles.itemQuantityLabel}>Disponible:</Text>
            <Text style={styles.itemQuantity}>
              {item.quantity} {item.unit}
            </Text>
          </View>
          {consumedAmount > 0 && (
            <View style={styles.itemQuantityRow}>
              <Text style={styles.itemRemainingLabel}>Restante:</Text>
              <Text style={[
                styles.itemRemaining,
                isFullyConsumed && styles.itemRemainingZero
              ]}>
                {remainingQuantity} {item.unit}
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
          style={[styles.controlButton, consumedAmount >= item.quantity && styles.controlButtonDisabled]}
          disabled={consumedAmount >= item.quantity}
          activeOpacity={0.7}
        >
          <Plus size={20} color={consumedAmount >= item.quantity ? colors.outline : colors.onPrimary} />
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
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.bodyLarge,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
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

export default ConsumeIngredientsScreen;
