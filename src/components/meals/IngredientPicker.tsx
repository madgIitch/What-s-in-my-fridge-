import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import { colors, typography, spacing } from '../../theme';
import { borderRadius } from '../../theme/spacing';
import FoodItem from '../../database/models/FoodItem';

interface IngredientPickerProps {
  items: FoodItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export const IngredientPicker: React.FC<IngredientPickerProps> = ({
  items,
  selectedIds,
  onChange,
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  const selectedCount = selectedIds.length;
  const selectedLabel = selectedCount === 0
    ? 'Seleccionar ingredientes'
    : `${selectedCount} ingrediente(s)`;

  const listData = useMemo(
    () => items.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [items]
  );

  const toggle = (itemId: string) => {
    if (selectedIds.includes(itemId)) {
      onChange(selectedIds.filter((id) => id !== itemId));
    } else {
      onChange([...selectedIds, itemId]);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Ingredientes consumidos</Text>
      <TouchableOpacity style={styles.button} onPress={() => setModalVisible(true)}>
        <Text style={styles.buttonText}>{selectedLabel}</Text>
        <Text style={styles.arrow}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar ingredientes</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={listData}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const selected = selectedIds.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.option, selected && styles.optionSelected]}
                    onPress={() => toggle(item.id)}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                      {item.name}
                    </Text>
                    {selected && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.labelMedium,
    color: colors.onSurface,
    marginBottom: spacing.xs,
  },
  button: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    minHeight: 48,
  },
  buttonText: {
    ...typography.bodyLarge,
    color: colors.onSurface,
    flex: 1,
  },
  arrow: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  modalTitle: {
    ...typography.titleLarge,
    color: colors.onSurface,
  },
  closeButton: {
    ...typography.headlineSmall,
    color: colors.onSurfaceVariant,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  optionSelected: {
    backgroundColor: colors.primaryContainer,
  },
  optionText: {
    ...typography.bodyLarge,
    color: colors.onSurface,
  },
  optionTextSelected: {
    color: colors.onPrimaryContainer,
    fontWeight: '500',
  },
  checkmark: {
    ...typography.titleMedium,
    color: colors.primary,
  },
});
